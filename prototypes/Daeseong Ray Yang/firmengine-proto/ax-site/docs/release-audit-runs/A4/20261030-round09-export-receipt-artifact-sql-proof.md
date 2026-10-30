# FirmEngine A4 9차 — 수동 Export 영속 영수증의 가짜 artifact 확정 차단

- **감사일:** 2026-10-30 KST. 시작 GitHub main: `2a8dce88d68f2a884cd2a68828c20936e58337d7` (회차 작성 전 재확인 `2a8dce88d68f2a884cd2a68828c20936e58337d7`).
- **수정 가능 경로:** 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- **역할 순환:** 이전 8차 서류·계산·변호사·데이터·AX 다음, 이번 **IT → 데이터 → AX → 서류**의 교차 계약 검토.
- **검토 ID (4개):** `A4-IT-012`, `A4-DATA-020`, `A4-AX-003`, `A4-DOC-011`; 교차 `X-046`, `X-047`.
- **인증:** 4개 A4 ID와 X 모두 **[ ] / 부분 검증**. 현재 제품 최종 인수 0건.

## 1. 실제 최신 main 및 기존 PR·스키마 조사

- `main`의 `app/api/cases/[id]/export/route.ts` blob `4f9384e840517455cdec25f0fa734b593d31e533`: Office 패키지 생성 후 `artifacts` 행을 D1에 적재하고 `saveCase`로 manifest를 저장한다. 별도 두 감사 이벤트를 후속 호출하는 경로다. **PR #45 영속 원장은 여기에 아직 연결되지 않았다.**
- `main`의 `db/schema.ts`에는 `artifacts(id,case_id,revision,object_key,hash,...)`가 있고, 최신 main의 독립 `case_data_change_state`와 `cases.storage_token`은 별도 CAS 대상이다.
- 이전 A4 8차 문서의 기준 증빙과 Draft PR #24(응답불명 삭제보호), #31(현재 manifest requestId), #35(감사 이벤트 원자배치), #40(OCR dataVersion CAS), #45(영속 요청 영수증)의 최신 GitHub PR/변경파일을 조회했다. 이들 PR은 모두 **main 미병합**이며 동일 export route의 충돌 통합 검증이 필요하다.
- PR #45 원본 helper blob `b027d98b85ee1cc58926f55c7e65b74ed876a067` 및 실제 `0023_case_export_request_receipts.sql` blob `d9808d92020d6fd2f3da796c54f57d7dca0d24d6`를 격리 Node/SQLite에서 실행했다.

## 2. P1 제안 계약 결함 — SQL에 실제 생성물 행이 없어도 receipt COMMITTED 처리

**부정 대조 실제 실행:** 합성 사건 `synthetic`, 사건 revision=2, OCR sourceDataVersion=4, CAS 기존 `storage_token=token-2`에서 영속 요청 1건을 `claimed`로 저장한 뒤 `cases.storage_token=new-token`으로 갱신했다. `artifacts`에는 **행 0개**인데 `commitExportRequest({artifactIds:['missing-artifact']})`를 실행하니 **기존 PR #45 SQL은 UPDATE 변경 1건을 반환**했다. 이는 SQL 참조 증빙이 없는 영수증을 `committed`로 만들 수 있는 결함의 재현이다. **운영 서비스 결함을 새로 확인한 것은 아니다**(PR #45는 route에 아직 미연결).

**수정:** 기존 PR #45 작업 브랜치에 최소 범위의 SQL 가드·회귀 시험을 추가했다. `COMMIT_EXPORT_REQUEST_SQL`의 기존 case/revision/storage token/sourceDataVersion 검사를 유지하면서, `json_each(artifactIds)`의 **모든** ID에 대해 `artifacts.id + case_id + revision`에 해당하는 D1 행이 존재하지 않으면 변경 0건으로 차단한다. 새 artifact ID를 만들거나 기존 고객 자료를 수정하지 않는다.

