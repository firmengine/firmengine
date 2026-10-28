import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable("cases", {
  id: text("id").primaryKey(), name: text("name").notNull(),
  owner: text("owner").notNull(), revision: integer("revision").notNull(),
  storageToken: text("storage_token").notNull().default(""),
  payload: text("payload").notNull(), createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(),
  name: text("name").notNull(), sha256: text("sha256").notNull(),
  pageCount: integer("page_count").notNull(), originalKey: text("original_key"),
  ready: integer("ready").notNull().default(0), createdAt: text("created_at").notNull(),
}, t => [index("documents_case_idx").on(t.caseId)]);
export const pageJobs = sqliteTable("page_jobs", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(), documentId: text("document_id").notNull(),
  page: integer("page").notNull(), role: text("role").notNull(), documentType: text("document_type"),
  imageKey: text("image_key"), imageHash: text("image_hash"), status: text("status").notNull(),
  stage: text("stage").notNull().default("waiting"), attempts: integer("attempts").notNull().default(0),
  leaseUntil: text("lease_until"), cacheKey: text("cache_key"), result: text("result"),
  error: text("error"), updatedAt: text("updated_at").notNull(),
}, t => [index("page_jobs_case_idx").on(t.caseId)]);
export const pageDerivatives = sqliteTable("page_derivatives", {
  id:text("id").primaryKey(),caseId:text("case_id").notNull(),documentId:text("document_id").notNull(),page:integer("page").notNull(),planId:text("plan_id").notNull().default("legacy"),sourceHash:text("source_hash").notNull(),baseImageHash:text("base_image_hash").notNull(),variantHash:text("variant_hash").notNull(),variant:text("variant").notNull(),objectKey:text("object_key").notNull(),bbox:text("bbox").notNull(),transform:text("transform").notNull(),createdAt:text("created_at").notNull(),
},t=>[index("page_derivatives_page_idx").on(t.caseId,t.documentId,t.page)]);
export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(), revision: integer("revision").notNull(),
  name: text("name").notNull(), kind: text("kind").notNull(), objectKey: text("object_key").notNull(),
  hash: text("hash").notNull(), mime: text("mime").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("artifacts_case_idx").on(t.caseId)]);
export const events = sqliteTable("events", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(), actor: text("actor").notNull(),
  type: text("type").notNull(), detail: text("detail").notNull(), at: text("at").notNull(),
}, t => [index("events_case_idx").on(t.caseId)]);
export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull(), revision: integer("revision").notNull(),
  type: text("type").notNull(), payload: text("payload").notNull(), at: text("at").notNull(),
}, t => [index("analyses_case_idx").on(t.caseId)]);

// A separate, versioned reference schema for consultation intake. The payload
// contains typed feature, document, rule and source collections; case facts and
// calculation inputs are deliberately not stored or changed by this module.
export const intakeCatalogVersions = sqliteTable("intake_catalog_versions", {
  version: integer("version").primaryKey(), schemaVersion:text("schema_version").notNull(),
  payload:text("payload").notNull(), sha256:text("sha256").notNull(),
  actor:text("actor").notNull(), createdAt:text("created_at").notNull(),
});
export const intakeCatalogHead = sqliteTable("intake_catalog_head", {
  id:text("id").primaryKey(), version:integer("version").notNull(), sha256:text("sha256").notNull(),
});
export const consultationHeads = sqliteTable("consultation_heads", {
  caseId:text("case_id").primaryKey(), revision:integer("revision").notNull().default(0),
  activeRunId:text("active_run_id"), updatedAt:text("updated_at").notNull(),
});
export const consultationNotes = sqliteTable("consultation_notes", {
  id:text("id").primaryKey(), caseId:text("case_id").notNull(), sequence:integer("sequence").notNull(),
  text:text("text").notNull(), textSha256:text("text_sha256").notNull(), occurredAt:text("occurred_at"),
  supersedesId:text("supersedes_id"), actor:text("actor").notNull(), createdAt:text("created_at").notNull(),
}, t=>[index("consultation_notes_case_idx").on(t.caseId,t.sequence)]);
export const consultationRuns = sqliteTable("consultation_runs", {
  id:text("id").primaryKey(), caseId:text("case_id").notNull(), fingerprint:text("fingerprint").notNull().unique(),
  caseRevision:integer("case_revision").notNull(), caseStorageToken:text("case_storage_token").notNull(),
  consultationRevision:integer("consultation_revision").notNull(), catalogVersion:integer("catalog_version").notNull(),
  status:text("status").notNull(), leaseUntil:text("lease_until"), payload:text("payload"), payloadSha256:text("payload_sha256"), error:text("error"),
  actor:text("actor").notNull(), createdAt:text("created_at").notNull(), updatedAt:text("updated_at").notNull(),
},t=>[index("consultation_runs_case_idx").on(t.caseId,t.createdAt)]);
