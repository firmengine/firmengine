# FirmEngine — 사업소득 월별 증빙·계산 3차 디버깅 (2026-10-30)

## 실제 반영한 기능

- lib/business-source-evidence.ts: 금액·기간·원문행·출처를 보존. 동일 원문행에서 시작/종료일이 중복 또는 불일치하거나 검증되지 않았다면 임의의 과거기간으로 분류하지 않는다. verifiedAndAcceptedSource에는 현재 사실의 출처 검증을 요구한다.
- lib/business-monthly-workbench.ts: 대표기간 최대 60개월을 월별 슬롯으로 전개한다. 총매출, 세액/환불, 경비 개별행, 경비 총계, 현금수취, 원천징수 등을 별도 항목으로 조회한다. 12개월 중 빠진 달, 매출총계 중복, 비용 총계+개별행 중복, 같은 원문행의 복수 경비, 기간 불명, 미검증 금액을 표시한다.
- lib/case-schema-services.ts: GET /api/cases/{id}/data?view=business_monthly_workbench 조회 추가. 이전 view=business_source_audit도 유지한다.
- 계산 엔진은 원문 증빙 차액을 법률상 인정 순소득으로 자동 승격시키지 않는다. 법률상 수입·경비·VAT 처리·사업자 동일성은 별도 담당자/변호사 검토가 필요하다.

## 월별 산술 미리보기의 의미

**2026-10-30 이후 정정:** 서로 다른 VAT 증빙과 경비 원문이 같은 달이라도 **사업자 동일성의 검토 연결이 없으면 금액을 빼지 않는다**. 각각 sourceGrossWon=3000000, sumRawCostLinesWon=1500000으로 원문 수치를 표시하되 arithmeticDifferenceWon=null로 남기고 BUSINESS_IDENTITY_NOT_CROSSWALKED를 표시한다. 단일 원문 행 안에서 매출과 비용이 동시에 검증된 경우에만 원문 숫자의 임시 산술을 허용한다. 이조차 legalNetApproved=false이며 IncomeSource.net이나 D5103·D5110 공식 서식에 자동 입력하지 않는다.

## 검증 결과

- tests/business-period-integrity.test.ts: 중복 기간, 승인되지 않은 과거기간, 원문 미연결 계산 우회 등에 대한 회귀 4건 추가.
- tests/business-monthly-workbench.test.ts: 12개월/11개월 누락, 매출총계 중복, 경비 다중행, 부분월, 연간 자료, VAT와 현금수취 혼동 등 10건 추가.
- tests/business-monthly-case-integration.test.ts: CaseData 기반 12개월·11개월·중복 총매출 3건 추가.
- GitHub 현재 코드에서 함수 본문을 직접 추출한 격리 V8 검증 15/15 일치(월별 조립 10건, 원문 기간 단일성 5건).
- Node/TypeScript 전체 빌드, 신규 테스트 파일들의 실제 Node 통합 실행, 실 D1 및 전자소송 서식 대조는 수행하지 못했다. 테스트 파일 생성과 Node 통과는 다르다.

## 남은 필수 인수

1. source business_entity, 사업자등록번호, 실제 지급자, 원문 거래 식별자를 승인된 관계로 매핑한다. 이름만 일치하면 동일사업자로 확정하지 않는다.
2. 월별 매출, 취소·환급, 부가세, 필요경비, 거래내역, 현금수취의 중복·차이·법적 인정 근거를 승인 가능한 기준정보 계약으로 연결한다.
3. 담당자 검토 영수증은 정확한 fact ID·버전·문서 SHA-256·기간·사업자·기준정보 판본에 묶고 변경 시 무효화한다.
4. 검토·승인된 12개월 소득원만 결정론적 계산기에 넣고 D5103·D5110의 정확한 월별 표·합계와 일치하는지 실제 E2E를 수행한다.
5. 전국 법원 서식·실무준칙 적용과 법률상 인정은 공식 원문·담당 변호사 검토로 별도 입증한다.

이 문서가 기록하는 검증은 법원 인가 또는 실서비스 배포 증명이 아니다.

