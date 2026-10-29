import { createSiteCalculatorHandler } from "../../lib/site-calculator-mcp";
import { db, getCase } from "../../lib/server-store";
import { REFERENCE_RELEASE, referenceRecordsPage } from "../../lib/reference-registry.ts";
import { currentReferenceSnapshot } from "../../lib/reference-runtime.ts";
import { legalMonitorOverview, runStoredLegalMonitor } from "../../lib/legal-monitor-store.ts";
import { readIntakeReferences } from "../../lib/intake-reference-store.ts";

// Sites checks the existing owner-private audience before forwarding /mcp.
// Case tools remain read-only. Monitor writes are explicitly annotated, isolated
// to reference observations/alerts and cannot authorize case recognition.
const handler=createSiteCalculatorHandler(getCase,{
  catalog:async input=>({release:REFERENCE_RELEASE,active:currentReferenceSnapshot(),...referenceRecordsPage(input)}),
  monitor:runStoredLegalMonitor,
  alerts:legalMonitorOverview,
  intake:()=>readIntakeReferences(db()),
});
export async function POST(request:Request){return handler.fetch(request);}
