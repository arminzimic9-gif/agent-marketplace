"""Tool-bound execution tests. All provider processes here are local fakes."""

import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock

import agent_tools
import runner
import runtime
import service


class AgentToolTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patch = mock.patch.dict(os.environ, {"APP_STORAGE_DIR": self.tmp.name,
                                             "APP_ID": "9", "DATA_DIR": self.tmp.name})
        patch.start()
        self.addCleanup(patch.stop)
        runtime.seed_builtins()

    def test_manifest_allowlist_rejects_cross_agent_tool(self):
        names = agent_tools.allowed_tools("researcher", runtime.agent("researcher")["capabilities"]["tools"])
        self.assertIn("search_research", names)
        self.assertNotIn("write_patch", names)
        with self.assertRaisesRegex(ValueError, "outside this agent"):
            agent_tools.allowed_tools("researcher", [{"name": "write_patch"}])
        with self.assertRaisesRegex(ValueError, "Undeclared"):
            agent_tools.allowed_tools("researcher", [{"name": "shell"}])

    def test_mcp_rejects_forbidden_tools_and_honours_step_and_time_limits(self):
        root = Path(self.tmp.name)
        (root / "sample.py").write_text("x = 1\n")
        spec = {"workspace": str(root), "journal": str(root / "events.jsonl"),
                "workflow": "sentinel", "tools": ["record_plan", "read_evidence", "run_checks", "self_check"],
                "evidence": ["sample.py"], "allowed_urls": [], "max_steps": 3,
                "deadline": time.time() + 20}
        server = agent_tools.Server(spec)
        self.assertTrue(server.call("fetch_public_page", {"url": "https://example.com"})["isError"])
        self.assertTrue(server.call("run_checks", {})["isError"])
        self.assertNotIn("isError", server.call("record_plan", {"steps": ["Read", "Check"]}))
        self.assertNotIn("isError", server.call("run_checks", {}))
        self.assertNotIn("isError", server.call("self_check", {"summary": "Static syntax passed, dynamic behavior was not checked."}))
        self.assertIn("Step limit", server.call("read_evidence", {"name": "sample.py"})["content"][0]["text"])
        events = runner._journal_events(root / "events.jsonl")
        self.assertTrue(any(item["tool"] == "run_checks" and item["status"] == "completed" for item in events))
        spec["deadline"] = time.time() - 1
        expired = agent_tools.Server(spec)
        self.assertIn("time limit", expired.call("record_plan", {"steps": ["A"]})["content"][0]["text"])

    def test_provider_environment_has_no_app_or_owner_token(self):
        row = {"provider": "claude", "model": "claude-opus-5-5", "effort": "",
               "tools": ["record_plan", "self_check"], "limits": {"max_steps": 4, "max_estimated_cost_usd": 1.0}}
        with mock.patch.dict(os.environ, {"APP_TOKEN": "do-not-send", "AGENT_TOKEN": "do-not-send"}):
            _, env = runner._command(row)
        self.assertNotIn("APP_TOKEN", env)
        self.assertNotIn("AGENT_TOKEN", env)
        self.assertNotIn("do-not-send", json.dumps(env))

    def test_codex_only_auto_approves_the_confirmed_local_server(self):
        row = {"provider": "codex", "model": "gpt-6-sol", "effort": "",
               "tools": ["record_plan", "self_check"],
               "limits": {"max_steps": 4, "max_estimated_cost_usd": 1.0}}
        config = Path(self.tmp.name) / "mcp.json"
        config.write_text(json.dumps({"mcpServers": {"marketplace": {
            "command": sys.executable, "args": ["/tmp/owned-tool.py", "/tmp/owned-spec.json"]}}}))
        command, _ = runner._command(row, str(config))
        settings = {part.partition("=")[0].removeprefix("mcp_servers.marketplace."):
                    json.loads(part.partition("=")[2]) for part in command
                    if part.startswith("mcp_servers.marketplace.")}
        self.assertEqual(settings["enabled_tools"], row["tools"])
        self.assertEqual(settings["default_tools_approval_mode"], "auto")
        self.assertIn('approval_policy="never"', command)

    def test_stop_queued_and_running_fake_process(self):
        rid = "a" * 32
        row = {"id": rid, "agent_id": "researcher", "status": "queued", "created_at": runtime.now()}
        runtime.write_json(runtime.record_path("runs", rid), row)
        runtime.write_json(Path(self.tmp.name) / "pending.json", {"id": rid, "target": {"topic": "x"}})
        stopped = service._stop_run({"run_id": rid})["run"]
        self.assertEqual(stopped["status"], "stopped")
        self.assertFalse((Path(self.tmp.name) / "pending.json").exists())

        rid = "b" * 32
        row = {"id": rid, "agent_id": "researcher", "provider": "codex",
               "status": "running", "output": "", "usage": None, "cost_usd": None}
        runtime.write_json(runtime.record_path("runs", rid), row)
        script = "import time; time.sleep(30)"
        def stop():
            time.sleep(.2)
            service._stop_run({"run_id": rid})
        worker = threading.Thread(target=stop)
        worker.start()
        began = time.monotonic()
        with mock.patch.object(runner, "_command", return_value=([sys.executable, "-u", "-c", script], os.environ.copy())):
            with self.assertRaises(runner.StoppedByOwner):
                runner._execute(row, "fake prompt")
        worker.join()
        self.assertLess(time.monotonic() - began, 4)

    def test_real_journal_feeds_fake_provider_timeline(self):
        rid = "c" * 32
        manifest = runtime.agent("researcher")
        row = {"id": rid, "agent_id": "researcher", "provider": "codex", "model": "gpt-6-sol",
               "effort": "", "status": "running", "lessons_used": [], "output": "",
               "usage": None, "cost_usd": None,
               "tools": agent_tools.allowed_tools("researcher", manifest["capabilities"]["tools"]),
               "limits": service._run_limits(manifest)}
        runtime.write_json(runtime.record_path("runs", rid), row)
        script = ("import json,pathlib,time\n"
                  "p=pathlib.Path('tool-events.jsonl')\n"
                  "for name in ('record_plan','self_check'):\n"
                  " p.open('a').write(json.dumps({'tool':name,'description':name,'status':'completed','duration_seconds':0.01})+'\\n')\n"
                  " time.sleep(.15)\n"
                  "print(json.dumps({'type':'item.completed','item':{'type':'agent_message','text':'# Report\\nVerified'}}),flush=True)\n"
                  "print(json.dumps({'type':'turn.completed','usage':{'input_tokens':5,'output_tokens':4}}),flush=True)\n")
        with mock.patch.object(runner, "_command", return_value=([sys.executable, "-u", "-c", script], os.environ.copy())):
            runner._execute(row, "", target={"topic": "Agent reliability"})
        self.assertEqual(row["steps_used"], 2)
        self.assertEqual(row["tool_calls"], 2)
        self.assertEqual(len(row["timeline"]), 2)
        self.assertIn("Verified", row["output"])

    def test_provider_usage_stops_at_estimated_cost_cap(self):
        rid = "d" * 32
        manifest = runtime.agent("researcher")
        row = {"id": rid, "agent_id": "researcher", "provider": "codex", "model": "gpt-6-sol",
               "effort": "", "status": "running", "lessons_used": [], "output": "",
               "usage": None, "cost_usd": None,
               "tools": agent_tools.allowed_tools("researcher", manifest["capabilities"]["tools"]),
               "limits": {**service._run_limits(manifest), "max_estimated_cost_usd": 0.05}}
        runtime.write_json(runtime.record_path("runs", rid), row)
        script = ("import json\n"
                  "print(json.dumps({'type':'turn.completed','usage':{'input_tokens':100000,'output_tokens':0}}),flush=True)\n")
        with mock.patch.object(runner, "_command", return_value=([sys.executable, "-u", "-c", script], os.environ.copy())):
            with self.assertRaisesRegex(TimeoutError, "Estimated cost limit"):
                runner._execute(row, "", target={"topic": "Agent reliability"})


if __name__ == "__main__":
    unittest.main()
