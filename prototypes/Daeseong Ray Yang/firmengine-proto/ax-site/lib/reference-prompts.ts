import promptPolicies from "./reference-prompt-policies.json" with { type: "json" };
import { readReferenceValue, referenceIdentity } from "./reference-runtime.ts";

export interface ReferencePromptPolicy {
  id: string;
  title: string;
  template: string;
  placeholders: string[];
  category: string;
  authority: string;
  sourceBindings: { path: string; symbol: string; line: number; sourceSha256: string }[];
  legalSourceIds: string[];
  reviewStatus: string;
  lockedSafetyInvariant: boolean;
  changePolicy: string;
  value?: number;
  valueType?: string;
}

/** Prompt data is separate from legal authority. An inherited instruction does
 * not certify a statute, a source value, or a case's legal recognition. */
export const REFERENCE_PROMPT_POLICIES: readonly ReferencePromptPolicy[] = promptPolicies.policies;
export const REFERENCE_PROMPT_SCHEMA_VERSION = promptPolicies.schemaVersion;
const byId = new Map(REFERENCE_PROMPT_POLICIES.map(policy => [policy.id, policy]));
if (byId.size !== REFERENCE_PROMPT_POLICIES.length) throw new Error("DUPLICATE_REFERENCE_PROMPT_ID");

export function referencePromptPolicy(id: string): ReferencePromptPolicy {
  const policy = byId.get(id);
  if (!policy) throw new Error("UNKNOWN_REFERENCE_PROMPT_POLICY");
  return policy;
}

/** Only named substitution is allowed; no source code or template expression
 * from a registry row is evaluated. Substituted text is never substituted again. */
export function renderPromptPolicy(id: string, params: Record<string, unknown> = {}): string {
  const policy = referencePromptPolicy(id);
  const template = readReferenceValue<unknown>(id, policy.template);
  if (typeof template !== "string") throw new Error("REFERENCE_PROMPT_TEMPLATE_TYPE_INVALID");
  if (!template.trim()) throw new Error("REFERENCE_PROMPT_TEMPLATE_BLANK");
  if (policy.lockedSafetyInvariant && template !== policy.template) throw new Error("REFERENCE_PROMPT_SAFETY_INVARIANT_LOCKED");
  const expected = new Set(policy.placeholders);
  const actual = new Set([...template.matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)].map(match => match[1]));
  if (actual.size !== expected.size || [...actual].some(key => !expected.has(key))) throw new Error("REFERENCE_PROMPT_PLACEHOLDERS_CHANGED");
  if (Object.keys(params).some(key => !expected.has(key)) || [...expected].some(key => !Object.hasOwn(params, key))) throw new Error("REFERENCE_PROMPT_PARAMETERS_INVALID");
  return template.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (_token, key: string) => String(params[key]));
}

/** Operating budgets are application parameters, never legal money or term thresholds. */
export function readPromptPolicyInteger(id: string): number {
  const policy = referencePromptPolicy(id);
  if (policy.valueType !== "integer" || !Number.isSafeInteger(policy.value)) throw new Error("REFERENCE_PROMPT_INTEGER_UNDECLARED");
  const raw = readReferenceValue<unknown>(id, policy.value);
  const value = typeof raw === "number" ? raw : typeof raw === "string" && /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("REFERENCE_PROMPT_INTEGER_INVALID");
  if (policy.lockedSafetyInvariant && value !== policy.value) throw new Error("REFERENCE_PROMPT_SAFETY_INVARIANT_LOCKED");
  return value;
}

/** Resolve legal-review policy within the current request's reference context.
 * The compact identity records provenance without injecting the source inventory. */
export function legalReviewInstructions(): string {
  return renderPromptPolicy("prompt.pipeline.legal_reviewer.instructions") + "\n기준정보 판본: " + JSON.stringify(referenceIdentity() ?? { status: "compiled_seed_no_active_snapshot" });
}
