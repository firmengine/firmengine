# Scan and template recovery

Normal evidence pages retain the existing single-page Luna classifier, extractor, and verifier flow. Recovery is triggered only by unreadable or disagreeing fields, omitted rows, or a timed-out/incomplete source read or verification. The model is always `gpt-6-luna`; recovery does not upgrade the model or mark evidence correct from image quality alone.

## Durable recovery contract

Each server plan binds one active evidence document and page to the original document hash, immutable base-page image hash, plan ID, reason, and exact normalized crop boxes. Uploads must match the requested variant slot, box, rotation and contrast. Four slots are allowed per plan, with an 8 MB object limit. Held-out submitted forms and administrative pages cannot enter recovery. A new plan cannot consume another plan's derivatives.

Browser recovery reopens the stored original, caches one PDF or bitmap during the run, and renders the requested PDF page at up to 4x scale, a 3600-pixel long edge and 12 million pixels. Each derivative also has bounded dimensions. Rotation is geometric; the current scheduled contrast is neutral. There is no generative image enhancement or reconstruction of hidden text.

An interrupted client can retrieve the same plan from server progress and finish its uploads. The pipeline waits for the requested derivative before spending the recovery model call. It does not silently replace a missing derivative with the lower-resolution primary image. Extraction and verification calls retain their actual prompt hash, image hashes, transform metadata and call-local field indexes.

Model requests have a 65-second deadline so a timeout can persist a recovery plan before the hosting request closes. If a whole-page extraction or verification is canceled before its catch handler runs, an expired processing lease moves it to the same region plan without repeating the long whole-page call. A live lease cannot be reclaimed. Source hashes, prior reads and completed proof checkpoints remain bound to their original inputs.

## Recovery paths

| Trigger | Inputs and processing | Result boundary |
| --- | --- | --- |
| Field disagreement | Up to four context-expanded boxes; the targeted rereader checks only unresolved fields | Previously agreed fields remain preserved; unresolved readings remain visible |
| Unreadable field | One source box at 0, 90, 180 and -90 degrees | A rotated image is only another source view; it is not an acceptance decision |
| Omitted table rows | One broad full-width table crop with context | Missing rows remain incomplete until the existing source-verification rules resolve them |
| Whole-page extraction/verification timeout, incomplete response or expired interrupted lease | Four overlapping full-width regions, extracted and independently checked one region per request | Each completed region is checkpointed; the final merge makes no additional whole-page model call |
| Overlapping regions | Identical records merge only with matching fields and overlapping source geometry; unanimous agreeing checks may collapse for aggregate status | Original per-call proofs are preserved; conflicting readings and distinct adjacent rows are not silently merged |
| Document-type disagreement between regions | Known aliases or identical explicit types can reach consensus; unknown headerless regions supply no invented type | Concrete type conflicts force incomplete/review status |
| Stale source, role, plan or page image | Reject uploads or stop consumption | Prior source bytes, review states and holdout separation remain intact |
| Exhausted recovery | Retain an explicit page error or review-required result | No infinite model loop, fabricated value or automatic legal acceptance |

The regional state machine has bounded per-region attempt counters. A normal completed page does not enter it. An explicit fresh-page reread remains available, while failed-step retry can retain its saved checkpoint. Small step responses allow clients to resume processing without repeatedly downloading the entire case ledger.

## Coverage limits

Changed form layouts and new columns use the same extraction and omission checks. Skew, motion blur, low contrast and clipped source text are **not** universally recovered: no automatic deskew or deblurring detector has been validated. Native-text and scanned PDF pages currently use rendered images. PDF text-layer fusion is not implemented. Masked digits and irrecoverably unreadable fields remain unknown.

Synthetic tests verify state transitions, source boundaries, bounded recovery, region merging and proof binding. They do not establish OCR accuracy or a 99% document-generation rate. Real output accuracy must be measured separately against a fixed, held-out answer set and then against other underlying cases.
