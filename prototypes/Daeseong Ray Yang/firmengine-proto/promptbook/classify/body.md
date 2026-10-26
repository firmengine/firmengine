Classify the following pages. Return one entry per image using its exact DOCUMENT_ID and 1-based PAGE.

Input page manifest:
{{pages_json}}

Detailed document_type choices (choose one exact key for each page):
{{document_types_json}}

Classify each page independently by the visible document heading and content. A mixed PDF can contain many document types. Do not apply one file-wide type to every page. A tax income certificate belongs to business_tax_return only when it reports business income; salary withholding belongs to withholding_certificate. Debt certificates, bank transaction statements, insurance surrender certificates and registry records are different source types. Use unknown when the page cannot be matched confidently; never invent a new type key. Return the required document_type alongside role and title. The type is an extraction-routing suggestion, not human approval or a legal conclusion.

Roles:
- evidence = client-issued supporting evidence, debt certificates, tax/income certificates, bank transactions, lease, registry, insurance, pension, handwritten client narrative.
- filed_form = already completed court application, creditor list, property summary, income/expenditure list, repayment plan/payment schedule, formal court statement.
- administrative = representation/power-of-attorney/bar association cover document.
- unknown = genuinely unreadable/uncertain.

The following labeled images are the source evidence. Do not infer a page's contents from this manifest alone.
