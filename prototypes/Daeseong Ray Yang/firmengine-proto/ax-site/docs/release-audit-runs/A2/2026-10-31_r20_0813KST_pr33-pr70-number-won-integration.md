# FirmEngine A2 20차 — AX담당자: SQL 계산 피처 replay #33·#70 통합과 number 원화 의미 일치

- 감사일: 2026-10-31 KST (이번 회차). 역할 순환 r18 변호사 → r19 데이터담당자 → **r20 AX담당자**; 다음 **IT담당자**.
- 시작 main SHA: `b90f901cdaababde0324a53a713f3497315837d1`. 최근 commit/PR, 단일 보드의 A2 ID, r18/r19 영수증, 실제 저장·승인 API, schema 및 tests를 재조회.
- **A2 ID 4개:** `A2-AX-004`, `A2-AX-015`, `A2-AX-017`, `A2-AX-018` — 전부 **부분검증 [ ] 유지**. 인수/법률/회계 승인 0건.
- main 파일 blob: `lib/preapproval-calculation-replay.ts` = `9517e71ee238955ee4af679bce1ebced888c4432`; `app/api/cases/[id]/approval-readiness/route.ts` = `731f66a10d4af704b432dcd298061b452941fd13`; 원화 저장기 `lib/case-calculation-feature-store.ts` = `bb5f88b26e68f5ae2234741063ac9301a927e27a`; SQL `drizzle/0011_case_calculation_features.sql` = `0caa359d250dce45765d269d271ad63170ec3efa`. 코드 blob은 회차 읽기 시점 기준.
- 기존 **Draft #33**(출력행 누락) 및 **Draft #70**(string Won SQL NULL)을 각각 읽었고, 서로 같은 `lib/preapproval-calculation-replay.ts`를 수정하는 충돌 범위를 확인. 원 PR은 수정하지 않음.

## 1. P1 재현 — 안전정수 JSON number가 저장기와 재생검증기에서 불일치

저장기 `won(name,value)`는 이름이 `Won`으로 끝나면 (i) 정확 정수 문자열 또는 (ii) `Number.isSafeInteger(value)`인 **number**를 SQL `value_won` 문자열로 보관한다. 반면 main replay는 `valueWon` 값이 있을 때 JSON의 **string**만 정상으로 인정하고, `valueWon=NULL`은 검사를 건너뛴다. #70은 정수 문자열 NULL만 보완해 **number 경로가 남아 있다**.

전부 가상 입력으로 실행했고 실제 의뢰인/원본 OCR 자료·키는 사용하지 않았다.

| 합성 원문→Fact→typed→SQL 형태 | 독립 기대 | main V8 관찰 | 통합 #71 V8 관찰 |
|---|---|---|---|
| `SYN: 2026-01 월 1,200,000원` / Fact `income.net="1200000"` / typed 계산 결과 `monthlyIncomeWon:1200000`(number) / SQL `value_json=1200000,value_won="1200000"` | replay valid | **STORED_WON_MISMATCH 오탐** | valid |
| 같은 typed number, SQL `value_won=NULL` | 금액열 유실, 차단 | **valid 거짓 통과** | `STORED_WON_MISMATCH` |
| typed `monthlyIncomeWon:0`(number), SQL `value_won="0"` | 정확한 0원 | **오탐 차단** | valid |
| typed 0(number), SQL `value_won=NULL` | NULL≠0, 차단 | **valid 거짓 통과** | 차단 |
| `"9007199254740993"` 문자열, 같은 SQL 문자 금액 | BigInt 정확 보존 | valid | valid |
| 동일 거액, SQL `value_won=NULL` | 유실 차단 | **valid 거짓 통과** | 차단 |
| typed `null`, SQL `null/NULL` | 미관찰, 산술 0 아님 | valid | valid |
| typed `"unknown"`, SQL `"unknown"/NULL` | 미확정(source-only) | valid | valid |
| non-Won `monthCount:36`, SQL Won NULL | 비금액 정상 | valid | valid |
| 출력 SQL 0행 또는 예상 2행 중 1행만 존재 | 누락 차단 | **valid 거짓 통과** | 차단 |

**원문·Fact·typed의 단계별 예시는 합성 작성값**이며 실제 OCR 추출→Fact DB→법적 인정 처리한 결과가 아니다. 법률 인가/변제액 인정도 아님.

## 2. 독립 오라클 / 실제 실행 범위

