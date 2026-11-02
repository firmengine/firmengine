# FirmEngine A4 — 75차: 이미 연결된 Word 재요청에서 Writer 입력 SHA 불일치 및 pending cache 분기

- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부의 **A4 실행/동시성/복구**만. 공개 Git에는 합성 입력과 source-only 계약만 기록한다. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가를 수행하지 않음.
- 검토 시작 시 main `b3f6ce15ec552662ee871bda2212f4b6f8d0a8f2`; 재확인 최신 `0d4affb6fcdb61ec22ac4ddd26c75c867abb6089` (다른 에이전트 병렬 커밋). 실제 main 파일 blob: `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`, `lib/document-writer.ts` `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`, `lib/calculator-tools.ts` `13025c1feb8f16d1c52b41ca8de35ac4b2e3c7c0`.
- 이전 회차 이어받음: [74차 영수증](20261102-round74-linked-replay-derived-evaluation-side-effects-stacked-pr176.md). Draft [#174](https://github.com/firmengine/firmengine/pull/174) head `d4f4cc314f6175a40bd18a4124e17191cae9543a`, stacked Draft [#176](https://github.com/firmengine/firmengine/pull/176) head `d17f8eb303c41555fc3b399b3c25a848c7d0aefc`; 모두 **미병합**. 해당 PR의 코드 변경 범위만 정적 점검, 본 회차 PR 병합 없음.
- 6역할 순환: **사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX → IT**; 직접 부분검증 ID **5개**: `A4-DOC-011`, `A4-CALC-016`, `A4-DATA-013`, `A4-AX-013`, `X-047`; 법률 `A4-LAW-013`, IT `A4-IT-005`는 간접 인계검토. **전 ID [ ] 미완료**, 직원/변호사 실제 검수 없음.

## 관찰된 소스 실행 계약과 문제

1. 자동 Word 원본 생성의 `document-writer.ts` `digest(data)`는 `SHA-256(JSON.stringify(data))`이고 `prepareDocumentWrite`는 `evaluation.inputSha256 === digest(data)`를 요구한다. `mustMatchReceipt(original,latest)`는 `inputSha256`의 **엄격한 동일성**을 요구한다.
2. 직원 첫 연결 `adoptAutomaticDraftForReview`는 기존 문서의 `original.writer_receipt`를 받고, `next.exportManifest`에 `documentWriter`/파일/연결 출처를 넣은 후 `saveCase(next,...,{mutationCategory:'artifact_only'})` 한다. 사건 `context.revision`은 변하지 않더라도 `JSON.stringify(next)`의 해시가 달라질 수 있다.
3. `server-store.ts saveCase`는 `artifact_only`에서도 새 `storage_token`을 발급하고 `analyses`에 `pendingDerivedEvaluation` 행을 원자 batch에 추가한 뒤 `finishDerivedEvaluation`을 호출한다. 10분 quiet 불충족 또는 계산 실패 시 그 행이 `pending`으로 남을 수 있다. old complete row는 새 token / 새 full-JSON 해시 조회에서 제외된다.
4. Draft #174는 이전 `already_linked` 조기 성공을 제거하고 D1 artifact·R2 byte SHA·Writer receipt를 재검증하도록 개선한다. Draft #176은 재요청 시 `readOnlyDerivedEvaluation`으로 추가 INSERT/RESET을 막는다. **그러나 정상 complete 신규 cache에서도** `mustMatchReceipt(original,prepared.receipt)`가 원래 문서 해시와 Manifest 포함 후 해시의 차이를 `AUTODRAFT_WRITER_INPUT_CHANGED:inputSha256`로 판정할 수 있다. 기존 main은 이 분기를 조기 반환하여 해당 조건의 재검증 자체가 없었다. 이것은 기존 main의 E2E 운영 장애 확인이 아니라 **두 Draft 결합의 조건부 P1 회귀 후보**이다.

## 독립 기대·합성 입력·실제 관찰

- 입력: 무해한 합성 사건 `case-SYN-R75`, revision=3, token=`token-before`, 원본 사실/문서 배열 빈 값, complete 계산 인덱스 1행, `original.writer_receipt.inputSha256=SHA256(JSON.stringify(preLinkCase))`. 직원 연결로 `exportManifest`(draft/current file, null approvals, autoDraftOrigin)를 추가하고, 동일 revision 새 token=`token-linked` 및 파생계산 행을 DB batch 모사로 저장. 두 독립 `node:sqlite` WAL 연결 사용.
- 독립 기대: **저장 후 기존 링크 재요청은** 유효하고 증빙이 확인되면 새 Word 생성이나 재계산 없이 성공할 수 있어야 하고, 원본/법률/출처 상충 또는 503은 올바른 보류 상태로 남아야 한다. 값 `null`/`0`/미관찰/누락/상충/승인전은 서로 구별한다.

| 합성 조건 | source-동일 연산 전사 관찰 | 판단 |
|---|---|---|
| 연결 전 원본 complete 계산 | 옛 token+옛 SHA 조회 1행 | 정상 대조 |
| Manifest 연결, revision 3 유지 | 원본 SHA ≠ 연결 후 SHA, token 변경, 계산 행 1건 신규 | **identity 변경 재현** |
| 연결 후 신규 캐시 complete | `AUTODRAFT_WRITER_INPUT_CHANGED:inputSha256` | **정상 재요청 false block 위험** |
| 10분 quiet 불충족 후 pending | 조회 `PENDING`, read-only DML=0 | 보류; 실제 10분 운용 미재현 |
| D1 commit 이후 ACK 유실 합성 | 저장된 token 보존, 동일 영수증 비교 mismatch | 응답 유실 복구 회귀 후보 |
| 구 reference SHA | `REFERENCE_CONFLICT` | 상충 보류 |
| WAL 두 워커 구 token 쓰기 | 0행, 새 token 보존 | 합성 CAS 대조 |
| linked 계산행 누락 | `MISSING` | 누락 ≠ 0 ≠ 성공 |
| 재조회 중 503 | 네트워크 실제 주입 **미실행** | 미관찰로만 표시 |

- 로컬 Node `v22.16.0`, `node:sqlite` 독립 fixture **신규 12/12 기대관찰 일치**. 69~75차 합성 시험 포함 **68/68 기대관찰 일치**, 실패 0 / skip 0. 이 수치는 결함을 의도적으로 재현한 부정대조까지 포함하므로 제품 안전성 합격률이 아니다.
- 독립 시험 파일 `automatic_draft_replay_digest_epoch_sqlite.test.mjs` SHA-256 `69a74a71602e97873bea591c664b8d0357edc90f52f9718a78a77d9380a3a92f`. 실행 로그 SHA-256 `f95fcef2105ff716cfb6065bcc818a327cda3cba39e2ab65cf83fae34e970f02`. 소스의 해당 함수/SQL 구문을 수작업으로 전사한 fixture이지 실제 Next.js import/API 통합 테스트는 아니다.

## 복구 계약·판정 및 후속 ID

- **병합 보류:** #174/#176을 결합한 재사용 경로는 원본 **Writer 입력세대**와 저장 후 **Manifest·storage token 세대**를 혼동하지 않아야 한다. 단순히 `inputSha256` 비교를 삭제하거나 원본 영수증을 새 SHA로 덮어쓰는 수정은 금지. 안전한 후보는 현재 사건/계산·법률 Heads/승인세대 + 불변 원본 Writer receipt + Manifest·SQL artifact + 실제 R2 byte SHA + 재조회 CAS를 읽기 전용으로 검증한 후 동일 링크만 재반환하는 것. 이 계약은 동시성·법률 문서 버전 의미 변경 가능성이 있어 별도 Draft/실무자 검토 후 결정.
- **다음 검증 ID:** `A4-IT-005`, `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`, `X-047`. 원본 `saveCase/getCase/prepareDocumentWrite` 통합, 새 요청/재시도, R2 성공 후 D1 실패·ACK 소실, timeout/429/503, 중복 웹훅, 두 실제 HTTP 워커, 재생성→직원/변호사 재승인 무효화 순으로 확인.
- **미실행:** 프로젝트 전체 TS/Next/CI, 실제 staging D1·R2·Cron, 운영 n8n, 실제 API/HTTP 두 워커, OCR, quiet 10분/95법률 종단, 공식 Word 바이트·직원·변호사 승인, 실제 보정 이벤트. 운영 배포·운영 D1 migration·전자제출·법원 인가 확정 없음. n8n 설계 존재와 운영 실행은 다른 상태.
- **최종 인수:** 이번 직접 5 ID `0/5`, 제품 전체 `0` (위 범위에서만 관찰). 비해당은 법원 인가/제출 확정, source-only는 미병합 PR, 승인전은 법률 최종판단이 아닌 상태.
