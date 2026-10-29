/** Read-only reference views of the consultation checklist's existing catalogue.
 * The catalogue remains the only editable master; no duplicate classification or
 * document-requirement records are persisted by this bridge. */
import { INTAKE_SCHEMA_VERSION, type IntakeCatalog, type IntakeDocumentType, type IntakeFeature, type IntakeRule, type IntakeSource } from "./intake-types.ts";
import { isOfficialMonitorUrl, type MonitorRuleProjection } from "./legal-monitor-core.ts";

export const INTAKE_REFERENCE_SCHEMA_VERSION = INTAKE_SCHEMA_VERSION;
export type IntakeReferenceKind = "feature" | "document" | "rule" | "source";
export interface IntakeReferenceRecord {
  id: string;
  nativeId: string;
  kind: IntakeReferenceKind;
  category: string;
  title: string;
  catalogVersion: number;
  value: IntakeFeature | IntakeDocumentType | IntakeRule | IntakeSource;
  sourceIds: string[];
  sourceUrls: string[];
  courtIds: string[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
  enabled: boolean;
  keywords: string[];
}
const unique = (values: readonly string[]) => [...new Set(values)];

/** Sources of both requested and alternative documents affect a matching rule. */
export function intakeReferenceRecords(catalog: IntakeCatalog): IntakeReferenceRecord[] {
  const sourceMap = new Map(catalog.sources.map(source => [source.id, source]));
  const documentMap = new Map(catalog.documents.map(document => [document.id, document]));
  const featureMap = new Map(catalog.features.map(feature => [feature.id, feature]));
  const documentIds = (rule: IntakeRule) => unique(rule.documents.flatMap(need => [need.documentTypeId, ...need.alternatives]));
  const ruleSources = new Map(catalog.rules.map(rule => [rule.id, unique([...rule.sourceIds, ...documentIds(rule).flatMap(id => documentMap.get(id)?.sourceIds ?? [])])]));
  const urls = (ids: readonly string[]) => unique(ids.flatMap(id => sourceMap.get(id)?.url ? [sourceMap.get(id)!.url] : []));
  const record = (kind: IntakeReferenceKind, value: IntakeReferenceRecord["value"], title: string, sourceIds: string[], keywords: string[], rule?: IntakeRule): IntakeReferenceRecord => ({
    id: `intake.${kind}.${value.id}`, nativeId: value.id, kind, category: `intake_${kind}`, title, catalogVersion: catalog.version,
    value: structuredClone(value), sourceIds: unique(sourceIds), sourceUrls: urls(sourceIds),
    // Only a rule declares jurisdiction/effectivity. A source's checkedAt is not an effective date.
    courtIds: rule ? [...rule.jurisdictions] : [], effectiveFrom: rule?.effectiveFrom ?? null, effectiveTo: rule?.effectiveTo ?? null,
    enabled: rule?.enabled ?? true, keywords: unique([title, ...keywords].filter(Boolean)),
  });
  return [
    ...catalog.features.map(feature => {
      const consumers = catalog.rules.filter(rule => [...rule.all, ...rule.any].some(condition => condition.featureId === feature.id));
      return record("feature", feature, feature.label, consumers.flatMap(rule => ruleSources.get(rule.id) ?? []), [feature.label]);
    }),
    ...catalog.documents.map(document => record("document", document, document.name, document.sourceIds, [document.name, ...document.workflowDocumentTypes])),
    ...catalog.rules.map(rule => record("rule", rule, rule.title, ruleSources.get(rule.id) ?? [], [
      ...[...rule.all, ...rule.any].flatMap(condition => featureMap.get(condition.featureId)?.label ? [featureMap.get(condition.featureId)!.label] : []),
      ...documentIds(rule).flatMap(id => documentMap.get(id)?.name ? [documentMap.get(id)!.name] : []),
    ], rule)),
    ...catalog.sources.map(source => record("source", source, source.title, [source.id], [source.title])),
  ];
}

/** Only official URLs can become fetch targets. Office policy stays in the view. */
export function intakeMonitorProjection(records: readonly IntakeReferenceRecord[]): MonitorRuleProjection[] {
  return records.filter(row => row.enabled).map(row => ({
    id: row.id, title: row.title, category: row.category,
    sourceIds: [...row.sourceIds], sourceUrls: row.sourceUrls.filter(url => isOfficialMonitorUrl(url)), keywords: [...row.keywords],
  }));
}
