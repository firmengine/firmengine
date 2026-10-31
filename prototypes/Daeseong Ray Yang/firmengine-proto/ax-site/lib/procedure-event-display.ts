/** Display-only copy for staff-recorded court procedure events. This module cannot confer legal approval. */
export const COURT_PROCEDURE_NOTICE =
  "내부 예상 보완요청은 법원 보정명령이 아닙니다. 절차 상태는 담당자가 입력한 기록이며, 법원 사건번호·자료 ID만으로 보정명령 발령·제출기한·접수증 또는 법원 인정을 증명하지 않습니다. 법원 원문·기한·접수증은 담당자와 변호사가 별도 확인해야 합니다.";

const COURT_REVIEW_LABELS: Readonly<Record<string,string>> = {
  correction_requested: "법원 보정 요청 기록(원문 검증 별도)",
  amended: "보정 제출 기록(접수증 검증 별도)",
};

export function procedureEventDisplayLabel(state:string,fallback:string):string {
  return COURT_REVIEW_LABELS[state] ?? fallback;
}
