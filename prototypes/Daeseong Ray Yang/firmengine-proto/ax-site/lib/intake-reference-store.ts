import { INTAKE_CATALOG_SEED } from "./intake-catalog.ts";
import { validateIntakeCatalog } from "./intake-engine.ts";
import { INTAKE_REFERENCE_SCHEMA_VERSION, intakeMonitorProjection, intakeReferenceRecords } from "./intake-reference.ts";
import { isOfficialMonitorUrl } from "./legal-monitor-core.ts";

const hash = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const HASH = /^[a-f0-9]{64}$/;
type CatalogSnapshot = {
  headVersion: number; headSha256: string; storedVersion: number | null;
  schemaVersion: string | null; payload: string | null; storedSha256: string | null;
};

/** One SELECT reads a consistent catalogue head/version pair. GET/MCP never seed. */
export async function readIntakeReferences(database: D1Database) {
  const stored = await database.prepare(`SELECT head.version AS headVersion, head.sha256 AS headSha256,
    version.version AS storedVersion, version.schema_version AS schemaVersion,
    version.payload AS payload, version.sha256 AS storedSha256
    FROM intake_catalog_head AS head
    LEFT JOIN intake_catalog_versions AS version ON version.version = head.version
    WHERE head.id = 'default'`).first<CatalogSnapshot>();
  const initialized = stored !== null;
  let catalog;
  try {
    if (stored && (!Number.isSafeInteger(stored.headVersion) || stored.headVersion < 1 || stored.storedVersion !== stored.headVersion ||
      stored.schemaVersion !== INTAKE_REFERENCE_SCHEMA_VERSION || typeof stored.payload !== "string" ||
      !HASH.test(stored.headSha256) || stored.storedSha256 !== stored.headSha256)) throw new Error("invalid stored catalogue metadata");
    catalog = validateIntakeCatalog(stored ? JSON.parse(stored.payload!) : structuredClone(INTAKE_CATALOG_SEED));
  } catch {
    throw new Error("INTAKE_CATALOG_INTEGRITY_FAILED");
  }
  const catalogSha256 = await hash(catalog);
  if (stored && (catalog.version !== stored.headVersion || catalogSha256 !== stored.headSha256)) throw new Error("INTAKE_CATALOG_INTEGRITY_FAILED");
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
