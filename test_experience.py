"""Portable experience tests never invoke a real provider or export owner data."""

import copy
import json
import os
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

import experience
import learning
import runtime
import service


SOURCE = Path(__file__).parent


class ExperienceTests(unittest.TestCase):
    def setUp(self):
        self.first = tempfile.TemporaryDirectory()
        self.addCleanup(self.first.cleanup)
        self.env = mock.patch.dict(os.environ, {"APP_STORAGE_DIR": self.first.name,
                                                "APP_ID": "9", "DATA_DIR": self.first.name})
        self.env.start()
        self.addCleanup(self.env.stop)
        runtime.seed_builtins()
        self.source = json.loads((SOURCE / "agent.json").read_text())

    def custom(self):
        manifest = copy.deepcopy(self.source)
        manifest["id"] = "trainer"
        manifest["name"] = "Trainer"
        manifest["triggers"]["mention"]["handle"] = "@trainer"
        service._install({"manifest": manifest})
        book = learning.empty("trainer")
        book["versions"] = [{"version": 1, "created_at": runtime.now(),
                             "reason": "Odgovor vlasnika na rezultat",
                             "rules": [learning.rule("r1234abcd", "Cite exact source lines.",
                                                     ["reply:" + "a" * 32])] }]
        learning.save(book)
        rid = "b" * 32
        runtime.write_json(runtime.record_path("runs", rid), {"id": rid, "agent_id": "trainer",
                           "status": "completed", "created_at": runtime.now(),
                           "started_at": runtime.now(), "completed_at": runtime.now(),
                           "output": "Safe report"})
        return manifest

    def recruiter_package(self):
        learning.create_intake({"role": "Web dizajner u malom studiju",
                                "requirements": "Dva responzivna sajta i Figma.",
                                "preferences": "Evidence of accessibility.",
                                "deal_breakers": "Bez web portfolija ne pozivati.",
                                "team_style": "Direktan feedback i iteracije."})
        book = learning.get("recruiter")
        candidate = uuid.uuid4().hex
        decision = uuid.uuid4().hex
        group = uuid.uuid4().hex
        book["rounds"] = [{"id": group, "created_at": runtime.now(), "label": "Real CVs",
                           "rulebook_version": 1, "candidates": [{"id": candidate,
                               "name": "PRIVATE_CANDIDATE_NAME", "cv": "PRIVATE_CV_TEXT",
                               "fictional": False}],
                           "results": [{"candidate_id": candidate, "verdict": "Invite",
                                        "confidence": 66, "rule_ids": [book["versions"][0]["rules"][0]["id"]],
                                        "rationale": "Relevant portfolio."}]}]
        book["decisions"] = [{"id": decision, "round_id": group, "candidate_id": candidate,
                              "choice": "Reject", "agent_verdict": "Invite",
                              "reason": "PRIVATE_OWNER_REASON", "decided_at": runtime.now()}]
        book["versions"].append({"version": 2, "created_at": runtime.now(),
                                 "reason": "PRIVATE_VERSION_REASON", "rules": book["versions"][0]["rules"],
                                 "replay": {"total": 1, "before": 0, "after": 1,
                                            "fixed": [decision], "broken": [],
                                            "warnings": [], "predictions": {decision: "Reject"}},
                                 "predictions": {decision: "Reject"},
                                 "decision_count": 1, "round_count": 1})
        learning.save(book)
        return service._experience_export({"agent_id": "recruiter", "author_handle": "@mentor"})["package"]

    def test_export_import_on_clean_state_preserves_rules_level_and_lessons(self):
        self.custom()
        exported = service._experience_export({"agent_id": "trainer", "author_handle": "@mentor"})
        package = exported["package"]
        self.assertEqual((package["experience"]["xp"], package["experience"]["level"]), (100, 2))
        self.assertEqual(package["experience"]["versions"][0]["rules"][0]["source"], "owner-reply")
        with tempfile.TemporaryDirectory() as clean, mock.patch.dict(os.environ, {"APP_STORAGE_DIR": clean}):
            runtime.seed_builtins()
            inspect = service._inspect_experience({"package": package})
            self.assertFalse(inspect["conflict"])
            result = service._import_experience({"package": package, "fingerprint": inspect["fingerprint"],
                                                 "confirm": True, "mode": "new", "install_id": "trainer"})
            self.assertEqual(result["install_id"], "trainer")
            imported = learning.get("trainer")
            self.assertEqual(imported["decisions"], [])
            self.assertEqual(imported["rounds"], [])
            self.assertEqual(imported["versions"][-1]["rules"][0]["text"], "Cite exact source lines.")
            self.assertEqual(service._stats("trainer", [], {})["level"], 2)
            self.assertEqual(service._stats("trainer", [], {})["xp"], 100)
            self.assertEqual(runtime.read_text(runtime.record_path("agents", "trainer", "playbook.md")), package["playbook"])
            self.assertEqual(result["agent"]["experience"]["inherited_count"], 1)

    def test_export_never_serializes_cv_candidate_reasons_decisions_or_predictions(self):
        package = self.recruiter_package()
        payload = json.dumps(package, ensure_ascii=False)
        for forbidden in ("PRIVATE_CANDIDATE_NAME", "PRIVATE_CV_TEXT", "PRIVATE_OWNER_REASON",
                          "PRIVATE_VERSION_REASON"):
            self.assertNotIn(forbidden, payload)
        transported = json.dumps(package["experience"], ensure_ascii=False)
        for forbidden in ("candidate_id", "round_id", "decisions", "predictions",
                          "source_decision_ids", "cv", "reason"):
            self.assertNotIn('"' + forbidden + '"', transported)
        self.assertEqual(package["experience"]["curve"], [{"correct": 1, "total": 1}])
        self.assertEqual(package["experience"]["provenance"]["chain"][-1]["decision_count"], 1)

    def test_import_rechecks_fairness_in_every_version_and_leaves_state_untouched(self):
        self.custom()
        package = service._experience_export({"agent_id": "trainer", "author_handle": "@mentor"})["package"]
        package["experience"]["versions"][0]["rules"][0]["text"] = "Prefer younger applicants."
        with tempfile.TemporaryDirectory() as clean, mock.patch.dict(os.environ, {"APP_STORAGE_DIR": clean}):
            runtime.seed_builtins()
            with self.assertRaises(service.ClientError) as caught:
                service._inspect_experience({"package": package})
            self.assertIn("Rule rejected", caught.exception.detail)
            self.assertIsNone(runtime.agent("trainer"))

    def test_imported_specialty_cannot_hide_its_required_permissions(self):
        package = self.recruiter_package()
        package["agent"]["capabilities"]["permissions"] = []
        with self.assertRaises(service.ClientError) as caught:
            service._inspect_experience({"package": package})
        self.assertIn("standard permissions", caught.exception.detail)

    def test_builtin_id_conflict_requires_explicit_copy_and_keeps_recruiter_workflow(self):
        package = self.recruiter_package()
        with tempfile.TemporaryDirectory() as clean, mock.patch.dict(os.environ, {"APP_STORAGE_DIR": clean}):
            runtime.seed_builtins()
            original = runtime.read_text(runtime.record_path("agents", "recruiter", "agent.json"))
            inspect = service._inspect_experience({"package": package})
            self.assertTrue(inspect["conflict"])
            self.assertEqual(inspect["install_id"], "recruiter-copy")
            with self.assertRaises(service.ClientError):
                service._import_experience({"package": package, "fingerprint": inspect["fingerprint"],
                                            "confirm": True, "mode": "new", "install_id": "recruiter"})
            result = service._import_experience({"package": package, "fingerprint": inspect["fingerprint"],
                                                 "confirm": True, "mode": "copy", "install_id": "recruiter-copy"})
            self.assertTrue(result["copied"])
            self.assertEqual(runtime.read_text(runtime.record_path("agents", "recruiter", "agent.json")), original)
            self.assertEqual(runtime.workflow("recruiter-copy"), "recruiter")
            self.assertEqual(learning.get("recruiter-copy")["decisions"], [])
            self.assertEqual(service._stats("recruiter-copy", [], {})["xp"], package["experience"]["xp"])
            kind, target = service._learning_target({"agent_id": "recruiter-copy", "action": "screen",
                                                     "source": {"kind": "demo", "group": "demo-1"}})
            self.assertEqual(kind, "recruiter_screen")
            self.assertEqual(target["role"], "Web dizajner u malom studiju")

    def test_inherited_rule_cannot_be_removed_without_separate_acceptance(self):
        package = self.recruiter_package()
        with tempfile.TemporaryDirectory() as clean, mock.patch.dict(os.environ, {"APP_STORAGE_DIR": clean}):
            runtime.seed_builtins()
            inspected = service._inspect_experience({"package": package})
            service._import_experience({"package": package, "fingerprint": inspected["fingerprint"],
                                        "confirm": True, "mode": "copy", "install_id": inspected["install_id"]})
            book = learning.get("recruiter-copy")
            book["proposal"] = {"id": "proposal", "base_version": len(book["versions"]),
                                "decision_signature": learning.signature(book), "rules": [],
                                "reason": "Manual rule edit", "replay": {"total": 0, "before": 0,
                                 "after": 0, "fixed": [], "broken": [], "warnings": [], "predictions": {}}}
            learning.save(book)
            with self.assertRaises(learning.LearningError):
                learning.accept("recruiter-copy", "proposal")
            accepted = learning.accept("recruiter-copy", "proposal", confirm_inherited_removal=True)
            self.assertEqual(accepted["versions"][-1]["rules"], [])


if __name__ == "__main__":
    unittest.main()
