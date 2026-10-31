# FirmEngine A4 제37차 — 법률 워커 D1 ACK 0/1/미관찰 구분 및 전이 복구 경계

- 시작: 2026-11-01 01:37 KST, GitHub `main` `b928ce2a6b8099ef12d17c71882f36da8e96ecc7`; 당시 최근 A1/A2/A3 및 r36 커밋·PR #16(Open, 미병합), #61(Open/Draft, 미병합) 재조회.
- 단일 수락 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`; 시작 blob `0fa7d28cfbccd949a1dadf3b9d95467cfc6c543b`. 범위는 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만.
- 6역할 순환: **AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자**. 이전 r36의 데이터 선행과 시작역할이 다름.
- 직접 검증 5개 미완 체크: `A4-IT-003`, `A4-LAW-006`, `A4-DATA-004`, `A4-AX-006`, `X-046`. 서류 `A4-DOC-013`, 계산 `A4-CALC-004`는 연결 구조만 검토, 종단 미시험; 모두 **[ ] 유지**.
- 원본 참조: `lib/case-legal-automation.ts` 시작 blob `6257c1dab33636b87d9f6d4a82e0e6b72c77f9dd`, `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 법률 사전검사 코드, r35/r36 영수증·기존 회귀 파일. 공개 가능한 합성 case ID만 사용.

## 1. 재현한 결함 (실제 GitHub 원본의 ACK 가드 추출 실행)

법률 워커에는 r35에서 **실패 처리 UPDATE**의 `meta.changes=0/1/미관찰` 구분만 도입됐고, 아래 세 곳은 아직 `if(!meta.changes)`로 판단하고 있었다. 원본 가드 15개 합성 입력(각 0/1/null/미관찰/2)에 대해 독립 기대값을 정한 뒤 V8 실행.

| 대상·기대 | 수정 전 실제 관찰 | 수정 후 실제 관찰 |
| --- | --- | --- |
| `transition` UPDATE 0행 → `SUPERSEDED` | 기대 일치 | 유지 |
| `transition` UPDATE 1행 → 상태 성공 후 감사 시도 1회 | 기대 일치 | 유지 |
| `transition` UPDATE null/미관찰 → 결과 불확정 | 잘못 `SUPERSEDED` | `LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED` |
| `transition` UPDATE 2행 → 불확정 | 잘못 성공 및 감사 | 불확정 오류, 감사 0 |
| 작업 claim UPDATE 0행 → already_claimed_or_complete | 기대 일치 | 유지 |
| 작업 claim UPDATE 1행 → claimed | 기대 일치 | 유지 |
| 작업 claim UPDATE null/누락 → 불확정 | 잘못 already claimed로 반환 | `LEGAL_AUTOMATION_CLAIM_ACK_UNOBSERVED` |
| 작업 claim UPDATE 2행 → 불확정 | 잘못 작업 진행 허용 | 불확정 오류 |
| 수동 retry UPDATE 0행 → RETRY_CONFLICT | 기대 일치 | 유지 |
| 수동 retry UPDATE 1행 → 변경 인정/감사 분기 | 기대 일치 | 유지 |
| 수동 retry UPDATE null/누락 → 불확정 | 잘못 RETRY_CONFLICT | `LEGAL_AUTOMATION_RETRY_ACK_UNOBSERVED` |
| 수동 retry UPDATE 2행 → 불확정 | 잘못 성공/감사 | 불확정 오류 |

추가로, `transition` 변경이 실제 반영됐는데 **D1 응답만 유실**된 경우 catch가 이를 재시도·실패 상태로 다시 쓰거나 잘못 `superseded`로 반환하면 안 된다. `LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED`는 catch가 DB에 두 번째 UPDATE 없이 그대로 올리도록 작은 가드 추가. **ACK 불확정은 commit 성공/실패 어느 쪽도 추정하지 않으며 별도 read-after-write 복구가 필요하다.** 이 코드는 운영 복구 트랜잭션을 구현한 것이 아니다.

## 2. 코드·회귀·실제 검증

