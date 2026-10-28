import test from "node:test";
import assert from "node:assert/strict";
import { projectReferenceCaseDataset } from "../lib/reference-case-projection.ts";
import type { ReferenceFieldObservation, ReferenceTestDataset } from "../lib/reference-case-import.ts";

const doc = "source-doc";
const base = (): ReferenceTestDataset => ({
  schemaVersion: "firmengine-reference-test-dataset/v1", sourceCaseId: "synthetic-source", version: "test-v1", documents: [],
  fields: [], objects: { incomes: [], debts: [], assets: [], transactions: [] },
});
function field(input: Partial<ReferenceFieldObservation> & Pick<ReferenceFieldObservation,"fieldId"|"canonicalKey"|"rawSourceKey"|"value"|"presenceState">, meta: Omit<NonNullable<ReferenceFieldObservation["sourceMetadata"]>,"normalizedValue">): ReferenceFieldObservation {
  return { subjectType:"case", refs:[{sourceCaseId:"synthetic-source",sourceDocumentId:doc,page:1,sourceHash:"a".repeat(64),quote:"synthetic source quote"}], ...input, sourceMetadata:{...meta,normalizedValue:input.value} };
}
function grouped(f: ReferenceFieldObservation, subject: "income"|"debt"|"asset"|"transaction", groupKey:string) {
  return {...f,subjectType:subject,groupKey,rowIndex:0};
}

test("direct source semantics create a typed current-debt row while retaining raw and normalized amount evidence",()=>{
  const input=base();
  input.fields=[
    grouped(field({fieldId:"c1",canonicalKey:"reference.debt_certificate.creditor",rawSourceKey:"creditor",value:"Synthetic creditor",presenceState:"present"},{familyId:"debt_certificate",localId:"creditor",partyRole:"creditor",sourceRowId:"row-1"}),"debt","row-1"),
    grouped(field({fieldId:"p1",canonicalKey:"reference.debt_certificate.principal_balance",rawSourceKey:"principal_balance",value:{amount:"250000",currency:"KRW"},rawValue:"250000",presenceState:"present",refs:[{sourceCaseId:"synthetic-source",sourceDocumentId:doc,page:1,sourceHash:"a".repeat(64),quote:"잔액 250,000원"}]},{familyId:"debt_certificate",localId:"principal_balance",temporalRole:"source_as_of_date",sourceRowId:"row-1"}),"debt","row-1"),
    grouped(field({fieldId:"date1",canonicalKey:"reference.debt_certificate.as_of_date",rawSourceKey:"as_of_date",value:"2026-01-31",presenceState:"present"},{familyId:"debt_certificate",localId:"as_of_date",temporalRole:"balance_as_of_date",sourceRowId:"row-1"}),"debt","row-1"),
    grouped(field({fieldId:"orig1",canonicalKey:"reference.debt_certificate.original_principal",rawSourceKey:"original_principal",value:{amount:"500000",currency:"KRW"},rawValue:"500000",presenceState:"present"},{familyId:"debt_certificate",localId:"original_principal",sourceRowId:"row-1"}),"debt","row-1"),
  ];
  const {dataset,coverage}=projectReferenceCaseDataset(input);
  assert.deepEqual(dataset.objects.debts,[{groupKey:"row-1",rowIndex:0,fieldBindings:{creditor:"c1",principal:"p1",asOf:"date1"}}]);
  assert.equal(dataset.fields.find(f=>f.fieldId==="p1")?.value && JSON.stringify(dataset.fields.find(f=>f.fieldId==="p1")?.value),JSON.stringify({amount:"250000",currency:"KRW"}));
  assert.deepEqual(dataset.fields.find(f=>f.fieldId==="p1")?.numeric,{rawValue:"250000",amountWon:"250000",unit:"KRW",currency:"KRW",normalizationStatus:"exact"});
  assert.equal(dataset.fields.find(f=>f.fieldId==="p1")?.rawValue,"250000");
  assert.equal(dataset.fields.find(f=>f.fieldId==="orig1")?.subjectType,"case","original principal is not current balance");
  assert.equal(coverage.denominator,4); assert.equal(coverage.typedObjectRows.debts,1); assert.equal(coverage.typedBindingCount,3);
});

