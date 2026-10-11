#!/usr/bin/env python3
"""Authenticated JSON-v1 service for Agent Marketplace.

The service admits and confirms runs; the platform-supervised job owns the
long-lived provider process. No service child is detached past its request.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import experience
import knowledge
import reflection
import learning
import agent_tools
from runtime import (
    BUILTINS, ID, RUN_ID, RUNNABLE_PROVIDERS, agent, agents, config, lessons_for, locked,
    model_choice, now, public_run, read_json, read_text, record_path, root, run,
    runs, seed_builtins, workflow, write_json, write_text,
)


MAX_BODY = 600_000
MAX_PROMPT = 12_000
MAX_BUG = 8_000
MAX_HTML = 60_000
MAX_REPORTS = 20_000
MAX_SCREENSHOT = 6 * 1024 * 1024
UPLOAD = re.compile(r"^uploads/[0-9a-f]{32}\.(?:png|jpe?g|webp)$")
IMAGE_MAGIC = (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"RIFF")
DAILY = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
REPO = re.compile(r"^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?$")


class ClientError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def api(method: str, path: str, body=None, *, timeout: int = 5):
    base = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")
    token = os.environ.get("APP_TOKEN")
    if not token:
        raise RuntimeError("The app credential is unavailable.")
    payload = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        base + path, data=payload, method=method,
        headers={"Authorization": "Bearer " + token,
                 "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read(2_000_000)
        return json.loads(raw) if raw else None


def _registry_choice(choice: dict) -> dict:
    """Check an agent's provider/model against the platform model registry."""
    if choice.get("provider") not in RUNNABLE_PROVIDERS:
        raise ClientError(400, "Agent runs can use Claude or Codex models.")
    try:
        registry = api("GET", "/api/models", timeout=9)
    except Exception as exc:
        raise ClientError(503, "The model registry is unavailable right now.") from exc
    entries = ((registry or {}).get("providers") or {}).get(choice["provider"]) or []
    entry = next((item for item in entries if item.get("id") == choice.get("model")), None)
    if entry is None or entry.get("available") is False:
        raise ClientError(409, f"{choice.get('model')} is not available in the model registry. Choose another model for this agent.")
    levels = entry.get("effort_levels") or []
    effort = choice.get("effort") if choice.get("effort") in levels else ""
    return {"provider": choice["provider"], "model": entry["id"],
            "label": str(entry.get("label") or entry["id"]), "effort": effort}


def _public_agent(manifest: dict) -> dict:
    agent_id = manifest["id"]
    book = learning.get(agent_id)
    return {
        "manifest": manifest,
        "playbook": read_text(record_path("agents", agent_id, "playbook.md")),
        "config": config(agent_id),
        "lessons": lessons_for(agent_id),
        "model": model_choice(agent_id),
        "workflow": workflow(agent_id),
        "experience": learning.experience_summary(book),
        "run_tools": agent_tools.allowed_tools(workflow(agent_id), manifest["capabilities"]["tools"]),
        "run_limits": _run_limits(manifest),
    }


def _run_limits(manifest: dict) -> dict:
    execution = manifest.get("execution") or {}
    steps = execution.get("max_steps", 12)
    cost = execution.get("max_estimated_cost_usd", 2.0)
    timeout = execution.get("timeout_seconds", 300)
    if (type(steps) is not int or not 3 <= steps <= 24 or
            type(cost) not in (int, float) or not 0.05 <= cost <= 10 or
            type(timeout) is not int or not 1 <= timeout <= 3600):
        raise ValueError("Invalid agent run limits.")
    return {"max_steps": steps, "timeout_seconds": timeout,
            "max_estimated_cost_usd": float(cost)}


def _run_contract(manifest: dict, body: dict, *, tools_enabled: bool = True) -> tuple[list[str], dict]:
    names = (agent_tools.allowed_tools(workflow(manifest["id"]), manifest["capabilities"]["tools"])
             if tools_enabled else [])
    limits = _run_limits(manifest)
    if body.get("confirmed_tools") != names or body.get("confirmed_limits") != limits:
        raise ClientError(409, "Review and confirm the exact tools and run limits before starting.")
    return names, limits


XP_PER_RUN, XP_PER_UPVOTE, XP_PER_LESSON = 100, 50, 25


def level_for(xp: int) -> int:
    """Level n starts at 100·(n−1)² XP: 0, 100, 400, 900, 1600 …"""
    level = 1
    while 100 * level * level <= xp:
        level += 1
    return level


