"""Private GitHub sync of distilled agent knowledge.

Only text built by this app from approved rules and "What I learned" records
is ever written to the repository. The owner creates one private repository and
a fine-grained token limited to that single repository (Contents read/write);
the token is stored 0600 in this app's storage, is never returned to the UI,
logged, exported or written to the repository, and the repository is verified
private through the GitHub API immediately before every write. A public
repository is never written to or read from.
"""

from __future__ import annotations

import base64
import fcntl
import json
import os
import re
import urllib.error
import urllib.request
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from runtime import read_json, root, write_json


REPO_NAME = "agent-marketplace-knowledge"
API = "https://api.github.com"
TIMEOUT = 30
AGENT_DIR = re.compile(r"^[a-z0-9][a-z0-9-]{0,47}$")
REPO_FULL = re.compile(r"^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/" + re.escape(REPO_NAME) + r"$")
TOKEN = re.compile(r"^(?:github_pat_[A-Za-z0-9_]{20,255}|ghp_[A-Za-z0-9]{20,255})$")

SECRET = re.compile(
    r"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|"
    r"AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|"
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{16,}|"
    r"(?:api[_-]?key|secret|password|token)\s*[:=]\s*\S{8,})", re.I)
PERSONAL = re.compile(r"(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d .()/-]{7,}\d|https?://\S+)", re.I)


class SyncRefused(Exception):
    """The sync was refused on purpose (public repo, secret, no token)."""


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def state_path() -> Path:
    return root() / "knowledge-sync.json"


def token_path() -> Path:
    return root() / "knowledge-token.json"


def state() -> dict:
    value = read_json(state_path())
    value = value if isinstance(value, dict) else {}
    value.setdefault("enabled", False)  # sync is off until the owner turns it on
    value.setdefault("agents", {})
    value.setdefault("last_error", None)
    return value


def save_state(value: dict) -> None:
    write_json(state_path(), value)


def _credentials() -> dict | None:
    value = read_json(token_path())
    if isinstance(value, dict) and TOKEN.fullmatch(value.get("token") or "") and REPO_FULL.fullmatch(value.get("repo") or ""):
        return value
    return None


def save_token(token: str, repo: str) -> None:
    """Store the owner's token 0600; it is never read back out through the API."""
    path = token_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump({"token": token, "repo": repo, "saved_at": now()}, handle)
    os.chmod(path, 0o600)


def remove_token() -> None:
    try:
        token_path().unlink()
    except FileNotFoundError:
        pass


def _clean(text: str) -> str:
    value = (text or "").strip()
    creds = _credentials()
    if creds:
        value = value.replace(creds["token"], "[removed]")
    return SECRET.sub("[removed]", value)[:300]


def api(method: str, path: str, body: dict | None = None, *, token: str | None = None) -> tuple[int, dict | list | None]:
    """One GitHub REST call with the stored token; the token never leaves this function."""
    secret = token or (_credentials() or {}).get("token")
    if not secret:
        raise SyncRefused("No GitHub token is saved. Add one in Settings.")
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(API + "/" + path.lstrip("/"), data=data, method=method, headers={
        "Authorization": "Bearer " + secret, "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "agent-marketplace",
        **({"Content-Type": "application/json"} if data is not None else {})})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as exc:
        status, raw = exc.code, exc.read()
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise SyncRefused("GitHub is not reachable: " + _clean(str(exc))) from exc
    try:
        parsed = json.loads(raw) if raw.strip() else None
    except ValueError:
        parsed = None
    if status == 401:
        raise SyncRefused("GitHub rejected the token. Create a new one and save it in Settings.")
    return status, parsed


def connection() -> dict:
    """Whether the owner has saved a token, and for which repository."""
    creds = _credentials()
    if not creds:
        return {"configured": False, "repo": None, "login": None}
    return {"configured": True, "repo": creds["repo"], "login": creds["repo"].split("/")[0]}


def effective_enabled(conn: dict, saved: dict) -> bool:
    return bool(conn["configured"] and saved.get("enabled"))


def repo_info(conn: dict, *, token: str | None = None, repo: str | None = None) -> dict | None:
    full = repo or conn.get("repo")
    if not full:
        return None
    status, data = api("GET", f"repos/{full}", token=token)
    if status in {403, 404}:
        return None
    if status != 200 or not isinstance(data, dict):
        raise SyncRefused("Could not check the knowledge repository.")
    return {"full": data["full_name"], "private": data.get("private") is True, "url": data["html_url"],
            "branch": data.get("default_branch") or "main",
            "can_write": bool((data.get("permissions") or {}).get("push", True))}


def other_repos(token: str, repo: str) -> bool:
    """True when the token can reach repositories other than the knowledge repository."""
    try:
        status, data = api("GET", "user/repos?per_page=5&affiliation=owner,collaborator,organization_member", token=token)
    except SyncRefused:
        return False
    return status == 200 and isinstance(data, list) and any(item.get("full_name", "").lower() != repo.lower() for item in data)


