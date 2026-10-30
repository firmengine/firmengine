# FirmEngine AX — A2 7차: 검토완료 변제일 누락·D1 계산실행 단일행 크기 (2026-10-30 19:14~19:23 KST)

## 0. 검사 범위와 사전 대조
- GitHub 저장소 `firmengine/firmengine`, 최초 및 패치 베이스 main HEAD `a40c83b7a0a4039ab8a1131038a5da8cf16b2081`. 변경 범위는 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- 이번 회차 체크 ID: `A2-LAW-022`, `A2-CALC-026`, `A2-DOC-005`, `A2-IT-011`, `A2-DATA-024`. 변호사→계산사무장→서류담당자→IT→데이터 관점을 순환했다. 모든 체크박스 `[ ]`/제품 인수 완료 0건.
- 이전 [A2 6차](2026-10-30_1814_KST_output-replay-missing-rows.md)의 계산 저장행 누락 P1 Draft PR #33 및 A2 5차 PR #29(원금·이자 누락)·4차 PR #25(월말 분할 날짜)를 확인했다. 동시에 main의 A1/A3/A4 최근 커밋과 현재 열려 있는 Draft PR #12~#36, 관련 실제 source/test/schema를 조회했다.
- 실제 대조 파일: `lib/repayment-plan-model.ts`, `lib/plan-reconciliation.ts`, `lib/payment-schedule.ts`, `lib/context-validation.ts`, `lib/case-calculation-feature-store.ts`, `lib/preapproval-calculation-replay.ts`, `lib/form-mapping.ts`, `lib/office-writer.ts`, `db/schema.ts`, `drizzle/0011_case_calculation_features.sql`, `drizzle/0021_workflow_only_source_watch.sql` 및 기존 해당 tests.
- **실제 Node 전체 프로젝트 테스트/npm ci/Cloudflare staging D1·R2/Cron/D5110 Word 바이트/법률전문가 검수/배포는 이번 회차 실행하지 못했다.** 아래 격리 실행을 혼동하지 않는다.