def _seconds(start, end):
    try:
        return max(0.0, (datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds())
    except (TypeError, ValueError):
        return None


def _stats(agent_id: str, all_runs: list[dict], feedback: dict) -> dict:
    """Character stats derived only from this instance's real runs and ratings."""
    mine = [item for item in all_runs if item.get("agent_id") == agent_id]
    completed = [item for item in mine if item.get("status") == "completed"]
    rated = [feedback[item["id"]] for item in mine if item["id"] in feedback]
    ups = sum(1 for item in rated if item.get("rating") == "up")
    downs = sum(1 for item in rated if item.get("rating") == "down")
    lessons = sum(1 for item in rated if str(item.get("note") or "").strip())
    durations = [d for d in (_seconds(item.get("started_at"), item.get("completed_at")) for item in completed) if d is not None]
    costs = [item["cost_usd"] for item in completed
             if isinstance(item.get("cost_usd"), (int, float)) and not isinstance(item.get("cost_usd"), bool)]
    # Recruiter levels are earned only by improved agreement with owner
    # decisions, never by screening volume or a model merely returning text.
    book = learning.get(agent_id)
    xp = (learning.agreement(book)["xp"] if workflow(agent_id) == "recruiter"
          else book.get("inherited_xp", 0) + len(completed) * XP_PER_RUN + ups * XP_PER_UPVOTE + lessons * XP_PER_LESSON)
    level = level_for(xp)
    return {
        "xp": xp, "level": level,
        "level_floor_xp": 100 * (level - 1) ** 2, "next_level_xp": 100 * level ** 2,
        "quests": len(mine), "completed": len(completed),
        "failed": sum(1 for item in mine if item.get("status") == "failed"),
        "upvotes": ups, "downvotes": downs, "lessons": lessons,
        "accuracy": round(ups / (ups + downs), 3) if ups + downs else None,
        "avg_seconds": round(sum(durations) / len(durations), 1) if durations else None,
        "avg_cost_usd": round(sum(costs) / len(costs), 4) if costs else None,
    }


def _state():
    all_runs = runs(limit=None)
    feedback = {}
    for item in all_runs:
        value = read_json(record_path("feedback", item["id"]))
        if isinstance(value, dict):
            feedback[item["id"]] = value
    items = [_public_agent(item) for item in agents()]
    counts = {item["manifest"]["id"]: 0 for item in items}
    for item in all_runs:
        if item.get("started_at") and item.get("agent_id") in counts:
            counts[item["agent_id"]] += 1
    for item in items:
        item["stats"] = _stats(item["manifest"]["id"], all_runs, feedback)
    mentions = []
    folder = root() / "mentions"
    if folder.exists():
        for path in folder.glob("*.json"):
            if path.is_symlink():
                continue
            value = read_json(path)
            if isinstance(value, dict) and value.get("status") == "awaiting_confirmation":
                mentions.append({key: value.get(key) for key in
                                 ("id", "agent_id", "created_at", "target", "status", "kind")})
    # Only privacy-reduced inbox metadata reaches the shared room. CV text and
    # owner decisions stay in app storage and are never part of this state.
    pending_inbox = [{**item, "target": item.get("label")}
                     for item in _inbox_list()["items"]
                     if item.get("kind") == "cv" and item.get("status") == "awaiting_confirmation"]
    return {
        "agents": items,
        # Report bodies are fetched per run (GET /runs/<id>) so state stays small.
        "runs": [{**{key: value for key, value in public_run(item).items() if key != "output"},
                  "output_chars": len(item.get("output") or ""),
                  "feedback": feedback.get(item["id"])}
                 for item in all_runs[:40]],
        "run_counts": counts,
        "pending_mentions": sorted(mentions, key=lambda x: x.get("created_at", ""), reverse=True)[:20],
        "pending_inbox": pending_inbox[:20],
    }


def _validate_manifest(value):
    if not isinstance(value, dict) or len(json.dumps(value)) > 28_000:
        raise ClientError(400, "Agent manifest is missing or too large.")
    agent_id = value.get("id")
    if not isinstance(agent_id, str) or not ID.fullmatch(agent_id):
        raise ClientError(400, "Agent id must be a short lowercase slug.")
    if not isinstance(value.get("name"), str) or not value["name"].strip():
        raise ClientError(400, "Agent name is required.")
    if any(not isinstance(value.get(key), str) or not value[key].strip()
           for key in ("version", "description", "category")):
        raise ClientError(400, "Agent version, description, and category are required.")
    if not isinstance(value.get("author"), dict) or not isinstance(value["author"].get("name"), str):
        raise ClientError(400, "Agent author is required.")
    if not isinstance(value.get("icon"), dict) or not isinstance(value["icon"].get("value"), str):
        raise ClientError(400, "Agent icon is required.")
    persona = value.get("persona")
    if not isinstance(persona, dict) or not isinstance(persona.get("system_prompt"), str):
        raise ClientError(400, "A system prompt is required.")
    if not persona["system_prompt"].strip() or len(persona["system_prompt"]) > MAX_PROMPT:
        raise ClientError(400, "System prompt is empty or too long.")
    steps = persona.get("playbook")
    if not isinstance(steps, list) or not steps or any(
        not isinstance(step, str) or not step.strip() or len(step) > 2_000 for step in steps
    ):
        raise ClientError(400, "Provide at least one concise playbook step.")
    capabilities = value.get("capabilities")
    permissions = capabilities.get("permissions") if isinstance(capabilities, dict) else None
    if not isinstance(permissions, list) or any(
        not isinstance(item, dict) or not isinstance(item.get("scope"), str)
        or not re.fullmatch(r"[a-z][a-z0-9_.-]{0,79}", item["scope"])
        for item in permissions
    ):
        raise ClientError(400, "Permissions must be a list of named scopes.")
    scopes = [item["scope"] for item in permissions]
    if len(scopes) != len(set(scopes)):
        raise ClientError(400, "Permission scopes must be unique.")
    family = (value.get("experience") or {}).get("workflow_id")
    for builtin_id, manifest_file, _ in BUILTINS:
        if family == builtin_id:
            standard = json.loads((Path(__file__).parent / manifest_file).read_text(encoding="utf-8"))
            required = {item["scope"] for item in standard["capabilities"]["permissions"]}
            if not required.issubset(scopes):
                raise ClientError(400, "Transferred specialty must declare its standard permissions.")
            break
    execution = value.get("execution")
    timeout = execution.get("timeout_seconds") if isinstance(execution, dict) else None
    if isinstance(timeout, bool) or not isinstance(timeout, int) or not 30 <= timeout <= 900:
        raise ClientError(400, "Execution timeout must be 30–900 seconds.")
    triggers = value.get("triggers")
    if not isinstance(triggers, dict) or (triggers.get("manual") or {}).get("enabled") is not True:
        raise ClientError(400, "Manual execution must be enabled for installed agents.")
    character = value.get("character")
    if character is not None:
        _validate_character(character, set(scopes))
    return agent_id, "\n".join(f"{index}. {step}" for index, step in enumerate(steps, 1)) + "\n"


HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _validate_character(value, scopes: set[str]) -> None:
    """Presentation only: superpowers must point at a declared scope (or none)."""
    if not isinstance(value, dict) or not isinstance(value.get("class"), str) or not 0 < len(value["class"]) <= 24:
        raise ClientError(400, "Character class is required (up to 24 characters).")
    palette = value.get("palette")
    if not isinstance(palette, dict) or any(
        not isinstance(palette.get(key), str) or not HEX.fullmatch(palette[key])
        for key in ("primary", "secondary", "accent", "skin")
    ) or any(not isinstance(v, str) or not HEX.fullmatch(v) for v in palette.values()):
        raise ClientError(400, "Character palette needs #rrggbb primary, secondary, accent and skin colours.")
    seed = value.get("sprite_seed")
    if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 0xFFFFFFFF:
        raise ClientError(400, "Character sprite seed must be a whole number.")
    powers = value.get("superpowers", [])
    if not isinstance(powers, list) or len(powers) > 6:
        raise ClientError(400, "An agent can show at most six superpowers.")
    for power in powers:
        if (not isinstance(power, dict) or not isinstance(power.get("name"), str) or not power["name"].strip()
                or len(power["name"]) > 40 or not isinstance(power.get("description"), str)
                or not power["description"].strip() or len(power["description"]) > 160
                or not (power.get("scope") is None or power.get("scope") in scopes)):
            raise ClientError(400, "Each superpower needs a name, a description and a declared permission scope (or none).")


def _install(body):
    manifest = body.get("manifest")
    agent_id, playbook = _validate_manifest(manifest)
    with locked():
        if agent(agent_id) is not None:
            raise ClientError(409, "An agent with that id is already installed.")
        write_json(record_path("agents", agent_id, "agent.json"), manifest)
        write_text(record_path("agents", agent_id, "playbook.md"), playbook)
        write_json(record_path("agents", agent_id, "config.json"),
                   {"mention": False, "cron": False, "time": "08:00", "timezone": "UTC"})
    return {"agent": _public_agent(manifest)}


def _occupied(agent_id: str) -> bool:
    return ((root() / "agents" / agent_id).exists() or learning.path(agent_id).exists())


def _copy_id(agent_id: str) -> str:
    for number in range(1, 1000):
        suffix = "-copy" if number == 1 else f"-copy-{number}"
        candidate = agent_id[:48 - len(suffix)].rstrip("-") + suffix
        if not _occupied(candidate):
            return candidate
    raise ClientError(409, "No free copy id is available.")


def _experience_summary(package: dict) -> dict:
    data = package["experience"]
    source = data["provenance"]["chain"][-1]
    return {"name": package["agent"]["name"], "agent_id": package["agent"]["id"],
            "workflow_id": data["workflow_id"], "versions": len(data["versions"]),
            "rules": len(data["versions"][-1]["rules"]) if data["versions"] else 0,
            "xp": data["xp"], "level": data["level"], "curve_groups": len(data["curve"]),
            "author_handle": source["author_handle"], "exported_at": source["exported_at"],
            "decision_count": source["decision_count"], "final_agreement": source["final_agreement"]}


def _package_for(agent_id: str, handle) -> dict:
    manifest = agent(agent_id)
    all_runs = runs(limit=None)
    feedback = {item["id"]: value for item in all_runs
                if isinstance(value := read_json(record_path("feedback", item["id"])), dict)}
    book = learning.get(agent_id)
    if workflow(agent_id) != "recruiter":
        # Read the complete local rating set without changing or exporting it.
        book["decisions"] = _rated_decisions(agent_id)
    return experience.build(manifest, read_text(record_path("agents", agent_id, "playbook.md")),
                            book, _stats(agent_id, all_runs, feedback), handle)


def _experience_export(body: dict) -> dict:
    agent_id = body.get("agent_id")
    manifest = agent(agent_id) if isinstance(agent_id, str) else None
    if manifest is None:
        raise ClientError(404, "Agent not installed.")
    try:
        package = _package_for(agent_id, body.get("author_handle"))
    except (experience.ExperienceError, learning.LearningError) as exc:
        raise ClientError(400, str(exc)) from exc
    return {"package": package, "fingerprint": experience.digest(package),
            "summary": _experience_summary(package)}


def _inspect_experience(body: dict) -> dict:
    package = body.get("package")
    try:
        experience.validate(package)
        _validate_manifest({**package["agent"], "experience": {"workflow_id": package["experience"]["workflow_id"]}})
    except (experience.ExperienceError, learning.LearningError) as exc:
        raise ClientError(400, str(exc)) from exc
    agent_id = package["agent"]["id"]
    conflict = _occupied(agent_id)
    return {"fingerprint": experience.digest(package), "summary": _experience_summary(package),
            "conflict": conflict, "install_id": _copy_id(agent_id) if conflict else agent_id,
            "required_mode": "copy" if conflict else "new"}


def _import_experience(body: dict) -> dict:
    inspected = _inspect_experience(body)
    package = body["package"]
    if (body.get("fingerprint") != inspected["fingerprint"] or body.get("confirm") is not True
            or body.get("mode") != inspected["required_mode"]
            or body.get("install_id") != inspected["install_id"]):
        raise ClientError(409, "The package or the ID state changed. Review the import again; nothing was overwritten.")
    manifest = json.loads(json.dumps(package["agent"], ensure_ascii=False))
    target_id = inspected["install_id"]
    if inspected["conflict"]:
        manifest["id"] = target_id
        manifest["name"] = manifest["name"][:90] + " (copy)"
    manifest["experience"] = {"workflow_id": package["experience"]["workflow_id"]}
    manifest["triggers"]["mention"].update(enabled=False, handle="@" + target_id)
    manifest["triggers"]["cron"]["enabled"] = False
    for event in manifest["triggers"]["events"]:
        event["enabled"] = False
    _validate_manifest(manifest)
    book = experience.imported_book(package, target_id)
    with locked():
        # Repeat the collision check inside the lock; no write can replace an
        # installed agent or its learning record, even after a stale preview.
        if _occupied(target_id) or _occupied(package["agent"]["id"]) != inspected["conflict"]:
            raise ClientError(409, "The agent ID changed. Review the import again; nothing was overwritten.")
        agents_root = root() / "agents"
        agents_root.mkdir(parents=True, exist_ok=True)
        if agents_root.is_symlink():
            raise ClientError(409, "Agent storage is a symlink.")
        staged = Path(tempfile.mkdtemp(prefix=".experience-", dir=agents_root))
        learning_file = learning.path(target_id)
        try:
            write_json(staged / "agent.json", manifest)
            write_text(staged / "playbook.md", package["playbook"])
            write_json(staged / "config.json", {"mention": False, "cron": False,
                                                  "time": "08:00", "timezone": "UTC"})
            write_json(learning_file, book)
            os.rename(staged, agents_root / target_id)
        except Exception:
            learning_file.unlink(missing_ok=True)
            raise
        finally:
            if staged.exists():
                shutil.rmtree(staged)
    return {"agent": _public_agent(manifest), "install_id": target_id,
            "copied": inspected["conflict"]}


def _installed_target(body: dict) -> dict:
    target = body.get("app_id")
    if isinstance(target, bool) or not isinstance(target, int) or target < 1:
        raise ClientError(400, "Choose an installed app.")
    try:
        installed = api("GET", "/api/apps/")
    except Exception as exc:
        raise ClientError(503, "Installed app list is unavailable.") from exc
    chosen = next((item for item in installed if item.get("id") == target), None)
    if chosen is None:
        raise ClientError(404, "Installed app was not found.")
    return {"source_kind": "installed", "app_id": target,
            "label": f"Installed app: {chosen['name']}"}


def _screenshots(value) -> list[dict]:
    """Uploaded screenshots live in this app's own storage; only their paths travel."""
    if value in (None, []):
        return []
    if not isinstance(value, list) or len(value) > 2:
        raise ClientError(400, "Attach at most a desktop and a phone screenshot.")
    result, labels = [], set()
    for item in value:
        label = item.get("label") if isinstance(item, dict) else None
        path = item.get("path") if isinstance(item, dict) else None
        if label not in {"desktop", "phone"} or label in labels or not isinstance(path, str) or not UPLOAD.fullmatch(path):
            raise ClientError(400, "Screenshots must be one desktop and/or one phone image.")
        file = root() / path
        if file.parent.is_symlink() or file.is_symlink() or not file.is_file():
            raise ClientError(409, f"The {label} screenshot has not finished uploading. Try again in a moment.")
        if file.stat().st_size > MAX_SCREENSHOT:
            raise ClientError(400, f"The {label} screenshot is larger than 6 MB.")
        with file.open("rb") as handle:
            head = handle.read(12)
        if not (head.startswith(IMAGE_MAGIC[0]) or head.startswith(IMAGE_MAGIC[1])
                or (head.startswith(IMAGE_MAGIC[2]) and head[8:12] == b"WEBP")):
            raise ClientError(400, f"The {label} screenshot must be PNG, JPEG, or WebP.")
        labels.add(label)
        result.append({"label": label, "path": path})
    return result


def _target(body: dict, agent_id: str):
    installed_id = agent_id
    agent_id = workflow(agent_id)
    if agent_id == "recruiter":
        raise ClientError(400, "Use the Recruiter desk for intake and CV screening.")
    if agent_id == "sentinel":
        kind = body.get("source_kind")
        bug = body.get("bug_report", "")
        if not isinstance(bug, str) or len(bug) > MAX_BUG:
            raise ClientError(400, "Bug report is too long.")
        if kind == "installed":
            return {**_installed_target(body), "bug_report": bug}
        if kind == "store_repo":
            url = str(body.get("repo_url") or "").strip()
            if not REPO.fullmatch(url):
                raise ClientError(400, "Enter a public GitHub App Store repository URL.")
            return {"source_kind": kind, "repo_url": url,
                    "label": f"Public repository: {url}", "bug_report": bug}
        if kind == "code":
            code = body.get("code", "")
            if not isinstance(code, str) or not code.strip() or len(code) > MAX_PROMPT:
                raise ClientError(400, "Paste code to review.")
            return {"source_kind": kind, "code": code,
                    "label": "Pasted code", "bug_report": bug}
        raise ClientError(400, "Choose installed app, Store repository, or pasted code.")
    if agent_id == "design-critic":
        kind = body.get("source_kind")
        focus = body.get("focus", "")
        if not isinstance(focus, str) or len(focus) > 1000:
            raise ClientError(400, "Keep the focus note under 1,000 characters.")
        shots = _screenshots(body.get("screenshots"))
        extra = {"focus": focus.strip(), "screenshots": shots}
        if kind == "installed":
            return {**_installed_target(body), **extra}
        if kind == "url":
            url = str(body.get("url") or "").strip()
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme != "https" or not parsed.hostname or len(url) > 2000:
                raise ClientError(400, "Enter a public https:// page URL.")
            return {"source_kind": kind, "url": url, "label": f"Web page: {url}", **extra}
        if kind == "html":
            code = body.get("code", "")
            if not isinstance(code, str) or not code.strip() or len(code) > MAX_HTML:
                raise ClientError(400, "Paste HTML/CSS to review (up to 60,000 characters).")
            return {"source_kind": kind, "code": code, "label": "Pasted HTML/CSS", **extra}
        raise ClientError(400, "Choose an installed app, a URL, or pasted HTML/CSS.")
    if agent_id == "bug-triage":
        kind = body.get("source_kind", "text")
        reports = body.get("reports")
        if kind not in {"text", "social"}:
            raise ClientError(400, "Paste bug reports or a copied Social thread.")
        if not isinstance(reports, str) or not reports.strip() or len(reports) > MAX_REPORTS:
            raise ClientError(400, "Paste the bug reports or thread (up to 20,000 characters).")
        target = {"source_kind": kind, "reports": reports,
                  "label": ("Social thread" if kind == "social" else "Bug reports") + f" · {len(reports):,} characters"}
        if body.get("app_id") not in (None, ""):
            app = _installed_target(body)
            target.update(app_id=app["app_id"], label=target["label"] + " · " + app["label"].removeprefix("Installed app: "))
        return target
    if agent_id == "launch-writer":
        kind = body.get("source_kind")
        voice = body.get("voice", config(installed_id).get("voice", ""))
        if not isinstance(voice, str) or len(voice) > 1500:
            raise ClientError(400, "Keep voice notes under 1,500 characters.")
        if kind == "installed":
            return {**_installed_target(body), "voice": voice.strip()}
        if kind == "description":
            text = body.get("description")
            if not isinstance(text, str) or not text.strip() or len(text) > 3000:
                raise ClientError(400, "Describe the product (up to 3,000 characters).")
            return {"source_kind": kind, "description": text.strip(), "voice": voice.strip(),
                    "label": "Product: " + text.strip().split("\n")[0][:80]}
        raise ClientError(400, "Choose an installed app or write a short description.")
    if agent_id == "seo-scout":
        kind = body.get("source_kind")
        if kind == "url":
            url = str(body.get("url") or "").strip()
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme != "https" or not parsed.hostname or len(url) > 2000:
                raise ClientError(400, "Enter a public https:// page URL.")
            return {"source_kind": kind, "url": url, "label": f"Web page: {url}"}
        if kind == "html":
            code = body.get("code", "")
            if not isinstance(code, str) or not code.strip() or len(code) > MAX_HTML:
                raise ClientError(400, "Paste HTML to audit (up to 60,000 characters).")
            return {"source_kind": kind, "code": code, "label": "Pasted HTML"}
        raise ClientError(400, "Choose a public URL or pasted HTML.")
    if agent_id == "brief-builder":
        message = body.get("message")
        if not isinstance(message, str) or not message.strip() or len(message) > MAX_PROMPT:
            raise ClientError(400, "Paste the client message (up to 12,000 characters).")
        first = message.strip().split("\n")[0][:70]
        return {"source_kind": "message", "message": message, "label": f"Client message: {first}"}
    field = "topic" if agent_id == "researcher" else "task"
    text = body.get(field)
    if not isinstance(text, str) or not text.strip() or len(text) > 1000:
        raise ClientError(400, f"Enter a {field} (up to 1,000 characters).")
    return {field: text.strip(), "label": text.strip()}


def _job_locked() -> bool:
    """A finalizing supervised job is still busy even after its run file settles."""
    import fcntl
    path = Path(os.environ.get("DATA_DIR", "/data")) / "run" / "app-job-locks" / f"{os.environ['APP_ID']}.lock"
    if not path.exists():
        return False
    with path.open("rb") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return True
        fcntl.flock(handle, fcntl.LOCK_UN)
    return False


STALE_PENDING_SECONDS = 180


def _recover_stale() -> None:
    """Settle a run whose supervised job is gone, so one crash cannot block later runs.

    The platform holds the app-job lock for the job's whole life, so an
    ``active.json`` without that lock means the job died (for example in a
    restart). A ``pending.json`` is only abandoned once it is old enough that
    the launched job would already have claimed it.
    """
    if _job_locked():
        return
    with locked():
        if _job_locked():
            return
        markers = (
            ("active.json", 0, "The run stopped unexpectedly (for example during a Möbius restart). Nothing further is running."),
            ("pending.json", STALE_PENDING_SECONDS, "The supervised job never picked up this run, so no provider call was made."),
        )
        for name, min_age, reason in markers:
            path = root() / name
            value = read_json(path)
            if value is None:
                continue
            if min_age and time.time() - path.stat().st_mtime < min_age:
                continue
            run_id = value.get("id") if isinstance(value, dict) else None
            row = run(run_id) if isinstance(run_id, str) and RUN_ID.fullmatch(run_id) else None
            if row is not None and row.get("status") in {"queued", "running"}:
                row.update(status="failed", error=reason, status_detail="Run failed",
                           completed_at=now())
                write_json(record_path("runs", run_id), row)
            path.unlink(missing_ok=True)


def _run(body):
    agent_id = body.get("agent_id")
    manifest = agent(agent_id) if isinstance(agent_id, str) else None
    if manifest is None:
        raise ClientError(404, "Install this agent first.")
    scopes = [item["scope"] for item in manifest["capabilities"]["permissions"]]
    if body.get("confirm_cost") is not True or body.get("confirmed_permissions") != scopes:
        raise ClientError(409, "Confirm provider cost and the exact permission list before running.")
    names, limits = _run_contract(manifest, body)
    choice = _registry_choice(model_choice(agent_id))
    mention_id = body.get("mention_id")
    mention = None
    if mention_id is not None:
        if not isinstance(mention_id, str) or not RUN_ID.fullmatch(mention_id):
            raise ClientError(400, "Invalid mention request.")
        mention = read_json(record_path("mentions", mention_id))
        if not isinstance(mention, dict) or mention.get("status") != "awaiting_confirmation" or mention.get("agent_id") != agent_id:
            raise ClientError(409, "This mention request is no longer awaiting confirmation.")
    target = _target(mention["request"] if mention else body, agent_id)
    if workflow(agent_id) == "launch-writer" and not mention and isinstance(body.get("voice"), str):
        with locked():  # Echo Voice: this agent remembers the owner's voice notes.
            value = config(agent_id)
            value["voice"] = target["voice"]
            write_json(record_path("agents", agent_id, "config.json"), value)
    run_id = uuid.uuid4().hex
    lessons = lessons_for(agent_id)
    row = {
        "id": run_id, "agent_id": agent_id, "created_at": now(),
        "status": "queued", "target": target["label"],
        "provider": choice["provider"], "model": choice["model"],
        "model_label": choice["label"], "effort": choice["effort"],
        "permissions": scopes, "trigger": mention.get("kind", "mention") if mention else "manual",
        "inbox_id": mention.get("inbox_id") if mention else None,
        "lessons_used": lessons, "output": "", "score": None,
        "usage": None, "cost_usd": None, "error": None,
        "tools": names, "limits": limits, "timeline": [], "tool_calls": 0, "steps_used": 0,
    }
    with locked():
        if _job_locked() or (root() / "active.json").exists() or (root() / "pending.json").exists():
            raise ClientError(409, "Another agent run is still active. Wait for it to finish.")
        if mention_id and read_json(record_path("mentions", mention_id), {}).get("status") != "awaiting_confirmation":
            raise ClientError(409, "This mention request was already handled.")
        write_json(record_path("runs", run_id), row)
        write_json(root() / "pending.json", {"id": run_id, "target": target})
        if mention_id:
            mention["status"] = "starting"
            mention["run_id"] = run_id
            write_json(record_path("mentions", mention_id), mention)
            if mention.get("inbox_id"):
                item = read_json(record_path("inbox", mention["inbox_id"]))
                if isinstance(item, dict):
                    item.update(status="screening", run_id=run_id)
                    write_json(record_path("inbox", mention["inbox_id"]), item)
    try:
        api("POST", f"/api/apps/{os.environ['APP_ID']}/run-job", {})
    except Exception as exc:
        with locked():
            row["status"] = "failed"
            row["error"] = "The supervised app job did not start."
            row["completed_at"] = now()
            write_json(record_path("runs", run_id), row)
            (root() / "pending.json").unlink(missing_ok=True)
            if mention_id:
                mention["status"] = "awaiting_confirmation"
                mention.pop("run_id", None)
                write_json(record_path("mentions", mention_id), mention)
                if mention.get("inbox_id"):
                    item = read_json(record_path("inbox", mention["inbox_id"]))
                    if isinstance(item, dict):
                        item["status"] = "saved"
                        item.pop("run_id", None)
                        write_json(record_path("inbox", mention["inbox_id"]), item)
        raise ClientError(503, "The supervised app job did not start.") from exc
    if mention_id:
        with locked():
            mention["status"] = "started"
            write_json(record_path("mentions", mention_id), mention)
    return {"run": public_run(row)}


def _stop_run(body: dict) -> dict:
    run_id = body.get("run_id")
    if not isinstance(run_id, str) or not RUN_ID.fullmatch(run_id):
        raise ClientError(400, "Invalid run id.")
    with locked():
        row = run(run_id)
        if row is None:
            raise ClientError(404, "Run not found.")
        if row.get("status") not in {"queued", "running"}:
            return {"run": public_run(row)}
        pending = read_json(root() / "pending.json")
        if isinstance(pending, dict) and pending.get("id") == run_id:
            (root() / "pending.json").unlink(missing_ok=True)
            inbox_id = row.get("inbox_id") or (pending.get("target", {}).get("inbox_id") if isinstance(pending.get("target"), dict) else None)
            if isinstance(inbox_id, str) and RUN_ID.fullmatch(inbox_id):
                item = read_json(record_path("inbox", inbox_id))
                if isinstance(item, dict):
                    item["status"] = "saved"
                    item.pop("run_id", None)
                    write_json(record_path("inbox", inbox_id), item)
            row.update(status="stopped", error="Stopped by owner before the provider started.",
                       status_detail="Stopped", completed_at=now())
            write_json(record_path("runs", run_id), row)
        else:
            marker = root() / "stop" / (run_id + ".json")
            write_json(marker, {"requested_at": now()})
            row["status_detail"] = "Stopping now"
            write_json(record_path("runs", run_id), row)
    return {"run": public_run(row)}


def _mention(body):
    arguments = body.get("arguments")
    call = body.get("call")
    if not isinstance(call, dict) or not isinstance(call.get("chat_id"), str) or not call["chat_id"]:
        raise ClientError(403, "Mention requests are only accepted from an agent chat.")
    if not isinstance(arguments, dict):
        raise ClientError(400, "Mention arguments are missing.")
    agent_id = arguments.get("agent_id")
    if not isinstance(agent_id, str) or agent(agent_id) is None or not config(agent_id).get("mention"):
        raise ClientError(409, "This agent's @mention requests are not enabled.")
    target = _target(arguments, agent_id)
    mention_id = uuid.uuid4().hex
    entry = {"id": mention_id, "agent_id": agent_id, "created_at": now(),
             "status": "awaiting_confirmation", "target": target["label"],
             "request": arguments, "chat_id": call["chat_id"]}
    with locked():
        write_json(record_path("mentions", mention_id), entry)
    return {"status": "awaiting_confirmation", "message":
            "Request saved, but no provider run started. The owner must review cost and permissions in Agent Marketplace → Activity.",
            "open": f"/shell/?app={os.environ['APP_ID']}"}


def _inbox_list() -> dict:
    folder = root() / "inbox"
    items = []
    if folder.is_dir() and not folder.is_symlink():
        for path in folder.glob("*.json"):
            if not RUN_ID.fullmatch(path.stem) or path.is_symlink():
                continue
            entry = read_json(path)
            if isinstance(entry, dict):
                items.append({key: entry.get(key) for key in
                              ("id", "agent_id", "kind", "created_at", "status", "label")})
    return {"items": sorted(items, key=lambda item: item.get("created_at") or "", reverse=True)[:40]}


def _inbox_add(body: dict, kind: str) -> dict:
    agent_id = body.get("agent_id")
    expected = "recruiter" if kind == "cv" else "sentinel"
    if not isinstance(agent_id, str) or agent(agent_id) is None or workflow(agent_id) != expected:
        raise ClientError(400, "Choose the matching agent for this inbox.")
    if kind == "cv":
        content = body.get("text")
        if not isinstance(content, str) or not 1 <= len(content.strip()) <= 48_000:
            raise ClientError(400, "Paste 1–8 CVs, up to 48,000 characters.")
        label = "CV inbox · " + str(len([part for part in re.split(r"(?m)^\s*---\s*CV\s*---\s*$", content) if part.strip()])) + " CV(s)"
    else:
        content = body.get("bug_report")
        if not isinstance(content, str) or not 1 <= len(content.strip()) <= MAX_BUG:
            raise ClientError(400, "Paste a bug report up to 8,000 characters.")
        # The source selection is checked now, before an unpaid request exists.
        _target(body, agent_id)
        label = "Bug inbox · " + content.strip().splitlines()[0][:80]
    enabled = bool(config(agent_id).get("cv_inbox" if kind == "cv" else "bug_inbox"))
    entry_id = uuid.uuid4().hex
    entry = {"id": entry_id, "agent_id": agent_id, "kind": kind, "created_at": now(),
             "status": "awaiting_confirmation" if enabled else "saved",
             "label": label, "text": content}
    with locked():
        write_json(record_path("inbox", entry_id), entry)
        if enabled and kind == "bug":
            request_id = uuid.uuid4().hex
            write_json(record_path("mentions", request_id), {
                "id": request_id, "agent_id": agent_id, "created_at": now(),
                "status": "awaiting_confirmation", "target": label,
                "request": {key: value for key, value in body.items() if key != "agent_id"},
                "kind": "bug_inbox", "inbox_id": entry_id})
    return {"item": {key: entry[key] for key in ("id", "agent_id", "kind", "created_at", "status", "label")}}


def _feedback(body):
    run_id = body.get("run_id")
    row = run(run_id) if isinstance(run_id, str) else None
    if row is None or row.get("status") != "completed":
        raise ClientError(404, "Completed run not found.")
    rating = body.get("rating")
    note = body.get("note", "")
    if rating not in {"up", "down"} or not isinstance(note, str) or len(note) > 500:
        raise ClientError(400, "Choose helpful or not helpful and an optional short note.")
    entry = {"run_id": run_id, "agent_id": row["agent_id"], "rating": rating,
             "note": note.strip(), "saved_at": now()}
    with locked():
        write_json(record_path("feedback", run_id), entry)
    if workflow(row["agent_id"]) != "recruiter":
        _sync_rated_decisions(row["agent_id"])
    return {"feedback": entry, "next_run_lessons": lessons_for(row["agent_id"])}


def _rated_decisions(agent_id: str) -> list[dict]:
    """Every recorded rating, not just the eight-note prompt window."""
    decisions = []
    for item in runs(limit=None):
        if item.get("agent_id") != agent_id or item.get("status") != "completed":
            continue
        feedback = read_json(record_path("feedback", item["id"]))
        if isinstance(feedback, dict) and feedback.get("rating") in {"up", "down"}:
            decisions.append({"id": item["id"], "choice": "up",
                              "agent_verdict": feedback["rating"],
                              "source_rating": feedback["rating"],
                              "reason": feedback.get("note", ""),
                              "target": item.get("target", ""),
                              "saved_at": feedback.get("saved_at", ""),
                              "excerpt": (item.get("output") or "")[:4000]})
    return decisions


def _sync_rated_decisions(agent_id: str) -> dict:
    with locked():
        book = learning.get(agent_id)
        old = learning.signature(book)
        decisions = _rated_decisions(agent_id)
        book["decisions"] = decisions
        if learning.signature(book) != old:
            book["proposal"] = None
        learning.save(book)
        return book


# A dated API-equivalent planning reference, never a promise about subscription
# charges. Unknown registry models still show an input/output token estimate.
REFERENCE_RATES = {
    ("claude", "claude-opus-5-5"): (4.0, 20.0),
    ("codex", "gpt-6-sol"): (2.0, 10.0),
    ("codex", "gpt-6-astra"): (10.0, 50.0),
    ("codex", "gpt-6-luna"): (0.1, 0.5),
}


def _learning_target(body: dict, *, estimate_only: bool = False) -> tuple[str, dict]:
    agent_id = body.get("agent_id")
    if not isinstance(agent_id, str) or agent(agent_id) is None:
        raise ClientError(404, "Agent not installed.")
    action = body.get("action")
    book = learning.get(agent_id)
    if action == "screen" and workflow(agent_id) == "recruiter":
        source = body.get("source") or {}
        if not isinstance(source, dict):
            raise ClientError(400, "Choose a CV source.")
        inbox_id = None
        if source.get("kind") == "inbox":
            inbox_id = source.get("id")
            entry = read_json(record_path("inbox", inbox_id)) if isinstance(inbox_id, str) and RUN_ID.fullmatch(inbox_id) else None
            if not isinstance(entry, dict) or entry.get("kind") != "cv" or entry.get("agent_id") != agent_id or entry.get("status") == "screened":
                raise ClientError(404, "CV inbox item is unavailable.")
            source = {"kind": "pasted", "text": entry["text"]}
        try:
            label, people = learning.candidates(source, book)
        except learning.LearningError as exc:
            raise ClientError(400, str(exc)) from exc
        return "recruiter_screen", {"label": label, "source_group": source.get("group"),
                                    "inbox_id": inbox_id,
                                    "candidates": people, "rules": learning.current(book)["rules"],
                                    "rulebook_version": len(book["versions"]), "role": book["intake"]["role"]}
    if action == "replay" and workflow(agent_id) == "recruiter":
        if not book["decisions"]:
            raise ClientError(409, "Review the candidates and record decisions first.")
        for group in book["rounds"]:
            ids = {item["id"] for item in group["candidates"]}
            if not ids.issubset({item["candidate_id"] for item in book["decisions"]}):
                raise ClientError(409, "Finish the decisions for the whole group before proposing rules.")
        if learning.replay_size(book) > learning.MAX_REPLAY_CHARS:
            raise ClientError(413, "All earlier decisions do not fit in one replay call. Save your work and shorten the entered CVs; nothing will be accepted without a complete replay.")
        mode = body.get("mode", "propose")
        target = {"mode": mode, "base_version": len(book["versions"]),
                  "decision_signature": learning.signature(book),
                  "decisions": book["decisions"], "rounds": book["rounds"],
                  "rules": learning.current(book)["rules"], "role": book["intake"]["role"],
                  "inherited_rule_gaps": learning.inherited_gaps(book)}
        if mode == "edit":
            try:
                target["draft_rules"] = learning.validate_rules(body.get("rules"), hiring=True)
            except (learning.LearningError, TypeError) as exc:
                raise ClientError(400, str(exc)) from exc
        elif mode == "restore":
            version = body.get("version")
            prior = next((item for item in book["versions"] if item["version"] == version), None)
            if not prior:
                raise ClientError(404, "Rulebook version not found.")
            target["draft_rules"] = prior["rules"]
            target["restored_from"] = version
        elif mode != "propose":
            raise ClientError(400, "Unknown replay mode.")
        return "recruiter_replay", target
    if action == "reply" and workflow(agent_id) != "recruiter":
        reply = body.get("reply")
        source_run = body.get("run_id")
        row = run(source_run) if isinstance(source_run, str) and RUN_ID.fullmatch(source_run) else None
        if row is None or row.get("agent_id") != agent_id or row.get("status") != "completed":
            raise ClientError(404, "Completed agent result not found.")
        if not isinstance(reply, str) or not 3 <= len(reply.strip()) <= 600:
            raise ClientError(400, "Write a reply of 3–600 characters.")
        if estimate_only:
            book["decisions"] = _rated_decisions(agent_id)
        else:
            book = _sync_rated_decisions(agent_id)
        target = {"reply": reply.strip(), "source_run": source_run,
                  "source_output": (row.get("output") or "")[:5000],
                  "base_version": len(book["versions"]),
                  "decision_signature": learning.signature(book),
                  "decisions": book["decisions"],
                  "rules": (learning.current(book) or {}).get("rules", [])}
        if len(json.dumps(target, ensure_ascii=False)) > learning.MAX_REPLAY_CHARS:
            raise ClientError(413, "All earlier ratings do not fit in one replay call. No lesson will be accepted without a complete replay.")
        return "lesson_replay", target
    raise ClientError(400, "Unknown learning action.")


def _learning_estimate(body: dict) -> dict:
    kind, target = _learning_target(body, estimate_only=True)
    choice = _registry_choice(model_choice(body["agent_id"]))
    size = len(json.dumps(target, ensure_ascii=False)) + 4500
    input_tokens = (size + 2) // 3  # deliberately conservative character proxy
    output_tokens = 3500 if kind == "recruiter_screen" else max(4000, len(target.get("decisions", [])) * 90)
    rates = REFERENCE_RATES.get((choice["provider"], choice["model"]))
    estimate_usd = round((input_tokens * rates[0] + output_tokens * rates[1]) / 1_000_000, 3) if rates else None
    manifest = agent(body["agent_id"])
    names = (agent_tools.allowed_tools(workflow(body["agent_id"]), manifest["capabilities"]["tools"])
             if kind == "recruiter_screen" else [])
    return {"kind": kind, "model": choice, "input_tokens": input_tokens,
            "output_tokens": output_tokens, "estimate_usd": estimate_usd,
            "tools": names, "limits": _run_limits(manifest),
            "basis": "Reference API price as of 9 Oct 2026; a subscription may be billed differently. This is not a billing limit."}


def _learning_run(body: dict) -> dict:
    agent_id = body.get("agent_id")
    manifest = agent(agent_id) if isinstance(agent_id, str) else None
    if manifest is None:
        raise ClientError(404, "Agent not installed.")
    scopes = [item["scope"] for item in manifest["capabilities"]["permissions"]]
    if body.get("confirm_cost") is not True or body.get("confirmed_permissions") != scopes:
        raise ClientError(409, "Confirm estimated provider cost and exact permissions before running.")
    kind, target = _learning_target(body)
    names, limits = _run_contract(manifest, body, tools_enabled=kind == "recruiter_screen")
    choice = _registry_choice(model_choice(agent_id))
    run_id = uuid.uuid4().hex
    row = {"id": run_id, "agent_id": agent_id, "kind": kind, "created_at": now(),
           "status": "queued", "target": target.get("label") or ("Replay of all decisions" if kind == "recruiter_replay" else "Reply to agent"),
           "provider": choice["provider"], "model": choice["model"], "model_label": choice["label"],
           "effort": choice["effort"], "permissions": scopes, "trigger": "manual",
           "lessons_used": lessons_for(agent_id), "output": "", "score": None,
           "usage": None, "cost_usd": None, "error": None,
           "tools": names, "limits": limits, "timeline": [], "tool_calls": 0, "steps_used": 0}
    with locked():
        if _job_locked() or (root() / "active.json").exists() or (root() / "pending.json").exists():
            raise ClientError(409, "Another agent run is still active. Wait for it to finish.")
        live_book = learning.get(agent_id)
        if kind != "recruiter_screen" and (len(live_book["versions"]) != target["base_version"] or
                                            learning.signature(live_book) != target["decision_signature"]):
            raise ClientError(409, "Decisions changed. Review and confirm the new replay estimate.")
        write_json(record_path("runs", run_id), row)
        write_json(root() / "pending.json", {"id": run_id, "target": target})
        if target.get("inbox_id"):
            entry = read_json(record_path("inbox", target["inbox_id"]))
            entry["status"] = "screening"
            entry["run_id"] = run_id
            write_json(record_path("inbox", target["inbox_id"]), entry)
    try:
        api("POST", f"/api/apps/{os.environ['APP_ID']}/run-job", {})
    except Exception as exc:
        with locked():
            row.update(status="failed", error="The supervised app job did not start.", completed_at=now())
            write_json(record_path("runs", run_id), row)
            (root() / "pending.json").unlink(missing_ok=True)
            if target.get("inbox_id"):
                entry = read_json(record_path("inbox", target["inbox_id"]))
                if isinstance(entry, dict):
                    entry["status"] = "saved"
                    entry.pop("run_id", None)
                    write_json(record_path("inbox", target["inbox_id"]), entry)
        raise ClientError(503, "The supervised app job did not start.") from exc
    return {"run": public_run(row)}


def _learning_decision(body: dict) -> dict:
    agent_id = body.get("agent_id", "recruiter")
    if not isinstance(agent_id, str) or agent(agent_id) is None or workflow(agent_id) != "recruiter":
        raise ClientError(404, "Recruiter not installed.")
    try:
        value = learning.decide(agent_id, body.get("round_id"), body.get("candidate_id"),
                                body.get("choice"), body.get("reason", ""))
    except (learning.LearningError, TypeError) as exc:
        raise ClientError(400, str(exc)) from exc
    return {"decision": value, "learning": learning.public(learning.get(agent_id))}


def _learning_accept(body: dict) -> dict:
    agent_id = body.get("agent_id")
    if not isinstance(agent_id, str) or agent(agent_id) is None:
        raise ClientError(404, "Agent not installed.")
    proposal = learning.get(agent_id).get("proposal") or {}
    try:
        value = learning.accept(agent_id, body.get("proposal_id"),
                                confirm_inherited_removal=body.get("confirm_inherited_removal") is True)
    except learning.LearningError as exc:
        raise ClientError(409, str(exc)) from exc
    learned = _confirmed_learned(agent_id, proposal)
    sync = sync_knowledge(agent_id, learned)
    return {"learning": value, "learned": learned,
            "sync": {key: sync.get(key) for key in ("status", "commit", "url", "repo", "message", "error", "at")}}


def _confirmed_learned(agent_id: str, proposal: dict) -> dict:
    """The 'What I learned' record for a proposal the owner just confirmed."""
    book = learning.get(agent_id)
    kinds = {"add": "added", "edit": "changed", "remove": "removed"}
    names = [item.get("name") or "" for group in book["rounds"] for item in group["candidates"]]
    reason = proposal.get("reason") or "Confirmed by you"
    bullets = [{"kind": kinds.get(item.get("action"), "changed"), "rule_id": item.get("rule_id"),
                "text": item.get("text") or item.get("rule_id") or "",
                "reason": item.get("reason") or reason} for item in (proposal.get("changes") or [])[:5]]
    if not bullets:
        bullets = [{"kind": "changed", "text": "Rulebook updated to version " + str(len(book["versions"])),
                    "reason": reason}]
    learned = reflection.build_learned(
        "confirm-" + (proposal.get("id") or "")[:8], status="learned",
        headline="Rule change confirmed by you", bullets=bullets,
        version_before=len(book["versions"]) - 1, version_after=len(book["versions"]),
        replay=proposal.get("replay"), names=names)
    learning.record_reflection(agent_id, learned)
    return learned


def _learning_decline(body: dict) -> dict:
    agent_id = body.get("agent_id")
    if not isinstance(agent_id, str) or agent(agent_id) is None:
        raise ClientError(404, "Agent not installed.")
    try:
        return {"learning": learning.decline(agent_id, body.get("proposal_id"))}
    except learning.LearningError as exc:
        raise ClientError(409, str(exc)) from exc


def _model(body):
    agent_id = body.get("agent_id")
    if not isinstance(agent_id, str) or agent(agent_id) is None:
        raise ClientError(404, "Agent not installed.")
    effort = body.get("effort", "")
    if not isinstance(body.get("model"), str) or not isinstance(effort, str):
        raise ClientError(400, "Choose a model.")
    choice = _registry_choice({"provider": body.get("provider"),
                               "model": body["model"], "effort": effort})
    remembered = {key: choice[key] for key in ("provider", "model", "effort")}
    with locked():
        value = config(agent_id)
        value["model"] = remembered
        write_json(record_path("agents", agent_id, "config.json"), value)
    return {"model": remembered}


def _config(body):
    agent_id = body.get("agent_id")
    if not isinstance(agent_id, str) or agent(agent_id) is None:
        raise ClientError(404, "Agent not installed.")
    value = config(agent_id)
    mention = body.get("mention", value.get("mention", False))
    cron = body.get("cron", value.get("cron", False))
    bug_inbox = body.get("bug_inbox", value.get("bug_inbox", False))
    cv_inbox = body.get("cv_inbox", value.get("cv_inbox", False))
    time = body.get("time", value.get("time", "08:00"))
    zone = body.get("timezone", value.get("timezone", "UTC"))
    if any(not isinstance(flag, bool) for flag in (mention, cron, bug_inbox, cv_inbox)):
        raise ClientError(400, "Trigger flags must be true or false.")
    if (bug_inbox and workflow(agent_id) != "sentinel") or (cv_inbox and workflow(agent_id) != "recruiter"):
        raise ClientError(400, "This inbox trigger does not belong to this agent.")
    if workflow(agent_id) == "recruiter" and (mention or cron):
        raise ClientError(400, "Recruiter screening needs an explicit owner-confirmed group; automatic triggers are unavailable.")
    if not isinstance(time, str) or not DAILY.fullmatch(time):
        raise ClientError(400, "Choose a valid daily time.")
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, TypeError, ValueError):
        raise ClientError(400, "Choose a valid IANA time zone.")
    if (mention and not value.get("mention")) or (cron and not value.get("cron")):
        if body.get("confirm_automatic_cost") is not True:
            raise ClientError(409, "Confirm the trigger request settings. A provider run still needs its own approval.")
    scheduled_request = value.get("scheduled_request")
    if cron:
        proposed = body.get("scheduled_request")
        if isinstance(proposed, dict):
            scheduled_request = _target(proposed, agent_id)
        if not isinstance(scheduled_request, dict):
            raise ClientError(400, "Choose a task or source for scheduled runs first.")
        if agent_id == "sentinel" and scheduled_request.get("source_kind") == "code":
            raise ClientError(400, "Scheduled reviews need an installed app or public repository, not pasted code.")
    if cron and not value.get("cron"):
        try:
            api("POST", f"/api/apps/{os.environ['APP_ID']}/schedule",
                {"cron": "* * * * *", "job": "job.sh"})
        except Exception as exc:
            raise ClientError(503, "Could not arm the app schedule.") from exc
    updated = {**value, "mention": mention, "cron": cron,
               "bug_inbox": bug_inbox, "cv_inbox": cv_inbox, "time": time,
               "timezone": zone, "scheduled_request": scheduled_request}
    with locked():
        write_json(record_path("agents", agent_id, "config.json"), updated)
    return {"config": updated}


