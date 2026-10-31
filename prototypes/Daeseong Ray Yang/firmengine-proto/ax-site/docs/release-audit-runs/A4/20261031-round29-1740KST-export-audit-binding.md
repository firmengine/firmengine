# A4 29차 — export.generated 감사 payload 요청 귀속 검증 (2026-10-31 KST)

## 기준·범위·선행
- 저장소 `firmengine/firmengine`; main 시작 HEAD `25f9596b7bccfb170a820a3c22f68de5b314e7bb`; 기존 `lib/export-recovery-d1-reads.mjs` blob `9b2981533c38929a9b9c12d419bfb88b0e6dcacc`; 중앙 보드 blob `36dfcdc0022741c88869301d234244941b610cd5`.
- 최근 2026-10-31 main A3 r29/A2 r29/A1 r29 커밋과 A4 r28 영수증 및 회귀 `tests/export-recovery-d1-reads-r27.test.mjs`, `tests/export-recovery-d1-reads-r28-root-gate.test.mjs` 검토. Draft PR #61은 open/draft/미병합, HEAD `e1a10be1e83516fa383d91f08dfdb62c7b530a5b`; 제안 0023 D1 원장과 Export route의 `export.generated` 실 payload(리비전·모드·요청 ID·파일 ID/해시/종류·writerReceipt)를 확인했다. 0023 migration은 main 운영 스키마가 아니다.
- 순환: **AX → 데이터 → IT → 서류 → 계산사무장 → 변호사**. 직접 합성 체크 4개: `A4-IT-005`, `A4-DATA-013`, `A4-AX-003`, `X-047`. source-only·업무 E2E 미실행 3개: `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`. 교차 X-047 포함. 모든 ID `[ ]`.

## 수정 전 실제 반례
- main 원문 `projectExportRecoveryD1Reads`를 V8로 실행. D1 receipt ID/판본은 동일하지만 `export.generated.detail`에 **모드 final 대신 draft, 잘못된 artifact ID, SQL/Manifest와 다른 hash, 구판본 writer receipt, 서로 다른 이벤트 revision**을 합성 투입.
- 관찰: 모드/파일 ID/해시/writer 정보가 상충하는 **5종**에서 함수가 `auditEvents:[{type:"export.generated", caseId, requestId, revision}]`를 그대로 생성했다. revision이 다른 추가 반례는 조용히 필터링했다. 이는 실제 운영 잘못된 감사 이벤트 발생이 아니라 **합성 레코드에 대한 잘못된 증빙 귀속 로직**이다.
- 독립 기대: 같은 requestId라도 출처 판본/모드/계획 파일 ID·해시/writer 출처가 모순되면 요청 감사증빙으로 귀속하지 않고 `conflict`; 관찰되지 않은 내용은 `inconclusive`; 다른 요청 ID와 legacy 무ID 이벤트는 증빙에 미포함.

## 검증 및 적용
- `lib/export-recovery-d1-reads.mjs`의 읽기전용 D1 event projection에 request-scoped payload 검사 추가. receipt plan, mode/revision, SQL hash, 저장 Manifest 파일 hash, embedded writer receipt case/revision/mode/reference SHA 대조. 명시적 null/누락은 판정 보류, 관찰된 충돌은 conflict. actor/time으로 writer.prepared 요청 귀속 **금지 유지**.
- 신규 `tests/export-recovery-d1-reads-r29-audit-payload.test.mjs` 합성 회귀 **17건 작성**. 실제 main 코드 수정 후보를 JS V8 격리 평가한 입력/독립 기대/관찰 **17/17 일치**: 정상 이벤트 1, 본문 모드·revision 충돌 2, 누락 mode 1, 외부 파일 ID·중복 ID·불량/null hash·SQL/Manifest hash 상충 5, writer 원본 모순/누락 3, 원장 계획 미관찰/형식 오류 2, 타 request/기존 무ID 이벤트 비귀속 2. 실제 Node-native 신규 테스트는 실행하지 않았음.
- 정상 입력에 대해 `export.generated` event만 1개 귀속하고 별도 `document_writer.prepared` 이벤트의 request binding은 **미증명** 상태로 유지. 어떤 결과도 `canDelete`, `canReplay`, `canMarkCommitted`, `canApprove`를 true로 변경하지 않음.
- 코드 존재·V8 합성 PASS ≠ Node-native PASS ≠ 전체 CI ≠ staging D1/R2 ≠ 운영 n8n/Cron ≠ 공식 법원 서식 확인/변호사 승인 ≠ 배포.
- 상담→서류→OCR→10분 quiet 계산→95 법률→Word→직원/변호사→보정 이벤트의 stage/version/CAS/사람 승인 실제 E2E 미실행. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 하지 않음.
- 고객 문서·개인정보·OCR 원문·키/.env·비공개 정답 없음. 이 작업은 읽기전용 진단과 테스트 및 보드/영수증만 수정.

## 여전히 남은 복구 위험·다음 체크
1. `A4-DATA-013`, `X-047`: 인증된 staging D1 receipt/SQL event + **실제 R2 GET 바이트 SHA** 조회/응답유실 후 독립 확인·수동 대조. 이번 미실행.
2. `A4-IT-003`, `X-046`: PR #61의 서로 다른 UUID 두 HTTP worker 경합·중복 웹훅, 최종 CAS 패자 orphan SQL/R2 보존 실험. 이번 미실행.
3. `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`: 원문 교체·갈음 철회·관할판본 변경→quiet timer→법률95→Word 재생성→이전 직원/변호사 승인 무효화. 실행 및 실무자 확인 필요.
4. 실제 n8n 운영 연결과 설계만의 워크플로 구분. staging D1/R2/Cron 미실행, 전체 CI·Node-native 미실행. 최종 제품 인수 0건.
