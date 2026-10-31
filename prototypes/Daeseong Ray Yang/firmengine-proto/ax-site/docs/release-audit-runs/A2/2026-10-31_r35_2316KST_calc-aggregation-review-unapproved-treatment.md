# FirmEngine A2 r35 — 계산사무장: 소득 합산분류 미승인 수치의 사건 월소득 승격

- 기록: **2026-10-31 23:16 KST** 시작, 이전 r34 사용자·서류담당자 다음 **r35 계산사무장**, 다음 r36 **변호사**. 변경 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 단일 인수 기록.
- 최초 확인 main SHA `fc0d302bf03fefbf6891b01d1a03a27091bf8a79` (r34 이후 A1/A3/A4 타 에이전트 커밋 유입). 제품 수정 분기 기준 SHA도 동일. 실제 main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, `lib/document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`, `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`.
- 보드 체크 **A2-CALC-006, A2-CALC-016, A2-CALC-017, A2-CALC-018** 네 ID만 일부 점검, 인수 상태 모두 **[ ] 미완료**. 소득 합산분류 버그는 특히 017/018 관련. 016의 11/12개월 결손·부분월, 006의 VAT/종소세 중복은 이전 영수증/실제 코드·세무 출처를 재독했으나 이번 회차 새 종단검증을 수행하지 않음.

## 1. 실제 파일·계약·선행 결함 재독
- 이전 [r34 감사](2026-10-31_r34_2224KST_doc-integrated-d5103-approval-coverage.md)는 #58+#81 통합 [Draft PR #93](https://github.com/firmengine/firmengine/pull/93)의 D5103 월별 증빙·미승인 월소득 V8 **12/14 기대 일치** 및 첫/끝월 2건 미해결을 보고. 전체 Node·DOCX는 미실행.
- 현재 main `assessment.ts`의 `aggregateIncomeObservations`는 명시적 비-unknown 소득 합산분류 `aggregationTreatment`에 `aggregationReviewed!==true` 혹은 빈 `aggregationReviewReason`인 경우 전역 `issues`에는 `INCOME_AGGREGATION_REVIEW_REQUIRED`를 기록하지만, 그룹의 계산 불가 사유 `nonComputable`에 포함하지 않아 숫자 집계가 가능한 결함. 별도 `form-mapping.ts` `approved_monthly_income` 바인딩은 사건 월소득·관측행 승인 등만 검사하므로 **위 집계 이상이 후속 서식에 전달될 위험**이 있다. 이번 회차에서 실제 DOCX까지 잘못 최종화되었음은 증명하지 않음.
- `domain.ts` 원문→Fact→typed `IncomeSource` 필드 `factIds`, `net`, `periodStart/End`, `amountBasis`, `payerIdentityId`, `aggregationTreatment`, `aggregationReviewed`, `aggregationReviewReason`, `recognition` 재확인. 기존 `tests/calculation-audit.test.ts`, `tests/income-resolution.test.ts`, `tests/business-income-source-integrity.test.ts`, `tests/calculation-18-output-golden.test.ts`, `tests/form-month-calculation-integrity.test.ts` 검토.
- SQL `drizzle/0011_case_calculation_features.sql`에서 `case_calculation_runs`의 버전·SHA와 `features`의 `value_json TEXT NOT NULL`, nullable `value_won`, `status`, `output_path`, `case_calculation_heads`의 별도 저장 컬럼 재확인. **이번 회차 SQL INSERT/재조회 실험 미실행**, 실제 D1 호출 없음.

## 2. 합성 입력 — 실제 자료 아님
원문 가상 급여증빙 `SYN-WAGE-2026-YEAR` → 가상 Fact `fact-W1` (`state=verified`, `recognition=accepted`, `value=28800000`, `numeric.amountWon=28800000`, `period=2026-01-01..12-31`) → typed `IncomeSource{id:"W1",kind:"wage",payerIdentityId:"payerW1",net.amountWon:"28800000",amountBasis:"period_total",periodMonths:12,periodStart:"2026-01-01",periodEnd:"2026-12-31",aggregationTreatment:"independent_source",aggregationReviewed:false,aggregationReviewReason:""}` → 함수 `aggregateIncomeObservations` 입력 `value=2400000n`, `span=12 complete months` → group/monthly case income 진단. 둘째 가상 급여소득원은 `payerW2`, 연간 12,000,000원/월 1,000,000원. **원문 문서/OCR/Fact 추출 API는 실제 실행하지 않았고 본 필드 관계는 합성 구조 모사**.
독립 정수 산술: 연간 28,800,000÷12=2,400,000원; 둘째 연간 12,000,000÷12=1,000,000원; 완전히 독립·검토완료인 경우 월 합계 3,400,000원. 명시적 0원은 숫자 0, 미관찰·미승인 집계 결과는 `null`로 구별. 이는 법률상 인정소득이 아님.

## 3. 실제 GitHub 함수 본문 V8 격리 시험
`assessment.ts`에서 `aggregateIncomeObservations` 실제 함수 본문을 읽어 TypeScript 타입 선언만 제거하고 V8 `new Function`으로 실행. `monthSpan`, `moneyValue`, `nonnegative`, `floorDivide`, `asMoney`는 합성 helper. **전체 calculateCase, 프로젝트 모듈 import, Node 테스트, CI는 실행하지 않음**.

