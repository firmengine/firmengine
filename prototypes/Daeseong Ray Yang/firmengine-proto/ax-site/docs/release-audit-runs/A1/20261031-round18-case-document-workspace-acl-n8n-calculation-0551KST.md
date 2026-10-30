# FirmEngine A1 18차 — 사건 원문·워크스페이스 읽기 인가 / n8n 참고본 구분 / 계산 기준 SHA 경쟁

- 기록 시점: 2026-10-31 05:51 KST 회차. 이전 17차 **서류담당·변호사·데이터담당** → 이번 **IT / AX / 계산사무장** 순환.
- main 기준 및 수정 전 Git ref HEAD: `0af84b27601d6b935a55c3c58e81f71a6940a7e3` (GitHub `refs/heads/main` 직접 조회). 기존 17차 인수 영수증과 보드 ID, 16차 P1 PR #64, 17차 PR #65, `db/schema.ts`, 기존 테스트와 최신 커밋/PR을 확인했다. main의 A4 최근 문서 커밋: `0af84b27601d6b935a55c3c58e81f71a6940a7e3`.
- 중앙 보드 원본 blob: `66187332737bc3326fb52da499db80992d4d1742`. 본 회차 체크는 `A1-IT-003`, `A1-AX-016`, `A1-CALC-015` **3개**. 모두 미완료 `[ ]` 유지.
- 원본 main 파일: `app/api/cases/[id]/documents/[doc]/route.ts` blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`; `app/api/workspace/route.ts` blob `58c8d7ba27a68f5914c07f34e2e9bb81f63b9e5f`; `lib/app-roles.ts` `a716bc17109d9bff7ff88c89606a49949e75a1df`; `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.

## A1-IT-003 — 추가 신규 P1: 원본 파일 GET 및 사건 목록의 사건별 인가 공백

**코드 경로**: 문서 `GET /api/cases/:id/documents/:doc`(원본 및 `?kind=page`)이 `record(id,doc)`에서 사건 조회 및 SQL 조회 후 R2 `bucket().get(key)`를 실행하기 전, 호출자의 사람 신원/사건별 grant를 검사하지 않는다. `GET /api/workspace` 역시 `cases` 테이블 최대 500건과 전체 `COUNT(*)`를 반환하면서 `getChatGPTUser()`를 표시용으로만 읽고, 사람 로그인이나 사건별 grant를 요구하지 않는다. Site 전역 비공개 설정은 사건별 인가의 대체물이 아니다.

**실제로 실행한 기존 main 함수본문 V8 격리, 합성 입력/기대/관찰**:
1. `synthetic-A/doc-D?kind=page`, 사건별 grant 없음, `requireHumanActor` 목은 403을 발생시키도록 설정. 독립 기대 **403 / 사건 조회 0 / R2 GET 0**. 실제 **HTTP 200 / 사건 원본 조회 1 / R2 GET 1 / 인가호출 0**. 데이터 바이트는 `SYNTHETIC_ONLY`만 사용했다.
2. `GET /api/workspace`, 신원 없음(`getChatGPTUser()=null`), 합성 사건 1개. 기대 **403 / 사건 DB 조회 0**. 기존 실제 함수본문 결과 **HTTP 200 / 사건 1개 및 totalCount=1 / SQL 조회 2**. 공개 익명 사이트에서 실제 고객정보가 노출되었다는 실환경 관찰은 아니다.

