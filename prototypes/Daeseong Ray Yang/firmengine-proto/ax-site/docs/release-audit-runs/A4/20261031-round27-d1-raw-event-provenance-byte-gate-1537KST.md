# FirmEngine A4 27차 — D1 실제 이벤트 형식/요청 귀속 및 R2 바이트 증빙 경계

2026-10-31 KST | A4 실행 흐름·예외·동시성·복구만 | **고객 데이터 없음, 전부 합성** | 제품 인수 **0건**

## 선행 소스·이전 회차
- 감사 시작 시 GitHub `main` HEAD `786791a7aaf79875ba72420e7b3eb469d0167015`. 직전 A4 26차 영수증 `docs/release-audit-runs/A4/20261031-round26-stored-manifest-projection-1445KST.md`와 단일 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 읽음 (보드 blob `c8bba39735e1b07da468f4d00e8a7bf4f3fed060`). 26차의 raw ExportManifest→독립 지문 투영은 source-only이며 실제 D1 이벤트/객체 READ가 없었다.
- 최신 main 커밋과 Draft PR #61를 확인: PR #61 `open/draft`, head `e1a10be1e83516fa383d91f08dfdb62c7b530a5b`. **0023 case_export_request_receipts migration, 저장 원장·Export route는 PR 초안에만 존재**하며 main 운영 기능 아님.
- 실제 소스: main `lib/export-recovery-stored-manifest.mjs` blob `e41dd7c085de756d4e22aebe3e12271236386cee`; `lib/export-recovery-evidence.mjs` blob `306daa4c445766b409b7d1f1d9b8e7f3bb20cffe`; PR #61 `db/schema.ts` `66702da132a739f8737de39003979f47f686a983`, `drizzle/0023_case_export_request_receipts.sql` `d9808d92020d6fd2f3da796c54f57d7dca0d24d6`, `lib/case-audit-event-batch.ts` `7363feaeff8d7aba3fc182f8da5531423e78f7fe`, Export route `bc3515848261cc0aec509e2c826c714153c5ddf7`.
- 역할 순환: **계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 서류담당자** (이전 26차 서류 시작과 다르게). 직접 조사 4 ID: `A4-DATA-013`, `A4-IT-005`, `A4-AX-003`, `X-047`. 연계 검토만: `A4-CALC-016`, `A4-LAW-013`, `A4-DOC-011` (실제 계산/Word/사람 승인 미실행). 모두 **[ ]**.

## 독립적으로 확인한 구조 공백
- 실제 `events` 테이블 필드는 `id,case_id,actor,type,detail,at`이다. `document_writer.prepared`의 `detail`은 **DocumentWriterReceipt 그대로**이므로 요청 ID `requestId`가 없다. 반면 `export.generated`의 `detail`에는 `requestId`와 `revision`이 있다.
- 현재 단위/합성 진단 `inspectExportRecoveryEvidence`는 감사 이벤트를 `event.caseId, event.requestId, event.revision`이라는 **정규화된 구조**로 받는다. 이전 synthetic fixture가 둘 모두에 같은 `requestId`를 부여해도 **실제 D1 writer 준비 이벤트의 요청 귀속이 증명되지는 않는다**.
- writer 이벤트를 동일 시각/actor 또는 모양이 비슷한 payload만으로 특정 export 요청의 증명으로 승격하면 이중 생성·응답유실 경합에서 오판한다. 이 회차는 명시적 이벤트 연결/스키마 변경을 하지 않고 **미증명(inconclusive)**으로 차단. D1 audit event에 같은 트랜잭션 요청/receipt linkage를 추가할지는 실무 설계·독립 검토 후 별도 PR 대상.
- R2 객체의 `HEAD`, HTTP `ETag` 또는 SQL artifact.hash는 실제 `GET` 바이트 SHA-256이 아니다. 관찰된 존재와 계산된 해시를 분리해야 한다.

