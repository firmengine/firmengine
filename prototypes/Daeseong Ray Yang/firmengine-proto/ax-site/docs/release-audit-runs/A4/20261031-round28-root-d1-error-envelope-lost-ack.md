# FirmEngine A4 28차 — D1 READ 최상위 오류 봉투/NULL 충돌 및 ACK 분실 합성 경합

2026-10-31 KST | 정확한 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` | 합성 데이터만 | 제품 최종 인수 **0건**

## 선행 확인·역할·ID
- 시작 main HEAD `f3b146f4b1ffd9c3c9493c3575ed368215f371e4`; 중앙 보드 blob `a5d44ed2f3ac7a815f1e30af467d1fadab90e235`; 코드 blob `336f2e74fd61400ef958cd8f871e36c53b24cc61`. 최근 A1/A2/A3/A4 커밋, A4 27차 영수증, PR #61 Open/Draft/미병합을 확인했다. PR #61의 `0023_case_export_request_receipts.sql`, `lib/export-request-ledger.ts`, `lib/export-artifact-transaction.ts`, Export route를 읽었다. **0023는 main/운영 D1 migration이 아니다.**
- main 실제 코드: `lib/export-recovery-d1-reads.mjs`, `lib/export-recovery-stored-manifest.mjs`, `lib/export-recovery-evidence.mjs`, `lib/document-writer.ts`, `lib/document-workflow-gate.ts`, `lib/case-workflow-context.ts`, `lib/execution-catalog.ts`; 기존 `tests/export-recovery-d1-reads-r27.test.mjs` 확인.
- 6역할 순환: **변호사 → 서류담당자 → 계산사무장 → 데이터담당자 → AX담당자 → IT담당자**, 직전 회차 시작 역할과 다름. 7개 체크 선택: `A4-IT-011`, `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`, `A4-DATA-013`, `A4-AX-023`, `X-047`. 직접 합성검증 연계 4개: IT/DATA/AX/X. 서류·사무장·변호사 항목은 인계 경계 **source-only**, 실제 업무 승인 미실행. 7개 **모두 [ ]**.

## 실함수 수정 전 독립 부정대조
- GitHub main 원본 `projectExportRecoveryD1Reads(null)` 실행 시 실제 **TypeError** 발생. `{status:503,error:"synthetic"}` 및 `{error:"timeout"}` 최상위 오류 봉투는 **D1_RECEIPT_NOT_OBSERVED/inconclusive**로 오분류되어 실제 조회 실패 원인을 은폐했다. `{status:429}`/배열도 부정확한 봉투 처리. 이는 실제 운영 장애가 아니라 오류 봉투 **합성 입력을 실제 소스 함수에 투입한 결과**이다.
- 루트 null은 `inconclusive/D1_READ_INPUT_NOT_OBSERVED`, 명시적 429·503·timeout/비객체 봉투는 `conflict/D1_READ_INPUT_INVALID`로 분류한다. 정상 `{}`와 `receiptRow:undefined`는 `D1_RECEIPT_NOT_OBSERVED`, 실제 `receiptRow:null`은 `D1_RECEIPT_OBSERVED_ABSENT`을 유지한다. R2/SQL/audit 중첩 오류 봉투도 기존 분류를 보존한다.
- 저장/회복 데이터 변경 없이 **읽기 전용 입력 가드만** 수정했다. 자동삭제·재시도·완료처리·법률 승인 권한 모두 false.

## 실제 실행한 검증·입력·독립 기대·관찰
- GitHub 실제 수정 후보 함수 원문을 V8 격리 실행: null, undefined, 503, 429, timeout, Error 인스턴스, [], 숫자, {}, receipt null, D1 artifact 503, R2 proof 429, audit timeout, 정상 receipt 투영. 각각 독립 예상 분류/코드와 비교해 **14/14 PASS**. 기존 함수에서 null TypeError 및 최상위 503·timeout 오분류를 먼저 확인했다. **Node-native/전체 CI를 실행한 것은 아니다.**
- 별도 두 개 SQLite 연결(WAL)에 전부 가상의 case/request/artifact/해시만 저장한 SQL 경합 스크립트 `/mnt/data/firmengine-a4/round28_d1_r2_ack_concurrency.py` 실행: **13/13 PASS**. A/B 서로 다른 요청 둘 다 claim → 중복 A webhook claim 0행 → 각 R2 합성 바이트+SQL 행 예약 → A CAS·manifest·event·receipt COMMIT → **ACK 값을 의도적으로 소실** → 두 번째 연결에서 A committed 재조회 → B의 구 storage_token CAS 0행 → B uncertain 및 R2/SQL 고아증빙 보존. 이는 **PR 제안 의미를 근사한 자체 SQLite 합성 계약**이지 PR TypeScript 원함수/실제 Cloudflare D1/R2 HTTP를 실행한 것은 아니다.
- `tests/export-recovery-d1-reads-r28-root-gate.test.mjs`에 Node-native 회귀 **15건 작성, 실행 미실행**. 코드 반영 전 대상은 실제 GitHub 원문을 V8에서 실행한 것이다.

## 인계·위험·분리
- 상담→서류→OCR→10분 quiet 계산→법률 95→Word 초안→직원·변호사→실제 보정 이벤트: main stage/작성 게이트 소스 참조 수준이고 종단 상태·버전·CAS·승인 검증 **미실행**. writer의 `courtApprovalInferred:false`, `readyForElectronicFiling:false`, `officialFormParity:not_verified`는 법원 승인/공식 서식 확인을 의미하지 않는다.
- n8n 설계 문서와 운영 workflow 구분; 실제 운영 n8n 실행 미실행. Cloudflare staging D1/R2/Cron·두 실제 HTTP 워커·Word/직원/변호사 검토·전체 CI/배포 **미실행**. 429/503/timeout은 실제 장애 주입이 아니라 합성 봉투.
- `uncertain`은 증빙 불충분이며 승인/완료/자동삭제/무조건 재생성과 다르다. D1 ACK 분실은 SQL 재조회 없이는 성공/실패로 확정하지 않는다. 이 수정은 **분류기 진입점 가드**만 개선하며 운영 복구 경로가 완성되지는 않았다.
- 실제 고객 문서/개인정보/OCR 원문/키/env/비공개 정답 공개 Git 반영 없음. 운영 배포·운영 migration·실제 법원 전자제출·인가 확정 시행하지 않음. **제품 최종 인수 0건**.

## 다음 체크
- `A4-DATA-013` + `X-047`: 읽기전용 staging D1 receipt/SQL/R2 GET 바이트·actual `export.generated` event 연결 검증 및 ACK 분실 후 재조회 (현재 미실행).
- `A4-IT-003` + `X-046`: PR #61 실제 HTTP 두 워커 경쟁, CAS 패자 고아 artifact SQL/R2 보존, 중복 webhook (미실행).
- `A4-DOC-011` + `A4-CALC-016` + `A4-LAW-013`: 원본 변경·갈음 철회·관할 기준 판본 변경→10분 quiet→95 법률→Word 재생성→승인 무효화/재검토를 실제 권한 경계에서 검증 (미실행).
