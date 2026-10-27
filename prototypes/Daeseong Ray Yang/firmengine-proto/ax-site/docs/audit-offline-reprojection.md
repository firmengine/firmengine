# Offline stored-read reprojection

This endpoint recomputes one completed page's deterministic fact projection from its persisted `PageRead`. It does not call the model and does not claim that source values were re-verified by a person or by a new model pass.

## API

- `GET /api/cases/:id/process?jobId=<page-job-id>` returns one current evidence page's stored `read`, `firstRead`, `extractionRead`, `review`, verifier-pass metadata, original cache key, and historical prompt/model/ruleset metadata.
- `POST /api/cases/:id/process` with `{ "action": "reproject_page", "jobId": "..." }` projects the stored final read using the current `projectPage()` and `applyExtraction()` implementations.

The inspection/reprojection gates require an active document and evidence page, a job in `completed` or `review_required` status at `completed` stage with no lease, no active page processing jobs, a matching historical cache-key tuple, original object bytes whose SHA-256 matches the registered document hash, and an immutable stored image whose content hash matches the job record. Current and frozen page roles are checked to keep filed forms and administrative pages out.

The persisted result keeps its complete raw reads, every historical verifier pass, cache key, and old model/prompt/rule metadata. Reprojection writes a separate `projection` record with the current projection version, source hash, cache key, time, and case revision. It does not update page-job completion status, attempts, cache key, or verification metadata. Current unchanged reviewed facts/objects use existing `applyExtraction()` preservation rules; conflicts remain candidates. The action does not construct source-verification receipts, set `verified`, accept facts, or set legal decisions. A legacy result without sufficient verification remains unverified after projection.

The job-result CAS claim prevents concurrent reproject requests for the same page; case writes use the existing revision/storage-token CAS. If saving the case fails, the claim is cleared only when that rollback is confirmed. If case persistence succeeds but receipt finalization fails, the durable claim is left in place and repeat execution is blocked to prevent a duplicate apply. A service operator must inspect that rare partial-failure state before clearing it. The endpoint checks active processing at entry; a different page can begin processing immediately afterward because existing pipeline claim SQL has no case-wide lock. The case CAS still prevents a stale case overwrite, but fully excluding that narrow race requires a separate pipeline-level lock in a later change.

## Verification

Synthetic tests cover old prompt preservation, deterministic reapplication, human-reviewed fact/object preservation, held-out/admin rejection, source/cache hash mismatch, upload readiness, active jobs, unfinished jobs, malformed reads, and legacy reads without verifier-pass proof. No real case, sample PDF, evaluation output, API, or model call is used by these tests.
