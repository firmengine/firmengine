# FirmEngine A2 r109 — 데이터담당자: 최초 접수 증빙 없는 후보 승격·SQL 금액/상태/Fact 경계

- **일시**: 2026-11-04 01:15 KST (r108 변호사 → r109 데이터담당자 → r110 AX담당자).
- **허용 범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 공개 Git에 고객/원본 OCR/PII/키/.env/비공개 답안 저장 없음.
- **감사 시작 main SHA**: `14d57273e57a449a8e8cacad8fc6be96281f07c0`; 시작 보드 blob `af9efb0ed3138af7949932490b397abcffc0de23`. 관련 실제 main: `legal-proposals.ts` blob `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`, `seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`. `domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`. 최근 main r108/A1 r108/A3 r108 및 관련 Draft #18/#217/#224, #43/#203/#222/#223 확인. r108 [변호사 영수증](2026-11-04_r108_0012KST_law-seoul424-source-factids-pr224.md), r97 데이터 영수증, r103 SQL 데이터 영수증 재독.
- **검증 단위 구분**: 실제 GitHub **main 함수본문**을 TypeScript 표면만 제거하고 V8 `new Function` 격리실행. 기준정보는 서울/2026-10-01/5천만원/2년/1년의 독립 합성 stub. 이는 실제 `buildLegalProposals` 전체 함수, Node 프로젝트 러너, CI, D1/R2/Cron, 정식 DOCX/법원 승인 **아님**. SQL은 저장소 Migration 0011의 동일 DDL을 복사해 SQLite 3.46.1 메모리에서 실행; 실제 D1 아님.

## 1. P1 위험 유지 — 입력 applicationDate와 법원 최초 접수일의 증빙 연결 누락

실제 `domain.ts`의 `createCase`는 `applicationDate=asOf`, `courtId="seoul"`을 기본 생성. 실제 `legal-proposals.ts` 122행은 `evaluateSeoul424({courtId:data.context.courtId||null,firstFilingDate:appDate||null,...})`로 전달. 이는 서버 검증된 최초 접수증의 Date/Fact/사건 owner/revision을 **전달하지 않는다**. main 평가자의 `court_scope` 및 `effective_date` 조건도 모두 `factIds:[]`. r108 #224는 제7호 네 요건의 Fact ID **형식**만 보강하며 접수일/관할 출처까지 해결하지 않음. 새 법률 인정 로직이나 임의의 하드코딩된 Fact key를 도입하지 않았다.

### 실제 격리 실행 입력·독립 기대·관찰 (11종)
공통 가상 입력: `courtId=seoul`, `firstFilingDate=2026-10-03`(실제 접수증 **없음**), 제1~6호 `status=no` 1항, 제7호 임금 `{wholeTwoYearBelowMinimum:true,reviewedPeriodYears:2,wholePeriodBelowMinimum:true,minimumWageVersion:"2026"}`, 채무≤5천만·개인채권자 없음·최근 비예외채무 없음 `value=true`, 각 `factIds:["SYN-..."]`, `sourceValidated=true/legallyRecognized=true`. 이 내부 flag는 실제 법률 승인 아님.

| 변형(합성) | 독립 **데이터 인수 기대** | main 함수 격리 **관찰** | 판단 |
|---|---|---|---|
| `context.applicationDate=2026-10-03`만 존재, 실제 최초접수 Fact 미관찰 | unknown / 사람 검토 | **candidate_for_human_review, category_7** | **위험** (상위 caller 프록시 필요) |
| firstFilingDate=null | unknown | unknown | 일치 |
| 최초접수 2026-09-30 | unsupported_version | unsupported_version | 일치 (구판본 적합성은 미평가) |
| courtId=null, 나머지 요건 양성 | unknown | **candidate_for_human_review** | **위험** |
| courtId=busan | not_applicable | not_applicable | 일치 |
| 임금 Fact IDs=[" "] | unknown | **candidate_for_human_review** | **위험**; #224 별도 Draft 보완 |
| 임금 sourceValidated=false | unknown | unknown | 일치 |
| 최근채무 요건 명시적 false | not_candidate_on_known_facts | 동일 | 일치 |
| 채무 근거 미관찰 null | unknown | unknown | 일치 |
| 날짜 2026-02-30 잘못된 달력 | unknown | unknown | 일치 |
| 실제 0원 채무를 표방하더라도 **최초접수 Fact 미관찰** | unknown | **candidate_for_human_review** | **위험** |

**11개 실제 함수 호출**, 독립 데이터 인수 기대와 **7/11 일치**, 미일치 4건. 기술적 evaluator 입력 계약 자체에 대한 기능 통과 11/11이라는 뜻이 아니며 법률적 정합성 판정은 전혀 수행하지 않았다. `courtApprovalInferred=false`는 11/11 유지. 관할/시행일 조건 `factIds=[]`를 실제 반환에서 확인.

## 2. SQL 원문/Fact/typed/feature 경계: 독립 원화/상태 9건 저장·재독

동형 Migration 0011 정의 + 합성 `cases(SYN-CASE-A/B)`, `case_calculation_runs(SYN-RUN-A)` 삽입, FK ON, SQL 컬럼 `value_json`, `value_won`, `status`, `source_fact_ids_json`, `input_refs_json`, `formula` 등 정확 사용. 실제 입력은 **원문·Fact의 진본을 뜻하지 않는 가상 문자열**로 `SYN-` 접두 사용.

