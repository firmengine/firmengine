# FirmEngine A4 18차 — Export SHA 증빙형식·중복 current 진단 거짓 정상 차단

작성: 2026-10-31 KST. 이전: [17차](20261031-round17-precommit-r2-d1-evidence-preservation.md).

## 읽기 계약
- repo: `firmengine/firmengine`; 검사/변경 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. main 관찰 HEAD: `1c351bdc272133a69adcd05a147ee058a2b919a2`; tree: `995df318ce3178546e40d435bf30275d78d28195`. 기존 read-only helper blob: `9ee61e80123d2c267c65d497bc77baf8b9656e5b`; 중앙 보드 blob: `7d500b0af68a8ec8e0960cabdd444bef1b3173f0`.
- main 최근 커밋과 Draft [PR #61](https://github.com/firmengine/firmengine/pull/61) head `988ff9cb4fa822981b8487a7939bf6116bd50d15` 및 미병합 상태 확인. 관련 제안 SQL `0023_case_export_request_receipts.sql`, helper `export-request-ledger.ts`, `export-artifact-transaction.ts`, Export API route, 기존 `export-reconciliation.test.ts`와 17차 영수증 읽음.
- 이번 역할 순환 우선: AX → IT → 데이터 → 서류 → 변호사 → 계산사무장. **실행 근거가 있는 선택 ID**: `A4-IT-006`, `A4-DOC-011`, `A4-DATA-020`, `A4-AX-003`, `X-047`; 변호사 `A4-LAW-013`와 계산사무장 `A4-CALC-014`는 해당 생성/승인 단계 **미실행**이어서 합격 미표시. 해당 ID 전부 [ ] 유지.

## P1 후보 — 데이터 증거 정상판정의 부정대조
- 소스: `lib/export-reconciliation.ts` main 원본 함수. 합성 사건 `case-A4`, revision=3, 현재 artifact B, R2 objectKey=`cases/case-A4/artifacts/B`.
- **반례 A:** manifest.hash=`bad`, artifact SQL hash=`bad`, R2 alleged verifiedSha256=`bad`(64자리 SHA256 아님). 독립 기대 `currentArtifactsVerified=false` 및 오류/보존; 원본 V8 실제 `true`, issues=[].
- **반례 B:** current manifest에 동일 artifact ID B가 두 번, SQL/R2의 진짜 64자리 해시는 정상. 독립 기대 current 중복 차단; 원본 V8 실제 `true`, issues=[].
- 정상 대조: 일치하는 64자리 hex SHA + 단일 current manifest는 원본 `true`. R2 바이트 증거가 없으면 기존대로 `R2_PROOF_UNKNOWN`과 `false`.
- **범위:** 이 결함은 기존 읽기전용 진단 함수의 합성 부정대조이지, 실제 고객 R2 오염·운영 장애를 증명한 것은 아니다.

## 조치/실제 실행
- read-only helper에 current manifest ID 중복 및 manifest/SQL/실제바이트 SHA-256 형식 검사를 추가. 신규 경고 `CURRENT_MANIFEST_DUPLICATE_ID`, `CURRENT_MANIFEST_HASH_INVALID`, `CURRENT_SQL_HASH_INVALID`, `R2_BYTES_SHA_INVALID`. 복구·자동삭제·승인·계산 결과는 변경하지 않음.
- **V8 직접 함수본문 합성 실행 8/8 PASS**: 정상 current, 3계층 모두 불량 SHA, 중복 current, manifest만 불량, SQL만 불량, R2만 불량, R2 미관찰, 두 distinct current 정상. 독립 기댓값과 관찰 상태·issue code·autoDeleteAllowed=false 비교. 수정 전 원본에서 앞의 2개 결함은 거짓 정상 PASS를 실제 관찰함.
- 기존 14차 Python SQLite 원자계약 스크립트 `/mnt/data/firmengine-a4/sql_atomic_contract.py` 재실행 **10/10 PASS**: 합성 claim/두 worker/ACK loss/atomic audit 사례. 단 이것은 기존 SQL 계약 재실행이며 새 helper의 Node/Cloudflare 통합 검증은 아님.
- 신규 `tests/export-reconciliation-r18-hash-proof.test.ts` **작성**. 이번 회차 실제 Node test/전체 TypeScript/Next build/CI/staging D1·R2·Cron/HTTP 2 worker/Word 바이트/실무자 인수는 **미실행**. V8 변환은 함수본문의 TS 타입표현을 제거한 격리 재현으로, 전체 Node 실행 성공을 뜻하지 않음.
- `claimed/uncertain/committed` 증빙 triage는 여전히 **미완료**. 이 진단이 `currentArtifactsVerified`라 해도 D1 영수증·감사 2건·원본/ref/CAS/사람승인에 대한 인증이 아님.

## 상태/다음 검증
- `미관찰` R2 증거는 `false` 또는 `0`으로 강제하지 않음. invalid digest는 `상충/증빙불충분`; `source-only`, `비해당`, `승인전` 상태는 법률 확정으로 승격 금지.
- 다음 A4: `A4-IT-005`, `A4-DATA-014`, `X-047`에서 uncertain/claimed 영수증별 SQL/manifest/R2 SHA/이벤트 증거의 read-only 일치표(무결증거의 DB row 누락과 외부 ACK 유실 분리). `A4-IT-003`, `X-046`에서는 서로 다른 UUID 두 워커 경쟁/패자 orphan 보존. `A4-DOC-013`, `A4-CALC-014`, `A4-LAW-013`에서는 quiet 10분·95법률·Word 생성/재생성·직원→변호사 승인 무효화/보정기한 null 전이의 실제 종단 검증이 필요.
- n8n 설계와 운영 연결 구분. 운영 배포·운영 D1 migration·실제 전자제출·법원 인가/실제 고객자료 접근 **실행 안 함**. 전제품 인수 PASS **0건**. PR #61 open/draft/미병합 유지.
