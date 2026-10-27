#!/usr/bin/env python3
"""Fail-closed scorer for a private, complete-content rubric.

This utility never extracts data from Office files and never searches raw
appendices. A separately reviewed adapter must map intended document locations
into the observations input. Missing mappings stay in the rubric denominator.
Only standard-library modules are used.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
import unicodedata
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

SUPPORTED_MODES = {
    "exact", "presence_only", "blank", "redacted_presence",
    "unresolved_uncertain", "exact_with_normalization",
    "trailing_marker_required",
}


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def canonical_text(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value)).casefold()
    return re.sub(r"[\s,()（）·.\-_]", "", text)


def numeric(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    text = str(value).replace(",", "").strip()
    if not re.fullmatch(r"[-+]?\d+(?:\.\d+)?", text):
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def compare_values(actual: Any, expected: Any, comparison: dict[str, Any] | None = None) -> bool:
    """Compare with only rubric-declared transformations; default is exact JSON equality."""
    comparison = comparison or {"type": "exact"}
    kind = comparison.get("type", "exact")
    if kind == "exact":
        try:
            return json.dumps(actual, sort_keys=True, ensure_ascii=False, allow_nan=False) == json.dumps(expected, sort_keys=True, ensure_ascii=False, allow_nan=False)
        except (TypeError, ValueError):
            return False
    if kind == "canonical_text":
        return canonical_text(actual) == canonical_text(expected)
    if kind == "number":
        left, right = numeric(actual), numeric(expected)
        return left is not None and right is not None and left == right
    if kind == "casefold":
        return isinstance(actual, str) and isinstance(expected, str) and actual.casefold() == expected.casefold()
    if kind == "date_format_set":
        # A date adapter must provide a normalized ISO-like comparison value.
        return actual == expected
    raise ValueError(f"Unsupported comparison type: {kind}")


def _criterion_id(criterion: dict[str, Any]) -> str:
    value = criterion.get("criterion_id", criterion.get("id"))
    if not isinstance(value, str) or not value:
        raise ValueError("Every criterion must have a non-empty criterion_id or id")
    return value


def validate_inputs(rubric: dict[str, Any], observations: dict[str, Any], manifest: dict[str, Any], rubric_path: str | Path) -> list[str]:
    errors: list[str] = []
    actual_hash = sha256_file(rubric_path)
    expected_hash = manifest.get("rubric_sha256")
    if not expected_hash or actual_hash != expected_hash:
        errors.append("rubric_sha256_mismatch_or_missing")

    criteria = rubric.get("evaluation_criteria")
    if not isinstance(criteria, list):
        errors.append("evaluation_criteria_missing_or_invalid")
        criteria = []
    ids: list[str] = []
    for criterion in criteria:
        try:
            ids.append(_criterion_id(criterion))
        except (TypeError, ValueError):
            errors.append("invalid_criterion_id")
            continue
        if criterion.get("mode") not in SUPPORTED_MODES:
            errors.append("unsupported_criterion_mode")
        if not isinstance(criterion.get("target_document"), str) or not criterion["target_document"].strip():
            errors.append("criterion_target_document_missing")
        if criterion.get("mode") in ("exact", "exact_with_normalization", "trailing_marker_required") and "expected" not in criterion:
            errors.append("criterion_expectation_missing")
    if len(set(ids)) != len(ids):
        errors.append("duplicate_criterion_ids")

    expected_counts = manifest.get("expected_counts", {})
    if expected_counts.get("criteria") is not None and len(criteria) != expected_counts["criteria"]:
        errors.append("criteria_denominator_mismatch")
    checks = rubric.get("frozen_gold_checks", rubric.get("checks"))
    if expected_counts.get("frozen_gold_checks") is not None:
        if not isinstance(checks, list) or len(checks) != expected_counts["frozen_gold_checks"]:
            errors.append("frozen_gold_check_count_mismatch")
        else:
            scorable = sum(check.get("scorable") is True for check in checks)
            excluded = len(checks) - scorable
            if expected_counts.get("scorable_checks") is not None and scorable != expected_counts["scorable_checks"]:
                errors.append("scorable_check_count_mismatch")
            if expected_counts.get("excluded_checks") is not None and excluded != expected_counts["excluded_checks"]:
                errors.append("excluded_check_count_mismatch")

    schema = rubric.get("rubric_schema_version")
    if manifest.get("rubric_schema_version") and schema != manifest["rubric_schema_version"]:
        errors.append("rubric_schema_version_mismatch")
    return errors


def _valid_target_location(observation: dict[str, Any]) -> bool:
    location = observation.get("target_location")
    return isinstance(location, dict) and bool(location.get("document")) and bool(location.get("section")) and (
        location.get("field") is not None or location.get("row") is not None or location.get("paragraph") is not None
    )


def _score_one(criterion: dict[str, Any], observation: Any, manifest: dict[str, Any]) -> tuple[bool, str]:
    if not isinstance(observation, dict):
        return False, "missing_or_unmapped"
    status = observation.get("status")
    if status in ("missing", "unmapped", "uncertain"):
        return False, status
    if not _valid_target_location(observation):
        return False, "target_location_unmapped"
    if observation["target_location"]["document"] != criterion.get("target_document"):
        return False, "target_document_mismatch"

    mode = criterion["mode"]
    if mode == "presence_only":
        return (status in ("present", "blank", "redacted"), "slot_present" if status in ("present", "blank", "redacted") else "slot_missing")
    if mode == "blank":
        return (status == "blank", "blank_match" if status == "blank" else "not_blank")
    if mode == "redacted_presence":
        return (status == "redacted", "redaction_state_present" if status == "redacted" else "redaction_state_missing")
    if mode == "unresolved_uncertain":
        return False, "uncertain_expectation_fails_closed"
    if mode in ("exact", "exact_with_normalization"):
        if status != "present":
            return False, "wrong_state"
        comparison = criterion.get("comparison", {"type": "exact"}) if mode == "exact_with_normalization" else {"type": "exact"}
        try:
            okay = compare_values(observation.get("value"), criterion.get("expected"), comparison)
        except ValueError:
            return False, "unsupported_comparison"
        return okay, "value_match" if okay else "wrong_value"
    if mode == "trailing_marker_required":
        if status != "present" or not isinstance(observation.get("value"), str):
            return False, "wrong_state"
        expected = criterion.get("expected", {})
        marker_class = expected.get("marker_class")
        normalizers = manifest.get("normalizers", {})
        spec = normalizers.get(marker_class, {})
        tokens = spec.get("accepted_trailing_tokens", [])
        candidate = observation["value"]
        marker = next((token for token in tokens if token and candidate.endswith(token)), None)
        if marker is None:
            return False, "required_surface_marker_missing"
        identity = candidate[:-len(marker)].rstrip()
        comparison = expected.get("identity_comparison", {"type": "exact"})
        okay = compare_values(identity, expected.get("canonical_identity"), comparison)
        return okay, "identity_and_surface_marker_match" if okay else "identity_mismatch"
    return False, "unsupported_criterion_mode"


def _check_provenance(observations: dict[str, Any], manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    expected = manifest.get("provenance_requirements", {})
    actual = observations.get("provenance", {})
    for key in ("source_sha256", "evidence_pages_used", "holdout_pages_in_input"):
        expected_value = expected.get(key)
        if expected_value is not None and actual.get(key) != expected_value:
            errors.append(f"provenance_{key}_mismatch")
    required_pages = expected.get("exact_holdout_page_list")
    if required_pages is not None and actual.get("holdout_pages_in_input") != required_pages:
        errors.append("provenance_holdout_page_list_mismatch")
    if manifest.get("require_physical_office_validation"):
        validation = observations.get("artifact_validation", {})
        if validation.get("all_outputs_opened") is not True or validation.get("all_outputs_valid") is not True:
            errors.append("physical_office_validation_failed_or_missing")
        if validation.get("validation_errors"):
            errors.append("physical_office_validation_reports_errors")
    return errors


def evaluate(rubric: dict[str, Any], observations: dict[str, Any], manifest: dict[str, Any], rubric_path: str | Path) -> dict[str, Any]:
    integrity_errors = validate_inputs(rubric, observations, manifest, rubric_path)
    integrity_errors.extend(_check_provenance(observations, manifest))
    criteria = rubric.get("evaluation_criteria", [])
    raw_observations = observations.get("observations", {})
    if not isinstance(raw_observations, dict):
        raw_observations = {}
        integrity_errors.append("observations_map_invalid")

    outcomes = []
    for criterion in criteria:
        cid = _criterion_id(criterion)
        passed, reason = _score_one(criterion, raw_observations.get(cid), manifest)
        outcomes.append({
            "criterion_id": cid,
            "target_document": criterion.get("target_document"),
            "source_page": criterion.get("source_page"),
            "passed": bool(passed and not integrity_errors),
            "reason": reason if not integrity_errors else "input_integrity_failed",
            "mode": criterion.get("mode"),
        })
    groups: dict[str, dict[str, Any]] = {}
    for outcome in outcomes:
        doc = outcome.get("target_document") or "UNMAPPED_TARGET_DOCUMENT"
        group = groups.setdefault(doc, {"required": 0, "passed": 0, "failed": 0, "failed_criterion_ids": []})
        group["required"] += 1
        if outcome["passed"]:
            group["passed"] += 1
        else:
            group["failed"] += 1
            group["failed_criterion_ids"].append(outcome["criterion_id"])
    count = len(outcomes)
    passed = sum(item["passed"] for item in outcomes)
    seen = raw_observations.keys()
    required_ids = {_criterion_id(c) for c in criteria}
    missing_ids = sorted(required_ids - set(seen))
    extra_ids = sorted(set(seen) - required_ids)
    all_valid = not integrity_errors
    return {
        "schema_version": "complete-content-evaluation-report/v1",
        "integrity_pass": all_valid,
        "integrity_errors": integrity_errors,
        "criteria_denominator": count,
        "criteria_passed": passed,
        "criteria_failed": count - passed,
        "criterion_accuracy": (passed / count) if count else 0.0,
        "denominator_reduced": False,
        "missing_observation_count": len(missing_ids),
        "missing_criterion_ids": missing_ids,
        "extra_observation_count": len(extra_ids),
        "extra_observation_ids_ignored": extra_ids,
        "target_documents": groups,
        "all_documents_pass": bool(groups) and all(item["failed"] == 0 for item in groups.values()) and all_valid,
        "failed_criterion_ids": [item["criterion_id"] for item in outcomes if not item["passed"]],
        "values_suppressed": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rubric", required=True, help="Private rubric JSON path; never commit this file")
    parser.add_argument("--observations", required=True, help="Adapter-produced observation map JSON path")
    parser.add_argument("--manifest", required=True, help="Private run manifest JSON path")
    parser.add_argument("--report", required=True, help="Report output path")
    args = parser.parse_args()
    try:
        rubric = json.loads(Path(args.rubric).read_text(encoding="utf-8"))
        observations = json.loads(Path(args.observations).read_text(encoding="utf-8"))
        manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
        report = evaluate(rubric, observations, manifest, args.rubric)
        Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return 0 if report["integrity_pass"] else 2
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        # Never print the contents of private input files.
        print(f"evaluation failed: {type(exc).__name__}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
