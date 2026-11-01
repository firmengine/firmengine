# FirmEngine A2 r49 — 데이터담당자 / Fact 계보 자료형·세무 원천 역할·SQL feature 재독

- 실행: 2026-11-01 KST / 직전 r48 변호사 → 이번 **데이터담당자** → 다음 r50 **AX담당자**. A2 축 이외의 코드 점검·수정 없음.
- 최초 조회 `main` HEAD **`47439c611c4afbdc985653d0be62c31c8270d1fb`**, 영수증 쓰기 직전 HEAD **`47439c611c4afbdc985653d0be62c31c8270d1fb`**. 단일 기준 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 직전 r48 영수증, PR #119/#122와 관련 actual source/blob·테스트·`drizzle/0011_case_calculation_features.sql`을 재독함.
- 체크: **A2-DATA-006 / A2-DATA-007 / A2-DATA-018 / A2-DATA-020** 모두 **[ ] 부분검증·인수 미완료**. 합성 데이터 외 고객 자료·원본 OCR·민감 정보·키·.env·비공개 정답을 사용/기록하지 않음.

## 1. 재현 결함 — 상위 #122의 실제 D5103 원천 ID 검증 (P1 후보)

- GitHub PR #122 (`audit/a2-r48-law-internal-lineage-preflight-20261101-1212`) `lib/income-period-coverage.ts` **blob `4c147631f109b9f07007c0285e7c15be9f01cb46`**. 실제 함수 `checkSelectedIncomePeriodCoverage`를 읽고 TypeScript 주석/타입표기만 제거한 V8 격리 실행. 선택기간 합성 **2026-01-01~01-31**, 증빙 기준일 **2026-01-31**, 월급여 관측 **`"2,400,000"`**, 원천 `SYN-INCOME-01/SYN-WAGE/SYN-FACT-01`. 이 값은 법률 인정액 아님.
- 원래 코드는 `row.source_id?.trim()`, `source_stream_id?.trim()`, `source_fact_ids?.trim()` 호출 전 런타임 자료형을 확인하지 않는다. `number 0`, `[]`, 배열 Fact ID → **TypeError**. `source_fact_ids=", ,"` 또는 `"SYN-A,,SYN-B"` 는 비어 있는 Fact 목록/멤버를 허용해 **`complete`**. `source_calc_role="historical_tax_comparison"` 및 임의 역할도 **`complete`**, 세무 비교자료 또는 미분류 원천을 현재 관측 순소득으로 오승격할 수 있음(함수 단독 관찰; 실제 계산·문서 E2E 미실행).
- 명시적 `"0"`, 유효 기간·Fact, 미관찰 cutoff·`null`, `gross_turnover_only`, `unreviewed`, 잘못된 달·금액 등 대조. **원본 GitHub 함수 V8: 독립 기대 상태 9/19 일치.**
- 후보 수정은 문자열 ID/Fact 구성요소 검증(비문자·빈 쉼표 멤버는 `D5103_SOURCE_LINEAGE_UNRESOLVED`), `source_calc_role`이 **`period_income_observation` 외이면 `D5103_SOURCE_REVIEW_REQUIRED`**. 외부 세무/법원 인정규칙이 아니라 **애플리케이션의 source-only/미관찰 검토 게이트**다. 결과를 법률상 불인정이라고 해석하지 말 것.
- 후보 본문 V8 19/19 일치, GitHub 커밋 후 **새 blob `66f7bcaf73ac302add2dfd35b55333388fbb7d39` 재조회 V8 20/20 독립 상태 일치**. 정상 월 `"2,400,000"`, 명시적 `"0"`, 두 개 유효 Fact는 여전히 `complete`. 테스트가 뜻하는 `complete`는 이 격리 검사 통과일 뿐 문서 승인 아님.

