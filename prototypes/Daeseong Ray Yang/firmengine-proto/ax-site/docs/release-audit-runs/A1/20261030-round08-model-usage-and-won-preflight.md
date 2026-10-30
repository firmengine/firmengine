# FirmEngine A1 8차 감사 — 법률 모델 비용 이중 호출 및 필수 원화 입력 차단

- **감사일**: 2026-10-30 KST, A1 정기회차 8. 검증 최초 main: `a1a57a915bd97c31de6c3143093322dcf559c4b2`. 문서 반영 직전 재확인 main: `a1a57a915bd97c31de6c3143093322dcf559c4b2`.
- **작업 범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만; 제품 전체 인수 완료 0개, 해당 체크 세 건 **부분검증 [ ]** 유지.
- **역할 순환**: 이전 A1 7차 서류담당자/변호사/데이터 → 이번 **IT(A1-IT-016), AX(A1-AX-012), 계산사무장(A1-CALC-017)**.
- **사전 교차 확인**: main HEAD·최근 18커밋·open Draft PR #12~#40, `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, A1 7차 영수증, `package.json`, `lib/pipeline.ts`, `lib/luna.ts`, `lib/case-legal-automation.ts`, `lib/case-agent-scheduler.ts`, `lib/case-legal-calculation-preflight.ts`, `lib/case-data-recompute.ts`, `tests/case-legal-automation-flow.test.ts`, `tests/case-legal-calculation-preflight.test.ts`, `tests/case-data-recompute.test.ts` 등 확인. 관련 현재 main 직접 수정 없음.

## A1-IT-016 — 최신 CI/타입·lint·빌드·회귀 영수증

- `package.json`은 Node `>=22.13.0`; `check:source`, `lint`, `build`, `check:product`, `test:legal-auto` 스크립트가 **등록**되어 있다.
- GitHub Actions `GET /repos/firmengine/firmengine/actions/runs?branch=main` 조회에서 **총 실행 0건**(조회 시점). 워크플로 파일 존재나 프로젝트 외부 CI는 별도로 확인하지 못했다. 실행이 0이라는 것은 소스 검사 합격의 증거가 아니다.
- 실행환경 Node `v22.16.0`은 확인했으나 이 컨테이너에서 GitHub clone은 DNS 접근 실패로 불가. **최신 전체 `npm ci`, `npm run check:source`, `npm run lint`, `npm run build`, `node scripts/run-preapproval-regressions.mjs --full`은 미실행**.
- 단, 이번에 작성한 보조 함수와 회귀 테스트 **동일 본문**을 별도 임시 폴더에서 Node 22.16.0 `--experimental-strip-types --test`로 **3/3 통과**. 이것은 프로젝트 CI가 아닌 격리 실행 증거.

## A1-AX-012 — 유료 법률 AI 후 부가 이벤트 실패로 동일 작업 재과금 위험 (P1)

**원본 문제**: 현행 `lib/pipeline.ts::reviewLegal`에서 `callLuna<Advisory>()`가 성공한 뒤 `await event(caseId,"model.call",usage)`의 SQL/로그 오류가 발생하면, **법률 자문행 `analyses`에 95-check 결과가 저장되기 전** 예외로 종료한다. 이후 같은 원본/계산버전 재시도는 이전 완료 체크를 찾지 못해 다시 모델 요청을 보낸다.