# --- Private GitHub knowledge sync -------------------------------------------

def _candidate_names(book: dict) -> list[str]:
    return [item.get("name") for group in book.get("rounds", []) for item in group.get("candidates", [])
            if isinstance(item.get("name"), str)]


def _bullet_line(item: dict, names: list[str]) -> str:
    verb = {"added": "Added rule", "changed": "Changed rule", "removed": "Removed rule",
            "noted": "Noted (not active yet)", "kept_out": "Considered, not kept"}.get(item.get("kind"), "Note")
    text = knowledge.redact(item.get("text", ""), names)
    reason = knowledge.redact(item.get("reason", ""), names)
    return f"{verb}: {text}" + (f" — because {reason}" if reason else "")


def _knowledge_markdown(manifest: dict, book: dict, stats: dict) -> str:
    names = _candidate_names(book)
    version = learning.current(book)
    origins = learning.lineage(book)
    lines = [f"# {manifest['name']} — knowledge", "",
             "> Distilled by Agent Marketplace. Only rules and lessons are stored here: no CVs, client "
             "content, individual decisions, tokens or personal data.", "",
             f"Agent `{manifest['id']}` · level {stats['level']} · {stats['xp']} XP · "
             f"rulebook {'v' + str(version['version']) if version else 'still empty'}", ""]
    lines += ["## Current rules", ""]
    if version and version["rules"]:
        for item in version["rules"]:
            origin = origins.get(item["id"], {})
            who = f"inherited from {origin['author_handle']}" if origin.get("author_handle") else "own rule"
            lines.append(f"- `{item['id']}` {knowledge.redact(item['text'], names)} _({who}, v{origin.get('version', 1)})_")
    else:
        lines.append("_No confirmed rules yet._")
    pending = book.get("observations") or []
    lines += ["", "## Observations awaiting verification", ""]
    lines += [f"- {knowledge.redact(item['text'], names)} _({item.get('at', '')[:10]})_" for item in pending] or ["_None._"]
    lines += ["", "## Recent lessons", ""]
    for entry in reversed(book.get("reflections", [])[-8:]):
        lines.append(f"### {entry['at'][:10]} · {knowledge.redact(entry.get('headline', ''), names)}")
        lines += [f"- {_bullet_line(item, names)}" for item in entry.get("bullets", [])] or ["- Nothing new learned."]
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _knowledge_changelog(manifest: dict, book: dict) -> str:
    names = _candidate_names(book)
    lines = [f"# {manifest['name']} — what I learned", ""]
    entries = book.get("reflections", [])
    if not entries:
        lines.append("_No runs have been reflected on yet._")
    for entry in reversed(entries):
        lines.append(f"## {entry['at']} · {knowledge.redact(entry.get('headline', ''), names)}")
        for key, label in (("worked", "Worked"), ("failed", "Did not work")):
            if entry.get(key):
                lines.append(f"- **{label}:** {knowledge.redact(entry[key], names)}")
        lines += [f"- {_bullet_line(item, names)}" for item in entry.get("bullets", [])] or ["- Nothing new learned."]
        if entry.get("version_after"):
            lines.append(f"- Rulebook is now v{entry['version_after']}.")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _commit_message(manifest: dict, learned: dict | None, book: dict) -> str:
    names = _candidate_names(book)
    version = len(book["versions"])
    if not learned:
        return f"{manifest['name']}: knowledge snapshot (rulebook v{version})"
    headline = knowledge.redact(learned.get("headline") or "knowledge updated", names)
    body = [f"- {_bullet_line(item, names)}" for item in learned.get("bullets", [])] or ["- Nothing new learned."]
    replay = learned.get("replay")
    if replay and replay.get("total"):
        body.append(f"- Replay over {replay['total']} earlier results: {replay['before']} → {replay['after']} correct, "
                    f"{replay['broken']} made worse")
    body.append(f"Rulebook v{version} · run {str(learned.get('run_id', ''))[:8]}")
    return f"{manifest['name']}: {headline}"[:100] + "\n\n" + "\n".join(body)


