# FirmEngine A4 55차 — 구판본 계산 Head의 정상 running/retry_wait 진행상태 구분 (2026-11-01 KST)

- 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 출발 main HEAD `a9f9e3eb895e1b3463b914f72cb3322da266ee41`, 쓰기 전 확인 main HEAD `a9f9e3eb895e1b3463b914f72cb3322da266ee41`.
- 단일 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 기준 직접 선택: `A4-IT-009`, `A4-CALC-018`, `A4-DATA-023`, `A4-AX-016`, `X-046` (5건, 모두 [ ] 미완료 유지). 역할 순환: AX → IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터. `A4-DOC-013`·`A4-LAW-006`은 승인/증빙 무효화 경계를 **간접 source-only** 확인, 직접 종단 시험 아님.
- 읽음: main `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0020_calculation_poll_fairness.sql` blob `f4906ad0dcefa4bdce67f00b104540d2266f890d`; PR #126 초기 진단 blob `86de81fa8dd79b8362f4e177dbb4144baf1af3f9`, 기존 시험 blob `7e0377be6793f98eef1d386bd4dd11334e91e02b`, 54차 영수증 및 최근 main 커밋·관련 PR #16/#120/#123/#126. 설계 n8n 문서는 운영 워크플로의 실행 증거가 아님.
- 원본 main: Cron 후보 SELECT는 구판본 head + 동일 판본 `retry_wait`가 due이면 후보 1, future이면 0, `running` lease expired이면 후보 1, live이면 0. 반면 PR #126의 이전 읽기전용 진단은 네 경우 모두 `head_not_current`만 반환해 **정상적 진행/대기/만료 증거가 가려지는 P2 운영 관찰성 결함 후보**. 이 자체는 main 계산 실행 결함이나 실제 직원 화면 오표시를 확인한 결과가 아님.

## 합성 입력·독립 기대·관찰

입력: 가상 사건 `syn`, current source dataVersion=7/revision=3, stored calculation head/run=6, reference SHA=`a×64`, 10분 quiet 이상, 시간 `2026-11-01T10:40:00Z` (SQL WAL) 및 `2026-11-01T04:45:00Z` (기존 PR 함수 V8).

| 시나리오 | 독립 기대 | 실제 Node 22.16 SQLite WAL | 개선 진단 실제 V8 |
|---|---|---|---|
| stale head + retry_wait 미래시각 | Cron 후보 0, 기다림 구분 | 후보 0 | `poll_retry_wait_with_stale_head`, `retryDue=false` |
| stale head + retry_wait 기한 경과 | Cron 후보 1, 단일 claim | 후보 1, 2워커 claim 1/0 | 동일 finding, `retryDue=true` |
| stale head + running 유효 lease | Cron 후보 0, live | 후보 0 | `poll_running_with_stale_head`, `lease=live` |
| stale head + running 만료 lease | Cron 후보 1, 만료 (자동완료 아님) | 후보 1, claim 1/0 | 동일 finding, `lease=expired` |
| retry_wait 기한 NULL / failed 보류 | NULL 기아와 정책적 수동 실패 구분 | 각각 후보 0 | 기존 `poll_retry_deadline_unobserved` / `poll_failed_with_stale_head` 유지 |
| 계산 head 최신 + 만료 running 유령 | 최신 head로 후보 0, poll 자동삭제/승인 금지 | 후보 0 | `poll_running_with_current_head` 유지 |
| 재점유 후 지연 워커 DELETE | 새로운 lease 훼손 금지 | 이전 lease_token DELETE 0, 새 lease 보존 | 자동 삭제/재실행 없음 |
| DB SELECT 실패 및 합성 503 | 빈 후보=정상으로 오인 금지 | SQLite table missing 예외, 별도 503 mock 예외 | 예외를 성공/승인으로 바꾸지 않음 |

- **실제 실행**: 독립 Node 22.16 파일형 SQLite WAL 2연결 11/11 기대 일치 (처음 시험 하네스의 중복 close로 9/10였으나 하네스 수정 후 11/11 재실행). 별도 최신 GitHub 함수 본문에서 TS 주석/타입만 제거한 V8 동작시험 11/11 기대 일치. 새 저장소 Node-native 회귀 **5건 작성**, 기존 r53 기대값 **2건 정정**, 총 **45개 test 선언**; 저장소 `node --test` 45건 및 TypeScript/Next 전체 CI는 **미실행**. 독립 WAL/V8 통과는 제품 승인·실제 서버 두 워커 통과가 아니다.
- PR #126 (`audit/a4-r49-ghost-poll-recovery-inspector-20261101`)에만 읽기전용 finding 두 개 및 `retryDue` 표기 추가. PR HEAD `31b481200ef6c394f6204cea909d8f99eb4a548a` (Open/Draft/미병합). 최종 진단 blob `ac41e39c347a75238eb266a8f99c0c8652c2406a`, 테스트 blob `ca05f09565a499d7b310dd6e8d499ff07ebc04c1`. 변경 2개 파일 모두 지정 경로 내부. 법률·산식 변경, DB DDL, 자동 복구, 승인, 운영 배포 없음.
- `main`에는 감사 영수증과 단일 보드에 **해당 5 ID의 부분 실험 결과만** 추가한다. 모든 선택 체크는 [ ] 미완료, 이번 신규 최종 인수 0건.

## 계속 검증할 우선순위

1. `A4-IT-009`·`A4-AX-016`: Cron limit=1의 다른 사건을 포함한 실제 fairness, NULL deadline 기아/정상 수동 failed 보류/정상 미래 retry_wait 차이 유지. 현 PR #126 진단은 운영 API·Cron에 연결되어 있지 않음.
2. `A4-CALC-018`·`X-046`: #16 판본 CAS, #120 batch ACK, #123 cleanup ACK, #126 read-only inspector 조합. **Head COMMIT 성공 → DELETE 응답 유실 → 유령 Poll → read-only 영속 재조회 → lease-owner·source/reference CAS를 확보한 경우만 별도 사람 승인 복구**를 설계 및 두 워커 staging 검증. 단순 읽기 후 DELETE는 새 워커 lease를 훼손하므로 금지.
3. `A4-DATA-023` + 서류/법률 인계: 직원 Health/UI 상태를 DB reconciliation과 대조; 상담→서류→OCR→10분 quiet 계산→95 법률→Word→직원/변호사 검수→실제 보정의 승인/원본/관할/갈음 변경 버전 인계 E2E 확인 필요.
4. staging D1/R2/Cron, 실제 HTTP 2워커/운영 n8n, R2-D1 부분성공·timeout/429/503, 실제 Word·사람승인/법원 서식은 이번 회차 **미실행**. `null`/`0`/`미관찰`/`source-only`/`승인 전` 분리 유지.

운영 배포·운영 D1 migration·실제 전자제출·법원 인가 확정 미수행. 고객 자료·키·OCR 사실값·환경파일·비공개 정답을 Git에 저장하지 않음.