def verify_private(conn: dict) -> dict:
    info = repo_info(conn)
    if info is None:
        raise SyncRefused(f"The repository {conn['repo']} was not found with this token. Check that it exists and the token can use it.")
    if not info["private"]:
        raise SyncRefused("The knowledge repository is public; nothing was pushed or read.")
    return info


def check_files(files: dict[str, str]) -> None:
    """Refuse to push anything that looks like a credential."""
    for name, content in files.items():
        if SECRET.search(content):
            raise SyncRefused(f"{name} looks like it contains a secret; nothing was pushed.")


def redact(text: str, names: list[str] | tuple[str, ...] = ()) -> str:
    """Distilled-lesson hygiene: no links, contacts or candidate names."""
    value = PERSONAL.sub("[removed]", text or "")
    for name in sorted({item for item in names if isinstance(item, str) and len(item) >= 3}, key=len, reverse=True):
        value = re.sub(re.escape(name), "a candidate", value, flags=re.I)
    return SECRET.sub("[removed]", value)


@contextmanager
def _lock():
    path = root() / "knowledge-sync.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def push(agent_id: str, files: dict[str, str], message: str, conn: dict) -> dict:
    """Write one agent's folder as a single commit to the private repository."""
    if not AGENT_DIR.fullmatch(agent_id):
        raise SyncRefused("Invalid agent id.")
    if not conn["configured"]:
        raise SyncRefused("No GitHub token is saved. Add one in Settings.")
    check_files(files)
    for name in files:
        if "/" in name or name.startswith("."):
            raise SyncRefused("Invalid file name.")
    with _lock():
        info = verify_private(conn)  # verified private right now
        repo, branch = info["full"], info["branch"]
        status, ref = api("GET", f"repos/{repo}/git/ref/heads/{branch}")
        if status != 200 or not isinstance(ref, dict):
            raise SyncRefused("The repository has no commits yet. Create it with “Add a README” and try again.")
        parent = ref["object"]["sha"]
        _, commit = api("GET", f"repos/{repo}/git/commits/{parent}")
        base_tree = commit["tree"]["sha"]
        entries = []
        for name, content in files.items():
            status, blob = api("POST", f"repos/{repo}/git/blobs", {"content": content, "encoding": "utf-8"})
            if status != 201:
                raise SyncRefused("Could not write to the repository. The token needs Contents: read and write.")
            entries.append({"path": f"agents/{agent_id}/{name}", "mode": "100644", "type": "blob", "sha": blob["sha"]})
        status, tree = api("POST", f"repos/{repo}/git/trees", {"base_tree": base_tree, "tree": entries})
        if status != 201:
            raise SyncRefused("Could not write to the repository. The token needs Contents: read and write.")
        if tree["sha"] == base_tree:
            return {"changed": False, "commit": parent, "url": f"{info['url']}/commit/{parent}", "repo": repo}
        status, created = api("POST", f"repos/{repo}/git/commits", {"message": message, "tree": tree["sha"], "parents": [parent]})
        if status != 201:
            raise SyncRefused("Could not create the commit.")
        # Re-check right before the branch moves: visibility can change at any time.
        again = repo_info(conn)
        if again is None or not again["private"]:
            raise SyncRefused("The knowledge repository is public; nothing was pushed.")
        status, _ = api("PATCH", f"repos/{repo}/git/refs/heads/{branch}", {"sha": created["sha"], "force": False})
        if status != 200:
            raise SyncRefused("Push failed; the branch has moved. Try again.")
        return {"changed": True, "commit": created["sha"], "url": f"{info['url']}/commit/{created['sha']}", "repo": repo}


def remote_agents(conn: dict) -> list[str]:
    """Agent folders in the private repo."""
    if not conn["configured"]:
        raise SyncRefused("No GitHub token is saved. Add one in Settings.")
    info = verify_private(conn)
    status, data = api("GET", f"repos/{info['full']}/contents/agents")
    if status != 200 or not isinstance(data, list):
        return []
    return sorted(item["name"] for item in data if item.get("type") == "dir" and AGENT_DIR.fullmatch(item.get("name", "")))


def fetch_package(conn: dict, agent_id: str) -> dict:
    if not AGENT_DIR.fullmatch(agent_id):
        raise SyncRefused("Invalid agent id.")
    if not conn["configured"]:
        raise SyncRefused("No GitHub token is saved. Add one in Settings.")
    info = verify_private(conn)
    status, data = api("GET", f"repos/{info['full']}/contents/agents/{agent_id}/rules.json")
    if status != 200 or not isinstance(data, dict) or data.get("encoding") != "base64":
        raise SyncRefused("This agent has no experience package in the repository.")
    try:
        return json.loads(base64.b64decode(data["content"]).decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise SyncRefused("The package in the repository is not valid JSON.") from exc
