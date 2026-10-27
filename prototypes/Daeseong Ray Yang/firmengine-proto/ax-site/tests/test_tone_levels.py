import importlib.util
from pathlib import Path
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def load_runner(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

synthetic = load_runner("synthetic_eval", "run-synthetic-ocr-evaluation.py")
# The original-case driver is intentionally excluded from the public export.
# When present privately, exercise it against the same public pixel contract.
sample_path = ROOT / "scripts" / "run-sample-evaluation.py"
sample = load_runner("sample_eval", sample_path.name) if sample_path.is_file() else None
runners = [synthetic] + ([sample] if sample is not None else [])

class LumaLevelsParityTest(unittest.TestCase):
    def test_fixed_rgb_pixels_match_the_shared_js_reference_vectors(self):
        source = Image.new("RGB", (7, 1))
        source.putdata([(0, 0, 0), (176, 176, 176), (208, 208, 208), (220, 220, 220), (235, 235, 235), (252, 252, 252), (230, 250, 220)])
        expected = [(32, 32, 32), (32, 32, 32), (120, 120, 120), (152, 152, 152), (193, 193, 193), (240, 240, 240), (210, 210, 210)]
        for runner in runners:
            transformed = runner.apply_luma_levels_v2(source)
            self.assertEqual(list(transformed.getdata()), expected)
            self.assertEqual(transformed.mode, "RGB")
            transformed.close()
        source.close()

    def test_legacy_classification_plan_stays_neutral_and_new_plan_tones_only_full_rotated_view(self):
        old = {"reason": "classification_unknown", "boxes": [[0, 0, 1, .45]]}
        new = {**old, "recipeVersion": "luma-levels-v2"}
        for runner in runners:
            self.assertEqual([s["tone"] for s in runner.rescue_specs(old)], ["neutral", "neutral"])
            self.assertEqual([s["tone"] for s in runner.rescue_specs(new)], ["neutral", "luma-levels-v2"])
            self.assertEqual([s["recipeVersion"] for s in runner.rescue_specs(old)], ["neutral-v1", "neutral-v1"])
            self.assertEqual([s["bbox"] for s in runner.rescue_specs(new)], [[0, 0, 1, .45], [0, 0, 1, 1]])
            self.assertEqual([s["rotation"] for s in runner.rescue_specs(new)], [0, 90])

if __name__ == "__main__":
    unittest.main()
