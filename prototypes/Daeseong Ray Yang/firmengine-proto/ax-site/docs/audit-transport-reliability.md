# Transport reliability audit

This change addresses large case responses and interrupted process-stage requests. It does not run model calls, alter stored cases, or change the saved independent evaluation checkpoint.

## Durable verification and case writes

- The paid verifier persists its final read, verification passes, source/image hashes, cache key, and projection version before reporting `commit_ready`. A separate bounded request projects and saves those results without calling a model. This separates the model request budget from large case persistence.
- A revision conflict retries the case write three times. If the conflict remains, the page stays at `pending / commit` and returns `commit_retry` progress; its retry count and an event remain visible. Source, role, image, or provenance mismatches still stop processing and never use this transient-conflict path.
- Historical unfinished reads whose prompt/model cache key differs from the current configuration are retained as superseded evidence and requeued for extraction. They are not relabeled as new-version reads. Completed reads can be inspected and deterministically reprojected separately.
- Model usage is recorded in the append-only event ledger. Usage reporting aggregates those events and no longer writes a case revision for every model call, avoiding competition with evidence commits.
- Synthetic tests deliberately fail three consecutive case writes, disable the model connection, and prove that the next commit completes from the saved proof with no additional model call. Changed source or image bytes are rejected.

## Response behavior

- Process actions now return a compact progress object: case ID and revision, object counts, job counts by status, remaining work, stage/page, and optional error/check summaries. They no longer return the complete workflow, assessment, catalogs, and evidence ledger after every paid stage.
- `GET /api/cases/:id/process` provides the same compact durable progress view for recovery after a client loses a response.
- Full case reads and export responses remain complete JSON. They use gzip only when the request accepts gzip; the response carries `Content-Encoding: gzip`, `Vary: Accept-Encoding`, JSON content type, and the original cache policy. Clients that do not accept gzip receive ordinary JSON.
- The workspace refreshes the full case after a processing sequence ends, pauses, or errors, while keeping per-stage browser traffic compact.

## Runner recovery bounds

- The sample runner requests gzip and decompresses it before JSON parsing.
- Bounded retries apply to safe `GET` requests that fail during transport or return a retriable server error. Uploads and process-stage `POST`s are never replayed automatically.
- If a process-stage response is interrupted, the runner reads durable progress and waits for an active processing lease to settle. It continues only when progress shows no active lease and no error job. It stops on unresolved leases, page errors, authorization failures, quota/model errors, or failed progress recovery.
- An explicit `--resume-state` starts a new output directory and leaves the prior checkpoint untouched. Before uploading, it checks server-side document identity, source hash, page count, frozen evidence/holdout roles, and upload readiness. It uploads only the original or evidence pages the server reports as missing. Resume skips the generic retry action, so failed model jobs are not silently retried.

## Verification

Synthetic tests cover gzip negotiation, decompression, response metadata, and `gzip;q=0`. TypeScript compilation and Python syntax compilation passed. No live deployment, sample upload, or paid API call was made.

## Production compression correction

A production GET exposed a double-encoding failure: one HTTP gzip decode left another gzip stream. Workers automatically encodes a response according to Content-Encoding, while the first helper had already compressed its body. The helper now leaves JSON bytes plain and lets the final Worker HTTP boundary encode once; this also remains correct if Vinext rewraps the Response. See Cloudflare's official [Response encodeBody documentation](https://developers.cloudflare.com/workers/runtime-apis/response/). The deployed endpoint must be verified with a single gzip decode before any paid processing resumes.
