"""No paid provider calls: exercise the real app service/job contracts with fakes."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

import runner
import runtime
import service


class MarketplaceRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        env = mock.patch.dict(os.environ, {
            "APP_STORAGE_DIR": self.tmp.name,
            "APP_ID": "9",
            "DATA_DIR": self.tmp.name,
        })
        env.start()
        self.addCleanup(env.stop)
        runtime.seed_builtins()
        self.choice = {"provider": "codex", "model": "test-model", "effort": "low"}

    def api(self, method, path, body=None, **_):
        if path == "/api/apps/":
            return [{"id": 7, "name": "Example app", "source_dir": "/data/apps/example"}]
        if path.endswith("/run-job"):
            return {"started_at": runtime.now()}
        if path.endswith("/job-context"):
            return {"primary": self.choice}
        if path.endswith("/schedule"):
            return body
        if path == "/api/models":
            return {"providers": {
                "claude": [{"id": "claude-opus-5-5", "label": "Claude Opus 5.5", "available": True},
                           {"id": "claude-sonnet-5-5", "label": "Claude Sonnet 5.5", "available": True}],
                "codex": [{"id": "gpt-6-sol", "label": "GPT-6-Sol", "available": True,
                           "effort_levels": ["low", "medium", "high"]}],
                "mobius": [{"id": "spark", "label": "Spark", "available": True}]}}
        raise AssertionError((method, path))

    def fake_execute(self, row, prompt, images=None, target=None, persist=True):
        row["output"] = (
            "Score: 82/100\n\n## Observed warnings\n"
            "index.jsx:2 may be implicated.\n\n## Recommended fixes\n"
            "Add a focused regression test."
        ) if row["agent_id"] == "sentinel" else "# Research report\n\n## Sources\nEvidence unavailable."
        runtime.write_json(runtime.record_path("runs", row["id"]), row)
        return row

    def contract(self, agent_id):
        manifest = runtime.agent(agent_id)
        return {"confirmed_tools": service.agent_tools.allowed_tools(runtime.workflow(agent_id), manifest["capabilities"]["tools"]),
                "confirmed_limits": service._run_limits(manifest)}

    def test_builtins_are_real_stored_files_and_triggers_default_off(self):
        for agent_id in ("sentinel", "researcher"):
            self.assertTrue(runtime.record_path("agents", agent_id, "agent.json").is_file())
            self.assertTrue(runtime.record_path("agents", agent_id, "playbook.md").is_file())
            self.assertFalse(runtime.config(agent_id)["cron"])
            self.assertFalse(runtime.config(agent_id)["mention"])
        self.assertFalse((Path(self.tmp.name) / "pending.json").exists())
        manifest = json.loads((Path(__file__).parent / "mobius.json").read_text())
        self.assertEqual(manifest["schedule"]["job"], "job.sh")
        self.assertNotIn("default", manifest["schedule"])

    def test_cost_and_exact_permissions_are_required_before_real_run(self):
        with mock.patch.object(service, "_job_locked", return_value=False), \
             mock.patch.object(service, "api", side_effect=self.api), \
             mock.patch.object(service, "_job_locked", return_value=False):
            body = {"agent_id": "sentinel", "source_kind": "installed",
                    "app_id": 7, "bug_report": "Save button loses edits."}
            with self.assertRaises(service.ClientError) as caught:
                service._run(body)
            self.assertEqual(caught.exception.status, 409)
            body.update({
                "confirm_cost": True,
                **self.contract("sentinel"),
                "confirmed_permissions": [
                    item["scope"] for item in runtime.agent("sentinel")["capabilities"]["permissions"]
                ],
            })
            created = service._run(body)["run"]
        self.assertEqual(created["status"], "queued")
        self.assertNotIn("bug_report", json.dumps(created))
        pending = runtime.read_json(Path(self.tmp.name) / "pending.json")
        self.assertEqual(pending["target"]["bug_report"], "Save button loses edits.")
        response = service.handle({"method": "GET", "path": f"runs/{created['id']}", "body": {}})
        self.assertEqual(response["run"]["id"], created["id"])

    def test_mention_tool_only_queues_an_unpaid_owner_request(self):
        payload = {"agent_id": "researcher", "topic": "Agent reliability"}
        with self.assertRaises(service.ClientError) as caught:
            service.handle({"method": "POST", "path": "/tools/request_agent",
                            "body": {"arguments": payload, "call": {"chat_id": "chat-a"}}})
        self.assertEqual(caught.exception.status, 409)
        with mock.patch.object(service, "api", side_effect=self.api):
            service._config({"agent_id": "researcher", "mention": True,
                             "confirm_automatic_cost": True})
        response = service.handle({"method": "POST", "path": "/tools/request_agent",
                                   "body": {"arguments": payload,
                                            "call": {"chat_id": "chat-a"}}})
        self.assertEqual(response["status"], "awaiting_confirmation")
        self.assertFalse((Path(self.tmp.name) / "pending.json").exists())
        pending = service._state()["pending_mentions"]
        self.assertEqual(len(pending), 1)
        self.assertNotIn("request", pending[0])
        with mock.patch.object(service, "_job_locked", return_value=False), \
             mock.patch.object(service, "api", side_effect=self.api), \
             mock.patch.object(service, "_job_locked", return_value=False):
            created = service._run({"agent_id": "researcher", "mention_id": pending[0]["id"],
                                    "confirm_cost": True,
                                    **self.contract("researcher"),
                                    "confirmed_permissions": [item["scope"] for item in runtime.agent("researcher")["capabilities"]["permissions"]]})
        self.assertEqual(created["run"]["status"], "queued")
        self.assertEqual(service._state()["pending_mentions"], [])
        self.assertEqual(runtime.read_json(Path(self.tmp.name) / "pending.json")["target"]["topic"], "Agent reliability")

    def test_event_stream_writes_real_incremental_progress_without_provider_cost(self):
        script = ("import json,sys\n"
                  "assert 'hello' in sys.stdin.read()\n"
                  "print(json.dumps({'type':'item.updated','item':{'type':'agent_message','text':'# First'}}), flush=True)\n"
                  "print(json.dumps({'type':'item.completed','item':{'type':'agent_message','text':'# First\\nSecond'}}), flush=True)\n"
                  "print(json.dumps({'type':'turn.completed','usage':{'input_tokens':5,'output_tokens':4}}), flush=True)\n")
        row = {"id": "b" * 32, "agent_id": "researcher", "provider": "codex",
               "output": "", "usage": None, "cost_usd": None}
        runtime.write_json(runtime.record_path("runs", row["id"]), row)
        with mock.patch.object(runner, "_command", return_value=([sys.executable, "-u", "-c", script], os.environ.copy())):
            runner._execute(row, "hello")
        self.assertEqual(row["output"], "# First\nSecond")
        self.assertEqual(row["usage"]["output_tokens"], 4)
        self.assertTrue(runtime.run(row["id"])["output"].startswith("# First"))

    def test_feedback_note_is_visible_and_injected_into_next_run(self):
        previous_id = "a" * 32
        runtime.write_json(runtime.record_path("runs", previous_id), {
            "id": previous_id, "agent_id": "sentinel", "status": "completed",
            "created_at": runtime.now(), "started_at": runtime.now(),
        })
        response = service._feedback({
            "run_id": previous_id, "rating": "down",
            "note": "Check the save path, not just the button.",
        })
        self.assertEqual(response["next_run_lessons"][0]["rating"], "down")
        with mock.patch.object(service, "_job_locked", return_value=False), \
             mock.patch.object(service, "api", side_effect=self.api), \
             mock.patch.object(service, "_job_locked", return_value=False):
            created = service._run({
                "agent_id": "sentinel", "source_kind": "installed", "app_id": 7,
                "bug_report": "Save button loses edits.", "confirm_cost": True,
                **self.contract("sentinel"),
                "confirmed_permissions": [
                    item["scope"] for item in runtime.agent("sentinel")["capabilities"]["permissions"]
                ],
            })["run"]
        self.assertIn("save path", created["lessons_used"][0]["note"])
        with mock.patch.object(runner, "_installed_source", return_value=("Example app", "### index.jsx\n   1 | code")):
            prompt, _, _ = runner._prompt(runtime.agent("sentinel"),
                                       runtime.read_json(Path(self.tmp.name) / "pending.json")["target"],
                                       created["lessons_used"])
        self.assertIn("Check the save path", prompt)
        self.assertIn("Save button loses edits.", prompt)
        with mock.patch.object(runner, "_installed_source", return_value=("Example app", "### index.jsx\n   1 | code")), \
             mock.patch.object(runner, "_execute", side_effect=self.fake_execute):
            self.assertTrue(runner.work_once())
        completed = runtime.run(created["id"])
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["score"], 82)
        self.assertFalse((Path(self.tmp.name) / "pending.json").exists())
        self.assertFalse((Path(self.tmp.name) / "active.json").exists())
        state = service._state()
        self.assertEqual(state["run_counts"]["sentinel"], 2)

    def test_store_repository_source_is_fetched_not_invented(self):
        def fake_read(_, url, limit, **_kwargs):
            if url.endswith("/commits/HEAD"):
                return json.dumps({"sha": "a" * 40}).encode()
            if url.endswith("mobius.json"):
                return json.dumps({"entry": "index.jsx", "source_files": ["helper.py"]}).encode()
            if url.endswith("index.jsx"):
                return b"export default function App() { return null }"
            if url.endswith("helper.py"):
                return b"def fixed():\n    return True\n"
            if url.endswith("README.md"):  # absent in this repo, as GitHub reports it
                raise urllib.error.HTTPError(url, 404, "Not Found", {}, None)
            raise AssertionError(url)
        with mock.patch.object(runner, "_github_read", side_effect=fake_read):
            label, source = runner._repo_source("https://github.com/example/app")
        self.assertEqual(label, "example/app")
        self.assertIn("helper.py", source)
        self.assertIn("return True", source)
        self.assertIn("index.jsx", source)
        self.assertIn("Pinned repository commit", source)

    def test_a_crashed_job_is_settled_and_does_not_block_the_next_run(self):
        crashed = "c" * 32
        runtime.write_json(runtime.record_path("runs", crashed), {
            "id": crashed, "agent_id": "researcher", "status": "running",
            "created_at": runtime.now(), "started_at": runtime.now(),
        })
        runtime.write_json(Path(self.tmp.name) / "active.json", {"id": crashed})
        fresh_pending = Path(self.tmp.name) / "pending.json"
        with mock.patch.object(service, "_job_locked", return_value=True):
            service.handle({"method": "GET", "path": "state", "body": {}})
        self.assertEqual(runtime.run(crashed)["status"], "running")  # live job: untouched
        service.handle({"method": "GET", "path": "state", "body": {}})
        self.assertEqual(runtime.run(crashed)["status"], "failed")
        self.assertFalse((Path(self.tmp.name) / "active.json").exists())
        with mock.patch.object(service, "_job_locked", return_value=False), \
             mock.patch.object(service, "api", side_effect=self.api), \
             mock.patch.object(service, "_job_locked", return_value=False):
            created = service._run({"agent_id": "researcher", "topic": "Agent reliability",
                                    "confirm_cost": True, "confirmed_permissions": [
                                        item["scope"] for item in runtime.agent("researcher")["capabilities"]["permissions"]],
                                    **self.contract("researcher")})
        service.handle({"method": "GET", "path": "state", "body": {}})
        self.assertTrue(fresh_pending.exists())  # a just-launched run is not abandoned
        old = time.time() - service.STALE_PENDING_SECONDS - 5
        os.utime(fresh_pending, (old, old))
        service.handle({"method": "GET", "path": "state", "body": {}})
        self.assertEqual(runtime.run(created["run"]["id"])["status"], "failed")
        self.assertFalse(fresh_pending.exists())

    def permissions(self, agent_id):
        return [item["scope"] for item in runtime.agent(agent_id)["capabilities"]["permissions"]]

    def test_each_agent_remembers_its_registry_model_defaulting_to_claude_opus(self):
        self.assertEqual(runtime.model_choice("researcher")["model"], "claude-opus-5-5")
        with mock.patch.object(service, "api", side_effect=self.api), \
             mock.patch.object(service, "_job_locked", return_value=False):
            service._model({"agent_id": "sentinel", "provider": "codex",
                            "model": "gpt-6-sol", "effort": "high"})
            for bad in ({"provider": "codex", "model": "gpt-unknown"},
                        {"provider": "mobius", "model": "spark"}):
                with self.assertRaises(service.ClientError):
                    service._model({"agent_id": "sentinel", **bad})
            created = service._run({"agent_id": "researcher", "topic": "Agent markets",
                                    "confirm_cost": True,
                                    **self.contract("researcher"),
                                    "confirmed_permissions": self.permissions("researcher")})["run"]
        self.assertEqual(runtime.model_choice("sentinel"),
                         {"provider": "codex", "model": "gpt-6-sol", "effort": "high"})
        self.assertEqual((created["provider"], created["model"]), ("claude", "claude-opus-5-5"))
        state = service._state()
        self.assertIn("design-critic", [item["manifest"]["id"] for item in state["agents"]])

    def test_design_critic_sends_uploaded_screenshots_as_images_without_tools(self):
        png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
        upload = "uploads/" + "d" * 32 + ".png"
        (Path(self.tmp.name) / "uploads").mkdir()
        (Path(self.tmp.name) / upload).write_bytes(png)
        with self.assertRaises(service.ClientError):
            service._target({"source_kind": "html", "code": "<h1>x</h1>",
                             "screenshots": [{"label": "desktop", "path": "../secret.png"}]}, "design-critic")
        target = service._target({"source_kind": "html", "code": "<h1>Hi</h1><style>h1{}</style>",
                                  "focus": "Hero type", "screenshots": [{"label": "desktop", "path": upload}]},
                                 "design-critic")
        prompt, _, images = runner._prompt(runtime.agent("design-critic"), target, [])
        self.assertIn("Image 1: desktop screenshot", prompt)
        self.assertIn("Typography", prompt)
        self.assertEqual(images[0]["media_type"], "image/png")
        row = {"provider": "claude", "model": "claude-opus-5-5", "effort": ""}
        cmd, _ = runner._command(row)
        self.assertEqual(cmd[cmd.index("--tools") + 1], "")
        self.assertIn("--restricted", cmd)
        payload = json.loads(runner._stdin_payload("claude", prompt, images, self.tmp.name, cmd))
        kinds = [block["type"] for block in payload["message"]["content"]]
        self.assertEqual(kinds, ["text", "image"])
        codex, _ = runner._command({"provider": "codex", "model": "gpt-6-sol", "effort": ""})
        runner._stdin_payload("codex", prompt, images, self.tmp.name, codex)
        self.assertEqual(codex[-1], "-")
        self.assertTrue(codex[-2].startswith("--image="))

    def test_design_critic_scores_rubric_and_verdict(self):
        row = {"output": ("Overall: 6.5/10\nVerdict: Mixed — strong world, generic chrome.\n\n## Rubric\n"
                          "| Area | Score | Evidence |\n|---|---|---|\n| Typography | 6/10 | x |\n"
                          "| **Motion** | 8/10 | y |\n| Mobile | 5.5/10 | z |\n")}
        runner._critic_scores(row)
        self.assertEqual(row["score"], 6.5)
        self.assertEqual(row["verdict"], "Mixed")
        self.assertEqual([item["area"] for item in row["rubric"]], ["Typography", "Motion", "Mobile"])
        with self.assertRaises(ValueError):
            runner._critic_scores({"output": "Looks nice."})

    def test_url_fetch_refuses_private_addresses(self):
        for host in ("localhost", "127.0.0.1", "10.0.0.5", "169.254.169.254"):
            with self.assertRaises(ValueError):
                runner._require_public_host(host)

    def test_character_stats_come_only_from_real_runs_and_ratings(self):
        state = service._state()
        ids = [item["manifest"]["id"] for item in state["agents"]]
        for new in ("bug-triage", "launch-writer", "seo-scout", "brief-builder"):
            self.assertIn(new, ids)
        fresh = next(item for item in state["agents"] if item["manifest"]["id"] == "seo-scout")["stats"]
        self.assertEqual((fresh["level"], fresh["xp"], fresh["accuracy"]), (1, 0, None))
        run_id = "e" * 32
        runtime.write_json(runtime.record_path("runs", run_id), {
            "id": run_id, "agent_id": "seo-scout", "status": "completed", "output": "x" * 5000,
            "created_at": "2026-10-04T10:00:00+00:00", "started_at": "2026-10-04T10:00:00+00:00",
            "completed_at": "2026-10-04T10:01:30+00:00", "cost_usd": 0.5})
        service._feedback({"run_id": run_id, "rating": "up", "note": "Rank by traffic impact."})
        state = service._state()
        stats = next(item for item in state["agents"] if item["manifest"]["id"] == "seo-scout")["stats"]
        self.assertEqual(stats["xp"], 175)
        self.assertEqual(stats["level"], 2)
        self.assertEqual((stats["accuracy"], stats["avg_seconds"], stats["avg_cost_usd"], stats["lessons"]), (1.0, 90.0, 0.5, 1))
        self.assertNotIn("output", state["runs"][0])
        self.assertEqual(state["runs"][0]["output_chars"], 5000)
        self.assertEqual([service.level_for(x) for x in (0, 99, 100, 399, 400, 900)], [1, 1, 2, 2, 3, 4])

    def test_new_agents_accept_their_real_inputs(self):
        with mock.patch.object(service, "api", side_effect=self.api):
            triage = service._target({"source_kind": "social", "reports": "A: crash\nB: same crash", "app_id": 7}, "bug-triage")
            self.assertIn("Example app", triage["label"])
            launch = service._target({"source_kind": "description", "description": "Habit app", "voice": "Short."}, "launch-writer")
            self.assertEqual(launch["voice"], "Short.")
        self.assertEqual(service._target({"source_kind": "html", "code": "<title>x</title>"}, "seo-scout")["source_kind"], "html")
        self.assertIn("Client message", service._target({"message": "Need a 3D site by May"}, "brief-builder")["label"])
        with self.assertRaises(service.ClientError):
            service._target({"source_kind": "url", "url": "http://insecure.example"}, "seo-scout")
        prompt, _, _ = runner._prompt(runtime.agent("brief-builder"), {"message": "Budget 5k, launch in June"}, [])
        self.assertIn("Budget 5k", prompt)
        self.assertIn("Via Creativa", prompt)

    def test_seo_facts_are_extracted_before_the_provider_sees_the_page(self):
        facts = runner._seo_facts(
            '<html lang="en"><head><title>Hi</title><meta name="description" content="Desc">'
            '<link rel="canonical" href="https://x.test/"><script src="a.js"></script>'
            '<script type="application/ld+json">{"@type":"Organization"}</script></head>'
            '<body><h1>Main</h1><h2>Sub</h2><img src="a.png"><img src="b.png" alt="b" width="1" height="1" loading="lazy"></body></html>')
        self.assertEqual((facts["title"], facts["lang"], facts["meta"]["description"]), ("Hi", "en", "Desc"))
        self.assertEqual(facts["headings"], ["h1: Main", "h2: Sub"])
        self.assertEqual(facts["json_ld_types"], ["Organization"])
        self.assertEqual((facts["images"], facts["images_no_alt"], facts["images_no_size"], facts["images_lazy"]), (2, 1, 1, 1))
        self.assertEqual(facts["blocking_scripts"], 1)
        icon = runner._seo_facts('<html><head><title>Real title</title></head><body><svg><title>Messages</title></svg>'
                                 '<style>' + 'x' * 50000 + '</style><h1>Body</h1></body></html>')
        self.assertEqual(icon["title"], "Real title")
        self.assertIn("<h1>Body</h1>", runner._markup_excerpt('<style>' + 'x' * 50000 + '</style><h1>Body</h1>'))
        # The excerpt holds 60,000 characters of markup: content 50k in is kept, the tail is cut.
        long_page = '<main>' + '<p>filler</p>' * 3846 + '<h2>Deep</h2>' + 'y' * 20000 + '</main>'
        excerpt = runner._markup_excerpt(long_page)
        self.assertEqual(len(excerpt), runner.SEO_EXCERPT_CHARS)
        self.assertIn("<h2>Deep</h2>", excerpt)
        # SVG drawing data is dropped; the tag, its accessible label and <title> stay.
        icons = runner._markup_excerpt('<svg aria-label="Search" role="img"><title>Search</title>'
                                       '<path d="' + 'M0 0L1 1 ' * 5000 + '"/></svg><h1>After icons</h1>')
        self.assertIn('<svg aria-label="Search" role="img"><title>Search</title>', icons)
        self.assertNotIn("<path", icons)
        self.assertIn("drawing data omitted", icons)
        self.assertIn("<h1>After icons</h1>", icons)

    def test_superpowers_must_name_declared_scopes(self):
        service._validate_character({"class": "Guardian", "sprite_seed": 1, "palette": {
            "primary": "#000000", "secondary": "#111111", "accent": "#222222", "skin": "#333333"},
            "superpowers": [{"name": "Sight", "scope": "web.fetch", "description": "Fetch"},
                            {"name": "Forge", "scope": None, "description": "Output"}]}, {"web.fetch"})
        with self.assertRaises(service.ClientError):
            service._validate_character({"class": "Guardian", "sprite_seed": 1, "palette": {
                "primary": "#000000", "secondary": "#111111", "accent": "#222222", "skin": "#333333"},
                "superpowers": [{"name": "Root", "scope": "shell.exec", "description": "x"}]}, {"web.fetch"})

    def test_builtins_follow_the_bundled_definition_but_keep_owner_config(self):
        path = runtime.record_path("agents", "sentinel", "agent.json")
        runtime.write_text(path, json.dumps({**runtime.agent("sentinel"), "name": "Stale"}))
        runtime.write_json(runtime.record_path("agents", "sentinel", "config.json"),
                           {"mention": False, "cron": False, "model": {"provider": "codex", "model": "gpt-6-sol"}})
        runtime.seed_builtins()
        self.assertEqual(runtime.agent("sentinel")["character"]["class"], "Guardian")
        self.assertEqual(runtime.model_choice("sentinel")["provider"], "codex")

    def test_schedule_and_mentions_need_separate_automatic_cost_confirmation(self):
        with mock.patch.object(service, "api", side_effect=self.api):
            with self.assertRaises(service.ClientError) as caught:
                service._config({
                    "agent_id": "researcher", "cron": True,
                    "scheduled_request": {"topic": "Accessible web apps"},
                })
            self.assertEqual(caught.exception.status, 409)
            updated = service._config({
                "agent_id": "researcher", "cron": True,
                "scheduled_request": {"topic": "Accessible web apps"},
                "confirm_automatic_cost": True,
            })
        self.assertTrue(updated["config"]["cron"])
        self.assertEqual(updated["config"]["scheduled_request"]["topic"], "Accessible web apps")
        service._config({"agent_id": "researcher", "cron": False})
        self.assertFalse(runtime.config("researcher")["cron"])


if __name__ == "__main__":
    unittest.main()
