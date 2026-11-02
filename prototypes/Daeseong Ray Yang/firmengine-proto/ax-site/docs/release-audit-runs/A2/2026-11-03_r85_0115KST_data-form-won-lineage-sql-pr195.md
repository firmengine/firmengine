# FirmEngine A2 r85 — 데이터담당자: D5103 금액-계산 피처 오연결 및 SQL 계보 감사
작성: 2026-11-03 KST. 전회 r84 변호사 → 이번 r85 데이터담당자 → 다음 r86 AX담당자.
**모든 입력은 합성(SYN). 고객/개인정보/OCR 원문/키/인정 정답 미포함. 운영 변경 없음.**
A2 체크: **A2-DATA-017 / 018 / 020 / 024**, 전부 부분검증 **[ ]**, 제품 인수 완료 **0건**.

## 1. 조회·범위·전회 연계
- 최초 관찰 main HEAD: `56363787c202b0395c4949f4ff8600f99dbcb001`; 영수증 작성 직전 HEAD: `56363787c202b0395c4949f4ff8600f99dbcb001`. scope: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만.
- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 전회 [r84](2026-11-03_r84_0023KST_law-tax-priority-coverage-pr194.md), 미병합 Draft [#194](https://github.com/firmengine/firmengine/pull/194) (세금채권 검토), #192, #188, #190 및 동경로 [#100](https://github.com/firmengine/firmengine/pull/100)을 대조. #194 code HEAD `14752a28f63e22805bbb35321cf873f52878e960`, 변경파일 3개 확인. 법률 분류는 건드리지 않음.
- 실제 main `lib/lawgraph-document-field-projection.ts` blob `a017294aa814f4d33360c2531abf91d9eb79a6e0`; `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`; 실제 기존 `tests/lawgraph-document-field-projection.test.ts` 및 #194 synthetic node test 본문 재독.
- Reference `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 modules / inputs 91 (unique 78) / outputs 42 (unique 40)**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5110 **55**, D5111 **82** token registration. 정적 파싱만; 18모듈 전체 실행/91 typed 포인터/42 SQL output_path/DOCX ZIP 실제 검증 아님.

## 2. 신규 P1 후보: D5103 잘못된 표시금액이 원천 계산 피처로 오연결
- main `projectLawgraphDocumentFields`의 `sourceNumeric`가 `replace(/[ ,\\s₩원]/g,"")`와 동등한 방식으로 쉼표·공백·원 기호를 **위치 무관하게 제거**. `sameValue`가 이를 사용하여 계산 feature의 `value`와 서식 `monthly_income` 문자열을 비교하고, 일치 오판 시 `linked_calculation`, `calcFeatureRefs`, `sourceFactIds`를 부여한다.
- 사전 독립 기대: 잘못된 천단위 `1,00`은 저장값 `100`의 근거가 될 수 없음. `1원2` vs `12`, `0 0` vs `00`, `12₩34` vs `1234`, `1,234,56` vs `123456`도 **not linked**. 정상 `1,000원`↔`1000`, `0원`↔`0`, `₩ 1,000원`↔`1000`은 기술적 숫자 동치.
- main의 실제 TypeScript 함수 본문 중 타입 선언만 제거한 V8 격리 실행: 합성 D5103 `monthly_income=1,00`, 계산 `monthlyIncomeWon=100`, `sourceFactIds=["SYN-FACT-1"]` → **기존 `linked_calculation` / `calcFeatureRefs=["SYN:feature"]` (오판)**; `1원2`도 동일. 정상 0/1,000원 연결은 유지. 부분 V8 projector **6/6 사전 독립 기대 비교**(기존 vs 후보), strict parser 매트릭스 **14/14 후보 일치**.
- 별도 [Draft #195](https://github.com/firmengine/firmengine/pull/195)에서 `sourceNumeric`을 정규형 원화 파서로 바꾸고 **금액 계산/원천 피처 연결에서만** `sameNumericValue` 사용. 이름/텍스트 필드 및 수치/법률 인정·계산 결과 자체는 변경하지 않음. `tests/a2-r85-data-form-numeric-lineage.test.ts`: **12 × 36/48/60개월 = 36 Node 테스트 + TODO 3 작성·커밋**, 프로젝트 Node 러너 **미실행**, 전체 CI **미실행**.
- **주의:** 기존 미병합 [Draft #100](https://github.com/firmengine/firmengine/pull/100)도 같은 프로젝션 파일을 수정하므로 충돌·회귀 병합 검토 필요. `linked_calculation`은 원천 Fact 소유/현재 인정·생산 판본의 증명이나 법원 승인과 동의어가 아님. 미관찰/승인전 원문 표시는 금액 근거로 사용하지 않음.

## 3. SQL 0011 동형 구조 합성 저장/재조회 (실제 Cloudflare D1 아님)
- sqlite3 in-memory, `PRAGMA foreign_keys=ON`, `cases` 최소 FK 부모 + **0011 계산 runs/features/heads 테이블 DDL 동일** 재구성. 입력 `SYN-CASE/SYN-RUN`, `status=provisional`, `value_json`, `value_won`, `source_fact_ids_json` 사용.
- **8/8행 저장·재조회, FK 위반 0**: 정상 `["SYN-FACT-1"]`, **빈 `[]`**, 존재하지 않는 `["SYN-FOREIGN"]`, **중복 `["SYN-FACT-1","SYN-FACT-1"]`**, **문법 오류 `{`**, `value_json="0" / value_won="100"` 상충, `value_json="0" / value_won="0"` 명시적 0, `value_json=null / value_won=NULL` 미관찰.
- 실제 `listCaseCalculationFeatures`는 `JSON.parse(f.source_fact_ids_json)`를 사용하고, `buildStoredLawgraphDocumentFields`도 같은 컬럼을 `JSON.parse`한다. SQL `NOT NULL`은 JSON 구문·배열 타입·Fact 존재/동일 사건/인정 상태를 보증하지 않음. 위 malformed 샘플은 **저장 성공**하나 애플리케이션 읽기 parse 예외 가능. 원천 사실의 소유관계와 계산 revision·reference SHA 검증은 **미완료**, 후속 보류.
- 원문/Fact/typed SQL의 **현장 고객 원본은 절대로 사용하지 않음**. 합성 Raw `SYN DOC: 1,00원` → Fact `SYN-FACT-X, value=1,00, recognition=unreviewed` → typed `unknown`(임의 100원 환산 불가) → SQL `missing/provisional` 및 Form `[확인 필요]`가 독립 데이터 기대, 실제 종단 저장/Word 미실행.
- 보조 독립 정수 산술 예시: 급여 **12×2,400,000=28,800,000원**; 사업 관측 **11×1,000,000=11,000,000원**; 합 **39,800,000원**은 단순 관측 소득 합(인정금액 아님). 사업 12번째 미래 월은 `null` 유지. 변제 예시 500원×36/48/60 = **18,000/24,000/30,000원**, 법원 허용 기간·총액 승인과 별개.

## 4. 공식 법원/법률/국세청 원문 (2026-11-03 조회)
- 서울회생법원 **2026-10-01 공지** `https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187` : **실무준칙 제424호 제2조 제2항 제7호 신설**. **공지일 ≠ 사건별 적용일**, 첨부 PDF 부칙·경과조치/관할/신청일 별도 미인증. 무승인 적용 금지.
- 법제처 **2026-10-02 시행 법률 제21490호** 제611조 `https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR`, 제614조 `https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759`. 변제기간 원칙 3년, 예외 요건의 5년 상한, 청산가치·공정성·수행가능성은 변호사 판단 전 **법률 미인증**.
- 국세청 공식 부가세 `https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574`: 일반과세 6개월/간이과세 통상 1년. VAT/종소세 신고액을 월 인정소득으로 자동 합산/중복인정 금지.

## 5. 수정/배포/다음
- Draft #195의 **2개 파일은 ax-site 아래**; main에는 보드 및 본 영수증 외 제품 코드 수정 없음. 이전 #194 세금·우선채권 분류 변화나 611/614 적용 변경과 **독립**.
- 테스트 계층 구분: **원본문 타입제거 V8 격리 6/6, strict numeric 14/14; SQL 0011 동형 SQLite 8/8**. 반면 Node 원본 테스트 0, 전체 CI 0, staging D1/R2/Cron 0, 18모듈/42출력+Word 바이트 종단 0, 정식법원서식/법률실무 승인 0. 제품 RELEASE_READY **0건**.
- **r86 AX담당자**: Draft #195 vs #100 프로젝션 충돌 검토·실제 Node 러너, #194 세금 원장 Fact 소유/producer/revision, `source_fact_ids_json` 유효성·소유·중복·JSON parse fail-closed 가드, D5103/D5110/D5111 반복행 DOCX 실제 재독. 원금·이자·세금 법률 분류/424 제7호 사건 적용은 변호사·계산사무장 승인전 미인증.