| 대표 합성 입력 | 독립 기대 | 기존 함수 관찰 | 수정 함수 관찰 |
|---|---|---|---|
| `source_id=0` / `source_stream_id=[]` / `source_fact_ids=[]` | review_required | **TypeError** | review_required |
| `source_fact_ids=", ,"` / `"SYN-A,,SYN-B"` | review_required | **complete** | review_required |
| `source_calc_role="historical_tax_comparison"` / `"unmapped"` | review_required | **complete** | review_required |
| `source_calc_role="gross_turnover_only"` / 미승인 원천 | review_required | review_required | review_required |
| 관측금액 문자열 `"0"`, 유효 소득 역할·Fact·월말 | 이 게이트 complete | complete | complete |
| 기준일 `null` | review_required | review_required | review_required |

## 2. 작성된 코드·테스트의 등급 (Draft만)

- Draft PR **#125** https://github.com/firmengine/firmengine/pull/125, **#122를 base로 한 stacked Draft**, 제품 main 미병합. `lib/income-period-coverage.ts`와 `tests/a2-r49-source-lineage-types.test.ts` 두 파일만 변경·추가. 소스 커밋 `96e92155cdd5a242a4cf39991e88f79b6d9cd838`, 테스트 커밋 `1967892c5afaf2191ee99d9d4f99b91ca1c79466`.
- 신규 Node `node:test`는 **20개 매개변수 조건 + 3개 소득원/Fact 반례 테스트 소스를 작성했지만 실제 Node runner/전체 CI는 실행하지 않음**. V8은 실제 GitHub 함수 재실행이나 정식 빌드/Node/D1/Word 동등 검증은 아님.
- **급여 12개월 + 사업 11개월**은 상위 #119에서 소득원별 누락으로 `review_required` 설계. **이직 6+6개월**은 실제로는 유효할 수 있어 현재 과차단 후보(인간 승인된 stream별 관측기간 계약 미구현). #125는 이 정책을 변경하지 않음. 정상 이직·휴직·계절사업의 소득원별 시작/종료·발급기관·승인자·기준판본은 계산사무장/변호사 검토 전까지 자동 인식 금지.

## 3. SQL storage / Fact / typed / 서식 계보 분리

- 최신 main `drizzle/0011_case_calculation_features.sql` blob **`0caa359d250dce45765d269d271ad63170ec3efa`**, `db/schema.ts` blob **`933f8686845ac14669312dd21bf85e02c62ed5e6`**, `lib/case-calculation-feature-store.ts` blob **`bb5f88b26e68f5ae2234741063ac9301a927e27a`** 확인. 실제 SQL 저장은 `value_json TEXT NOT NULL`, `value_won TEXT`, `status TEXT NOT NULL`, `source_fact_ids_json TEXT NOT NULL` 분리. `formBindings.rows.month`는 PR #119의 소득원/Fact ID 문자열과 공개 표시금액을 함께 보유하지만 **SQL row/Fact/typed/문서 파일 전 경로 자동 동등성은 아직 미확인**.
- Python `sqlite3 3.46.1` **인메모리**에서 0011의 **동일 runs/features/heads DDL**과 테스트용 최소 `cases` parent를 생성하여 **합성 7개 feature 행 INSERT/SELECT**. 정상 `"2400000"/"2400000"`·명시 `"0"/"0"` 저장/재독, SQL `NULL` 원화·JSON `null`은 구별됨. 반면 `value_json=null,value_won="0",status="computed"`; `value_json="2400000",value_won=NULL,status="computed"`; malformed `source_fact_ids_json="NOT_JSON"` / JSON scalar 등 **4개 의미 상충/비정상 행도 SQL은 저장 허용**. 존재하지 않는 run의 FK 행은 거부. 이것은 **DDL 저장계약만의 검증**이며 실제 D1/응용 replay 검증 아님. 승인된 0과 미관찰 null을 합쳐 저장하는 로직 금지.
- `lib/reference-decision-tables.json` blob **`6924e3977caf748ce8a3d617fae15aff7d2fe2ce`** 정적 JSON 파싱: **18모듈, 입력 선언 91(고유78), 출력42**. `lib/template-token-catalog.json` blob **`899c4d564fcb1726861f89dcf04dbf1b7e372687`**: **18개 DOCX 템플릿**, D5103 **37**, D5110 **55**, D5111 **82** 등록 토큰. #119 5개 `source_*` 내부 key와 동일한 공개 template token은 **18개 중 0개**. 따라서 현재 카탈로그 기준 **내부 ID가 실제 Word에 유출된 사실은 관찰되지 않음**; 실제 DOCX 바이트/renderer·편집·부록 전 경로는 검증 못 했으므로 무유출 인증 아님.
- 독립 관측산술: 월급여 2,400,000원 × 12 = **28,800,000원**; 사업 순소득 1,000,000원 × 11 = **11,000,000원**; 합성 관측 합 **39,800,000원**. 누락 사업 12월을 0원 또는 100만원으로 **보간하지 않음**. VAT/종소세 총매출과 순소득, 승인 월소득은 별개의 피처·법률 판단.

