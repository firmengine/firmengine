# FirmEngine A1 — 106차 코드 완결성·상호 기능충돌 감사 (2026-11-03 22:56 KST)

- **허용 범위:** `firmengine/firmengine`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 105차 인수에 이어 **IT담당자 → AX담당자 → 계산사무장** 순환. 선정 ID **A1-IT-011 / A1-AX-011 / A1-CALC-011** 모두 인수 [ ].
- **읽기 시작 직후 HEAD:** `326b6012cad6137eff1010e9e031e6195110aab8`; 기록 직전 재조회 HEAD `326b6012cad6137eff1010e9e031e6195110aab8`, 보드 blob `079adcd4083fb581481dcf749693fa954d8f3175`. 최근 main의 A3 106차 커밋 2건 및 105차 A1 영수증 확인. Draft #171/#85/#55 개방·미병합 확인. 표준 스키마 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` 및 `tests/case-schema-migration.test.ts` blob `48bbaf9ad3486c1216ea2c21552060e72c2d052d`, `tests/business-net-review-lifecycle.test.ts` blob `dc089bd14f4c07f204cde7ca4038fe49ca08410c`, `tests/case-legal-calculation-preflight.test.ts` blob `46c7243e5e7ed44a7349a042f229d77535a8f28d` 읽음.
- **검증 방법:** GitHub에서 받은 실제 main TypeScript 함수 본문에서 타입 선언·타입 인자만 제거하여 이 실행의 V8 `new Function`에서 호출. 의존성 `structuredClone`은 JSON 복제, `exactReview`는 항상 true인 합성 스텁, `createCaseReadIndex`는 빈 객체, `normalizeMoney`는 합성 객체, 계산 `moneyValue`는 정수문자열→BigInt로 대체. **실제 Node/TS 프로젝트·DB·HTTP·브라우저를 실행한 것이 아님**. 원문 SHA/회계 인정/신원 증명 등 스텁으로 해결된 것처럼 표시 금지.
- **조건별 기대 부합:** IT main **4/11** (Draft #171 입력검증 함수 **11/11**), AX main 채택 **8/11** + 과거 승인 유효성 **6/9** = **14/20** (Draft #85 각각 **11/11+6/9**, Draft #55 **8/11+9/9**), CALC `assessment.ts` 금액 코드 조각 **12/12**, `case-legal-calculation-preflight.ts` 함수 **13/13**. 서로 다른 합성 검사의 기대부합 횟수이며 제품 합격률/CI가 아니다.

## A1-IT-011 [ ] — legacy workflow 배열의 명시적 null·이상형

- **main 소스** `lib/case-workflow-state.ts` blob `e43ffe37a4f832d6f486633a6c7ae9054bb4e8d1`, `lib/case-workflow-server.ts` blob `7e1a96e79afcdc0ff81e950fe52556b2794ab465`, `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`.
- **독립 기대:** 미존재 필드·미래 알 수 없는 필드는 보존/기본값 허용하되 명시 `tasks:null`, `requirements:null`, 복수 null, `tasks:0`, `requirements:{}`, `workflowState:null` 및 배열형 workflowState는 비정상 상태를 **409 검토보류**로 처리; 임의 빈 목록 변환 금지. 
- **11개 실제 V8 입력:** absent undefined; 누락/구판본 requirements=[]; futureExtension; tasks null; requirements null; both null; tasks=0; requirements={}; workflowState=null; workflowState=[]; valid all arrays. **main 4/11**: 정상 4입력은 허용되지만 비정상 7입력을 거부하지 않음. 위의 배열 필드 5변형은 실제 `caseWorkflow` 이후 `.findIndex`/`.some`에서 **TypeError**; workflowState null/[]은 기본배열로 덮어져 **미관찰 상태의 빈 목록 오인**. 서버 코드의 `workflow.requirements.some` 소비를 정적 확인하였으나 실제 HTTP 500은 재현하지 않았음.
- **기존 Draft #171** `lib/case-workflow-contract.ts` blob `3cb06a69f5c1daf4df32c1c9b288481ecfb8e625`의 **실제 invalidWorkflowArrayFields**를 V8 재실행: 11/11, 위 7개 비정상값을 구별해 반환, 정상 입력은 무차단. 해당 PR의 `server-store.getCase` 409 연동 경로는 diff 정적 확인만, 실제 API 409·프로젝트 Node/CI는 미검증. 별도 중복 수정 없음.

## A1-AX-011 [ ] — 사업소득 제안자·승인자 동일인/미기록 승인 우회

- **main 소스** `lib/business-net-reconciliation.ts` blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`; `lib/case-commands.ts`의 채택 연결 `reduceCaseCommand` 정적 확인.
- **합성 원천**: 제안자 `staff`, 검토자 `lawyer`, 월 `2026-01`, 가상 매출 5,000원·비용 1,000원·순소득 4,000원. 원천 Fact 검증은 이번 조건에서 `exactReview=true` 합성 스텁이며, 실제 정책·SHA·법률 승인이라고 주장하지 않음.
- **실제 채택 함수 11조건**: 다른 사람(성공), 정확한 동일인(거부), `staff` vs ` staff `(거부 기대), 공백 제안자(거부 기대), 공백동치 제안자(거부 기대), 공백 승인자, 짧은 사유, 잘못된 일시, stale 제안, 이미 존재하는 대상 소득, 다른 담당자(성공). **main 8/11**; 세 반례에서 승인 생성. 기존 [Draft #85](https://github.com/firmengine/firmengine/pull/85) `lib/business-net-reconciliation.ts` blob `98ebec78633b93980f08ed50c508e5b12fc331b4` **11/11**.
- **기존 승인 유효성 함수 9조건:** 정상, 동일인, 공백동치 동일인, 공백 제안자, 공백 검토자, 사유 공백, 일시 공백, 미승인 status, 서로 다른 제안자/검토자. **main 6/9**, 동일인·공백동치 동일인·공백 제안자에 거짓 유효. [Draft #55](https://github.com/firmengine/firmengine/pull/55) `lib/business-net-reconciliation.ts` blob `7a5552d23ce2324b9238b328e8287c100b38f724` **9/9**.
- **병합경계:** #85는 채택 단계 수정, #55는 이미 승인된 과거 기록의 유효성 수정; **같은 파일**을 변경하므로 둘 모두 고려한 통합안을 별도 테스트 전 자동 병합 금지. `reviewedBusinessIncomeIds`의 실제 원천 연결 및 승인자의 서버 역할·신원·DB 이벤트·변호사 승인은 미검증.

## A1-CALC-011 [ ] — 필수 비용 누락·월 변제가능액·예비 법률 실행 경계

- **main 소스** `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5` 중 `trustee,priority,estate,disposable,ordinaryBudget,approvedPayment,payment` 원본문 계산 구간, `lib/case-legal-calculation-preflight.ts` blob `c17892e63bf00d2981f292b0ef28e032d66a8dc7`의 `evaluateLegalCalculationPreflight` 전체 함수.
- **예시 독립 계산:** 가상 월소득 5,000원, 생활비 2,000원, 회생위원 보수 100원, 우선채권 200원, 재단채권 300원 → **일반 월 변제예산 2,400원**·제안 변제 2,400원. 보수·우선·재단 중 어느 하나라도 null이면 일반예산 및 변제액 **null**. 명시적 0 비용 모두 입력 시 월 3,000원. 비용 음수/unknown은 null. 월 3,000원 한도에서 채택 제안 9,000원은 지급액 null, 제안 1,500원은 1,500원. 일반예산 0원/음수는 최종 지급 null. **실제 부분 계산 12/12 기대 일치**.
- **예비 법률 계산 게이트 13조건:** 현재 계산 head 부재→waiting_evidence; 선택적 비용 누락 사유 `PLAN_COST_OR_PRIORITY_PAYMENT_MISSING` 단독은 ready(선행 차단 정책의 **의도적 예외**); optional 현재가치 검토도 ready; 소득기간 미선정·불완전과 Fact 불일치/중복 typed는 review_required; 법률 규칙이 필수로 지정한 일반예산 출력의 행 부재/null/provisional/중복행은 review_required; **명시 0원 computed 단일행은 ready**. 실제 함수 **13/13 기대 일치**. **ready는 법률 인가/최종 문서 완성 의미가 아니라 예비 법률 AI 실행 가능**.
- **남은 연결:** 18개 계산 전체 결과·원천 Fact·추출 결손·95법률 필수출력 정책·표준 서식/변제예정액표에서 비용 누락이 끝까지 차단되는지 미검증. PR #50 등 문서-출력 게이트 통합 검증 없이 최종문서 인수 금지. 실무 계산사무장·변호사 법적 인정 미확인.

## 코드·Git 조치, 후속 ID

- **제품 코드 수정/신규 PR 0건**: 재현된 IT/AX 결함은 이미 미병합 Draft #171/#85/#55에 중복 없는 별도 보완안이 있음. 법률 인식·계산 의미 변경 금지. 통합 병합 후 회귀가 없으므로 `[ ]` 유지.
- 이 영수증 및 중앙 보드 대상 ID 3개만 안전하게 갱신한다. **후속 순환:** 사용자·서류담당자 → 변호사 → 데이터담당자. 확인 대상 `A1-DOC-012`, `A1-LAW-013`, `A1-DATA-012` (실제 보드 존재 확인: A1-DOC-012:true, A1-LAW-013:true, A1-DATA-012:true).
- **인수 경계:** GitHub 실제 소스 V8 합성 실행 ≠ Node 프로젝트 테스트 ≠ 최신 main CI ≠ 브라우저/HTTP ≠ staging D1/R2/Cron ≠ 공식 서식·변호사 승인 ≠ 운영 배포. 85서류/갈음 A←B+C/C01-C02-C04/18계산·95법률 전체/법원 보정 종단 미실행. 제품 전체 종단 인수 0건. 실제 개인정보·고객 문서·원본 OCR 값·키/.env·비공개 정답 미사용. 운영 배포, 운영 D1 마이그레이션, 전자제출, 법원 인가 확정 미실행. **실제 Extra High 추론 모드 설정 확인 불가**.
