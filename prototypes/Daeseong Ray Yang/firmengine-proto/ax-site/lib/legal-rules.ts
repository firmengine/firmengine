import { referenceParameter } from "./reference-parameters.ts";
import { readReferenceValue } from "./reference-runtime.ts";
import type { RuleSet } from "./domain.ts";
import legalResearch from "./legal-catalog.json" with { type: "json" };
import legacyRiskCatalog from "./risk-catalog.json" with { type: "json" };

/** Official-source verification is separate from approval to apply it to a case. */
export const CURRENT_RULESET: RuleSet = {
  get id() { return referenceParameter<string>("param.national.ruleset.id"); },
  status: "source_verified",
  get effectiveFrom() { return referenceParameter<string>("param.national.ruleset.effective_from"); },
  get sources() { return readReferenceValue("legal.runtime.sources", legalResearch.runtime_parameters.sources); },
  get debtCaps() { return {
    unsecuredWon: referenceParameter<string>("param.national.debt_caps.unsecured_won"),
    securedWon: referenceParameter<string>("param.national.debt_caps.secured_won"),
    comparison: referenceParameter<"lte" | "lt">("param.national.debt_caps.comparison"),
  }; },
  get term() { return {
    ordinaryMonths: referenceParameter<number>("param.national.term.ordinary_months"),
    exceptionalMaxMonths: referenceParameter<number>("param.national.term.exceptional_max_months"),
  }; },
};
export function currentRuleSet(): RuleSet { return { ...CURRENT_RULESET }; }


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
export function seoulLivingParameters() { return referenceParameter<typeof SEOUL_LIVING_PARAMETERS>("param.seoul.living.supplementary"); }

export type LegalCatalogRule = (typeof LEGAL_CATALOG)[number];
export type LegacyRiskEntry = (typeof RISK_CATALOG)[number];
