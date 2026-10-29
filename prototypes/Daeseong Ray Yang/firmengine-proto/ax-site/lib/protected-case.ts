/** Opaque deny-list identity. No source case ID or source document metadata. */
export const PROTECTED_CASE_SHA256 = "1dfd979da22e0b7222eec78973c993ae0e1220748fd558ac2e236350c9d92aae";
export async function isProtectedCaseId(caseId:string):Promise<boolean>{
  const bytes=new TextEncoder().encode(caseId);
  const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(value=>value.toString(16).padStart(2,"0")).join("");
  return digest===PROTECTED_CASE_SHA256;
}