- Draft [PR #45](https://github.com/firmengine/firmengine/pull/45)의 업데이트 commit `0330edff2e84564504ca74a16386aa0d9369d492`.
- helper Git blob `630acbcbaf5e08ad484e9b717a40065b5114eda4`; 시험 Git blob `fcec84d0716b5665747786579cd0b45ca1fb358a`. **로컬 실제 Node 실행 파일의 git hash-object와 GitHub blob이 일치**했다.
- `drizzle/0023`의 스키마/저장 계약이나 기존 10개 회귀의 의미를 변경하지 않았다. DB migration은 실행하지 않았다.

## 3. 독립 기대값 → 실제 관찰 (Node 22.16.0 / 내장 SQLite)

- 기존 PR #45 원본 SQL의 부정대조: `artifacts` 행 0개인데 receipt COMMITTED UPDATE `changes=1` → **문제 재현 1/1** (성공 판정 아님).
- 수정 helper + 기존/추가 tests: `node --experimental-strip-types --test tests/export-request-ledger.test.ts` → **14/14 PASS, 0 FAIL**.
- `tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/export-request-ledger.ts` → **진단 0**.
- 정상 경로: 같은 사건·revision으로 연결된 SQL artifact 1건 및 2건의 receipt COMMITTED 허용.
- 부정 경로: artifact **누락** 0건, **다른 사건 ID** 0건, **다른 revision** 0건, 다중 artifact 중 **한 행만 존재** 0건, commit 직전 row **삭제** 0건. 실패 시 receipt는 계속 `claimed` 유지한다.
- 기존 10개 재현에 포함된 sourceVersion 4→5, 오래된 storage token, A→B→늦은 A 재전달, `uncertain` 중복 claim 차단, 감사 트랜잭션 롤백도 유지됐다.

**범위 한정:** 이 가드는 `artifacts` **SQL 행의 사건·버전 소속만** 입증한다. R2의 실제 object HEAD/바이트 SHA, 공식 서식 Word 바이트, `cases.payload` manifest 포함 여부, audit outbox, 직원·변호사 승인을 **증명하지 않는다**. 영속 receipt COMMIT은 반드시 manifest CAS·감사 이벤트와 **동일 D1 batch**에 있어야 하며 단독 호출하면 안 된다.

## 4. 담당별 부분 판정

- `A4-IT-012`: 구버전 저장 차단 CAS에 artifact SQL 소속 가드 1개 추가. 현 main/운영 D1에 아직 반영되지 않음.
- `A4-DATA-020`: 과거/새 생성물 참조의 거짓 COMMITTED 방지. 고아 R2 파일·영수증 reconciliation/안전 삭제 설계는 여전히 미구현.
- `A4-AX-003`: idempotency 요청 ID, case/source/reference 판본 SQL 연결의 다음 단계를 확인. 실제 HTTP Export endpoint의 claim/commit/재요청 연결은 미구현.
- `A4-DOC-011`: 지연 A 재전달·새 B 재생성의 SQL 영수증 선행 조건만 재확인. 실제 브라우저 두 사용자/Word 문안편집/재검수 미실행.
- `X-046`: SQL claim 중복과 receipt COMMIT의 artifact 소속 계약만 격리 검증. 두 실제 worker/HTTP 경합은 미실행.
- `X-047`: R2 오브젝트 존재/ACK 실패 복구는 이번 SQL-only 시험에 포함되지 않는다. 참조 불확실 시 원본 자동 삭제 금지 유지.

## 5. 다음 A4 우선순위와 인수 한계

1. PR #24/#31/#35/#40/#45의 **동일 Export HTTP route + `saveCase` CAS 통합**: receipt claim을 업로드 전에, receipt commit을 manifest·감사 2건과 같은 DB batch에 배치.
2. 같은 요청의 두 워커 동시 POST와 A→B→늦은 A 재전달 후 결과 상태, 브라우저 reload·재생성, `claimed`/ `uncertain` 수동 복구 및 outbox.
3. R2 HEAD/바이트 해시·SQL row·manifest·기존 요청원장을 대조하는 **보존 우선 읽기 전용 reconciliation**. 참조 불확실 파일의 자동 삭제 절대 금지.
4. staging D1 0023 마이그레이션/두 worker/R2 실패·응답 유실/실제 Word 재생성 및 직원·변호사 독립 승인 E2E.

**미실행·미인증:** repository 전체 `npm ci`/lint/build/Node 테스트, staging/운영 D1·R2·Cron, 실제 95 법률 검토/공식 서식/변호사 승인·전자접수/배포. 공개 저장소에 고객 PDF·OCR 추출값·실제 사건 개인정보/비밀키 사용 없음. 제품 전체 인수 완료 0건.
