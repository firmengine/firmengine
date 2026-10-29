/** Reproducible inventory of every tracked application file and every executable
 * branch/policy candidate. No evaluator oracle, private case, dependency bundle or
 * credential is opened. Semantic catalogs are retained losslessly alongside AST
 * criteria; compiled guards are explicitly not advertised as editable parameters. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";

const check = process.argv.includes("--check");
const digest = value => createHash("sha256").update(typeof value === "string" || value instanceof Uint8Array ? value : JSON.stringify(value)).digest("hex");
const read = name => JSON.parse(readFileSync(name, "utf8"));
const rows = [], ids = new Set();
const add = row => {
  if (ids.has(row.id)) throw new Error(`Duplicate reference ID ${row.id}`);
  ids.add(row.id);
  const normalized = { kind: "catalog", category: "application_policy", title: row.id,
    value: null, sourceIds: [], sourceUrls: [], effectiveFrom: null, effectiveTo: null,
    courtIds: [], verification: "inherited", runtimeMode: "catalog", editable: false,
    consumers: [], condition: null, consequence: null, requiresHumanReview: true, ...row };
  normalized.sourceUrls=[...new Set((normalized.sourceUrls??[]).map(s=>typeof s==="string"?s:s?.url).filter(s=>typeof s==="string"&&s.length))];
  normalized.sourceIds=[...new Set((normalized.sourceIds??[]).filter(s=>typeof s==="string"))];
  if(typeof normalized.category!=="string")normalized.category=JSON.stringify(normalized.category);
  rows.push({ ...normalized, sha256: digest(normalized) });
};
const law = read("lib/legal-catalog.json");
const sourceMap = new Map(law.source_catalog.map(s => [s.id,s]));
const legalRuleMap = new Map(law.rules.map(r=>[r.id,r]));
const resolveSourceIds = ids => [...new Set(ids.flatMap(id=>sourceMap.has(id)?[id]:legalRuleMap.get(id)?.source_ids??[id]))];
const sourceUrls = ids => [...new Set(ids.map(id => sourceMap.get(id)?.url).filter(Boolean))];
const consumer = (path,symbol,jsonPointer) => [{path,symbol,...(jsonPointer?{jsonPointer}:{})}];
for (const p of read("lib/reference-parameters.json").parameters) add({ ...p,kind:"parameter",runtimeMode:p.unit==="compiled_condition"?"compiled_guard":p.unit==="compiled_formula_description"?"metadata":"parameter",editable:!["compiled_condition","compiled_formula_description"].includes(p.unit)&&(p.category==="statute"||p.category==="court_practice"||p.category==="application_policy"),lockedSafetyInvariant:["compiled_condition","compiled_formula_description"].includes(p.unit), sourceUrls:[...new Set([...p.sourceUrls,...sourceUrls(p.sourceIds)])] });
for (const p of read("lib/reference-prompt-policies.json").policies) add({id:p.id,title:p.title,kind:"prompt",category:p.category,value:p.valueType==="integer"?p.value:p.template,unit:p.valueType==="integer"?"count":null,verification:p.reviewStatus,runtimeMode:"prompt",editable:!p.lockedSafetyInvariant,lockedSafetyInvariant:p.lockedSafetyInvariant,placeholders:p.placeholders,sourceIds:p.legalSourceIds,sourceUrls:sourceUrls(p.legalSourceIds),consumers:p.sourceBindings,payload:p});
if(existsSync("lib/reference-monitor-policies.json")){
  const monitor=read("lib/reference-monitor-policies.json");
  for(const p of monitor.policies)add({id:p.id,title:p.title,kind:"prompt",category:p.category,value:p.template,verification:"inherited",runtimeMode:"prompt",editable:false,lockedSafetyInvariant:true,consumers:p.sourceBindings,payload:p});
  add({id:"monitor.provider_limits",kind:"application_policy",title:"감시 에이전트 요청·응답 예산",value:monitor.limits,consumers:consumer("lib/reference-monitor-policies.json","limits","/limits")});
}
for (const s of law.source_catalog) add({id:`source.${s.id}`,kind:"source",category:s.authority||"official_source",title:s.title,value:s,sourceIds:[s.id],sourceUrls:[s.url],effectiveFrom:s.edition_effective_date??null,verification:"inherited",consumers:consumer("lib/legal-catalog.json","source_catalog",`/source_catalog/${law.source_catalog.indexOf(s)}`)});
for (const r of law.rules) add({id:r.id,kind:"legal_rule",category:r.authority_scope??"statute",title:r.title,value:r,sourceIds:r.source_ids??[],sourceUrls:[...new Set([r.source_url,...sourceUrls(r.source_ids??[])].filter(Boolean))],condition:r.condition,consequence:r.effect,effectiveFrom:r.effective_date??null,courtIds:/서울|seoul/i.test(r.authority_scope??"")&&!/대한민국|전국|national/i.test(r.authority_scope??"")?["seoul"]:[],runtimeMode:r.implementation_scope??"catalog",consumers:consumer("lib/legal-catalog.json","rules",`/rules/${law.rules.indexOf(r)}`)});
for (const [key,value] of Object.entries(law)) if (!["rules","source_catalog","document_feature_maps"].includes(key)) add({id:`legal.metadata.${key}`,kind:"catalog_metadata",title:`법적 기준 메타정보 · ${key}`,value,consumers:consumer("lib/legal-catalog.json",key,`/${key}`)});
for (const [i,value] of law.document_feature_maps.entries()) add({id:`legal.document_feature_map.${value.id??i}`,kind:"document_rule",title:value.title??value.document_type??`서류 피처 연결 ${i+1}`,value,consumers:consumer("lib/legal-catalog.json","document_feature_maps",`/document_feature_maps/${i}`)});
for (const [file,key,prefix,kind] of [["lib/risk-catalog.json","entries","risk","risk"],["lib/legal-exceptions.json","scenarios","exception","exception"]]) {
  const data=read(file);
  for(const [i,r] of data[key].entries()) add({id:`${prefix}.${r.id}`,kind,category:r.authority??"application_policy",title:r.title??r.trigger,value:r,ruleIds:r.ruleRefs??r.current_rule_ids??[],sourceIds:resolveSourceIds(r.source_ids??r.ruleRefs??[]),sourceUrls:[...(r.source_urls??[]),...sourceUrls(resolveSourceIds(r.source_ids??r.ruleRefs??[]))],condition:r.conditions??r.applicability??r.trigger,consequence:r.blocking_policy??r.missingAction,consumers:consumer(file,key,`/${key}/${i}`)});
  for(const [k,value] of Object.entries(data)) if(k!==key)add({id:`${prefix}.metadata.${k}`,kind:"catalog_metadata",value,consumers:consumer(file,k,`/${k}`)});
}
for(const [file,prefix] of [["lib/document-agent-field-contracts.json","field_contract"],["lib/field-applicability-contracts.json","field_applicability"]]) {
  const data=read(file);
  for(const [familyId,family] of Object.entries(data.families)) {
    const {fields,...metadata}=family;
    add({id:`${prefix}.${familyId}`,kind:"document_family",title:family.label??familyId,value:metadata,consumers:consumer(file,"families",`/families/${familyId}`)});
    const entries=Array.isArray(fields)?fields.map((v,i)=>[v.field_id??v.id??v.key??String(i),v]):Object.entries(fields??{});
    for(const [fieldId,value] of entries) add({id:`${prefix}.${familyId}.${fieldId}`,kind:"field_contract",title:value.label??value.title??fieldId,value,consumers:consumer(file,"fields",`/families/${familyId}/fields/${Array.isArray(fields)?fields.indexOf(value):fieldId}`)});
  }
  for(const [key,value] of Object.entries(data))if(key!=="families")add({id:`${prefix}.metadata.${key}`,kind:"catalog_metadata",value,consumers:consumer(file,key,`/${key}`)});
}
const decisions=read("lib/reference-decision-tables.json");
for(const [key,prefix,kind] of [["workflows","workflow","workflow"],["calculations","calculation","calculation"],["agents","agent","agent_contract"],["legacyFeatures","legacy.feature","legacy_vocabulary"],["legacyRequirements","legacy.requirement","legacy_vocabulary"]])for(const [i,r] of decisions[key].entries())add({id:`${prefix}.${r.id??r.key??i}`,kind,title:r.title??r.label??r.responsibility??`${prefix} ${i+1}`,value:r,condition:r.activation??r.applicability??null,consequence:r.missingAction??r.formula??null,ruleIds:r.ruleIds??[],sourceIds:resolveSourceIds(r.ruleIds??[]),sourceUrls:sourceUrls(resolveSourceIds(r.ruleIds??[])),runtimeMode:kind==="workflow"?"decision_table":"catalog",consumers:consumer("lib/reference-decision-tables.json",key,`/${key}/${i}`)});
for(const [id,ids] of Object.entries(decisions.workflowCalculations))add({id:`workflow_calculations.${id}`,kind:"workflow_calculation",value:ids,consumers:consumer("lib/reference-decision-tables.json","workflowCalculations",`/workflowCalculations/${id}`)});
for(const [key,value] of Object.entries(decisions.legacyDocumentTypes))add({id:`legacy.document_type.${key}`,kind:"legacy_vocabulary",title:value,value,consumers:consumer("lib/reference-decision-tables.json","legacyDocumentTypes",`/legacyDocumentTypes/${key}`)});
for(const [key,value] of Object.entries(read("lib/reference-document-policy.json")))add({id:`document.${key.replace(/[A-Z]/g,c=>"_"+c.toLowerCase())}`,kind:"document_rule",value,runtimeMode:"decision_table",consumers:consumer("lib/reference-document-policy.json",key,`/${key}`)});
for(const [file,key,prefix] of [["public/templates/catalog.json","forms","form"],["public/templates/additional_sources.json","sources","form_source"]]) {
  const data=read(file);
  for(const [i,r] of data[key].entries())add({id:`${prefix}.${r.code??r.id??i}${prefix==="form_source"?`.${i}`:""}`,kind:prefix==="form"?"form":"source",title:r.title??r.label??r.code??`${prefix} ${i+1}`,value:r,sourceUrls:[...new Set([r.url,...(r.originals??[]).map(s=>s.url)].filter(Boolean))],consumers:consumer(file,key,`/${key}/${i}`)});
  for(const [k,value]of Object.entries(data))if(k!==key)add({id:`${prefix}.metadata.${k}`,kind:"catalog_metadata",value,consumers:consumer(file,k,`/${k}`)});
}
const {LEGAL_MONITOR_SOURCES,LEGAL_MONITOR_SOURCE_POLICY}=await import("../lib/legal-monitor-sources.ts");
for(const source of LEGAL_MONITOR_SOURCES)add({id:`monitor.source.${source.id}`,kind:"monitor_source",category:"official_source",title:source.title,value:source,sourceIds:[source.id,...source.sourceAliases??[]],sourceUrls:[source.url],consumers:consumer("lib/legal-monitor-sources.ts","LEGAL_MONITOR_SOURCES")});
add({id:"monitor.schedule_policy",kind:"application_policy",title:"일일 법령·법원 문서 감시 정책",value:LEGAL_MONITOR_SOURCE_POLICY,consumers:consumer("lib/legal-monitor-sources.ts","LEGAL_MONITOR_SOURCE_POLICY")});
const {REFERENCE_MONITOR_AGENTS}=await import("../lib/case-agent-contracts.ts");
for(const agent of REFERENCE_MONITOR_AGENTS)add({id:`agent.${agent.id}`,kind:"agent_contract",title:agent.responsibility,value:agent,consumers:consumer("lib/case-agent-contracts.ts","REFERENCE_MONITOR_AGENTS")});
const intake=read("lib/reference-intake-catalog.json");
const intakeSources=new Map(intake.sources.map(s=>[s.id,s])),intakeDocuments=new Map(intake.documents.map(d=>[d.id,d]));
for(const [key,kind]of[["features","feature"],["documents","document"],["rules","rule"],["sources","source"]])for(const [i,row]of intake[key].entries()){
  const refs=[...new Set([...(row.sourceIds??[]),...(key==="sources"?[row.id]:[]),...(key==="rules"?row.documents.flatMap(n=>[n.documentTypeId,...n.alternatives].flatMap(id=>intakeDocuments.get(id)?.sourceIds??[])):[])])];
  add({id:`intake.${kind}.${row.id}`,kind:`intake_${kind}`,category:row.id==="SRC-INTAKE-OFFICE-POLICY"?"application_policy":`intake_${kind}`,title:row.title??row.name??row.label,value:row,sourceIds:refs,sourceUrls:refs.map(id=>intakeSources.get(id)?.url).filter(Boolean),courtIds:row.jurisdictions??[],effectiveFrom:row.effectiveFrom??null,effectiveTo:row.effectiveTo??null,condition:key==="rules"?{all:row.all,any:row.any,scope:row.scope}:null,consequence:key==="rules"?{documents:row.documents,questions:row.questions,workflowIds:row.workflowIds}:null,runtimeMode:"separate_reference_table",verification:"inherited_intake_catalog",consumers:consumer("lib/reference-intake-catalog.json",key,`/${key}/${i}`)});
}
for(const [key,value]of Object.entries(intake))if(!["features","documents","rules","sources"].includes(key))add({id:`intake.metadata.${key}`,kind:"catalog_metadata",value,consumers:consumer("lib/reference-intake-catalog.json",key,`/${key}`)});
add({id:"intake.schema",kind:"application_policy",title:"상담 분류·서류 안내의 별도 기준정보 계약",value:{schemaVersion:intake.schemaVersion,tables:["intake_catalog_head","intake_catalog_versions"],managementUrl:"/data/checklist",api:"/api/checklist-catalog",incomingCommit:"683981f9449a7b6f427ea1e2d7672b4f8516927d"},consumers:consumer("lib/intake-types.ts","INTAKE_SCHEMA_VERSION")});
const {INTAKE_LIMITS,INTAKE_NEGATIVE_SUBJECT_LABELS}=await import("../lib/intake-engine.ts");
add({id:"intake.compiled_limits",kind:"application_policy",title:"상담 원문·분류·카탈로그의 처리 한도",value:INTAKE_LIMITS,lockedSafetyInvariant:true,runtimeMode:"compiled_guard",consumers:consumer("lib/intake-engine.ts","INTAKE_LIMITS")});
add({id:"intake.negative_subject_labels",kind:"application_policy",title:"명시적 부재 진술의 주체 표기 규약",value:INTAKE_NEGATIVE_SUBJECT_LABELS,lockedSafetyInvariant:true,runtimeMode:"compiled_guard",consumers:consumer("lib/intake-engine.ts","INTAKE_NEGATIVE_SUBJECT_LABELS")});
add({id:"agent.consultation_classifier",kind:"agent_contract",title:"상담이력 피처 분류 및 기준표에 따른 서류 안내",value:{id:"consultation_classifier",input:"active consultation notes + current intake feature catalog",output:"quoted client_report claims; server matches checklist rules",catalogTables:["intake_catalog_head","intake_catalog_versions"],automaticEvidenceAcceptance:false,automaticLegalApproval:false},consumers:consumer("lib/intake-classifier.ts","buildIntakeClassifierRequest")});
// Preserve execution constraints in every production file, including criteria that
// must stay compiled (source provenance, approvals, numerical algorithms).
const generated=new Set(["lib/reference-data.json","lib/reference-release.json","docs/reference-inventory.json"]);
const fileList=process.argv.includes("--files-stdin")?readFileSync(0,"utf8"):execFileSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{encoding:"utf8"});
const files=[...new Set(fileList.split("\0").filter(Boolean))].sort();
const fileAudit=[];
for(const path of files) {
  if(generated.has(path))continue;
  const protectedData=/(^|\/)(private|oracle|gold|heldout|node_modules|dist|\.git)(\/|$)|(^|\/)\.env|\.dev\.vars/.test(path);
  if(protectedData){fileAudit.push({path,disposition:"excluded_protected_or_generated",reason:"No oracle, private case, credential or generated bundle is inspected."});continue;}
  if(!existsSync(path))continue;
  const binary=!/\.(?:[cm]?[jt]sx?|json|md|txt|sql|css|html|sh|py|toml|yml|yaml)$/.test(path);
  const bytes=readFileSync(path),sha256=digest(bytes);
  const role=path.startsWith("tests/")?"test_evidence":path.startsWith("vendor/")||path==="package-lock.json"||path==="public/pdf.worker.min.mjs"?"dependency_metadata":path.startsWith("docs/")?"documentation":binary?"binary_asset":"application_or_support";
  const entry={path,sha256,bytes:bytes.length,disposition:role,inspection:/\.[cm]?[jt]sx?$/.test(path)&&role==="application_or_support"&&!["scripts/build-reference-data.mjs","lib/form-template-data.ts"].includes(path)?"typescript_ast":binary?"asset_hash":"content_hash_and_catalog_or_manual_review",criteria:0};fileAudit.push(entry);
  if(role!=="application_or_support"||!/\.[cm]?[jt]sx?$/.test(path)||path==="scripts/build-reference-data.mjs"||path==="lib/form-template-data.ts")continue;
  const code=bytes.toString("utf8");
  const ast=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,path.endsWith("x")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const span=node=>{const start=node.getStart(ast);return {start,end:node.end,line:ast.getLineAndCharacterOfPosition(start).line+1,sha256:digest(node.getText(ast))};};
  const symbol=node=>{for(let n=node;n;n=n.parent)if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isVariableDeclaration(n))&&n.name)return n.name.getText(ast);return "module";};
  const seen=new Set();
  function record(node,type,value,condition=null,consequence=null){
    const where=span(node),fingerprint=`${type}:${symbol(node)}:${digest(node.getText(ast))}`;
    if(seen.has(fingerprint))return;seen.add(fingerprint);entry.criteria++;
    add({id:`code.${path.replace(/[^a-zA-Z0-9]/g,"_")}.${type}.${digest(fingerprint).slice(0,20)}`,kind:"code_criterion",category:"compiled_application_policy",title:`${path} · ${symbol(node)} · ${type}`,value,condition,consequence,consumers:[{path,symbol:symbol(node),...where,fileSha256:sha256}],runtimeMode:"compiled_guard",editable:false,implementationNote:"Indexed exact executable criterion; change requires code review, tests and release. Not a legal-source verification or a remotely executable expression."});
  }
  function visit(node){
    if(ts.isIfStatement(node))record(node,"if",{expression:node.expression.getText(ast)},node.expression.getText(ast),{then:span(node.thenStatement),else:node.elseStatement?span(node.elseStatement):null});
    else if(ts.isConditionalExpression(node))record(node,"conditional",{expression:node.condition.getText(ast)},node.condition.getText(ast),{whenTrue:span(node.whenTrue),whenFalse:span(node.whenFalse)});
    else if(ts.isCaseClause(node))record(node,"switch_case",{expression:node.expression.getText(ast)},node.expression.getText(ast),node.statements.map(span));
    else if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.LessThanToken,ts.SyntaxKind.GreaterThanToken,ts.SyntaxKind.LessThanEqualsToken,ts.SyntaxKind.GreaterThanEqualsToken,ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.operatorToken.kind))record(node,"comparison",{expression:node.getText(ast)});
    else if(ts.isNumericLiteral(node)||ts.isBigIntLiteral(node))record(node,"numeric_literal",{literal:node.getText(ast),parentExpression:node.parent.getText(ast).slice(0,500),parentSpan:span(node.parent)});
    else if((ts.isStringLiteralLike(node)||ts.isTemplateExpression(node))&&node.getText(ast).length>35&&/(?:필수|금지|검토|판단|법원|변제|채무|채권|원문|미확인|누락|상충|기준|이상|이하|must|never|required|threshold|statut|policy|invariant)/i.test(node.getText(ast)))record(node,"policy_text",{text:node.getText(ast)});
    ts.forEachChild(node,visit);
  }
  visit(ast);
}
rows.sort((a,b)=>a.id.localeCompare(b.id));
const byKind=Object.fromEntries([...new Set(rows.map(r=>r.kind))].sort().map(k=>[k,rows.filter(r=>r.kind===k).length]));
const release={id:"firmengine-reference-2026-10-29.1",revision:1,sha256:digest(rows),baselineCommit:"df0ccfc011854d05117b335ce8474f065e8545f5",additionalBaselineCommits:["f56935395bd2a07e7f453e076b838bfa515e9f35","683981f9449a7b6f427ea1e2d7672b4f8516927d"],recordCount:rows.length,byKind,sourceFileCount:fileAudit.length,scope:"All tracked application source/catalog/prompt/criteria; private oracle, heldout, credentials and dependencies are not legal sources. AST criteria are indexed compiled guards, not editable legal parameters."};
const outputs={"lib/reference-data.json":{schemaVersion:"legal-reference-data/1",release,records:rows},"lib/reference-release.json":release,"docs/reference-inventory.json":{schemaVersion:"reference-source-inventory/1",release,files:fileAudit,method:{semanticCatalogs:"lossless normalized records with source JSON pointers",code:"TypeScript AST if/conditional/case/comparison/numeric/policy-text candidates",limitations:"Code candidates are indexed, not automatically legal-classified. Tests/docs are inventoried as validation/context, not promoted to binding law."}}};
let stale=false;
for(const [file,data] of Object.entries(outputs)){const serialized=JSON.stringify(data,null,2)+"\n";if(check){if(!existsSync(file)||readFileSync(file,"utf8")!==serialized){console.error(`Stale reference inventory: ${file}`);stale=true;}}else writeFileSync(file,serialized);}
console.log(JSON.stringify(release));
if(stale)process.exitCode=1;
