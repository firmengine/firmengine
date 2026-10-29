import { renderPromptPolicy } from "./reference-prompts.ts";
/** Shared record category vocabulary. These are source labels, not family allowlists. */
export const RECORD_CATEGORIES = ["person", "income", "debt", "asset", "transaction", "household", "business", "statement", "other"] as const;
export type RecordCategory = typeof RECORD_CATEGORIES[number];
export const RECORD_CATEGORY_STATUS_PROMPT_VERSION = "luna-evidence-3.21.0" as const;

export const RECORD_CATEGORY_POLICY = {
  person: renderPromptPolicy("prompt.category_contract.record_category_policy.person"),
  income: renderPromptPolicy("prompt.category_contract.record_category_policy.income"),
  debt: renderPromptPolicy("prompt.category_contract.record_category_policy.debt"),
  asset: renderPromptPolicy("prompt.category_contract.record_category_policy.asset"),
  transaction: renderPromptPolicy("prompt.category_contract.record_category_policy.transaction"),
  household: renderPromptPolicy("prompt.category_contract.record_category_policy.household"),
  business: renderPromptPolicy("prompt.category_contract.record_category_policy.business"),
  statement: renderPromptPolicy("prompt.category_contract.record_category_policy.statement"),
  other: renderPromptPolicy("prompt.category_contract.record_category_policy.other"),
} satisfies Record<RecordCategory, string>;

export const RECORD_CATEGORY_POLICY_INSTRUCTIONS = renderPromptPolicy("prompt.category_contract.record_category_policy_instructions", {value1: RECORD_CATEGORIES.map(category => renderPromptPolicy("prompt.category_contract.record_category_policy_instructions.part_2", {value1: category, value2: RECORD_CATEGORY_POLICY[category]})).join("; ")});

/** Only well-formed historical prompt versions below v3.20 retain legacy status omission behavior. */
export function requiresRecordCategoryStatus(promptVersion: string): boolean {
  const match = /^luna-evidence-(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(promptVersion);
  if (!match) return true;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 3 || major === 3 && (minor > 20 || minor === 20 && patch >= 0);
}
