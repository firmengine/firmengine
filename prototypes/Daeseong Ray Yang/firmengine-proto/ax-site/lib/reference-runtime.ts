/** Browser-safe reference access. Server values come from a request-scoped provider.
 * No case, credential, mutable global rule map or authority decision is stored here. */
export interface ReferenceSnapshot {
  id: string;
  revision: number;
  sha256: string;
  values: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, { sourceUrls: string[]; effectiveFrom: string | null; reason: string; reviewedAt: string; reviewedBy: string; recordSha256: string; basisType: string; applicationContract?: {dateBasis?:string;jurisdiction?:string|null;effectiveTo?:string|null;transition?:{status:"declared"|"unknown";from?:string;to?:string;conditions?:string[]}} }>>;
  bundleReview?: { status:"verified"; basedOnSha256:string; artifactIds:readonly string[]; artifacts:readonly {id:string;revision:string;sha256:string;effectiveFrom?:string|null;effectiveTo?:string|null;jurisdiction?:string|null;dateBasis?:string|null;transition?:{status:"declared"|"unknown";from?:string;to?:string;conditions?:string[]}}[]; reason:string; reviewedAt:string; reviewedBy:string };
}

export function freezeReferenceValue<T>(value:T):T {
  if(value&&typeof value==="object"){
    for(const child of Object.values(value))freezeReferenceValue(child);
    Object.freeze(value);
  }
  return value;
}

export async function referenceSnapshotHash(seed:string,values:Readonly<Record<string,unknown>>,metadata:ReferenceSnapshot["metadata"]={},bundleReview?:ReferenceSnapshot["bundleReview"]):Promise<string>{
  const bytes=new TextEncoder().encode(JSON.stringify({seed,values,metadata,...(bundleReview?{bundleReview}: {})}));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");
}

type ReferenceProvider = () => ReferenceSnapshot | undefined;
let provider: ReferenceProvider | undefined;

/** Install the resolver, never a server request's values. */
export function installReferenceProvider(resolve: ReferenceProvider): void { provider = resolve; }

export function currentReferenceSnapshot(): ReferenceSnapshot | undefined { return provider?.(); }

export function readReferenceValue<T>(id: string, fallback: T): T {
  const values = currentReferenceSnapshot()?.values;
  return values && Object.hasOwn(values, id) ? values[id] as T : fallback;
}

/** A browser gets the same reviewed release used by its API response. */
export function installBrowserReferenceSnapshot(snapshot: ReferenceSnapshot): void {
  if (typeof window === "undefined") throw new Error("BROWSER_REFERENCE_CONTEXT_REQUIRED");
  const frozen=freezeReferenceValue(snapshot);
  provider = () => frozen;
}

export function referenceIdentity(): { id: string; revision: number; sha256: string } | undefined {
  const snapshot = currentReferenceSnapshot();
  return snapshot ? { id: snapshot.id, revision: snapshot.revision, sha256: snapshot.sha256 } : undefined;
}
