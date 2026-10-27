/** Generic source distribution: private evaluation fixtures are intentionally absent. */
export const SAMPLE_SHA256 = "";
export function samplePageRole(_hash: string, page: number): {page:number;role:"unknown"|"evidence"|"filed_form"|"administrative";documentType?:string} {
  return {page,role:"unknown"};
}
export const BENCHMARK = {
  status:"unmeasured",target:99,goldTotal:null,scorable:null,excluded:null,matched:null,score:null,
  hash:null,sourceHash:null,sourceConflicts:null,completedEvidencePages:null,attemptedEvidencePages:null,totalEvidencePages:null,
  runId:null,sourceCommit:null,packageSha256:null,
  note:"공개 소스에는 실제 의뢰인 자료·추출값·정답·평가 산출물을 포함하지 않습니다. 99%는 목표이며 이 배포판의 달성 수치가 아닙니다.",
};
