import type { RuleSet } from "./domain.ts";
import legalResearch from "./legal-catalog.json" with { type: "json" };
import legacyRiskCatalog from "./risk-catalog.json" with { type: "json" };

/** Official-source verification is separate from approval to apply it to a case. */
export const CURRENT_RULESET: RuleSet = {
  id: legalResearch.runtime_parameters.id,
  status: "source_verified",
  effectiveFrom: legalResearch.runtime_parameters.effectiveFrom,
  sources: legalResearch.runtime_parameters.sources,
  debtCaps: {
    ...legalResearch.runtime_parameters.debtCaps,
    comparison: "lte",
  },
  term: legalResearch.runtime_parameters.term,
  // National caps and term only. Seoul-specific rules are separately scoped below.
  // A complete official living-cost table has not been verified: no inferred table.
};

/** Specifications for evidence-linked review, not fifty implemented legal verdicts. */
export const LEGAL_CATALOG = legalResearch.rules;

/** All 95 legacy entries retain their original fields plus explicit import metadata. */
export const RISK_CATALOG = legacyRiskCatalog.entries;

export const RULE_RESEARCH_METADATA = {
  schemaVersion: legalResearch.schema_version,
  kind: legalResearch.kind,
  asOf: legalResearch.as_of,
  verifiedAt: legalResearch.verified_at,
  scope: legalResearch.scope,
  sources: legalResearch.source_catalog,
  temporalPolicy: legalResearch.temporal_policy,
  evaluationContract: legalResearch.evaluation_contract,
  knownGaps: legalResearch.known_gaps,
  legacyOrigin: legacyRiskCatalog.origin,
  legacyCoverage: legacyRiskCatalog.actual_coverage,
  legacyCheckTypes: legacyRiskCatalog.actual_check_types,
  legacyLimits: legacyRiskCatalog.limits,
};

export const DOCUMENT_FEATURE_MAPS = legalResearch.document_feature_maps;

/** Source-verified Seoul figures still require a reviewed household, region and expense. */
export const SEOUL_LIVING_PARAMETERS = legalResearch.supplementary_living_parameters;

export type LegalCatalogRule = (typeof LEGAL_CATALOG)[number];
export type LegacyRiskEntry = (typeof RISK_CATALOG)[number];
