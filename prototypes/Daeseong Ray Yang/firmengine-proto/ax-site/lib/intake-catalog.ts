import seed from "./reference-intake-catalog.json" with { type: "json" };
import type { IntakeCatalog } from "./intake-types.ts";
import { freezeReferenceValue } from "./reference-runtime.ts";

/** Immutable, lossless migration of the v33 consultation checklist master seed.
 * Runtime edits remain in intake_catalog_versions/intake_catalog_head.
 * Collection recommendations, jurisdiction, source and review boundaries are preserved.
 */
export const INTAKE_CATALOG_SEED: IntakeCatalog = freezeReferenceValue(seed as unknown as IntakeCatalog);
