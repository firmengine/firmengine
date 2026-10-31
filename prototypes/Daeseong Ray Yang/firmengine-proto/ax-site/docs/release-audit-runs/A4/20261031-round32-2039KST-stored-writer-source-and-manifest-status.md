# FirmEngine A4 32차 — 저장 Writer 출처·Manifest lifecycle의 잘못된 감사 귀속 차단
2026-10-31 KST · `firmengine/firmengine` **main** · `ax-site/` 범위 · 공개 합성 사실만 기록 · 최종 제품 인수 0건

## 선행 확인·역할·범위
- 시작 main SHA `f1d8029152d2d3bc85b9ac807b649378c9fd1b41`; 읽은 기존 D1 projector blob `ab363387c48bfa9564ba723e2728ee91a2f06ef1`, 저장 Manifest adapter `e41dd7c085de756d4e22aebe3e12271236386cee`, triage `306daa4c445766b409b7d1f1d9b8e7f3bb20cffe`, `db/schema.ts`, R27~R31 테스트와 R31 영수증, 단일 보드, 최신 커밋, Draft PR #61 및 main/Draft Export route를 읽었다.
- 역할 순환 **변호사 → 데이터담당자 → AX담당자 → IT담당자 → 서류담당자 → 계산사무장**. 직접 합성 근거 대상 4개: `A4-DATA-013`, `A4-AX-003`, `A4-IT-005`, `X-047`. 관련 코드를 읽었지만 E2E 미실행: `A4-LAW-013`, `A4-DOC-011`, `A4-CALC-016`. 모두 **[ ] 유지**.
- `main`의 실제 `app/api/cases/[id]/export/route.ts`는 별도 post-commit `document_writer.prepared`·`export.generated` 이벤트를 남기며 **현재 export.generated.detail에 requestId가 없음**. 영속 요청 원장·동일 batch 감사 기록·0023 migration은 PR #61 **Open/Draft/미병합** 후보. 따라서 이 읽기 전용 projection의 긍정 테스트를 main의 실제 Export 동작으로 주장하지 않는다.

## 실제 재현 — 저장 Manifest의 출처가 다른데도 event를 동일 요청에 귀속
- 합성 입력: `case-synthetic`, `request-aaaaaaaa`, `artifact-aaaaaaaa`, caseRevision=3, sourceDataVersion=7, SHA=`a`×64. 합성 event Writer와 SQL/Manifest 파일 hash가 일치하는 기준 입력은 `auditEvents.length=1`(단지 request-scoped projection, 승인 아님).
- **수정 전 GitHub 실제 함수 V8 실행:** 현재 Manifest의 Writer `caseId=foreign-case`, `caseRevision=2`, `mode=final`, `referenceRelease.sha256=b×64` 각각에 대해 잘못된 `auditEvents.length=1`. 저장 Writer의 출처 누락/null 4종, 저장 Manifest revision·OCR sourceDataVersion·mode 변경 3종, 파일 archived/invalidated·status 누락/null 4종 역시 잘못 귀속. **부정 합성 15/15건 거짓 연결**.
- 독립 기대: 실제 관찰된 출처·원본판본·상태 충돌 → `conflict`; 필수 작성 출처/파일 상태 미관찰(null/누락) → `inconclusive`; 다른 요청의 과거 Manifest는 현재 Manifest로 승격하지 않음. 기존 `evidence_consistent_review_required` 또는 이벤트 연결 자체가 승인/제출을 증명하는 것은 아니다.

## 수정·실행 결과
- `lib/export-recovery-d1-reads.mjs`의 `checkExportGeneratedAudit()`: 같은 요청의 저장 `documentWriter`가 사건/리비전/모드/기준 SHA와 일치하는지 필수 확인. 관찰된 Manifest revision/sourceDataVersion/mode 및 파일 current 상태도 감사 귀속 전에 확인. 없거나 null이면 판단 보류하고 archive/invalidated·서로 다른 값은 충돌. `document_writer.prepared`의 미입증 request 귀속을 생성하지 않음.
- 회귀 `tests/export-recovery-d1-reads-r32-stored-writer-source.test.mjs` **17건 추가**. 새 테스트를 수정 전 함수에 적용했을 때 **15건 실패**, 수정 함수에서는 **17/17 PASS**. R27 20/20, R28 15/15, R29 17/17, R30 15/15, R31 21/21: **총 V8 격리 105/105 PASS**. R27의 기존 Manifest file 상태 분류 코드 `MANIFEST_FILES_NOT_CURRENT_OR_CONFLICT` 보존. R27은 합성 hash shim, R28은 `structuredClone` shim을 사용했으므로 Node-native SHA/전체 CI를 의미하지 않음.
- **별도 현재 회차 재실행**: 제공된 독립 SQLite 2-connection `round28_d1_r2_ack_concurrency.py`에서 중복 요청 claim 0, 서로 다른 UUID claim 2, A CAS 승자 1·B 패자 1, D1 응답 유실 후 다른 connection에서 A receipt committed 재조회, 패자 SQL/R2 보존 등 **13/13 PASS**. 이미 존재하던 합성 스크립트 재실행이며 main 실제 D1/R2 API나 PR route 실행이 아니다.
- 코드 커밋 `52e9a6a494a2312cf2c49bc6cb1395483a757f14`; 신규 테스트 커밋 `14533c8cda7e3ec81297bcea12ffc6f6d07a80c1`. 두 변경 모두 허용된 `ax-site/` 경로 내.

## E2E 경계·다음 체크
- `CASE_SCHEMA_CONTRACT.scheduling.sourceQuietMs=600000` 및 단계 `legal_calculation → lawgraph_review → automatic_draft` 정적 확인. `currentExportReviews`는 final·same revision·manifest fingerprint·직원 선행 검수를 조건으로 반환하며, `touchCase`는 생성물 무효화와 사람 검수 해제를 수행한다. **실제** 상담→서류→OCR→10분 계산→95법률→Word→직원/변호사 승인→법원 보정 이벤트의 stage/CAS/재생성 종단 검증은 **미실행**.
- 실제 Cloudflare **staging D1/R2/Cron 미실행**. 실제 R2 GET bytes SHA·staging ACK 유실·HTTP 두 워커·429/503/timeout·중복 webhook·n8n 운영 워크플로 **미실행**. 법률·법원 서식 전문검수, 운영 배포, D1 운영 migration, 전자제출 및 법원 인가확정 **미실행**. 비밀 키·.env·실고객 문서·OCR 원문·비공개 정답 미포함.
- 다음 직접 체크 `A4-DATA-013`+`X-047`: 인증된 staging D1 receipt/SQL/event와 독립 R2 GET SHA 확인 및 ACK 유실 후 재조회; `A4-IT-003`+`X-046`: 서로 다른 UUID 두 실제 HTTP 워커 CAS 및 패자 증빙 보존; `A4-DOC-011`+`A4-CALC-016`+`A4-LAW-013`: quiet→법률→Word 재생성/검수 무효화. 전체 체크 **[ ]**, 제품 인수 **0건**.
