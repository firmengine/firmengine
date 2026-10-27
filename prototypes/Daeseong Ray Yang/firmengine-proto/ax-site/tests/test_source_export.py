"""Synthetic path/rollback checks for source-only publication; no case data."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("source_export", Path(__file__).resolve().parents[1] / "scripts/export-reviewed-source.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class SourceExportTests(unittest.TestCase):
    def test_safe_source_paths_and_private_artifacts(self):
        for path in ("../outside", "/tmp/outside", "lib/../../outside", "lib//a.ts", "lib/./a.ts", "lib\\a.ts", "lib/uploads/facts.json", "docs/evaluation-private/gold.json", "scripts/run-sample-evaluation.py"):
            with self.subTest(path=path):
                self.assertFalse(exporter.safe_export_name(path))
        for path in ("lib/sample-manifest.ts", "app/evaluation/page.tsx", "tests/extraction.test.ts", ".openai/hosting.json"):
            self.assertTrue(exporter.safe_export_name(path))

    def test_symlink_manifest_and_parent_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); destination = root / "export"; destination.mkdir()
            external = root / "external"; external.write_text("untouched")
            (destination / "SOURCE_MANIFEST.json").symlink_to(external)
            with self.assertRaises(SystemExit): exporter.validate_manifest(destination / "SOURCE_MANIFEST.json", destination)
            (destination / "lib").symlink_to(root, target_is_directory=True)
            with self.assertRaises(SystemExit): exporter.contained_target(destination, "lib/external")
            self.assertEqual(external.read_text(), "untouched")

    def test_manifest_traversal_rejected_before_reading_target(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)
            item = {"path":"../outside", "sha256":"a"*64, "bytes":0, "mode":"100644"}
            manifest = {"schema":1, "destination":exporter.DESTINATION.as_posix(), "private_data_included":False, "files":[item]}
            path = destination / "SOURCE_MANIFEST.json"; path.write_text(json.dumps(manifest))
            with self.assertRaises(SystemExit): exporter.validate_manifest(path, destination)

    def test_partial_write_rolls_back_on_safety_abort(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory); (destination / "lib").mkdir()
            existing = destination / "lib/first.ts"; existing.write_bytes(b"old")
            real_replace = exporter.os.replace
            def replace(source, target):
                if str(target).endswith("second.ts"):
                    raise SystemExit("synthetic safety abort")
                return real_replace(source, target)
            manifest = {"mode_by_path":{}, "files":[]}
            with patch.object(exporter.os, "replace", side_effect=replace):
                with self.assertRaises(SystemExit):
                    exporter.write_transaction(destination, {"lib/first.ts":b"new", "lib/second.ts":b"second"}, manifest, {"lib/first.ts":exporter.sha(b"old")})
            self.assertEqual(existing.read_bytes(), b"old")
            self.assertFalse((destination / "lib/second.ts").exists())
            self.assertFalse(list(destination.glob(".export-stage-*")))


if __name__ == "__main__": unittest.main()
