# FirmEngine A1 54차 — 역할권한 · 자동초안 인계 · 변제원장 상충
- 기준: 2026-11-01 17:52 KST 시작, GitHub `main` 관찰 SHA `3e69bacaccdeb9c6b1b4ef23fa4757bc0c4fa330`. 모든 코드 읽기와 V8 평가를 이 SHA로 고정함. 보드 blob `fe9283fef2e441b5ca5d294a35b47ba9c531ebd7`.
- 53차 DOC/LAW/DATA 다음 역할로 **IT담당자 / AX담당자 / 계산사무장**를 순환. 단일 보드의 `A1-IT-002`, `A1-AX-015`, `A1-CALC-013`만 검토. 세 항목 모두 **[ ] 미완료**.
- 최신 main ref, 최근 커밋 및 PR, `db/schema.ts`, 실제 함수·API·기존 Node 테스트·53차 영수증·수정 Draft PR #28/#80을 읽었음. 실제 고객 문서/원본 OCR/비밀키 사용 안 함.
- 검증 방법: GitHub에 저장된 **실제 해당 함수 본문에서 TypeScript 타입 표지만 제거**하고 V8에서 synthetic fixtures로 실행. Cloudflare DB·R2·브라우저나 전체 제품 실행 아님. `reconcilePlanLedger`의 외부 `moneyValue`만 합성 `amountWon -> BigInt` stub. 독립 기대값은 실행 전 정의.

