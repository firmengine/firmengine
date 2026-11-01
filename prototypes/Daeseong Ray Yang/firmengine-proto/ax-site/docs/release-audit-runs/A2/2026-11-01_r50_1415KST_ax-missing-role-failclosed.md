# FirmEngine A2 r50 — AX담당자: 소득원 역할 미관찰의 월소득 자동승격 경계

- 실행일: **2026-11-01 KST**. r49 **데이터담당자** → r50 **AX담당자** → 차회 r51 **IT담당자**. 허용 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 제품 인수 0건.
- 읽은 main 시작 HEAD: `f4dbdc651d846fff85095c801f8f9b7bdaeb0f4c`. 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `43a66319f50af6b998f6d62696cbe7bcaec89594`; r49 영수증, 최근 main 커밋, Draft #106/#119/#122/#125, 원본 계산/도메인/서식/SQL 스키마·기존 테스트를 확인. 최신 main은 타 작업자에 의해 움직이므로 본 문서에 적힌 시작 SHA는 완료 시점 HEAD와 구별한다.
- 체크 **`A2-AX-003`, `A2-AX-010`, `A2-AX-012`, `A2-AX-017`**: **모두 [ ] 부분검증/인수 미완료**. 법률인정/서식 토큰값/원천실증 인가 없음. 실제 의뢰인 자료, OCR 사실값, 개인식별정보, .env, 키 또는 비공개 정답 미사용.

## 1. P1 경계 재현 — 분류 미관찰을 월별 소득 관측으로 대체

원본 **#125** `lib/form-mapping.ts` blob **`cadd4c46bf2b10f0297a5f28c75ca85c833c08ab`**의 월별 매핑은 `income?.sourceCalculationRole??"period_income_observation"`로, 데이터 모델에서 optional인 소득원 역할이 **없거나 null이어도** 분류 완료된 관측으로 표시했다. 그런데 같은 Draft #125의 `lib/income-period-coverage.ts` blob **`66f7bcaf73ac302add2dfd35b55333388fbb7d39`**는 `source_calc_role === "period_income_observation"`일 때만 완결로 인정한다.

합성 월별 소득: `{"period":"2026-01","net_income":"2,400,000","source_id":"SYN-ROW-1","source_stream_id":"SYN-WAGE","source_fact_ids":"SYN-FACT-1","source_review_status":"accepted"}`, 대표기간 `2026-01-01~2026-01-31`, 증빙 cutoff `2026-01-31`. 해당 Fact ID와 금액은 **독립 실행을 위한 임의값**으로 실제 원천은 없다.

| 반례 / 독립 기대 | 원본 실제 관찰 | #127 후보 실제 관찰 |
|---|---|---|
| 역할 필드 누락 → `review_required` | **`complete` 오판** | `review_required`; `D5103_SOURCE_REVIEW_REQUIRED` |
| 역할 `null` → `review_required` | **`complete` 오판** | `review_required` |
| 명시적 `period_income_observation` + 정상기간 → 이 좁은 게이트 `complete` | — | `complete` |
| `historical_tax_comparison` / `gross_turnover_only` → 검토보류 | — | `review_required` |
| 명시적 문자열 `"0"` → 유효 0원 관측 | — | `complete` (좁은 게이트만) |
| `net_income:null`, 배열 source ID, cutoff `null` → 검토보류 | — | 각 `review_required` |
| 급여 12개월 + 사업 11개월 / 동일 Fact 두 소득원 / 정상 이직 6+6 | — | 각각 `review_required`; **정상 이직은 과차단 후보** |
| 대표기간 첫 달 누락 | — | `review_required` |

**실행 범위:** GitHub 저장본의 매핑 표현식과 실제 coverage 함수에서 TypeScript 선언만 제거해 V8 격리실행, 합성 16개 비교 중 **기존 2개 불일치**, 나머지 및 후보 **14개 기대 일치**. 한 검증이 `complete`라고 해서 전체 계산, 소득 인정, 전자서식 또는 법원 인가 완료 아님. 정확히 **기존 두 실패가 후보에서 검토보류로 바뀌는 것을 관찰**했다.

## 2. 수정·분리 브랜치 / 작성된 테스트 등급

- 별도 stacked **Draft PR #127**: https://github.com/firmengine/firmengine/pull/127 . base **#125 브랜치**, main 미병합. 수정된 `lib/form-mapping.ts`의 매핑 부분은 `source_calc_role:income?.sourceCalculationRole??""`로 바꾸어 **미분류/미관찰을 미분류로 유지**. 후보 blob **`f008dee07477a0fae07518e97544e5bfb32b928f`**, 코드 커밋 **`e728f30141eaad113b32ba59b2948b0a90d6de4c`**. 임의 법률상 인정/불인정이나 새로운 법률규칙을 만들지 않았다.
- `tests/a2-r50-source-role-explicit.test.ts` **6개 Node 테스트 소스 작성·커밋** `37f1768976e73c090315a5351b8f2f88b72eb236`. **프로젝트 Node 테스트 러너는 실행하지 않았다**. 이 테스트는 Fact가 없는 가상 typed row를 생성해 실제 매핑이 `[확인 필요]`를 유지하는지 검사하고, 역할→coverage만 보기 위해 합성 금액을 별도 주입한다. 실제 OCR/Fact/typed/SQL/서식 E2E가 아니다.
- 기준 브랜치와 비교하여 변경 파일 **2개**(`lib/form-mapping.ts`, 신규 테스트) 모두 `ax-site/` 하위임을 확인. PR Draft·미병합. 기존 #119/#122/#125 및 #106/#96/#97/#98/#102, 합산분류·승인기준과 통합되지 않았다.

