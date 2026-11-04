# A2 r119 — 계산사무장: 사업소득 월액·VAT/종소세 원천 분리 및 SQL 상태 독립 재검증

작업일 2026-11-04 KST. GitHub main 읽기 시작 SHA `12a5d642ec33f9b2c144a19b6c3add597949ef04`, 기록 직전 재조회 SHA `12a5d642ec33f9b2c144a19b6c3add597949ef04`. 정확한 작업 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 역할 순환 r118 사용자·서류담당자 → **r119 계산사무장** → r120 변호사. 단일 보드 ID `A2-CALC-004`, `A2-CALC-005`, `A2-CALC-006`, `A2-CALC-007` [ ] 유지.

## 확인한 GitHub 실물과 기존 인수 이력
- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, `lib/business-source-evidence.ts` blob `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`, `lib/business-net-reconciliation.ts` blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`, `lib/business-income-policy.ts` blob `dd50ed441b5569248b64b89d3d5a683de244262a`, `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`.
- 저장: `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`.
- 계약: `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- 기존 실제 테스트 `tests/business-source-evidence.test.ts`, `tests/business-income-source-integrity.test.ts` 재독, r118·r113b 감사 영수증 및 최신 커밋·PR 확인. [Draft #234](https://github.com/firmengine/firmengine/pull/234) 미병합/mergeable=false, [#233](https://github.com/firmengine/firmengine/pull/233) Draft, [#34](https://github.com/firmengine/firmengine/pull/34) 동 파일 상충 가능. 어떤 제품 수정도 main에 병합하지 않음.

## 실제 실행된 독립 함수검증 — 14/14
실제 main `monthlyIncome()` 함수본문을 GitHub에서 받아 V8 Function 실행. TypeScript 타입 구문만 제거. 이 함수가 참조하는 `moneyValue`, `nonnegative`, `monthSpan`, `floorDivide`, `referenceFormula`, `maximumCalculationMonths`는 **별도 합성 stub**; 따라서 프로젝트 Node 러너·실제 calculateCase E2E 결과가 아님.

기준 합성 typed source: `{kind:"business",sourceCalculationRole:"period_income_observation",amountBasis:"period_total",periodStart:"2026-01-01",periodEnd:"2026-01-31",periodMonths:1,gross:{amountWon:"3000000"},expenses:{amountWon:"1000000"},net:{amountWon:"2000000"}}`.
| 합성 변형 | 독립 산술·기술 기대 | 실제 관찰 |
|---|---|---|
| 정상 gross 3,000,000 − cost 1,000,000 | 월 2,000,000원 | 2,000,000 |
| net null, gross/cost 완비 | 월 2,000,000원 | 2,000,000 |
| role gross_turnover_only/VAT | 인정 소득 미산출, `INCOME_VAT_TURNOVER_NOT_NET_INCOME` | null + 해당 코드 |
| role historical_tax_comparison | **순수 산술만** 2,000,000; 채택은 상위 계산 승인필요 | 2,000,000 (isolated only) |
| net 2,100,000과 gross−cost 불일치 | null + 충돌 | null + conflict |
| 비용 미관찰 & net 미관찰 | null | null |
| 실제 gross/cost/net = 0 | **숫자 0** | 0 |
| 세 금액 전부 미관찰 | null | null |
| 1월 15일 종료 부분월 | null | null |
| 실제 1개월·선언 분모 2개월 | null | null |
| 2개월 전체 gross 6m/cost 2m/net 4m | 월 2m | 2m |
| 월 순손실 -50,000 | 검토보류 | null + negative reason |
| 미래 2026-12월 | **단일 함수에서는 산술 가능**; asOf/대표기간 차단은 상위 검사에서 별도 필요 | 2m (이 단위함수의 정상 동작, 법률 인정 아님) |
| 원문 VAT 역할의 금액 0 | 자동 소득 0 승격 금지 | null + VAT reason |

V8 호출 **14/14 독립 기댓값 일치**, 예외 0. 이 결과는 실제 Fact·typed 추출·SQL 저장·종합소득세 합산/세무 인정·D5103 Word 생성 검증이 아님.

## 실제 원천 role 구분
main `BUSINESS_SOURCE_MONEY_ROLES` 오브젝트에서 원본문을 추출해 8개 정확한 canonical field 매핑 대조 **8/8 일치**:
- VAT gross_sales→turnover_total, taxable_sales/exempt_sales→turnover_component, vat_collected→vat_collected.
- 사업비용 gross_amount→cost_line, tax_component→input_vat.
- 기간 사업비용 총계→cost_summary, 사업원천 원천징수→withheld_tax.
- `preflightBusinessNet`는 **승인된 법원/일자/출처 정책 없이는 실행 불가**(`BUSINESS_INCOME_POLICY_SEED.rules=[]`), 원천 Fact·기간·중복·명시적 비용분류 및 **별도 사람 승인**이 필요. 실제 정책 주입·사람승인은 미실행.
- 금액 3,000,000−1,000,000=2,000,000원/월, 12개월 24,000,000원, 36개월 단순곱 72,000,000원은 **독립 합성 산술**. VAT 매출세액 300,000과 매입세액 100,000은 두 번 매출/비용으로 산입하지 않는다. VAT 세무 채택·소득세 확정/법원 인정·청산가치 및 실제 변제 재원으로 자동 전환 금지.

## SQL 합성 저장/재독: 6/6
main Migration 0011의 세 테이블·인덱스 정의를 sqlite3 3.46.1 인메모리에서 동형 실행(합성 `cases` FK stub 별도). `SYN-119`/ `SYN-RUN`에 6 rows 삽입 후 원문 `value_json` / `value_won` / `status` / Fact ID 배열 재조회:
1. VAT turnover source-only: null / null / missing.
2. reviewed business preview 2m: `"2000000"` / 2000000 / provisional.
3. input-VAT source-only: null / null / missing.
4. 실제 관찰 0: `"0"` / 0 / computed.
5. 미관찰: null / null / missing.
6. **차단 계산 sentinel 0**: `"0"` / 0 / provisional — DB 스키마는 거부하지 않음. 상위 `statusOf()`가 blocked 금액의 하위 관측값을 provisional로 유지하는 정책이므로 승인 없이 허위 0으로 취급 금지. DB 자체 의미검증은 부재.

`PRAGMA foreign_key_check` = [], 존재하지 않는 run 참조 insert는 FK 오류로 거절. **SQL에 넣은 status/feature는 합성 모델값**으로 `calculationFeatureRows()` 실제 호출을 수행한 결과가 아님. 제품 D1·원문 OCR/Fact/typed 적재·DOCX 재독은 미실행.

## 식·서식 계약 및 배포 경계
실제 JSON parse: 18 modules, 91 input declarations(78 unique), 42 output declarations(40 unique), 42 resultPaths. D5103 37 tokens, D5106 48, D5110 55, D5111 82. 정적 토큰·경로만 확인; 42 출력별 실행값/실제 DOCX 바이트 재독 0건.
진행중인 #234는 급여만 있는 사건에서 business 0원 허위 승격을 보류하지만, 합법적 비사업자 사건의 `not_applicable` 표현/서식 요구를 확정하지 못함. 아직 main에 병합 금지.

## 오탐 방지·후속 리스크 (수정 보류)
main `business-source-evidence.ts` 관련 원문 `relevant` 필터는 `sourceState=explicit_none`인 Fact를 `amountWon`에 상관없이 집계에서 제외한다. 실제 필터 단위 실행에서 `explicit_none+1000`은 relevant=0, `present+1000`은 relevant=1. 이는 **일관성 문제 후보**지만 OCR/Fact 상위 의미검증을 통해 실제 SQL/서식으로 통과되는지는 미검증. [기존 #34](https://github.com/firmengine/firmengine/pull/34)가 동일 파일에 정규화·관찰상태 가드를 미병합으로 보유하므로 무리한 중복 PR/보드 통과 표시 없이 통합 검토 대상으로 남김.

## 공식 원문 2026-11-04 직접 확인 / 별도 법률인증 아님
- 서울회생법원 2026-10-01 보도자료 [제424호 제2조 제2항 제7호 신설](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 공지 확인, **개정전문 PDF 부칙 및 최초 접수일 증빙 직접 재독 미완료**, 자동 법률 rule 승인 금지.
- [국가법령정보센터 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): 법률 제21490호 **2026-10-02 시행판**의 기간/인가 요건 직접 확인. 소득 산술 ≠ 인가.
- [국세청 세무 안내](https://in.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7804&mi=2483): 일반과세자 6개월, 간이과세자 1년 과세기간, 종합소득세 연간 소득 신고 확인. 현재 월순소득을 자동 결정하는 근거가 아님.

## 보드 ID별 인수 잔여
- `A2-CALC-004` [ ]: VAT 과세·면세·간이 타입 사업자별 법적 구분 미검증; VAT 소스 역할 8종 중 관련 필드만 확인.
- `A2-CALC-005` [ ]: 공급가액/공급대가/매출세액 공식계산 분리 정적확인, 실 신고/업종·세율·이중합계 E2E 미검증.
- `A2-CALC-006` [ ]: gross_turnover_only 산입 보류 V8 확인; VAT 비용 공제·환급·종소세 연간 증빙/실무 승인 및 최종 서식 미검증.
- `A2-CALC-007` [ ]: gross−cost/net 2m, 결손/null/0·부분월 14조건 확인; 필요경비 적격성·발생월 인정·12개월 대표성·실 Fact→typed→SQL→D5103 미검증.

실제 제품 코드 변경 0, 신규/전체 Node tests 0, 전체 CI·staging D1/R2/Cron·실제 Word·법원 공식 서식 동등성·변호사 및 계산사무장 법률/회계 최종 승인·운영 배포·법원 전자제출 0. 다음 r120 **변호사 관점**에서 #234의 합법적 비사업자 NA 출력, #34의 explicit_none+금액 충돌, #225/#226/#230의 법원 최초 접수일 증빙, #43/#223/#229의 blocked→허위 0원 E2E를 우선 교차확인한다.
