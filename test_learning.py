"""Learning loop tests use a fake provider: no paid calls or real CVs."""

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from jsonschema import Draft202012Validator

import learning
import runner
import runtime
import service


class LearningLoopTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patch = mock.patch.dict(os.environ, {"APP_STORAGE_DIR": self.tmp.name, "APP_ID": "9", "DATA_DIR": self.tmp.name})
        patch.start()
        self.addCleanup(patch.stop)
        runtime.seed_builtins()
        self.api_patch = mock.patch.object(service, "api", side_effect=self.api)
        self.api_patch.start()
        self.addCleanup(self.api_patch.stop)
        self.lock_patch = mock.patch.object(service, "_job_locked", return_value=False)
        self.lock_patch.start()
        self.addCleanup(self.lock_patch.stop)

    def api(self, method, path, body=None, **_):
        if path == "/api/models":
            return {"providers": {"claude": [{"id": "claude-opus-5-5", "label": "Opus", "available": True}]}}
        if path.endswith("/run-job"):
            return {"queued": True}
        raise AssertionError((method, path))

    def intake(self):
        return service.handle({"method": "POST", "path": "/learning/intake", "body": {"answers": {
            "role": "Web dizajner za mali studio", "requirements": "Dva objavljena responzivna web sajta i Figma.",
            "preferences": "Accessibility and collaboration with developers.",
            "deal_breakers": "Bez web portfolija ne pozivati.",
            "team_style": "Direktan feedback i iteracije s klijentima.",
        }}})["learning"]

    def confirmed(self, agent_id, **fields):
        manifest = runtime.agent(agent_id)
        tools_enabled = fields.get("action") == "screen"
        return {"agent_id": agent_id, "confirm_cost": True,
                "confirmed_permissions": [p["scope"] for p in runtime.agent(agent_id)["capabilities"]["permissions"]],
                "confirmed_tools": service.agent_tools.allowed_tools(runtime.workflow(agent_id), manifest["capabilities"]["tools"]) if tools_enabled else [],
                "confirmed_limits": service._run_limits(manifest),
                **fields}

    def fake_job(self, output):
        def execute(row, _prompt, _images=None, target=None, persist=True):
            row["output"] = json.dumps(output, ensure_ascii=False)
        with mock.patch.object(runner, "_execute", side_effect=execute):
            self.assertTrue(runner.work_once())

    def screened_group(self):
        self.intake()
        request = self.confirmed("recruiter", action="screen", source={"kind": "demo", "group": "demo-1"})
        with self.assertRaises(service.ClientError) as caught:
            service._learning_run({**request, "confirm_cost": False})
        self.assertEqual(caught.exception.status, 409)
        estimate = service._learning_estimate(request)
        self.assertIsNotNone(estimate["estimate_usd"])
        self.assertEqual(estimate["kind"], "recruiter_screen")
        row = service._learning_run(request)["run"]
        target = runtime.read_json(Path(self.tmp.name) / "pending.json")["target"]
        ids = [r["id"] for r in target["rules"]]
        results = [{"candidate_id": item["id"], "verdict": "Invite" if n % 2 else "Reject",
                    "confidence": 20 + n * 8, "rule_ids": [ids[n % len(ids)]],
                    "rationale": "Relevant web portfolio and teamwork."}
                   for n, item in enumerate(target["candidates"])]
        self.fake_job({"results": results})
        self.assertEqual(runtime.run(row["id"])["status"], "completed")
        book = learning.get("recruiter")
        self.assertEqual(len(book["rounds"][0]["results"]), 8)
        self.assertTrue(all(c["fictional"] for c in book["rounds"][0]["candidates"]))
        self.assertEqual(service._stats("recruiter", runtime.runs(limit=None), {})["xp"], 0)
        return book, results

    def test_intake_fairness_and_one_group_screening(self):
        # Mobile "version" must not be mistaken for the protected Serbian
        # religion root "vera"/"verski".
        learning.reject_sensitive("Bez mobilne verzije web projekta ne pozivati.")
        learning.reject_sensitive("Five years of relevant web experience.")
        for trait in ("age", "young", "sex", "women", "men", "ethnicity", "religion", "photograph", "family status",
                      "dob", "spol", "žene", "muškarce", "etnicitet", "vjera", "fotografija", "porodični status"):
            with self.subTest(trait=trait), self.assertRaises(learning.LearningError):
                learning.reject_sensitive("Prefer candidates based on " + trait + ".")
        with self.assertRaises(service.ClientError) as caught:
            service.handle({"method": "POST", "path": "/learning/intake", "body": {"answers": {
                "role": "Designer", "requirements": "Must be under 30", "preferences": "Good Figma",
                "deal_breakers": "No portfolio", "team_style": "Collaboration"}}})
        self.assertIn("Rule rejected", caught.exception.detail)
        self.assertEqual(learning.get("recruiter")["versions"], [])
        book, results = self.screened_group()
        self.assertEqual(len(results), 8)
        self.assertEqual(book["versions"][0]["version"], 1)
        with self.assertRaises(service.ClientError):
            service._learning_run(self.confirmed("recruiter", action="screen", source={"kind": "demo", "group": "demo-1"}))

    def test_replay_all_decisions_regression_and_xp_only_from_net_gain(self):
        book, results = self.screened_group()
        rid = book["rounds"][0]["id"]
        for n, result in enumerate(results):
            choice = result["verdict"] if n != 0 else ("Invite" if result["verdict"] == "Reject" else "Reject")
            reason = "This portfolio shows transferable web skills." if n == 0 else ""
            service._learning_decision({"round_id": rid, "candidate_id": result["candidate_id"],
                                        "choice": choice, "reason": reason})
        before = learning.get("recruiter")
        self.assertEqual(learning.agreement(before)["initial"], 7)
        request = self.confirmed("recruiter", action="replay", mode="propose")
        row = service._learning_run(request)["run"]
        target = runtime.read_json(Path(self.tmp.name) / "pending.json")["target"]
        change = {"action": "add", "text": "Value evidence of transferable web skills.",
                  "source_decision_ids": [target["decisions"][0]["id"]]}
        predictions = [{"decision_id": d["id"], "before": d["agent_verdict"],
                        "after": d["choice"] if n == 0 else ("Reject" if d["choice"] == "Invite" else "Invite") if n == 1 else d["choice"]}
                       for n, d in enumerate(target["decisions"])]
        self.fake_job({"changes": [change], "predictions": predictions})
        proposal = learning.get("recruiter")["proposal"]
        self.assertEqual(proposal["replay"]["total"], 8)
        self.assertEqual(proposal["replay"]["before"], 7)
        self.assertEqual(proposal["replay"]["after"], 7)
        self.assertEqual(len(proposal["replay"]["fixed"]), 1)
        self.assertEqual(len(proposal["replay"]["broken"]), 1)
        self.assertTrue(proposal["replay"]["warnings"])
        accepted = service._learning_accept({"agent_id": "recruiter", "proposal_id": proposal["id"]})["learning"]
        self.assertEqual(accepted["agreement"]["xp"], 0)  # no XP for a run or net-zero replay
        self.assertEqual(accepted["versions"][-1]["version"], 2)
        # Restoring v1 also needs a full replay, rather than changing rules immediately.
        service._learning_run(self.confirmed("recruiter", action="replay", mode="restore", version=1))
        self.assertEqual(len(learning.get("recruiter")["versions"]), 2)

    def test_recruiter_reflects_after_a_screening_and_keeps_only_replay_safe_rules(self):
        book, results = self.screened_group()
        runner_row = {"id": "e" * 32, "agent_id": "recruiter", "kind": "recruiter_screen", "provider": "claude",
                      "model": "m", "effort": None, "tools": [], "timeline": [], "output": "",
                      "limits": {"max_steps": 6, "max_estimated_cost_usd": 2.0}, "cost_usd": 0.3}
        manifest = runtime.agent("recruiter")
        with mock.patch.object(runner, "sync_knowledge", return_value={"status": "off"}):
            runner._reflect_after(runner_row, {}, manifest)
        self.assertEqual(runner_row["learned"]["status"], "skipped")  # nothing decided yet
        rid = book["rounds"][0]["id"]
        for n, result in enumerate(results):
            choice = result["verdict"] if n else ("Invite" if result["verdict"] == "Reject" else "Reject")
            service._learning_decision({"round_id": rid, "candidate_id": result["candidate_id"], "choice": choice,
                                        "reason": "Transferable web skills." if n == 0 else ""})
        decisions = learning.get("recruiter")["decisions"]
        answer = {"worked": "Portfolio checks were useful.", "failed": "A transferable portfolio was missed.",
                  "changes": [{"action": "add", "text": "Value transferable web skills in a portfolio.",
                               "reason": "The owner overruled one verdict because of transferable skills."}],
                  "predictions": [{"decision_id": d["id"], "before": d["agent_verdict"],
                                   "after": d["choice"] if d["choice"] != d["agent_verdict"] else d["agent_verdict"]}
                                  for d in decisions]}

        def execute(ref, _prompt, _images=None, target=None, persist=True):
            ref["output"] = json.dumps(answer)
            ref["cost_usd"] = 0.04
        with mock.patch.object(runner, "_execute", side_effect=execute), \
                mock.patch.object(runner, "sync_knowledge", return_value={"status": "off"}):
            runner._reflect_after(runner_row, {}, manifest)
        self.assertEqual(runner_row["learned"]["status"], "learned", runner_row["learned"])
        book = learning.get("recruiter")
        self.assertEqual(len(book["versions"]), 2)
        self.assertTrue(book["versions"][-1]["auto"])
        self.assertTrue(book["reflected_signature"])
        # The same decisions are not reflected on twice.
        again = dict(runner_row, id="f" * 32)
        again.pop("learned")
        with mock.patch.object(runner, "sync_knowledge", return_value={"status": "off"}):
            runner._reflect_after(again, {}, manifest)
        self.assertEqual(again["learned"]["status"], "skipped")

    def test_protected_proposal_and_incomplete_replay_do_not_change_rules(self):
        book, results = self.screened_group()
        rid = book["rounds"][0]["id"]
        for result in results:
            service._learning_decision({"round_id": rid, "candidate_id": result["candidate_id"],
                                        "choice": result["verdict"], "reason": ""})
        service._learning_run(self.confirmed("recruiter", action="replay", mode="propose"))
        target = runtime.read_json(Path(self.tmp.name) / "pending.json")["target"]
        self.fake_job({"changes": [{"action": "add", "text": "Prefer younger candidates",
                                    "source_decision_ids": [target["decisions"][0]["id"]]}],
                       "predictions": []})
        self.assertEqual(runtime.runs(limit=None)[0]["status"], "failed")
        self.assertIsNone(learning.get("recruiter")["proposal"])
        self.assertEqual(len(learning.get("recruiter")["versions"]), 1)

    def test_reply_lesson_waits_for_acceptance_and_replays_prior_rating(self):
        rid = "a" * 32
        runtime.write_json(runtime.record_path("runs", rid), {"id": rid, "agent_id": "sentinel",
                           "status": "completed", "created_at": runtime.now(),
                           "output": "Report text", "target": "Example app"})
        service._feedback({"run_id": rid, "rating": "down", "note": "Too generic"})
        request = self.confirmed("sentinel", action="reply", run_id=rid,
                                 reply="Please cite exact source lines next time.")
        service._learning_run(request)
        target = runtime.read_json(Path(self.tmp.name) / "pending.json")["target"]
        self.assertEqual(len(target["decisions"]), 1)
        self.fake_job({"lesson": "I will cite exact source lines for every claim.",
                       "predictions": [{"decision_id": rid, "before": "down", "after": "up"}]})
        book = learning.get("sentinel")
        self.assertEqual(book["versions"], [])
        self.assertEqual(book["proposal"]["replay"]["fixed"], [rid])
        accepted = service._learning_accept({"agent_id": "sentinel", "proposal_id": book["proposal"]["id"]})["learning"]
        self.assertEqual(len(accepted["versions"]), 1)
        with mock.patch.object(runner, "_installed_source", return_value=("Example app", "source")):
            prompt, _, _ = runner._prompt(runtime.agent("sentinel"),
                {"source_kind": "installed", "app_id": 7, "bug_report": ""}, [])
        self.assertIn("I will cite exact source lines", prompt)

    def test_reply_replays_all_legacy_ratings_and_owner_can_decline(self):
        for n, rating in enumerate(("up", "down")):
            rid = ("b" if n == 0 else "c") * 32
            runtime.write_json(runtime.record_path("runs", rid), {"id": rid, "agent_id": "researcher",
                               "status": "completed", "created_at": runtime.now(),
                               "output": "A sourced report", "target": "Topic " + str(n)})
            # Simulate ratings that predate the versioned learning feature.
            runtime.write_json(runtime.record_path("feedback", rid),
                               {"run_id": rid, "agent_id": "researcher", "rating": rating,
                                "note": "Needs better sources"})
        request = self.confirmed("researcher", action="reply", run_id="b" * 32,
                                 reply="Use more specific citations.")
        estimate = service._learning_estimate(request)
        self.assertGreater(estimate["input_tokens"], 0)
        self.assertFalse(learning.get("researcher")["decisions"])  # estimate is read-only
        service._learning_run(request)
        target = runtime.read_json(Path(self.tmp.name) / "pending.json")["target"]
        self.assertEqual(len(target["decisions"]), 2)
        rows = [{"decision_id": item["id"], "before": item["source_rating"], "after": "up"}
                for item in target["decisions"]]
        self.fake_job({"lesson": "I will cite specific sources.", "predictions": rows})
        proposal = learning.get("researcher")["proposal"]
        self.assertEqual(proposal["replay"]["total"], 2)
        self.assertEqual(proposal["replay"]["fixed"], ["c" * 32])
        service._learning_decline({"agent_id": "researcher", "proposal_id": proposal["id"]})
        self.assertEqual(learning.get("researcher")["versions"], [])
        with self.assertRaises(service.ClientError):
            service._learning_accept({"agent_id": "researcher", "proposal_id": proposal["id"]})

    def test_rating_correction_invalidates_pending_replay(self):
        rid = "d" * 32
        runtime.write_json(runtime.record_path("runs", rid), {"id": rid, "agent_id": "researcher",
                           "status": "completed", "created_at": runtime.now(), "output": "A report", "target": "Topic"})
        service._feedback({"run_id": rid, "rating": "down", "note": "Missing source"})
        service._learning_run(self.confirmed("researcher", action="reply", run_id=rid,
                                             reply="Cite the evidence."))
        self.fake_job({"lesson": "I will cite each claim.",
                       "predictions": [{"decision_id": rid, "before": "down", "after": "up"}]})
        proposal_id = learning.get("researcher")["proposal"]["id"]
        service._feedback({"run_id": rid, "rating": "up", "note": "I checked the source"})
        self.assertIsNone(learning.get("researcher")["proposal"])
        with self.assertRaises(service.ClientError):
            service._learning_accept({"agent_id": "researcher", "proposal_id": proposal_id})

    def test_schema_documents_manifest_rules_decisions_replay_and_five_sentence_loop(self):
        source = Path(__file__).parent
        schema = json.loads((source / "agent.schema.json").read_text())
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema)
        for _, manifest_file, _ in runtime.BUILTINS:
            with self.subTest(manifest=manifest_file):
                validator.validate(json.loads((source / manifest_file).read_text()))
        recruiter = json.loads((source / "recruiter.json").read_text())
        self.assertTrue(recruiter["learning"]["requires_owner_approval"])
        self.assertEqual(recruiter["learning"]["replay"]["provider_calls"], 1)
        for name, value in (
            ("learningRule", {"id": "r1234abcd", "text": "Portfolio shows web work.", "sources": []}),
            ("learningDecision", {"id": "a" * 32, "choice": "Invite", "agent_verdict": "Reject", "reason": "Relevant work."}),
            ("learningReplay", {"total": 1, "before": 0, "after": 1, "fixed": ["a" * 32],
                                "broken": [], "warnings": [], "predictions": {"a" * 32: "Invite"}}),
        ):
            with self.subTest(record=name):
                Draft202012Validator({"$defs": schema["$defs"], "$ref": "#/$defs/" + name}).validate(value)
        readme = (source / "README.md").read_text()
        loop = readme.split("## Visible learning loop\n\n", 1)[1].split("\n\n## ", 1)[0].strip()
        self.assertEqual(len([sentence for sentence in loop.split(". ") if sentence]), 5)


if __name__ == "__main__":
    unittest.main()
