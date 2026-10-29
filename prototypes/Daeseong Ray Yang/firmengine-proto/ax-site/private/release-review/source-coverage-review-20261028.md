# Independent source coverage and extraction review

**Verdict: PASS for the reviewed tree.** No remaining P0/P1 issue was found in the reviewed source coverage, classifier separation, anchored-null verification, omission recovery, persistence, or bbox receipt paths. This is an independent code review; it does not attest to live API behavior, legal correctness, or held-out evaluation results.

## Scope reviewed

- Classification source-nature separation and the static family catalog.
- Family-scoped field applicability descriptors and source-condition cues.
- Strict extraction and verifier schemas, including model-authored `verificationState` exclusion.
- Anchored null and explicit-absence handling, verification disposition, and fact/page coverage persistence.
- Bounded missing-row cues, one-shot omission reread, targeted repair, regional mapping/merge, and final incomplete/review state.
- Geometry corroboration and source-verification receipt suppression.
- Preservation of `filed_form` hold and role gates.

No held-out, gold, or private-oracle data was opened. No app, Git, API, Site, deployment, or network mutation was performed.

## Findings

Classification records `sourceNature` as a claim about the page, separate from structural role and family routing. Routing decisions do not use source nature, and the catalog sent to the classifier contains static IDs, labels, and aliases rather than case values or expected answers. The `filed_form` exclusion and immutable sample role checks remain in place.

Field applicability contracts now provide case and source conditions as review context. The prompts and UI preserve the distinction between a document’s claim and a case-level applicability decision; the latter remains unreviewed. The classifier’s source-nature claim likewise does not mint facts, alter routing, or establish authenticity.

The extraction response schema is strict and excludes `verificationState`; that state is assigned by server verification logic and persisted through the guarded observation roundtrip. `explicit_none` is now represented as `source_empty`, while only a present value can be `value_read`. Its source state and quote remain visible, and the UI states that an explicit absence phrase is checked as source text rather than extracted as a value. Typed projection and applicability treatment remain separate.

Verifier checks cover non-null values and source-anchored null claims only when quote and valid bbox are present. A value recovered from an originally null field requires two matching correction reads; it does not receive a source-verification receipt. Blank, masked, illegible, explicit-none, catalog-gap, and not-seen states remain distinct, and unknown catalog coverage is not converted into a source claim.

Missing-row cues are restricted to exact IDs in the current document-family contract, require quote and valid geometry, are deduplicated against overlapping existing occurrences, and are capped. They are treated only as bounded reread locations. The initial omission reread is independent of unrelated global attempt counts, cannot recur after its persisted retry flag, and does not run for stored-read reverification. Targeted repair preserves prior omission evidence without starting a new omission pass. Remaining cues or omission flags make the page incomplete and route it to review. Regional cue geometry is mapped into page coordinates and validated against the merged read; regional results do not silently clear incompleteness.

Geometry repair now requires IoU of at least 0.5 against an available first-verifier bbox, falling back to the original extraction bbox. Missing or malformed geometry remains a repair target rather than being silently filled by the first verifier. When no trustworthy geometry reference exists, or corroboration fails, the raw value is retained for review while confidence becomes uncertain, verification disposition is unresolved, bbox is cleared, and source receipts are blocked. Focused tests cover disjoint and tiny-overlap boxes, corroborated relocation, and a missing first check with no source bbox.

Domain persistence retains the verification disposition on fact observations, maintains prior fact versions for human review, and does not let machine receipts override human-reviewed facts. The source receipt builder requires a non-null original value and clear verified reading; unresolved geometry fails closed through the field confidence/disposition gate. No change was found that accepts a bbox mismatch based on one unverifiable claim.

## Verification

`git diff --check` passed. I ran the five focused test files directly:

- `tests/coverage-review.test.ts`
- `tests/extraction-semantics.test.ts`
- `tests/field-observation.test.ts`
- `tests/pipeline-audit.test.ts`
- `tests/pipeline-commit.test.ts`

Result: **5 test files passed, 0 failed.** Root also reported a passing TypeScript check and broader focused test run; those are recorded as root-provided results, not as runs performed by this reviewer.

## Remaining limits

The cue validator checks family binding, quote presence, geometry shape, and overlap, but does not independently prove that the quoted text occurs inside the supplied image region. The cue cannot itself become a fact or receipt; it can only guide the bounded reread, and unresolved coverage remains review-required. A 0.5 IoU threshold is a conservative geometry corroboration rule, not a calibrated OCR accuracy measure. Source-nature and applicability entries remain model/source claims and do not establish authenticity, legal recognition, or case-level applicability.
