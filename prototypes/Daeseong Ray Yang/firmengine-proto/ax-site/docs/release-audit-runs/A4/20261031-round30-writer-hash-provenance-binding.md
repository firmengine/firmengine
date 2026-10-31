# FirmEngine A4 30차 — Export 감사 이벤트·Writer 렌더 해시 및 인계 출처 대조
2026-10-31 KST | **main / ax-site 한정** | 합성 입력만 사용 | 제품 최종 인수 0건

## 기준 / 기존 작업 / 역할
- 최초 확인 main HEAD `210b940b727baad3bf0e54e2d776cb870ca011d1`; A4 원본 `lib/export-recovery-d1-reads.mjs` blob `e48f1ae12d2424a9d80c2d0c5b9ed83bb9c6abad`; 보드 blob `232183a3a983c81a0ecf9a6088409c695e17eab3` (감사 시작 시점).
- 최근 main A3/A2/A1 커밋과 A4 29차 영수증·테스트, 관련 main의 D1 복구 진단 3개 모듈, main `lib/document-writer.ts`, `lib/document-workflow-gate.ts`, 미병합 [Draft PR #61](https://github.com/firmengine/firmengine/pull/61)의 0023 D1 영수증 스키마·원장·Export route를 읽었다. PR #61 Open/Draft/미병합, head `e1a10be1e83516fa383d91f08dfdb62c7b530a5b` (회차 확인 당시). 0023은 main 또는 운영 D1 migration이 아니다.
- 역할 순환: **서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자**. 직접 합성 점검: `A4-DATA-013`, `A4-AX-003`, `A4-IT-005`, `X-047` (4개); 관련 source-only/미실행: `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`. 7 ID 모두 `[ ]`.

## 발견 — 이전 감사 이벤트가 다른 렌더 결과를 같은 Export 요청에 붙임
- 실제 PR의 `finalizeDocumentWriterReceipt`는 렌더된 생성물의 `artifactHashes` 배열을 남기고 `export.generated.detail.writerReceipt`, `exportManifest.documentWriter`에 기록한다. `export.generated.detail.files`에도 `id/hash/kind`가 기록된다. 세 증빙의 불일치는 안전한 요청 귀속을 차단해야 한다.
- **수정 전 GitHub main 원본문 V8 독립 부정대조**: 동일 request ID/case/revision/mode, event 파일 hash=`a×64`, SQL·Manifest 파일 hash=`a×64`인데 `writerReceipt.artifactHashes=[b×64]` 투입 → **auditEvents 1건으로 거짓 귀속**. event writer `inputSha256=b×64` vs 저장 Manifest writer `inputSha256=a×64` 또는 저장 Manifest `evaluationResultHash=b×64`도 잘못 귀속. `artifactHashes=[]` 및 명시적 null에서도 event가 붙음. 합성 자료이며 운영 저장물 변조의 증거는 아니다.
- 독립 기대: 실제 렌더 해시 목록은 순서 무관·중복 보존 multiset으로 대조한다. 명시적 null=미관찰(`inconclusive`), 빈 배열·불량 해시/형식=상충(`conflict`), 다른 렌더 해시 또는 Manifest 작성 출처·평가/바인딩 해시가 명시적으로 다르면 `conflict`. 이전 요청/다른 Manifest는 현재 요청으로 재귀속하지 않는다.

## 수정 및 재현
- main `lib/export-recovery-d1-reads.mjs`: **읽기 전용** D1 export audit binding 검증에 Writer 렌더 해시 목록 vs event.files 해시 multiset 및 저장 Manifest writer 출처(`schemaVersion`, `inputSha256`, `evaluationId`, `evaluationResultHash`, `bindingsSha256`, `documentEditsHash`, `generatorVersion`, `formContractVersion`)가 양쪽에 관찰된 경우에 한해 일치 검사. 누락 필드를 임의로 추정하지 않음. 비교된 writer `artifactHashes`의 null·불량·상충 별도 분류. 해시 대소문자는 바이트 SHA 표기 차이이므로 대조 시 정규화.
- 신규 `tests/export-recovery-d1-reads-r30-writer-provenance.test.mjs`: 가상 D1/Manifest/event만 사용하는 회귀 15건. 예상·실제 결과: 정상 1, 이벤트 writer 해시 상충/불량/빈 배열/NULL 5, 저장 writer 평가·입력·바인딩·해시 상충/형식·null 6, 해시 대소문자 정상 2, 별도 Manifest 요청 1. **V8 합성 15/15 기대 일치**.
- **기존 회귀 결함도 실제 재현**: R27 합성 이벤트가 R29 이후 필수인 `mode/files`를 빼서 원래 r27 테스트 20건 중 10건이 현재 진단 코드와 불일치했다. `tests/export-recovery-d1-reads-r27.test.mjs`의 **합성 event fixture만 실제 PR의 export.generated payload 구조에 맞게 수정**. R27 V8 재실행 **20/20 일치**.
- GitHub 반영 코드·테스트 원문을 V8에 불러 테스트 assertion을 실행한 범위: **R27 20/20 + R28 15/15 + R29 17/17 + R30 15/15 = 67/67**. 외부 Node test runner가 아니라 JS V8 시험 하네스이며, R27의 `createHash`는 결정적 **합성 해시 함수**를 주입해 호출하므로 실제 SHA-256 구현 정확성 검증이 아니다. R28 `structuredClone`도 테스트 하네스로 대체. **Node-native, 전체 CI, TypeScript, Next build 실행하지 않음**.
- 코드 변경은 진단/테스트 3개 + 이번 A4 영수증 및 중앙 보드(선택 ID만 append)로 한정. 외부 경로 및 기존 병렬 에이전트 코드 변경 없음. 실제 R2 GET byte digest 확인, D1 ACK loss HTTP, staging DB, n8n 운영 연결 미실행. 모든 결과 `canDelete/canReplay/canMarkCommitted/canApprove=false`.

## 상태·직무·인계 구분
- D1 receipt의 `claimed/uncertain/committed`, R2 바이트 GET 미관찰, SQL 0행, 오류 429/503/timeout, 원본 revision 변경, Writer 바이트 무결성, staff/lawyer 승인 등은 서로 다른 상태. 이번에는 **합성 Writer 증빙 상충만 실제 실행 검증**; `source-only`는 승인 또는 완료가 아니다.
- 상담→서류→OCR→10분 quiet calculation→95법률→Word 초안→직원/변호사 검수→보정 이벤트의 stage/version/CAS/인계 종단 테스트 **미실행**. 서류 `A4-DOC-011`, 계산 `A4-CALC-016`, 변호사 `A4-LAW-013`은 writer/manifest 코드 출처 확인만, 실제 문안 재생성/계산/변호사 판정/보정 처리 **미실행**.
- n8n 운영 워크플로 실행은 설계 문서의 존재와 별개이며 이번 회차 미실행. Cloudflare staging D1/R2/Cron, 실제 두 HTTP 워커 경쟁, 429/503 장애 주입, 운영 사이트 배포, 운영 D1 migration, 전자제출, 인가 확정 **하지 않음**. 공개 Git에 고객 서류·개인정보·OCR 원문·키·.env·비공개 정답 없음.

## 미완료 복구 및 다음 ID
1. `A4-DATA-013`, `X-047`: 인증된 **staging** 요청 원장/SQL/감사 이벤트 SELECT, R2 실제 GET 바이트 SHA, D1 ACK 유실 후 영수증 재조회 및 R2 성공/D1 실패 분리. **미실행**.
2. `A4-IT-003`, `X-046`: 서로 다른 request UUID 두 HTTP 워커 CAS 경합, 패자 SQL/R2 고아 증빙 보존·중복 웹훅·timeout/429/503. **미실행**.
3. `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`: 원본 변경·갈음 철회·관할판본 변경 후 10분 quiet→95 법률→Word 재생성→기존 승인 무효화와 새 사람 승인 경계. **미실행**.
4. Draft PR #61 통합/CI/실무 검토 필요. 읽기전용 진단 PASS는 PR 병합·운영 복구 완성·법률 인정이나 공식 법원 서식 일치가 아님. **제품 최종 인수 0건**.
