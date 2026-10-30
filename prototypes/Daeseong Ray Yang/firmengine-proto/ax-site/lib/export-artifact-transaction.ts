/**
 * Stages one export's objects and artifact rows, then commits its manifest.
 * The manifest hook is the commit point: keep logging and other fallible
 * post-commit work outside it (or in `afterCommit`).
 */
export interface StagedExportArtifact<RecordType extends { id: string }> {
  record: RecordType;
  objectKey: string;
  bytes: Uint8Array;
  mime: string;
}

export interface ExportArtifactCleanupReport<RecordType extends { id: string }> {
  originalError: unknown;
  records: readonly RecordType[];
  objectKeys: readonly string[];
  cleanupErrors: readonly unknown[];
}

export interface ExportArtifactCommitUncertainReport<RecordType extends { id: string }> {
  originalError: unknown;
  records: readonly RecordType[];
  objectKeys: readonly string[];
}

export interface ExportArtifactTransactionInput<RecordType extends { id: string }, Result> {
  artifacts: readonly StagedExportArtifact<RecordType>[];
  upload: (objectKey: string, bytes: Uint8Array, mime: string) => Promise<unknown>;
  persistRecords: (records: readonly RecordType[]) => Promise<unknown>;
  /** Must resolve only after the manifest CAS has committed successfully. */
  commitManifest: (records: readonly RecordType[]) => Promise<Result>;
  /** Delete only rows owned by these invocation records (ideally id + objectKey). */
  deleteRecords: (records: readonly RecordType[]) => Promise<unknown>;
  /** Delete only the exact object key supplied by this invocation. */
  deleteObject: (objectKey: string) => Promise<unknown>;
  /** Durable export opt-in: ambiguous pre-manifest R2/D1 outcomes must retain evidence.
   * This can leave orphans; it never authorizes replay, deletion or approval. */
  preservePreCommitFailureEvidence?: boolean;
  /** Optional evidence-only notification for the opted-in pre-commit preserve path. */
  onPreCommitUncertain?: (report: ExportArtifactCommitUncertainReport<RecordType>) => Promise<unknown> | unknown;
  /** Runs after the manifest commit. A failure here must never roll back artifacts. */
  afterCommit?: (result: Result) => Promise<unknown>;
  /** Receives cleanup failures. Its own failure is swallowed to preserve the original error. */
  onCleanupFailure?: (report: ExportArtifactCleanupReport<RecordType>) => Promise<unknown> | unknown;
  /** If a manifest write was attempted and its response is lost, SQL may already
   * reference these exact R2 bytes. Report the uncertainty for reconciliation.
   * Reporting failures never authorize destructive cleanup.
   */
  onCommitUncertain?: (report: ExportArtifactCommitUncertainReport<RecordType>) => Promise<unknown> | unknown;
}

function assertUniqueInvocationTargets<RecordType extends { id: string }>(artifacts: readonly StagedExportArtifact<RecordType>[]) {
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const artifact of artifacts) {
    if (!artifact.record.id || !artifact.objectKey) throw new Error("EXPORT_ARTIFACT_TARGET_MISSING");
    if (ids.has(artifact.record.id) || keys.has(artifact.objectKey)) throw new Error("EXPORT_ARTIFACT_TARGET_DUPLICATE");
    ids.add(artifact.record.id);
    keys.add(artifact.objectKey);
  }
}

function attachCleanupErrors(originalError: unknown, cleanupErrors: readonly unknown[]) {
  if (!cleanupErrors.length || (typeof originalError !== "object" && typeof originalError !== "function") || originalError === null) return;
  try {
    Object.defineProperty(originalError, "artifactCleanupErrors", {
      configurable: true,
      enumerable: false,
      value: cleanupErrors,
    });
  } catch {
    // The callback below is the reporting path for frozen or primitive errors.
  }
}

/**
 * Uploads and persists only the supplied invocation's artifacts before saving
 * the case manifest. Any failure before the manifest commit triggers best-effort
 * cleanup of invocation-owned rows and attempted keys by default. Durable
 * exports must opt into evidence preservation where R2/D1 ACKs are ambiguous;
 * such evidence requires explicit reconciliation, not automatic reuse/deletion.
 */
export async function commitExportArtifactTransaction<RecordType extends { id: string }, Result>(
  input: ExportArtifactTransactionInput<RecordType, Result>,
): Promise<Result> {
  assertUniqueInvocationTargets(input.artifacts);
  const records = input.artifacts.map((artifact) => artifact.record);
  const attemptedObjectKeys: string[] = [];
  let persistenceAttempted = false;
  let manifestCommitAttempted = false;

  let result: Result;
  try {
    for (const artifact of input.artifacts) {
      // Track before awaiting: a rejected upload may still have written bytes.
      attemptedObjectKeys.push(artifact.objectKey);
      await input.upload(artifact.objectKey, artifact.bytes, artifact.mime);
    }
    persistenceAttempted = true;
    await input.persistRecords(records);
    manifestCommitAttempted = true;
    result = await input.commitManifest(records);
  } catch (originalError) {
    if (manifestCommitAttempted) {
      // A D1 write can commit and lose its acknowledgement; even a reported
      // conflict cannot prove all delayed commits are absent. Never delete a
      // possibly live manifest's SQL rows or R2 bytes. Preserve for reconciliation.
      try {
        await input.onCommitUncertain?.({ originalError, records, objectKeys: attemptedObjectKeys });
      } catch {
        // Reporting cannot hide the original failure or permit data deletion.
      }
      throw originalError;
    }
    if (input.preservePreCommitFailureEvidence) {
      // A rejected upload may have already written R2 bytes; a rejected D1
      // batch may likewise have committed rows but lost its response. Keep
      // both until independently reconciled. The caller must mark its receipt
      // uncertain and MUST NOT automatically reclaim or approve it.
      try {
        await input.onPreCommitUncertain?.({ originalError, records, objectKeys: attemptedObjectKeys });
      } catch {
        // Failure to record the warning is not permission to delete evidence.
      }
      throw originalError;
    }
    const cleanupTasks: Promise<unknown>[] = [];
    if (persistenceAttempted && records.length) {
      cleanupTasks.push(Promise.resolve().then(() => input.deleteRecords(records)));
    }
    for (const objectKey of attemptedObjectKeys) {
      cleanupTasks.push(Promise.resolve().then(() => input.deleteObject(objectKey)));
    }
    const settled = await Promise.allSettled(cleanupTasks);
    const cleanupErrors = settled.flatMap((item) => item.status === "rejected" ? [item.reason] : []);
    attachCleanupErrors(originalError, cleanupErrors);
    if (cleanupErrors.length) {
      try {
        await input.onCleanupFailure?.({ originalError, records, objectKeys: attemptedObjectKeys, cleanupErrors });
      } catch {
        // Reporting must not mask the operation's original failure.
      }
    }
    throw originalError;
  }

  // This is deliberately outside the pre-commit catch: post-commit logging
  // failures are visible to the caller but cannot delete committed artifacts.
  await input.afterCommit?.(result);
  return result;
}
