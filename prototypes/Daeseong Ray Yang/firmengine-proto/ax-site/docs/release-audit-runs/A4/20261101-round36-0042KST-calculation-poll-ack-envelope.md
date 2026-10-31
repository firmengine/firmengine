# FirmEngine A4 36차 — 계산 poll D1 변경행 영수증 미관찰·동시성 경계

- 기준 시점: 2026-11-01 00:42–00:48 KST. 시작 GitHub **main** SHA: `1a3a4e0362217a2ef49fe6d68612d3a70bf16dd2`; 관련 최신 A1/A2/A3 커밋과 열린 PR #16/#61 별도 확인.
- 단일 인수 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 시작 blob `66077cbe7109b6bfe5ed5e3be1e58ec8eba3d64f`. 전체 파일·기존 타 에이전트 기록을 덮어쓰지 않고 해당 ID에만 부분 증거 추가.
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 안의 계산 poll 영수증, **A4-IT-003 / A4-CALC-004 / A4-DATA-004 / X-046** 네 개 미완 체크. 관련 인계 정적 확인 `A4-DOC-013 / A4-LAW-006 / A4-AX-006`은 완료하지 않음.
- 역할 순환: **데이터담당자 → AX담당자 → IT담당자 → 서류담당자 → 계산사무장 → 변호사**. 직전 35차의 변호사 선행과 중복되지 않음.
- 읽은 실제 증거: `lib/case-data-recompute.ts` 시작 blob `c19584f1668b7f4849ac0fc8c910f7c1ce36187d`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/case-legal-automation.ts` blob `6257c1dab33636b87d9f6d4a82e0e6b72c77f9dd`, `lib/case-legal-calculation-preflight.ts` blob `c17892e63bf00d2981f292b0ef28e032d66a8dc7`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, `drizzle/0020_calculation_poll_fairness.sql` blob `f4906ad0dcefa4bdce67f00b104540d2266f890d`, r33/r34/r35 감사 영수증·기존 테스트·PR #16/#61.
- 원칙: 이 작업은 새로운 법률상 확정값·산식 의미·관할 적용 정책을 정하지 않으며, 고객 원본/OCR/키/비공개 답안은 사용하거나 Git에 저장하지 않음.

## 1. 새로운 결함 — DB UPDATE ACK 미관찰을 0행과 혼동

실제 `drainCaseDataUpdates` 함수의 변경 전 catch를 GitHub 파일에서 추출하고 V8 AsyncFunction으로 합성 실행. DB 응답 `meta.changes`를 0, 1, null, 속성 누락, 2로 주입. 독립 기대: **0행=lease 상실**, **1행=저장 성공**, **null/미관찰/다중행=저장 여부 확정 금지**.

| 합성 사건/독립 기대 | 수정 전 실제 관찰 | 수정 후 실제 관찰 |
| --- | --- | --- |
| 실패 UPDATE 0행: `superseded` | `superseded` | `superseded` |
| 실패 UPDATE 1행·1회차: `retry_wait` | `retry_wait` | `retry_wait` |
| 실패 UPDATE 1행·5회차: `failed` | `failed` | `failed` |
| 실패 UPDATE null: 불확정 오류 | 잘못 `superseded` | `CASE_CALCULATION_POLL_FAILURE_ACK_UNOBSERVED` |
| 실패 UPDATE `meta.changes` 누락: 불확정 오류 | 잘못 `superseded` | 위 오류 |
| 실패 UPDATE 2행: 불확정 오류 | 잘못 `retry_wait/failed` | 위 오류 |
| claim/retry UPDATE 0행 | 이미 선점됨/현행 실패 없음 | 동일 |
| claim/retry UPDATE 1행 | 선점 또는 수동 retry 성공 | 동일 |
| claim/retry UPDATE null·누락·2행 | 이전 코드에서 불확정 구별 불충분 | `CLAIM_ACK_UNOBSERVED` / `RETRY_ACK_UNOBSERVED` |

보수 수정: 각 mutation `meta?.changes===0` 및 `===1`을 명확히 구분, 그 밖에는 오류를 반환하여 **0행/미관찰/다중행을 거짓으로 합격 승격하지 않음**. 이는 D1 응답 유실 이후 실제 반영 여부를 조사하는 복구 기능이 **아님**. ACK 유실에 대한 영속 원장/재조회는 별도 필요.

- 코드 커밋: `4a85ae66b90995ad9a8aef193287fe2f23682350`; 코드 blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`.
- 신규 `tests/case-calculation-poll-ack-r36.test.mjs`: claim 5 + failure 10 + 수동 retry 5 = **20개 단언 시나리오 작성**. 문자열 이스케이프 교정 후 test blob `df46e9241338ca4de9a9772d3e29838bbb207953`, 교정 커밋 `d99ecb3f09b4af4e00a633e631875a5be049f43a`.
- **GitHub 수정 후 실제 원본에서 source-extracted V8 회귀 실행 20/20 관찰·독립 기대 일치**. Node-native `node --test`는 리포지토리 사본 및 의존성이 없어 **미실행**; 테스트 파일이 존재함을 전체 CI 성공으로 말하지 않음.

