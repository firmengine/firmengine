import { runWithReferenceContext } from "../lib/reference-context";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { drainCaseSubstitutionWatch } from "../lib/case-substitution-watch.ts";
import { getCase } from "../lib/server-store.ts";
import { getIntakeCatalog } from "../lib/intake-store.ts";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithReferenceContext(env.DB, () => runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx)));
  },
  // Scheduled events are supported when a Cloudflare Cron Trigger is enabled on
  // the existing Worker. A missing trigger does NOT imply unattended execution.
  scheduled(_event:ScheduledController, env:Cloudflare.Env, ctx:ExecutionContext) {
    if(!env.DB)return;
    ctx.waitUntil(runWithReferenceContext(env.DB,()=>
      drainCaseSubstitutionWatch(env.DB!,{limit:5,source:{
        getCase,getCatalogVersion:async()=>(await getIntakeCatalog()).catalog.version
      }})
    ).then(()=>undefined));
  },
};

export default worker;