**수정안 [Draft PR #66](https://github.com/firmengine/firmengine/pull/66)**: 브랜치 `audit/a1-case-document-workspace-read-20261031-r18`, base `0af84b27601d6b935a55c3c58e81f71a6940a7e3`, 코드/테스트 HEAD `533440c88cde71deb22dbe4fceadaa76d1d814d0`, 미병합. 후보 blob: 문서 route `8af324a14f58562e2bf8104ae2be811cbbca45e5`, workspace route `d29c142891ed462e26c541702d2a828a8d285d5d`, 신규 테스트 `debc36d9c8b5a20077f5671d72a5be28b1f07c1e`.
- 문서 원본/페이지 GET에서 `requireHumanActor` + `rolesForActor(who,caseId)` 후에만 `record`/R2 조회를 허용. `case_editor|caseworker_review|lawyer_review`의 사건/전역 유효 grant만 허용하고 role_admin 단독·service identity는 거부한다. **쓰기 PUT는 이번 변경에서 제외**, 별도 권한검토 필요.
- workspace는 로그인된 사람을 먼저 확인하고, 기존 Site owner의 case_editor grant 부트스트랩 이후 `app_role_grants`의 유효 scope/role를 SQL `EXISTS`로 검사하여 **LIMIT 이전** 사건 목록 및 같은 필터의 `totalCount`를 반환. revoked/expired/future grant는 제외한다.
- 기존 Draft PR #64가 보호하는 workflow/requirements/case GET와 **파일 충돌 없음**(PR #64 변경 5파일을 GitHub에서 직접 조회). 통합 병합 시 보조 `requireCaseReadAccess`와 정책 중복 제거를 검토해야 한다.

**실행된 수정 후보 검증(원본문에 제한적 TS 구문 제거, 외부 DB/R2를 합성 대체)**:
- 문서 GET 격리 7건: 무grant 원본/페이지·role_admin·service 403, editor/서류직원/변호사 허용 200; 403에서는 사건·R2 조회 각 0. **7/7 기대 일치**.
- workspace GET 격리 3건: 사람 없음 403/SQL 0; 사람 있음 두 경계에서 scoped SQL 2개만 실행. **3/3 기대 일치**.
- 수정안의 실제 `EXISTS` SQL과 동일한 술어를 Python in-memory **SQLite에 실행**: 사건 3건, staffA·staffB·global·role_admin·revoked·expired·future·mixed·unknown **9/9** 목록과 count 독립 기대 일치.
- `tests/a1-case-read-boundaries.test.ts`에 Node22 `node:sqlite`+원본 TS 동적 로딩 회귀 **4 test 블록 작성·Git 커밋**, 아직 제품 환경에서 실행하지 않음. 실제 D1/R2/사이트/CI·브라우저/권한운영 테이블 검증은 **미실행**.
- 실제 개인자료·키·원본 OCR·비공개 정답은 사용하지 않음. 외부 데이터 유출 확정이 아니라 **코드의 격리 접근 경계 결함**이다. 실제 사건별 grant 정책, 서비스 작업 영향 및 개인정보 담당자 검토가 필요하므로 main 실행코드에는 반영하지 않았다. `A1-IT-003 [ ]`.

## A1-AX-016 — n8n 파일과 현재 AX 실행 모듈 구분

원본 sha: `n8n-reference/README.md` `4989e176318f49e9f99cf7264ef23d37b5639147`, `n8n-reference/workflows/firmengine-p0.json` `37e7833bc3612638adb01b97e811a566e9b26e6b`, `law-watch.json` `fd63f035483a55c49ebb6ec6198bd17277c3b2cf`, `app/api/cases/[id]/process/route.ts` `e153bdb44ec7614de4cd9a9adfaf76e5e7fc4b64`, `lib/pipeline.ts` `79dce5f9822cf2debe1f886ab93ece4a256659e6`.
- 저장된 JSON 2개를 실제 파싱해 `active:false` 각각 확인. 사건 처리 9노드(체인 8+메모 1), 법령 감시 2노드. HTTP 노드는 `127.0.0.1:8010/internal/...`의 과거 Python API용이다.
- 현재 AX API process route는 `lib/pipeline.ts`의 `processNext/processNextBatch/reviewLegal`을 **직접 호출**하며, 해당 pipeline 안에 `n8n`/legacy `internal/stages` 연결 문자열이 없음을 원본 정적 검사로 확인했다. `NODE_MAP.md` 역시 참고 매핑임을 명시한다.
- 독립 기대: 참고 JSON이 배포 실행 중이라고 표시하지 않는다. 코드·문서 대조는 기대와 일치. 단 실제 n8n 워크플로 인스턴스 활성화 여부·Cloudflare Cron/트리거·Site 런타임 모듈 실행은 **미관찰**. `A1-AX-016 [ ]`.

## A1-CALC-015 — 기존 P0: 오래된 기준정보 SHA 계산으로 current head 교체

원본: `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/case-data-recompute.ts` `cd967ced1c8262b1e8c67d62c2a373e4d2e2be94`, `lib/reference-runtime.ts` `9993469a164740e8a9128874b299a967b420e230`; 기존 4/16차 감사 반례와 동일.
- 원본 `persistCaseCalculationFeatures`의 실제 `INSERT ... SELECT ... ON CONFLICT(case_id) DO UPDATE` SQL을 SQLite에 실행. 합성 사건 `revision=7`/`dataVersion=4`, 현재 head `new-ref-run`. 이후 동일 사건·원본 판본을 갖는 **오래된 reference run** `old-ref-run`의 저장 요청. 독립 기대: 현재 head 유지(변경 0), **실제 변경 1 → head=old-ref-run** 불일치.
- 사건 revision=8 또는 dataVersion=5이면 각각 SQL changes=0, 최신 head 유지 **2/2 일치**. 즉 전자의 1건이 실질 P0 반례.
- 기존 쿼리는 계산 run별 reference SHA는 저장하지만 head 승격 술어에서는 활성 release SHA를 원자적으로 비교하지 않는다. `recomputeCaseDataUpdate`는 전후 검사만 사용해 실행 사이 레이스를 완전히 배제하지 못한다.
- 계산·법률 적용 기준과 run/활성 release 원자 CAS 계약 설계가 필요하므로 검증 없이 main에 수정하지 않음. 실제 실무 판정·운영 D1/95법률/Word 영향 미관찰. `A1-CALC-015 [ ]`.

## 종합 및 인계

| ID | 실행 증거 | 상태 |
| --- | --- | --- |
| A1-IT-003 | 기존 main GET 2종 결함 재현, 후보 V8 10/10 및 SQL 9/9; Draft PR #66 코드+미실행 Node 회귀 | P1, 부분 [ ] |
| A1-AX-016 | n8n JSON 두 건 직접 파싱, AX 실행 API/TS 정적 연결 | source-only [ ] |
| A1-CALC-015 | 실제 계산 head SQL SQLite 3조건: 기존 P0 반례 1·정상 차단 2 | P0 미해결 [ ] |

- 신규 **P1 1개 묶음(원본 파일·workspace 사건 인가)**, Draft PR **1개(#66)**, 기존 P0 재현 **1개**, 3개 ID 모두 제품 인수 **미완료**.
- 기존 PR #64/#65 및 다른 에이전트 파일 덮어쓰기 없음. 운영 배포, D1 운영 마이그레이션, 실제 전자제출, 인가 상태 확정 **미수행**.
- **다음 A1 역할 순환:** 사용자·서류담당 `A1-DOC-014`(OCR 직원 정정과 원문 후보 보존) / 변호사 `A1-LAW-017`(법원 보정명령의 원본·기한·접수증) / 데이터담당 `A1-DATA-015`(서식 토큰의 원문 ID·산식·run 추적). 85서류·복수행·C01/C02/C04/동시 사건의 E2E는 아직 미인증.
