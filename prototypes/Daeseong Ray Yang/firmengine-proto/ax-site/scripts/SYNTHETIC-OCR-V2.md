# Synthetic OCR v2 unit-consistency corpus (legacy version)

V2 generation and scoring remain available unchanged for reproducibility. The generator now defaults to V3; pass `--version v2` and use a fresh `--out-root` to create another V2 trial. The original V2 seed, schema, safety variant, and existing trial outputs are preserved.

The v1 corpus remains unchanged and is useful as a unit-omission safety input. Its monetary rows have no printed currency unit. A typed amount or a positive accuracy match for those rows is invalid; the expected behavior is a raw reading with `unit: null` and a review-blocked page. Do not score v1 as a positive complete-document money extraction benchmark.

V2 generates four independent synthetic cases from seed `20261028` and three paired variants each (`clean`, `layout`, and `degraded`), for twelve positive pages. The generated case schema declares the currency unit, and the same drawing used for each PDF explicitly prints `원` beside every monetary row. The generator checks the drawing text before it writes clean, layout, or raster-degraded output. Gold metadata is written separately from request-only PDFs; only request-only PDFs may be submitted to an OCR service.

An optional `missing_unit` variant adds four safety pages. These pages intentionally omit units and belong to a separate safety metric; they do not enlarge the positive page or independent-case accuracy denominator. The expected behavior is `unit: null` and a `review_required` job status.

```sh
python3 scripts/generate-synthetic-ocr.py \
  --version v2 \
  --seed 20261028 \
  --out-root /tmp/firmengine-synthetic-ocr-v2-trial-01 \
  --font /usr/share/fonts/truetype/nanum/NanumGothic.ttf
```

Add `--include-missing-unit` to generate the separate safety variants. Use the same `request-only` directory for uploads and keep the generated `gold` directory local to scoring. The scorer reads the expected unit from the V2 generation schema. It treats `원`, `KRW`, and `₩` as the same currency unit; scaled units such as `천원` remain distinct. It does not assume KRW when the source or expectation has no unit. Use `--version v1` explicitly to reproduce the legacy unitless corpus. Existing request/gold directories must be empty to prevent overwriting a trial's bound source files.

Offline contract test:

```sh
python3 scripts/test-synthetic-ocr-v2.py
```
