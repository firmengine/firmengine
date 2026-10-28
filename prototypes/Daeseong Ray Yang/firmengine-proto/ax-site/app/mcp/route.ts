import { createSiteCalculatorHandler } from "../../lib/site-calculator-mcp";
import { getCase } from "../../lib/server-store";

// Sites checks the existing owner-private audience before forwarding /mcp.
// All exposed tools are read-only and case lookup uses the same canonical store.
const handler=createSiteCalculatorHandler(getCase);
export async function POST(request:Request){return handler.fetch(request);}
