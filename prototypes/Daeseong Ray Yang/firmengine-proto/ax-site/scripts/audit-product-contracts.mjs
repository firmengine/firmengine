/** Read-only source-contract audit; static integrity does not prove legal or production readiness. */
import {existsSync,readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const findings=[];
const fail=(kind,detail)=>findings.push({kind,detail});
const load=p=>{
  if(!existsSync(join(root,p))){fail("CONTRACT_FILE_MISSING",p);return null;}
  try{return JSON.parse(readFileSync(join(root,p),"utf8"));}
  catch(e){fail("CONTRACT_JSON_INVALID",p+": "+String(e));return null;}
};
const idx=load("lib/canonical-field-id-index.json");
const base=load("lib/document-agent-field-contracts.json");
const shared=load("lib/shared-document-field-contracts.json");
const ext=load("lib/ocr-field-supplements.json");
const wf=load("lib/reference-decision-tables.json");
const risk=load("lib/risk-catalog.json");
const law=load("lib/legal-catalog.json");
const exception=load("lib/legal-exceptions.json");
const eform=load("docs/eform-parity-matrix.json");
const migrations=load("drizzle/meta/_journal.json");
const fields=new Map();
const routes=new Map();
let sourceRouteSlots=0;
const track=(field,origin)=>{
  const id=field?.global_field_id;
  if(typeof id!=="string"||!id){fail("SOURCE_FIELD_ID_MISSING",origin);return;}
  const definition={localId:field.local_id,datatype:field.datatype,unit:field.canonical_unit};
  const previous=fields.get(id);
  if(previous){
    for(const key of ["localId","datatype","unit"])if(previous.definition[key]!==definition[key])
      fail("SOURCE_FIELD_SEMANTIC_COLLISION",id+"/"+key+"/"+origin);
    previous.origins.push(origin);
  }else fields.set(id,{definition,origins:[origin]});
};
const unique=(xs,title,key="id")=>{
  if(!Array.isArray(xs)){fail("REGISTERED_COLLECTION_INVALID",title);return [];}
  const ids=[],set=new Set();
  for(const x of xs){
    const id=typeof x==="string"?x:x?.[key];
    if(typeof id!=="string"||!id.trim())fail("REGISTERED_ID_INVALID",title+":"+String(id));
    else if(set.has(id))fail("REGISTERED_ID_DUPLICATE",title+":"+id);
    else{ids.push(id);set.add(id);}
  }return ids;
};
if(idx&&base&&shared&&ext&&wf&&risk&&law&&exception&&eform&&migrations){
  for(const [name,family] of Object.entries(base.families??{})){
    if(!Array.isArray(family.fields))fail("SOURCE_FAMILY_FIELDS_INVALID",name);
    else for(const field of family.fields)track(field,"family:"+name);
  }
  for(const [documentId,doc] of Object.entries(shared.documents??{})){
    if(doc.documentTypeId!==documentId||!Array.isArray(doc.allowedFamilyIds))
      fail("DOCUMENT_ID_OR_ROUTE_INVALID",documentId);
    for(const [family,rows] of Object.entries(doc.fieldsByFamily??{})){
      if(!doc.allowedFamilyIds?.includes(family))fail("DOCUMENT_FAMILY_NOT_ALLOWED",documentId+":"+family);
      if(!Array.isArray(rows))fail("DOCUMENT_FIELDS_INVALID",documentId+":"+family);
      else for(const row of rows)track(row,"document:"+documentId+":"+family);
    }
  }
  for(const [documentId,families] of Object.entries(ext.documents??{})){
    if(!shared.documents?.[documentId])fail("SUPPLEMENT_DOCUMENT_UNKNOWN",documentId);
    for(const [family,rows] of Object.entries(families)){
      if(!shared.documents?.[documentId]?.allowedFamilyIds?.includes(family))
        fail("SUPPLEMENT_FAMILY_UNKNOWN",documentId+":"+family);
      if(!Array.isArray(rows))fail("SUPPLEMENT_FIELDS_INVALID",documentId+":"+family);
      else for(const row of rows)track(row,"supplement:"+documentId+":"+family);
    }
  }
  const canonical=unique(idx.ids,"canonical");
  const known=new Set(canonical);
  for(const field of fields.keys())if(!known.has(field))fail("SOURCE_FIELD_NOT_IN_CANONICAL_INDEX",field);
  for(const field of known)if(!fields.has(field))fail("CANONICAL_FIELD_WITHOUT_SOURCE_DECLARATION",field);
  // These are allowed declaration routes, NOT evidence acceptance, typed materialization,
  // actual legal/form consumers, or deployment verification.
  for(const [documentTypeId,document] of Object.entries(shared.documents??{})){
    for(const familyId of document.allowedFamilyIds??[]){
      const familyFields=base.families?.[familyId]?.fields;
      const documentFields=document.fieldsByFamily?.[familyId]??[];
      const supplementalFields=ext.documents?.[documentTypeId]?.[familyId]??[];
      if(!Array.isArray(familyFields)||!Array.isArray(documentFields)||!Array.isArray(supplementalFields)){
        fail("SOURCE_ROUTE_CONTRACT_INVALID",documentTypeId+":"+familyId);continue;
      }
      const seen=new Set();
      for(const field of [...familyFields,...documentFields,...supplementalFields]){
        const id=field?.global_field_id;
        if(typeof id!=="string"||!id){fail("SOURCE_ROUTE_FIELD_ID_MISSING",documentTypeId+":"+familyId);continue;}
        if(seen.has(id)){fail("SOURCE_ROUTE_DUPLICATE_FIELD",documentTypeId+":"+familyId+":"+id);continue;}
        seen.add(id);
        if(!known.has(id))fail("SOURCE_ROUTE_FIELD_NOT_REGISTERED",documentTypeId+":"+familyId+":"+id);
        routes.set(id,[...(routes.get(id)??[]),{documentTypeId,familyId}]);
        sourceRouteSlots++;
      }
    }
  }
  for(const id of canonical)if(!routes.has(id))fail("CANONICAL_FIELD_WITHOUT_DOCUMENT_ROUTE",id);
  const calc=new Set(unique(wf.calculations,"calculation")),workflows=new Set(unique(wf.workflows,"workflow"));
  for(const [workflow,ids] of Object.entries(wf.workflowCalculations??{})){
    if(!workflows.has(workflow))fail("UNKNOWN_WORKFLOW_CALCULATION_MAPPING",workflow);
    if(!Array.isArray(ids))fail("INVALID_WORKFLOW_CALCULATION_MAPPING",workflow);
    else for(const id of ids)if(!calc.has(id))fail("UNKNOWN_REFERENCED_CALCULATION",workflow+":"+id);
  }
  for(const workflow of workflows)if(!Object.hasOwn(wf.workflowCalculations??{},workflow))
    fail("WORKFLOW_CALCULATION_MAPPING_NOT_DECLARED",workflow);
  for(const c of wf.calculations){
    if(!Array.isArray(c.inputs)||!Array.isArray(c.outputs)||!c.executor||!c.formula)
      fail("CALCULATION_CONTRACT_INCOMPLETE",String(c.id));
    for(const dep of c.dependsOn??[])if(!calc.has(dep))fail("CALCULATION_DEPENDENCY_UNKNOWN",c.id+":"+dep);
  }
  unique(risk.entries,"legal-risk");unique(law.rules,"legal-rule");unique(exception.scenarios,"legal-exception");
  const journal=unique(migrations.entries,"migration","tag"),registered=new Set(journal);
  for(const tag of journal)if(!existsSync(join(root,"drizzle",tag+".sql")))fail("MIGRATION_FILE_MISSING",tag);
  for(const file of readdirSync(join(root,"drizzle")).filter(x=>/^\d{4}_.*\.sql$/.test(x)))
    if(!registered.has(file.slice(0,-4)))fail("MIGRATION_NOT_JOURNALED",file);
  for(const p of [
    "app/api/cases/[id]/documents/route.ts","app/api/cases/[id]/export/route.ts",
    "app/api/cases/[id]/approval-readiness/route.ts","app/api/cases/[id]/correction-items/route.ts",
    "lib/case-agent-scheduler.ts","lib/case-legal-calculation-preflight.ts",
    "lib/case-calculation-feature-store.ts","lib/case-feature-snapshot.ts",
    "lib/reference-runtime.ts","lib/form-mapping.ts","lib/feature-lineage-audit.ts"
  ])if(!existsSync(join(root,p)))fail("REQUIRED_WORKFLOW_SOURCE_MISSING",p);
}
const counts={canonical:idx?.ids?.length??null,declaredSourceFields:fields.size,sourceRouteSlots,
 documents:shared?Object.keys(shared.documents??{}).length:null,
 workflows:wf?.workflows?.length??null,calculations:wf?.calculations?.length??null,
 legalRules:law?.rules?.length??null,legalRisks:risk?.entries?.length??null,
 legalExceptions:exception?.scenarios?.length??null,migrations:migrations?.entries?.length??null};
for(const [key,floor] of Object.entries({canonical:693,documents:85,workflows:46,calculations:18,legalRules:50,legalRisks:95,legalExceptions:46}))
 if(typeof counts[key]==="number"&&counts[key]<floor)fail("CATALOG_ACCIDENTAL_REMOVAL",key+":"+counts[key]+"<"+floor);
const report={schemaVersion:"firmengine-product-contract-audit/1",
 inspection:"static_declaration_and_file_integrity_only",counts,
 officialEformParity:eform?.status??"unverified",
 legalApprovalInferred:false,liveD1R2Verified:false,lawAndTaxAccuracyCertified:false,
 findings,status:findings.length?"STATIC_CONTRACT_BLOCKED":"STATIC_CONTRACT_OK_NOT_END_TO_END_CERTIFIED"};
if(process.argv.includes("--fields"))report.fields=[...fields].sort(([a],[b])=>a.localeCompare(b))
 .map(([canonicalFieldId,row])=>({canonicalFieldId,origins:row.origins,datatype:row.definition.datatype,
   routeScope:"declared_allowed_document_family_not_runtime_consumer",
   documentRoutes:(routes.get(canonicalFieldId)??[]).sort((a,b)=>
      (a.documentTypeId+":"+a.familyId).localeCompare(b.documentTypeId+":"+b.familyId)),
  individualCaseContractVerified:false,legalConsumerVerified:false,formulaConsumerVerified:false,
  officialFormParityVerified:false}));
console.log(JSON.stringify(report,null,2));
if(findings.length)process.exitCode=1;
