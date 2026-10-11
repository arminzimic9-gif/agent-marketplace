"""The launch video is a declared, credited app asset that loads only on demand."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).parent
MANIFEST = json.loads((ROOT / "mobius.json").read_text())


class LaunchVideoTests(unittest.TestCase):
    def test_asset_is_declared_and_present(self):
        assets = MANIFEST["static_assets"]
        self.assertEqual(assets["launch-video.mp4"], "assets/launch-video.mp4")
        video = ROOT / assets["launch-video.mp4"]
        self.assertTrue(video.is_file())
        self.assertLess(video.stat().st_size, 16 * 1024 * 1024)
        self.assertEqual(video.read_bytes()[4:8], b"ftyp")  # real MP4 container

    def test_credit_and_licence_are_visible(self):
        credits = (ROOT / MANIFEST["static_assets"]["CREDITS.txt"]).read_text()
        for text in (credits, MANIFEST["store"]["description"], (ROOT / "README.md").read_text()):
            self.assertIn("Via Creativa Studio", text)
            self.assertIn("Gregor Quendel", text)
            self.assertIn("CC BY 4.0", text)

    def test_player_loads_lazily_and_closes(self):
        player = (ROOT / "launchvideo.jsx").read_text()
        index = (ROOT / "index.jsx").read_text()
        self.assertIn("launchvideo.jsx", MANIFEST["source_files"])
        self.assertIn("Watch launch video", index)
        # The <video> lives only inside the dialog, which mounts on demand.
        self.assertNotIn("<video", index)
        self.assertRegex(index, r"\{videoOpen && <LaunchVideo")
        self.assertIn("'Escape'", player)
        self.assertIn("aria-modal", player)
        self.assertIn("removeAttribute('src')", player)  # download dropped on close

    def test_public_source_limits(self):
        files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
        self.assertLessEqual(len(files) + 2, 250)
        total = sum((ROOT / f).stat().st_size for f in files if (ROOT / f).exists())
        self.assertLess(total + (ROOT / "assets/launch-video.mp4").stat().st_size, 64 * 1024 * 1024)
        self.assertLessEqual(len(MANIFEST["store"]["screenshots"]), 5)


if __name__ == "__main__":
    unittest.main()