- main과 새 수정 브랜치의 **실제 replay 함수 본문**을 Github에서 읽고 TypeScript 타입만 제거한 V8 격리 실행. JSON pointer·sourceFactId 상태·예상행 검사를 실제 함수로 처리. 결과는 **main 9/17**, **통합 #71 17/17** 독립 expected와 일치. 여기서 17건은 정수문자열·number/SQL NULL·0·거액 문자열·unknown·null·소수/비금액·잘못된 원화·SQL 0행·1행 누락·전행존재 등의 별개 합성 케이스다. 일부 case는 핵심 status만 기대하며 SQL/법원 의미의 전 항목은 미검증.
- 1차 별도 #33/#70 교차 12시나리오: main **7/12**, #33 **9/12**, #70 **10/12**, 두 수정의 단순결합 **12/12**(새 number 사례는 추가 개선 필요). 다중 포인터/실제 SQL 원장·설치된 TS 프로젝트 Node 테스트와 혼동 금지.
- **새 Node 테스트 7그룹은 소스 작성만 했고 프로젝트 환경에서 실행하지 않았다**. GitHub PR head의 자동 workflow 실행 영수증 **0건 관찰** (조회된 PR workflow 페이지 범위 내); 전체 CI, D1/R2, 실제 Word, 공식 서식, 변호사 승인 미검증.
- `drizzle/0011`의 `value_json TEXT NOT NULL`, `value_won TEXT` 분리를 확인. 위 SQL 테이블의 row 형태는 입력을 수동 조립한 **합성 객체**이며 `INSERT/SELECT`나 staging D1은 실행하지 않았다.
- 변제 산술 독립 참조: 가정 관측소득 2,400,000원 − 가정 생계비 1,400,000원 = 가정 가용 1,000,000원. 36/48/60회 명목 합계 = 36,000,000 / 48,000,000 / 60,000,000원. 이것은 **법원 인정액이 아니다**.

## 3. 수정·GitHub

- **새 Draft PR #71:** https://github.com/firmengine/firmengine/pull/71 . 별도 브랜치 `audit/a2-r20-pr33-pr70-integrated-numeric-won-20261031`, 기준 main `b90f901cdaababde0324a53a713f3497315837d1`.
- 변경 파일 3개가 모두 허용된 `ax-site` 아래임을 PR changed filenames로 재조회: `lib/preapproval-calculation-replay.ts` (기대 출력 전체 경로, SQL 값 재생/정확 Won), `app/api/cases/[id]/approval-readiness/route.ts` (동일 engine 실행에서 `calculationFeatureRows(execution)` 기대 행 전달), `tests/a2-r20-integrated-replay-numeric-won.test.ts` (7그룹 회귀 소스).
- 브랜치 source commit `49bc522f99535273760c8b2117bbb51b9c6bfde7`, API commit `42e084f749cb0744c378bba5306c419303d750c0`, 테스트 commit/head `8b4a863825afe8cec6aace0c25b0859d0dfd527e`. **Draft·미병합**; #33/#70 다른 에이전트 원본 유지. 제품 법률/세무 산식·원천 데이터·승인 상태는 수정하지 않음.

## 4. 18개 계산/91 입력/서식 토큰 원본 정적 재확인

최신 main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`를 직접 파싱: **18 모듈, 입력 선언 91회(고유 78경로), 출력 선언 42회(고유 이름 40), 결과 경로 42개**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 직접 파싱: **D5103=37, D5110=55, D5111=82 토큰**. 이것은 *등록값 정적 검증*이며 91입력/42출력 실행·저장·재조회·DOCX 바이트 검증이 아니다.

## 5. 공식 원문·시행일·법률/회계 경계

- **국가법령정보센터 공식 원문:** `채무자 회생 및 파산에 관한 법률` [시행 **2026.10.02.**, 법률 제21490호, 2026.03.24. 타법개정], **제611조** 재산·소득/변제계획 기재 및 원칙 3년, 예외 최대 5년. https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221
- **서울회생법원 공식 공지:** **2026.10.01.**, 실무준칙 제424호 제2조 제2항 **제7호 신설**. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . 이번은 공지 페이지 원문 재확인. 첨부 PDF 조문·부칙·실제 개별 사건 적용일은 **미검증**, 자동규칙으로 승격하지 않음.
- **국세청 공식:** 일반과세/간이과세별 부가세 계산식 및 과세기간 분리. https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 . 월 인정 사업 순소득·VAT·종합소득세를 같은 것으로 자동 합산하지 않음.
- **변호사·계산사무장 등 전문가 법률/세무·회계 검토 전 모두 미인증**. 원문/Fact의 미관찰, null, 명시적 0, 비해당, source-only, 승인전·상충 상태는 독립 유지.

## 6. 다음 A2 (IT 담당자 순환)

1. #71의 프로젝트 네이티브 Node/TS 7개 + #33/#70 기존 테스트 실제 실행 후, 같은 `expectedOutputs`·`won()` 계약을 D1 SQLite schema와 5,000/5,001 feature 행 및 두 worker 경쟁상태에서 재확인. CI와 staging D1/R2는 별개로 보고.
2. 원문 → Fact → typed → `case_calculation_features` 저장/재독 → D5103/D5110/D5111 실제 DOCX 숫자·토큰, 급여 11/12개월 및 부분월 PR #67, OCR 금액 PR #60, 서식 PR #58을 **충돌 검사 후** 통합 회귀.
3. VAT/종소세/경비 중복, 채권·자산/청산가치, 36/48/60회 원화 잔여원·날짜·다채권 배분, 공식 준칙 PDF·사건별 적용일을 실무자와 별도 확인.

**제품 인수 완료 0건**. 운영 배포·운영 D1 migration·실제 법원 전자제출·인가 확정은 수행하지 않았다.
