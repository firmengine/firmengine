export const AGENT_NODE_CONTRACTS = [
  {id:"case_planner",kind:"deterministic",responsibility:"사건 조건의 후보·확정·미확정을 구분하고 문서 항목과 계산 의존성을 선택",tool:"plan_case"},
  {id:"evidence_collector",kind:"agent",responsibility:"선택된 원문 자료·대상·기간·필드를 수집; 출처와 부재 상태 보존",tool:"existing_family_extractor"},
  {id:"source_reconciler",kind:"deterministic_and_review",responsibility:"동일인·동일채권·동일기간·단위와 충돌을 대조; 검증된 값만 결합",tool:"calculate_case"},
  {id:"legal_review",kind:"agent_and_human",responsibility:"출처가 있는 판단 후보를 제안; 인정·제외·재량은 별도 검토 상태로 보존",tool:"existing_legal_reviewer"},
  {id:"calculator",kind:"deterministic_tool",responsibility:"정해진 산식·반올림·버전으로 계산하고 누락값·계산 경로 반환",tool:"calculate_case"},
  {id:"document_binding",kind:"deterministic_tool",responsibility:"같은 사건 스냅샷의 계산 결과를 서식 토큰에 결합",tool:"build_document_payload"},
  {id:"document_review",kind:"review",responsibility:"출처·수치·작성 항목의 완전성 검토 및 기존 제출 게이트 적용",tool:"existing_export_gate"},
] as const;
