/**
 * Deterministic corpus metrics. Expected documents and fields are the scoring
 * denominator; predictions never add, remove, or redefine that denominator.
 */
export type CorpusOrigin = "real_case" | "synthetic" | "public_example";
export type OfficeCheck = "valid" | "invalid" | "not_run";
export interface ExpectedField { key: string; value: unknown; critical: boolean; requiresSourceRef: boolean }
export interface ExpectedDocument { id: string; fields: ExpectedField[] }
export interface FieldPrediction { key: string; status: "value" | "abstained"; value?: unknown; sourceFactIds: string[] }
export interface GeneratedDocument { id: string; fields: FieldPrediction[]; officeCheck: OfficeCheck }
export interface CorpusSample {
  sampleId: string;
  underlyingCaseId: string;
  variantId: string;
  split: string;
  origin: CorpusOrigin;
  inputFactIds: string[];
  expectedDocuments: ExpectedDocument[];
  generatedDocuments: GeneratedDocument[];
}
export interface Ratio { numerator: number; denominator: number; value: number | null }
export interface GenerationMetrics {
  validationErrors: string[];
  sampleCount: number;
  uniqueUnderlyingCaseCount: number;
  splitCount: number;
  originBreakdown: Record<CorpusOrigin, { samples: number; cases: number }>;
  expectedDocuments: number;
  exactDocuments: number;
  documentExactSuccess: Ratio;
  qualifiedDocuments: number;
  qualifiedDocumentSuccess: Ratio;
  expectedCases: number;
  completeCases: number;
  wholeCaseCompleteness: Ratio;
  expectedFields: number;
  exactFields: number;
  fieldAccuracy: Ratio;
  criticalExpectedFields: number;
  criticalErrors: number;
  abstainedFields: number;
  missingFields: number;
  missingDocuments: number;
  unexpectedDocuments: number;
  unexpectedFields: number;
  officeValidation: { valid: number; invalid: number; notRun: number; passRateAmongRun: Ratio; passRateAmongExpected: Ratio };
  inputProvenance: { validFields: number; invalidFields: number; notRequiredFields: number; rateAmongRequired: Ratio };
  observed99ThresholdMet: boolean;
  singleCaseEvidenceOnly: boolean;
  universal99ClaimAllowed: false;
  claimNote: string;
}

function ratio(numerator: number, denominator: number): Ratio {
  return { numerator, denominator, value: denominator ? numerator / denominator : null };
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}
function duplicate(values: string[]): string[] { return values.filter((v,i)=>values.indexOf(v)!==i); }

