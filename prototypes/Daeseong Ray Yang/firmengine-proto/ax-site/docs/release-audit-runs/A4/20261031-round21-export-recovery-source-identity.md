# FirmEngine A4 21차 — 복구 진단의 원천판본 거짓 일치 차단 (2026-10-31 KST)

## 범위·선행 점검
- 저장소: firmengine/firmengine, `main`, 수정범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 시작 `main` HEAD: `15cd639a55ab19bd2e83e5bf61c9fecb531cfe0e`. 최신 커밋 8건 및 Open PR 목록, Draft PR #61 (`e1a10be1e83516fa383d91f08dfdb62c7b530a5b`, Open/Draft/미병합) 확인.
- 읽은 자료: 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (시작 blob `a4031a27b3b4242756e6b4fe6f163a2376bd332a`), A4 20차 증빙, PR #61 `drizzle/0023_case_export_request_receipts.sql` 제안 스키마·`lib/export-request-ledger.ts`·Export route, main `lib/export-recovery-evidence.mjs`·기존 테스트·`lib/export-reconciliation.ts`·`lib/document-workflow-gate.ts`, 관련 문서 작성/계산·원본 버전 경계.
- 이 회차의 검토 주역 순서는 **계산사무장→변호사→서류담당자→IT→데이터→AX**. 20차 서류·변호사 중심 점검을 그대로 반복하지 않는다.
- 6역할+교차 선정: IT `A4-IT-005`, 서류 `A4-DOC-013`, 사무장 `A4-CALC-004`, 변호사 `A4-LAW-006`, 데이터 `A4-DATA-014`, AX `A4-AX-003`, 교차 `X-047`. 실제 함수를 대상으로 한 부분 검증 항목은 IT/DATA/AX/X의 4개만 보드에 기록. DOC/CALC/LAW는 승인·판본 인계의 읽기 전용 경계 확인에 한정; 계산 재실행·법률 승인·실제 Word 검수는 **미실행**. 모든 체크 `[ ]` 유지.

## 재현: 모두 일치하지만 실제로는 무효인 원천 신원
- 20차 `inspectExportRecoveryEvidence`는 receipt/현 사건 스냅샷·SQL 행·감사 이벤트의 필드가 **동일**하면, 두 값 모두 무효여도 `evidence_consistent_review_required`를 반환했다. 원천판본 자체의 유효성 검사 공백이며 실제 고객 데이터 사고를 관찰한 것이 아니다.
- 합성 기본값은 `synthetic-case / request-aaaaaaaa / artifact-aaaaaaaa`, 사건 revision=3, sourceDataVersion=7, referenceSha256=64자 a 해시, R2는 실제 바이트 해시를 확인한 것으로 가정한 **메모리 입력**이다. SQL·R2·audit는 가상 증빙이다.
- 독립 기대와 **수정 전 GitHub blob `62221fe813d8608bcb4d523a723fef8dd193a7c6`의 실제 Node 네거티브 컨트롤**:

| 바뀐 receipt 신원 (관련 필드도 같은 값으로 위조·반영) | 독립 기대 | 수정 전 실제 | 수정 후 실제 |
|---|---|---|---|
| `caseId=""` | 관찰된 신원 오류 `conflict` | 거짓 일치 | `conflict / RECEIPT_SOURCE_IDENTITY_INVALID` |
| `caseRevision=0` | 유효 판본 아님, `conflict` | 거짓 일치 | `conflict / RECEIPT_SOURCE_IDENTITY_INVALID` |
| `caseRevision=3.5` | 정수 판본 아님, `conflict` | 거짓 일치 | `conflict / RECEIPT_SOURCE_IDENTITY_INVALID` |
| `sourceDataVersion="7"` | 숫자 문자열은 확정된 정수 판본 아님, `conflict` | 거짓 일치 | `conflict / RECEIPT_SOURCE_IDENTITY_INVALID` |
| `referenceSha256="bad"` | 불량 해시, `conflict` | 거짓 일치 | `conflict / RECEIPT_SOURCE_IDENTITY_INVALID` |
| `sourceDataVersion=null` | `0`과 구분되는 미관찰, `inconclusive` | 거짓 일치 | `inconclusive / RECEIPT_SOURCE_NOT_OBSERVED` |
| `referenceSha256=null` | 미관찰, `inconclusive` | 거짓 일치 | `inconclusive / RECEIPT_SOURCE_NOT_OBSERVED` |
| 정상 신원 | `evidence_consistent_review_required`, 사람 판단 대기 | 기대일치 | 기대일치 |