def _knowledge_files(agent_id: str, handle: str) -> dict[str, str]:
    manifest = agent(agent_id)
    package = _package_for(agent_id, handle)
    book = learning.get(agent_id)
    stats = {"xp": package["experience"]["xp"], "level": package["experience"]["level"]}
    return {"knowledge.md": _knowledge_markdown(manifest, book, stats),
            "rules.json": json.dumps(package, ensure_ascii=False, indent=2) + "\n",
            "changelog.md": _knowledge_changelog(manifest, book)}


def sync_knowledge(agent_id: str, learned: dict | None = None, *, force: bool = False) -> dict:
    """Push one agent's distilled knowledge. Never raises: returns its outcome."""
    outcome = {"agent_id": agent_id, "at": knowledge.now()}
    try:
        manifest = agent(agent_id)
        if manifest is None:
            raise knowledge.SyncRefused("Agent not installed.")
        conn = knowledge.connection()
        saved = knowledge.state()
        if not force and not knowledge.effective_enabled(conn, saved):
            return {**outcome, "status": "off"}
        if not conn["configured"]:
            raise knowledge.SyncRefused("No GitHub token is saved. Add one in Settings.")
        files = _knowledge_files(agent_id, "@" + conn["login"])
        book = learning.get(agent_id)
        message = _commit_message(manifest, learned, book)
        result = knowledge.push(agent_id, files, message, conn)
        outcome.update(status="synced" if result["changed"] else "unchanged", commit=result["commit"],
                       url=result["url"], repo=result["repo"], message=message.splitlines()[0])
    except (knowledge.SyncRefused, experience.ExperienceError, learning.LearningError) as exc:
        outcome.update(status="error", error=str(exc)[:300])
    except Exception:
        outcome.update(status="error", error="Knowledge sync failed unexpectedly.")
    with locked():
        saved = knowledge.state()
        previous = saved["agents"].get(agent_id, {})
        if outcome["status"] == "unchanged" and previous.get("commit"):
            saved["agents"][agent_id] = {**previous, "checked_at": outcome["at"], "status": "synced"}
        else:
            saved["agents"][agent_id] = outcome
        saved["last_error"] = outcome.get("error")
        knowledge.save_state(saved)
    return outcome


