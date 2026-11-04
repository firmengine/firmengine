# A1 128차 — 법률 조회 원장 경합·증빙 역질문·변제원장 합산 충돌

- 수행일: **2026-11-04 20:48 KST**, 당시 GitHub main HEAD **`4297a015c91aa14ccc42a0deb652bdeb2c91691b`**; 읽은 원본 파일의 blob SHA는 각 절에 기재. 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 순환 역할: **IT담당자 → AX담당자 → 계산사무장**. 인수 보드 ID **A1-IT-013 / A1-AX-013 / A1-CALC-013** 모두 **[ ] 미완료**.
- 기존 127차 [영수증](20261104-r127-guidance-independent-review-active-head-1948KST.md), 중앙 보드, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, `tests/extraction-row-store.test.ts` blob `adbb896c5bc69716e34ee82c5bfedc5555f677a2`, `tests/case-lawgraph-store.test.ts` blob `017149328d2a64f3572ea302758abc9866111381`, 최근 main 변경 및 관련 open Draft PR 상태 읽음. 127차는 OCR/계산 대량행 read head 경합을 검증했고, 이번에는 **법률 review head**, 사람 역질문 및 원장 채권/법률보류 판정으로 연결.
- **방법:** GitHub main TypeScript의 함수 본문을 읽고 실행에 필요한 TS 타입 문법만 제거하여 JavaScript V8에서 직접 실행. 실제 계산기·모델·D1 SQL/storage·`moneyValue` 등 외부 의존성은 명시적인 합성 어댑터로 주입. 예시 사건 ID·채권·금액은 모두 합성. **프로젝트 Node/TypeScript 전체 빌드/CI, staging D1/R2/Cron, 브라우저, 공식 서식, 실제 변호사 검수나 운영테스트가 아님.**

## A1-IT-013 [ ] — 법률 조회 페이지 active head 경합

