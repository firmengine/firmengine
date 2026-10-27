# Evidence recovery and measurement

The runtime model is `gpt-6-luna`. A completed processing job, a verified source value, a legally accepted amount, and a correct court document are distinct outcomes.

## Page operations

| Operation | Uses a new model call | Preserved evidence | Boundary |
|---|---|---|---|
| Normal processing | One stage per request | Original file, image hash, extracted fields, independent checks | Held-out and administrative pages are excluded |
| Region rescue | Only the requested reading or verification stage | Source-bound crop plan, transforms, image hashes, region checks | Source document, page, original image, and plan must match |
| Retry failed or uncertain page | New reading when processing resumes | Exact old result in content-addressed private history | Only the selected inactive evidence job |
| Refresh completed page | New reading when processing resumes | Exact old result and proof metadata; manual edits remain | Explicit `refresh_page`; active or leased jobs are blocked |
| Reproject stored reading | None | Historical source proof if every binding still matches | Source, raw field, value, unit, quote, and lineage must match |

A reprojected fact does not receive a new independent verification merely because its storage ID changed. The preserved receipt retains its original model, prompt hash, timestamps, field fingerprint, proof readings, and source. Only the binding to the replacement fact version changes. Missing, altered, ambiguous, or forged proof cannot be restored, and a later human rejection cannot be overwritten. The stored-read path still recomputes derived objects: identical fact values do not justify retaining an obsolete transaction or income projection.

The request deadline is bounded. An unfinished whole-page read can become a durable four-region rescue plan, including when the hosting request was canceled before its error handler could run. Normal clear pages retain the original processing path. This mechanism does not establish that every illegible scan is recoverable.

## Generalization evaluation

`scripts/SYNTHETIC-OCR-EVALUATION.md` describes a seeded set of four independent cases, each with clean, changed-layout, and degraded-image variants. Generated PDFs and gold values stay outside the source checkout. The live runner receives only input PDFs, uses normal application classification, and cannot access the gold directory. A shared processing budget charges calls before sending them, including failed mutations; it does not retry a mutation whose outcome is uncertain.

Scoring binds each result to its input PDF hash. Missing files remain in the denominator. A matching numeric string is insufficient when its unit is wrong, its source quotation or location is absent, or its reading is uncertain. Repeated transaction rows need separate observations. The three variants of one case remain one independent case in each reported condition.

This measures evidence-page extraction. It does not establish complete-document accuracy, legal eligibility, court acceptance, or generalization to every case type. Complete-document evaluation must independently inspect the generated files against a frozen, independently reviewed rubric and retain failed and unresolved cases in its reported scope. A 99% target must not be represented as an achieved result from unit tests, self-reported model confidence, or a small synthetic corpus.