## 1. P1 발견 — 검토완료 변제일 누락이 배분 정합 PASS
- 대상 `lib/plan-reconciliation.ts`: `paymentSchedule.reviewed=true`이고 `PlanLedgerRow.paymentDate=null`인데도 산술 배분액과 월예산이 맞으면 `reconcilePlanLedger`가 `reconciled`를 반환했다. 원천 `repayment-plan-model.ts` 또한 `firstPaymentDate`가 없는 수기 검토일정을 `complete`로 반환할 수 있으며, `context-validation.ts`에서 첫 변제일 필드는 optional이다.
- **합성 입력(실제 function body V8 격리, TS 타입구문만 제거)**: 임의 채권 D 원금 20원/이자 0원, 2개월 월 10원, trustee fee 0원, 단위 원, reviewed=true, 1월·2월 `paymentDate=null`. 독립 기대 `blocked`; 패치 전 실제 `reconciled`/issue 없음.
- 한 개만 결측(1월 31일 있음, 2월 날짜 null): 기대 `blocked`, 패치 전 `reconciled`. 날짜 둘 다 있음(1/31,2/28), 인정된 실제 0원과 날짜 정상, 미검토 날짜 없음 각각 기존 결과 유지.
- 수정: `paymentSchedule.reviewed=true`인 경우 **실제 planLedger 행에서 결측 날짜가 발생한 회차만** `REVIEWED_PAYMENT_DATE_MISSING:<installment>`를 쌓아 `reconciled`를 차단. 재량에 따라 납부일을 AI가 생성하거나 법적 제출기한을 정하지 않음. 일반 draft/검토 전 스케줄의 무기일은 자동 인정하지 않으며 별도의 `provisional` 상태를 보존.
- 격리 함수 본문 **패치 전/후 합성 5건**: 두 날짜 누락 `reconciled→blocked`, 한 날짜 누락 `reconciled→blocked`, 정상일 `reconciled`, 실제 0원 `reconciled`, 미검토 무기일은 기한오류 추가하지 않음. **패치 후 5/5 기대 일치.**
- 격리 실행은 Github main에서 받은 실제 함수 본문의 TS 타입만 제거한 V8 실행이며, **TypeScript 전체 빌드/Node 프로젝트 테스트를 실행한 것은 아니다.** 합성 Node 회귀 소스 5개 추가만 완료.
- 별도 **[Draft PR #37](https://github.com/firmengine/firmengine/pull/37)**: 브랜치 `fix/a2-reviewed-repayment-dates-20261030-1914`, 코드 `lib/plan-reconciliation.ts`, 신규 `tests/a2-reviewed-schedule-date-reconciliation.test.ts`. 작업 커밋 `1a53c88c44176f7e0c249a166870b35654d19e97`, `8d9c830cd9d3af87452a27d55bcffd866140d1f5`. **main 미병합**.
- **PR #25/#29 영향**: 두 PR 모두 `repayment-plan-model.ts` 변경, 실제 patch 범위는 #29 초기 누락검증 가드와 #25 후속 일자 앵커에서 달라 단순 동일라인 충돌은 보이지 않았다. 합본 병합 가능성/Node integration/변제원장+서식 날짜 E2E는 **미검증**. #37은 해당 파일을 건드리지 않는다.

## 2. P1 발견 — 2개 JSON의 단일 D1 row 크기 상한을 각각만 검사
- `drizzle/0011_case_calculation_features.sql`에서 `case_calculation_runs` 한 행에 `raw_result_json` 및 `source_heads_json`이 함께 저장됨을 확인.
- `lib/case-calculation-feature-store.ts` 기존 검사: `raw_result_json <= 1,900,000 bytes`, `source_heads_json <= 1,000,000 bytes`를 **개별**로 검증. 두 값 합계의 최대 2,900,000 bytes와 기타 칼럼은 D1 table row 최대 2,000,000 bytes를 넘길 수 있다.
- 독립 합성 오라클: ASCII payload raw=1,600,000 bytes/source=400,000 bytes는 기존 허용 조건이 참이지만 두 필드만으로 2,000,000 bytes. 기타 SQL 칼럼 포함 실제 행 상한 초과 위험. 1,700,000+200,000은 여유 포함 경계 통과, +1 byte는 차단되어야 함.
- 수정: **두 문자열 합계 <=1,900,000 bytes**를 추가하고 기존 개별 상한을 유지하여 100 KB를 나머지 컬럼에 남긴다. 실패코드는 기존 `CALCULATION_FEATURE_RESULT_SIZE_LIMIT`. 세무·법률·회계상 금액값은 수정하지 않음.
- `node --test /tmp/firmengine_a2_row_budget_isolated.mjs`로 브랜치 순수 함수와 동일한 본문에서 TypeScript 타입만 제거해 **Node v22.16.0 격리 5/5 통과**, 총 ~79ms: 정상/두 필드 합계 과대/개별 초과/정확 경계/한글 UTF-8 byte 경계. 이는 **GitHub에 추가한 테스트 파일 자체의 프로젝트 실행이 아닌, 동일 순수 함수 본문 별도 실행**이다.
- 별도 **[Draft PR #38](https://github.com/firmengine/firmengine/pull/38)**: `fix/a2-d1-calculation-run-row-budget-20261030-1921`, 코드 `lib/case-calculation-feature-store.ts` 및 `tests/a2-calculation-run-d1-row-budget.test.ts`. 코드 커밋 `60e56391351649d309479acd82761a59677fe9ae`, 테스트 커밋 `37ff0a9966642a58db5f0acbd1f3a56f7a1a1f7f`. **main 미병합**.
- Cloudflare 공식 D1 limits (2026-10-24 갱신): https://developers.cloudflare.com/d1/platform/limits/ — 행/문자열 한도 2,000,000 bytes·쿼리 bind 100개·실행 30초. 중요한 예외: `db.batch()` 내부 여러 SQL 명령은 **Worker subrequest 1회**로 계산하므로 5천행의 834 INSERT statements를 Free 50 subrequest 한도 위반으로 잘못 판정하면 안 됨.

## 3. 5,000/5,001 행·42 output 경로 잔여 검증
- `case-calculation-feature-store.ts` **실제 `inserts()` 함수 본문**(TS 타입만 제거) V8 실행: SQL 13열, 한 query에 6행씩(`Math.floor(90/13)=6`), **5,000행→834 INSERT statements, 최대 bind 78개**. 5,001행은 단순 생성 함수에서도 834 statements이지만 `persistCaseCalculationFeatures`의 `rows.length>5000` 코드 가드에 의해 사전 거절되어야 함. **최종 저장 함수 자체를 5,001행으로 호출한 실행은 하지 않았다.**
- `case_calculation_features` 표의 `output_path`, `value_json`, `value_won`, `row_ordinal`, `source_fact_ids_json`, `input_refs_json`, `formula`의 실제 SQL/Drizzle 선언 및 테스트 설계를 확인했다.
- 18계산·91입력 선언(78 고유)·42 이종 result paths의 **실제 계산→42개 경로→DB insert/re-read→Word 서식** 전체 실행은 아직 없다. 특히 `[Draft PR #33](https://github.com/firmengine/firmengine/pull/33)`의 저장 출력행 누락 검출이 미병합이며, 현재 main의 `auditStoredCalculationReplay`는 비어 있는 행을 정상으로 판정할 수 있는 기존 결함 상태다.

## 4. 공식 법률·세무 및 인수 경계
- 국가법령정보센터 `채무자 회생 및 파산에 관한 법률` **[시행 2026.10.2., 법률 제21490호]** 공식 조문 페이지 확인: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027010029 . 개별 신청일·법적 경과규정은 실무자 검토가 필요.
- 서울회생법원 보도자료 목록 **「개인회생 변제기간 단축 대상에 관한 실무준칙 개정」 게시 2026.10.01** 확인: https://slb.scourt.go.kr/dcboard/new/DcNewsListAction.work?gubun=172 . 제424호 제7호 적용에 대해 **코드 자동판정·기준정보 강제변경 없음**; 상세 공식 준칙 원문/사건 접수일/관할의 최종 전문가 확인 미인증.
- 국세청 부가가치세 안내에서 일반과세자 6개월·간이과세자 1년 신고기간과 과세자별 세액 산식 차이 확인: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 . VAT 매출·매입세액은 곧바로 사업 순소득이 아님. 이번 패치는 수입/경비/세무처리/소득 인정 산식에는 영향을 주지 않는다.
- **법원 공식 D5110 실제 DOCX/전자소송 필드 대조, 날짜 법률 적합성, 변호사 독립승인 모두 미실행**. 인수 승인 0건, 실제 제출/인가 없음.

## 5. 체크 ID 결과 및 다음 액션
| ID / 역할 | 이번 관찰 | 상태 |
| --- | --- | --- |
| `A2-LAW-022` 변호사 | 검토완료인데 납부일 null인 수기 계획의 법률상 확정처럼 보일 수 있는 내부 게이트 결함; PR #37 | 부분, [ ] |
| `A2-CALC-026` 계산사무장 | 2개월 정상/무기일/0원 경계 및 #25/#29 같은 파일 패치 범위 분석; 36·48·60 실제 E2E 미진행 | 부분, [ ] |
| `A2-DOC-005` 서류담당 | 날짜·계획 금액의 D5110 출력 연계 코드 확인, 실제 Word 바이트/공식 서식 미확인 | 부분, [ ] |
| `A2-IT-011` IT | 5,000행 INSERT 834문장/최대 78 bind 독립 V8, 5,001행 엔진 가드 정적; 결합된 2 JSON의 2MB 경계 PR #38 | 부분, [ ] |
| `A2-DATA-024` 데이터 | 0011 SQL/Drizzle/원문→계산→저장 관계 조사, 실제 SQLite/D1 5천행 round-trip은 미실행 | 부분, [ ] |

**다음 A2 8차 시작**: (1) #37/#38 새 회귀 실제 프로젝트 Node22 실행/빌드 가능 여부, (2) #25/#29 합본 날짜·채권잔액 경계 결합회귀, (3) `A2-DATA-024` SQLite 5,000/5,001 실제 INSERT/읽기와 PR #33 누락행 대조, (4) A2-AX와 미검증 역할 순환, (5) D5110 36·48·60회차 Word 금액/날짜 서식 대조. 기준정보 승인·법원 접수/인가를 수행하지 말 것.

## 후속 검증 보완: D1 `missing_json` 포함 실제 INSERT 전 열 바이트 상한 (2026-10-30 KST)
- 동일 `case_calculation_runs` 행에는 `raw_result_json`·`source_heads_json`뿐 아니라 `missing_json` 및 13개 기타 식별/시각/상태 필드가 들어간다. 당초 2개 JSON 합계만 비교한 가드는 `missing_json`가 큰 경우에 D1 2MB 상한을 다시 넘길 가능성이 있었다. 앞선 두 필드 합계 검사에 대한 설명은 **초기 제안 범위**이며 아래가 현재 PR #38 개선안이다.
- [Draft PR #38](https://github.com/firmengine/firmengine/pull/38) 추가 커밋: 코드 `14c844b148a09412d10ee2755cb4f6f956ce4a85`, 테스트 `b4be3cc527dac8338b36235753639a68e4c5ea6e`. SQL INSERT의 16개 bound 값 중 `raw_result_json`·`source_heads_json` 외 14개 값을 UTF-8 byte로 함께 합산하고 **전체 1,900,000 bytes 상한**을 검사한다. 기존 두 문자열의 각각 제한도 유지하며 같은 `missingJson` 변수를 검증과 SQL 바인드에 재사용한다. 나머지 100KB는 SQLite 행 오버헤드 여유이다.
- 새 합성 조건: raw 1,500,000 + source 200,000 + missing_json/메타 250,000 bytes는 반드시 제한 오류, 메타 100,000 bytes는 합계 1,800,000으로 허용. Node v22.16.0의 격리 동일 순수 함수 본문(`TS` 타입만 제거) `node --test /tmp/firmengine_a2_row_budget_isolated_v2.mjs` 실제 실행 **6/6 pass, 0 fail**. 생성한 GitHub TypeScript 테스트 자체는 프로젝트 의존성과 빌드 환경에서 미실행, D1 staging 2MB 경계도 실제 확인 전이다.
- Cloudflare D1 공식 [제한 문서](https://developers.cloudflare.com/d1/platform/limits/) 최근 2026-10-24 업데이트: 한 행/문자열/BLOB 최대 2,000,000 bytes, 개별 쿼리 bind 최대 100, `db.batch()` 내부 statement 수에 무관하게 **한 Worker subrequest**로 계산. 이번 후속 패치는 계산 결과 값·법률·세무·법원 제출을 수정하지 않는다.
