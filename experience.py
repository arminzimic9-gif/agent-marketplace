"""Allowlisted, private-data-free transport for approved agent experience.

Never serialize learning records wholesale: they contain CVs, names, reasons,
decision IDs and model predictions. This module builds a new transport shape
from approved rules and aggregate counts only.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker, ValidationError

import learning
from runtime import workflow


FORMAT = "1.0.0"
MAX_PACKAGE_BYTES = 350_000
HANDLE = re.compile(r"^@[A-Za-z0-9][A-Za-z0-9_.-]{1,39}$")
PRIVATE_TEXT = re.compile(r"(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d .()/-]{7,}\d|https?://\S+)", re.I)


class ExperienceError(ValueError):
    pass


def source_label(item: dict) -> str:
    """Provenance category, not an owner decision or run identifier."""
    sources = item.get("sources") or []
    for value in sources:
        if value in {"intake:requirements", "intake:preferences", "intake:deal_breakers", "intake:team_style"}:
            return value
        if value in {"owner-decision", "owner-reply", "agent-reflection", "manual"}:
            return value
        if isinstance(value, str) and value.startswith("reply:"):
            return "owner-reply"
        if isinstance(value, str) and value.startswith("auto:"):
            return "agent-reflection"
        if isinstance(value, str) and re.fullmatch(r"[0-9a-f]{32}", value):
            return "owner-decision"
    return "manual"


def _agreement(version: dict) -> dict:
    replay = version.get("replay") or {}
    aggregate = version.get("agreement") or {}
    return {"correct": replay.get("after", aggregate.get("correct", 0)),
            "total": replay.get("total", aggregate.get("total", 0))}


def _versions(book: dict, author_handle: str) -> list[dict]:
    exported, origins, previous = [], {}, {}
    for version in book["versions"]:
        next_origins, rules = {}, []
        for item in version["rules"]:
            if PRIVATE_TEXT.search(item["text"]):
                raise ExperienceError("A rule contains an email address, phone number or URL. Remove the personal data through editing and replay before exporting.")
            old = previous.get(item["id"])
            inherited = item.get("origin")
            if isinstance(inherited, dict) and inherited.get("author_handle"):
                origin = {key: inherited[key] for key in ("author_handle", "version", "created_at")}
            elif old == item["text"] and item["id"] in origins:
                origin = origins[item["id"]]
            else:
                origin = {"author_handle": author_handle, "version": version["version"],
                          "created_at": version["created_at"]}
            next_origins[item["id"]] = origin
            rules.append({"id": item["id"], "text": item["text"],
                          "source": source_label(item), "origin": origin})
        exported.append({"version": version["version"], "created_at": version["created_at"],
                         "rules": rules, "agreement": _agreement(version)})
        origins = next_origins
        previous = {item["id"]: item["text"] for item in version["rules"]}
    return exported


def _curve(book: dict) -> list[dict]:
    points = list(book.get("inherited_curve") or [])
    decisions = {item["candidate_id"]: item for item in book["decisions"] if item.get("candidate_id")}
    predictions = (learning.current(book) or {}).get("predictions") or {}
    for group in book["rounds"]:
        rows = [decisions[item["id"]] for item in group["candidates"] if item["id"] in decisions]
        if rows:
            correct = sum(item["choice"] == predictions.get(item["id"], item["agent_verdict"])
                          for item in rows)
            points.append({"correct": correct, "total": len(rows)})
    return points


def build(manifest: dict, playbook: str, book: dict, stats: dict, author_handle: str) -> dict:
    if not isinstance(author_handle, str) or not HANDLE.fullmatch(author_handle):
        raise ExperienceError("Enter your public @handle (2–40 characters after @).")
    versions = _versions(book, author_handle)
    latest = learning.current(book) or {}
    learned = latest.get("decision_count", 0) if latest.get("replay") else 0
    # Imported versions carry aggregate agreement but no local decisions.
    final = _agreement(latest) if latest.get("replay") else {"correct": 0, "total": 0}
    chain = list(book.get("provenance") or [])
    chain.append({"author_handle": author_handle, "exported_at": learning.now(),
                  "decision_count": learned, "final_agreement": final})
    package = {"package_version": FORMAT, "agent": manifest, "playbook": playbook,
               "experience": {"workflow_id": workflow(manifest["id"]),
                              "role": (book.get("intake") or {}).get("role") or "",
                              "versions": versions, "xp": stats["xp"], "level": stats["level"],
                              "curve": _curve(book), "provenance": {"chain": chain}}}
    validate(package)
    return package


def canonical(package: dict) -> bytes:
    return json.dumps(package, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def digest(package: dict) -> str:
    return hashlib.sha256(canonical(package)).hexdigest()


def validate(package: dict) -> None:
    if not isinstance(package, dict) or len(canonical(package)) > MAX_PACKAGE_BYTES:
        raise ExperienceError("The package is invalid or too large (350 KB maximum). Nothing was imported.")
    schema = json.loads((Path(__file__).parent / "agent.schema.json").read_text(encoding="utf-8"))
    wrapper = {"$schema": schema["$schema"], "$defs": schema["$defs"],
               "$ref": "#/$defs/experiencePackage"}
    checker = FormatChecker()
    try:
        Draft202012Validator(wrapper, format_checker=checker).validate(package)
        Draft202012Validator(schema, format_checker=checker).validate(package["agent"])
    except ValidationError as exc:
        where = ".".join(str(item) for item in exc.absolute_path)
        raise ExperienceError("The package does not match the schema" + (" (" + where + ")" if where else "") + ". Nothing was imported.") from exc
    data = package["experience"]
    if data["level"] != _level_for(data["xp"]):
        raise ExperienceError("The level does not match the XP in the package.")
    if data["workflow_id"] != (package["agent"].get("experience") or {}).get("workflow_id", package["agent"]["id"]):
        raise ExperienceError("The agent kind does not match its manifest.")
    if data["workflow_id"] == "recruiter" and data["versions"] and not data["role"].strip():
        raise ExperienceError("The Recruiter package has no role description, which is needed to continue screening.")
    if not data["provenance"]["chain"]:
        raise ExperienceError("The package has no author lineage.")
    for index, version in enumerate(data["versions"], 1):
        if version["version"] != index:
            raise ExperienceError("Rulebook versions must run in order starting at v1.")
        ids = [item["id"] for item in version["rules"]]
        if len(ids) != len(set(ids)):
            raise ExperienceError("A version contains a duplicate rule ID.")
        for item in version["rules"]:
            learning.reject_sensitive(item["text"])
            if PRIVATE_TEXT.search(item["text"]):
                raise ExperienceError("An imported rule contains personal contact details or a URL; nothing was imported.")
    for point in data["curve"]:
        if point["correct"] > point["total"]:
            raise ExperienceError("The learning-curve points contain invalid numbers.")
    for entry in data["provenance"]["chain"]:
        a = entry["final_agreement"]
        if a["correct"] > a["total"]:
            raise ExperienceError("The lineage has an invalid agreement count.")


def _level_for(xp: int) -> int:
    level = 1
    while 100 * level * level <= xp:
        level += 1
    return level


def imported_book(package: dict, agent_id: str) -> dict:
    data = package["experience"]
    book = learning.empty(agent_id)
    book["inherited_xp"] = data["xp"]
    book["inherited_curve"] = data["curve"]
    book["provenance"] = data["provenance"]["chain"]
    if data["role"]:
        book["intake"] = {"role": data["role"]}
    for version in data["versions"]:
        book["versions"].append({"version": version["version"],
                                 "created_at": version["created_at"],
                                 "reason": "Imported approved version",
                                 "rules": [{"id": item["id"], "text": item["text"],
                                            "sources": [item["source"]], "origin": item["origin"]}
                                           for item in version["rules"]],
                                 "agreement": version["agreement"]})
    return book
