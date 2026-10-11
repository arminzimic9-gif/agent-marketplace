"""Trigger admission is unpaid until an owner confirms a specific run."""

import os
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest import mock

import runner
import runtime
import service


class TriggerRequestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patch = mock.patch.dict(os.environ, {"APP_STORAGE_DIR": self.tmp.name,
                                             "APP_ID": "9", "DATA_DIR": self.tmp.name})
        patch.start()
        self.addCleanup(patch.stop)
        runtime.seed_builtins()

    def test_new_cv_is_private_and_never_starts_model_by_itself(self):
        manifest = runtime.agent("recruiter")
        self.assertFalse(runtime.config("recruiter")["cv_inbox"])
        saved = service._inbox_add({"agent_id": "recruiter", "text": "Fictional designer CV"}, "cv")["item"]
        self.assertEqual(saved["status"], "saved")
        self.assertNotIn("Fictional designer", str(service._inbox_list()))
        self.assertFalse((Path(self.tmp.name) / "pending.json").exists())
        service._config({"agent_id": "recruiter", "cv_inbox": True})
        waiting = service._inbox_add({"agent_id": "recruiter", "text": "Second fictional CV"}, "cv")["item"]
        self.assertEqual(waiting["status"], "awaiting_confirmation")
        self.assertFalse((Path(self.tmp.name) / "pending.json").exists())
        self.assertFalse(runtime.runs())
        self.assertIn("fetch_public_page", service._public_agent(manifest)["run_tools"])

    def test_bug_inbox_and_schedule_only_queue_unpaid_requests(self):
        self.assertFalse(runtime.config("sentinel")["bug_inbox"])
        service._config({"agent_id": "sentinel", "bug_inbox": True})
        with mock.patch.object(service, "_target", return_value={"source_kind": "installed", "app_id": 4}):
            saved = service._inbox_add({"agent_id": "sentinel", "source_kind": "installed",
                                        "app_id": 4, "bug_report": "Save button fails"}, "bug")["item"]
        self.assertEqual(saved["status"], "awaiting_confirmation")
        waiting = service._state()["pending_mentions"]
        self.assertEqual(waiting[0]["kind"], "bug_inbox")
        self.assertFalse(runtime.runs())

        cfg = runtime.config("researcher")
        now = datetime.now(UTC)
        cfg.update(cron=True, time=now.strftime("%H:%M"), timezone="UTC",
                   scheduled_request={"topic": "Interesting topic", "label": "Interesting topic"})
        runtime.write_json(runtime.record_path("agents", "researcher", "config.json"), cfg)
        with runtime.locked():
            self.assertTrue(runner._scheduled_request())
            self.assertFalse(runner._scheduled_request())
        waiting = service._state()["pending_mentions"]
        self.assertTrue(any(item["kind"] == "schedule" for item in waiting))
        self.assertFalse(runtime.runs())
        self.assertFalse((Path(self.tmp.name) / "pending.json").exists())


if __name__ == "__main__":
    unittest.main()
