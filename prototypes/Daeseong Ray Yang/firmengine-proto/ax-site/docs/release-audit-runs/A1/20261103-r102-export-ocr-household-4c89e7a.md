# FirmEngine A1 — 102차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-03 KST)

- 작업 범위: `firmengine/firmengine`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 지난 101차 사용자·서류/변호사/데이터 이후 **IT → AX → 계산사무장**으로 순환.
- 감사 시작 GitHub `main`: `4c89e7a73d14edab05278737795c4351d7406ee8`. 최근 커밋 r101 A1, r102 A2/A3 문서 반영 확인. 최근 Draft PR #24/#61/#77/#112/#191, 단일 인수 보드, 101차 영수증 및 `db/schema.ts` (blob `933f8686845ac14669312dd21bf85e02c62ed5e6`), 기존 `tests/pipeline-audit.test.ts`(blob `71cf7c848a4df81c74b0a124444b85aba798950a`)와 해당 PR의 테스트 경로를 확인함.
- 본 회차 **A1-IT-009, A1-AX-009, A1-CALC-009 전부 [ ] 미인수**. 기존 검증·Draft가 있는 결함의 확대 재현이므로 신규 결함으로 중복 집계하지 않음.
- **실제 실행 범위:** GitHub에서 읽은 `main`/Draft 원본 함수의 TS 선언만 제거하여 Code Mode V8 `Function`으로 평가; 외부 R2/SQL/manifest, FieldReviewCheck 및 CaseData/CalculationResult는 *합성* 입력. `extraction.ts`의 `checksFor/validAgreement/recordCategoryStatus/canonicalKey` 의미를 원본과 맞춰 제공하고 `structuredClone`은 JSON 객체 합성치에 한정해 JSON clone으로 대체. 노드/테스트 러너/브라우저/D1/R2 실제 API는 실행하지 않음.
- IT 첫 실행의 일부 기대값은 구현 상태와 테스트 기대 상태를 혼동해 **무효 폐기**하고 기대 상태를 정정한 별도의 실제 재실행 8건만 산입. AX 첫 TS 변환 오류 및 structuredClone 미지원 시도는 실행 성공으로 산입하지 않음.

## A1-IT-009 [ ] — R2 실패 / DB·manifest 정합성과 성공 응답

- 실제 `lib/export-artifact-transaction.ts`, `main` blob **`a114235e5b5de57b5ae58b41026f939ee8543174`**에서 `commitExportArtifactTransaction` 본문과 정리 helper 실행.
- 합성 2개 객체 `a,b`와 D1 레코드 2건, manifest 1개. 8조건의 **현재 main 7/8 독립 기대 일치**:
  1. 정상: resolve, R2=2, D1=2, manifest=1 → 일치.
  2. 첫 R2 PUT 실패: reject, R2=0, D1=0, manifest=0 → 일치.
  3. 둘째 R2 PUT 실패: reject, 앞서 올라간 객체도 정리되어 R2=0, D1=0 → 일치.
  4. D1 persist 거부: reject, 정리 후 R2=0, D1=0 → 일치.
  5. manifest 명시적 CAS 거부: reject, R2=0, D1=0, manifest=0 → 일치.
  6. **manifest 실제 commit 성공 후 ACK만 유실:** 기대는 응답 reject라도 이미 commit된 R2=2,D1=2,manifest=1을 **보존**하는 것. 실제 **R2=0,D1=0,manifest=1** → **P0 기존 결함 재현**.
  7. post-commit audit 실패: reject, R2=2,D1=2,manifest=1 보존 → 일치.
  8. 정리 동작 2건 실패: reject, 부분 정리 R2=1,D1=2,manifest=0, cleanup error=2 보고 → 일치(고아 항목 발생은 별도 회수 정책 필요).
