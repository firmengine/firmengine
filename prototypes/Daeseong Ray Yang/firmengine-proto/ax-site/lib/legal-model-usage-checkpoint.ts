/** Best-effort event only after a paid legal model response is in memory.
 * Usage and this warning must also be kept in the durable legal advisory.
 * This does not guarantee provider-side idempotency on lost API responses.
 */
export async function recordBestEffortLegalUsageEvent(writeEvent:()=>Promise<unknown>):Promise<boolean>{
  try{await writeEvent();return false;}
  catch{return true;}
}
