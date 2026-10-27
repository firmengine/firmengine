# Document families and source-to-field routing

`lib/document-routing.ts` maps explicit Korean titles and English family identifiers to document-specific reading instructions and existing workflow contracts. It accepts ordinary title spacing and parenthetical qualifiers. An unknown or ambiguous title remains unknown; broad words such as insurance, tax, property, or finance are insufficient.

Families with different evidentiary meaning remain separate:

- current debt statements and historical credit/assignment records;
- health-insurance payments, arrears and qualification records;
- annual income, taxable revenue, tax payment status, local assessment and tax arrears;
- pension contribution history and actual pension benefits;
- bank account headers and individual transaction rows.

The router does not determine applicant ownership, current income, debt inclusion, legal priority, source correctness or legal acceptance. Printed titles remain source facts. Missing amount units and periods stay unresolved.

Projection now preserves quoted bank header fields under `bank_account.*` and lease party/deposit fields under `lease.*` even when the reader uses a statement or other record category. A transaction's running balance never becomes an account inventory balance through this conversion. Equivalent source categories such as `보험계약` become an insurance candidate, while the existing surrender-value and legal-recognition gates remain in effect. Explicit translated period-total labels do not manufacture dates, a 12-month denominator or recurring income.

Projection version and prompt version are distinct. Stored reads may be reprojected without a model call; their historical model/prompt provenance and review state remain historical. New instructions affect new reads only. The synthetic routing tests cover title variation and negative distinctions; they do not establish measured OCR accuracy or case-level generalization.
