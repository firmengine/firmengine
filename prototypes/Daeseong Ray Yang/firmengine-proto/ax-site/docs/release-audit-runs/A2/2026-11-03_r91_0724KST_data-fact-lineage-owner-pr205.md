# FirmEngine A2 r91 — 데이터담당자: 타 사건·미인정 Fact ID의 서식 계산근거 오승격 검증

- 감사일: 2026-11-03 KST, **r90 변호사 → r91 데이터담당자 → r92 AX담당자**.
- 범위: `firmengine/firmengine` main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 시작 및 기록 직전 확인 main HEAD: `c4b16c2224222d84d9fcb790837c079e48230626` / `c4b16c2224222d84d9fcb790837c079e48230626`. 최근 이 디렉터리 커밋: `c4b16c2` A1 보드, `95aea3c` A1 영수증, `0e56923` A4 보드, `3f86a6e` A4 영수증, `4289910` A2 r90 보드.
- 이전 r90 [영수증](2026-11-03_r90_0607KST_law-tax-priority-class-integration-hold.md), 보드, main 실제 소스/DDL/테스트 및 unmerged Draft #100/#195/#198/#199/#194/#203 재독.
- main blob: `lib/lawgraph-document-field-projection.ts` `a017294aa814f4d33360c2531abf91d9eb79a6e0`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/case-lawgraph-store.ts` `eea435bb78f804c79a213c464af54e8014a3c3a5`, `lib/debt-resolution.ts` `1e5cf8aa0e903896205010e415d71f76ec39ba2a`, `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`, projection test `63e1b89a02c0235f0106fd7eec69d1f936da2ec5`.
- 제품 수정·합성 회귀 작성은 **독립 Draft [#205](https://github.com/firmengine/firmengine/pull/205)** 미병합, branch `audit/a2-r91-data-fact-lineage-review-20261103`, commits `8eba0c9919027ed18899e320acf1e66200f09908`, `997b6ce96bb19580c0e628395d85d4f62bdbcf04`. **main 제품 코드는 미수정**.

## 1. A2-DATA-018 / A2-DATA-020 — 실제 계산 출력값과 타 사건 Fact ID가 다를 때

**실제 입력형:** D5103 `monthly_income` scalar / `calculationRows[{id,outputName:"monthlyIncomeWon",subjectId:null,rowOrdinal:null,value,status:"computed",sourceFactIds}]`; 사건 `data.facts[]`는 Fact `{id,logicalId,version,state,recognition,validation,refs}`를 가지고, `currentFacts(data)` 중 `verified && accepted && error 없음 && factSourceLineageIssues 없음`인 것만 서식의 적격 Fact이다.

**재현한 결함:** main `projectLawgraphDocumentFields`는 출력 숫자가 일치하면 `calcFeature.sourceFactIds`를 그대로 합치고 `linked_calculation/manualReviewRequired=false`로 만든다. 현재 사건 Fact가 없거나 타 사건의 동일한 금액에 대한 Fact ID, 철회·미승인 Fact ID여도 동일하다. 실제 main 테스트 `tests/lawgraph-document-field-projection.test.ts`도 `data.facts=[]`이면서 `sourceFactIds=["source-f1"]`인 계산 링크의 존재만 확인하고 승인 상태는 확인하지 않는다.

**실제 실행:** GitHub main의 `projectLawgraphDocumentFields` 함수 **본문**을 확보하고 TypeScript 타입 표기만 제거해 V8 `Function` 격리실행. `currentFacts/factSourceLineageIssues`, 서식 카탈로그, 금액비교 및 조건부 문서 요구는 명시적 **합성 mock**이며 프로젝트 Node 테스트나 실제 문서 출력이 아니다. 독립 기대상 반례 12개에서 기존 잘못된 `linked_calculation` 8건 및 숫자형 source IDs 1건 예외를 관찰. 후보는 **12/12 기대 판정 일치**. 후보 변경은 출력금액과 `calcFeatureRefs`를 수정하지 않고, 수치가 일치해도 원천 Fact가 현재 사건의 적격 Fact 집합에 없는 경우 서식 `lineage_review_required/manualReviewRequired=true`로만 내린다.

| 합성 조건 (모든 ID SYN-*) | 기대 상태 | main 관찰 | #205 후보 격리 관찰 |
|---|---|---|---|
| 같은 사건의 적격 mock Fact F1 존재, 표시 `1,000원`, 값 `1000` | technical linked (법원 승인 아님) | linked_calculation | linked_calculation |
| Fact F1이 현재 사건에 없고 타 사건 ID만 기록 | lineage_review_required | **linked_calculation** | lineage_review_required |
| 존재하지 않는 ID | lineage_review_required | **linked_calculation** | lineage_review_required |
| 철회된 ID | lineage_review_required | **linked_calculation** | lineage_review_required |
| 미승인 ID | lineage_review_required | **linked_calculation** | lineage_review_required |
| 유효 F1 + 외부 ID 혼합 | lineage_review_required | **linked_calculation** | lineage_review_required |
| 문자열을 배열로 가장 | lineage_review_required | **linked_calculation** | lineage_review_required |
| 숫자를 배열로 가장 | lineage_review_required | **TypeError** | lineage_review_required |
| 문자+숫자 혼합 배열 | lineage_review_required | **linked_calculation** | lineage_review_required |
| 명시적 `0원`, 적격 mock F1, 계산 0 | technical linked / 0 유지 | linked_calculation | linked_calculation |
| 서식 scalar `null`, 계산 0 | missing_value / 0 아님 | missing_value | missing_value |
| 계산 sourceFactIds `[]` (실제 근거 불명) | 기술적 상태만 관찰, 법적 승인 **미확정** | linked_calculation | linked_calculation |

**미해결:** 빈 배열도 기술적 linked, 같은 사건 ID라도 금액/기간/대상자·실제 원천 판본/증빙 위조 가능. source 판본과 계산 run의 동일사건 소유·판본을 *DB 실제 조회*로 교차검증하지 않았고, 확정 법률 인정 아님. #195 금액문자열 strict 파싱, #198/#199 Fact 배열 검증과 동시 적용 필요. #100도 동일 프로젝션 파일이므로 충돌 병합 전 **HOLD**.

## 2. A2-DATA-024 — SQL 0011 실제 열 형식의 저장·재조회

- 로컬 Python 3 `sqlite3 3.46.1`: main migration 0011 runs/features/heads의 **동일 DDL 텍스트**와 인덱스를 인메모리에 적용, `cases` FK 부모만 합성 생성. `PRAGMA foreign_keys=ON`; **실제 Cloudflare D1·전체 migration·앱 API 실행 아님**.
- `SYN-CASE-A`, `SYN-CASE-B`, `SYN-RUN-A`, 계산피처 `monthlyIncomeWon`를 사용한 합성 **7 INSERT/7 SELECT** 성공, FK 위반 0건. 상세 7종: (1) 정상 `["SYN-F-A"]`, (2) 타 사건 `["SYN-F-B"]`, (3) 부재 `["SYN-NOT-EXIST"]`, (4) 중복 `["SYN-F-A","SYN-F-A"]`, (5) 값 `"0"`/원화열 `"0"`, (6) JSON `null`/원화열 SQL NULL, (7) JSON `"1000"`/원화열 `"2000"` 상충.
- **7건 모두 SQL 저장 허용**. schema는 run→case FK만 보증하며 source_fact_ids_json 값 자체에 Fact 존재/귀속 FK가 없다. SQL `INSERT` 성공은 법률/세무/원천 신뢰 통과가 아님.

## 3. A2-DATA-017 — 계산·서식 정적 계약과 독립 산술

- 현재 main 실제 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 재파싱: **18 모듈 / 입력 선언 91 (고유 78) / 출력 선언 42 (고유 40) / 결과 경로 42 (고유 42)**.
- 현재 main 실제 `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 재파싱: **D5103 37, D5110 55, D5111 82 토큰**. 이 개수는 서식 바이트 출력/금액 재독이 아니다.
- 독립 BigInt 합성 월가용소득 900,000원에 대해 36/48/60개월 총액 **32,400,000 / 43,200,000 / 54,000,000원**; 0원 × 36/48/60 = 명시적 0. 급여 2,400,000원×12개월=28,800,000원, 사업 1,000,000원×11개월=11,000,000원, 사업 12번째 달 **미관찰**이므로 보간/0원 확정 금지. 실제 18모듈 산출 엔진·42 output_path 전체·실제 D5110/11 문서재독은 **실행하지 않음**.

