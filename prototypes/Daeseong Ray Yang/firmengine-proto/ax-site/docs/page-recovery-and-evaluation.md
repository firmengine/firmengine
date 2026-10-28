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

## Document scope and field coverage

Document family and source nature are separate observations. A copy, self-reported record, or visibly marked example may still have a recognizable document family and extractable source fields. The classifier retains that source-nature observation and its quotation. It does not infer authenticity, legal admissibility, or accepted amounts from a structural family match. Filed forms and excluded pages retain their processing boundary.

Each family exposes its exact field IDs, semantic definitions, source conditions, and case conditions to the extractor and verifier. A catalog obligation does not prove that its field is visible on every page or that a case satisfies the underlying condition.

| Source observation | Extraction treatment | Case applicability |
|---|---|---|
| Readable value | Preserve the raw value, unit, quote, and location; independently check field meaning | Remains a separate reviewed decision |
| Visible empty cell | `blank`; no invented zero or value | Does not imply not applicable |
| Masked or unreadable region | `masked` or `illegible` with the visible source anchor | Does not imply not applicable |
| Explicit source statement of absence | `explicit_none` with the supporting quote and location | A source claim, not automatic case approval |
| Catalog field without a visible occurrence | An unresolved coverage gap | Does not create an absence assertion |
| Value attributed to another field or column | `wrong_field`; preserve the disputed raw reading for review | Does not receive machine verification |

Anchored null observations can enter independent verification and a bounded repair. Recovering a readable value requires two supporting readings with matching value and unit. A verification of an empty or masked source region is an observation-state check and is not counted as a successfully extracted value.

The verifier can identify a missing occurrence using an exact family field ID, a source-state claim, a quotation, and normalized page coordinates. These are recovery cues, not facts. The server rejects wrong-family IDs and unanchored cues, removes overlapping duplicates, preserves separate row regions, and limits each pass to 32 cues. One omission reread is allowed independently of classification and derivative-upload attempts. Stored-read reverification never initiates this extraction retry. Remaining omission cues keep the page incomplete, including after targeted field repair or regional merging.

Field coverage displays source state, source-claimed applicability, independent verification disposition, and missing source coordinates separately. `supported`, `corrected`, `wrong_field`, `unreadable`, `conflicting`, `value_mismatch`, `unclear`, and `missing_check` describe the observed verification result. These states do not change a case's legal recognition status.

New verification receipts require corroborated source geometry. A verifier must support the field's meaning, value, unit, quotation, and location. If extraction and verification disagree on location, a second verifier reading must corroborate the final box with intersection-over-union of at least 0.5. Missing extraction coordinates also require two verifier readings. The receipt retains the extraction box, final box, and qualifying verifier evidence in its fingerprint; the field's source reference must still match the final box. Regional reads and preserved omission baselines use the same gate. Unresolved geometry keeps the raw reading available for review but cannot acquire a new source-verification receipt. Previously stored receipts retain their historical validation rules; they are not relabeled as having new geometry evidence.

## Generalization evaluation

`scripts/SYNTHETIC-OCR-EVALUATION.md` describes a seeded set of four independent cases, each with clean, changed-layout, and degraded-image variants. Generated PDFs and gold values stay outside the source checkout. The live runner receives only input PDFs, uses normal application classification, and cannot access the gold directory. A shared processing budget charges calls before sending them, including failed mutations; it does not retry a mutation whose outcome is uncertain.

Scoring binds each result to its input PDF hash. Missing files remain in the denominator. A matching numeric string is insufficient when its unit is wrong, its source quotation or location is absent, or its reading is uncertain. Repeated transaction rows need separate observations. The three variants of one case remain one independent case in each reported condition.

This measures evidence-page extraction. It does not establish complete-document accuracy, legal eligibility, court acceptance, or generalization to every case type. Complete-document evaluation must independently inspect the generated files against a frozen, independently reviewed rubric and retain failed and unresolved cases in its reported scope. A 99% target must not be represented as an achieved result from unit tests, self-reported model confidence, or a small synthetic corpus.