export function evaluateDocumentGeneration(samples: CorpusSample[]): GenerationMetrics {
  const errors: string[] = [];
  const sampleIds = samples.map(s=>s.sampleId);
  for (const id of duplicate(sampleIds)) errors.push(`duplicate sampleId: ${id}`);
  const splitByCase = new Map<string, Set<string>>();
  for (const s of samples) {
    const set=splitByCase.get(s.underlyingCaseId) ?? new Set<string>(); set.add(s.split); splitByCase.set(s.underlyingCaseId,set);
    if (!s.expectedDocuments.length) errors.push(`${s.sampleId}: empty expected document manifest`);
    for (const d of s.expectedDocuments) {
      if (!d.fields.length) errors.push(`${s.sampleId}/${d.id}: empty expected field manifest`);
      for (const f of d.fields) if (f.value === undefined) errors.push(`${s.sampleId}/${d.id}/${f.key}: expected value is undefined`);
      for (const key of duplicate(d.fields.map(f=>f.key))) errors.push(`${s.sampleId}/${d.id}: duplicate expected field ${key}`);
    }
    for (const id of duplicate(s.expectedDocuments.map(d=>d.id))) errors.push(`${s.sampleId}: duplicate expected document ${id}`);
    for (const d of s.generatedDocuments) for (const key of duplicate(d.fields.map(f=>f.key))) errors.push(`${s.sampleId}/${d.id}: duplicate generated field ${key}`);
    for (const id of duplicate(s.generatedDocuments.map(d=>d.id))) errors.push(`${s.sampleId}: duplicate generated document ${id}`);
  }
  for (const [id,splits] of splitByCase) if (splits.size>1) errors.push(`underlying case ${id} overlaps corpus splits: ${[...splits].sort().join(", ")}`);

  let expectedDocuments=0, exactDocuments=0, qualifiedDocuments=0, expectedFields=0, exactFields=0, criticalExpectedFields=0, criticalErrors=0;
  let abstainedFields=0, missingFields=0, missingDocuments=0, unexpectedDocuments=0, unexpectedFields=0;
  let officeValid=0, officeInvalid=0, officeNotRun=0, provenanceValid=0, provenanceInvalid=0, provenanceNotRequired=0;
  let completeCases=0;
  const caseCompletion = new Map<string, boolean>();
  const originBreakdown: GenerationMetrics["originBreakdown"] = {real_case:{samples:0,cases:0},synthetic:{samples:0,cases:0},public_example:{samples:0,cases:0}};
  const originCases: Record<CorpusOrigin,Set<string>> = {real_case:new Set(),synthetic:new Set(),public_example:new Set()};
  for (const s of samples) {
    originBreakdown[s.origin].samples++; originCases[s.origin].add(s.underlyingCaseId);
    const produced = new Map(s.generatedDocuments.map(d=>[d.id,d]));
    const expectedIds = new Set(s.expectedDocuments.map(d=>d.id));
    unexpectedDocuments += s.generatedDocuments.filter(d=>!expectedIds.has(d.id)).length;
    for (const d of s.generatedDocuments.filter(d=>!expectedIds.has(d.id))) errors.push(`${s.sampleId}: unexpected generated document ${d.id}`);
    let caseComplete = s.expectedDocuments.length > 0;
    for (const expected of s.expectedDocuments) {
      expectedDocuments++;
      const generated=produced.get(expected.id);
      if (!generated) { missingDocuments++; officeNotRun++; caseComplete=false; }
      else if (generated.officeCheck==="valid") officeValid++;
      else if (generated.officeCheck==="invalid") officeInvalid++;
      else officeNotRun++;
      const predicted = new Map((generated?.fields ?? []).map(f=>[f.key,f]));
      const expectedKeys = new Set(expected.fields.map(f=>f.key));
      unexpectedFields += (generated?.fields ?? []).filter(f=>!expectedKeys.has(f.key)).length;
      for (const f of generated?.fields ?? []) if (!expectedKeys.has(f.key)) errors.push(`${s.sampleId}/${expected.id}: unexpected generated field ${f.key}`);
      let docExact = !!generated && expected.fields.length > 0;
      let docProvenanceValid = !!generated;
      if (expected.fields.length === 0) caseComplete=false;
      if ((generated?.fields ?? []).some(f=>!expectedKeys.has(f.key))) docExact=false;
      for (const field of expected.fields) {
        expectedFields++;
        if (field.critical) criticalExpectedFields++;
        const output=predicted.get(field.key);
        const hasValue=!!output && output.status==="value";
        if (!output) missingFields++;
        else if (output.status==="abstained") abstainedFields++;
        if (!hasValue) caseComplete=false;
        const exact=hasValue && canonical(output.value)===canonical(field.value);
        if (exact) exactFields++;
        else { docExact=false; if(field.critical) criticalErrors++; }
        if (field.requiresSourceRef) {
          const valid=!!output && output.sourceFactIds.length>0 && output.sourceFactIds.every(id=>s.inputFactIds.includes(id));
          if(valid) provenanceValid++; else { provenanceInvalid++; docProvenanceValid=false; }
        } else {
          const validIds=output?.sourceFactIds.every(id=>s.inputFactIds.includes(id)) ?? true;
          if(validIds) provenanceNotRequired++; else { provenanceInvalid++; docProvenanceValid=false; }
        }
      }
      if(docExact) exactDocuments++;
      if(docExact && generated?.officeCheck==="valid" && docProvenanceValid) qualifiedDocuments++;
    }
    if (!caseCompletion.has(s.underlyingCaseId)) caseCompletion.set(s.underlyingCaseId,true);
    if (!caseComplete) caseCompletion.set(s.underlyingCaseId,false);
  }
  for (const origin of Object.keys(originCases) as CorpusOrigin[]) originBreakdown[origin].cases=originCases[origin].size;
  const distinctCases=splitByCase.size;
  completeCases=[...caseCompletion.values()].filter(Boolean).length;
  const docRate=ratio(exactDocuments,expectedDocuments);
  const qualifiedRate=ratio(qualifiedDocuments,expectedDocuments);
  return {
    validationErrors:errors, sampleCount:samples.length, uniqueUnderlyingCaseCount:distinctCases,
    splitCount:new Set(samples.map(s=>s.split)).size, originBreakdown,
    expectedDocuments, exactDocuments, documentExactSuccess:docRate,
    qualifiedDocuments, qualifiedDocumentSuccess:qualifiedRate,
    expectedCases:distinctCases, completeCases, wholeCaseCompleteness:ratio(completeCases,distinctCases),
    expectedFields, exactFields, fieldAccuracy:ratio(exactFields,expectedFields),
    criticalExpectedFields, criticalErrors, abstainedFields, missingFields, missingDocuments, unexpectedDocuments, unexpectedFields,
    officeValidation:{valid:officeValid,invalid:officeInvalid,notRun:officeNotRun,passRateAmongRun:ratio(officeValid,officeValid+officeInvalid),passRateAmongExpected:ratio(officeValid,expectedDocuments)},
    inputProvenance:{validFields:provenanceValid,invalidFields:provenanceInvalid,notRequiredFields:provenanceNotRequired,rateAmongRequired:ratio(provenanceValid,provenanceValid+provenanceInvalid)},
    observed99ThresholdMet:errors.length===0 && qualifiedRate.value!==null && qualifiedRate.value>=0.99 && criticalErrors===0,
    singleCaseEvidenceOnly:distinctCases<=1,
    universal99ClaimAllowed:false,
    claimNote: distinctCases<=1 ? "One underlying case cannot support a general 99% claim; report only this case's observed result." : "Observed corpus metrics describe this corpus only; no universal or future-case accuracy claim is supported by this function.",
  };
}