## 4. 공식 출처·관할·시행일 (사람 승인 전 미인증)

- 서울회생법원 [2026-10-01 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187)에서 **실무준칙 제424호 제2조 제2항 제7호 신설 공지**를 직접 열람. 첨부 PDF 부칙/경과조치/개별 사건 적용일은 **직접 검증하지 않았음**. `seoul-practice-2026`은 관할 서울회생법원, `edition_effective_date=null`, `application_review_required=true` 보존.
- 국가법령정보센터 [법 제611조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221), [제614조](https://www.law.go.kr/LSW/lsLinkProc.do?joNo=061400&lsNm=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0&mode=11), **[시행 2026-10-02] 법률 제21490호** 직접 열람. 개별 사건/법원/신청시점 적용은 별도 실무 판단 필요.
- [국세청 VAT 과세기간·종합소득세 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반 VAT 6개월, 간이 통상 1년, 종소세 연간. VAT 매출·세액과 월별 법원 인정순소득/세금채권은 자동 동일시 불가.
- `lib/legal-catalog.json` 현재 blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`의 611/614 시행판 `2026-10-02` 및 서울 준칙 적용일 null·review required 정적 확인. 법률·회계 최종 적합성 인증 아님.

## 5. GitHub 상태 / 미실행 / 다음 회차

- ID **`A2-DATA-017`, `A2-DATA-018`, `A2-DATA-020`, `A2-DATA-024`** 모두 **[ ] 부분검증**; 제품/법적 인수 **0건**. 합성 Node 회귀 `tests/lawgraph-document-field-projection.test.ts`는 Draft #205에 작성·커밋하였으나 **실제 프로젝트 Node 러너 미실행**. V8 12/12는 Node/CI의 대체 증명이 아님.
- 전체 CI, staging D1/R2/Cron, 18계산×91입력 및 42출력 전체, 실제 DOCX ZIP/XML 생성·재독, 공식 법원서식 동등성, 변호사·계산사무장 승인, 사이트 배포 **미검증**. 실제 고객문서·개인정보·OCR 정답·키/env 없음. 운영 D1 migration/운영배포/전자제출/법원 인가 **실행하지 않음**.
- **r92 AX담당자:** Draft #205와 #100/#195/#198/#199의 충돌/의미 정합성 독립평가, 적격 Fact의 실제 `currentFacts`·`factSourceLineageIssues`·SQL run 버전 소유관계, 부적격/외부/공백 sourceID와 0/null/미래월의 프로젝트 Node 시험. 이후 18/91/42 실제 산출·staging D1·DOCX 재독 및 실무자 판단을 별도 증명하고 병합 여부 결정.
