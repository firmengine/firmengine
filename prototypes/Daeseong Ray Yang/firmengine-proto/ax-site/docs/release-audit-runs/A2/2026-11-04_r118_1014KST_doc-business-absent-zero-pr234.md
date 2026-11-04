# A2 r118 — 사용자·서류담당자: D5103 미관찰 사업소득 0원 오표시

작성일 2026-11-04 KST. 작업 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 시작 GitHub main HEAD `fb6023ba284f1193a3bd00c15e3dfb0448fe786b`, 기록 직전 HEAD `fb6023ba284f1193a3bd00c15e3dfb0448fe786b`. 117차 IT→**118차 사용자·서류**→119차 계산사무장. 인수 ID: `A2-DOC-004`, `A2-DOC-015`, `A2-DOC-016`, `A2-DOC-018` (모두 [ ] 유지).

## 실제 읽은 문서·스키마·코드·이력
- 단일 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, r117 및 r112 A2 영수증, 최근 main 커밋, 미병합 #233과 서식 #227/#229/#141/#166, main `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; `lib/office-writer.ts` blob `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`; `lib/document-annexes.ts` blob `9041330c95858390647d355cc3d1cbdbcab76b47`.
- SQL schema `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`, store `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`. 정적 기준 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`와 `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`.

## 재현: 소득 Fact 없음이 관측 금액 0원으로 서식 승격
main `buildFormBindings`의 실제 `scalars.monthly_business_income` 계산식은 `(business.length>0||!data.incomes.some(s=>s.kind==="business"))` 조건 아래, business 0개면 `reduce(...,0n)`를 실행하여 `"0"`을 만든다. D5103에 존재하는 `monthly_business_income` 토큰의 **사업소득 source 부재**가 명시적 관측 `0원`으로 표시되는 기술적 반례. 다른 소득원이 존재해도 마찬가지.

원본 GitHub **식만을 분리한 V8 격리 시험** (아래는 synthetic, `amount`는 단위를 변경하지 않는 래핑): main 6/8 vs 보수적 가드 8/8 기대일치. Draft #234 커밋 blob `216ea2f889d146b1762be65b097da2f896e826dc` 재조회 후 V8 **10/10 독립 기대일치**, 예외 0. 프로젝트 Node/TS 러너·전체 CI는 **미실행**.

| SYN 조건 | 독립 기술 기대 | main 실제 | #234 실제 |
|---|---|---|---|
| 급여만 2,000,000원/월, 사업 source·group 없음, income inventory=yes | 수치 보류(실측 0 아님) | **`0`** | `[확인 필요]` |
| 수입자료 0건, 월 전체소득 문자열 `0`, 사업 group 없음, inventory=yes | 수치 보류 | **`0`** | `[확인 필요]` |
| 사업소득 group 1건, 명시적 관측 `0` | `0` 유지 | `0` | `0` |
| 사업소득 1,500,000원 관측 | 1,500,000 | 1,500,000 | 1,500,000 |
| 사업 2원천 1,000,000+2,000,000원 관측 | 3,000,000 | 3,000,000 | 3,000,000 |
| business source는 있으나 group 누락 | 수치 보류 | 보류 | 보류 |
| group이 null, 전체 월소득 null, inventory 미완료 | 수치 보류 | 보류 | 보류 |

추가 재생: 급여만·inventory 미인증, 합계 월소득 null 등 총 **10** 조건. Draft는 **사업 group이 실제 1개 이상일 때만** 수치로 표현; 없음은 `[확인 필요]`로 보류. **`[확인 필요]`는 법률상 비해당이 아니며 비사업자의 합법적 서식 출력 규칙을 확정한 것이 아님.** Salary-only 사건의 final 서식 필수여부를 담당자·변호사에게 검토받기 전 main에 병합 금지.

## 원문·Fact·typed·SQL feature 독립 모형
합성 원천 경로 개념: SYN salary source→`SYN-FACT-SALARY`→typed income 2,000,000원/월→calculation `incomeGroups=[]`, `monthlyIncomeWon="2000000"`→D5103 business token. **코드상 진짜 원문 OCR 추출/Fact 생산/API 적재 실행은 하지 않았음**.
Migration 0011 원문 DDL 동형을 Python sqlite3 인메모리에서 실행, 가짜 cases/run FK 추가: `monthlyIncomeWon` 저장 `value_json="\"2000000\""`, `value_won="2000000"`; `incomeGroups` empty `value_json="[]"`, `value_won=NULL`; synthetic 명시 0 `value_json="\"0\""`, `value_won="0"`; 합성 미관찰 `value_json="null"`, `value_won=NULL`; 출력 자체 absent→0행. **5종 재독 관찰과 foreign_key_check 공백**, 실제 제품 저장 함수/D1·typed 왕복은 미실행. Synthetic test-only output names는 실제 42개 등록 계약이 아님.
`source-only`/`unknown`/`null`/`0`/`not_applicable`/`conflict`/`approved`를 자동 동의어로 처리 금지.

## 실제 변경 / 충돌 관리
[Draft PR #234](https://github.com/firmengine/firmengine/pull/234) branch `audit/a2-r118-doc-business-zero-source-only-20261104`, head `dac4a1a06b0d9770681ce2ede36bef9593b76bde`. 허용 경로 2파일: `lib/form-mapping.ts` 1조건 수정 및 `tests/a2-r118-form-business-absent-zero.test.ts` 합성 Node 회귀 **작성만**. 전체 repository Node 시험·형검증·공식 D5103 Word 생성/재독/필수토큰 판단 미실행. 기존 #233, #227, #229, #141 등의 Draft 미병합·중복 경로 충돌 미해결. main 제품 코드는 변경하지 않음.

## 정적 계약
실제 JSON 파싱: 18 calculation modules, 91 input declarations(78 unique), 42 output declarations(40 unique), 42 result paths. 실제 토큰 카탈로그: D5103 **37**, D5106 **48**, D5110 **55**, D5111 **82**. `monthly_business_income` 등록 서식은 **D5103**. 이는 계산/저장/실제 문서 재독 통과가 아닌 정적 계약 점검만.

## 2026-11-04 공식 원문 확인(법률·세무 승인 아님)
- [서울회생법원 보도자료 2026-10-01](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 **제424호 제2조 제2항 제7호 신설** 공지 확인. 최신 개정전문 PDF **부칙 직접 재독 못함**; 최초 접수일/관할증빙 자동 결정 금지.
- [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): 법률 제21490호, **시행 2026-10-02**, 실제 조문 원문 확인. 기간·청산가치·인가요건 ≠ 합성 계산/기술 후보.
- [국세청 VAT 개요](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272): 일반과세자 6개월·간이과세자 원칙 1년 확인. 신고매출/종소세 자료를 인정 월순소득으로 자동 승격 금지.

## ID별 결과 / 다음
- `A2-DOC-004` [ ]: 급여만/사업소득0/null·사업그룹 누락 D5103 표시 반례·Draft 방어, 소득세·부가세 등 종단 미검증.
- `A2-DOC-015` [ ]: null/NA/원문부재인 D5103 기업소득 보류와 final 승인 게이트 실제 연결 미검증.
- `A2-DOC-016` [ ]: 명시적 관측 0과 아예 없는 business group을 분리했지만 `[확인 필요]` vs 실제 `[해당 없음]` 표준 미확정.
- `A2-DOC-018` [ ]: D5103 실제 DOCX 생성/원문 숫자 및 D5106·D5110·D5111 Word 바이트 대조 0건.

다음 **r119 계산사무장**: #234 서식 표시와 결산 소득·VAT·종소세 중복을 독립 검산; #233 actual Node 프로젝트 시험, #43/#223/#229 원장 blocked→가짜 0원과 #225/#226/#230 최초 접수증 미연결을 이어서 검증. 전체 CI/staging D1·R2/Cron/실 Word/공식 양식·변호사 승인/운영 배포/전자제출/법원 인가 **전부 미실행·미인증**, 이번 완전 인수 0건.
