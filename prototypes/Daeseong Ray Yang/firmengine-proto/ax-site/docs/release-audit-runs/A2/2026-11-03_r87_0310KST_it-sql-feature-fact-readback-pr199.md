# FirmEngine A2 r87 — IT담당자: SQL 계산 feature API의 Fact ID 역직렬화 검증

기준 2026-11-03 03:10 KST. r86 AX → **r87 IT** → r88 사용자·서류. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`에 한정. 모든 SYN 입력은 합성으로 개인/고객/실제 OCR/비공개 정답/키 사용 없음. **점검 ID: A2-IT-015, A2-IT-019, A2-IT-020 (모두 부분 [ ], 제품 인수 0건)**.

## 1. 우선 확인한 실제 근거/판본
- 시작 시 main HEAD `f7771d80f521cbf90b878d888ca5ba763f0b3104`, 최근 커밋 `84def55b`, `5b722ac9`, 기존 A2 r86 영수증과 Draft #198/#195/#100 재조회. main은 r86/선행 Draft 변경이 아직 병합되지 않은 상태.
- main 코드 `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`, `tests/case-calculation-feature-store.test.ts` blob `844525d8633442d571ced2c48ed5bd00ba7bb5a0`, `package.json` blob `8129160e33af3ae250c757a6a8195a29674ad031`.
- r86 branch에서 사용한 재사용 디코더 `lib/calculation-form-evidence-decoder.ts` blob `02a9a27e257b199d56b6f1b5b229afe1d61504e8`. r86 form projection에서는 shape 검사하지만 **main 계산 feature listing API는 `sourceFactIds:JSON.parse(f.source_fact_ids_json)`만 실행**해 런타임 배열 보장이 없다.
- main 0011 DDL `source_fact_ids_json TEXT NOT NULL`은 문자열의 JSON shape/Fact 소유권을 보장하지 않음. 이것은 SQL 저장 자체의 위반이 아니라 **역직렬화 경계 결함**. `listCaseCalculationFeatures()`의 잘못된 shape 반환이 자동 법률 승인/Word 출력까지 통과했다는 의미는 아님.

## 2. 독립 합성 기대 vs 실제 GitHub 매퍼 본문 V8
GitHub main 및 Draft #199의 `features.map` 표현식을 직접 추출하고, r86의 실제 디코더 함수 본문(TypeScript 타입 표기만 제거)을 결합하여 13조건 실행함. **main 기술 기대 일치 6/13 → 후보 13/13**, main의 잘못된 수용 7조건을 재현; 잘못된 JSON 2건은 main에서 generic SyntaxError로 실패했으며 후보에서 코드화됨.

| SYN 저장 value_json / source_fact_ids_json | 독립 기대 | main 관찰 | #199 후보 관찰 |
|---|---|---|---|
| `0` / `["SYN-F1"]` | source ID 배열 보존 | 배열 | 배열 |
| `0` / `[]` | 0과 빈 근거 별도 보존 | 보존 | 보존 |
| `null` / `[]` | 미관찰 null, 0 아닌 값 | 보존 | 보존 |
| `"unknown"` / `[]` | unknown 보존 | 보존 | 보존 |
| `100` / `"SYN-F1"` | 차단 | **문자열 수용** | `CALCULATION_FORM_FACT_IDS_INVALID` |
| `100` / `42`, `null` | 차단 | **숫자/null 수용** | 동일 차단 |
| `100` / `["SYN-F1",42]` | 차단 | **혼합배열 수용** | 동일 차단 |
| `100` / 중복·공백/빈 ID | 차단 | **수용** | 동일 차단 |
| `100` / JSON `{`, `{` / `[]` | 코드화된 오류 | generic SyntaxError | `CALCULATION_FORM_EVIDENCE_JSON_INVALID` |

실제 GitHub 코드 격리 실행일 뿐 **Cloudflare D1/애플리케이션 API의 종단 호출 또는 Word 파일 재독 아님**. 디코더가 확인하는 것은 자료 형식이며 유효 `[]`, 정상 문자열 ID의 존재/동일 사건 소유/현재 Fact 판본/승인 여부는 확인하지 않음.

## 3. Node/SQLite 실행과 독립 산술
- 로컬 Node **v22.16.0** `node --experimental-strip-types --test`로 GitHub r86 디코더 **정확한 blob SHA(02a9...)와 일치하는 파일**을 재구성해 실행: 합성 shape 17 PASS, 0 FAIL, TODO 3.
- main `drizzle/0011_case_calculation_features.sql`의 로컬 복제 **정확한 Git blob SHA(0caa...) 일치**를 확인한 뒤 Node `node:sqlite` 인메모리에서 FK ON, 실제 0011 CREATE TABLE, INSERT/SELECT, JSON 디코딩 합성 **10 PASS / 0 FAIL**, FK 검사 0. 합계 **27 PASS / 0 FAIL / 3 TODO**. 별도 로컬 복제 시험으로 GitHub 프로젝트 전체 설치형 시험과는 구분됨.
- `tests/case-calculation-feature-store.test.ts`에 실제 `listCaseCalculationFeatures` SQL 함수 경로의 7 부적격 + 3 유효 상황 회귀를 작성했으나 **해당 프로젝트 테스트 러너로는 미실행**.
- 독립 BigInt 산술: 월 급여 2,400,000원 − 합성 생계비 1,500,000원 = 900,000원; 36·48·60개월 단순 곱은 **32,400,000 / 43,200,000 / 54,000,000원**. 실제 엔진 원천·법정생계비/승인변제기간 기준이 아니며 월 미래 미관찰값을 0으로 대체하지 않음. VAT 신고액과 종소세 신고액도 동일 매출/귀속기간의 중복 여부 확인 전 합산 금지.
- main 정적 기준정보 재파싱: `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 계산모듈 / 입력 선언 91(고유78) / 출력 42(고유40)**. `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103=37 / D5110=55 / D5111=82 토큰**. 수량은 정적 계약이며 18모듈 E2E·91입력 소비·42출력/Word 값 재독 합격이 아님.

## 4. 법률·세무 공식 원문 검증과 미승인 경계
- **서울회생법원, 2026-10-01 게시** [개인회생 변제기간 단축 대상에 관한 실무준칙 개정](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 제424호 제2조 제2항 제7호 신설 공지. *첨부 개정 PDF 본문/부칙·개별 사건 적용일은 이번에도 미인증*; 기존 법원 가이드 PDF가 개정전일 수 있음.
- **국가법령정보센터, [시행 2026-10-02], 법률 제21490호** [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 일반 3년 및 특별한 사정 시 5년 한도, 재단/일반 우선권 채권 전액 변제 사항, 수행가능·청산가치 등 심사 요건은 *법률/변호사 확인 전 자동규칙 반영 금지*. 48·60개월은 산술 스트레스 조건이지 사건 인가 확정 아님.
- **국세청** [부가세 신고안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 반기, 간이과세자 통상 연간 신고. 신고자료를 월 법원 인정순소득으로 직접 승격하지 않음.
- 본 기술 검증은 법률·세무회계 적합성·공식서식 동등성 인정 **아님**.

## 5. 실제 수정 / 충돌 관리 / 다음 담당
- 별도 **[Draft #199](https://github.com/firmengine/firmengine/pull/199)**: branch `audit/a2-r87-it-sql-feature-readback-20261103-0310`, **#198 브랜치 위에 stacked**, 코드 최종 HEAD `945c58ccbe139d670d802c4140b79f54baf2482a`. `lib/case-calculation-feature-store.ts`는 기존 `source_fact_ids_json` 무검증 `JSON.parse` 대신 #198의 shape 검증 디코더를 호출하는 작은 변경. 합성 회귀 2파일 신규 + 기존 SQL feature store 테스트 1파일 추가(총 PR 차이 4파일). **4파일 모두 ax-site 내** 확인. 현재 #198, #195, #100의 projection 관련 병합·회귀 심사 필요, 승인 전 본 PR 포함 **미병합**.
- **완료 주장 금지:** 프로젝트 full Node/전체 CI, staging D1·R2·Cron, 실제 SQL→42출력→D5103/10/11 DOCX ZIP 재독, 공식서식 등가성/변호사·계산사무장 승인은 전부 미실행/미인증. PR HEAD GitHub 상태검사·워크플로 둘 다 조회 당시 **0건**.
- **r88 사용자·서류담당자**: stacked #198+#199의 프로젝트 본 테스트 실행/충돌 확인, 원천 Fact 사건 귀속·현재 인정·계산 run SHA를 법원서식 토큰에 바인딩하고, 0/null/unknown/source-only/승인전·변제액의 실 DOCX 검증. **A2-IT-015/019/020 [ ] 유지; final 인수 0건**.
- 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정은 실행하지 않음.