| 가상 입력/독립 기대 월소득 | main 관찰 | Draft PR #96 변경 본문 관찰 | 기대 일치 |
|---|---|---|---|
| independent_source 명시·미승인 → null | **2,400,000** | null + 집계 미승인 사유 | 수정 후 |
| series_observation 명시·미승인 → null | **2,400,000** | null + 집계 미승인 사유 | 수정 후 |
| reviewed=true, 사유 공백 → null | **2,400,000** | null + 사유 | 수정 후 |
| independent_source 검토완료 → 2,400,000 | 2,400,000 | 2,400,000 | 양쪽 |
| unknown treatment (기존 동작 유지) → 2,400,000 관측 프리뷰 | 2,400,000 | 2,400,000 | 양쪽, 법적 승인 아님 |
| 검토완료 명시적 0 → 0 | 0 | 0 | 양쪽 |
| 서로 다른 두 검토완료 payer → 3,400,000 | 3,400,000 | 3,400,000 | 양쪽 |
| 검토완료 payer + 미승인 payer → null | **3,400,000** | null | 수정 후 |

**독립 기대 일치 main 4/8 → 수정안 8/8**. 이것은 부정 케이스의 결함까지 재현된 **V8 함수 격리** 결과이지 8개 제품 기능 인수가 아님.

## 4. 수정 PR, 충돌, 테스트 수준
- [Draft PR #96](https://github.com/firmengine/firmengine/pull/96) 분기 `audit/a2-r35-calc-treatment-review-20261031-2316` = `assessment.ts`의 해당 그룹에 `INCOME_AGGREGATION_REVIEW_REQUIRED` 사유 추가 및 `nonComputable` 집합 등록. 소득원 원본·개별 관측액은 남기고 승인전 그룹/사건 숫자를 null로 보류. `unknown` 기본 동작 및 명시적 검토완료 0원은 유지; 법적 소득 자동승인 규칙 추가 없음.
- 제품 수정 Git commit `abd637733e2765eb5576cf1f430022708d419147`, 변경 후 blob `bb6c2854e7317fbc633f356203c7509f6b3ba8ec`. 새 `tests/a2-income-aggregation-treatment-r35.test.ts` 5개 Node 합성 테스트 **작성만 함, 미실행**, commit `b6d8391ae65bf0bace06bbb9367dc3a756da69d1`.
- PR #96의 변경파일 조회로 `lib/assessment.ts` 및 `tests/a2-income-aggregation-treatment-r35.test.ts` **2개 모두 ax-site 내부** 확인, Draft·미병합. 기존 Draft #67/#79/#84가 `assessment.ts`를 수정하고, #93이 D5103 월별 서식을 수정한다. **비파괴 병합·회귀 없이 각각 병합 금지**.
- 수정은 비-unknown 집계처리에 승인조건을 강화하는 것이므로 계산 의미·법률 인정·기존 프로덕션 워크플로 영향의 실무 검토가 필요하여 main 제품 코드는 그대로 유지.

## 5. 정적 계약·법령 출처·적용일
- main `lib/reference-decision-tables.json` 재파싱: 계산 18모듈; 입력 선언 91(고유 78); 출력 선언 42(고유 40); `resultPaths` 42(고유 42). `lib/template-token-catalog.json` 재파싱: D5103 37개, D5110 55개, D5111 82개. **정적 등록 수 검사이며 91 입력→SQL→42 결과→실제 Word E2E 아님**.
- 국가법령정보센터 `채무자 회생 및 파산에 관한 법률` **법률 제21490호, 시행 2026-10-02, 제611조·제614조**. 3년 원칙/특별사정 5년 범위·법원 인가의 복수요건과 단순 내부 계산 상태는 다름. https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777
- **서울회생법원 보도자료 2026-10-01**, 실무준칙 제424호 제2조 제2항 제7호 신설: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . 첨부 전문 PDF·부칙·경과조치 및 사건별 시행·적용일 **미확인**. 2026-10-01은 공지일로만 기록, 사건별 자동규칙 변경 금지.
- 국세청 VAT 신고·과세기간 공식 안내 https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 : 일반과세자 과세기간 보통 반기, 간이과세자 통상 1년. 이 기간이 월급여/사업 순소득 또는 종합소득세 환산 금액과 동일하다고 가정하지 않음. VAT/종소세/원천징수/중복을 실제 91입력 종단에서 검증 못해 **A2-CALC-006 미완료**.

## 6. 인수 미완료와 다음 역할
- 이번 감사 **A2-CALC-006/016/017/018 모두 [ ] 부분 검증**, 제품 인수 0건.
- `source-only`, `unknown`, `null`, 명시적 `0`, `not_applicable`, `conflict`, `unapproved`를 구분, 원문 Fact를 법률 확정값으로 자동 승격하지 않음.
- 실제 프로젝트 Node 테스트, TS 타입검사, 전체 CI, staging D1/R2/Cron, 91입력/42경로 데이터 저장·재조회, 실제 D5103/D5110/D5111 DOCX, 공식 법원 서식 동등성, 변호사·계산사무장 승인 **모두 미완료**.
- 다음 r36 **변호사**: PR #96의 '단순 관측' vs '검토된 지급자별 합산분류' 법적 표시 구분 검토; #67/#79/#84/#96 `assessment.ts` 비파괴 통합, #93 첫·끝월·미래월 결손·부분월 D5103/승인 월액 최종본 전파 검증; VAT/종소세·사업소득 중복과 SQL 0/null 상태·18모듈/91입력/42결과 실제 프로젝트 회귀 확대.
- 운영 배포, 운영 D1 마이그레이션, 실제 전자제출, 법원 인가 확정 **실행하지 않음**. 개인정보/실제 고객 문서/원본 OCR 사실값/비공개 정답/키/.env 공개 Git 기록 없음.
