# FirmEngine A4 34차 — 계산 poll source CAS 및 기준정보 판본 경합 재현
2026-10-31 22:40 KST | 읽기 시작 GitHub main `5c2ecc65affe18d35f1afb59cdac68d79504f048` | 제품 인수 완료 0건 | 공개 합성 데이터만 사용

## 감사 범위와 불변 원칙
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 운영 배포·운영 D1 마이그레이션·실전자제출·법원 승인 없음.
- 단일 기준 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `5519fb1a30cf58b99950821bbf503539c84c0483`.
- 6역할 순환: **서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자**. 이번 직접 검사 체크 **A4-IT-003 / A4-CALC-004 / A4-DATA-004 / X-046** (4개). 관련 코드 정적 검토만: **A4-DOC-013 / A4-LAW-006 / A4-AX-006**, 직접 실행 아님. 전부 **[ ] 미완료**.
- 원본: `lib/case-data-recompute.ts` blob `c19584f1668b7f4849ac0fc8c910f7c1ce36187d`; `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `lib/case-data-watch.ts`, `lib/reference-runtime.ts`, `db/schema.ts`, `drizzle/0010_case_data_watch.sql` 및 `0020_calculation_poll_fairness.sql`; 기존 `tests/case-calculation-poll-fairness.test.ts` 및 `tests/case-calculation-poll-lease-loss-r33.test.ts`, A4 r33 영수증.
- 최근 main 커밋 A1/A2/A3 타축 업데이트 확인. 관련 PR **#16 Open/미병합**(source CAS 제안), **#61 Open/Draft/미병합**(Export 별도); main에 PR 코드를 존재하는 것으로 취급하지 않음.

## 실제 실행한 합성 재현 (독립 Python sqlite3 / SQLite WAL 연결 2개)
1. 파일 기반 DB 두 연결 A/B, 동일 synthetic 사건, `cases.revision=3`, `case_data_change_state.data_version=7`, 가상 참조 SHA A/B를 사용. 실제 main `drainCaseDataUpdates`의 CASE poll UPSERT SQL과 PR #16의 `INSERT..SELECT WHERE EXISTS` 수정형을 동일 테이블 계약으로 실행. `round34_calc_poll_pr16_two_connection.py` 로컬 실행.
2. **소스 버전 경합**: A가 7을 선택한 후 실제 state는 8로 변경, B가 버전 8 유효 lease 소유. **독립 기대:** 구 후보 7 claim=0, B lease 유지. **main 관찰:** 구 후보 claim=1, poll 버전 7로 회귀 (P1). **#16 제안 SQL 관찰:** 구 후보 claim=0, B 버전 8/lease 보존. 이는 PR의 격리 계약 확인이며 **main 수정/PR 병합 아님**.
3. **사건 revision 경합**: current revision 4, 구 후보 revision 3. **기대/PR #16 관찰:** 구 claim=0, revision 4 owner 보존. **동일 버전 lease 경합:** A=1/B=0, 만료 후 B=1. **독립 기대와 일치**.
4. **기준정보 SHA 경합 추가 발견:** 같은 사건 버전 7/revision 3에서 워커 B(ref B)가 유효 lease 소유 중 구 워커 A(ref A)가 #16 제안 SQL로 뒤늦게 claim. **독립 위험 기준:** 활성 기준정보가 B로 바뀌었다면 A는 B의 lease를 탈취해선 안 됨. **관찰:** A claim=1, B lease → A lease, SHA B → A. **#16은 source/revision만 CAS; 현재 활성 reference epoch의 권위 있는 DB fence가 없어 이 상황의 안전성을 입증하지 못함.** 운영에서 실제 기준정보가 갱신되었다는 뜻 아님.
5. SQL 관찰 단언 **16/16**이 소스 계약에 일치. 이 숫자는 **정상 PASS 16개가 아니라 재현된 회귀와 미해결 반례까지 정확히 관찰한 건수**임.

## 계산 결과 current head의 독립 재현
- `lib/case-calculation-feature-store.ts::persistCaseCalculationFeatures`의 실제 `INSERT INTO case_calculation_heads ... SELECT ... WHERE EXISTS ... ON CONFLICT ... WHERE excluded.data_version >= ... AND excluded.case_revision >= ...` 쿼리를 별도 in-memory SQLite에서 실행. `round34_calc_head_reference_race.py` 로컬 실행.
- 원본 `dataVersion=7/revision=3` 동일 시 `run-ref-B` current head를 먼저 저장하고 ref A의 지연 실행이 `run-ref-A`를 이어서 upsert → **반환 changes=1, head가 A로 대체됨**. `case_calculation_heads`는 reference SHA를 별도 저장하지 않고 버전·revision 대소만 검사함. **법률 의미상 B가 최신 검증 기준이라는 전제 아래 독립 기대는 B head 유지**이지만 현 SQL은 그 사실을 판별하지 못함. 반대로 sourceVersion이 8로 전진한 뒤 v7 upsert는 0건으로 차단되는 것도 확인.
- 7/7은 관찰값과 사전 정의한 **현 코드의 행동** 일치이며, **안전한 동작 합격 7건이 아님**. B→A 역전은 별도 기준정보 세대/현재성 권위 및 쓰기·읽기 통합 CAS가 없어서 고위험 미해결.
- 서로 다른 기준정보 번들이 실시간 활성으로 바뀐 것인지, 단순 요청별 법률 적용판본이 다른 것인지에 따라 **허용 정책 자체가 달라짐**. 사용자·변호사·계산사무장 정책 결정 전에는 임의로 전역 최신판본이라 단정/코드 변경 불가.

## 실행 수준 및 결과
| 구분 | 관찰 |
|---|---|
| main / #16 claim SQL 두 연결 SQLite WAL | 합성 관찰 단언 16/16, 그중 main 구판본 역전/제안 #16 reference split-brain 반례 |
| main 계산 head UPSERT SQLite | 합성 관찰 단언 7/7, same-version 기준정보 B→A 역전 재현 |
| 실제 저장 계약과 코드, 기존 테스트/PR | 정적 원본 재조회 |
| GitHub main 코드 수정 | **없음** (기존 #16 및 기준정보 현재성 설계/고위험 분기 중복 방지) |
| Node-native 테스트/전체 CI·TS·Next | **미실행** |
| Cloudflare staging D1/R2/Cron, 실제 HTTP 두 워커 | **미실행** |
| n8n 운영 workflow, Word 파일, 공식 서식, 직원/변호사 승인, 법원 보정 | **미실행** |

## 결정 및 다음 체크
- #16 source/revision CAS 수정은 타당한 방향이나 **기준정보 epoch 경계, 본문의 계산 head write fence, 동일 dataVersion ref 다름**을 통합 검증하기 전 완료 표시 금지. 기존 PR에 회귀 반례 검토 요청; 비슷한 main 변경 중복 커밋 금지.
- 다음: `A4-DATA-004` + `A4-CALC-004` 최신 reference/run/input SHA 기준정보 현재성 소스-헤드-법률95 전파 계약; `A4-IT-003` + `X-046` staging HTTP 2-worker/실제 D1 동시성; 이어서 `A4-DOC-013`/`A4-LAW-006` 증빙·법령 변경 후 Word/사람 승인 무효화 E2E.
- 실패복구: 경합에서 이전 worker의 재시도/실패 응답은 r33 수정처럼 superseded로만 기록, 이미 기록된 head/lease는 무단 삭제/변경하지 않음. 기준정보 해석 불확실 상태에서 인정 금액·법률상 확정값 생성 금지.