## 3. 독립 산술 / SQL feature 저장형식 / 서식 토큰

- BigInt 독립 합성 산술: 급여 2,400,000원×12 = **28,800,000원**. 사업 순소득 1,000,000원×11 = **11,000,000원**. 관측 합계 **39,800,000원**. 사업소득 미관찰 12월은 **0원·100만 원 어느 값으로도 보간하거나 법률 인정하지 않았다**.
- main migration `drizzle/0011_case_calculation_features.sql` blob **`0caa359d250dce45765d269d271ad63170ec3efa`** 재독: `value_json TEXT NOT NULL`, `value_won TEXT`, `status TEXT NOT NULL`, `source_fact_ids_json TEXT NOT NULL` 분리. Python SQLite **3.46.1 인메모리**에 해당 3테이블 DDL과 합성 `cases` 부모를 만들고 **5개 합성 feature INSERT/SELECT** 수행. 정상 240만원, 명시적 `"0"`, `value_won=NULL` 구분 보존. **`value_json="null",value_won="0",status="computed"` 의미 상충**, `source_fact_ids_json="NOT_JSON"`도 DB 저장 허용; 없는 run FK 참조는 거부. DDL 동작만 관찰, 애플리케이션 SQL validation 및 Cloudflare D1 E2E 아님.
- main 기준정보 `lib/reference-decision-tables.json` blob **`6924e3977caf748ce8a3d617fae15aff7d2fe2ce`** JSON 직접 파싱: 계산 **18모듈, 입력 선언 91(고유 78), 출력 선언 42(고유 40), resultPaths 42**. `lib/template-token-catalog.json` blob **`899c4d564fcb1726861f89dcf04dbf1b7e372687`**: D5103/D5110/D5111 등록 토큰 **37/55/82**. 정적 계약 확인일 뿐 **91개 실제 피처 전수 계산·재독/Word 생성·토큰별 근거 경로 검증 아님**.

## 4. 공식 원문 및 적용 경계 (2026-11-01 조회)

1. **서울회생법원** 2026-10-01 공지: 실무준칙 **제424호 제2조 제2항 제7호 신설** 공지 https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . 개정전문 **부칙/경과조치/개별 사건 적용일은 미검증**, 타 관할 확장·변제기간 단축 자동규칙 금지.
2. **국가법령정보센터** `채무자 회생 및 파산에 관한 법률`, **[시행 2026-10-02, 법률 제21490호]**, 제611조(변제계획) https://www.law.go.kr/LSW/lsLinkProc.do?joNo=061100&lsNm=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0&mode=11 ; 제614조 인가요건 https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 해당 시행판의 개별 사건/접수일/경과규정별 적용 여부는 **변호사 미승인**.
3. **국세청** 부가가치세 과세기간 일반과세자 반기 / 간이과세자 통상 연간 https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 . VAT 총매출·종소세 신고정보를 개인회생 인정 월순소득으로 자동 치환 금지.

## 5. ID별 상태·다음

- **A2-AX-003 [ ]** VAT/종합소득세 비교자료 vs 관측 순소득 역할: source role null/미관찰 자동 `period_income_observation` 승격 결함 재현, Draft #127. 현재 main/실제 Word 경로 수정 미병합·미검증.
- **A2-AX-010 [ ]** 복수/11개월/겸업 합성: 급여12+사업11·이직6+6·원천 Fact 중복을 본 helper에서 검토보류 확인. **정상 이직 과차단 미해결**, source별 기간 사용자 승인 필요.
- **A2-AX-012 [ ]** 임시 관측 vs 승인 소득 분리: 미분류 role을 별도 상태로 유지하도록 후보 작성, actual Fact→typed→`approved_monthly_income`→D5103/D5110/D5111 E2E 없음.
- **A2-AX-017 [ ]** 법률 승인 없는 계산 확정 방지: 어떤 `complete`도 법적 소득 인정/법원 인가와 등치하지 않음. 실무자 승인·법률 적용일 확정·공식 양식 동등성 미인증.
- **다음 r51 IT담당자:** #119→#122→#125→#127을 #106 및 승인/중복 관련 Draft와 병합 전 비교·실제 Node 테스트·케이스 계산/3서식 통합 검증. 정상 이직/휴직/계절사업 per-stream 승인판본 모델 결정 전 자동완결 금지. `value_json`/`value_won`/Fact JSON shape의 저장 전/후 유효성 보장과 구판본 calc head P0 별도 계속. 사용자 승인·법원/세무회계 실무 검토 전 법률 적합성 **미인증**.

**이번 제품 인수/운영 배포/운영 D1 migration/법원 전자제출/법원 인가 확정 모두 0건**. 전체 Node/CI, staging D1·R2·Cron, 실제 DOCX 생성/공식서식 동등성, 변호사·계산사무장 최종승인 **각각 미실행 또는 미인증**.
