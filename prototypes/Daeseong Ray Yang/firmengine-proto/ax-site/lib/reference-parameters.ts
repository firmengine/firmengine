import seed from "./reference-parameters.json" with { type: "json" };
import { readReferenceValue } from "./reference-runtime.ts";

export type ReferenceParameterCategory = "statute" | "court_practice" | "application_policy" | "arithmetic_policy";
export interface ReferenceParameterDefinition {
  id: string;
  title: string;
  category: ReferenceParameterCategory;
  value: unknown;
  unit: string;
  description: string;
  sourceIds: string[];
  sourceUrls: string[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
  courtIds: string[];
  verification: "inherited" | "unverified" | "source_verified";
  consumers: { path: string; symbol: string }[];
  changePolicy: "human_review_required";
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Immutable migration seed. Runtime values are resolved again for every use. */
export const REFERENCE_PARAMETER_ROWS: readonly ReferenceParameterDefinition[] = freeze(seed.parameters as ReferenceParameterDefinition[]);
const definitions = new Map(REFERENCE_PARAMETER_ROWS.map(row => [row.id, row]));
if (definitions.size !== REFERENCE_PARAMETER_ROWS.length) throw new Error("Duplicate reference parameter ID");

export function referenceParameterDefinition(id: string): ReferenceParameterDefinition {
  const row = definitions.get(id);
  if (!row) throw new Error(`Unknown reference parameter: ${id}`);
  return row;
}

/** No eval, generated code, module-global mutable override, or silent value coercion. */
export function referenceParameter<T>(id: string): T {
  return readReferenceValue<T>(id, referenceParameterDefinition(id).value as T);
}

export function referencePositiveInteger(id: string): number {
  const value = referenceParameter<unknown>(id);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`Reference parameter requires a positive safe integer: ${id}`);
  return value;
}
export function referenceMoney(id: string): string {
  const value = referenceParameter<unknown>(id);
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`Reference parameter requires an integer KRW string: ${id}`);
  return value;
}
export interface ReferenceRatio { numerator: number; denominator: number }
export function referenceRatio(id: string): ReferenceRatio {
  const value = referenceParameter<ReferenceRatio>(id);
  if (!value || !Number.isSafeInteger(value.numerator) || value.numerator < 0 || !Number.isSafeInteger(value.denominator) || value.denominator <= 0) throw new Error(`Reference parameter requires an explicit nonnegative rational: ${id}`);
  return value;
}
export const maximumCalculationMonths = () => referencePositiveInteger("param.policy.arithmetic.maximum_period_months");
export function maximumPlanMonths(): number {
  const value = referencePositiveInteger("param.national.term.exceptional_max_months");
  if (value > maximumCalculationMonths()) throw new Error("Plan term reference exceeds the explicit arithmetic safety limit");
  return value;
}
export const ordinaryPlanMonths = () => referencePositiveInteger("param.national.term.ordinary_months");
export const shareBasisPoints = () => referencePositiveInteger("param.policy.arithmetic.share_basis_points");
export const referenceFormula = (id: string) => referenceParameter<string>(`param.formula.${id}`);
