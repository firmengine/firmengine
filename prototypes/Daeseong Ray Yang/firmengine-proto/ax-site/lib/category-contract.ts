/** Shared record category vocabulary. These are source labels, not family allowlists. */
export const RECORD_CATEGORIES = ["person", "income", "debt", "asset", "transaction", "household", "business", "statement", "other"] as const;
export type RecordCategory = typeof RECORD_CATEGORIES[number];
export const RECORD_CATEGORY_STATUS_PROMPT_VERSION = "luna-evidence-3.21.0" as const;

export const RECORD_CATEGORY_POLICY = {
  person: "사람·주체에 관한 원문 행",
  income: "소득 또는 수입에 관한 원문 행",
  debt: "채무·청구에 관한 원문 행",
  asset: "자산·재산에 관한 원문 행",
  transaction: "개별 거래에 관한 원문 행",
  household: "가구·가족 구성에 관한 원문 행",
  business: "사업체·사업 활동에 관한 원문 행",
  statement: "진술·서술 문단에 관한 원문 행",
  other: "위 범주에 안전하게 속하지 않는 원문 행",
} satisfies Record<RecordCategory, string>;

export const RECORD_CATEGORY_POLICY_INSTRUCTIONS = `공통 record.category 계약(문서 family별 허용목록이 아님): ${RECORD_CATEGORIES.map(category => `${category}=${RECORD_CATEGORY_POLICY[category]}`).join("; ")}. category는 원문 행의 거친 source grouping이며 field.key, canonicalFieldId 또는 사실 의미를 대신하지 않는다. family별 category 허용목록을 만들거나 문서 종류만으로 category를 강제하지 않는다. 원문을 더 잘 설명하는 grouping이 불확실하면 category를 추정·정규화하지 말고 현재 관찰을 보존한다. category만으로 필드를 맞다고 판정하거나 의미가 맞는 field를 틀렸다고 판정하지 않는다. category 판단과 각 field의 원문 의미 판단을 분리한다. 실제 field 의미·주체·행/열·시점·단위·근거가 불일치하면 해당 field는 계속 wrong_field/unclear이며 category가 이를 상쇄하지 않는다. category를 자동 재분류해 typed projection을 만들지 않는다.`;

/** Only well-formed historical prompt versions below v3.20 retain legacy status omission behavior. */
export function requiresRecordCategoryStatus(promptVersion: string): boolean {
  const match = /^luna-evidence-(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(promptVersion);
  if (!match) return true;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 3 || major === 3 && (minor > 20 || minor === 20 && patch >= 0);
}