## 4차 피처 스키마·저장양식 충돌 점검

- 현재 원본 기준 고유 canonical 피처 **693**, 사업소득 금액 소비후보 **11개**, 기간 start/end **6개**의 ID가 실제 스키마 색인에 모두 존재하는지 정적 대조했다: **17/17 일치**. 계산 18모듈의 선언 입력 **91개**는 전체 법률산식 적용완료를 뜻하지 않는다.
- **발견·수정한 의미 충돌 1:** `business_costs_and_ledgers::income.business_cost.tax_component`는 비용측 **매입세액(input_vat)** 이며 매출측 `vat_collected` 와 구분해야 한다. `business-source-evidence.ts`와 월별 조회에서 별도 역할로 변경.
- **발견·수정한 의미 충돌 2:** `business_current_income_summary::income.self_employment.net_receipt`의 실제 피처 시간 유형은 **event_date** 이다. 기존 코드가 service_period_start/end로 입금 시점을 대신 추정할 수 있던 부분을 제거. 별도 원문 거래일 없으면 해당 수취액은 월별 배분하지 않는다.
- **발견·수정한 소득·서식 오류:** 현재 소득계산이 차단됐어도 `form-mapping.ts`의 `monthly_business_income` 토큰이 일부 원문 집계 평균이나 0원을 표시할 수 있어, `calculation.monthlyIncomeWon === null`이면 해당 토큰도 확인 필요 상태로 차단.
- **발견·수정한 연결 오류:** 기존 `noCurrentBusinessIncomeCandidate` 검사는 다른 사업소득 1개가 존재하면 별도 미연결 사업비용 피처를 무시할 수 있었다. 이제 현재 해당 피처를 인정된 소득원 factIds와 연결하지 못한 건수를 `unreconciledCurrentSourceFacts`로 별도 추적하고 집계 확정을 막는다.
- **발견·수정한 계산 위험:** 검증된 VAT 매출과 별개 경비 두 원문행이 같은 달에 있더라도, 이름/날짜 일치만으로 같은 사업체라는 증명이 없다. 사업자 일치 승인 전 두 서류의 수치를 빼지 않는다. 검토용 개별 총액만 표시한다.
- **원문 사업자 식별 대조 기능:** `business-identity-crosswalk.ts` 및 API `view=business_identity_crosswalk`. 사업자등록번호·사업체명·원문 매출/경비 행을 따로 보여주며 **자동 동일사업자 확정은 없음**. 마스킹된 사업자등록번호는 유효 식별 근거가 아니다.

물리 저장 형식은 기존 `cases.payload` JSON의 `facts[]`, `incomes[]`, 그리고 `extraction_records` → `extracted_features`로 유지한다. 이번 단계는 읽기 전용 감사·차단 및 서식 표시 수정이며 **D1 테이블/마이그레이션을 추가하지 않았다**. `tests/business-feature-schema-storage.test.ts`에서 두 경비 원문행과 6개 물리 필드 및 FK 검증을 작성했지만 Node 실행은 미완료이다.

새 테스트: `business-feature-schema-storage.test.ts`(2), `business-form-income-gate.test.ts`(3), `business-unreconciled-income-coverage.test.ts`(4), `business-identity-crosswalk.test.ts`(4), `business-source-temporal-tax-semantics.test.ts`(2). 기존 월별 테스트도 신분 확인 전 차액 미확정으로 기대값을 수정했다.

현 최신 월별 조립 함수 본문만 추출한 **격리 V8 10/10 일치**(변경 후 재검증). GitHub에서 전체 Node/TypeScript 빌드·DB 운영 검증·실제 법원 서식 E2E는 실행하지 못했으므로 완전 통합 통과로 기재하지 않는다.

남은 필수 작업은 **검증된 동일사업자 관계의 담당자 승인 영수증을 저장하고, 각 경비의 법률상 인정·VAT 처리 기준을 적용해 결론 수치를 계산엔진에 전달한 뒤 실제 제출 양식과 E2E 대조**하는 것이다. 이 과정 없이 임의로 재무 피처 ID를 typed 순소득에 직결해서는 안 된다.
