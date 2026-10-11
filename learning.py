"""Owner-approved, versioned learning records for Marketplace agents.

The service owns transitions; the supervised job only supplies predictions.
Provider prose never silently changes a rulebook. Hiring predictions are
decision support, not automated hiring decisions or calibrated probabilities.
"""

from __future__ import annotations

import json
import hashlib
import re
import unicodedata
import uuid
from pathlib import Path

from runtime import ID, locked, now, read_json, root, workflow, write_json


VERDICTS = {"Invite", "Reject"}
INTAKE = ("role", "requirements", "preferences", "deal_breakers", "team_style")
CRITERIA = INTAKE[1:]
MAX_CV = 6000
MAX_REPLAY_CHARS = 350_000
SENSITIVE = re.compile(
    r"\b(?:age|aged|older|younger|young|date of birth|birthdate|dob|sex|gender|male|female|"
    r"man|men|woman|women|feminine|masculine|"
    r"ethnic\w*|race|racial|religion|religious|faith|photo\w*|photograph\w*|"
    r"family|marital|married|children|parent\w*|mother\w*|father\w*|pregnan\w*|"
    r"spol\w*|pol\b|rod\b|rodn\w*|žen\w*|zen\w*|mušk\w*|musk\w*|"
    r"staros\w*|dob\b|godiste|godište|"
    r"etnic\w*|ras\w*|vjersk\w*|vjer(?:a|e|i|u|nik\w*|oispov\w*)|"
    r"versk\w*|ver(?:a|e|i|u|nik\w*|oispov\w*)|relig\w*|fotograf\w*|"
    r"slik\w*|porodi\w*|obitelj\w*|bracn\w*|bračn\w*|djeca|deca|"
    r"trudno\w*)\b|\b(?:under|over|ispod|iznad)\s+\d{2}\b",
    re.I,
)


class LearningError(ValueError):
    pass


def reject_sensitive(text: str) -> None:
    # This is a user-requested boundary, not a rewrite of an owner's words.
    folded = unicodedata.normalize("NFKC", text)
    if SENSITIVE.search(folded):
        raise LearningError("Rule rejected: age, sex, ethnicity, religion, photographs and family status must not influence a decision. Use only skills and experience relevant to the job.")


def path(agent_id: str) -> Path:
    if not ID.fullmatch(agent_id):
        raise LearningError("Invalid agent id.")
    target = root() / "learning" / f"{agent_id}.json"
    if target.parent.is_symlink() or target.is_symlink():
        raise LearningError("App storage contains a symlink.")
    return target


def empty(agent_id: str) -> dict:
    return {"agent_id": agent_id, "versions": [], "rounds": [], "decisions": [],
            "proposal": None, "inherited_xp": 0, "inherited_curve": [], "provenance": [],
            "reflections": [], "observations": []}


def get(agent_id: str) -> dict:
    value = read_json(path(agent_id))
    if not (isinstance(value, dict) and value.get("agent_id") == agent_id):
        return empty(agent_id)
    value.setdefault("reflections", [])
    value.setdefault("observations", [])
    return value


def current(book: dict) -> dict | None:
    return book["versions"][-1] if book["versions"] else None


def save(book: dict) -> None:
    write_json(path(book["agent_id"]), book)


def rule(rule_id: str, text: str, sources: list[str] | None = None, *, hiring: bool = False) -> dict:
    if not isinstance(text, str) or not 3 <= len(text.strip()) <= 600:
        raise LearningError("A rule must be 3–600 characters.")
    if hiring:
        reject_sensitive(text)
    if not isinstance(rule_id, str) or not re.fullmatch(r"r[0-9a-f]{8}", rule_id):
        raise LearningError("Invalid rule id.")
    return {"id": rule_id, "text": text.strip(), "sources": sources or []}


def validate_rules(rows: list[dict], *, hiring: bool = False) -> list[dict]:
    if not isinstance(rows, list) or len(rows) > 40 or any(not isinstance(item, dict) for item in rows):
        raise LearningError("The rulebook supports up to 40 rules.")
    checked = [rule(item.get("id"), item.get("text"), item.get("sources", []), hiring=hiring)
               for item in rows]
    for checked_item, original in zip(checked, rows):
        if isinstance(original.get("origin"), dict):
            checked_item["origin"] = original["origin"]
    if len(checked) != len(rows) or len({item["id"] for item in checked}) != len(rows):
        raise LearningError("Rules must have unique IDs.")
    return checked


