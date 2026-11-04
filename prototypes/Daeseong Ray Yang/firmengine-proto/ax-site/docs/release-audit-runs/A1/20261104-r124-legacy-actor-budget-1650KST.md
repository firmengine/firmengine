# FirmEngine AX — A1 제124차 코드 완결성·기능충돌 독립검증 영수증

- 일자: 2026-11-04 KST (A1 독립 회차); 허용 위치: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 검증 시작 `main` 커밋: `d67e6f1b04dbd16b914fab7b719eee6f4c0dc462`. 영수증 작성 직전 재조회: `d67e6f1b04dbd16b914fab7b719eee6f4c0dc462`.
- 대상 단일 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (작성 직전 blob `23f0258aaaa557f2b7663953f9b51e1cd5fb9ab9`); 다음 역할 순환은 사용자·서류담당자 → 변호사 → 데이터담당자.
- 본 영수증은 **실제 원본 TS에서 타입 선언만 제거해 V8에서 격리 실행**한 결과다. `structuredClone`은 JSON 기반 구조복사 합성 스텁, DB·원천 검증·승인 신원·전문가 평가 등은 실제 서비스가 아니다. 전체 Node/TS/CI, 브라우저, staging D1/R2/Cron, 공식 법원서식, 변호사 승인, 배포 결과 **미관찰**. 합성 수치는 실제 의뢰인 자료가 아님.
- 최근 Git HEAD는 A3 보드/영수증 병렬 반영 포함. 확인 PR: Draft [#171](https://github.com/firmengine/firmengine/pull/171), [#55](https://github.com/firmengine/firmengine/pull/55), [#85](https://github.com/firmengine/firmengine/pull/85), [#41](https://github.com/firmengine/firmengine/pull/41) 모두 당시 open/unmerged. 공통 실행코드 수정·법적 인가기준 승격 **없음**.

## A1-IT-011 [ ] — 구판본 workflow null 역호환/소비 충돌

- 실제 main: `lib/case-workflow-state.ts` blob `e43ffe37a4f832d6f486633a6c7ae9054bb4e8d1`; `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`; `lib/case-workflow-server.ts` blob `7e1a96e79afcdc0ff81e950fe52556b2794ab465`. 저장 read 경계 `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` 조회.
- 실제 원본문 `caseWorkflow(input)`+소비식 `work.tasks.findIndex(t=>t.id===target.taskId)`, `workflow.requirements.some(req=>req.substitutionReview)`을 V8에서 호출. 누락된 배열은 기본 `[]`을 허용하고 미래 임의 필드는 보존하는 독립 기대. 명시적 null/스칼라/잘못된 workflow 객체는 **검토 보류**해야 한다는 독립 기대.
- **main 5/14** 일치. 누락·유효한 구판본·미래 필드·정상 tasks/requirements 5조건은 허용. 반면 `{tasks:null}`·`{requirements:null}`·`{tasks:0}`·`{requirements:{}}`·`{tasks:"unknown"}`·`{requirements:[],tasks:null}`을 그대로 반환해 실제 소비식에서 **TypeError 6조건**. `workflowState:null`·`[]`·`{businessNetReviews:null}`도 읽기 경계에서 거부되지 않음(3조건, 위 두 소비식은 일부 즉시 예외 없음). 실제 HTTP 409/500 미재현.
- 기존 [Draft #171](https://github.com/firmengine/firmengine/pull/171)의 `invalidWorkflowArrayFields` 파일(blob `3cb06a69f5c1daf4df32c1c9b288481ecfb8e625`)을 같은 14개 합성값에 실행해 **14/14** 독립 기대 부합. 실제 `getCase` read 경계·전체 회귀/Node/D1 미병합·미실행이므로 완료하지 않음.
- 조치: 기존 Draft #171 검토 대기; main 변경 없음. **다음 통합 검증**: old CaseData JSON(null/omitted/unknown) → GET workflow/command API의 예외 없는 409 보류와 복구 UI 확인.

## A1-AX-011 [ ] — 사업소득 제안/승인의 담당자 독립성

- 실제 main `lib/business-net-reconciliation.ts` blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`; `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`. 기존 main `tests/business-net-review-lifecycle.test.ts` blob `dc089bd14f4c07f204cde7ca4038fe49ca08410c`의 정확 동일인 1테스트만으로 공백 동치가 담보되지 않는 점 확인.
- `adoptBusinessNet` 원본문에서 `exactReview=true`(합성 원천검증 스텁), 날짜·금액 변환 합성 의존성으로 13개 actor 조건 비교: **main 7/13** 기대 일치. `proposer="clerk", reviewer=" clerk "`, `proposer=" clerk ", reviewer="clerk"`, 빈/공백/undefined/null proposer의 6조건에서 잘못 actor gate 통과. 서로 다른 검수자/정확한 동일인/빈 검수자 등은 기대 일치. 이는 *신원 독립 검사 이후의 실제 법률 인가* 검증이 아니다.
- 저장된 과거 검토를 판별하는 `validBusinessNetReview` 실제 함수(같은 source, `exactReview=true` 스텁) 12개: **main 6/12** 기대 일치. 같은 사람·패딩된 같은 사람·없거나 빈 proposer 총 6조건에서 과거 승인 유효로 반환. 이것이 실제 DB의 승인 상태를 변경했다는 주장은 하지 않는다.
- [Draft #85](https://github.com/firmengine/firmengine/pull/85) actor-adopt 분기만 합성 치환해 **13/13**, [Draft #55](https://github.com/firmengine/firmengine/pull/55) 역사 승인 분기만 합성 치환해 **12/12** 기대에 일치. 두 PR은 **같은 파일** 변경이므로 독립 단위 기대일치가 통합 병합/사람 승인 통과를 증명하지 않는다. 코드 조치: 중복 PR 신설 또는 main 병합 없음.
- 남은 일: 실제 신원 `actor()/rolesForActor`·`review(auth,"lawyer_review")` → `reduceCaseCommand` → D1 receipt → 18계산의 accepted 소비처와 이후 95법률/문서 게이트를 함께 재현. 법률상 비용 인정 정책은 변호사 승인 전 확정하지 않는다.

## A1-CALC-011 [ ] — 월 변제가능액·회생위원 보수/우선·재단 비용

- 실제 main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/case-legal-calculation-preflight.ts` blob `c17892e63bf00d2981f292b0ef28e032d66a8dc7`. 기존 `tests/case-legal-calculation-preflight.test.ts` blob `46c7243e5e7ed44a7349a042f229d77535a8f28d` 읽음.
- `assessment.ts`에서 trustee·priority·estate → ordinaryBudget → 승인 제안 월변제액 → planTotal 계산 **원본 산식 일부**, `domain.ts`의 실제 `normalizeMoney/moneyValue`를 타입 주석만 제거해 V8 실행. **23/23** 독립 기대 부합. 기본 가상 월소득 3,000,000원 - 인정생계비 2,000,000원 - 보수 100,000원 - 우선 0원 - 재단 0원 = **900,000원/월**, 36회 = **32,400,000원**. 세 비용 각각 미관찰/명시 null/음수이면 `ordinaryBudget/monthlyPayment/planTotal=null` 및 `PLAN_COST_OR_PRIORITY_PAYMENT_MISSING`; 명시 0은 정상 금액, 예산초과 제안은 지급액 null, 기간 0/소수/121개월의 총액 null. 독립 법률 적법성이나 공식 계획 승인 의미 아님.
- `evaluateLegalCalculationPreflight` 원본문 16개 합성: **12/16** 기대 부합. 필수 계산출력 누락/null/미검토/중복 차단, 명시 원화 `"0"` 통과. 반면 필수 `ordinaryRepaymentBudgetWon`의 `computed NaN/Infinity/true/{x:1}`을 `ready=true`로 허용하는 **4조건** 확인. 별도 확장 Won 값 17개에서 main **7/17**, 기존 [Draft #41](https://github.com/firmengine/firmengine/pull/41) HEAD `3e6a673789e06e984bdffd9d8e4180ad351f4626` 파일 blob `14895627ae1664b337aed8cfff7d4a841c634469` V8 **17/17** 독립 기대 일치. 이는 저장 JSON·승인된 outputName 판본/실D1 경계 검증이 아님.
- 주의: 엔진 issue `PLAN_COST_OR_PRIORITY_PAYMENT_MISSING`만으로 예비 법률 **자문** 실행을 막지는 않는 기존 정책(`requiredOutputs=[]`일 때 ready). 그러나 공식 **변제계획 생성·법률 확정**과 구별해야 하며 18계산/95법률→문서쓰기 종단 게이트는 미검증. `NaN` 직접 인수는 JSON 수송 시 null 변환 가능하나 Boolean/객체/지수 문자열 등 실제 파싱 가능한 반례가 존재. 기존 PR #41이 동일 결함 수정/회귀 테스트를 포함하므로 병합 없이 별도 검토.
- 코드 조치: main 코드 변경/임의 법률·계산 의미 변경 없음. PR #41의 원화 정수 계약과 법률 정책 검토 + 전체 Node·staging 검증 필요.

## 판정과 다음 축

- 이번 **main 원본문 격리 실행 기대일치 53/78**: IT 5/14, AX 채택 7/13+과거 6/12, CALC 예산 23/23+AI 준비상태 12/16. 25조건 독립 기대 불일치(IT 9, AX 12, CALC 4). 범위별 원본문/합성 의존성의 제한 결과이지 제품 정확도/운영 사고 건수가 아님.
- Draft별 독립 합성 검증: #171 14/14, #85 13/13, #55 12/12, #41 17/17. **서로 결합된 전체 CI 합격 아님.** 구현 코드는 이번에 변경하지 않고 문서 영수증/해당 보드 ID만 갱신한다.
- 다음 순환: **A1-DOC-012** 갈음 승인 후 원본 철회/상담변경 복원, **A1-LAW-014** 50 규칙·46 예외의 미적용/상충, **A1-DATA-012** 출처 없는 값의 계산/법률 소비 차단. 실제 main/보드/선행 커밋·PR 재조회 후 대상 결정.
- 상담→85요구서류→OCR→정규화→18계산→95법률→자동초안→직원문안검수→법원 보정, C01/C02/C04·복수행·동시 사건 종단 인수 **0건**. 실제 고객정보·키·원문 OCR·비공개 정답 공개 Git 유입 없음. 운영 배포·운영 D1 마이그레이션·전자제출·법원인가 확정 **수행하지 않음**. Extra High 추론 설정 확인 불가.