## 실제 수정 — main의 독립 읽기 전용 모듈/테스트
- `lib/export-recovery-d1-reads.mjs` blob `336f2e74fd61400ef958cd8f871e36c53b24cc61`, commit `b1169697c3f23f489041979d742217ca6afcfb41`. PR #61 스키마에 맞춘 **읽기 전용** receipt SELECT(`artifact_ids_json` 포함), 감사 event SELECT, artifact ID 및 object_key alias를 같이 찾는 매개변수화 SQL을 제공한다. 실제 DB 실행은 하지 않음.
- raw `case_id/request_id/…` D1 레코드를 축약 진단 계약으로 변환한다. `null`/미관찰/실제 빈 배열과 429·503·손상된 JSON을 분리한다. `export.generated.detail.requestId`만 요청에 연결하고 **`document_writer.prepared`에는 requestId를 생성하지 않는다.** `R2 GET` 바이트 hash를 명시적 소스 태그 없이 주장하면 `verifiedSha256=null`로 유지한다. 모든 판정 `canReplay/canDelete/canMarkCommitted/canApprove=false`.
- `tests/export-recovery-d1-reads-r27.test.mjs` blob `5718320be4b4f56f8ff5a9242e1d61a507714e3f`, commit `1c43f2405e5e184396adfd553f15eeeb7d495d98`. **20개 Node-native 테스트 코드를 작성했으나 Node-native 실행하지 않음.** 전부 합성 사건.
- 모듈은 **live Export route, n8n 운영 워크플로, D1/R2 staging에 연결되지 않았다.** 관할·법률 인정·산식·최종 Word·승인 상태 변경 없음.

## 실행한 검증/입력/독립 기대/관찰
- 모듈 작성 후 원본문을 V8 격리 실행: synthetic 사건 `case-synthetic`, UUID 유사 가상 request `request-aaaaaaaa`, revision 3, sourceDataVersion 7, SHA `a×64`, artifact `artifact-aaaaaaaa`. D1 SQL rows/감사 문자열, R2 존재·byte hash는 **합성 가정 증빙**으로 주입. 사전 V8 **24/24 기대 일치** (예외 19시나리오 + SQL shape/파라미터/잘못된 ID 5); GitHub 재조회 코드로 사후 V8 **11/11 기대 일치**. V8의 commandHash는 합성 fixture 지문을 반환하는 stub; 실제 TypeScript 원함수 수행이 아님.
- 별도 **독립 SQLite in-memory SQL READ 계약 10/10 통과**: 원장 uncertain 행 조회, JSON 계획 확인, 미존재 요청 NULL, 동일 ID artifact+다른 사건 R2 key 별칭 2행 탐지, 무관 자료 미조회, 실제 schema 형태의 audit 두 행, prepared detail의 요청 ID 부재 vs generated detail의 요청 ID 존재, 조회 전후 원장 status 변화 없음. 실행 스크립트 `/mnt/data/firmengine-a4/round27_d1_projection_sqlite.py`는 로컬 합성 파일이며 Git 반영하지 않음.
- 반례 예상→관찰: ① R2 HEAD/SQL 해시만 있으면 **바이트 미검증 inconclusive**; ② 합성 R2 bytes SHA 충돌 시 **conflict**; ③ R2 성공/SQL 행 0이면 **inconclusive + R2_WITHOUT_SQL_ROW**; ④ D1 503·R2 429 오류 envelope는 **conflict(입력 형식오류)**; ⑤ 원본 revision 증가 시 **stale**; ⑥ prepared 감사가 실제 D1 구조 그대로이면 **inconclusive + D1_WRITER_EVENT_REQUEST_BINDING_UNPROVEN**. 미승인 상태가 정상으로 바뀌지 않음을 확인.
- GitHub main 반환된 두 변경 파일 blob과 V8 실행에 재사용한 실제 GitHub 원문을 확인. **Node-native 테스트 20건/전체 TypeScript/Next/CI/실제 HTTP 두 워커/staging D1·R2·Cron/Word·변호사 승인 모두 미실행.** SQL 10건은 SQLite synthetic이고 Cloudflare D1 성공 증명이 아니다.

## 결론과 다음 체크
- `A4-DATA-013`, `A4-IT-005`, `A4-AX-003`, `X-047`: 실제 D1 shape에 대한 **부분/읽기전용 합성 검증**, 모두 **[ ] 미완료**. live route 연결·event request binding·실제 SQL/R2 GET 실패주입 미완료.
- `A4-CALC-016`, `A4-LAW-013`, `A4-DOC-011`: source/계산/Word/직원·변호사 승인 인계는 관련 소스 경계만 확인. **실제 검증 미실행 [ ]**.
- 차회 우선: `A4-DATA-013`+`X-047`에 인증된 staging 읽기 전용 SELECT와 **R2 실제 GET bytes 해시** 연결, D1 ACK 분실의 영수증 상태 재조회; `A4-IT-003`+`X-046` 다른 UUID 두 HTTP 워커 CAS, 패자 SQL/R2 보존; `A4-DOC-011`+`A4-CALC-016`+`A4-LAW-013` 원본·갈음·관할판본 변경→10분 quiet→95 법률→Word 재생성·기존 검수 무효화.
- 실제 사건 고객 문서/개인정보/OCR 원문/키/env/비공개 정답 Git 공개 **0건**. 운영 배포·운영 D1 migration·실제 법원 보정/전자제출/인가 확정 **실행하지 않음**. **제품 최종 인수 0건**.
