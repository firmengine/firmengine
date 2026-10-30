/** Compatibility alias only: canonical staff handoff implementation checks
 * original R2 SHA-256, exact D1 heads, human authorization and CAS.
 * This route must not implement a second, weaker review transition.
 */
import {POST as canonicalPOST} from "../../automatic-draft-handoff/route.ts";
export const runtime="edge";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 return canonicalPOST(request,context);
}