def _knowledge_status() -> dict:
    conn = knowledge.connection()
    saved = knowledge.state()
    repo, error = None, None
    if conn["configured"]:
        try:
            repo = knowledge.repo_info(conn)
            if repo is None:
                error = "The repository was not found with the saved token."
        except knowledge.SyncRefused as exc:
            error = str(exc)
    items = []
    for manifest in agents():
        book = learning.get(manifest["id"])
        items.append({"id": manifest["id"], "name": manifest["name"], "version": len(book["versions"]),
                      "reflections": len(book["reflections"]), "last": saved["agents"].get(manifest["id"])})
    return {"connection": conn, "enabled": knowledge.effective_enabled(conn, saved), "setting": saved["enabled"],
            "repo_name": knowledge.REPO_NAME, "repo": repo, "agents": items, "wide_token": saved.get("wide_token", False),
            "error": error or saved.get("last_error")}


def _knowledge_settings(body: dict) -> dict:
    enabled = body.get("enabled")
    if not isinstance(enabled, bool):
        raise ClientError(400, "Choose on or off.")
    if enabled and not knowledge.connection()["configured"]:
        raise ClientError(409, "Save a GitHub token first.")
    with locked():
        saved = knowledge.state()
        saved["enabled"] = enabled
        knowledge.save_state(saved)
    return _knowledge_status()