def create_intake(answers: dict, agent_id: str = "recruiter") -> dict:
    if not isinstance(answers, dict) or any(not isinstance(answers.get(key), str) or
                                            not 3 <= len(answers[key].strip()) <= 800
                                            for key in INTAKE):
        raise LearningError("Answer all five questions (3–800 characters per answer).")
    with locked():
        book = get(agent_id)
        if book["versions"]:
            raise LearningError("The Recruiter already has an initial rulebook. Edit it through replay.")
        reject_sensitive(answers["role"])
        rules = [rule("r" + uuid.uuid4().hex[:8], answers[key], ["intake:" + key], hiring=True)
                 for key in CRITERIA]
        book["intake"] = {key: answers[key].strip() for key in INTAKE}
        book["versions"].append({"version": 1, "created_at": now(), "reason": "Initial intake",
                                 "rules": rules, "predictions": {}})
        save(book)
        return book


def demos() -> list[dict]:
    return json.loads((Path(__file__).parent / "recruiter-demo.json").read_text(encoding="utf-8"))


def candidates(source: dict, book: dict) -> tuple[str, list[dict]]:
    if not current(book):
        raise LearningError("Finish the five intake questions first.")
    if source.get("kind") == "demo":
        group = source.get("group")
        entry = next((item for item in demos() if item["id"] == group), None)
        if not entry:
            raise LearningError("Unknown demo group.")
        if any(item.get("source_group") == group for item in book["rounds"]):
            raise LearningError("This demo group has already been reviewed.")
        return entry["label"], [{**item, "id": uuid.uuid4().hex, "fictional": True}
                                 for item in entry["candidates"]]
    if source.get("kind") == "pasted":
        raw = source.get("text")
        if not isinstance(raw, str) or len(raw) > 48_000:
            raise LearningError("Pasted CVs must be shorter than 48,000 characters.")
        chunks = [part.strip() for part in re.split(r"(?m)^\s*---\s*CV\s*---\s*$", raw) if part.strip()]
        if not 1 <= len(chunks) <= 8 or any(len(part) > MAX_CV for part in chunks):
            raise LearningError("Paste 1–8 CVs, each up to 6,000 characters; separate them with a --- CV --- line.")
        return "Real CVs", [{"id": uuid.uuid4().hex, "name": f"Candidate {index}",
                                   "cv": part, "fictional": False} for index, part in enumerate(chunks, 1)]
    raise LearningError("Choose a demo group or paste CVs.")


def decide(agent_id: str, round_id: str, candidate_id: str, choice: str, reason: str) -> dict:
    if choice not in VERDICTS or not isinstance(reason, str) or len(reason.strip()) > 500:
        raise LearningError("Choose Invite or Reject; the reason can be up to 500 characters.")
    with locked():
        book = get(agent_id)
        group = next((item for item in book["rounds"] if item["id"] == round_id), None)
        item = next((item for item in group["candidates"] if item["id"] == candidate_id), None) if group else None
        if not item:
            raise LearningError("Candidate not found in this group.")
        result = next(entry for entry in group["results"] if entry["candidate_id"] == candidate_id)
        if choice != result["verdict"] and not reason.strip():
            raise LearningError("When you disagree, write the reason in one sentence.")
        existing = next((entry for entry in book["decisions"] if entry["candidate_id"] == candidate_id), None)
        decision = {"id": existing["id"] if existing else uuid.uuid4().hex,
                    "round_id": round_id, "candidate_id": candidate_id,
                    "choice": choice, "reason": reason.strip(), "agent_verdict": result["verdict"],
                    "decided_at": now()}
        if existing:
            book["decisions"][book["decisions"].index(existing)] = decision
        else:
            book["decisions"].append(decision)
        book["proposal"] = None  # every replay has an exact decision set
        save(book)
        return decision