## 4. 2026-11-01 공식 근거 / 관할·시행일

1. **서울회생법원** 2026-10-01 보도자료: **실무준칙 제424호 제2조 제2항 제7호 신설** 공지만 확인. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . **개정전문 PDF 부칙·경과조치 및 개별 사건 적용일 미검증**. 서울 외 관할 자동 적용·단축기간 승인 금지.
2. **국가법령정보센터** `채무자 회생 및 파산에 관한 법률` **[시행 2026-10-02, 법률 제21490호]** 제611조(변제계획 내용 및 기간) https://www.law.go.kr/LSW/lsLinkProc.do?joNo=061100&lsNm=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0&mode=11 ; 제614조 인가요건 https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 사건 접수·기존 명령·경과규정별 최종 적용은 변호사 판단 필요.
3. **국세청** 일반 VAT 과세기간 반기(1~6월/7~12월), 간이과세자 통상 연간. https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 . VAT 과표를 개인회생 인정 월순소득으로 직접 대체 금지.

## 5. ID별 상태·다음

- **A2-DATA-006 [ ]** 급여 지급처·원천 ID·귀속월: 비문자 source ID/stream ID에서 예외를 재현→#125 검토보류 후보; 실제 원천은행/직장/Fact/typed 대응 미실행.
- **A2-DATA-007 [ ]** 사업 월 자료와 VAT/세무 비교: `historical_tax_comparison`/임의 역할의 완료 오판을 재현→#125 후보; 정상 사업소득/계절소득 인간 승인 기준 미확정.
- **A2-DATA-018 [ ]** 서식 토큰별 원천 연결: 내부 5키는 공개 18템플릿 등록 0건, 실제 DOCX 무유출 보증 아님; #122 사전검사 우회와 #125 source 검토 게이트 결합 종단 미실행.
- **A2-DATA-020 [ ]** `null`/number0/문자열`"0"`/잘못된 comma Fact/미승인 역할 분리, 본문 V8 합성 20/20; 실제 Fact 저장/SQL값·전체 계산·공식 문서 재검증 미인증.
- 다음 **A2 r50 AX담당자**: #119→#122→#125 / #106의 실제 Node 통합, source reviewer approved per-stream windows를 법률상 승인과 분리, `document-writer` D5103만 검사하는 조건과 D5110/D5111 독립 생성 시 안전성 검증. SQL `value_json`/`value_won` 및 Fact JSON shape 검증을 42 resultPaths 전체로 확대. P0 기준판본 과거 head 덮어쓰기 별도 미해결.

**이번 제품 합격 0건**. 정식 Node 테스트/전체 CI/staging D1·R2·Cron/실제 DOCX·법원 공식 서식 동등성/변호사·계산사무장 승인/사이트 배포 모두 별개 **미인증**. 운영 배포·운영 D1 migration·전자제출·법원 인가 확정 **실행하지 않음**.
