# FirmEngine A4 31차 — Writer 필수 증빙 누락·동일 불량값의 감사 귀속 차단
2026-10-31 KST | `firmengine/firmengine` main `ax-site/` 한정 | 공개 가능한 합성 사건만 사용 | 제품 최종 인수 0건

## 선행 판본·인수 ID·역할 순환
- 기준 main HEAD `0fa451ca5d43bf109124a13d6ae8093ab76ab191`, tree `e44fda81bdf50d24123f9fa86d886f3844b5f366`. 코드 원본 blob `85798936d43fb660a5df4512a5acb83fe3463ac0`, 보드 원본 blob `2cab4547fb6917da8e29c0f0bce7eaeb5d4e163e`. 원자 커밋을 위한 main HEAD CAS와 범위 내 파일만 변경.
- 이전 A4 30차 영수증, R27~30 테스트, main `lib/export-recovery-d1-reads.mjs`, `lib/export-recovery-stored-manifest.mjs`, `lib/export-recovery-evidence.mjs`, `lib/document-writer.ts`의 `DocumentWriterReceipt` v2, `db/schema.ts`, 통합 Export PR #61(확인 당시 Open/Draft/미병합)의 저장 원장·Export route·0023 SQL을 읽음. PR 0023은 main 배포/운영 마이그레이션이 아님.
- 역할 순환: **계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 서류담당자**. 실제 합성 검증 대상 `A4-IT-005`, `A4-DATA-013`, `A4-AX-003`, `X-047` (4개); 코드상 인계만 검토한 `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013` (source-only). 모든 ID `[ ]` 유지.

## 실제 부정 재현 (수정 전 main 원본 V8 함수)
- 합성 D1: caseId=`case-synthetic`, requestId=`request-aaaaaaaa`, artifactId=`artifact-aaaaaaaa`, revision=3, sourceDataVersion=7, 해시=`a` 64회 반복. 이 값은 실제 고객 자료와 관계없음.
- 정상 event+Manifest Writer 일치 → `auditEvents.length=1` (positive projection, 승인 아님).
- `export.generated.detail.writerReceipt.artifactHashes` 필드를 삭제 → 잘못된 `auditEvents.length=1`.
- 저장 Manifest `documentWriter.artifactHashes` 삭제 → 잘못된 `auditEvents.length=1`.
- 이벤트 Writer `inputSha256` 삭제 → 잘못된 `auditEvents.length=1`.
- 저장 Writer `inputSha256` 삭제 → 잘못된 `auditEvents.length=1`.
- 저장 Writer `evaluationResultHash` 삭제 → 잘못된 `auditEvents.length=1`.
- 독립 기대: v2 필수 출처가 어느 한쪽이라도 미관찰/명시적 null이면 `inconclusive`; 서로 일치하는 잘못된 해시/구형 스키마/빈 버전은 `conflict`; 역사 Manifest를 현재 요청으로 재귀속하지 않음. 이 오판은 **합성 이벤트 바인딩** 결함이며 운영 저장물 조작 또는 실제 제출 완료의 증거가 아님.

## 코드 변경과 독립 결과
- `lib/export-recovery-d1-reads.mjs`: event Writer의 `artifactHashes` 목록 필수화. 현재 Manifest에 `documentWriter` 자체가 없거나 이벤트/Manifest 중 한쪽에서 v2 필수 출처 필드(`schemaVersion,inputSha256,evaluationId,evaluationResultHash,bindingsSha256,documentEditsHash,generatorVersion,formContractVersion`)가 누락/null인 경우 감사 귀속 보류. 유효한 v2 버전·SHA-256 형식·비어 있지 않은 버전인지도 확인. 파일 digest multiset, 실제 이벤트 파일, 저장 Writer 다자 비교 및 대소문자 동치 유지.
- R27/R29/R30 기존 합성 Writer fixture를 실제 v2 필수 필드에 맞게 수정. SQL·Manifest 개별 해시 충돌 테스트는 Writer 해시도 이벤트 바이트에 맞게 변경해 원래 시험 대상인 DB/Manifest 충돌만 분리. 기존 부정 시험 결과는 모두 유지.
- 신규 `tests/export-recovery-d1-reads-r31-required-writer-fields.test.mjs` 21건: 정상/필수 필드 제거/null/같은 불량 형식/렌더 해시 상충/대소문자/역사 Manifest.
- **실제 V8 격리 실행**: R27 **20/20**, R28 **15/15**, R29 **17/17**, R30 **15/15**, R31 **21/21** = **88/88 PASS**. 테스트 본문 단언을 실행한 결과. R27 `createHash`는 동일 입력에 동일 출력을 내는 합성 다이제스트이고 R28 `structuredClone`은 테스트 shim이므로 **Node-native 테스트나 실제 SHA-256 정확성·전체 TypeScript/Next 빌드·CI 통과를 의미하지 않음**.
- 누락·null은 `inconclusive` (미관찰), 값 형식이 나쁜데 양쪽이 같아도 `conflict` (상충), 관찰된 정상 값만 읽기 전용 감사 이벤트에 귀속. 차단 응답은 `canDelete/canReplay/canMarkCommitted/canApprove=false`; 긍정 projection 자체는 승인 권한이 없음.

## 미실행 경계·위험·다음 체크
- 실제 두 HTTP/DB 워커 경쟁, R2 PUT 성공 뒤 D1 503/ACK 유실, 중복웹훅/timeout/429/503, staging D1/R2/Cron·실제 R2 GET 바이트 해시, 전체 CI **미실행**. 기존 SQLite 합성 경합을 이번 회차 실행으로 계상하지 않음.
- 상담→서류→OCR→10분 quiet calculation→95법률 검토→Word 초안→직원/변호사 승인→실제 보정 이벤트의 stage/version/CAS/사람 승인 인계 **미실행**. 원문 변경, 갈음 철회, 관할판본 변경, 마감기한 미확정, 재생성의 종단 검증 **미실행**.
- n8n 설계 문서와 실제 운영 워크플로는 분리; 운영 n8n 실행/운영 D1 마이그레이션/사이트 배포/전자제출/법원 인가 확정은 수행하지 않음. 개인 고객정보·OCR 원문·비공개 정답·키·.env는 공개 Git 반영하지 않음.
- 다음: `A4-DATA-013`·`X-047`의 인증된 staging 영수증/SQL/감사 이벤트 및 실제 R2 GET SHA + ACK 유실 수동 재조회, `A4-IT-003`·`X-046`의 서로 다른 UUID 두 워커 CAS/패자 증빙 보존, `A4-DOC-011`·`A4-CALC-016`·`A4-LAW-013`의 quiet→법률→Word 재생성/승인 무효화. **제품 최종 인수: 0건**.
