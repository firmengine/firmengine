# 계산에서 조용히 빠진 OCR 원천 금액 — 실행 차단 구현

2026-10-30 현재 29개의 **검토 대상 원천 금액**을 정확한 canonical ID 기준으로 분류했다. 이 중 'must_reconcile' 금액은 같은 원본 Fact ID와 정확한 계산용 객체·금액에 연결되지 않으면 `assessment.calculation.issues`에 `CALC_INPUT_...` 코드가 발생하도록 **실제 엔진에 연결**했다. 이미 연결된 값도 액수·단위가 어긋나면 오류로 처리한다.

사용 금지 자동 추정: 회사명만으로 근로자 소득원 합산, 신청인이 아닌 타인의 대출·보험·재산 자동 산입, 기존 대출 원금과 현재 잔액 혼용, 보험 납입보험료를 해약환급금으로 치환, 부가가치세 매출을 사업 순이익으로 간주하는 것.

`context_only`는 중요할 수 있지만 법적 귀속·공제 가능성·기간 또는 사건 대상 여부에 사람의 판단이 필요한 관측이다. 이를 원금·청산가치·생계비로 자동 합산하지 않고 원본 사실로 남긴다. 최종 요건에 등록된 경우 별도의 사건별 증빙 게이트에서 다룬다.

영향받은 실제 코드: `lib/material-calculation-source-gate.ts` + `lib/assessment.ts:calculateCase`. 회귀 테스트: `tests/material-calculation-source-gate.test.ts`. 운영 DB 적용 및 전체 Node 회귀 실행은 별도 확인해야 한다.