- 원본문 `lib/case-lawgraph-store.ts` blob **`eea435bb78f804c79a213c464af54e8014a3c3a5`**의 `listCaseLawgraphReview` 및 `db/schema.ts`의 `case_legal_review_heads/runs/conditions/field_values` 확인. 기존 PR [#180](https://github.com/firmengine/firmengine/pull/180) **open/draft, main 미병합**; OCR [#52](https://github.com/firmengine/firmengine/pull/52), 계산 [#49](https://github.com/firmengine/firmengine/pull/49)도 open/draft.
- 독립 기대: 동일 사건 revision·dataVersion을 유지해도 active `review_run_id`가 바뀌면 (i) 페이지 읽는 중 구판본의 `headStale=false` 반환 금지, (ii) 페이지 0=A와 다음 페이지 1=B가 섞이는 것을 run anchor/409로 방지. 데이터 버전 변화나 명시적 mismatch는 별도로 차단.
- 합성 review row 5개, limit 3, 실제 원본 함수 호출 **7조건 중 5기대일치**. 정상 페이지0=A0..A2/nextOffset3, 페이지1=A3..A4/nextOffset null, 명시적 expectedDataVersion 불일치 즉시 `LEGAL_REVIEW_VERSION_MISMATCH`, 조회 중 dataVersion 변경 동일 예외, 정상 첫 페이지 통과.
- **2반례:** 선택된 `head A`로 필드를 조회하는 사이 활성 `head B`로 바뀌었지만 함수가 `runId=A/headStale=false` 반환. 두 독립 HTTP 페이지 호출 사이 A→B 변경 시 앞 페이지 A0..A2+뒤 페이지 B3..B4를 버전충돌 없이 받아 혼합 가능. 합성 DB SQL 호출 순서에 변경을 주입했으며 **실제 D1 race 재현은 아님**.
- 기존 Draft #180은 관련 읽기중/페이지간 active head 기준 보완 후보. 수정안 재실행이나 Node·실 DB·대량 500행 검사 이번 회차 미수행. [ ] 유지.

## A1-AX-013 [ ] — 증빙 부족→사람 질문·서류 요청 분기

- `lib/approval-issue-graph.ts` blob **`53df46fa1fcf34e19d8e9a192da1a8f87bf897cd`** 실제 `buildApprovalIssueGraph` 본문, `app/api/cases/[id]/approval-readiness/route.ts` blob `731f66a10d4af704b432dcd298061b452941fd13`, `app/api/cases/[id]/requirements/route.ts` blob `64eb0d2c6a12dfdf7f6f2889eaecdfc1fb417b2e`, `lib/case-requirement-monitor.ts` blob `5dfacd3a7738358fb27b95016d0e63bd93c8bb1b` 읽음. approval-readiness GET은 **read-only 진단**으로 명시되고, requirements GET은 기존 요청 목록을 조회함.
- 합성 단일 위험 R1, 승인된 근거계약(필수 canonical `income`, 필수 계산출력 `monthlyIncomeWon`), 원문 Fact F1, 독립 법률 상태를 조합한 **10조건 중 8기대일치**.
  - 정상: 원문 유효·인정 `0`과 계산 `"0"`은 지원/계산존재 구분하되 법원승인 **false**, 질문 없음.
  - 원문 없음 ⇒ `source_feature` 질문; 관측·미인정(0 포함) ⇒ 동일 질문; 계산 null/출력 누락 ⇒ `calculation_input` 질문. 근거계약 미승인 ⇒ 자동 필수승격/질문 없음.
  - **연결 미검증/정책후보 2건:** 원문·계산 충족이라도 기존 법률 항목이 `conflict` 또는 `missing`이고 사람 `nextAction`이 존재할 때, 함수 `legalCheck`에 상태·조치를 보존하지만 `questions=[]`. 예상 인간 역질문/서류요청 연계가 `questions`에 나타나지 않음. 법률 `fail`도 `legalCheck`에 보존, 자동 승인 아님. **이는 별도 법률업무 채널에서 처리할 수 있으므로 실제 기능 결함 확정/법률상 의무로 승격하지 않음**.
- 상담→서류요구 생성→직원 질문 저장/알림→고객안내→OCR/Fact 복귀의 DB/API/E2E 미관찰. 권한·법령상 인정·원문 확인도 미검증. [ ] 유지.

## A1-CALC-013 [ ] — 총액·채권자·지급월·법률상 보류

- `lib/plan-reconciliation.ts` blob **`1c895fd2fd8a133368315532ed2ab9984d64b2e3`**의 실제 `reconcilePlanLedger` 본문과 `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980` 계약 확인. `moneyValue`는 합성 `amountWon` 정수 변환기로 대체.
- 1회차 최소 단위 **11조건 중 5기대일치**: 정상 100원 합계/0원·null의 분리/blocked 원장/음수 금액 차단 등은 일치. **6반례**: 없는 채권 ID, 일반채권 `fundingSourceId` 불일치, 0원 회생위원 보수 중복, `paymentDate=null`, `ledger.status=provisional`, 명시적 우선채권 정책 없는 사례에서 각각 `status=reconciled`로 반환(마지막은 `priorityCoverage.status=covered`까지). 1회차 합성은 **법원에서 허용되는 계획기간이 아님**; 해당 경계 함수의 국소 특성만 확인.
- 더 현실적인 **36/48/60회 합성 6조건 중 3기대일치**. 36회×100원=3,600원/48회=4,800원/60회=6,000원의 기계적 합산 정상. 그러나 36회 중 19~36회 지급일 null, 36회 원장 `provisional`, 3회차 채권 ID 없음 각각 `issues=[]/reconciled` 오반환. **법정 지급기간 적합성이나 원화 실제 변제금 승인 결과는 아님**.
- 전체 **17조건 중 8기대일치**. 총액 산술은 선택한 정상입력에서 맞지만 법률승인/현가/청산가치까지 자동 판단하지 못함. 기존 Draft [#80](https://github.com/firmengine/firmengine/pull/80) 채권·보수·출처, Draft [#237](https://github.com/firmengine/firmengine/pull/237) 기간·총액 보류, [#239](https://github.com/firmengine/firmengine/pull/239) provisional 보류 **모두 open/draft**. #239는 main이 아니라 **#237 위에 stacked PR**이고, 이 회차 수정 후보/통합 PR 실행하지 않았음. 서로 다른 패치의 단계별 합성 결과를 main 인수라고 표현 금지. 현가/청산가치·실제 채권별 분배·D1·D5110/11 서식/변호사 승인 미검증.

## 실행 요약·후속

| ID | 실제 독립 합성 기대 일치 | 인수 |
|---|---:|---|
| A1-IT-013 | 5/7 | [ ] |
| A1-AX-013 | 8/10 (2건은 사람 질문 연계 정책후보, 결함 미확정) | [ ] |
| A1-CALC-013 | 8/17 (1회차 국소 5/11, 36/48/60 합성 3/6) | [ ] |
| **합계** | **21/34** | **종단 인수 0** |

- **코드 조치:** 제품 코드·기존 PR·운영 환경 변경 없음. 동일 파일의 기존 Draft PR들이 open 상태여서 중복 수정/경합을 피하고 실제 재현 입력·독립 기대·관찰을 영수증에 남김. 보드 세 ID만 추가 기록하며, 새 합성테스트 파일을 커밋한 것은 아님.
- 반례 조건 간 원인 중복이 있으므로 13개의 불일치 조건을 독립 제품 결함 13건으로 세지 않음. 원문/Fact 미관찰, null, 명시적 0, 상충, source-only, 미승인, 비해당는 자동 채택하지 않았음.
- 실행하지 않은 전체 Node·CI, staging D1/R2/Cron, 실제 화면/서식, 변호사/법원 승인, 운영 배포·운영 DB 마이그레이션·전자제출·인가 확정은 모두 **미검증/미실행**.
- 다음 순환 **사용자·서류담당자 → 변호사 → 데이터담당자**, 최신 보드 우선 **A1-DOC-014 / A1-LAW-016 / A1-DATA-014**.
