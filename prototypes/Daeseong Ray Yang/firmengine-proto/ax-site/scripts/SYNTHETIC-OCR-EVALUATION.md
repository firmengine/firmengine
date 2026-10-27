# Synthetic OCR generalization corpus

This toolset creates four one-page Korean synthetic evidence cases. Each case is rendered as a clean version, a two-column layout variant, and a moderately downsampled/softened scan. The three PDFs in one case are paired variants of the same underlying record; they are not three independent cases. Thus each version has **4 independent cases and 12 positive PDFs**, with a fixed case denominator of four for each variant. New generation defaults to V3; use `--version v1` or `--version v2` to reproduce a legacy corpus with its original seed and output root.

The private output root is outside the git checkout:

```sh
python3 scripts/generate-synthetic-ocr.py \
  --font /path/to/NanumGothic-Regular.ttf
```

The V3 default uses seed `20261029` and writes model requests only to `/tmp/firmengine-synthetic-ocr-v3-private/request-only/`. It writes gold field values, normalized source bounding boxes, random seed, family, record ID, variant and critical-row flags only to the matching `gold/` directory. V1 retains seed `20261027` and `/tmp/firmengine-synthetic-ocr-private/`; V2 retains seed `20261028` and its explicit trial root. Upload PDFs from `request-only/` only. Never copy gold JSON into an API request or model prompt. Every name, institution, date, amount, and record ID is generated from the seed; no actual sample or extracted value is used.

| Family | Gold fields per case |
|---|---:|
| Payroll | 4: gross pay, deductions, net pay, explicit period |
| Debt balance | V1/V2: 3 (principal, interest, as-of date); V3: 3 (principal, overdue interest, as-of date) |
| Insurance | 3: surrender value, premium, coverage amount |
| Transactions | V1/V2: 5; V3: 7 (three separately indexed transaction dates, two repeated-row occurrences, one other transaction row, and a critical subtotal row) |

The scorer consumes one saved read-fields JSON per PDF, named `<case_id>--<variant>.json`, and compares normalized field/value pairs with gold:

```sh
python3 scripts/score-synthetic-ocr.py \
  --gold-dir /tmp/firmengine-synthetic-ocr-private/gold \
  --reads-dir /tmp/firmengine-synthetic-ocr-private/reads \
  --out /tmp/firmengine-synthetic-ocr-private/scores.json
```

The scorer uses semantic aliases for common app field keys (for example, `principal_balance` for the generated principal field), checks source bounding-box overlap for row-critical values and requires a source box, clear reading, source quote, and correct monetary unit, and requires separate observations for critical repeated transaction rows. It reports each variant separately and retains four as the expected independent-case denominator. It does not combine the three paired versions into a 12-case score. Missing read files remain in the field and case denominators and score as failures. Source PDF hashes bind each prediction to the frozen input. V3 separately reports field-match accuracy and page-complete accuracy; page completion requires completed processing and `read.complete`. Neither metric is complete court-document accuracy.

To run the request-only PDFs against the private Site, use a fresh reads directory and an explicit global processing-step budget. The runner creates one separate Site case per PDF, checks that the Site is configured for `gpt-6-luna`, reads the Site credential with hidden input, and submits only the PDF and page raster. It never loads the gold folder or takes a gold argument. Each `/process` action is charged against the cap before sending, including calls whose response times out. The application classifies the initially `unknown` synthetic page through its normal pipeline; the runner does not mutate page roles or change immutable held-out rules.

```sh
python3 scripts/run-synthetic-ocr-evaluation.py \
  --request-dir /tmp/firmengine-synthetic-ocr-private/request-only \
  --reads-dir /tmp/firmengine-synthetic-ocr-private/reads-run-01 \
  --origin https://YOUR-PRIVATE-SITE.chatgpt.site \
  --source-commit EXACT_40_CHARACTER_DEPLOYED_COMMIT \
  --max-steps 96
```

The driver writes the scorer-compatible `fields` array plus the raw stored read and provenance (`source_sha256`, source case ID, family, variant, Site case/document IDs, role, job status/stage, model, and steps used). Run the scorer afterward against the separate `gold/` directory. A fresh output directory is required to avoid overwriting previous run evidence. The test suite exercises the runner with a no-network fake Site:

```sh
python3 scripts/test-synthetic-ocr-runner.py
```

Run the generation/denominator/separation checks with:

```sh
python3 scripts/test-synthetic-ocr.py
```

V3's source geometry, semantic-key boundaries, date precision, and separate page-completion metric are covered by:

```sh
python3 scripts/test-synthetic-ocr-v3.py
```
