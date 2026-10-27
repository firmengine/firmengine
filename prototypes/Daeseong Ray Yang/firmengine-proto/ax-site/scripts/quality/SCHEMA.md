# Complete-content evaluator

This directory contains generic evaluation code only. Keep all case-specific rubrics, source data, observations, manifests, generated files, and reports outside the repository. The evaluator does not OCR or extract Office content. An independent adapter must map the intended target-document locations to observation records. It must not search raw appendices or promote unrelated facts into target fields.

## Inputs

Invoke the CLI with three external JSON files: a rubric, an observations map, and a manifest. The evaluator writes a fourth, value-suppressed report file.

```sh
python scripts/quality/evaluate_complete_rubric.py \
  --rubric /private/path/rubric.json \
  --observations /private/path/observations.json \
  --manifest /private/path/manifest.json \
  --report /private/path/report.json
```

The program exits `0` only when input integrity checks pass. It exits `2` for an integrity or input failure. Missing and unmapped criteria are scored as failures without reducing the denominator.

## Rubric schema

The rubric is a JSON object with:

- `rubric_schema_version`: string.
- `evaluation_criteria`: array of required criteria. Every entry has a unique `criterion_id` (or `id`), `mode`, `expected` where applicable, and optionally `target_document`, `source_page`, and `comparison`.
- `frozen_gold_checks` or `checks`: optional legacy check list. If the manifest supplies baseline counts, those counts are verified against this list and its `scorable` flags.

Supported `mode` values:

| Mode | Pass condition |
| --- | --- |
| `exact` | Present observation equals the expected JSON value exactly. |
| `exact_with_normalization` | Present observation equals the expected value under the criterion-declared comparison. |
| `presence_only` | A target slot is represented with status `present`, `blank`, or `redacted`. |
| `blank` | Observation status is `blank`. |
| `redacted_presence` | Observation status is `redacted`. This checks coverage, not a masked value. |
| `unresolved_uncertain` | Fails closed until a reviewed expectation replaces the uncertain criterion. |
| `trailing_marker_required` | A reviewed marker token is present at the end and the remaining identity matches the expected canonical identity. Marker tokens come from the private manifest; none are embedded in this code. |

Comparison types for `exact_with_normalization` are `exact`, `canonical_text`, `number`, `casefold`, and `date_format_set`. Transformations are explicit and narrow. Do not enable broad normalization to raise a score.

## Manifest schema

The manifest is private and must contain:

```json
{
  "rubric_schema_version": "complete-content-rubric/v1",
  "rubric_sha256": "<sha256 of the exact rubric file>",
  "expected_counts": {
    "criteria": 0,
    "frozen_gold_checks": 0,
    "scorable_checks": 0,
    "excluded_checks": 0
  },
  "normalizers": {},
  "require_physical_office_validation": true,
  "provenance_requirements": {
    "source_sha256": "<expected source hash>",
    "evidence_pages_used": 0,
    "holdout_pages_in_input": []
  }
}
```

Only include baseline count fields when a legacy frozen check list is present. If provenance keys are declared, the observations input must match them exactly. A page count or digest mismatch invalidates the evaluation; the evaluator never infers that an incomplete source set is complete.

## Observations schema

The adapter emits one record per criterion ID. Example shape below uses synthetic labels only:

```json
{
  "schema_version": "complete-content-observations/v1",
  "artifact_validation": {
    "all_outputs_opened": true,
    "all_outputs_valid": true,
    "validation_errors": []
  },
  "provenance": {
    "source_sha256": "<sha256>",
    "evidence_pages_used": 2,
    "holdout_pages_in_input": [3, 7]
  },
  "observations": {
    "criterion-a": {
      "status": "present",
      "value": "SYNTHETIC",
      "target_location": {
        "document": "form-a",
        "section": "section-1",
        "field": "field-x"
      }
    },
    "criterion-b": {
      "status": "unmapped",
      "target_location": null
    }
  }
}
```

Allowed statuses are `present`, `blank`, `redacted`, `unmapped`, `missing`, and `uncertain`. Every passing observation must include `target_location.document`, `target_location.section`, and at least one of `field`, `row`, or `paragraph`. Rows should include a stable row identifier and column/field name. Paragraph criteria should name the target paragraph or section. Missing output files, invalid Office files, and invalid provenance must be represented by a failed validation upstream and must not be converted to empty success observations. When `require_physical_office_validation` is true, the evaluator checks the supplied `artifact_validation` fields and fails the run if validation is absent or reports errors.

An adapter should emit intended-form locations only. Values that occur only in notes, raw extraction history, appendices, or unrelated tables do not satisfy a criterion unless the criterion explicitly names that target location.

## Reports

Reports contain aggregate pass/fail counts, missing or extra criterion IDs, target-document coverage, and integrity errors. They suppress expected and observed values. Extra observation IDs are reported but never scored. Every rubric criterion stays in the denominator.


`target_location.document` must equal the criterion's logical `target_document` identifier. An artifact filename can be recorded separately; placing the correct value in another document or in a raw-evidence appendix does not satisfy the criterion. Exact comparisons preserve JSON types, including the distinction between booleans and numeric amounts.