| 합성 feature | 기대: SQL 레벨 허용 여부 | 실제 SQLite 저장→재독 | 제품 의미 |
|---|---|---|---|
| 관찰된 `value_json=0,value_won="0",status=computed` | 허용 | 허용·재독 | 진정한 0원은 별도 증빙 필요 |
| **미관찰** `value_json=null,value_won="0",status=blocked` | **SQL은 허용** | 허용·재독 | 미관찰을 0원으로 해석 금지 |
| 타 사건처럼 보이는 Fact ID `SYN-FOREIGN-CASE` | SQL은 허용 | 허용·재독 | 사건 소유 검증 부재 |
| `source_fact_ids_json` 문자열(배열 아님) | SQL은 허용 | 허용·재독 | 구조 검증 부재 |
| Fact IDs `[null]` | SQL은 허용 | 허용·재독 | ID 검증 부재 |
| `status="approved"` (정의된 상태 밖) | SQL은 허용 | 허용·재독 | 가짜 상태 승격 가능 |
| 동일 output_path 중복 | SQL은 허용 | 허용·재독 | 피처 충돌 검출 계층 필요 |
| 공백 output_path | SQL은 허용 | 허용·재독 | 경로 계약 체크 필요 |
| `value_won="not-money"` | SQL은 허용 | 허용·재독 | 형식 유효성은 상위 검증 필요 |

**9/9 저장·재독 성공은 제품 9/9 PASS가 아니라 DB 의미제약이 미비하다는 실측이다.** 존재하지 않는 case에 대한 run FK INSERT는 REJECTED, `PRAGMA foreign_key_check` 0행. `case_calculation_feature_store.ts`의 TypeScript `CalculationFeatureStatus` union은 런타임 SQL CHECK가 아님. 기존 쓰기 경로는 문자열 상태를 제한할 수 있어 이 실험이 운영 부정 입력 저장을 직접 증명하지는 않는다. D1 실제 재독·SQL value/fact/court filing 결합은 미실행.

## 3. 정적 기준정보·산술·토큰 재독

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` JSON 파싱: **18 모듈 / 입력 91 선언(고유 78) / 출력 42 선언(고유 40) / resultPaths 42(고유 42)**.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` JSON 파싱: **D5103 37 / D5106 48 / D5110 55 / D5111 82**. 실제 DOCX 생성·바이트·토큰 값 E2E 미검증.
- 별도 독립 원화 보존 산술(실험용): 월 900,000원 × 36 /48 /60 = 32,400,000 / 43,200,000 /54,000,000원. 계산기 배분 및 법적 현재가치 합격이 아님.

## 4. 법원·법령·국세청 공식 원문 판본

- 서울회생법원 [2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187) 직접 재조회: 제424호 제2조제2항 제7호 신설. r108 [실무준칙 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2) 이미지 0-index 271/272/391면에서 제424호 2026-09-23 개정, **2026-10-01 시행 / 이후 최초 접수 사건 적용** 확인했다는 기존 영수증을 재독. **이번 r109 PDF 직접 열람은 타임아웃**이므로 재검증 주장하지 않음.
- 법제처 [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR) / [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): **[시행 2026.10.2.] 법률 제21490호** 직접 조회. 금액합계와 전액변제·청산가치·인가요건 분리.
- 국세청 [VAT·종합소득세 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 반기, 간이과세자 통상 연간, 종합소득세는 전년도 소득 합산 신고. VAT 신고매출·종소세 신고·월별 인정 순소득 서로 자동 동일시하지 않음. 세법 판본·사건 적용은 실무자 미인증.

## 5. A2 체크 ID / 조치 / 인수

- **A2-DATA-015 [ ]**: 최초 접수일과 관할의 실제 Fact/사건 owner/revision/근거문서 연결 부재, 법률 판본과 2026-10-01 사건별 적용을 분리. 11건 중 4건 독립 데이터 경계 불일치; 전문 법률 승인 전 보류.
- **A2-DATA-016 [ ]**: 18 모듈 / 91 입력 / 42 출력·저장경로 정적 확인. 전체 입력/출력 실제 실행·D1 저장 미관찰.
- **A2-DATA-020 [ ]**: SQL의 `null`·진짜 `0`·형식오류·승인전 분리 실패를 9건 데이터 삽입으로 실측; SQL 허용은 제품 유효성 아님.
- **A2-DATA-024 [ ]**: 0011 SQLite 메모리 9건 roundtrip/잘못된 FK reject. 사건별 Fact owner/revision·실제 D1 저장·replay는 미실행.

**코드 변경 없음**: firstFilingDate/court 관할의 실제 증빙 표준 key/Fact 인수·승인자·사건 귀속·기준정보 매핑이 현재 없으며, 임의 key 하드코딩/법률상 인정수준 변경은 고위험. 기존 Draft #18/#217/#224 통합 PR에서 법률/데이터 실무자 승인과 함께 원천계약 결정해야 함. 기존 #222/#43/#223의 0/null·원장 state 충돌도 별도 인수.

**다음 r110 AX담당자**: (1) #18/#217/#224의 관할 null/제7호 근거/최초접수 판본 충돌 분리, (2) source Fact ID 형식/실존/사건 귀속·승인 상태를 DB에서 연결하는 계약, (3) #43/#203/#222/#223의 원장 blocked 0원 placeholder와 SQL `value_won` null 구분, (4) 실제 Node 전체 테스트/CI·staging D1/R2/Cron·D5103/06/10/11 DOCX 숫자 재독·변호사/계산사무장 검토를 분리 수행. **제품 최종 인수 완료 0건**. 운영배포·운영 D1 마이그레이션·전자제출·법원 인가 미수행.
