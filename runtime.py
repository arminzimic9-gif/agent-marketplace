"""App-owned records shared by the authenticated service and supervised job."""

from __future__ import annotations

import contextlib
import fcntl
import json
import os
import re
import tempfile
from datetime import UTC, datetime
from pathlib import Path


ID = re.compile(r"^[a-z][a-z0-9-]{0,47}$")
RUN_ID = re.compile(r"^[0-9a-f]{32}$")
MAX_OUTPUT = 100_000
BUILTINS = (("sentinel", "agent.json", "sentinel.playbook.md"),
            ("researcher", "researcher.json", "researcher.playbook.md"),
            ("design-critic", "critic.json", "critic.playbook.md"),
            ("bug-triage", "bug-triage.json", "bug-triage.playbook.md"),
            ("launch-writer", "launch-writer.json", "launch-writer.playbook.md"),
            ("seo-scout", "seo-scout.json", "seo-scout.playbook.md"),
            ("brief-builder", "brief-builder.json", "brief-builder.playbook.md"),
            ("recruiter", "recruiter.json", "recruiter.playbook.md"))
BUILTIN_IDS = {item[0] for item in BUILTINS}
# Every agent remembers its own model; until the owner picks one it uses this.
DEFAULT_MODEL = {"provider": "claude", "model": "claude-opus-5-5", "effort": ""}
RUNNABLE_PROVIDERS = {"claude", "codex"}


def now() -> str:
    return datetime.now(UTC).isoformat()


def root() -> Path:
    value = os.environ.get("APP_STORAGE_DIR")
    if not value:
        value = str(Path(os.environ.get("DATA_DIR", "/data")) / "apps" /
                    os.environ["APP_ID"])
    path = Path(value)
    path.mkdir(parents=True, exist_ok=True)
    return path


def record_path(kind: str, name: str, file: str | None = None) -> Path:
    if kind == "agents":
        if not ID.fullmatch(name):
            raise ValueError("Invalid agent id.")
        allowed = {"agent.json", "playbook.md", "config.json"}
        if file not in allowed:
            raise ValueError("Invalid agent file.")
        target = root() / kind / name / file
    elif kind in {"runs", "feedback", "mentions", "pending", "inbox"}:
        if not RUN_ID.fullmatch(name):
            raise ValueError("Invalid record id.")
        target = root() / kind / (name + ".json")
    else:
        raise ValueError("Invalid record kind.")
    if target.parent.is_symlink() or target.is_symlink():
        raise ValueError("App storage contains a symlink.")
    return target


@contextlib.contextmanager
def locked():
    path = root() / ".marketplace.lock"
    if path.is_symlink():
        raise ValueError("App storage lock is a symlink.")
    with path.open("a+b") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def read_json(path: Path, default=None):
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return default


def read_text(path: Path, default="") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return default


def write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.parent.is_symlink() or path.is_symlink():
        raise ValueError("App storage contains a symlink.")
    fd, temporary = tempfile.mkstemp(prefix=".write-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(value)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_json(path: Path, value) -> None:
    write_text(path, json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def seed_builtins() -> None:
    """Install built-ins and keep them equal to this app version's bundled definitions.

    Built-in manifests and playbooks are app-owned (there is no editor for
    them), so an app update replaces them; each agent's config.json — its
    triggers, model and saved notes — is never touched here.
    """
    source = Path(__file__).parent
    with locked():
        for agent_id, manifest_file, playbook_file in BUILTINS:
            manifest_path = record_path("agents", agent_id, "agent.json")
            playbook_path = record_path("agents", agent_id, "playbook.md")
            for path, bundled in ((manifest_path, manifest_file), (playbook_path, playbook_file)):
                text = (source / bundled).read_text(encoding="utf-8")
                if read_text(path, None) != text:
                    write_text(path, text)
            config_path = record_path("agents", agent_id, "config.json")
            if not config_path.exists():
                write_json(config_path, {"mention": False, "cron": False,
                                         "bug_inbox": False, "cv_inbox": False,
                                         "time": "08:00", "timezone": "UTC"})


def agent(agent_id: str):
    path = record_path("agents", agent_id, "agent.json")
    manifest = read_json(path)
    if not isinstance(manifest, dict) or manifest.get("id") != agent_id:
        return None
    return manifest


def workflow(agent_id: str) -> str:
    """Keep an imported copy's specialty independent of its installed slug."""
    manifest = agent(agent_id)
    original = (manifest or {}).get("experience") or {}
    family = original.get("workflow_id")
    return family if family in BUILTIN_IDS else agent_id


def agents() -> list[dict]:
    base = root() / "agents"
    if not base.exists():
        return []
    found = []
    for child in sorted(base.iterdir()):
        if not child.is_dir() or child.is_symlink() or not ID.fullmatch(child.name):
            continue
        value = agent(child.name)
        if value is not None:
            found.append(value)
    return found


def config(agent_id: str) -> dict:
    value = read_json(record_path("agents", agent_id, "config.json"), {})
    return value if isinstance(value, dict) else {}


def model_choice(agent_id: str) -> dict:
    """The provider/model this agent runs on: its remembered pick, else the default."""
    value = config(agent_id).get("model")
    if (isinstance(value, dict) and value.get("provider") in RUNNABLE_PROVIDERS
            and isinstance(value.get("model"), str) and value["model"]):
        return {"provider": value["provider"], "model": value["model"],
                "effort": str(value.get("effort") or "")}
    return dict(DEFAULT_MODEL)


def run(run_id: str):
    value = read_json(record_path("runs", run_id))
    return value if isinstance(value, dict) and value.get("id") == run_id else None


def runs(limit: int | None = 80) -> list[dict]:
    base = root() / "runs"
    if not base.exists():
        return []
    found = []
    for path in base.glob("*.json"):
        if RUN_ID.fullmatch(path.stem):
            value = run(path.stem)
            if value is not None:
                found.append(value)
    ordered = sorted(found, key=lambda value: value.get("created_at", ""), reverse=True)
    return ordered[:limit] if limit is not None else ordered


def feedback_for(agent_id: str) -> list[dict]:
    result = []
    for entry in runs():
        if entry.get("agent_id") != agent_id:
            continue
        value = read_json(record_path("feedback", entry["id"]))
        if isinstance(value, dict) and (value.get("rating") or value.get("note")):
            result.append(value)
    return result[:8]


def lessons_for(agent_id: str) -> list[dict]:
    return [{"rating": item.get("rating"), "note": str(item.get("note") or "")[:500],
             "from_run": item.get("run_id")}
            for item in feedback_for(agent_id)]


def public_run(value: dict) -> dict:
    """Never return transient prompt input or provider diagnostics to the UI."""
    return {key: item for key, item in value.items()
            if key not in {"input", "provider_stderr"}}