## 2. 다른 실제 재현(정상 + 결함을 모두 포함)

기존 감사에서 보존한 정확한 main SQL 계약을 독립 Python SQLite WAL 두 연결로 재실행. **16/16 관찰 일치**: 같은 판본 A/B 정상 claim 1·패자 0, 구 v7이 현행 v8 lease를 탈취하는 **실제 main 반례**, PR #16의 구 원본 판본 역전 차단, 동일 원본에서 기준정보 SHA A/B가 역전되는 **PR #16 미해결 반례**를 포함. **16개는 안전성 16건 합격이 아님.**

기존 head `UPSERT` SQL 독립 SQLite 재실행 **7/7 관찰 일치**: 같은 dataVersion/revision에서 이전 기준정보 A의 run이 현재 승인된 B head를 덮는 반례는 **미해결 P1**, reference epoch를 임의 가정·자동 승인하지 않음. 참고: 이전 r35 법률-worker SQLite 재실행은 9/9 기대 일치, 본 회차 계산 코드의 법률 종단 통과가 아님.

## 3. stage/예외·미실행 분리

- 상담 → 서류 분류/갈음 철회 → OCR 원본 변경 → 10분 quiet 계산: **원본 코드·10분 함수/DB 계약 검토**. 실제 변경-트리거→Cron→2-worker DB 종단은 **미실행**.
- 현재 계산 run/sourceDataVersion/caseRevision/reference SHA → 95개 법률 확인 → Word 초안 재생성 → 직원·변호사 검수 취소/재승인 → 실제 보정 사건: **연결 코드 정적 확인만**, end-to-end 실행·사람 승인 **미실행**. 현재 법률 사전검사/계산 head 참조의 기준 SHA·input SHA 경합은 추가 P1.
- 합성 timeout/429/503: 이번 테스트는 `CALC_SYNTHETIC_503` 오류 + DB ACK 0/1/null/누락/2 계약이며, 네트워크 429/503 실주입·재요청은 **미실행**.
- 실제 n8n: 설계/기록과 운영 인스턴스 구분. 운영 워크플로 실행 **미실행**.
- Cloudflare staging **D1/R2/Cron 미실행**. 실제 HTTP 이중 워커·실제 Word 바이트·법원 원문/보정 기한·사이트 배포 **미실행**.
- `미관찰`, 명시적 `null`, 계산값 `0`, `not_applicable`, `conflict`, `source-only`, 직원/변호사 `approval_pending`은 합쳐 판단하지 않음. 법적 인정/인가 자동 승격 없음.
- **4개 직접 체크 ID 전부 [ ] 미완료. 제품 최종 인수 0건. 운영 배포/운영 DB 마이그레이션/실제 전자제출·법원 인가 확정 없음.**

## 4. 다음 회차

1. `A4-IT-003`/`X-046`: PR #16 sourceVersion CAS 및 reference generation fence의 동일 원자 조건/실제 HTTP 2워커를 분리 검증. PR은 미병합, main에 고위험 정책 패치 금지.
2. `A4-CALC-004`/`A4-DATA-004`: 계산 head UPSERT를 참조 승인 판본·입력 SHA·run CAS와 연결, stale run이 법률 preflight/Word로 승격되지 않도록 보수적 PR 및 실무 검토.
3. `A4-AX-006`/`A4-LAW-006`/`A4-DOC-013`: 소유권 상실/새 원문/갈음 철회/관할 판본 변경→10분 재계산→95개 법률 검토→기존 Word/검수 승인 무효화 계약.
4. `A4-DATA-013`/`X-047`: staging R2 GET 바이트 SHA-256·D1 원장·감사 이벤트와 응답유실 후 재조회 검증. **staging 접근 전까지 미실행**.
