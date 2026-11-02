# FirmEngine A4 90차 — 동일 SHA 문서등록 2워커 CAS 패자·미참조 OCR 작업 보존 반례

작성: 2026-11-03 06:40 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 합성 사건 ID·문서 SHA·사건 revision만 사용. 실제 고객자료/법률상 인정값/비밀키 없음.

## 1. 시작 원천과 이전 회차 연속성

- 시작 main `e84efd989ff5c2aafb2f392ee161e514b09c1632` (A3 r90 문서 병합). 이후 본 회차의 독립 부정대조 파일 커밋 `2e5b83412a6f126e729ae5d85cea917936b67766`; 이번 영수증 작성 직전 HEAD `2e5b83412a6f126e729ae5d85cea917936b67766`. 최근 A3 r90, A2 r90, A1 r89, A4 r89 커밋 조회.
- 단일 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `865593c3c4d6bf1d73517eca15c40d02ed06a065`를 먼저 읽고 미완료 ID 확인. r88/r89 영수증, r89의 실행 가능 부정대조, 실제 코드 `app/api/cases/[id]/documents/route.ts` 및 `app/api/cases/[id]/documents/[doc]/route.ts`, `lib/server-store.ts::saveCase`, `db/schema.ts` 읽음.
- main 문서 POST blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`; `saveCase` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`. Draft PR #201 POST 후보 blob `59a29303dacccdf3ac1dbef98da396b4285b5930` / head `49e39f22aeff8f04eca9b0ef973c9126ea6fc7bc`, Draft PR #23 head `537c6b671ec533e6810ea2fcb3f84f09dcc649d5`. 두 PR 모두 open/draft/미병합으로 조회.
- 독립 JS V8에서 **실제 양쪽 소스의 POST 함수본문**(import·TypeScript 서명 제거, 합성 DB·응답·saveCase 주입)을 실행. Cloudflare D1/R2/Next HTTP/Node 제품 런타임이나 실제 2개 D1 연결 실행이 아님. 재현 소스: [r90 실행용 Node 부정대조](20261103-round90-document-post-two-worker-negative-control.mjs) blob `5515ad9974aca0c42c4514639b5686f4515685ce` (**작성·GitHub 저장 완료, Node CLI 미실행**). JS 실행의 기대/관찰은 아래.

## 2. 합성 입력과 재현 순서

- 동일한 합성 case `SYNTH-CASE`, 최초 revision=0, `sha256='b'×64`, 각 문서 pageCount=2, 동일 파일명; 고객 실제 원문 없음.
- 워커 A/B가 `getCase()`로 revision=0을 각자 관찰하고 서로 다른 `documentId`를 생성. 각자 SQL `documents.ready=0` 1건과 `page_jobs` 2건을 선기록.
- 재현 어댑터에서 `saveCase` 진입 barrier로 **두 요청이 모두 앞 단계에 도달한 뒤** A의 CAS만 성공시켜 활성 사건 JSON revision=1로 만들고 B에 명시적 `409 CAS_REJECTED`를 전달. 성공 요청의 `document.registered` 감사 이벤트 1건. B의 예외 정리 수행 여부를 독립 관찰.
- 이어 동일 SHA POST 1회 재전송: 기존 활성 문서 분기가 멱등 200을 반환하는지, 원래 CAS 패자가 만든 DB 행·OCR job이 남는지를 점검.
- 독립 기대값은 **활성 사건 JSON 문서 1건, 감사 1건, HTTP 응답 201/409 및 재시도 200**이다. 이미 실패한 동시 요청의 미참조 SQL 행 수는 baseline과 보수 보존 후보의 **관찰 차이**로 기록하며 어느 것도 운영 인수 합격으로 처리하지 않는다.

| 실행 소스 | 최초 응답 / 재시도 | 활성 JSON | SQL documents | page_jobs | 감사 events | 미참조 SQL 문서 | 관찰 |
|---|---|---:|---:|---:|---:|---:|---|
| main 원본 | 201·409 / 200(idempotent) | 1 | 1 | 2 | 1 | 0 | CAS 패자 문서/job 삭제 |
| Draft PR #201 | 201·409 / 200(idempotent) | 1 | **2** | **4** | 1 | **1** | CAS 패자 원본/job 영구보존 후보 |