## A1-IT-002 [ ] — 사용자/직원/사무장/변호사/관리자 권한
- `lib/app-roles.ts` blob `a716bc17109d9bff7ff88c89606a49949e75a1df`, `tests/app-roles.test.ts` blob `9d85dbe1c4d6fb222c263ac3f2f85cd5824f6ca1`, `lib/case-command-store.ts` blob `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 실행: `roleGrantApplies` 실제 함수 8조건. 시험시각 `2026-11-01T08:52:12Z`, synthetic actor A, case A, lawyer_review, active 기간 2026-10-01 이후: 같은 사건 허용 / 다른 사건 차단 / 다른 actor 차단 / 다른 역할 차단 / revoked 차단 / 장래 effectiveFrom 차단 / 만료 effectiveTo 차단 / 전역 `*` 허용. **8/8 기대 일치**.
- 정적 교차: 사건 명령 경로 `authorize(caseId)`가 사람 actor + case_editor를 요구, 문서 검수 `document.review`는 `caseworker_review` 또는 `lawyer_review` 및 final/processingReady 상태를 검사. 자동초안 인계 POST는 `case_editor`와 `caseworker_review` 모두 요구. `app_role_grants`에 actor/role/scope 복합 PK 존재. `role_admin` 단독으로 법률·직원 검수를 대리할 수 있다고 판정하지 않음.
- 제한: app roles의 5개 내부 문자열과 사용자 요청의 6개 **업무 역할은 일대일 동의어가 아님**. 실제 사용자/사무장 업무별 API·테넌트 grant·동시 revoke/commit race 및 D1 격리, 전체 브라우저/사람 신원 검증은 미실행. 별도 기존 동일 actor 최종검수 차단 [Draft PR #28](https://github.com/firmengine/firmengine/pull/28)은 미병합; 이 회차에 동일 actor 도메인 함수를 재실행한 것은 아님.

## A1-AX-015 [ ] — 자동초안 → 직원편집 → 변호사 검수
- `lib/automatic-draft-handoff-contract.ts` blob `43cd0e0245bb74d396879880161654cf80a2978e`, `lib/automatic-draft-handoff.ts` blob `a525e3c12672966c993f83021d5f169b170bebe9`, `lib/automatic-draft-review-handoff.ts` blob `c9b27d56a88b95a314992d068dfb09687b290991`; 대응 테스트 `tests/automatic-draft-handoff-contract.test.ts` blob `01724a1f0e214701fdc89458ef776c2606c0f1ee`, `tests/automatic-draft-review-handoff.test.ts` blob `8f608562f6430ad793e205cc286a09b60d7e72a4`.
- 실행: `automaticDraftHandoffDecision` 실제 함수 V8 9조건. 기본 동일 case/revision/dataVersion/legal/calculation/reference→`eligible:true,alreadyLinked:false`; dataVersion 변경, 기준정보 SHA 변경, 기존 final manifest, 다른 current 파일, 미적용 직원 편집, 진행 중 run, 타사건 run은 **인계 차단**. 정확히 동일한 원본 run/artifact IDs+hashes의 이미 연결된 draft는 `alreadyLinked:true`. **9/9 독립 기대 일치**.
- 정적 교차: POST `app/api/cases/[id]/automatic-draft-handoff/route.ts` blob `1ba46ee3d55c5a02560525a047cc91062e3e15a2`; R2/SQL artifact 검사, source head 재확인, `newExportManifest(...,"draft")`, staff `document.edit`, 최종 `document.review` 기능 경로를 분리. `draft` 연결≠최종 법률 승인/법원 제출.
- 제한: 위 9개는 **읽기 전용 결정 함수**의 격리 실행이다. 실제 R2 hash 재조회→D1 CAS→직원 Word 문안 수정→재생성→서로 다른 사람의 2회 검수와 95개 법률 판단을 종단 실행하지 않음. 기존 PR #17/#24/#28의 수정 코드는 main 통합 미인증.

## A1-CALC-013 [ ] — 총변제·채권별 배분·현재가치·청산가치
- `lib/plan-reconciliation.ts` main blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3` vs 기존 [Draft PR #80](https://github.com/firmengine/firmengine/pull/80)의 동일파일 blob `e0f39b09a33733c4f4300347e22485f6de9002f1`. 기존 `tests/repayment-plan-model.test.ts` blob `b5ba94a3264a42fcbda6135f6c59f4fdfb0d9988`. `assessment.ts`에서 명목 총액과 현재가치 별도 처리 경로 정적 확인.
- 합성 단일 채권 id=`loan-1`, 원금 100원·이자 0원, 2개월 각 50원, 월 ordinary budget 50원, disposable income 50원, trustee fee 0원, 각 월 별도 수수료 0원 행. 독립 기대와 실제 결과:
  1. 정상 2개월 원장: `reconciled` — **main/PR 모두 일치**.
  2. 채권을 미등록 `ghost` ID로 변경: 기대 `blocked`; main **`reconciled` 오통과**, PR #80 `LEDGER_DEBT_MISSING:ghost`로 차단.
  3. 0원 회생위원 보수행을 같은 월 중복: 기대 `blocked`; main **`reconciled` 오통과**, PR #80 `DUPLICATE_TRUSTEE_FEE_MONTH:1`로 차단.
  4. 일반채권 행의 fundingSource를 `priority_budget`으로 조작: 기대 `blocked`; main **`reconciled` 오통과**, PR #80 `INVALID_LEDGER_FUNDING_SOURCE:1:loan-1` 및 월 2 오류로 차단.
  5. 명목 planTotalWon만 120원으로 변경: 산술 원장 `reconciled`이되 `legalReviewTasks`에 `ORDINARY_ALLOCATION_UNRESOLVED` 유지 — **main/PR 모두 일치**.
- **실제 함수 V8 합성 main 2/5, PR #80 5/5 기대 일치**. 3개는 이미 28차에서 등록한 **기존 P1 후보**이므로 신규 결함/신규 PR로 중복 집계하지 않음.
- 검증 범위는 변제원장 ID·월별 회차·예산출처와 명목 총액 review task다. 현재가치 할인율·청산가치·36/48/60회차 분할·공식 서식/법률 인정은 **미검증**. `reconciled`은 법률상 확정/최종 발행 가능의 의미가 아님.

## 결정/코드 조치/다음
- 이번 회차 **V8 독립조건 22개 = IT 8 + AX 9 + CALC 5**, main 기대일치 **19/22**, 기존 Draft #80 비교 **5/5**. 세 main 반례는 기존 P1 후보. 새 소스 패치 0, 새 PR 0, `main` 제품 코드 변경 0.
- 전체 Node/TypeScript/lint/CI/build, staging D1/R2/Cron, 실제 브라우저, DOCX/법원 공식서식, 사무장·변호사 승인, 운영 배포/마이그레이션/전자제출·법원 인가 확정: **모두 미검증·미실행**. 모델의 실제 Extra High 설정 여부는 확인 불가.
- 중앙 보드 **A1-IT-002 / A1-AX-015 / A1-CALC-013**만 부분 검증 이력 추가하고 미완료 유지. 다음 회차 역할 DOC/LAW/DATA, ID **A1-DOC-004**(근로·사업·겸업·무직·휴직 서류), **A1-LAW-005**(보증/양도/사인거래), **A1-DATA-004**(동일 OCR ID 복수행/last-wins) 제안. 본 파일 자체는 법적 인수 증명 아님.
