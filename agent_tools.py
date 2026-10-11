"""Small, capability-scoped MCP server for one Marketplace run.

The model sees only listed tools.  This process receives neither an app token
nor owner credentials; its configuration contains only a copied work area and
the public URLs explicitly admitted for this run.  No arbitrary shell tool is
exposed.  JSONL events are append-only so the supervising job can poll them.
"""

from __future__ import annotations

import ast
import base64
import difflib
import fcntl
import hashlib
import html.parser
import http.client
import ipaddress
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path


TOOLS = {
    "record_plan": ("Record a short plan before using other tools.", {"steps": "array"}),
    "read_evidence": ("Read a bounded excerpt of owner-selected, copied evidence.", {"name": "string", "offset": "integer"}),
    "search_research": ("Search public scholarly works by topic; returns source URLs and abstracts.", {"query": "string"}),
    "fetch_public_page": ("Read a public HTTPS page, never an internal host.", {"url": "string"}),
    "capture_page": ("Capture the owner-selected public page at desktop and 390×844.", {"url": "string"}),
    "write_patch": ("Write a proposed replacement into the copied source, never the real app.", {"name": "string", "content": "string"}),
    "run_checks": ("Run non-executing syntax checks on the copied source.", {}),
    "check_rules": ("Check proposed hiring reasoning for protected traits.", {"text": "string"}),
    "self_check": ("Record a concise check of the result against the task and approved rules.", {"summary": "string"}),
}
BASE = frozenset({"record_plan", "self_check"})
BY_WORKFLOW = {
    "sentinel": frozenset({"read_evidence", "write_patch", "run_checks"}),
    "design-critic": frozenset({"read_evidence", "fetch_public_page", "capture_page"}),
    "researcher": frozenset({"search_research", "fetch_public_page"}),
    "recruiter": frozenset({"read_evidence", "fetch_public_page", "check_rules"}),
    "seo-scout": frozenset({"read_evidence", "fetch_public_page"}),
    "bug-triage": frozenset({"read_evidence"}),
    "launch-writer": frozenset({"read_evidence"}),
    "brief-builder": frozenset({"read_evidence"}),
}
SENSITIVE = re.compile(r"\b(age|sex|gender|ethnic(?:ity)?|race|religion|photo(?:graph)?|family status|dob|date of birth|godin[ae]|spol|pol|etni(?:čka|cki)|vjer[ae]|religij[ae]|fotografij[ae]|porodičn[io]|obiteljsk[io])\b", re.I)
MAX_RESULT = 16_000


def allowed_tools(workflow: str, declared: list[dict]) -> list[str]:
    """A manifest requests tools; the code-owned workflow ceiling grants them."""
    # Custom agents may request any named *safe* Marketplace tool; the manifest
    # still cannot create a shell, filesystem, network or credential primitive.
    ceiling = BY_WORKFLOW.get(workflow, frozenset(set(TOOLS) - BASE))
    legacy = {"code.review": {"read_evidence"}, "filesystem.read": {"read_evidence"},
              "web.fetch": {"fetch_public_page"}, "memory.suggest": set()}
    requested = set()
    for item in declared:
        if isinstance(item, dict):
            name = item.get("name")
            requested.update(legacy.get(name, {name}))
    unknown = requested - set(TOOLS)
    if unknown:
        raise ValueError("Undeclared Marketplace tool name: " + ", ".join(sorted(unknown)))
    excess = requested - ceiling - BASE
    if excess:
        raise ValueError("Tool outside this agent's allowed set: " + ", ".join(sorted(excess)))
    return sorted(BASE | (requested & ceiling))


def _schema(fields: dict) -> dict:
    properties = {}
    for name, kind in fields.items():
        properties[name] = {"type": kind, **({"items": {"type": "string"}} if kind == "array" else {})}
    return {"type": "object", "properties": properties, "required": [k for k in fields if k != "offset"], "additionalProperties": False}


def definitions(names: list[str]) -> list[dict]:
    return [{"name": name, "description": TOOLS[name][0], "inputSchema": _schema(TOOLS[name][1])}
            for name in names]