**실행 재현**: 실제 main의 `reviewLegal` 함수본문을 TypeScript 타입 선언만 제거하여 V8 실행, D1·모델 호출은 개인정보 없는 stub으로 치환. 단일 `risk-synthetic` 합성 체크를 이용했다. 첫 호출은 유료 응답 성공→`model.call` 이벤트 저장 실패, 같은 case/revision/dataVersion/ref/입력 해시로 두 번째 실행.
- 기대: 모델 요청 최대 **1회**; 실패 로그가 법률 결과를 폐기하지 않아야 함.
- 기존 실제 관찰: 첫 `Error: SYNTHETIC_D1_AUDIT_EVENT_FAIL`, 두 번째 다시 `callLuna`, **모델 API 호출 경로 2회**, 최종 자문행 1회. **실제 OpenAI API 과금이 2건 발생했다고 주장하지 않는다.**
- 개선 **[Draft PR #42](https://github.com/firmengine/firmengine/pull/42)**: 독립 `recordBestEffortLegalUsageEvent`에서 보조 usage event 실패를 불리언 경고로 반환하고, `analyses.payload`에 모델 usage 원본과 `usageEventWriteFailed`를 명시하여 결과/비용근거를 먼저 잃지 않도록 함. 법률결과·근거/승인/모델 선택·수치 계산은 변경하지 않음.
- 브랜치 `audit/a1-r08-legal-model-usage-event-20261030`, HEAD `b275f3608b3395dbf5cc368a517f0f15a5f5b1d7`.
- 실제 PR 브랜치 `pipeline.ts`/helper 함수본문 V8 재실행 **4개 검증**(helper 성공/실패 + 전체 법률 모델 이벤트 정상/실패): 실패경로 모델 **1회/자문행 1회/`usageEventWriteFailed=true`**, 정상경로 **1회/1회/false**.
- 보조 함수 동일 본문 Node 22.16.0 격리 **3/3 PASS** (성공/거부/동기 예외), 프로젝트 실제-import 테스트 파일 작성·전체 CI 미실행.
- **잔여 위험**: 공급자 API 응답 ACK 자체 유실, API 성공 후 `analyses` INSERT 실패, lease 만료 중 동시 실행의 exactly-once 비용 보장은 **여전히 미보장**. 추후 provider 요청 receipt/외부 idempotency, durable job outbox 및 실제 이중 worker D1 시험이 필요하다. 본 PR을 완전한 무중복 과금 보증으로 표현하지 않는다.

## A1-CALC-017 — 잘못된 필수 계산 원화 값으로 법률 AI 조기 호출 (P1)

**원본 문제**: `lib/case-legal-calculation-preflight.ts::evaluateLegalCalculationPreflight`은 승인된 필수 `monthlyIncomeWon`의 `status=computed`와 빈 값 여부만 확인했다. 실제 함수본문 V8 격리에서 `value_json`이 숫자가 아닌 문자열 `"not-a-won-value"`, `"1.5"`, `"1e9"`, 공백, `false`, 배열, JS 안전정수 초과인데도 **ready=true**. 실제 악성/마이그레이션 오류가 저장된 것처럼 꾸민 synthetic 테스트이며 정상 계산엔진의 자동 유입까지 입증한 것은 아니다.
- 기대: 승인 필수 원화 출력은 정수 KRW 값만 수용; 진짜 0원은 missing/승인전과 구분.
- 기존 main 실제 함수본문 V8 **11조건 중 7개 결함 불일치**, 나머지 4개 기대 일치.
- 개선 **[Draft PR #41](https://github.com/firmengine/firmengine/pull/41)**: `*Won` 출력에만 정수 문자열 또는 안전정수 number 타입을 요구, `"0"`·정상 음수·거액 정수 문자열 허용, 비금액 필드는 기존 계약 유지. 법률 판단·서식·산식 수치 무변경.
- 브랜치 `audit/a1-r08-required-won-preflight-20261030`, HEAD `3e6a673789e06e984bdffd9d8e4180ad351f4626`.
- **수정 본문 V8 14/14** (부정 8, 유효 5, 비금액 1) 기대 일치. 신규 동일 조건 Node 테스트 소스 작성, **원본 프로젝트 Test Runner·staging 실제 DB는 미실행**.
- PR #41/#42의 실제 브랜치 함수본문과 helper를 **독립 재조회하여 V8 교차검증 10/10** 기대 일치: 필수 원화/예외 및 이벤트 실패·정상 모두 예상 계약 유지.
- 이 가드는 법률 AI **진입 전** 필수 계산 오류 보호이고, Word writer의 독립 필수 게이트/실제 법원 양식 검증을 대체하지 않는다.

## 원장 상태 및 다음 단계

| 단계 | 이번 결과 |
| --- | --- |
| 기존 소스 불량 반례 | 법률 모델 이벤트 실패 반복 호출 1종·원화 출력 타입 false-ready 7조건 재현 |
| 코드 변경 | **main 소스 변경 없음**. 분리 Draft PR #41(2파일), PR #42(3파일) 생성·미병합 |
| 실행 | 실제 함수본문 V8 조건별 검증; 보조 함수 Node 22 격리 3/3 |
| 최신 전체 Node CI/type/lint/build | **미실행·미인증** |
| Cloudflare staging D1·R2·Cron/실제 Word/PDF | **미실행·미인증** |
| 실제 법률 준칙/법원서식/변호사 검토 | **미실행·미인증** |
| 운영 사이트 배포·DB migration·전자제출 | **수행하지 않음** |
| `RELEASE_READY` / 완결 체크 | **0개**, 세 항목 `[ ]` 유지 |

다음 A1 역할은 **사용자·서류담당자 / 변호사 / 데이터담당자** 우선 순환한다: `A1-DOC-009` (서류 재분류 후 계산 무효화), `A1-LAW-013` (95개 법률위험의 미승인 계약 침묵통과), `A1-DATA-014` (18계산·91입력과 DB typed 경로). 관련 Draft PR #17/#20/#24/#28/#32/#36/#41/#42의 선행 수정·회귀를 추적하되 코드/법률 확정 무단 병합 금지. 실 D1/R2 장애주입·서식·전문가 인수는 보류.
