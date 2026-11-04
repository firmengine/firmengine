# A2 r121 — 데이터담당자: 접수일 기본값 계보·차단 0원 저장 의미·SQL 재조회

- 감사일: 2026-11-04 KST. **시작 및 기록 직전 main HEAD:** `725c895b7ce23cb88f231bb0584320818b53e640`. 역할 순환 r120 변호사 → **r121 데이터담당자** → r122 AX담당자.
- 엄격한 변경 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 비식별 합성 `SYN-*`만 사용. 개인정보/실 OCR 원문/비공개 정답/키 없음.
- **중앙 보드 점검 ID 4개:** `A2-DATA-015`, `A2-DATA-016`, `A2-DATA-020`, `A2-DATA-024`. 모두 **[ ] 부분 검증**, 인수 PASS 없음.
- 참고: 이전 [r120 영수증](2026-11-04_r120_1212KST_law-424-appendix-source-only.md)과 r109/r115 관련 보드 기록; 최근 main HEAD/커밋과 미병합 Draft [#230](https://github.com/firmengine/firmengine/pull/230), [#234](https://github.com/firmengine/firmengine/pull/234) 메타데이터. 두 PR 모두 읽기 검토만; 본 회차 제품 수정/병합 없음.

## 실제 파일·스키마 재독 SHA
- `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `createCase()` 초기값: `applicationDate=asOf`, `courtId="seoul"`, `facts=[]`, `documents=[]`, `ruleApplicationReviewed=false`.
- `lib/legal-proposals.ts` blob `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`: `buildLegalProposals()`의 `firstFilingDate: appDate || null`, 여기서 `appDate=data.context.applicationDate`. 독립 최초 법원 접수증 Fact/사람 승인 검사를 이 호출 경로에서 확인하지 못함.
- `lib/context-validation.ts` blob `7ea7262cca177cc92a59f65fe917cc14573786db`: `applicationDate` 날짜형/기준 유효성 검사는 있지만 최초 접수증 원천 ID 승인 계약과 별개.
- `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`: `court_scope`·`effective_date` 조건의 `factIds=[]`; 실제 최초 접수 증빙과 관할 증명 결여. #230은 형식 검증 후보이지 날짜의 실제 사건 귀속 검증은 아님.
- `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`: `statusOf()`, `won()`, `INSERT OR IGNORE`, `case_calculation_heads` 승격, SQL feature 직렬화·재조회.
- `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: runs/features/heads, `value_json`, `value_won`, `status`, `source_fact_ids_json`, run FK. 원문/Fact/typed/SQL은 서로 다른 계층, SQL 단독으로 source Fact 존재·사건 귀속 검사 없음.
- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 직접 JSON 파싱: 18 calculations, 91 input declarations(78 unique), 42 outputs(40 unique), 42 distinct resultPaths.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 직접 JSON 파싱: D5103 37, D5106 48, D5110 55, D5111 82 registered tokens. **정적 카탈로그 확인이지 실제 91입력 소비/42출력 replay·DOCX 생성을 완료한 것이 아니다.**

## 실행 1 — 원본 `createCase` 함수 본문을 타입표기만 제거하여 V8 실행 (3/3)
기대한 **기술적 보수 조건**: 최초접수증 Fact/사람 승인 없는 초기 사건의 `applicationDate`와 `courtId`는 *확정된 법원 값이 아님*. 실제 초기화 함수의 관찰은 아래와 같다.

| 합성 `asOf` 입력 | 관찰 `applicationDate` / `courtId` | 원천 Fact/문서 | 판정 |
|---|---|---|---|
| `2026-09-30` | `2026-09-30` / `seoul` | 0/0 | 초기값 존재; 접수증 승인 아님 |
| `2026-10-01` | `2026-10-01` / `seoul` | 0/0 | 시행 경계 초기값; 실제 최초접수 미인증 |
| `2026-11-04` | `2026-11-04` / `seoul` | 0/0 | 현재일 초기값; 법원 접수일 미인증 |

**새로운 연계 위험:** 초기화된 `applicationDate`와 `courtId="seoul"`이 후속 `buildLegalProposals`에서 `firstFilingDate`/관할로 사용된다. 실제 최초접수일이 2026-09-30인 사건이 2026-10-02 새 사건으로 입력되는 경우 **시간 프록시가 개정 준칙의 시행 경계를 잘못 넘길 수 있다**. 현재 원천 Fact/최초 접수증/검토자 증명 경로가 부재하며, 초기값 자체만으로 제7호 후보가 된다고 단정하지 않는다(다른 증빙 게이트도 존재). 법률 판정 의미 변경은 **별도 Draft PR+변호사 승인 필요**로 본 회차 수정 안 함.

## 실행 2 — main의 `statusOf`·`won` 실제 함수 본문 V8 (10조건)
타입 주석만 제거하고 JS V8에서 실제 판정/원화 직렬화 두 함수를 호출. 기대값은 **승인 전 출력에 숫자 오인식이 없어야 한다는 보수적 데이터 인수 기준**으로 정하였고, 실제 제품 계약과 다를 수 있음을 명시.

| 합성 값 / 엔진상태 | 독립 보수 기대 `status;won` | main 관찰 `status;won` | 대조 |
|---|---|---|---|
| `"0";computed` | computed;0 | computed;0 | 일치 |
| `null;computed` | missing;null | missing;null | 일치 |
| `null;blocked` | blocked;null | blocked;null | 일치 |
| `"0";blocked` | blocked;null | **provisional;0** | **계약 검토** |
| `0;blocked` | blocked;null | **provisional;0** | **계약 검토** |
| `"0";provisional` | provisional;0 | provisional;0 | 일치: 개별 관찰 가능한 금액일 수도 있음 |
| `"0";computed;+SOURCE_CONFLICT` | conflict;0 | conflict;0 | 일치 |
| `"0";not_applicable` | not_applicable;0 | not_applicable;0 | 일치: 비해당은 실제 0과 다름 |
| `"1,20";blocked` | blocked;null | **provisional;null** | **계약 검토** |
| `"0010";computed` | computed;null | **computed;0010** | **형식 위험** |

**6/10 보수 기대 일치, 4건 차이**. `blocked` 상태에서 실제 관측된 개별 component 0원을 `provisional`로 보존하는 현재 주석 의도가 있으므로 **제품 결함 확정 아님**. 반면 blocked aggregate에서 생성된 임시 0원인지 원천 개별 0원인지 구분할 구조적 계보가 없어 법원서식 소비자가 오해할 가능성이 있다. `0010`도 정규 원화로 승인하지 않아야 한다. 기존 #148/#160 및 원장 Draft 통합 필요, 무승인 계산규칙 변경 금지.

## 실행 3 — SQLite 3.46.1, migration 0011과 동일한 3개 테이블 DDL, 합성 10 feature 저장·SELECT
`cases` 최소 FK 부모 `SYN-CASE-A`, run `SYN-RUN-A`를 합성으로 만들고 **0011 runs/features/heads DDL 원문 열·제약·인덱스 동일** 구성, PRAGMA foreign_keys=ON. 10개 합성 feature 전건 insert/SELECT 재조회 성공; `PRAGMA foreign_key_check=[]`, `integrity_check=ok`.

- 정상 계산 `value_json=0,value_won="0",status=computed`, 진짜 missing `value_json=null,value_won=NULL` 별도 재독.
- `blocked` 유래를 가정한 `value_json="0",value_won="0",status=provisional`도 DB 허용.
- 상충 `value_json=null/value_won="0"/computed`, `value_json="0"/value_won=NULL/computed` 저장 허용.
- `not_applicable`과 금액 0 결합, 타사건으로 보이는 `SYN-OTHER-CASE-FACT`, `source_fact_ids_json`의 **문자열 스칼라**, 무효 `value_json={bad}`, 동일 output_path 상이 feature 2개 저장 허용. 이는 **DDL 의미검증 부재**이지 제품 정상 writer의 발생 빈도 입증이 아니다.
- 미존재 run FK 삽입은 **FOREIGN KEY constraint failed**로 정상 거부.
- **staging D1/실제 `persistCaseCalculationFeatures` 호출·전체 마이그레이션·42출력 실행·Word 바이너리 재독은 미실행.**

## 독립 BigInt 산술 오라클 — 실제 계산엔진과 동일성 증명 아님
월매출 `3,000,000`−필요경비 `1,000,000`=`2,000,000`원/월, 순수 36/48/60개월 곱 = `72,000,000/96,000,000/120,000,000`원. VAT 신고 매출·연간 종합소득세 자료를 중복 자동 합산하지 않고 별도 source-only로 보류. 관할/법원 인정 변제금·기간/세무상 인정비용 확정 아님.

## 공식 원문 대조 (2026-11-04 웹)
- 서울회생법원 [2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 제424호 제2조 제2항 **제7호 신설**. r120은 공식 실무준칙 PDF 부칙 **2026-09-23 개정, 2026-10-01 시행, 시행 이후 최초 접수 사건 적용** 페이지를 직접 재독했다고 기록. 이번 회차 공식 PDF **웹 재조회는 타임아웃**이므로 재인증했다고 주장하지 않음. 관할 서울/최초접수 원본증빙·실무자 승인 별도.
- 국가법령정보센터 [제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777)와 [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 모두 **법률 제21490호, 2026-10-02 시행** 원문 확인. 원칙 3년(특별 사정 5년 상한)과 인가요건을 기술 계산과 혼동하지 않음.
- 국세청 [VAT 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반 6개월·간이 원칙 1년 과세기간; 신고매출/세액/비용은 각각 구분, 월순소득 자동 산입 금지.

## ID 판정/수정/다음
- `A2-DATA-015` **[ ]**: `createCase` 날짜·서울 관할 기본값→법률 평가 프록시 실측. 최초 법원 접수증(최초 접수일/관할/사건 귀속/증빙 SHA/판본/승인자) 연계 없음; 법률·기준 reference SHA 동시 구속 확인 필요.
- `A2-DATA-016` **[ ]**: 18/91(78 고유)/42(40 고유)/42 resultPaths 정적 파싱, typed JSON pointer→실제 91 입력 소비·SQL 결과 대조 미실행.
- `A2-DATA-020` **[ ]**: 상태/0/null/비해당/상충 10조건 실제 함수 실행, 4건 보수적 인수 기대와 차이; blocked provisional의 원인 계보·미확정 0 표시 경계 사람 검토 필요.
- `A2-DATA-024` **[ ]**: 0011 동형 SQLite 10개 feature insert/re-read, 비정상 상태·JSON-WON 상충 DB 보관 가능, run FK는 유효. 실제 D1 전체 호출 미인증.
- **제품 코드 수정·테스트 커밋·PR/병합 0건**: 법률 접수일 필드 의미·차단 aggregate 금액 처리 변경은 불확실/고위험이므로 병렬 Draft #230/#234 및 기존 #148/#160과의 계약 정리가 선행돼야 함. main 변경은 **본 영수증 및 해당 A2 DATA 네 ID 보존병합만**.
- 다음 **r122 AX담당자**: 첫 접수증 Fact 기반 검증 계약을 별도 Draft 설계/실제 Node 회귀, 통합 source-only→typed→SQL→D5103/D5110 차단값 전파 시험, raw/Fact/typed/SQL 해시·동일 사건 귀속, 18모듈/91 입력·42 출력/4 서식 Word 바이너리 검사. 운영 마이그레이션·배포·전자제출/법원 인가 금지.
- **제품 최종 인수 0건**. 전체 CI/Node, staging D1/R2/Cron, 실제 법원서식·법률/회계 최종 인증/변호사 승인은 모두 미실행.
