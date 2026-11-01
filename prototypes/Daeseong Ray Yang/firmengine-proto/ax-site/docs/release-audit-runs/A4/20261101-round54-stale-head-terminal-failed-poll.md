# FirmEngine A4 54차 — 구판본 계산 Head + 최신 실패 Poll의 terminal 상태 가시성 (2026-11-01 KST)

- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 조회 시 main HEAD `282ea4f854415ba6dce64bf577130ba7d873f8c9`; 선행 53차 영수증, 최근 커밋/PR 및 0020 migration과 실제 워커/진단 코드를 읽음.
- 이번 역할 순환: 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사. 직접 5 ID: `A4-IT-009`, `A4-CALC-018`, `A4-DATA-023`, `A4-AX-016`, `X-046`; 간접 source-only 인계: `A4-DOC-013`, `A4-LAW-006`. 전부 `[ ]` 미완료, 실제 사람 승인은 없음.
- 읽은 main: `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f` (Cron SELECT/claim, 실패 수동 재시도, health), `drizzle/0020_calculation_poll_fairness.sql` blob `f4906ad0dcefa4bdce67f00b104540d2266f890d`, `lib/case-data-watch.ts` blob `1b5f2d4f1ff8da8998644481be089ba4fb9d359b`. 읽은 Draft PR #126의 복구진단 사전 blob `34bff0819df064ef16b00ee76ac093411e49f995`, 회귀 테스트 사전 blob `7463a17f46a7dba2c255547adf2bfeabb372f835`. 
- 이전 연속성: 49~53차 유령 running, run SHA/상태, null deadline/owner와 기아 방지. 이번에는 **stale calculation head + 동일 원천·기준판본의 terminal `failed` Poll**에서 진단의 원인 가시성을 검증.

## 실제 재현과 독립 기대값

합성 전용: case `synthetic-case`, current source dataVersion=7, revision=4, stored calculation head/run dataVersion=6, 동일 reference sha `a×64`, quiet 30분 경과, Poll은 version=7/reference 동일/`status=failed`. 실 고객 정보·법률 확정 데이터 없음.

| 시험 | 독립 기대 | 실제 관찰 | 수준 |
|---|---|---|---|
| 오래된 Head + 최신 terminal failed Poll | Head는 stale, 실패 사실은 별도로 보이기 | PR #126 기존 진단은 `head_not_current`만 반환 | **부정대조 재현** (실 GitHub 함수 본문 V8) |
| 같은 조건에서 실제 main Cron 후보 | 자동 재시도가 아니라 수동 검토/재시도 필요 | SELECT 0행 | 독립 Node 22.16 SQLite WAL |
| 2개 연결의 수동 실패→재시도 CAS | 첫 변경 1행, 중복 두 번째 0행 | 1/0 | 합성 WAL |
| 수동 재시도 후 같은 lease 두 워커 claim | 승자 1/패자 0 | 1/0 | 합성 WAL |
| 원본 sourceVersion 증가 | 기존 실패 Poll과 구분해 계산 후보 재조회 | 후보 1 | 합성 WAL |
| 이미 최신 Head + failed Poll | `poll_failed_with_current_head` 유지 | 유지 | GitHub 실제 함수 V8 |
| 오래된 Head + 실패 Poll의 reference/revision 불일치 | **현행 원본 기준 실패**로 오인 금지 | `head_not_current` | GitHub 실제 함수 V8 |
| 오래된 Head + NULL running/retry deadline | 기존 미관찰 분류 보존 | 보존 | GitHub 실제 함수 V8 |
| Head/Run input SHA 상충 | 기존 상충 우선 | `head_input_conflict` 보존 | GitHub 실제 함수 V8 |

중요: `failed`를 Cron 자동 대상에서 제외한 것은 현행의 **의도된 수동 재시도 정책**이다. 따라서 이 사례의 **새 결함은 자동 복구 정책이 아니라 Draft 읽기전용 진단의 실패 원인 은닉(P2 후보)**이다. 53차 NULL deadline 기아(P1 후보)와 별개다. `head_not_current`만 보고 사건이 계속 자동 처리될 것처럼 오인할 소지가 있었지만 실제 직원 화면에서 이러한 오해가 발생한 사실은 관찰하지 못했다.

## 조치·검증 수준 구분

- [Draft PR #126](https://github.com/firmengine/firmengine/pull/126)의 **읽기전용** `lib/case-calculation-poll-reconciliation.ts`에 `poll_failed_with_stale_head`를 추가. 조건은 `!headCurrent && sameSourcePoll && pollStatus==='failed'`. DB 쓰기·재시도·승인·법률 계산 없음.
- 동일 PR의 `tests/case-calculation-poll-reconciliation-r49.test.mjs`에 r54 4개 회귀 선언 추가(기존 36개 → 총 40개 선언). 신규 분류/참조 불일치/기준판본 변경/원본 버전 변경 입력. **프로젝트 Node-native 40개는 실행하지 않았음**.
- PR 최신 HEAD `429fbbfbb033d58252300a9ac4970fd508a7d60a` (Open/Draft/미병합), 실제 수정 blob: 진단 `86de81fa8dd79b8362f4e177dbb4144baf1af3f9`, 테스트 `7e0377be6793f98eef1d386bd4dd11334e91e02b`. 변경 파일 2개 모두 허용 경로 안.
- **실제 실행**: GitHub 구/신 함수의 TS 타입만 제거한 V8 계약 대조 **9/9 기대 일치**(이 중 한 건은 의도적 부정대조). 독립 Node 22.16 SQLite WAL 신규 r54 **6/6**, 선행 r44·46·48·50·51·53을 포함한 재실행 합계 **62/62 관찰 일치**(기존 결함 부정대조 포함). 새 독립 스크립트: `round54_failed_poll_stale_head_sqlite.test.mjs` (대화 산출물); GitHub에는 실제 고객/개인정보/환경변수 없음.
- **미실행**: PR의 저장소 Node-native 40개, TypeScript/Next 전체 CI, 실제 D1/R2/Cron staging, HTTP 2워커·실행 중 503/429/timeout/ACK 유실, 운영 n8n, 95법률·Word·직원 및 변호사 승인·실제 보정 이벤트. 단독 함수 V8/SQLite 실험은 staging/승인/배포와 다름.

## 인계 및 다음 체크

- 당회 직접 5 ID `[ ]` 유지, 최종 인수 0/5. 다른 2역할 `A4-DOC-013`, `A4-LAW-006`은 문서·법률 승인 경계 source-only이며 E2E 통과가 아니다.
- 우선 `A4-IT-009`, `A4-CALC-018`, `A4-AX-016`: 잘못된 NULL deadline과 terminal failed를 구분하여 **자동 대상 누락/정상 수동 보류**를 별도 직원 UI/Health 화면에서 읽기전용 관찰한 뒤, 신판본/두 워커 재점유와 연결.
- `A4-DATA-023`, `X-046`: Draft #16/#120/#123/#126 사이 계산 Head 저장→lease DELETE/ACK 유실→DB 재조회→조건부 CAS 복구 합성 통합, 이후 staging D1 실제 두 워커/실행 실패 검증. 유령 running 자동정리/재시도는 아직 구현·승인하지 않음.
- 상담→서류→OCR→10분 quiet 계산 이후 95법률→Word→직원/변호사 검수→실제 보정 및 원본/갈음/관할 변경에 따른 승인 무효화 종단 실행은 **미실행**. n8n 설계 문서와 운영 실행은 별도.
- 금지 작업(운영 배포, 운영 D1 마이그레이션, 실제 제출, 인가 확정, 고객데이터 공개/변경) 전부 미수행.
