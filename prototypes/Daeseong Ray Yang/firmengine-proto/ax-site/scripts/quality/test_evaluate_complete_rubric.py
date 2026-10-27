"""Synthetic-only tests for denominator integrity and fail-closed scoring."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from evaluate_complete_rubric import compare_values, evaluate

class CompleteEvaluatorTests(unittest.TestCase):
    def setUp(self):
        self.rubric = {
            "rubric_schema_version": "complete-content-rubric/v1",
            "evaluation_criteria": [
                {"criterion_id": "criterion-a", "mode": "exact", "expected": "SYNTHETIC", "target_document": "form-a"},
                {"criterion_id": "criterion-b", "mode": "blank", "expected": None, "target_document": "form-a"},
                {"criterion_id": "criterion-c", "mode": "redacted_presence", "expected": None, "target_document": "form-b"},
                {"criterion_id": "criterion-d", "mode": "trailing_marker_required", "expected": {"canonical_identity": "SYNTHETIC ENTITY", "marker_class": "synthetic-marker"}, "target_document": "form-b"},
                {"criterion_id": "criterion-e", "mode": "unresolved_uncertain", "expected": None, "target_document": "form-b"},
            ],
            "frozen_gold_checks": [
                {"id": "legacy-a", "scorable": True},
                {"id": "legacy-b", "scorable": False},
            ],
        }
        self.observations = {
            "observations": {
                "criterion-a": self.obs("present", "SYNTHETIC"),
                "criterion-b": self.obs("blank"),
                "criterion-c": self.obs("redacted"),
                "criterion-d": self.obs("present", "SYNTHETIC ENTITY <LEGAL>"),
                "criterion-e": self.obs("uncertain"),
            }
        }
        for criterion in self.rubric["evaluation_criteria"]:
            self.observations["observations"][criterion["criterion_id"]]["target_location"]["document"] = criterion["target_document"]
        self._tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tempdir.cleanup)
        self.rubric_path = Path(self._tempdir.name) / "rubric.json"
        self.rubric_path.write_text(json.dumps(self.rubric), encoding="utf-8")
        self.manifest = {
                "rubric_schema_version": "complete-content-rubric/v1",
                "rubric_sha256": hashlib.sha256(self.rubric_path.read_bytes()).hexdigest(),
                "expected_counts": {"criteria": 5, "frozen_gold_checks": 2, "scorable_checks": 1, "excluded_checks": 1},
                "normalizers": {"synthetic-marker": {"accepted_trailing_tokens": ["<LEGAL>"]}},
            }

    @staticmethod
    def obs(status, value=None):
        result = {"status": status, "target_location": {"document": "synthetic-doc", "section": "synthetic-section", "field": "synthetic-field"}}
        if value is not None:
            result["value"] = value
        return result

    def _evaluate(self, observations=None, manifest=None):
        return evaluate(self.rubric, observations or self.observations, manifest or self.manifest, self.rubric_path)

    def test_every_required_criterion_stays_in_denominator(self):
        report = self._evaluate()
        self.assertEqual(report["criteria_denominator"], 5)
        self.assertEqual(report["criteria_passed"], 4)
        self.assertEqual(report["criteria_failed"], 1)
        self.assertFalse(report["denominator_reduced"])
        self.assertEqual(report["failed_criterion_ids"], ["criterion-e"])

    def test_missing_and_unmapped_observations_fail_without_denominator_change(self):
        observations = {"observations": {"criterion-a": self.obs("unmapped")}}
        report = self._evaluate(observations)
        self.assertEqual(report["criteria_denominator"], 5)
        self.assertEqual(report["missing_observation_count"], 4)
        self.assertEqual(report["criteria_failed"], 5)
        self.assertFalse(report["denominator_reduced"])

    def test_integrity_hash_mismatch_fails_closed(self):
        manifest = dict(self.manifest, rubric_sha256="0" * 64)
        report = self._evaluate(manifest=manifest)
        self.assertFalse(report["integrity_pass"])
        self.assertIn("rubric_sha256_mismatch_or_missing", report["integrity_errors"])
        self.assertEqual(report["criteria_failed"], 5)

    def test_count_and_provenance_mismatches_are_reported(self):
        manifest = dict(self.manifest)
        manifest["expected_counts"] = dict(self.manifest["expected_counts"], criteria=4)
        manifest["provenance_requirements"] = {"evidence_pages_used": 3}
        observations = dict(self.observations, provenance={"evidence_pages_used": 2})
        report = self._evaluate(observations, manifest)
        self.assertFalse(report["integrity_pass"])
        self.assertIn("criteria_denominator_mismatch", report["integrity_errors"])
        self.assertIn("provenance_evidence_pages_used_mismatch", report["integrity_errors"])

    def test_required_office_validation_fails_closed(self):
        manifest = dict(self.manifest, require_physical_office_validation=True)
        report = self._evaluate(manifest=manifest)
        self.assertFalse(report["integrity_pass"])
        self.assertIn("physical_office_validation_failed_or_missing", report["integrity_errors"])

    def test_missing_target_location_fails(self):
        observations = {"observations": dict(self.observations["observations"])}
        observations["observations"]["criterion-a"] = {"status": "present", "value": "SYNTHETIC"}
        report = self._evaluate(observations)
        self.assertIn("criterion-a", report["failed_criterion_ids"])

    def test_same_value_in_wrong_document_cannot_satisfy_target(self):
        self.observations["observations"]["criterion-a"]["target_location"]["document"] = "raw-source-appendix"
        report = self._evaluate()
        self.assertIn("criterion-a", report["failed_criterion_ids"])
        self.assertEqual(report["criteria_denominator"], 5)

    def test_exact_json_comparison_does_not_conflate_boolean_and_money(self):
        self.assertFalse(compare_values(True, 1))
        self.assertFalse(compare_values({"amount": False}, {"amount": 0}))
        self.assertTrue(compare_values({"x": 1, "y": ["a", 0]}, {"y": ["a", 0], "x": 1}))

if __name__ == "__main__":
    unittest.main()