- 코드 보수 수정: `lib/case-legal-automation.ts` (첫 수정 커밋 `c10c0356ec3635f1205002d548b4c8b73a183ae1`). 경계 세 곳에서 정확한 `changes===0`/ `===1`만 인정; `transition` 불확정 catch의 상태 변경 재시도 금지. 이후 r35 테스트의 기존 본문 추출 표식이 깨진 사실을 **실제 기존 회귀 실행에서 발견**, 기존 표식 유지하도록 보완 커밋 `f48174f8fc9184ca051cbe1f341f691b9ff2deb8`. 최종 코드 blob `11870f5e7496b915955213257914289c2735b9c4`.
- 신규 `tests/case-legal-automation-ack-r37.test.mjs` 16조건 작성(가드 15 + 이전 transition 응답 불확정 후 재기록 차단 1). 테스트 작성 커밋 `8aa1414a9b32077835c2d28b8aec8ba116678768`; 기존 표식에 맞춘 보완 커밋 `437a82813aec05690c22a148e73d81929854eaab`; 최종 테스트 blob `547bc2714d6a084e9d9542750b5e10eabb96f1f5`.
- **실제 최신 GitHub 코드 및 테스트 본문의 JS 단언을 V8 격리 실행:** r37 **16/16 기대 일치**, 기존 r35 **9/9 기대 일치**. 초기 r37 임시 하네스 기대값 표기 오류로 15/16이었고 기대값을 바로잡아 16/16. r35 추출 표식 회귀 0/9를 실제로 감지한 후 수정해 9/9. 이 이력을 전체 CI나 원본 Node 테스트 성공으로 축약하지 않는다.
- **로컬 SQLite WAL 재실행:** r34 두 연결 계산 poll 합성 **16/16 관찰 일치**(여기에 **현재 main의 구판본 lease 탈취 위험** 및 PR #16의 기준정보 A/B 경쟁 미해결 반례 포함), 계산 head 비교 **7/7 관찰 일치**(구 기준정보 결과의 최신 head overwrite 포함), r35 법률 lease 상실 **9/9 기대 일치**. 이 SQL 관찰 일치는 안전한 동작 모두가 통과했다는 뜻이 아니다. 합성 스크립트는 이전 회차의 동일 SQL 계약을 재실행했고, 현재 main 관련 구간을 정적으로 재대조함.
- Node-native `node --test`, 저장소 `tsc`/Next/전체 CI: **미실행**(저장소 실행 사본·의존성 없음). Cloudflare staging D1/R2/Cron·실제 HTTP 두 워커·n8n 운영 워크플로·실제 Word/직원/변호사 승인/보정명령 원문: **미실행**. UI 또는 n8n 설계 문서는 실제 실행 증거가 아니다.

## 3. 남은 A4 원자성·실무 인계 문제

1. `transition()`은 상태 UPDATE 뒤 감사 `note()`를 별도 실행하고 `catch(()=>{})`로 감사 오류를 삼킨다. **상태가 성공해도 감사가 누락될 수 있는 부분 성공**이며, 별도 원자적 배치/outbox 및 D1 fault injection 없이는 통과시키지 않음. 이번 안전한 ACK 변경은 이 문제를 해결하지 않는다.
2. 계산 poll 구판본 v7 → 현재 v8 lease 탈취 P1은 **main 미해결**. PR #16(미병합)은 데이터·사건 판본 일부만 차단하며 reference generation A/B 경쟁은 남는다.
3. `case_calculation_heads`의 동일 dataVersion/caseRevision 다른 reference SHA 지연 UPSERT가 최신 head를 덮는 반례 계속 존재. 법률 preflight/Word 재생성/기존 승인무효화의 종단 연결·사람 확인 없이는 새 법률 인정값으로 승격 금지.
4. 법률 수동 재시도 UPDATE는 감사 이벤트 INSERT와 하나의 원자 단위가 아니다. ACK 유실/503 재현을 실제 D1에서 수행하고 영속 읽기 증빙으로 화해해야 함. `null`, 미관찰, 숫자 0, 비해당, 충돌, source-only, 승인전 상태 분리 유지.
5. 상담→서류→OCR→10분 quiet 계산→95 법률→Word→직원/변호사 검수→법원 실제 보정 이벤트는 **코드 및 계약 검토 수준**, 전 단계의 stage/revision/CAS/승인 인계 실제 종단 검증 **미완**.

## 4. 다음 우선 체크

- `A4-IT-003` / `X-046`: 실제 staging HTTP 2-worker 및 구판본 lease 재선점, reference epoch 원자적 CAS를 별도 PR/검토로 확인.
- `A4-DATA-004` / `A4-CALC-004`: 계산 head의 reference SHA + source/run/input identity fenced UPSERT 후보, 법률 진입 및 이전 승인 취소 전파를 독립 검증.
- `A4-AX-006` / `A4-LAW-006` / `A4-DOC-013`: legal transition 성공 뒤 감사 INSERT 503/timeout 및 사람 승인 무효화·재작성 handoff.
- `A4-DATA-013` / `X-047`: staging R2 GET 바이트 SHA, D1 durable receipt/감사 이벤트 조회, ACK 유실 후 중복 처리 차단.

**수락된 체크 ID 0개. 제품 최종 인수 0건.** 운영 배포·D1 운영 migration·전자제출·법원 인가 확정 수행하지 않음. 원본 OCR·고객 개인정보·비공개 정답·키/.env는 공개 Git에 남기지 않음.