def _public_host(host: str | None) -> str:
    if not host:
        raise ValueError("URL has no host.")
    infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not infos or any(not ipaddress.ip_address(info[4][0]).is_global for info in infos):
        raise ValueError("Private or non-public web address refused.")
    return infos[0][4][0]


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """Connect to the checked address, not a second DNS resolution."""
    def __init__(self, host: str, address: str):
        super().__init__(host, port=443, timeout=12)
        self.address = address

    def connect(self):
        sock = socket.create_connection((self.address, 443), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def public_page(url: str, limit: int = 30_000) -> dict:
    for _ in range(4):
        if any(ord(char) < 32 for char in url):
            raise ValueError("Control characters in URL refused.")
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValueError("Use a public HTTPS URL without credentials or a custom port.")
        address = _public_host(parsed.hostname)
        connection = _PinnedHTTPSConnection(parsed.hostname, address)
        try:
            target = (parsed.path or "/") + (("?" + parsed.query) if parsed.query else "")
            connection.request("GET", target, headers={"User-Agent": "Mobius-Marketplace-Agent/2.0"})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise ValueError("Public page redirected without a location.")
                url = urllib.parse.urljoin(url, location)
                continue
            if response.status < 200 or response.status >= 300:
                raise ValueError(f"Public page returned HTTP {response.status}.")
            content_type = (response.getheader("Content-Type") or "").lower()
            if not any(kind in content_type for kind in ("text/", "application/json", "application/xml")):
                raise ValueError("Only public text pages can be read.")
            raw = response.read(limit + 1)
            return {"url": url, "text": raw[:limit].decode("utf-8", "replace"), "truncated": len(raw) > limit}
        finally:
            connection.close()
    raise ValueError("Public page redirected too many times.")


def _work_file(base: Path, name: str) -> Path:
    if not isinstance(name, str) or not name or len(name) > 160:
        raise ValueError("Invalid copied-file name.")
    relative = Path(name)
    if relative.is_absolute() or any(part in {"", ".", ".."} or part.startswith(".") for part in relative.parts):
        raise ValueError("Only copied source files can be accessed.")
    path = base / relative
    if path.is_symlink() or not path.resolve().is_relative_to(base.resolve()):
        raise ValueError("File escaped the run workspace.")
    return path


def _browser_capture(url: str, base: Path) -> dict:
    # Browser automation is a fixed operation: no model-supplied script, click,
    # credentials, or arbitrary navigation.  It runs in its own named profile.
    session = "am-" + hashlib.sha256(str(base).encode()).hexdigest()[:8]
    host = urllib.parse.urlsplit(url).hostname
    browsers = sorted(Path("/opt/agent-browser/browsers").glob("chrome-*/chrome"))
    if not browsers:
        raise ValueError("The platform browser is unavailable for screenshots.")
    env = {k: os.environ[k] for k in ("PATH", "LANG", "LC_ALL") if k in os.environ}
    env.update({"HOME": str(base), "XDG_CONFIG_HOME": str(base / ".config"),
                "XDG_CACHE_HOME": str(base / ".cache"), "AGENT_BROWSER_SESSION": session,
                "AGENT_BROWSER_SOCKET_DIR": "/tmp",
                "AGENT_BROWSER_ALLOWED_DOMAINS": host or "",
                "AGENT_BROWSER_EXECUTABLE_PATH": str(browsers[-1])})
    def command(*parts):
        proc = subprocess.run(["agent-browser", *parts], cwd=base, env=env,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True, timeout=25)
        if proc.returncode:
            raise ValueError("Browser capture failed: " + proc.stderr[-350:])
        return proc.stdout
    try:
        command("open", url)
        actual = command("get", "url").strip()
        if urllib.parse.urlsplit(actual).scheme != "https":
            raise ValueError("Browser left HTTPS; capture refused.")
        _public_host(urllib.parse.urlsplit(actual).hostname)
        results = []
        for label, width, height in (("desktop", 1365, 900), ("phone", 390, 844)):
            command("set", "viewport", str(width), str(height))
            filename = f"{label}.png"
            command("screenshot", str(base / filename))
            results.append({"label": label, "width": width, "height": height,
                            "path": filename, "bytes": (base / filename).stat().st_size})
        return {"url": actual, "screenshots": results}
    finally:
        try:
            command("close")
        except Exception:
            pass


def _run_tool(name: str, args: dict, spec: dict) -> dict:
    base = Path(spec["workspace"])
    evidence = set(spec.get("evidence", []))
    if name == "record_plan":
        steps = args.get("steps")
        if not isinstance(steps, list) or not 1 <= len(steps) <= 8 or any(not isinstance(s, str) or len(s) > 180 for s in steps):
            raise ValueError("Plan needs 1–8 short steps.")
        return {"plan": steps}
    if name == "read_evidence":
        filename = args.get("name")
        if filename not in evidence:
            raise ValueError("Evidence file was not selected for this run.")
        offset = args.get("offset", 0)
        if not isinstance(offset, int) or isinstance(offset, bool) or offset < 0:
            raise ValueError("Invalid offset.")
        content = _work_file(base, filename).read_text("utf-8", "replace")
        return {"name": filename, "offset": offset, "text": content[offset:offset + 14_000],
                "next_offset": offset + 14_000 if offset + 14_000 < len(content) else None}
    if name == "search_research":
        query = args.get("query", "")
        if not isinstance(query, str) or not 2 <= len(query) <= 180:
            raise ValueError("Search query must be 2–180 characters.")
        url = "https://api.openalex.org/works?" + urllib.parse.urlencode({"search": query, "per-page": 5})
        data = json.loads(public_page(url, 70_000)["text"])
        return {"results": [{"title": item.get("display_name"), "year": item.get("publication_year"),
                              "url": (item.get("primary_location") or {}).get("landing_page_url") or item.get("id")}
                             for item in data.get("results", [])[:5]]}
    if name == "fetch_public_page":
        url = args.get("url", "")
        if not isinstance(url, str) or len(url) > 2000:
            raise ValueError("Invalid URL.")
        allowed_urls = spec.get("allowed_urls") or []
        if spec.get("workflow") in {"recruiter", "design-critic", "seo-scout"} and url not in allowed_urls:
            raise ValueError("Only the owner-selected URL may be opened by this agent.")
        return public_page(url)
    if name == "capture_page":
        url = args.get("url", "")
        if url not in spec.get("allowed_urls", []):
            raise ValueError("Only the owner-selected URL may be captured.")
        public_page(url, 1024)  # validate URL and redirect before opening browser
        return _browser_capture(url, base)
    if name == "write_patch":
        filename, content = args.get("name"), args.get("content")
        if filename not in evidence or not isinstance(content, str) or len(content.encode()) > 60_000:
            raise ValueError("Patch must replace one selected copied file (60 KB max).")
        path = _work_file(base, filename)
        if not path.is_file():
            raise ValueError("Copied file is missing.")
        original = path.read_text("utf-8", "replace")
        diff = "".join(difflib.unified_diff(original.splitlines(True), content.splitlines(True),
                                             fromfile="a/" + filename, tofile="b/" + filename))
        if len(diff) > 30_000:
            raise ValueError("Proposed diff is too large.")
        path.write_text(content, encoding="utf-8")
        (base / "proposal.diff").write_text(diff, encoding="utf-8")
        return {"name": filename, "bytes": len(content.encode()), "diff": diff[:14_000],
                "note": "Only the temporary copy changed; no installed app was edited."}
    if name == "run_checks":
        results = []
        for filename in sorted(evidence):
            path = _work_file(base, filename)
            if not path.is_file():
                continue
            if path.suffix == ".py":
                try:
                    ast.parse(path.read_text("utf-8"), filename=filename)
                    results.append({"file": filename, "check": "Python syntax", "status": "passed"})
                except SyntaxError as exc:
                    results.append({"file": filename, "check": "Python syntax", "status": "failed", "detail": str(exc)[:180]})
            elif path.suffix in {".js", ".mjs"}:
                proc = subprocess.run(["node", "--check", str(path)], cwd=base,
                                      env={"PATH": os.environ.get("PATH", "")},
                                      capture_output=True, text=True, timeout=5)
                results.append({"file": filename, "check": "JavaScript syntax", "status": "passed" if proc.returncode == 0 else "failed", "detail": proc.stderr[-180:]})
            elif path.suffix == ".json":
                try:
                    json.loads(path.read_text("utf-8"))
                    results.append({"file": filename, "check": "JSON syntax", "status": "passed"})
                except ValueError as exc:
                    results.append({"file": filename, "check": "JSON syntax", "status": "failed", "detail": str(exc)[:180]})
        return {"checks": results[:40], "dynamic_tests": "Not run: untrusted code has no OS sandbox on this installation."}
    if name == "check_rules":
        value = args.get("text", "")
        if not isinstance(value, str) or len(value) > 8000:
            raise ValueError("Invalid rule text.")
        found = sorted({match.group(0).lower() for match in SENSITIVE.finditer(value)})
        return {"allowed": not found, "blocked_terms": found,
                "note": "Protected traits must not influence a hiring verdict."}
    if name == "self_check":
        summary = args.get("summary", "")
        if not isinstance(summary, str) or not 10 <= len(summary) <= 1000:
            raise ValueError("Self-check needs a concrete 10–1000 character summary.")
        return {"recorded": True, "summary": summary,
                "reminder": "If evidence is weak or a check failed, revise once before the final result."}
    raise ValueError("Tool is unavailable.")


class Server:
    def __init__(self, spec: dict):
        self.spec = spec
        self.allowed = set(spec["tools"])
        self.journal = Path(spec["journal"])
        self.calls = 0
        self.planned = False
        self.checked = False

    def _event(self, name: str, description: str, status: str, seconds: float, detail: str = "") -> None:
        item = {"at": time.time(), "tool": name, "description": description[:100],
                "status": status, "duration_seconds": round(seconds, 3), "detail": detail[:1000]}
        self.journal.parent.mkdir(parents=True, exist_ok=True)
        with self.journal.open("a", encoding="utf-8") as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)
            stream.write(json.dumps(item, ensure_ascii=False) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
            fcntl.flock(stream, fcntl.LOCK_UN)

    def call(self, name: str, args: dict) -> dict:
        start = time.monotonic()
        status, detail = "completed", ""
        try:
            if name not in self.allowed:
                raise ValueError("Tool is outside this agent's allowed set.")
            if time.time() > self.spec["deadline"]:
                raise ValueError("Run time limit reached.")
            if self.calls >= self.spec["max_steps"]:
                raise ValueError("Step limit reached.")
            if name != "record_plan" and not self.planned:
                raise ValueError("Record a plan before using tools.")
            if not isinstance(args, dict):
                raise ValueError("Tool arguments must be an object.")
            self.calls += 1
            self._event(name, TOOLS[name][0], "running", 0)
            result = _run_tool(name, args, self.spec)
            if name == "search_research":
                detail = json.dumps({"urls": [item["url"] for item in result["results"] if item.get("url")]})
            elif name in {"fetch_public_page", "capture_page"}:
                detail = json.dumps({"urls": [result["url"]]})
            elif name == "run_checks":
                detail = json.dumps({"checks": len(result["checks"]),
                                     "failed": sum(item["status"] == "failed" for item in result["checks"])})
            elif name == "write_patch":
                detail = json.dumps({"file": result["name"]})
            if name == "record_plan":
                self.planned = True
            if name == "self_check":
                self.checked = True
            blocks = [{"type": "text", "text": json.dumps(result, ensure_ascii=False)[:MAX_RESULT]}]
            if name == "capture_page":
                for shot in result["screenshots"]:
                    path = _work_file(Path(self.spec["workspace"]), shot["path"])
                    if path.stat().st_size <= 6_000_000:
                        blocks.append({"type": "image", "data": base64.b64encode(path.read_bytes()).decode(),
                                       "mimeType": "image/png"})
            return {"content": blocks}
        except Exception as exc:
            status, detail = "rejected", str(exc)[:200]
            return {"isError": True, "content": [{"type": "text", "text": detail}]}
        finally:
            self._event(name, TOOLS.get(name, ("Blocked tool",))[0], status, time.monotonic() - start, detail)

    def serve(self) -> None:
        for line in sys.stdin:
            try:
                message = json.loads(line)
                method, ident = message.get("method"), message.get("id")
                if ident is None:
                    continue
                if method == "initialize":
                    result = {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
                              "serverInfo": {"name": "marketplace", "version": "1.0.0"}}
                elif method == "tools/list":
                    result = {"tools": definitions(sorted(self.allowed))}
                elif method == "tools/call":
                    params = message.get("params") or {}
                    result = self.call(params.get("name", ""), params.get("arguments") or {})
                elif method == "ping":
                    result = {}
                else:
                    raise ValueError("Unknown MCP method.")
                response = {"jsonrpc": "2.0", "id": ident, "result": result}
            except Exception as exc:
                response = {"jsonrpc": "2.0", "id": message.get("id") if isinstance(message, dict) else None,
                            "error": {"code": -32603, "message": str(exc)[:200]}}
            sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    Server(json.loads(Path(sys.argv[1]).read_text("utf-8"))).serve()
