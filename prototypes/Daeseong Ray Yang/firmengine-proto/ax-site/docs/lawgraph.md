# Inspectable personal rehabilitation lawgraph

`/data/lawgraph` exposes a read-only graph built from the exception audit, legal rule catalog, and `WORKFLOW_RULES`. It contains all 46 EL scenarios and a real workflow subgraph: workflow rule → required document → canonical feature key → output target. Field key, unit, period, cross-checks, and targets are preserved on nodes/edges. Explicit node and edge registries let consumers check graph integrity rather than interpreting prose-only relations.

## What an execution label means

- **Document route evaluator** is registered only when an EL feature has an exact key match or an explicit entry in the curated feature-alias map. The initial aliases are `applicationDate` → `case.applicationDate` and `courtId` → `case.courtId`; their reasons are included in graph metadata. The registered path is `evaluateWorkflow`, which evaluates workflow document fields and route status.
- **Deterministic calculation/source gate** is attached only by the curated rule-ID map in `lib/lawgraph.ts`. The named code path and reason appear on each scenario. Legal-catalog `implementation_scope` labels alone do not establish execution.
- **Static only** means no curated execution mapping was found. A common rule ID, matching catalog entry, scenario prose, or legal source does not count as execution.
- A workflow rule connected through a shared rule ID is displayed as `shared_rule_catalog_reference`; that relationship is explicitly not evidence that the EL scenario is executed. Exact feature-key matches are shown separately.
- Each EL feature carries `exact_workflow_key`, `curated_alias`, or `unmapped`. Korean labels, free text, and semantically similar names are not silently normalized into canonical keys; additional aliases require explicit review and code entries.

## Sources and scope

Rule→source edges are created only from explicit legal-catalog `source_ids`. The graph reports source-catalog count, distinct referenced IDs, and dangling IDs. Source edition dates and authorities are catalog metadata, not a case-specific version determination. Case court applicability and historical version selection stay `unknown` pending the relevant court, filing date, and transitional-rule review. Seoul practice rules are not nationwide law.

The graph is not legal advice, an eligibility adjudication, an approval prediction, or a claim of full scenario automation. Missing evidence remains unknown; no unlisted fact is treated as false. It maps implementation and evidence routes for inspection, not legal truth.