- **주의:** helper는 *R2 업로드→DB persist→manifest commit* 순서. 따라서 여기서 별도 `D1 먼저 성공 → R2 뒤 실패` 경로 또는 HTTP 성공/실패 전이는 재현한 것이 아니다. 기존 [Draft #24](https://github.com/firmengine/firmengine/pull/24)와 [#61](https://github.com/firmengine/firmengine/pull/61) 수정안을 확인했으나 이번 회차 실제 실행 없음. 실제 staging D1/R2, worker, 트랜잭션 경합은 미인수.

## A1-AX-009 [ ] — OCR 복수 거래행의 누락 재판독 오병합

- 원본 `lib/extraction.ts` `preserveAgreedFieldsAfterOmission` 실제 함수 실행: `main` blob **`75931aad3fc7871395e62276bb5533e24b15d1a5`**, [Draft #77](https://github.com/firmengine/firmengine/pull/77) blob **`1a7c52f179442ad739526567854f86dbd0fbb605`**, [Draft #112](https://github.com/firmengine/firmengine/pull/112) blob **`8fa59a8e7eab45131de2a8bf2d5d4d207ea544b1`**. 각 8조건 동일 입력, **main 6/8, #77 7/8, #112 7/8** 독립 기대 일치.
- 합성 거래 R1 = 계좌 AC1, 금액 100원 / R2 = 같은 계좌 AC1, 금액 200원. 새 판독엔 같은 계좌의 1개 거래만 있고 금액 미관측. 독립 기대: **과거 100/200 어느 값도 새 거래에 이식 금지**, `complete=false`, 금액 null. 실제 main: `complete=false`이지만 **100을 새 행에 이식**; #77 동일, #112에서 이식 차단.
- 과거 단일 무식별 거래 금액 100원, 새 단일행은 금액도 row anchor도 없음. 독립 기대: 금액 null, `complete=false`; main과 #112는 **100을 이식하고 complete=true**, #77은 차단.
- 유일한 거래 ID T1으로 양쪽 판독이 특정되면 금액 100 유지; 유일 ID T1/T2 중 T2 누락이면 `complete=false`; 같은 ID의 새 판독 금액 999는 기존 100을 덮지 않고 검토보류; anchor 없는 2개 후보·category unclear은 검토보류; 명시적 0원은 0 보존. 이 6개 조건은 main·#77·#112 모두 기대 일치.
- **#77/#112는 같은 `extraction.ts`를 수정하고 각각 다른 반례만 해결한다.** 임의 자동 병합 금지; 공통 row anchor의 유일성 + 무식별 단일행 이식 금지를 함께 구현·테스트할 통합 PR과 실제 PDF/DB 중복거래 검증 필요. `complete=false`라도 잘못 복사된 값은 안전하다고 간주하지 않음.

## A1-CALC-009 [ ] — 상충/미승인 가구인정 상태의 계산 adapter 승격

- 원본 `lib/calculation-adapter.ts` `adaptCalculationInput` 실제 함수 실행: `main` blob **`556ef86b887d1d729af2c56d071211c74b4d5e46`**, 기존 [Draft #191](https://github.com/firmengine/firmengine/pull/191) blob **`8ea9720ec4e2a3a5d665e6623f3757968ea6eb66`**.
- 합성 데이터: context revision=5/planMonths=36, 인정 가구원=2, 인정 상태 accepted, 계산 결과 소득=300원/생계비=100원/예산=200원, trace 정상. 11조건 실행. **main 8/11, #191 11/11 독립 기대 일치**.
- 정상 결과 ready, stale revision blocked, income null blocked, living cost null blocked, 중복 추가 생계비 provisional, provisional trace provisional, planMonths null not_applicable, 소득 `"0"`의 명시적 수치 보존 모두 기대 일치.
- **recognizedMembers=null / household.recognition=unreviewed / recognition=rejected**인데도 계산 결과 숫자를 조작해 전달하면 main은 각각 **ready**, 독립 기대는 적어도 **not ready**(승인 전·상충·반려 구분). #191은 이 3조건 모두 `provisional`과 별도 warning 생성. 단위 합성 경계 검증이지 `calculateCase`가 이 모순 상태를 생성함을 증명하지 않는다.
- #191 수정은 *계산 adapter 경고*일 뿐 법원의 인정 인원/추가 생계비를 판정하지 않음. 실제 가구 인적사항·증빙·18계산 trace·95법률·서식/변호사 검토 필요.

## 변경·독립 인수 경계·다음 순환

- 이번 회차 **제품 코드 조치 없음**: 동일 경계에 기존 Draft #24/#61, #77/#112, #191이 있어서 중복 패치 금지. 그 PR들의 실제 Node 회귀·타 기능과 충돌·staging은 미검증. 본 영수증과 보드 3개 ID만 `main` 갱신 예정.
- 현재 main **21/27** 합성 기대 일치(IT 7/8 + AX 6/8 + CALC 8/11). *프로덕트 점수 아님*. Draft 별 산입과 공식 인수는 별개.
- 단계별 미관찰 / null / 명시적 0 / 비해당 / 상충 / source-only / 승인 전을 분리. 합성 계산의 `ready`도 법률 확정값, 변호사 승인 또는 사이트 배포가 아님.
- 다음 순환 **사용자·서류담당자 → 변호사 → 데이터담당자**: **A1-DOC-010**(갈음 A←B+C·문서 결손/교체), **A1-LAW-011**(법원 보정명령 판본·사람 승인), **A1-DATA-010**(동시 사건의 원문·Fact·typed 격리). 다음 회차 시작 전 보드 ID 의미를 다시 확인.
- 상담→요구서류 85→OCR→정규화→18계산→95법률→자동초안/직원 검수→보정명령, C01/C02/C04, 공식 서식·변호사 승인·동시사건·staging D1/R2/Cron·Node/TS/CI·실제 법원 제출 **전체 종단 검증은 수행하지 않음, 합격 0건**. 운영 배포·운영 DB 마이그레이션·실제 전자제출·법원 인가 확정 실행 없음. Extra High 추론 모드의 실제 설정은 확인되지 않음.
