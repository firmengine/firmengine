# Document-generation evaluation metrics

`lib/document-generation-metrics.ts` is a pure, deterministic scorer for a predeclared corpus. Callers supply expected document and field manifests before evaluating output. Expected documents and fields define every denominator; absent predictions, missing documents, and abstentions count as unsuccessful outcomes. Empty expected manifests are flagged, and unexpected output never enlarges or replaces the denominator.

The report separates:

- exact document success (all expected fields have exactly matching canonical values);
- qualified document success (exact content, valid Office output, and valid required input-source references together);
- whole-underlying-case completeness (every expected field across every scan/template variant is present as a value; wrong values can still be complete);
- field accuracy and critical-field errors;
- missing fields/documents and explicit abstentions;
- physical Office validation, with unrun/missing documents shown separately and included as failures in `passRateAmongExpected`;
- input-provenance checks against supplied input fact IDs, including whether required source references are missing.

Document text exactness does not imply valid Office output or valid provenance; those measures stay separate. Missing/abstained values fail expected-field accuracy. `originBreakdown` keeps `real_case`, `synthetic`, and `public_example` counts distinct. Underlying case IDs are checked for split overlap, so scan/template variants from one case must share the same split. A single underlying case is explicitly labeled as insufficient for a general 99% claim. Even with multiple cases, this utility reports observed corpus statistics only and always rejects a universal 99% claim. It does not impose a statistical cutoff sample size, grade model self-confidence, or issue legal conclusions.

`observed99ThresholdMet` uses qualified document success, requires zero critical-field errors, and stays false if corpus validation reports an error. An unrun physical check, split leakage, a duplicated sample, or a fabricated source reference cannot satisfy the threshold through matching text alone. This remains a corpus-local observation, not a generalization certificate.

The function validates basic corpus integrity but does not establish that an expected manifest is complete, that an input source is authentic, or that the Office validation procedure is adequate. Those remain corpus-governance and validation responsibilities.
