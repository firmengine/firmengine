# A2 r122 — AX담당자: 제424호 최초 접수일 프록시 및 계산상태 원천 계보

**2026-11-04 14:12 KST. 시작 main `26dbce83997f917c44a10e9764f75c4371e4b8eb`**. r121 데이터담당자 → **r122 AX담당자** → r123 IT담당자. 변경 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`; 모두 비식별 `SYN-*` 합성데이터. A2-AX-004, A2-AX-007, A2-AX-014, A2-AX-015 **전부 [ ] 부분검증, 제품 인수 0건**.

## 원본 코드·스키마·기존 영수증 검토
- main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`: `createCase` 기본값 `applicationDate=asOf`, `courtId="seoul"`, Facts/문서 0, 법률 적용 승인=false.
- main `lib/legal-proposals.ts` blob `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`: `appDate=data.context.applicationDate` → `evaluateSeoul424({firstFilingDate:appDate||null,courtId:data.context.courtId||null,...})`. 최초 법원 접수증 Fact/사건귀속/검토승인 계약은 호출 지점에 없음.
- main `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`, 미병합 Draft [#230](https://github.com/firmengine/firmengine/pull/230)의 후보 blob `92f1bc09d35062da1bb3328fcb3a930050dcfb96`.
- main `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`: `statusOf` 및 `won` 실제 함수본문 대조. 원천 Fact와 계산 aggregate 실패 원인의 연결을 추가 확인해야 함.
- `lib/reference-parameters.json` blob `e57a9d7c99efe052d4581d780ed478d876eb3330`: 동적 참조 원본 읽고 V8 비교에 사용. `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: runs/features/heads 스키마 재독. 이번 회차 실 SQL 저장은 미실행.
- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 실제 JSON 파싱: 18모듈, 입력 91선언/78고유, 출력 42선언/40고유, resultPaths 42/42고유. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 실제 JSON 파싱: D5103=37, D5106=48, D5110=55, D5111=82 토큰. 선언량은 전체 실행검증 아님.
- 이전 [r121 영수증](2026-11-04_r121_1312KST_data-filing-default-blocked-zero-sql.md), r120 및 Draft [#234](https://github.com/firmengine/firmengine/pull/234) 읽기검토. 제품 코드 및 Draft 병합 없음.

## A. 실제 `evaluateSeoul424` 원본문 V8 15 합성 시나리오
TypeScript 타입 선언/nonnull 표기만 벗겨내고 실제 main과 #230 함수본문 실행. 참조값은 main 파라미터 JSON의 동일 ID 값. 보수적 독립 기대: 원천/관할/형식 미확인은 `unknown`, 증거 있는 적합조건은 `candidate_for_human_review`(법률승인 아님). **main 7/15 기대일치, Draft #230 15/15 기대일치**. 프로젝트 Node 테스트/CI 미실행.

| 합성 입력 변경 (기본: 서울, 2026-10-01, 모든 긍정 요건에 SYN Fact) | 독립 기대 | main 관찰 | #230 관찰 |
|---|---|---|---|
| 정상 긍정 | candidate_for_human_review | candidate_for_human_review | candidate_for_human_review |
| 관할 `null` | unknown | **candidate_for_human_review** | unknown |
| 관할 `""`/`"  "`/`" seoul "` 3건 | unknown | **not_applicable 3건** | unknown 3건 |
| 명시 `busan` | not_applicable | not_applicable | not_applicable |
| 접수일 `null` | unknown | unknown | unknown |
| 접수일 2026-09-30 | unsupported_version | unsupported_version | unsupported_version |
| 접수일 `2026-10-32` | unknown | unknown | unknown |
| 제1~6호 yes, Fact ID 빈 배열 및 제7호 미관찰 | unknown | **candidate_for_human_review** | unknown |
| 급여 Fact ID 없음 | unknown | unknown | unknown |
| 채무 sourceValidated 문자열 `"false"` | unknown | **candidate_for_human_review** | unknown |
| 채무 Fact ID 공백 및 중복 (2건) | unknown | **candidate_for_human_review 2건** | unknown |
| 제1~6호 yes + 유효 SYN Fact ID | candidate_for_human_review | candidate_for_human_review | candidate_for_human_review |

**중요:** #230은 타입·형식 가드이지 `firstFilingDate`와 실제 법원 최초 접수증의 원천 연결이 아님. 따라서 15/15를 법률상 적용 승인으로 승격 불가.

## B. 실제 `createCase` 함수 V8 3개 합성
`createCase("SYN","SYN-CASE-날짜",asOf)` 원본문 실행:

| asOf | 생성 applicationDate·courtId | Fact·문서·승인 |
|---|---|---|
| 2026-09-30 | 2026-09-30 / seoul | 0 / 0 / false |
| 2026-10-01 | 2026-10-01 / seoul | 0 / 0 / false |
| 2026-11-04 | 2026-11-04 / seoul | 0 / 0 / false |

3/3 코드 관찰. 이것은 접수증 확인이 아닌 생성시점 대용값. 이 값이 `buildLegalProposals`를 통해 판본 경계를 결정할 수 있으므로 **P1 법률 적용 위험 후보**. 다른 법률 게이트가 있으므로 초기값만으로 후보가 승격된다는 주장 아님. 고위험 데이터 의미/법률 규칙 변경은 별도 PR+실무자/변호사 승인이 필요해 임의 수정하지 않음.

## C. feature-store 실제 `statusOf`/`won` V8 12개 관찰
| 합성 값·상태 | 실제 status / 원화 | 인수 검토 |
|---|---|---|
| `"0"`, computed | computed / `"0"` | 명시적 0 가능 |
| `0` 또는 `"0"`, blocked (2건) | provisional / `"0"` | 개별관찰 0 vs 막힌 집계의 임시 0 계보 불명 |
| null, blocked | blocked / NULL | 미산출은 0이 아님 |
| null 또는 `"unknown"`, computed (2건) | missing / NULL | 미관찰 |
| `"0010"`, computed | computed / `"0010"` | 비정규 원화 문자열 형식 문제 |
| `"1,20"`, computed | computed / NULL | status와 원화타입의 검증 부족 |
| `"0"`, computed + SOURCE_CONFLICT | conflict / `"0"` | 상충 금액을 승인 0과 구분 |
| `"0"`, not_applicable | not_applicable / `"0"` | 비해당는 관찰 0이 아님 |
| 안전정수 초과 숫자, computed | computed / NULL | 정밀도 부족 |
| `"100"`, computed, 비원화 필드명 | computed / NULL | 비금액 유지 |

12개 관찰 재현, 수정 없음. `blocked` aggregate 실패의 임시 0과 실제 개별 원천 0의 의미를 서식까지 분리한 E2E는 미관찰. 위 보수적 해석은 제품 계약 검토 필요이므로 단순 코드 결함으로 확정하지 않음.

## D. 산술·공식 원문
- 독립 BigInt: 합성 월매출 3,000,000 − 필요경비 1,000,000 = 2,000,000원/월. 36/48/60개월 단순 곱 = 72,000,000 / 96,000,000 / 120,000,000원. **실제 계산엔진 산출 비교는 미실행**, 법원 인정순소득/변제액 아님.
- 서울회생법원 [2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187) 직접 확인: 제424호 제2조 제2항 제7호 신설. 개정전문 부칙은 이번 실행에 **직접 PDF 재독 없음**; [r120](2026-11-04_r120_1212KST_law-424-appendix-source-only.md)에서 2026-09-23 개정/2026-10-01 시행/시행 이후 최초 접수 사건 적용 확인한 증거 인계.
- 국가법령정보센터 [채무자회생법 제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 법률 제21490호 **2026-10-02 시행판** 원문 확인. 기간 및 청산가치/인가 판단과 계산 계약 분리.
- [국세청 VAT 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 6개월, 간이과세자 원칙 1년. 신고매출/종소세는 source-only, 승인된 월순소득으로 자동 승격 금지.

## ID·수정·후속
- **A2-AX-004 [ ]:** 12조건 원화 상태 관찰, 원천/Fact/typed/SQL→서식 승인 경계 미완.
- **A2-AX-007 [ ]:** 제424호 main 7/15·미병합 #230 15/15, 접수증/관할 소유·승인 미완.
- **A2-AX-014 [ ]:** createCase 3/3/법률 전달라인에서 근거 없는 접수일 프록시; 최초 접수 Fact/법원/사건 귀속을 검토하지 않음.
- **A2-AX-015 [ ]:** 정적 18/91/42/42, 법원 토큰, 독립 단순 산술. 전체 계산모듈/실 DB/실 DOCX 미완.
- **이번 GitHub 수정은 영수증+해당 중앙 보드 네 ID만**. 제품 코드/PR/테스트 파일 신규 수정 0건. Node/CI, staging D1·R2/Cron, 공식서식, 변호사 승인, 운영배포, 법원인가 모두 미실행·미인증.
- **다음 r123 IT담당자:** 최초접수 Fact/사건귀속/관할/인적 승인/판본을 묶은 스키마 계약→Draft #230과 전체 Node 테스트로 검증. `blocked→임시0→SQL feature→D5103/D5110`의 실제 reader/서식 토큰 소비 E2E 검증. #229/#233/#234 등 병렬 Draft 충돌 방지.
