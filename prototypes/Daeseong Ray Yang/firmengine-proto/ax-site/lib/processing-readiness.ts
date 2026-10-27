import type { CaseData } from "./domain.ts";
import type { Assessment } from "./assessment.ts";

export interface StoredDocumentState {id:string;ready:number;}
export interface StoredPageState {documentId:string;page:number;role:string;status:string;imageReady:number;}
export interface ProcessingReadiness {complete:boolean;evidencePages:number;completedPages:number;issues:{documentId:string;page?:number;code:string;message:string}[];}

/** Source completeness is independent of a person's inventory checkbox. */
export function inspectProcessingReadiness(data:CaseData,documents:StoredDocumentState[],jobs:StoredPageState[]):ProcessingReadiness{
  const issues:ProcessingReadiness["issues"]=[];let evidencePages=0,completedPages=0;
  for(const doc of data.documents.filter(d=>d.status==="active")){
    if(documents.find(d=>d.id===doc.id)?.ready!==1)issues.push({documentId:doc.id,code:"ORIGINAL_UPLOAD_INCOMPLETE",message:`${doc.name}: 원본 업로드·해시 확인이 완료되지 않았습니다.`});
    for(const page of doc.pages){
      const evidence=data.pages.find(p=>p.documentId===doc.id&&p.page===page),job=jobs.find(j=>j.documentId===doc.id&&j.page===page);
      if(evidence&&["filed_form","administrative"].includes(evidence.role))continue;
      evidencePages++;
      if(!evidence||evidence.role!=="evidence")issues.push({documentId:doc.id,page,code:"PAGE_ROLE_UNRESOLVED",message:`${doc.name} ${page}쪽: 생성용 증빙인지 분류가 끝나지 않았습니다.`});
      else if(!job||job.imageReady!==1)issues.push({documentId:doc.id,page,code:"PAGE_UPLOAD_INCOMPLETE",message:`${doc.name} ${page}쪽: 원문 이미지가 저장되지 않았습니다.`});
      else if(job.role!=="evidence"||job.status!=="completed")issues.push({documentId:doc.id,page,code:"PAGE_REVIEW_INCOMPLETE",message:`${doc.name} ${page}쪽: 추출·행 누락·독립 대조가 완료되지 않았습니다.`});
      else completedPages++;
    }
  }
  return {complete:issues.length===0,evidencePages,completedPages,issues};
}

export function applyProcessingGate(assessment:Assessment,readiness:ProcessingReadiness):Assessment{
  if(readiness.complete)return assessment;
  return {...assessment,status:assessment.status==="requirements_not_met"?assessment.status:"needs_evidence",label:assessment.status==="requirements_not_met"?assessment.label:"증빙 처리·검증 보완 필요",generationGate:{...assessment.generationGate,canFinalize:false,reasons:[...assessment.generationGate.reasons,`증빙 처리 미완료 ${readiness.issues.length}건`]},findings:[...assessment.findings,{id:"processing_completeness",category:"evidence",severity:"blocking",outcome:"unknown",title:"전체 증빙 처리 완료 확인",detail:`생성용 ${readiness.evidencePages}쪽 중 ${readiness.completedPages}쪽의 추출·독립 대조가 완료되었습니다. ${readiness.issues.slice(0,5).map(i=>i.message).join(" ")}`,factIds:[],ruleSourceIds:[],nextAction:"자료함에서 누락된 업로드·페이지 역할·판독 오류를 해결하세요. 행 누락이나 상충이 남은 페이지는 재판독해야 합니다."}]};
}
