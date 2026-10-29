/** Client-side retry identity for legacy PATCH adapters. Reuse an ID only for the same frozen payload. */
export interface PendingClientMutation { key: string; commandId: string }
export interface MutableRef<T> { current: T }
export function legacyCommandId(ref: MutableRef<PendingClientMutation | null>, key: string): string {
  if (ref.current && ref.current.key !== key) throw new Error("저장 결과를 확인하지 못한 변경이 있습니다. 같은 내용을 다시 저장해 확인한 뒤 다른 변경을 시작하세요.");
  if (!ref.current) ref.current = { key, commandId: crypto.randomUUID() };
  return ref.current.commandId;
}
export function clearLegacyCommandId(ref: MutableRef<PendingClientMutation | null>, key?: string) {
  if (!key || ref.current?.key === key) ref.current = null;
}
export class MutationHttpError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = "MutationHttpError"; this.status=status; }
}
/** A 2xx response is a committed mutation only when it contains a usable authoritative snapshot. */
export function requireUsableCaseSnapshot<T>(value: T, expectedCaseId: string, status = 0): T & { case: { context: { id: string; revision: number }; clientStateFingerprint: string } } {
  const record=value&&typeof value==="object"?value as Record<string,unknown>:null;
  const snapshot=record?.case&&typeof record.case==="object"?record.case as Record<string,unknown>:null;
  const context=snapshot?.context&&typeof snapshot.context==="object"?snapshot.context as Record<string,unknown>:null;
  if(!context||context.id!==expectedCaseId||!Number.isSafeInteger(context.revision)||Number(context.revision)<1||typeof snapshot?.clientStateFingerprint!=="string"||!snapshot.clientStateFingerprint){
    throw new MutationHttpError("저장 결과를 확인하지 못했습니다. 같은 내용을 다시 저장해 결과를 확인하세요.",status);
  }
  return value as T & { case: { context: { id: string; revision: number }; clientStateFingerprint: string } };
}
export function isKnownMutationRejection(error: unknown): boolean {
  return !!error && typeof error === "object" && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500;
}
