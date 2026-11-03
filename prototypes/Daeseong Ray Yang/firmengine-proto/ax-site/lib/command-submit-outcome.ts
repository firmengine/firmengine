/** Command POST acknowledgement is separate from HTTP success, refresh and legal approval. */
export type CommandSubmitOutcome = "committed" | "rejected" | "uncertain";
/** 202 evaluation-pending can follow a committed command. Do not mistake it for a rejected write. */
export function hasCommittedCommandReceipt(body:unknown):boolean {
  return !!body&&typeof body==="object"&&!Array.isArray(body)&&
    (body as {committed?:unknown}).committed===true;
}
