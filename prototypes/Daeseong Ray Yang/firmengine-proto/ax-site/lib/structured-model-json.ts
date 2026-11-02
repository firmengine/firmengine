/** Runtime safety check for parsed Responses API JSON.
 * The API's strict json_schema request is not itself proof that a received
 * payload satisfies the same schema. This guard covers the structural JSON
 * Schema keywords emitted by our agent contracts. Semantic/source acceptance
 * remains the responsibility of each pipeline stage.
 */
type Schema = Record<string, unknown>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function typeMatches(value: unknown, type: string): boolean {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isRecord(value);
  if (type === "integer") return typeof value === "number" && Number.isSafeInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return type === "string" ? typeof value === "string" : type === "boolean" && typeof value === "boolean";
}
function definition(root: Schema, path: string): Schema | null {
  if (!path.startsWith("#/")) return null;
  let current: unknown = root;
  for (const segment of path.slice(2).split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isRecord(current) || !Object.hasOwn(current, key)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}
export function structuredModelJsonMatchesSchema(value: unknown, schema: unknown): boolean {
  if (!isRecord(schema)) return false;
  let checked = 0;
  const match = (input: unknown, ruleValue: unknown, depth: number): boolean => {
    if (++checked > 50_000 || depth > 64 || !isRecord(ruleValue)) return false;
    const rule = ruleValue as Schema;
    if (typeof rule.$ref === "string") {
      const resolved = definition(schema, rule.$ref);
      if (!resolved || !match(input, resolved, depth + 1)) return false;
    }
    if (Array.isArray(rule.anyOf) && !rule.anyOf.some(s => match(input, s, depth + 1))) return false;
    if (Array.isArray(rule.oneOf) && rule.oneOf.filter(s => match(input, s, depth + 1)).length !== 1) return false;
    if (Array.isArray(rule.allOf) && !rule.allOf.every(s => match(input, s, depth + 1))) return false;
    if (Object.hasOwn(rule,"const") && JSON.stringify(input) !== JSON.stringify(rule.const)) return false;
    if (Array.isArray(rule.enum) && !rule.enum.some(v => JSON.stringify(input) === JSON.stringify(v))) return false;
    const types = typeof rule.type === "string" ? [rule.type] : Array.isArray(rule.type) ? rule.type : [];
    if (types.length && (!types.every(type => typeof type === "string") || !types.some(type => typeMatches(input,type)))) return false;
    if (isRecord(input)) {
      const props = isRecord(rule.properties) ? rule.properties : {};
      if (Array.isArray(rule.required) && rule.required.some(key => typeof key !== "string" || !Object.hasOwn(input,key))) return false;
      if (typeof rule.minProperties === "number" && Object.keys(input).length < rule.minProperties) return false;
      if (typeof rule.maxProperties === "number" && Object.keys(input).length > rule.maxProperties) return false;
      for (const [key,v] of Object.entries(input)) {
        if (Object.hasOwn(props,key)) {
          if (!match(v, props[key], depth + 1)) return false;
        } else if (rule.additionalProperties === false) return false;
        else if (isRecord(rule.additionalProperties) && !match(v,rule.additionalProperties,depth+1)) return false;
      }
    } else if (rule.type === "object" || rule.properties !== undefined || rule.required !== undefined) return false;
    if (Array.isArray(input)) {
      if (typeof rule.minItems === "number" && input.length < rule.minItems) return false;
      if (typeof rule.maxItems === "number" && input.length > rule.maxItems) return false;
      if (rule.items !== undefined && !input.every(item => match(item, rule.items, depth + 1))) return false;
    } else if (rule.type === "array" || rule.items !== undefined) return false;
    if (typeof input === "string") {
      if (typeof rule.minLength === "number" && input.length < rule.minLength) return false;
      if (typeof rule.maxLength === "number" && input.length > rule.maxLength) return false;
      if (typeof rule.pattern === "string") {
        try { if (!new RegExp(rule.pattern).test(input)) return false; } catch { return false; }
      }
    }
    if (typeof input === "number") {
      if (typeof rule.minimum === "number" && input < rule.minimum) return false;
      if (typeof rule.maximum === "number" && input > rule.maximum) return false;
    }
    return true;
  };
  return match(value,schema,0);
}
