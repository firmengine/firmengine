# Case payload storage audit

D1 limits a single row or string value to 2,000,000 bytes. A case payload grows with extracted facts, source references, and revision history, so storing the complete JSON in `cases.payload` can exceed that cap for a large scanned matter.

`lib/server-store.ts` now keeps payloads below 500,000 UTF-8 bytes inline for compatibility. At or above that threshold, it writes the serialized case to an immutable R2 object at `cases/{caseId}/state/{uuid}.json`, then stores a small JSON envelope in the existing D1 `payload` column. The envelope contains the case ID, revision, object key, SHA-256, and a compact case-list summary. This uses no schema migration and keeps state objects separate from uploaded source files and generated page images.

Reads accept both legacy inline JSON and the versioned pointer envelope. A pointer must match the requested case ID, current D1 revision, and the case state key namespace; the loaded bytes must match the envelope hash, and the embedded case ID/revision must match D1. Workspace listing reads the summary in the pointer and does not fetch up to 100 R2 case objects.

Writes preserve the existing in-memory snapshot token and D1 compare-and-swap condition. Each large write gets a fresh UUID object key. If its CAS loses or the D1 update throws, only that attempt's newly-created object is deleted; the prior committed object is never targeted for deletion. A successful update leaves the old immutable state object available, avoiding a race with readers that already observed the prior pointer.

Synthetic coverage in `tests/large-storage.test.ts` exercises payloads above 2 MB, read-back and checksum verification, stale concurrent CAS, cross-case pointer rejection, and legacy inline compatibility. It uses in-memory SQLite and a mock R2 bucket and contains no customer/sample data or credentials.
