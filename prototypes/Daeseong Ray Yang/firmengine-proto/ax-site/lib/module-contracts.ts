/** Derived, explicit contracts over the current canonical catalogs. This module does not change runtime decisions. */
import contracts from "./module-contracts.generated.json" with { type: "json" };
export type ModuleContracts = typeof contracts;
export const MODULE_CONTRACTS = contracts satisfies ModuleContracts;
export type FieldCrosswalk = ModuleContracts["fieldCrosswalk"][number];
export function fieldContract(fieldId: string): FieldCrosswalk | undefined { return MODULE_CONTRACTS.fieldCrosswalk.find(field => field.fieldId === fieldId); }
export function contractsForFamily(familyId: string): FieldCrosswalk[] { return MODULE_CONTRACTS.fieldCrosswalk.filter(field => field.familyId === familyId); }
