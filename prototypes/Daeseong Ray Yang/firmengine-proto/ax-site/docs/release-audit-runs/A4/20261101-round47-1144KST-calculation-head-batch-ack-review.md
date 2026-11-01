# FirmEngine A4 제47차 — 계산 head batch ACK 안전 구분 / Draft 인계

- 관찰일: 2026-11-01 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 이번 최초 main 관찰 SHA `6842d01dcb20268bd374c1348407d5e6ed9eea1e`; 46차 인계 `20261101-round46-1037KST-legal-active-reference-release-race.md` 확인.
- 단일 인수 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. **직접 합성 검증 ID** `A4-IT-003`, `A4-CALC-004`, `A4-DATA-004`, `X-046` (4개 모두 [ ]). **인계 조건 검토만** `A4-LAW-001`, `A4-DOC-013`, `A4-AX-006` ([ ]). 역할 순환: **변호사 → 데이터담당자 → AX담당자 → IT담당자 → 서류담당자 → 계산사무장**.
- 읽은 실물: `lib/case-calculation-feature-store.ts` 최초 blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `lib/case-data-recompute.ts` `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`; `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`; `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`; `lib/reference-runtime.ts` `9993469a164740e8a9128874b299a967b420e230`; `drizzle/0017_legal_reanalysis_orchestration.sql` `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`; `reference-release.json` `5537e47c163fb87447f51560e1433866d67faf76`, 46차 감사 영수증과 기존 r41–46 합성 테스트.
- 확인한 PR: [#16](https://github.com/firmengine/firmengine/pull/16) 계산 poll CAS 후보(Open), [#110](https://github.com/firmengine/firmengine/pull/110) 법률 retry/transition batch(Open Draft), [#114](https://github.com/firmengine/firmengine/pull/114) 법률 failure batch(Open Draft). 이번 [Draft PR #120](https://github.com/firmengine/firmengine/pull/120)은 계산 head batch ACK 제어만 다룸, **미병합**.
- 별도 작업 중인 다른 축 커밋은 보존. 실제 코드 변경은 Draft PR에서만 유지. 검증 도중 main에 기록했던 보수 코드와 테스트는 **각각 명시적으로 원복**했고, 보드/영수증 외의 main 실행 코드 차이는 남기지 않음. 이유: ACK 불확정 오류가 scheduler 자동 재시도로 바뀌는 고위험 인계가 미합의.

## 1. 입력 / 독립 기대 / 실제 관찰

| 합성 receipt 입력 | 독립 기대 | main 원본 tail 실제 | #120 tail 실제 |
| --- | --- | --- | --- |
| batch 길이 2, head changes=1 | 확정된 CAS 1로 반환 | `headPromoted:true` | 동일 |
| batch 길이 2, head changes=0 | source/current head 충돌 | `CALCULATION_VERSION_MISMATCH` | 동일 |
| batch 길이 2, head changes=2 | 비정상 영수증, 성공 확정 금지 | **`headPromoted:true` 오판** | `CALCULATION_HEAD_ACK_UNOBSERVED` |
| changes=null/누락 | 미관찰 (0과 별도) | 모두 `CALCULATION_VERSION_MISMATCH` | `CALCULATION_HEAD_ACK_UNOBSERVED` |
| changes=-1 또는 문자열 '1' | 비정상 타입, 승격 금지 | -1은 거짓 성공, '1'은 거짓 성공 | `CALCULATION_HEAD_ACK_UNOBSERVED` |
| 단축 응답/전체 null | batch 수·상태 미관찰 | 단축은 0행과 혼합, null 전체는 런타임 예외 가능 | `CALCULATION_HEAD_ACK_UNOBSERVED` |

- 모든 데이터는 synthetic run/id, 숫자형 mock D1 ACK. 실제 D1이 changes=2를 반환했다는 주장이 아님. 원본 프로덕션 함수의 `db.batch(statements)` 이후 정확한 tail 문자열을 GitHub에서 추출하고 `AsyncFunction`으로 호출, **수정 전 다중행 ACK 거짓 성공**을 실제 관찰.
- #120의 GitHub 실제 소스 blob `0a0ec9928f59187b5a01e108a07e535bcc4f8fb5`, 테스트 blob `e61cd361bac22988c1b5a31023f565b0dc8300f0`. 수정 tail V8 실행 **9/9 기대 일치**. 저장소 Node-native 테스트는 작성만 했으며 실행하지 않았음.
- 독립 Node v22.16.0 환경에서 기존 `round41` 9/9, `round42` 10/10, `round43` 12/12, `round44` 9/9, `round46` 8/8 **재실행**, 48/48 관찰 일치. 여기에는 **기존 P1 경쟁을 재현한 위험 부정대조가 포함**되어 전체 안전 통과 48건으로 간주하지 않음.

## 2. 발견한 추가 의미 위험과 처리

- `persistCaseCalculationFeatures`의 원래 null/missing ACK는 `CALCULATION_VERSION_MISMATCH`로 발생, 호출자 `recomputeCaseDataUpdate`가 `superseded`로 분류. 후보의 새 `CALCULATION_HEAD_ACK_UNOBSERVED`는 현행 계산 poll catch 경로에서 `retry_wait`에 도달할 수 있음. **COMMIT만 성공하고 ACK가 유실된 경우 재계산을 자동 호출할 위험**. 결과 재조회 및 멱등성 영속 영수증 없이는 안전한 재시도 동작 확정 불가.
- 그러므로 후보를 **main에 남기지 않고 #120 Draft PR**로 별도 분리. 재조회/재시도 계약과 IT·데이터·계산 실무자의 검토, Node-native/CI 및 staging D1 장애주입 전 병합 금지.
- 34/46차의 **동일 sourceVersion·revision에서 구 기준정보 계산 결과가 신 기준정보 head를 덮는 문제** 및 활성 기준정보가 D1 원장 밖에서 변경되어 법률 retry CAS에 안 보이는 문제는 그대로 남음. ACK 구분은 reference epoch CAS의 대체물이 아님.
- 법률 95개 결과는 자동 승인 아님. 직원/변호사 검수, Word/보정기한·전자제출 결과를 실제 확인하지 않은 채 자동 법률 확정값으로 승격하지 않음.

## 3. 단계별 증거 경계

- 상담→서류→OCR→10분 quiet calculation→95법률→Word 초안→직원·변호사 검수→실제 보정 이벤트: 이번에는 `case-data-recompute`·`case-legal-automation`·scheduler의 stage 경계 및 SQL/스키마를 **정적 읽기**. 전체 실행 입력·출력·human CAS·재생성 E2E **미실행**.
- **D1/R2/Cron staging, 실제 DB 두 HTTP 워커, R2 업로드 뒤 D1 503/응답유실, 중복 웹훅, 모델 429/503/timeout, OCR 원문교체, 갈음 철회, 관할판본 변경, 보정기한 미확정, 실제 Word 생성/검수** 모두 이번 회차 미실행. n8n 설계 문서와 운영 workflow 동일성도 미확인.
- `0`=SQL CAS 0행, `null`/누락/비정상=영수증 미관찰, `not_applicable`=입력 해당없음, `conflict`=판본 상충, `source-only`=코드정적 확인, `승인전`=사람 승인 없음으로 각각 구별.
- 다음 검증: `A4-IT-003/X-046` 기준정보 epoch를 포함한 두 워커 실제 D1 CAS; `A4-CALC-004/A4-DATA-004` 계산 head 이전판본 늦은 승격 차단과 uncertain ACK 재조회; `A4-LAW-001/A4-DOC-013/A4-AX-006` 법률/Word 재생성→사람 승인 무효화; `X-047/X-048` R2/D1 및 모델 장애 복구.
- **신규 최종 인수 0건**. 운영 배포·운영 D1 마이그레이션·실제 고객데이터 변경·법원 전자제출·법원 인가 확정 모두 수행하지 않음.