- **수정 전 신규 Node 테스트 8개 중 1 PASS/7 FAIL**로 부정대조 재현. 기존 main 원본 테스트 22개는 원본 그대로 22/22 PASS.
- `lib/export-recovery-evidence.mjs`에 단순 신원 가드 추가: `null/undefined` 미관찰은 `RECEIPT_SOURCE_NOT_OBSERVED`, 관찰된 비정상 사건 ID·비정수/0 버전·불량 SHA는 `RECEIPT_SOURCE_IDENTITY_INVALID`. SQL/R2 동일성 확인, 사람 검수, 법원 상태를 이 가드로 대체하지 않음.
- **수정 후 GitHub 소스와 동일 Git blob SHA의 Node-native 회귀**: 기존 22 + 신규 8 = **30/30 PASS**. 소스 blob `015f6c3b268a46ac711621077ffa07856c5049f5`, 신규 테스트 blob `e630b980404fb7999f2fe20b36f0220ecf6f8e69`를 실제 로컬 `git hash-object`와 GitHub 재조회로 일치 확인.
- 기존 독립 SQLite 합성 계약 재실행: 19차 요청 예약·중복 webhook·두 UUID 워커·부분성공 **12/12 PASS**, SQL 원자성·CAS·응답 유실 **10/10 PASS**. 이 결과는 **PR #61 실제 TS/HTTP/D1/R2 실행이 아닌 독립 합성 SQL**.
- 모든 테스트 반환의 `canDelete/canReplay/canMarkCommitted/canApprove`는 false. **단위 진단의 거짓 일치 7건을 제거했지만 실서비스 저장복구 자체를 완성하지 않음**.

## stage 및 남은 실행 게이트
- 상담→서류→OCR→10분 quiet calculation→95 법률 검토→Word 초안→직원 검수→변호사 검수→실제 법원 보정 이벤트의 원본/CAS/승인/서식판본 **종단 실행 미실행**. 이 회차는 복구 진단의 원천 ID 유효성만 강화함.
- n8n 설계 문서 ≠ 실제 운영 연결. staging D1/R2/Cron, 서로 다른 두 실제 HTTP 워커, 모델 429/503/timeout 실 주입, 전체 TypeScript·Next 빌드·CI, 실제 Word 바이트, 법원 공식 서식·담당자/변호사 서명 및 법원 이벤트 미실행.
- 0023 migration 제안은 PR #61에만 있으며 적용하지 않음. 운영 배포/DB 변경/실제 전자제출/법원 인가 확정/개인정보나 키 커밋 없음.
- 진단 모듈은 Export HTTP route와 **미연결**, 자동 복구·재시작/삭제/승인 코드 없음. 정상 판정조차 `evidence_consistent_review_required`이고 확정/승격 아님.
- 다음 우선 체크 ID: `A4-IT-003` + `X-046` (두 실제 워커 claim/CAS), `A4-DATA-013` + `X-047` (R2 PUT 후 D1 미확정 증빙 읽기), 이어 `A4-DOC-013` + `A4-CALC-004` + `A4-LAW-006` (원본/관할 기준 변동 뒤 계산·법률·문서 승인 판본).
- 제품 전체 인수: **0건**. 체크 상태 `[ ]` 유지.