def signature(book: dict) -> str:
    # A changed rating, hiring reason or baseline invalidates counterfactuals,
    # even when the same decision IDs are still present.
    material = [{key: item.get(key) for key in ("id", "choice", "reason", "agent_verdict", "source_rating")}
                for item in sorted(book["decisions"], key=lambda value: value["id"])]
    return hashlib.sha256(json.dumps(material, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def agreement(book: dict) -> dict:
    decisions = book["decisions"]
    baseline = sum(item["choice"] == item["agent_verdict"] for item in decisions)
    predictions = (current(book) or {}).get("predictions", {})
    present = sum(item["choice"] == predictions.get(item["id"], item["agent_verdict"])
                  for item in decisions)
    inherited = book.get("inherited_xp", 0)
    return {"total": len(decisions), "initial": baseline, "current": present,
            "inherited_xp": inherited, "xp": inherited + max(0, present - baseline) * 100}


def lineage(book: dict) -> dict[str, dict]:
    """Current rule origins, retaining inherited credit until the text changes."""
    origins, previous = {}, {}
    for version in book["versions"]:
        next_origins = {}
        for item in version["rules"]:
            old = previous.get(item["id"])
            if item.get("origin") and old == item["text"]:
                origin = item["origin"]
            elif old == item["text"] and item["id"] in origins:
                origin = origins[item["id"]]
            else:
                origin = item.get("origin") or {"version": version["version"], "created_at": version["created_at"]}
            next_origins[item["id"]] = origin
        origins = next_origins
        previous = {item["id"]: item["text"] for item in version["rules"]}
    return origins


def experience_summary(book: dict) -> dict:
    rules = (current(book) or {}).get("rules", [])
    origins = lineage(book)
    inherited = sum(bool(origins.get(item["id"], {}).get("author_handle")) for item in rules)
    chain = book.get("provenance") or []
    return {"inherited_from": chain[-1]["author_handle"] if chain else None,
            "inherited_count": inherited, "own_count": len(rules) - inherited,
            "inherited_xp": book.get("inherited_xp", 0), "version": len(book["versions"]),
            "rules": [{"id": item["id"], "text": item["text"], "origin": origins.get(item["id"], {})}
                      for item in rules]}


def inherited_gaps(book: dict) -> dict[str, dict]:
    """Local disagreement counts where an inherited rule was cited; not causality."""
    inherited = {rule_id for rule_id, origin in lineage(book).items() if origin.get("author_handle")}
    counts = {rule_id: {"disagree": 0, "total": 0} for rule_id in inherited}
    decisions = {item["candidate_id"]: item for item in book["decisions"] if item.get("candidate_id")}
    for group in book["rounds"]:
        for result in group["results"]:
            decision = decisions.get(result["candidate_id"])
            if not decision:
                continue
            for rule_id in set(result["rule_ids"]) & inherited:
                counts[rule_id]["total"] += 1
                counts[rule_id]["disagree"] += decision["choice"] != result["verdict"]
    return counts


def public(book: dict) -> dict:
    value = {**book, "agreement": agreement(book)}
    value["lineage"] = lineage(book)
    value["inherited_gaps"] = inherited_gaps(book)
    # Owner may inspect decisions and named candidates, but not every pasted CV
    # on each refresh. The full CV remains app-owned for a complete replay.
    value["rounds"] = [{**round_, "candidates": [
        {key: item[key] for key in ("id", "name", "fictional") if key in item}
        for item in round_["candidates"]]} for round_ in book["rounds"]]
    value["decisions"] = [{key: content for key, content in item.items() if key != "excerpt"}
                          for item in book["decisions"]]
    return value


def replay_size(book: dict) -> int:
    return sum(len(item.get("cv", "")) for group in book["rounds"]
               for item in group["candidates"] if any(decision["candidate_id"] == item["id"]
                                                   for decision in book["decisions"]))


def apply_changes(base: list[dict], changes: list[dict], decision_ids: set[str]) -> list[dict]:
    if not isinstance(changes, list) or not 1 <= len(changes) <= 6:
        raise LearningError("A proposal must have 1–6 changes.")
    result = [dict(item) for item in base]
    for change in changes:
        if not isinstance(change, dict) or change.get("action") not in {"add", "edit", "remove"}:
            raise LearningError("The proposal has an unknown change.")
        refs = change.get("source_decision_ids", [])
        if not isinstance(refs, list) or not refs or any(ref not in decision_ids for ref in refs):
            raise LearningError("Every change must cite a real owner decision.")
        rule_id = change.get("rule_id")
        at = next((n for n, item in enumerate(result) if item["id"] == rule_id), None)
        if change["action"] == "add":
            if at is not None:
                raise LearningError("The new rule already exists.")
            result.append(rule(rule_id, change.get("text"), refs, hiring=True))
        elif at is None:
            raise LearningError("The changed rule does not exist.")
        elif change["action"] == "remove":
            result.pop(at)
        else:
            result[at] = rule(rule_id, change.get("text"), refs, hiring=True)
    return validate_rules(result, hiring=True)


def replay_summary(decisions: list[dict], rows: list[dict]) -> dict:
    expected = {item["id"]: item for item in decisions}
    if not isinstance(rows, list) or len(rows) != len(expected) or {item.get("decision_id") for item in rows if isinstance(item, dict)} != set(expected):
        raise LearningError("The replay did not cover every earlier decision; the proposal cannot be accepted.")
    before = after = 0
    fixed, broken = [], []
    predictions = {}
    for row in rows:
        decision = expected[row["decision_id"]]
        allowed = VERDICTS if decision["choice"] in VERDICTS else {"up", "down"}
        if row.get("before") not in allowed or row.get("after") not in allowed:
            raise LearningError("The replay returned an invalid outcome.")
        old = row["before"] == decision["choice"]
        new = row["after"] == decision["choice"]
        before += old
        after += new
        if new and not old: fixed.append(decision["id"])
        if old and not new: broken.append(decision["id"])
        predictions[decision["id"]] = row["after"]
    return {"total": len(decisions), "before": before, "after": after,
            "fixed": fixed, "broken": broken, "warnings": ["Regression: some previously correct decisions would become wrong."] if broken else [],
            "predictions": predictions}


def accept(agent_id: str, proposal_id: str, *, confirm_inherited_removal: bool = False) -> dict:
    with locked():
        book = get(agent_id)
        proposal = book.get("proposal")
        if not proposal or proposal.get("id") != proposal_id:
            raise LearningError("Proposal not found.")
        if proposal["base_version"] != len(book["versions"]) or proposal["decision_signature"] != signature(book):
            raise LearningError("Decisions or rules changed. Repeat the replay.")
        rules = validate_rules(proposal["rules"], hiring=workflow(agent_id) == "recruiter")
        previous = current(book)
        old_rules = {item["id"]: item for item in (previous or {}).get("rules", [])}
        removed = set(old_rules) - {item["id"] for item in rules}
        if any(lineage(book).get(rule_id, {}).get("author_handle") for rule_id in removed) and not confirm_inherited_removal:
            raise LearningError("Removing an inherited rule needs a separate confirmation.")
        for item in rules:
            old = old_rules.get(item["id"])
            if old is None or old["text"] != item["text"]:
                item.pop("origin", None)
        book["versions"].append({"version": len(book["versions"]) + 1,
                                 "created_at": now(), "reason": proposal["reason"],
                                 "rules": rules, "replay": proposal["replay"],
                                 "predictions": proposal["replay"]["predictions"],
                                 "round_count": len(book["rounds"]),
                                 "decision_count": len(book["decisions"]),
                                 "restored_from": proposal.get("restored_from")})
        book["proposal"] = None
        save(book)
        return public(book)


def decline(agent_id: str, proposal_id: str) -> dict:
    with locked():
        book = get(agent_id)
        if not book.get("proposal") or book["proposal"].get("id") != proposal_id:
            raise LearningError("Proposal not found.")
        book["proposal"] = None
        save(book)
        return public(book)


# --- Automatic learning -------------------------------------------------------
# After a completed run the agent reflects. Its rule changes are applied here
# only when a replay over every earlier owner decision or rating shows no
# regression; otherwise they are kept out and reported as such.

AUTO_MAX_CHANGES = 3
PRIVATE_TEXT = re.compile(r"(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d .()/-]{7,}\d|https?://\S+)", re.I)


def auto_changes(base: list[dict], changes, *, inherited_ids: set[str], source: str,
                 hiring: bool = False) -> tuple[list[dict], list[dict], list[dict]]:
    """Apply a bounded set of reflection changes. Returns (rules, applied, dropped)."""
    rules = [dict(item) for item in base]
    applied, dropped = [], []
    for change in (changes if isinstance(changes, list) else [])[:AUTO_MAX_CHANGES]:
        if not isinstance(change, dict) or change.get("action") not in {"add", "edit", "remove"}:
            continue
        text = change.get("text") if isinstance(change.get("text"), str) else ""
        text = " ".join(text.split())
        reason = " ".join(str(change.get("reason") or "").split())[:240]
        shown = text or str(change.get("rule_id") or "")
        if len(reason) < 3:
            dropped.append({"text": shown[:300], "reason": "The change came without a reason."})
            continue
        rule_id = change.get("rule_id") if change["action"] != "add" else "r" + uuid.uuid4().hex[:8]
        at = next((n for n, item in enumerate(rules) if item["id"] == rule_id), None)
        try:
            if change["action"] != "add" and at is None:
                raise LearningError("The rule to change does not exist.")
            if change["action"] != "add" and rule_id in inherited_ids:
                raise LearningError("Inherited rules are only changed with your confirmation.")
            if change["action"] != "remove":
                if PRIVATE_TEXT.search(text):
                    raise LearningError("A rule must not contain links or contact details.")
                if len(text) < 5:
                    raise LearningError("A rule must be at least 5 characters.")
                if any(item["text"].strip().lower() == text.lower() for item in rules if item["id"] != rule_id):
                    raise LearningError("The agent already follows this rule.")
                made = rule(rule_id, text, [source], hiring=hiring)
            if change["action"] == "add":
                rules.append(made)
                applied.append({"kind": "added", "rule_id": rule_id, "text": text, "reason": reason})
            elif change["action"] == "edit":
                old = rules[at]["text"]
                rules[at] = made
                applied.append({"kind": "changed", "rule_id": rule_id, "text": text, "reason": reason, "was": old})
            else:
                old = rules.pop(at)["text"]
                applied.append({"kind": "removed", "rule_id": rule_id, "text": old, "reason": reason})
        except LearningError as exc:
            dropped.append({"text": shown[:300], "reason": str(exc)})
    try:
        rules = validate_rules(rules, hiring=hiring)
    except LearningError as exc:
        return [dict(item) for item in base], [], dropped + [{"text": "All proposed changes", "reason": str(exc)}]
    return rules, applied, dropped


def replay_gate(replay: dict) -> tuple[bool, str]:
    """Keep a change only when the replay found no earlier result made worse."""
    if not replay["total"]:
        return False, "There was nothing earlier to replay it against, so it was not made active."
    if replay["broken"]:
        return False, f"The replay showed it would make {len(replay['broken'])} earlier result(s) worse."
    if replay["after"] < replay["before"]:
        return False, "The replay showed it would not improve earlier results."
    return True, ""


def auto_commit(agent_id: str, rules: list[dict], reason: str, replay: dict, base_version: int,
                *, hiring: bool) -> int:
    with locked():
        book = get(agent_id)
        if len(book["versions"]) != base_version:
            raise LearningError("The rulebook changed while the agent was reflecting.")
        rules = validate_rules(rules, hiring=hiring)
        old_rules = {item["id"]: item for item in (current(book) or {}).get("rules", [])}
        for item in rules:
            old = old_rules.get(item["id"])
            if old is None or old["text"] != item["text"]:
                item.pop("origin", None)
        book["versions"].append({"version": len(book["versions"]) + 1, "created_at": now(),
                                 "reason": reason, "rules": rules, "replay": replay,
                                 "predictions": replay["predictions"],
                                 "round_count": len(book["rounds"]),
                                 "decision_count": len(book["decisions"]), "auto": True})
        book["proposal"] = None
        save(book)
        return len(book["versions"])


def record_reflection(agent_id: str, learned: dict, observations: list[dict] | None = None) -> None:
    with locked():
        book = get(agent_id)
        book["reflections"] = (book["reflections"] + [learned])[-200:]
        book["last_reflection_at"] = learned["at"]
        if observations is not None:
            book["observations"] = observations[-10:]
        save(book)
