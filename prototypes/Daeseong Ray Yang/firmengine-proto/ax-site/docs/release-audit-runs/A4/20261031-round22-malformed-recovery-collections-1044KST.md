# FirmEngine A4 22차 — 복구 증빙 조회 실패·스키마 오류가 진단기를 중단시키는 결함

날짜: 2026-10-31 KST · 축: A4 실행 흐름/예외/동시성/복구 · 모든 사례 **합성** · 최종 인수: 0건

## 원천 확인 및 범위
- 시작 GitHub **main HEAD**: `2f727cf95817bfb52d4f88297f001706dcd58bae`. 해당 시점 최근 커밋은 A3 22차 `2f727c`, A2 22차 `eca45b`, A1 22차 `a13ae7`, A4 21차 `7afb003`. Open PR 목록 및 A4 Draft **#61**, head `e1a10be1e83516fa383d91f08dfdb62c7b530a5b`, 미병합 확인.
- 읽음: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 시작 blob `d61cdf77ff192dcdb08b4e79d2610bdd48a51f2e`, A4 21차 영수증, main `lib/export-recovery-evidence.mjs` blob `015f6c3b268a46ac711621077ffa07856c5049f5`, 기존 회귀 22건·21차 회귀 8건, main `lib/document-workflow-gate.ts`, `lib/server-store.ts`, PR #61의 `lib/export-request-ledger.ts` 및 **제안만 된** `drizzle/0023_case_export_request_receipts.sql`.
- 역할 순환 주역: **데이터 → AX → IT → 서류담당자 → 계산사무장 → 변호사**. 이번 실제 부분 검증 보드 ID는 `A4-IT-011`, `A4-DATA-014`, `A4-AX-023`, `X-047` (4개). 교차로 검토만 한 `A4-DOC-017`, `A4-CALC-004`, `A4-LAW-006`은 해당 업무·승인 실험 미실행. 6역할+X 모두 **[ ] 유지**.

## 재현 및 독립 기대 오라클
입력은 `synthetic-case / request-aaaaaaaa / artifact-aaaaaaaa`라는 가상 사건·요청·생성물, 사건 revision 3, sourceDataVersion 7, SHA-256 형식의 64자 `a` 반복값과 가상 SQL/R2/audit 영수증. 실제 고객·법원·운영환경 값이 아님. R2 바이트는 읽었다고 *가정한* 합성 증빙이며 실제 R2 읽기 아님.

| 사건 주입 | 독립 기대 | 수정 전 main 실제 함수 V8 | 수정 후 실제 함수 V8 |
|---|---|---|---|
| 정상 `uncertain` + 자료 일치 | 사람 검토 필요 | `evidence_consistent_review_required` | 동일 |
| D1 503 응답 객체를 SQL rows 자리에 전달 | 명시적 스키마 오류, 승인/자동삭제 금지 | **TypeError throw** | `conflict/SQL_ROWS_INVALID` |
| SQL rows=[null] | 명시적 스키마 오류 | **TypeError throw** | `conflict/SQL_ROWS_INVALID` |
| R2 429 응답 객체를 proofs 자리에 전달 | 명시적 스키마 오류 | **TypeError throw** | `conflict/R2_PROOFS_INVALID` |
| R2 proofs=[null] | 명시적 스키마 오류 | **TypeError throw** | `conflict/R2_PROOFS_INVALID` |
| 감사 이벤트 timeout 응답 객체 | 명시적 스키마 오류 | **TypeError throw** | `conflict/AUDIT_EVENTS_INVALID` |
| auditEvents=[null] | 명시적 스키마 오류 | **TypeError throw** | `conflict/AUDIT_EVENTS_INVALID` |
| D1 rows=null / [] | 미관찰 vs 실제 0행 분리 | 기대 일치 | `SQL_ROWS_NOT_OBSERVED` vs `R2_WITHOUT_SQL_ROW` 유지 |
| R2 proofs=null / [] | 미관찰 vs 실제 빈 목록 분리 | 기대 일치 | `R2_PROOFS_NOT_OBSERVED` vs `R2_PROOF_UNKNOWN` 유지 |
| auditEvents=[] | 관찰된 이벤트 부재 | 기대 일치 | `AUDIT_EVENTS_OBSERVED_INCOMPLETE` 유지 |
| 타 사건 SQL / 원본판본 변경 / 역사 manifest / R2 SHA 상충 | 각각 conflict/stale/historical/conflict | 기대 일치 | 기존 분류 유지 |