def _knowledge_token(body: dict) -> dict:
    """Save (after checking) or remove the owner's single-repository token."""
    if body.get("remove") is True:
        knowledge.remove_token()
        with locked():
            saved = knowledge.state()
            saved.update(enabled=False, wide_token=False, last_error=None)
            knowledge.save_state(saved)
        return _knowledge_status()
    token = body.get("token").strip() if isinstance(body.get("token"), str) else ""
    repo = body.get("repo").strip() if isinstance(body.get("repo"), str) else ""
    if not knowledge.TOKEN.fullmatch(token):
        raise ClientError(400, "That does not look like a GitHub token. A fine-grained token starts with github_pat_.")
    if not knowledge.REPO_FULL.fullmatch(repo):
        raise ClientError(400, f"Enter the repository as your-username/{knowledge.REPO_NAME}.")
    try:
        info = knowledge.repo_info({"repo": repo}, token=token, repo=repo)
        if info is None:
            raise knowledge.SyncRefused(f"The token cannot see {repo}. Create the repository and select it for the token.")
        if not info["private"]:
            raise knowledge.SyncRefused("That repository is public. Make it private first; nothing was saved.")
        wide = knowledge.other_repos(token, repo)
    except knowledge.SyncRefused as exc:
        raise ClientError(409, str(exc)) from exc
    knowledge.save_token(token, info["full"])
    with locked():
        saved = knowledge.state()
        saved.update(wide_token=wide, last_error=None)
        knowledge.save_state(saved)
    return _knowledge_status()


