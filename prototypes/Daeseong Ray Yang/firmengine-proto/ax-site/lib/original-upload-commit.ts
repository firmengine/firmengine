/**
 * A remote D1 write may commit but lose its acknowledgement. In that state the
 * newly uploaded R2 object must not be deleted before confirming the pointer.
 * Uncertain writes are intentionally left for an operator/reconciliation job:
 * an orphan is safer than an active SQL pointer to deleted evidence.
 */
export interface OriginalUploadPointer {
  sha256: string;
  original_key: string | null;
  ready: number;
}

export class OriginalUploadCommitUncertain extends Error {
  readonly retainObject = true;
  constructor(cause: unknown) {
    super("ORIGINAL_UPLOAD_COMMIT_UNCONFIRMED", { cause });
    this.name = "OriginalUploadCommitUncertain";
  }
}

export interface OriginalUploadCommitInput {
  objectKey: string;
  expectedSha256: string;
  /** Return the SQL change count from the atomic pointer update. */
  writePointer: () => Promise<number>;
  /** Read the committed SQL pointer after a lost write acknowledgement. */
  readPointer: () => Promise<OriginalUploadPointer | null>;
}

export interface OriginalUploadCommitResult {
  retainObject: boolean;
  idempotent?: true;
  recovered?: true;
}

export async function commitOriginalUploadPointer(input: OriginalUploadCommitInput): Promise<OriginalUploadCommitResult> {
  let writeFailed = false;
  let writeError: unknown;
  try {
    const changes = await input.writePointer();
    if (changes > 0) return { retainObject: true };
  } catch (error) {
    writeFailed = true;
    writeError = error;
  }

  let current: OriginalUploadPointer | null;
  try {
    current = await input.readPointer();
  } catch (readError) {
    if (writeFailed) throw new OriginalUploadCommitUncertain(writeError);
    throw readError;
  }

  if (current?.ready === 1 && current.sha256 === input.expectedSha256 && current.original_key) {
    if (current.original_key === input.objectKey) {
      return { retainObject: true, ...(writeFailed ? { recovered: true as const } : {}) };
    }
    // A competing upload already owns the SQL pointer. Our private key can be removed.
    return { retainObject: false, idempotent: true };
  }
  if (writeFailed) throw new OriginalUploadCommitUncertain(writeError);
  throw new Error("ORIGINAL_UPLOAD_POINTER_CONFLICT");
}
