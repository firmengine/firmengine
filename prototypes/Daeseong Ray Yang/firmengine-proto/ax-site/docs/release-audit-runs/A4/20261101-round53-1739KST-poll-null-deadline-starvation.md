# FirmEngine A4 53차 — Poll 만료시각/재시도시각 미관찰에 따른 Cron 기아와 소유권 불명확 (2026-11-01 KST)

- **허용 범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 단일 인수 문서: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 최초 조회 main SHA `a2e3bcb0ad16ffba53141a256e07ed2b170a41a1`; 최근 A3/A1/A2 관련 커밋과 A4 Draft #16/#120/#123/#126 상태·수정경로를 확인. 변경 전 PR #126 HEAD `037b4a2ae3c826f43bccaa8ef61f3878ea421fae`.
- **6역할 순환**: 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장. 직접 부분검증 `A4-IT-009`, `A4-CALC-018`, `A4-DATA-023`, `X-046` (모두 `[ ]`). 법률 `A4-LAW-006`, 서류 `A4-DOC-013`, AX `A4-AX-016`은 간접 인계 검토만 수행; 통과/검수 승인 아님.
- **실제 조회한 코드/스키마**: main `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`의 Cron SELECT 및 claim SQL, `lib/case-data-watch.ts` blob `1b5f2d4f1ff8da8998644481be089ba4fb9d359b`, `drizzle/0010_case_data_watch.sql` blob `6f14a419b760a79f38c027be0456bd6644b862b0`, `drizzle/0020_calculation_poll_fairness.sql` blob `f4906ad0dcefa4bdce67f00b104540d2266f890d`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`. 0020의 CHECK는 `status`만 제한하며 `lease_until`, `next_attempt_at`, `lease_token`은 nullable.
- **이전 회차 계승**: 49~52차 최신 head + 유령 running Poll 복구 진단, SHA 일치/Run status/lease 소유권/poll status 구분. 이번에는 **head가 구판본이라 재계산이 필요한 상황**에서 Cron 후보가 실제로 선택되는지 추가 확인.

## 독립 합성 실험과 기대/실제

환경: 로컬 Node v22.16.0, SQLite WAL 독립 연결 2개, `caseId=synthetic-case`, revision 4, current sourceVersion 7, 계산 head sourceVersion 6, poll sourceVersion 7, 기준 SHA 동일 `a×64`, 마지막 원천변경 2026-11-01T03:30Z, 실행 04:00Z, quiet cutoff 03:50Z. main의 SELECT/UPSERT SQL을 그대로 재현한 최소 스키마; 개인/실제 고객 자료 없음. 테스트 스크립트 `round53_poll_due_null_recovery_sqlite.test.mjs` (채팅 첨부) **12/12 관찰 일치**.

| 합성 입력·조건 | 독립 기대 | SQLite 실제 관찰 | 판정 |
|---|---|---|---|
| running/유효 만료시각 과거, lease 소유자 있음 | due 후보 1 | 후보 1 | 정상 대조 |
| running/lease_until 미래 | due 후보 0 | 후보 0 | 정상 대조 |
| **running/lease_until=NULL**, 계산 head 구판본 | 재계산 필요하나 '미관찰'로 격리·경고 | **Cron 후보 0** | **기아 반례/P1 후보** |
| **retry_wait/next_attempt_at=NULL**, 계산 head 구판본 | 대기기한 미관찰 경고·사람 조치 | **Cron 후보 0** | **기아 반례/P1 후보** |
| retry_wait/과거 또는 미래 시각 | 각각 1/0 | 각각 1/0 | 정상 대조 |
| **running/lease_token=NULL + 과거 lease_until** | 소유권 미관찰 상태를 안전한 자동 재소유로 확정 금지 | **Cron 후보 1, UPSERT claim 1, 새 토큰 생성** | **소유권 반례/P1 후보** |
| 동시 WAL 워커 A/B 같은 만료 lease | claim 승자 1명, 패자 0 | 1/0 | 동시성 SQL 부분 대조 |
| 최신 head + 유령 running | 계산 후보 0이더라도 poll cleanup 완료 오인 금지 | 후보 0 | 기존 미해결 복구 경계 |
| failed 상태/원천 버전 증가/quiet 10분 미도래 | 각각 수동 재시도/재검토/대기 | 후보 0/1/0 | 정상 대조 |

검증은 **비정상/null 상태를 명시적으로 주입한 회복력 실험**이다. 현행 정상 코드 경로가 NULL 시각을 실제로 썼다는 증거는 없다. 데이터 손상, 호환성 결손, 수동 수정, 이전 부분 실패 등의 복구 경계가 스키마 차원에서 허용됨을 확인했다. 정상 SQLite 단위 대조 통과를 제품 안전성/실제 D1 동작 증명으로 승격하지 않는다.

기존 로컬 독립 43·44·46·48·50·51차 SQLite 회귀를 실제 재실행한 결과 **56/56 관찰 일치**(부정대조 포함). 이번 12건 합계 로컬 SQLite **68/68 관찰 일치**이며 제품 안전 통과가 아니다.

## 보수적 코드 조치: Draft PR만

- 기존 [Draft PR #126](https://github.com/firmengine/firmengine/pull/126)의 **읽기전용** `lib/case-calculation-poll-reconciliation.ts`에 `nextAttemptAt` 관측 필드와 세 가지 별도 finding 추가: `poll_running_deadline_unobserved`, `poll_retry_deadline_unobserved`, `poll_running_owner_unobserved`. 계산 head 구판본과 Poll source/ref가 일치할 때만 적용하고, 정상 deadline/owner는 기존 `head_not_current` 유지.
- 새 실제 함수 본문의 TS 타입 표기만 제거하여 V8 독립 모의 D1 응답으로 **7/7 기대값 일치** 확인, `approved=false`·`writePerformed=false`. SQL 실제 D1/운영 복구/전체 프로젝트 Node test가 아니다.
- PR의 기존 회귀 `tests/case-calculation-poll-reconciliation-r49.test.mjs`에 **7개 선언** 추가, 총 **36개 선언**. 프로젝트 Node-native 36건·TS/Next 빌드·전체 CI는 **미실행**. Draft helper blob `34bff0819df064ef16b00ee76ac093411e49f995`, test blob `7463a17f46a7dba2c255547adf2bfeabb372f835`, PR HEAD `bfdb1b40bd10480df0edd3e87f03d6abab3c7d76`. 상태 Draft/Open/미병합; 조회 시 mergeable=false로 자동 병합 금지. 경합/산식/법률 의미 변경은 승인 없이는 main에 반영하지 않음.

## 인계·미실행·다음 체크

- 본 회차는 **상담 → 서류 → OCR → 10분 quiet calculation** 중 Cron 후보·lease/ACK 계약만 직접 재현. **95개 법률 체크 → Word 초안 → 직원/변호사 별도 검수 → 실제 보정 이벤트**는 source-only/미실행이며 법적 확정·제출·인가로 표시하지 않음. 법원 기한 미확정/null, 갈음 철회, 관할 기준판본 변경, 구 승인 무효화는 아직 종단 재현 안 됨.
- **미실행**: Cloudflare staging D1/R2/Cron, 실제 HTTP 두 워커, 중복 웹훅, 429/503/timeout, R2 성공→D1 실패/ACK 소실의 실 연동, 전체 저장소 CI/브라우저/Word/실무자 승인. n8n 설계 문서는 운영 실행 증거가 아님.
- **다음 직접 후보**: `A4-IT-009`과 `A4-AX-016`에서 null/비정상 deadline이 실제 스키마에서 recovery 큐로 격리되는 구조 및 제어된 CAS 재개를 설계·staging 시험. `A4-DATA-023`은 직원 Health 표시 vs DB/읽기전용 inspector 불일치 확인. `X-046`은 PR #16/#120/#123/#126를 충돌 없이 결합한 뒤 동일 사건 2 HTTP 워커/응답 유실/판본 업데이트 실검증.
- **금지 작업 미수행**: 운영 배포·운영 D1 migration·고객 자료 변경·실제 전자제출·법원 인가 확정. 직접 선택 ID **0/4 최종 인수**, 제품 전체 최종 인수 0건.