def _knowledge_sync_now(body: dict) -> dict:
    if not knowledge.connection()["configured"]:
        raise ClientError(409, "Save a GitHub token in Settings first.")
    target = body.get("agent_id")
    ids = [target] if isinstance(target, str) else [item["id"] for item in agents()]
    if any(agent(item) is None for item in ids):
        raise ClientError(404, "Agent not installed.")
    results = [sync_knowledge(item, None, force=True) for item in ids]
    return {"results": results, "status": _knowledge_status()}


def _knowledge_repo_agents() -> dict:
    conn = knowledge.connection()
    try:
        return {"agents": knowledge.remote_agents(conn)}
    except knowledge.SyncRefused as exc:
        raise ClientError(409, str(exc)) from exc


def _knowledge_fetch(body: dict) -> dict:
    agent_id = body.get("agent_id")
    if not isinstance(agent_id, str):
        raise ClientError(400, "Choose an agent from the repository.")
    try:
        return {"package": knowledge.fetch_package(knowledge.connection(), agent_id)}
    except knowledge.SyncRefused as exc:
        raise ClientError(409, str(exc)) from exc


def handle(request):
    seed_builtins()
    method = request.get("method")
    path = "/" + str(request.get("path") or "").lstrip("/")
    body = request.get("body") or {}
    if not isinstance(body, dict):
        raise ClientError(400, "Expected a JSON object.")
    if request.get("actor", {}).get("access") != "read":
        _recover_stale()
    if method == "GET" and path == "/state":
        return _state()
    if method == "GET" and path == "/learning/demo":
        return {"groups": learning.demos()}
    if method == "GET" and path == "/inbox":
        return _inbox_list()
    if method == "GET" and path == "/knowledge/status":
        return _knowledge_status()
    if method == "GET" and path == "/knowledge/repo-agents":
        return _knowledge_repo_agents()
    if method == "GET" and path.startswith("/learning/"):
        agent_id = path.removeprefix("/learning/")
        if not ID.fullmatch(agent_id) or agent(agent_id) is None:
            raise ClientError(404, "Agent not installed.")
        return {"learning": learning.public(learning.get(agent_id))}
    if method == "GET" and isinstance(path, str) and path.startswith("/runs/"):
        run_id = path.removeprefix("/runs/")
        value = run(run_id) if RUN_ID.fullmatch(run_id) else None
        if value is None:
            raise ClientError(404, "Run not found.")
        return {"run": public_run(value),
                "feedback": read_json(record_path("feedback", run_id))}
    if request.get("actor", {}).get("access") == "read":
        raise ClientError(403, "Read-only helpers cannot change agent state.")
    if method == "POST" and path == "/tools/request_agent":
        return _mention(body)
    if method == "POST" and path == "/install":
        return _install(body)
    if method == "POST" and path == "/knowledge/token":
        return _knowledge_token(body)
    if method == "POST" and path == "/knowledge/settings":
        return _knowledge_settings(body)
    if method == "POST" and path == "/knowledge/sync":
        return _knowledge_sync_now(body)
    if method == "POST" and path == "/knowledge/fetch":
        return _knowledge_fetch(body)
    if method == "POST" and path == "/experience/export-preview":
        return _experience_export(body)
    if method == "POST" and path == "/experience/inspect":
        return _inspect_experience(body)
    if method == "POST" and path == "/experience/import":
        return _import_experience(body)
    if method == "POST" and path == "/runs":
        return _run(body)
    if method == "POST" and path == "/runs/stop":
        return _stop_run(body)
    if method == "POST" and path == "/inbox/cv":
        return _inbox_add(body, "cv")
    if method == "POST" and path == "/inbox/bug":
        return _inbox_add(body, "bug")
    if method == "POST" and path == "/feedback":
        return _feedback(body)
    if method == "POST" and path == "/config":
        return _config(body)
    if method == "POST" and path == "/model":
        return _model(body)
    if method == "POST" and path == "/learning/intake":
        agent_id = body.get("agent_id", "recruiter")
        if not isinstance(agent_id, str) or agent(agent_id) is None or workflow(agent_id) != "recruiter":
            raise ClientError(404, "Recruiter not installed.")
        try:
            return {"learning": learning.public(learning.create_intake(body.get("answers"), agent_id))}
        except learning.LearningError as exc:
            raise ClientError(400, str(exc)) from exc
    if method == "POST" and path == "/learning/estimate":
        return _learning_estimate(body)
    if method == "POST" and path == "/learning/run":
        return _learning_run(body)
    if method == "POST" and path == "/learning/decision":
        return _learning_decision(body)
    if method == "POST" and path == "/learning/accept":
        return _learning_accept(body)
    if method == "POST" and path == "/learning/decline":
        return _learning_decline(body)
    raise ClientError(404, "Unknown marketplace action.")


def main():
    try:
        request = json.load(sys.stdin)
        if not isinstance(request, dict) or len(json.dumps(request, ensure_ascii=False).encode('utf-8')) > MAX_BODY:
            raise ClientError(400, "Request is missing or too large.")
        body = handle(request)
        response = {"status": 200, "body": body}
    except ClientError as exc:
        response = {"status": exc.status, "body": {"detail": exc.detail}}
    except Exception:
        # Credentials, prompts and bug text never go to the HTTP response.
        response = {"status": 500, "body": {"detail": "Marketplace service failed."}}
    print(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    main()