6개 예외는 **원본 main SHA의 실제 함수 본문을 읽어 V8에서 실행하여 재현**. 조회 응답 포장 객체는 실제 Cloudflare API가 반환한 것이 아니라 장애·스키마 오용의 합성 입력이다. 자동 장애 주입 및 실제 운영 스키마 오류를 확인했다고 주장하지 않는다.

## 변경과 검증
- `lib/export-recovery-evidence.mjs`: SQL row/R2 proof/audit event 입력이 null이면 **미관찰**, []이면 **관찰된 0개**, 비배열 또는 null/배열/primitive 원소가 포함된 목록이면 **관찰된 불량 스키마(conflict)**로 분류. 불량 콜렉션에 `.filter/.some`을 호출하지 않고 정합성 권한을 생성하지 않는다. 코드 수정은 read-only helper 내에 한정.
- 코드 반영 commit: `2329c8b440389c749bd9bfe6453a056a3d88338f`, 새 blob `ddb960593ffb4bd2cd50c869f77c5dae450a47fe`.
- 회귀 테스트 추가: `tests/export-recovery-evidence-r22-malformed-collections.test.mjs` (합성 12개 Node-native `node:test` 케이스). commit `62330fae61cf3f120ea64c80b66ed9b0bda95c5b`. **테스트 파일을 GitHub에 작성·커밋했지만 이번 회차 Node-native 실행은 미실행.**
- 변경 본문을 커밋 **직전 동일 문자열로 V8 격리 실행 16/16 PASS**: 위 6개 부정대조, 정상/NULL/0행·이벤트부재/타사건/판본변경/역사 manifest/R2 SHA 상충 10개 회귀. 모든 `canDelete/canReplay/canMarkCommitted/canApprove=false`.
- 독립 이전 SQLite 합성 스크립트(저장소 현행 D1 연결 아님) **직접 재실행**: 19차 계획예약/두 UUID 워커/재전달/부분성공 12/12 PASS, 기존 SQL batch/응답유실 CAS 10/10 PASS. 스크립트는 컨테이너 `/mnt/data/firmengine-a4/` 로컬 파일이며 새 운영코드의 실제 D1 실행 증거 아님.

## 실행 경계 및 후속
- PR #61은 **Open/Draft/미병합**; 0023은 **미적용 제안 migration**. 이번 main 변경은 읽기 전용 복구 분류기뿐이며 Export HTTP 경로·워커·R2·D1에 연결하거나 자동 복구 권한을 추가하지 않았다.
- 상담→서류→OCR→10분 quiet calculation→95 법률 점검→Word 초안→직원/변호사 검수→**실제** 보정 사건의 버전/CAS·승인 인계: **종단 미실행**. 서류 부분 업로드/계산 current head/기존 법률 승인 무효화는 코드 일부만 살폈으며 이 회차 합격 근거가 아니다.
- staging D1/R2/Cron 및 2 HTTP 워커·실제 429/503/timeout·전체 npm/TypeScript/Next CI·실제 Word 바이트·법원서식/직원·변호사 승인: **미실행**. n8n은 설계 문서와 운영 연결을 동일시하지 않으며 운영 워크플로 미실행.
- 운영 배포/운영 D1 migration/전자제출/법원 인가 변경 없음. 비공개 원본·OCR 사실/키·env 또는 개인 식별 정보 커밋 없음.
- 다음 미완 검증: `A4-IT-003` + `X-046` 실제 두 워커 claim/CAS; `A4-DATA-013` + `X-047` 실제 R2 PUT/D1 ACK 재조회 및 영속 복구; `A4-DOC-013` + `A4-CALC-004` + `A4-LAW-006` 원본·법원판본 변경→재계산·Word 재생성→독립 검수 인계. 모든 인수 체크 **[ ]**, 최종 승인 **0건**.