- 실제 V8 함수본문 두 소스에서 정량 점검 **각 8개, 합계 16/16 독립 기대 관찰 일치**. 이는 정상 제품 검증 16건이 아니라 **기존 트레이드오프를 드러낸 부정대조**다. D1 SQL 자체 대신 비동기 합성 Map/statement 어댑터를 사용했으며, Node CLI 테스트 파일은 별도로 작성했으나 이 회차에 실행하지 않았다.
- main 결과의 정리는 `saveCase` COMMIT 이후 오류 시 OCR을 삭제할 수 있는 **r88 기발견 P0 후보**를 해결하지 않는다. PR #201은 그 오삭제를 줄이는 대신 **명백한 CAS 패자도 증빙 보존**하는 신규 비용·고아 정리 과제를 만든다. r89의 감사 INSERT 실패/ACK 유실 문제 역시 독립적이다.
- `0`은 위 합성 DB에서 **관찰된 실제 수**이고, 실제 staging DB/운영 DB의 건수는 **미관찰**이다. `NULL`/미관찰/ready=0/ready=1/비해당·상충·source-only·승인전은 구분한다.

## 3. 6역할 순환과 보드 미완료 5 ID

순환: **계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자**. 모두 점검 관점에 따른 내부 분석일 뿐 실제 담당자 승인이나 법원 검토가 아님.

- `A4-IT-003 [ ]`: 동일 사건·동일 SHA 두 워커의 요청 진입과 CAS 승자1/패자1. 합성 어댑터 barrier이며 실제 D1 두 워커·HTTP/Cron 원자성을 증명하지 않음.
- `A4-DOC-013 [ ]`: PR #201의 활성 사건 문서1에 SQL 문서2/page job4가 연결되지 않은 채 남는 상태 관찰. 실제 직원 검수 무효화·Word 재생성 실행 안 함.
- `A4-CALC-014 [ ]`: source 진입의 완결 여부가 10분 quiet calculation의 입력·OCR 작업 준비에 영향을 줄 수 있다는 인계 리스크만 확인. 계산 18개·청산가치·변제계획 **미실행**.
- `A4-DATA-012 [ ]`: 두 POST의 시퀀스, 지연 CAS 패자, 동일 SHA idempotent 200으로 미참조 SQL 원본이 복구되지 않는 경로 합성 확인. 실제 이벤트 outbox/중복 webhook·D1 스트림 미실행.
- `X-046 [ ]`: 합성 동일 사건 2워커 경합 부정대조. 다른 사건/테넌트 격리·lease 및 실제 DB 경쟁과 무관하며 별도 검증 필요.

변호사 관점: 활성 문서·감사 존재를 법원 인정·기한·인가로 승격 금지. AX 관점: OCR source 불완전 상태를 95 법률·자동 Word·사람 승인으로 자동 전달하지 않아야 하나 실제 종단시험은 **미실행**.

## 4. 조치·다음 인수 조건

- **[Draft PR #201 검토 의견](https://github.com/firmengine/firmengine/pull/201#issuecomment-6589260428)**에 위 독립 반례·blob·기대/실측·병합 전 조건을 전달. 코드 main/PR을 덮어쓰지 않음.
- 수정 방향은 `saveCase`의 `COMMITTED / DEFINITELY_NOT_COMMITTED / UNOBSERVED` 판정을 권위 있는 영수증으로 구분하고, **확정 CAS 패자**만 독립 사건 소유권·원본 SHA·`documents.ready`·R2 pointer를 확인한 뒤 미참조 행을 정리하는 것. **미관찰**일 때는 무조건 삭제도 무조건 성공도 금지, 보존+복구 영수증이 필요. 이는 구현·실무 검증 전 설계 제안이며 제품에 미적용.
- PR #23의 원본 PUT R2 포인터 ACK 유실·r89 감사 INSERT 503/ACK 불확정과 함께 **한 사건의 등록→원본→OCR·계산→95법률→Word→직원/변호사→실제 보정명령** 순서별 stage, source/dataVersion, CAS·사람 승인 전이를 계속 검증할 것. 다음 우선 ID: `A4-IT-005`, `A4-IT-006`, `A4-DATA-003`, `A4-AX-013`, `X-047`.
- **미실행:** 최신 전체 Node/npm ci/TypeScript/lint/build/CI, 실제 SQLite WAL 2연결/Cloudflare staging D1/R2/Cron, 실 HTTP/중복 webhook/모델 429·503·timeout, 실제 OCR·10분 계산·법률 95·Word 실바이트·법원 공식서식·직원/변호사 승인·보정 PDF·접수증, 운영 n8n. n8n은 설계와 실제 운영을 별개로 취급.
- 법률 인정/계산 의미/승인세대 변경 없음. 운영 배포·운영 D1 migration·전자제출·법원 인가확정 없음. **이번 선정 5 ID 최종 인수 0/5**, 기능 E2E/출시 완료 0건. 
