"""Automatic reflection, 'What I learned' and private GitHub sync: no paid calls, no network."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from unittest import mock

import knowledge
import learning
import reflection
import runner
import runtime
import service


def rating(rid, value, at="2026-10-01T00:00:00+00:00"):
    return {"id": rid, "choice": "up", "agent_verdict": value, "source_rating": value,
            "reason": "", "target": "x", "saved_at": at, "excerpt": "report"}


class AutoLearningUnits(unittest.TestCase):
    def test_changes_need_a_reason_and_never_touch_inherited_or_private_text(self):
        base = [learning.rule("r11111111", "I will cite the exact file.", ["manual"]),
                learning.rule("r22222222", "I will keep it short.", ["manual"])]
        rules, applied, dropped = learning.auto_changes(base, [
            {"action": "add", "text": "I will list unverified claims.", "reason": "The owner asked for it twice."},
            {"action": "add", "text": "I will mail me@example.com.", "reason": "contact"},
            {"action": "add", "text": "I will do more.", "reason": ""},
            {"action": "add", "text": "A fourth change is never read.", "reason": "over the limit"}],
            inherited_ids={"r22222222"}, source="auto:abc")
        self.assertEqual([item["kind"] for item in applied], ["added"])
        self.assertEqual(len(rules), 3)
        self.assertEqual(len(dropped), 2)
        _, applied, dropped = learning.auto_changes(base, [
            {"action": "edit", "rule_id": "r22222222", "text": "I will keep it very short.", "reason": "Too long before."},
            {"action": "add", "text": "I will cite the exact file.", "reason": "duplicate"}],
            inherited_ids={"r22222222"}, source="auto:abc")
        self.assertEqual(applied, [])
        reasons = " ".join(item["reason"] for item in dropped)
        self.assertIn("Inherited rules", reasons)
        self.assertIn("already follows", reasons)

    def test_gate_keeps_only_changes_that_break_nothing(self):
        ok = {"total": 4, "before": 2, "after": 3, "fixed": ["a"], "broken": []}
        self.assertTrue(learning.replay_gate(ok)[0])
        self.assertFalse(learning.replay_gate({**ok, "broken": ["b"]})[0])
        self.assertFalse(learning.replay_gate({**ok, "after": 1})[0])
        self.assertFalse(learning.replay_gate({**ok, "total": 0})[0])

    def judge(self, data, decisions, rules=None):
        rules = rules if rules is not None else []
        return reflection.judge(
            data, run_id="r" * 32, rules=rules, decisions=decisions, inherited_ids=set(), hiring=False,
            version=len(rules) and 1, names=[], observations=[],
            apply_changes=lambda base, changes: learning.auto_changes(
                base, changes, inherited_ids=set(), source="auto:r"))

    add = {"action": "add", "text": "I will state what is unverified.", "reason": "Rated down for hiding gaps."}

    def test_improving_replay_is_kept_and_reported(self):
        decisions = [rating("d1", "down"), rating("d2", "up")]
        data = {"worked": "Clear plan.", "failed": "Gaps were not flagged.", "changes": [self.add],
                "predictions": [{"decision_id": "d1", "before": "down", "after": "up"},
                                {"decision_id": "d2", "before": "up", "after": "up"}]}
        learned, _, kept = self.judge(data, decisions)
        self.assertIsNotNone(kept)
        self.assertEqual(learned["status"], "learned")
        self.assertEqual(learned["bullets"][0]["kind"], "added")
        self.assertEqual((learned["replay"]["before"], learned["replay"]["after"]), (1, 2))

    def test_a_regression_or_a_faked_before_keeps_the_rule_out(self):
        decisions = [rating("d1", "down"), rating("d2", "up")]
        worse = {"changes": [self.add], "predictions": [
            {"decision_id": "d1", "before": "down", "after": "up"},
            {"decision_id": "d2", "before": "up", "after": "down"}]}
        learned, _, kept = self.judge(worse, decisions)
        self.assertIsNone(kept)
        self.assertEqual(learned["bullets"][0]["kind"], "kept_out")
        self.assertIn("worse", learned["bullets"][0]["reason"])
        faked = {"changes": [self.add], "predictions": [
            {"decision_id": "d1", "before": "up", "after": "up"},
            {"decision_id": "d2", "before": "up", "after": "up"}]}
        _, _, kept = self.judge(faked, decisions)
        self.assertIsNone(kept)

    def test_without_ratings_a_lesson_is_only_an_observation(self):
        learned, observations, kept = self.judge({"changes": [self.add], "predictions": []}, [])
        self.assertIsNone(kept)
        self.assertEqual(learned["bullets"][0]["kind"], "noted")
        self.assertEqual(len(observations), 1)

    def test_nothing_new_always_says_why(self):
        learned, _, kept = self.judge({"worked": "Fine.", "changes": [], "no_change_reason": "The result was already complete."}, [])
        self.assertIsNone(kept)
        self.assertEqual(learned["headline"], "Nothing new learned")
        self.assertEqual(learned["bullets"][0]["text"], "The result was already complete.")
        self.assertFalse(learned["changed_rules"])


class FakeGitHub:
    """A tiny in-memory GitHub REST API for the knowledge repository."""

    def __init__(self, private=True):
        self.private, self.calls, self.tree = private, [], "t0"
        self.ref = "p0"

    def __call__(self, method, path, body=None, *, token=None):
        self.calls.append((method, path))
        if path == "repos/owner/agent-marketplace-knowledge":
            return 200, {"full_name": "owner/agent-marketplace-knowledge", "private": self.private,
                         "html_url": "https://github.com/owner/agent-marketplace-knowledge", "default_branch": "main"}
        if path.endswith("git/ref/heads/main"):
            return 200, {"object": {"sha": self.ref}}
        if "git/commits/" in path and method == "GET":
            return 200, {"tree": {"sha": self.tree}}
        if path.endswith("git/blobs"):
            return 201, {"sha": "b" + str(len(self.calls))}
        if path.endswith("git/trees"):
            return 201, {"sha": "t1" if body["tree"] else self.tree}
        if path.endswith("git/commits"):
            self.message = body["message"]
            return 201, {"sha": "c1"}
        if method == "PATCH":
            self.ref = body["sha"]
            return 200, {}
        return 404, None


class KnowledgeSafety(unittest.TestCase):
    conn = {"configured": True, "repo": "owner/agent-marketplace-knowledge", "login": "owner"}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patch = mock.patch.dict(os.environ, {"APP_STORAGE_DIR": self.tmp.name, "APP_ID": "9"})
        patch.start()
        self.addCleanup(patch.stop)

    def test_redaction_removes_contacts_links_and_names(self):
        text = knowledge.redact("Ana Kovač wrote ana@example.com see https://x.example/cv or +387 61 123 456", ["Ana Kovač"])
        for leaked in ("Ana", "@example.com", "https://", "123 456"):
            self.assertNotIn(leaked, text)

    def test_secrets_are_never_pushed(self):
        with self.assertRaises(knowledge.SyncRefused):
            knowledge.check_files({"knowledge.md": "token = ghp_" + "a" * 30})
        knowledge.check_files({"knowledge.md": "I will state what is unverified."})

    def test_a_private_repository_gets_exactly_one_commit_with_the_summary_message(self):
        fake = FakeGitHub()
        with mock.patch.object(knowledge, "api", fake):
            result = knowledge.push("sentinel", {"knowledge.md": "x", "rules.json": "{}"}, "Sentinel: 1 rule learned", self.conn)
        self.assertTrue(result["changed"])
        self.assertEqual(result["commit"], "c1")
        self.assertEqual(fake.message, "Sentinel: 1 rule learned")
        self.assertEqual([c for c in fake.calls if c[1].endswith("git/commits") and c[0] == "POST"].__len__(), 1)
        self.assertEqual(fake.ref, "c1")

    def test_a_public_repository_is_refused_before_anything_is_written(self):
        fake = FakeGitHub(private=False)
        with mock.patch.object(knowledge, "api", fake):
            with self.assertRaises(knowledge.SyncRefused) as caught:
                knowledge.push("sentinel", {"knowledge.md": "x"}, "msg", self.conn)
        self.assertIn("public", str(caught.exception))
        self.assertTrue(all(method == "GET" for method, _ in fake.calls))
        with mock.patch.object(knowledge, "api", fake), self.assertRaises(knowledge.SyncRefused):
            knowledge.fetch_package(self.conn, "sentinel")

    def test_visibility_is_checked_again_right_before_the_branch_moves(self):
        fake = FakeGitHub()
        original = fake.__call__
        seen = {"n": 0}

        def flip(method, path, body=None, *, token=None):
            if path.endswith("git/commits") and method == "POST":
                fake.private = False  # the owner makes the repository public mid-sync
            return original(method, path, body, token=token)
        with mock.patch.object(knowledge, "api", flip), self.assertRaises(knowledge.SyncRefused):
            knowledge.push("sentinel", {"knowledge.md": "x"}, "msg", self.conn)
        self.assertEqual(fake.ref, "p0")  # the branch was never moved
        self.assertNotIn("PATCH", [method for method, _ in fake.calls])

    def test_no_token_means_no_sync(self):
        with self.assertRaises(knowledge.SyncRefused):
            knowledge.push("sentinel", {"knowledge.md": "x"}, "msg", {"configured": False, "repo": None, "login": None})
        self.assertFalse(knowledge.effective_enabled({"configured": False}, {"enabled": True}))
        self.assertFalse(knowledge.effective_enabled({"configured": True}, knowledge.state()))  # off by default

    def test_token_is_stored_privately_and_never_leaks_into_errors(self):
        token = "github_pat_" + "A" * 40
        knowledge.save_token(token, "owner/agent-marketplace-knowledge")
        self.assertEqual(oct(knowledge.token_path().stat().st_mode & 0o777), "0o600")
        self.assertNotIn(token, json.dumps(knowledge.connection()))
        self.assertNotIn(token, knowledge._clean("failed with " + token))
        self.assertNotIn(token, json.dumps(knowledge.state()))
        knowledge.remove_token()
        self.assertFalse(knowledge.connection()["configured"])


class TokenSettings(KnowledgeSafety):
    token = "github_pat_" + "B" * 40
    repo = "owner/agent-marketplace-knowledge"

    def save(self, fake, **body):
        with mock.patch.object(knowledge, "api", fake), mock.patch.object(knowledge, "other_repos", return_value=False):
            return service._knowledge_token({"token": self.token, "repo": self.repo, **body})

    def test_a_public_repository_is_not_saved(self):
        with self.assertRaises(service.ClientError):
            self.save(FakeGitHub(private=False))
        self.assertFalse(knowledge.connection()["configured"])

    def test_bad_token_or_repository_name_is_rejected(self):
        with self.assertRaises(service.ClientError):
            self.save(FakeGitHub(), token="not-a-token")
        with self.assertRaises(service.ClientError):
            self.save(FakeGitHub(), repo="owner/another-repo")

    def test_saved_token_is_never_in_the_status_and_can_be_removed(self):
        status = self.save(FakeGitHub())
        self.assertTrue(status["connection"]["configured"])
        self.assertFalse(status["enabled"])  # off until the owner turns it on
        self.assertNotIn(self.token, json.dumps(status))
        service._knowledge_settings({"enabled": True})
        with mock.patch.object(knowledge, "api", FakeGitHub()):
            self.assertTrue(service._knowledge_status()["enabled"])
        removed = service._knowledge_token({"remove": True})
        self.assertFalse(removed["enabled"])
        self.assertFalse(knowledge.token_path().exists())


class RunReflection(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patch = mock.patch.dict(os.environ, {"APP_STORAGE_DIR": self.tmp.name, "APP_ID": "9", "DATA_DIR": self.tmp.name})
        patch.start()
        self.addCleanup(patch.stop)
        runtime.seed_builtins()
        self.sync = mock.patch.object(runner, "sync_knowledge", return_value={
            "status": "synced", "commit": "c" * 40, "url": "https://github.com/o/r/commit/" + "c" * 40,
            "repo": "o/r", "message": "Sentinel: 1 rule change learned", "at": runtime.now()})
        self.sync_mock = self.sync.start()
        self.addCleanup(self.sync.stop)

    def finished_run(self, run_id, rating_value=None):
        row = {"id": run_id, "agent_id": "sentinel", "status": "completed", "created_at": runtime.now(),
               "target": "Example", "output": "Score: 70/100", "provider": "claude", "model": "m", "effort": None,
               "limits": {"max_steps": 6, "max_estimated_cost_usd": 2.0}, "tools": [], "timeline": [],
               "cost_usd": 0.4}
        runtime.write_json(runtime.record_path("runs", run_id), row)
        if rating_value:
            runtime.write_json(runtime.record_path("feedback", run_id), {
                "run_id": run_id, "agent_id": "sentinel", "rating": rating_value, "note": "Missed a gap",
                "saved_at": "2026-10-01T00:00:00+00:00"})
        return row

    def reflect(self, answer, row=None):
        row = row or self.finished_run("b" * 32)
        target = {"label": "Example"}

        def execute(ref, _prompt, _images=None, target=None, persist=True):
            self.assertFalse(persist)
            self.assertEqual(ref["tools"], [])
            self.assertLess(ref["limits"]["max_estimated_cost_usd"], 2.0)  # shares the confirmed cap
            ref["output"] = json.dumps(answer)
            ref["cost_usd"] = 0.05
        with mock.patch.object(runner, "_execute", side_effect=execute):
            runner._reflect_after(row, target, runtime.agent("sentinel"))
        return row

    def test_a_replay_checked_rule_becomes_a_new_version_and_is_synced(self):
        self.finished_run("a" * 32, "down")
        answer = {"worked": "Clear plan.", "failed": "Gaps were hidden.",
                  "changes": [{"action": "add", "text": "I will list what is unverified.", "reason": "Rated down for hiding gaps."}],
                  "predictions": [{"decision_id": "a" * 32, "before": "down", "after": "up"}]}
        row = self.reflect(answer)
        self.assertEqual(row["learned"]["status"], "learned")
        self.assertEqual(row["learned"]["version_after"], 1)
        book = learning.get("sentinel")
        self.assertTrue(book["versions"][0]["auto"])
        self.assertEqual(book["versions"][0]["rules"][0]["text"], "I will list what is unverified.")
        self.assertEqual(book["reflections"][-1]["run_id"], row["id"])
        self.assertEqual(row["sync"]["status"], "synced")
        self.sync_mock.assert_called_once()
        self.assertAlmostEqual(row["cost_usd"], 0.45)

    def test_nothing_learned_is_reported_with_its_reason_and_not_synced_twice(self):
        runtime.write_json(knowledge.state_path(), {"enabled": True, "agents": {"sentinel": {"status": "synced"}}})
        row = self.reflect({"worked": "ok", "failed": "", "changes": [], "no_change_reason": "Nothing in this run needs a rule."})
        self.assertEqual(row["learned"]["headline"], "Nothing new learned")
        self.assertEqual(learning.get("sentinel")["versions"], [])
        self.sync_mock.assert_not_called()

    def test_no_budget_left_skips_reflection_explicitly(self):
        row = self.finished_run("c" * 32)
        row["cost_usd"] = 1.99
        with mock.patch.object(runner, "_execute") as execute:
            runner._reflect_after(row, {}, runtime.agent("sentinel"))
        execute.assert_not_called()
        self.assertEqual(row["learned"]["status"], "skipped")
        self.assertIn("cost cap", row["learned"]["bullets"][0]["text"])

    def test_a_broken_reflection_never_fails_the_run(self):
        row = self.reflect({"changes": "garbage"})
        self.assertIn(row["learned"]["status"], {"nothing", "skipped"})
        row = self.finished_run("d" * 32)
        with mock.patch.object(runner, "_execute", side_effect=RuntimeError("boom")):
            runner._reflect_after(row, {}, runtime.agent("sentinel"))
        self.assertEqual(row["learned"]["status"], "skipped")


class CommitMessage(unittest.TestCase):
    def test_message_summarises_what_was_learned_without_private_text(self):
        manifest = {"name": "Sentinel"}
        book = {"versions": [1, 2], "rounds": [{"candidates": [{"name": "Ana Kovač"}]}]}
        learned = {"run_id": "abcdef123456", "headline": "1 rule change learned", "bullets": [
            {"kind": "added", "text": "I will list gaps for Ana Kovač.", "reason": "Rated down, see https://x.example"}],
            "replay": {"total": 3, "before": 2, "after": 3, "broken": 0}}
        message = service._commit_message(manifest, learned, book)
        self.assertTrue(message.startswith("Sentinel: 1 rule change learned"))
        self.assertIn("Added rule: I will list gaps", message)
        self.assertIn("Replay over 3 earlier results: 2 → 3", message)
        self.assertNotIn("Ana", message)
        self.assertNotIn("https://", message)


if __name__ == "__main__":
    unittest.main()
