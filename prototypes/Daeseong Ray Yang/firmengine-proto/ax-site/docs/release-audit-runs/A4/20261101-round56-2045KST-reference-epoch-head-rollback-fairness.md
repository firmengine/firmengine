# FirmEngine A4 56차 — 활성 기준판본 역전 시 최신 계산 Head 롤백 + 다사건 Cron 공정성 독립 재현 (2026-11-01 KST)

- **유일 작업 범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 출발 main `26ace7c004a49bfa2f4cee1f9eb63b44f5a04853`, 쓰기 직전 관찰 main `26ace7c004a49bfa2f4cee1f9eb63b44f5a04853`. 중앙 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` ID 기준.
- **선정 5개:** `A4-IT-003` (2-worker claim), `A4-CALC-004` (구 계산값 오승격), `A4-DATA-023` (DB/직원 표시 불일치 위험), `A4-AX-016` (Cron limit=1·기아), `X-046` (교차 경합). **모두 [ ] 미완료 유지**. 역할은 **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX** 순환. `A4-DOC-013`, `A4-LAW-006`은 기존 보드에 따른 승인 무효화 간접 확인 범위이며, 코드/E2E 실제 검증·사람 승인은 **미실행**.
- 읽은 실제 main 소스(blob): `lib/case-data-recompute.ts` `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0020_calculation_poll_fairness.sql` `f4906ad0dcefa4bdce67f00b104540d2266f890d`. 이전 A4 r54/55 영수증, 보드 및 PR #16/#120/#123/#126 상태·변경 파일 확인. 최신 main은 다른 A3 수정이 섞여 있으며 기존 A4 코드 blob SHA는 위와 같이 비교했다.
- **독립 실행환경:** Node 22.16.0 `node:sqlite`의 **파일 WAL 2개 연결**; `node --test`로 로컬 격리. 실제 source의 Cron 후보 SELECT/lease UPSERT/head UPSERT SQL과 동등한 문자열을 사용한 합성 스크립트 `round56_reference_epoch_head_rollback_sqlite.test.mjs`. 사건 `syn`, revision=3, dataVersion=7, 기준 release A=`a×64`, B=`b×64`; 모두 가상데이터. **GitHub repo의 실제 Node-native/CI 테스트가 아니다.**

## 재현: 같은 원본판본에서 늦은 A가 최신 B 계산 Head를 덮어씀 (P1 후보)

| 순서/조건 | 독립 기대 | 실제 SQLite WAL 관찰 | 판정 |
|---|---|---|---|
| 워커 A가 동일 source v7 / ref A lease 획득 | A의 소유권 | claim 1행 | 정상 |
| 활성 ref B 전환 가정 후 워커 B가 lease 획득 | ref B 작업 진행 | B claim 1행 / lease=B | 경합 조건 |
| B 계산 Run 저장 및 Head 승격 | Head=run-B | Head UPSERT 1행, B | 정상 |
| **늦게 돌아온 A가 ref A로 동일 v7/rev3 계산 저장** | **A Head 승격 차단, B Head 보존** | **Head UPSERT 1행, 최종 Head=run-A/ref A** | **안전성 실패 부정대조** |
| A의 지연 lease DELETE | B lease 불변 | DELETE 0행 / B lease 유지 | 안전한 lease CAS, Head 안전성과는 별개 |
| active ref B에서 Cron 재조회 (B lease 유효) | 구 Head가 즉시 승인되면 안 됨 | 후보 0건 (유효 lease 보호) | 중간대기; 복구 완료 아님 |
| B lease 기한 만료 뒤 | 구 ref A Head 재계산 후보 | 후보 1건 | 재처리 가능, 즉시 안전성 보장 아님 |
| 원본 dataVersion v8 변경 후 늦은 v7 실행 | 구 원본 Head 승격 차단 | UPSERT 0행 / B head 보존 | 기존 source CAS 정상 대조 |

**원인(실제 main):** `persistCaseCalculationFeatures`의 최종 Head UPSERT는 `data_version>=`, `case_revision>=`만 검사하고 **활성 reference release epoch·작업권 소유권을 동시 CAS하지 않는다**. A의 늦은 계산이 B의 최신 Head를 덮을 수 있다. 동일 dataVersion에서 ref A/B의 선후를 SHA 문자열 대소로 판단해서는 안 된다. `drainCaseDataUpdates`의 사후 DELETE 소유권 CAS만으로 저장된 Head 역전을 되돌리지 못한다. 실제 D1 장애나 운영 사고가 발생했다는 주장 아님.

## 추가 시험: Cron limit=1 다사건 공정성

| 합성 상황 | 독립 기대 | 실제 |
|---|---|---|
| 오래된 `failed`·미도래 `retry_wait`·정상 ready 세 사건 | 정책상 failed/미도래 대기 제외 후 ready 선택 | ready 1건 선택 |
| 동시 ready `alpha`/`beta`, 정렬 동률 | 첫 alpha claim 후 유효 lease 때문에 다음 Cron은 beta | alpha → beta |
| 동일 사건 두 WAL 워커 같은 SHA claim | 첫 1행 / 다음 0행 | 1 / 0 |
| `running lease_until=NULL` | 관찰결손/기아 분리, **자동 정상 처리 금지** | Cron 후보 0 (선행 r53 부정대조 재현) |

- 최초 10개 테스트 중 **9/10**: 첫 시험이 `node:sqlite` 반환 row의 null-prototype을 일반 객체와 `deepEqual`해 하네스 오류. 값 필드별 검사로 고친 후 **최종 10/10 실제 실행 기대 관찰 일치**. 이 중 Head 덮어쓰기, NULL deadline 등 **의도적인 안전성 실패 부정대조 포함**.
- 직전 r53/r54/r55의 독립 WAL 스크립트를 변경 없이 재실행: **29/29 기대 관찰 일치**. **합계 39개 관찰은 제품 안전성 통과 수가 아니다.**
- 실행 후 실제 DB/고객 자료/운영 코드 변경 없음. GitHub PR #120에 P1 경합 근거와 원자성 게이트 병합 보류 의견 남김([PR #120](https://github.com/firmengine/firmengine/pull/120), comment ID `6557542624`). 새 실행 로직·계산 의미·법률 인정·DB migration은 안전한 원자적 기준 release 세대 설계가 없어 이번에는 **수정/병합하지 않음**.

## 다음 체크 및 복구 정책

1. **`A4-IT-003` + `A4-CALC-004` + `X-046`:** 활성 reference release **승인세대의 영속 DB 원장**과 계산 Head promotion의 원자적 epoch CAS 설계. `#16` (poll claim), `#120` (Head ACK), `#123` (lease cleanup ACK), `#126` (읽기전용 reconciliation)를 통합, 양방향 A↔B 역전/원본 v7→v8/두 워커의 유효 lease 부정대조 반복. 승인 전 운영 배포 금지.
2. **`A4-DATA-023`:** 직원 Health/UI가 `Head runId/ref/dataVersion/status`와 Poll 상태를 같은 영속 증거로 대조하는지 검증. 현재는 **미관찰**이므로 `computed`/법률 승인으로 승격 금지.
3. **`A4-AX-016`:** Cron limit1 다사건 공정성은 합성 3조건에서 부분 확인했으나 NULL deadline, 429/503/timeout, 실제 n8n·D1·Cron 재시작/중복웹훅은 미실행.
4. 상담→서류→OCR→10분 quiet 계산→95법률→Word→직원/변호사 검수→실제 보정 이벤트의 종단 stage/version/CAS/인계, 원문·갈음 철회·관할판본·기한 미확정·승인 무효화는 **이번 회차 미실행**. **n8n 설계 ≠ 운영 워크플로 실행**. R2 성공 뒤 D1 실패/ACK 유실과 staging D1/R2/Cron, 실 HTTP 2-worker, 공식 서식/변호사 승인은 **전부 미실행**.
5. **상태 구분:** source-only 코드·SQLite 합성 통과는 운영 승인 아님. `null`·`0`·미관찰·상충·비해당·승인전·보류/수동실패는 별개로 유지.

**신규 최종 인수: 0/5.** 운영 배포/운영 D1 migration/실제 전자제출/법원 인가 확정/고객 자료 사용 전부 미수행. 키·.env·개인정보·원본 OCR 값·비공개 정답 공개 Git 미기록.