test("an explicit domain kind and label support an income row; no type or label is inferred from family text",()=>{
  const input=base(); input.fields=[
    grouped(field({fieldId:"label",canonicalKey:"income.label",rawSourceKey:"employer_name",value:"Synthetic employer",presenceState:"present"},{familyId:"payroll_payslip",localId:"income.payroll.employer",partyRole:"employer",sourceRowId:"income-1"}),"income","income-1"),
    grouped(field({fieldId:"kind",canonicalKey:"income.kind",rawSourceKey:"income_kind",value:"wage",presenceState:"present"},{familyId:"payroll_payslip",localId:"income_kind",partyRole:"applicant",sourceRowId:"income-1"}),"income","income-1"),
    grouped(field({fieldId:"net",canonicalKey:"income.net",rawSourceKey:"net_pay",value:{amount:"120000",currency:"KRW"},rawValue:"120000",presenceState:"present",refs:[{sourceCaseId:"synthetic-source",sourceDocumentId:doc,page:1,sourceHash:"a".repeat(64),quote:"실지급액 120,000원"}]},{familyId:"payroll_payslip",localId:"income.payroll.net_pay",amountRole:"applicant_debtor",temporalRole:"period_scope",sourceRowId:"income-1"}),"income","income-1"),
  ];
  const {dataset}=projectReferenceCaseDataset(input);
  assert.deepEqual(dataset.objects.incomes,[{groupKey:"income-1",rowIndex:0,fieldBindings:{label:"label",kind:"kind",net:"net"}}]);
  assert.equal(dataset.fields.find(f=>f.fieldId==="kind")?.value,"wage");
});

test("unverified currency/unit stays as a source fact and does not become a typed numeric",()=>{
  const input=base(); input.fields=[
    grouped(field({fieldId:"c",canonicalKey:"debt.creditor",rawSourceKey:"creditor",value:"Synthetic creditor",presenceState:"present"},{familyId:"debt_certificate",localId:"creditor",partyRole:"creditor",sourceRowId:"row"}),"debt","row"),
    grouped(field({fieldId:"p",canonicalKey:"debt.principal_balance",rawSourceKey:"principal_balance",value:{amount:"250000",currency:"KRW"},rawValue:"250000",presenceState:"present"},{familyId:"debt_certificate",localId:"principal_balance",sourceRowId:"row"}),"debt","row"),
  ];
  const {dataset,coverage}=projectReferenceCaseDataset(input);
  assert.deepEqual(dataset.objects.debts,[{groupKey:"row",rowIndex:0,fieldBindings:{creditor:"c"}}]);
  assert.equal(dataset.fields.find(f=>f.fieldId==="p")?.subjectType,"case");
  assert.equal(dataset.fields.find(f=>f.fieldId==="p")?.numeric,undefined);
  assert.equal(dataset.fields.find(f=>f.fieldId==="p")?.sourceUnit,undefined);
  assert.equal(coverage.noUnitMoneyCount,1);
});

test("ambiguous duplicate mappings and incomplete required bindings remain case observations",()=>{
  const input=base(); input.fields=[
    grouped(field({fieldId:"c1",canonicalKey:"debt.creditor",rawSourceKey:"creditor",value:"A",presenceState:"present"},{familyId:"debt_certificate",localId:"creditor",sourceRowId:"one"}),"debt","one"),
    grouped(field({fieldId:"c2",canonicalKey:"debt.creditor",rawSourceKey:"creditor_alias",value:"B",presenceState:"present"},{familyId:"debt_certificate",localId:"creditor",sourceRowId:"one"}),"debt","one"),
    grouped(field({fieldId:"amt",canonicalKey:"debt.principal_balance",rawSourceKey:"principal_balance",value:{amount:"5",currency:"KRW"},rawValue:"5",presenceState:"present",refs:[{sourceCaseId:"synthetic-source",sourceDocumentId:doc,page:1,sourceHash:"a".repeat(64),quote:"잔액 5원"}]},{familyId:"debt_certificate",localId:"principal_balance",sourceRowId:"two"}),"debt","two"),
  ];
  const {dataset,coverage}=projectReferenceCaseDataset(input);
  assert.equal(dataset.objects.debts.length,0);
  assert.ok(dataset.fields.every(f=>f.subjectType==="case"));
  assert.ok(dataset.fields.every(f=>f.canonicalKey.startsWith("reference.")));
  assert.ok(coverage.ambiguousFieldCount >= 2);
});

test("applicant context binds only explicit applicant-role identity evidence; similar named parties do not qualify",()=>{
  const input=base(); input.fields=[
    field({fieldId:"name-ok",canonicalKey:"reference.identity_residence_record.identity.name",rawSourceKey:"identity.name",value:"Synthetic applicant",presenceState:"present"},{familyId:"identity_residence_record",localId:"identity.name",partyRole:"applicant",sourceRowId:"identity-1"}),
    field({fieldId:"name-other",canonicalKey:"reference.identity_residence_record.identity.name",rawSourceKey:"identity.name",value:"Synthetic relative",presenceState:"present"},{familyId:"identity_residence_record",localId:"identity.name",partyRole:"household_member",sourceRowId:"identity-2"}),
  ];
  const {dataset,coverage}=projectReferenceCaseDataset(input);
  assert.deepEqual(dataset.applicant,{fieldBindings:{name:"name-ok"}});
  assert.equal(dataset.fields.find(f=>f.fieldId==="name-ok")?.canonicalKey,"applicant.name");
  assert.equal(dataset.fields.find(f=>f.fieldId==="name-other")?.subjectType,"case");
  assert.equal(dataset.fields.find(f=>f.fieldId==="name-other")?.canonicalKey,"reference.identity_residence_record.identity.name");
  assert.equal(coverage.applicantBindingCount,1);
});
