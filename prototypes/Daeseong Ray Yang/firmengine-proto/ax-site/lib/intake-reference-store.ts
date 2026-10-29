import { INTAKE_CATALOG_SEED } from "./intake-catalog.ts";
import { validateIntakeCatalog } from "./intake-engine.ts";
import { INTAKE_REFERENCE_SCHEMA_VERSION, intakeMonitorProjection, intakeReferenceRecords } from "./intake-reference.ts";
import { isOfficialMonitorUrl } from "./legal-monitor-core.ts";
import { intakeCatalogSha256, readActiveIntakeCatalogSnapshot } from "./intake-catalog-snapshot.ts";

/** One SELECT reads a consistent catalogue head/version pair. GET/MCP never seed. */
export async function readIntakeReferences(database: D1Database) {
  const stored=await readActiveIntakeCatalogSnapshot(database);
  const initialized = stored !== null;
  const catalog=stored?.catalog??validateIntakeCatalog(structuredClone(INTAKE_CATALOG_SEED));
  const catalogSha256=stored?.sha256??await intakeCatalogSha256(catalog);
  const records = intakeReferenceRecords(catalog);
  return {
    schemaVersion: INTAKE_REFERENCE_SCHEMA_VERSION,
    catalog, active: initialized ? catalog : null, initialized,
    catalogVersion: catalog.version, catalogSha256, records,
    counts: { features: catalog.features.length, documents: catalog.documents.length, rules: catalog.rules.length, sources: catalog.sources.length, enabledRules: catalog.rules.filter(rule => rule.enabled).length },
    monitoring: {
      supportedSourceIds: catalog.sources.filter(source => isOfficialMonitorUrl(source.url)).map(source => source.id),
      excludedSources: catalog.sources.filter(source => !isOfficialMonitorUrl(source.url)).map(source => ({ sourceId: source.id, url: source.url, reason: "not_official_monitor_domain" as const })),
      automaticUpdates: false,
    },
    readOnly: true, managementUrl: "/data/checklist", mutationEndpoint: "/api/checklist-catalog",
    note: initialized ? "실제 상담 서류 기준정보의 현재 저장 판본입니다. 변경은 서류 안내 기준 관리에서 검토 후 새 판본으로 저장합니다." : "아직 저장된 상담 서류 기준정보가 없어 실제 초기 카탈로그를 읽기 전용으로 표시합니다. 조회는 기준정보나 사건을 생성·변경하지 않습니다.",
  };
}

export async function intakeReferenceMonitorScope(database: D1Database) {
  const { records, catalogVersion, catalogSha256, initialized } = await readIntakeReferences(database);
  return { rules: intakeMonitorProjection(records), catalogVersion, catalogSha256, initialized };
}
export async function intakeReferenceMonitorRules(database: D1Database) {
  return (await intakeReferenceMonitorScope(database)).rules;
}
