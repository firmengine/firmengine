# Synthetic OCR V3 policy

V3 is the generator default. It creates four independent synthetic cases and three paired variants (`clean`, `layout`, `degraded`) per case, using seed `20261029` and the separate default root `/tmp/firmengine-synthetic-ocr-v3-private/`. Request PDFs are under `request-only/`; scoring data is under `gold/`. Existing output directories must be empty. Use `--version v1` or `--version v2` to reproduce earlier corpus contracts without rewriting their outputs.

The policy object is embedded in each V3 gold manifest and bound by SHA-256 `cecb4e822e5126bf33e1bad946daa2e3a54cbfcdc8da58c4e1cbad17c2729e97`. The scorer recomputes and verifies this hash before evaluation. V3 uses scorer identity `source-bound-clear-field-v4`; the V2 scorer identity remains unchanged.

## Field and source rules

- Layout-variant bounding boxes cover the full drawn card, from the card's top edge through its bottom edge. They are normalized to the page and validated as finite coordinates in `[0, 1]` with positive width and height. The V3 test opens the generated PDFs with PyMuPDF and checks that each card's drawn text intersects the corresponding source box.
- The debt statement labels and scores `overdue_interest` as “연체 이자”. Ordinary interest aliases do not satisfy this field.
- `main_contract_coverage` is an accepted key only for the insurance family. `daily_approval_subtotal` is accepted only for the transactions family.
- The transaction date is required independently on each of the three transaction rows. A candidate must use a recognized date key, retain `record_category: transaction` and a non-boolean integer `record_index`, have clear confidence, a source quote and an overlapping valid source box. Subtotals and other record categories cannot satisfy transaction dates. An invalid or conflicting explicit date candidate invalidates its transaction record.
- Dates compare at the written calendar-date precision. A valid ISO date or ISO datetime is accepted; for a datetime, the calendar date as written is used without timezone-offset conversion. Invalid, missing, or conflicting dates fail the corresponding row. Values or amounts are never used to choose which row to check.
- Candidate deduplication preserves the V1/V2 identity contract. In V3 the record index is not part of observation identity, so an otherwise identical key/value/quote/unit/confidence at the same box cannot count as multiple row occurrences solely because its record index differs. The three required dates must therefore be supported by distinct overlapping source boxes.
- Monetary fields require the declared unit. Source PDF hashes continue to bind each read to its exact input.

The scorer reports `field_match_accuracy` and `page_complete_accuracy` separately. The page-complete measure requires all required fields to match, a completed job, the expected model, and `read.complete: true`. Neither measure is a court-document accuracy metric.

## Offline checks

Run the V3 synthetic contract test with:

```sh
python3 scripts/test-synthetic-ocr-v3.py
```

The V1 and V2 regression contracts remain:

```sh
python3 scripts/test-synthetic-ocr.py
python3 scripts/test-synthetic-ocr-v2.py
```

No model or network request is made by these generator/scorer contract tests.
