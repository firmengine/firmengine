# FirmEngine A4 91차 — 철회 중인 문서의 원본 PUT 최종 CAS 판본 누락

작성일: 2026-11-03 KST. 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 A4 흐름/동시성/복구. 모든 입력은 SYNTH-C, DOC-A/B, 가상 SHA 및 가상 R2 key. 실제 의뢰인 정보·법률인정값·비공개 정답·키 없음.

## 1. 선행 조회와 기존 회차 연속성

- 최초 main `70f2cff1b6eb3ac8d53a90e76c448ecd64135112`(2026-11-03 07:34 KST 경 최신 확인); 최근 A3 r91, A2 r91, A1 r90, A4 r90 커밋과 Draft PR #201/#23 확인. 이 영수증 작성 직전 GitHub main HEAD는 `aa35e6926ed42321e1ccec4bf3021042e82ad3ae`.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `35388c0a4876f0da1a5f9d6efa1f348ef2b86a9c`의 A4-IT-005/006, A4-DATA-003, A4-AX-013, X-047을 먼저 읽음. r90(2-worker POST orphan)·r89(event ACK 유실)·r3(R2 PUT lost ACK) 영수증과 r90 실행 가능 테스트를 조회. 지난 회차의 #201 등록 후 불확정 보존 vs CAS 패자 고아, #23 원본 PUT ACK 보존 통합 조건을 이어감.
- **현재 main 실제 blob:** `app/api/cases/[id]/documents/[doc]/route.ts` `db20b9248e68d3ec412b5d3f4254254e0ffc8412`; `lib/case-command-store.ts` `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`.
- PR #201 `49e39f22aeff8f04eca9b0ef973c9126ea6fc7bc` / PR #23 `537c6b671ec533e6810ea2fcb3f84f09dcc649d5`: **open/draft/미병합**. #201의 POST 후 불확정 청소 정책과 #23의 PUT 응답유실 보존 후보는 서로 다른 파일을 수정하지만, 동일 문서 lifecycle 통합검증이 필요.

## 2. 신규 조건부 P1 결함 후보 — 철회와 원본 스트리밍 PUT의 경합

실제 `PUT ?kind=original`은 최초 `record(id,doc)`에서 사건 JSON의 활성 문서를 읽지만, R2 스트림을 저장하고 SHA를 확인한 **후** 실행하는 D1 최종 SQL은 다음 조건만 확인한다.

```sql
UPDATE documents SET original_key = ?,ready = 1
WHERE id = ? AND case_id = ? AND ready = 0 AND sha256 = ?;
```

반대로 `document.retract`는 사건 JSON의 문서 status를 `deleted`로 바꾸고 `page_jobs.status='withdrawn'`으로 갱신하되, `documents` 테이블에는 `active/withdrawn` 칼럼이 없고 original PUT SQL에 사건 revision/storage_token/작업철회 상태 검사도 없다. 이미 알려진 자손 문서 OCR 철회 누락도 있어 job-status 검사만으로 완전한 안전장치가 되지는 않는다.

**합성 순서:** 워커 A가 DOC-A active 확인 → 워커 B가 DOC-A를 철회하고 revision 1→2, page_jobs 2개 withdrawn COMMIT → 워커 A가 R2 PUT·SHA 확인 후 기존 D1 UPDATE → UPDATE 1건 성공. **독립 기대:** 이미 철회된 문서는 최신 증빙으로 ready 1 전환 금지, SQL/R2 불명확성을 분리하며 재확인·수동 회복 대기. **실제 SQLite 관찰:** DOC-A 사건 status deleted, SQL ready=1/key 연결, jobs withdrawn 2개. 초기 요청의 승인/활성 상태가 최종 D1 저장 시 보장되지 않는다. PR #23도 동일 UPDATE SQL을 사용하고 write change=1이면 성공을 반환하므로, 해당 draft만으로 이 경합은 해결되지 않는다.

이 시험은 D1 SQL과 명령 SQL을 **원문에서 확인해 독립 SQLite WAL 두 연결에 실행한 합성 반례**다. 실제 원본 HTTP 스트리밍 중 법원/직원이 문서를 철회한 운영 사례를 입증하거나 원본 TypeScript PUT 전체/PR helper를 실제 실행한 시험은 아니다.

## 3. 실행 입력·독립 기대·관찰

Node.js v22.16.0, node:sqlite/WAL **두 개의 독립 연결 A/B**, 합성 case/document/page_job 최소 컬럼. 실사건 내용·R2 바이트 없음.

| 합성 입력 | 독립 기대 | 관찰 |
|---|---|---|
| active DOC-A 최초 PUT | CAS 1, ready1 | 일치 |
| A 사전 active 확인→B DOC-A 철회→A 원본 최종 CAS | **차단되어야 함** | **main 원문 SQL 1건 허용, 결함 부정대조** |
| 후보 job-status 조건으로 같은 경합 | withdrawn 차단 | 0건; 최소 비교 실험, 제품 수정안 아님 |
| active DOC-A의 held+awaiting_upload | 정상 허용 | 1건 |
| B가 unrelated DOC-B만 철회 | DOC-A 허용 | 1건 |
| 문서 SHA 변경 | 구 SHA 거절 | 0건 |
| 두 워커 동일 문서 ready=0 경쟁 | 승자 1, 패자 0 | 일치 |
| SQL page_jobs 모두 누락 | main은 1건 허용, 후보 가드는 0건 | 둘 다 관찰 |
| A PUT COMMIT 후 B 철회 | SQL ready1/사건 deleted 불일치 상태 | 관찰 |
| 일부 page_jobs 철회 | 보수적 차단 | 후보 가드 0건 |
| documents SQL에는 status 칼럼 없음 | 정적 구조 동일 | 관찰 |
| 원본 중복 PUT | 첫 1·둘째 0 | 일치, readback 별도 필요 |

- **12/12** 로컬 확장 합성 회귀 기대 관찰 일치; 신규 `docs/release-audit-runs/A4/20261103-round91-0741KST-original-put-withdrawn-document-race.test.mjs`의 축약 재현 **8/8** 로컬 Node PASS. 기존 결함을 의도적으로 재현한 부정대조를 포함하므로 제품 안전성 통과 8/8·12/12가 아니다.
- 로컬 12조건 코드 SHA-256 `3d50162e730f91ab1a35b0a96f20fd2b99ef3a782c490013d5b81ceaf25bb2d2`, 출력 SHA-256 `4269e56b61998e8aef193eec04c0dd25b8b7d165c8fab3fa1add174567cfbb21`; GitHub 축약 8조건은 합성 SQLite를 실행한 코드만 적재한다.
- 축약 test의 `A4_CHECK_SOURCE=1`은 전체 ax-site 체크아웃에서만 활성화된다. **이번 로컬 실행에서는 실제 저장소 체크아웃이 없어 정적 SQL source check 미실행**; GitHub blob에서 SQL 원문을 별도 직접 대조했다.
- 합성 SQLite WAL은 Cloudflare D1의 실제 동시성/네트워크/트랜잭션과 동일하지 않다.

## 4. 여섯 역할 순환과 다섯 ID (모두 [ ] 유지)

순환 순서: **변호사 → 데이터 → AX → IT → 사용자·서류 → 계산사무장**. 역할은 검토 관점이며 실제 사람의 결재·법원 인가 의미 아님.

- **A4-IT-005 [ ]**: 원본 PUT COMMIT 영수증 재조회뿐 아니라 원천 문서가 철회되었는지 최종 CAS 시각에 재검증 필요. #23 ACK 보존 후보가 이를 보장하지 않음.
- **A4-IT-006 [ ]**: #201 POST 등록 복구 / #23 PUT 업로드 복구 사이에서 철회 경합과 R2 보관/삭제를 분리. 저장 성공과 최신 source 유효성은 서로 다름.
- **A4-DATA-003 [ ]**: 동일 original PUT의 2워커 ready CAS는 승자 1/패자 0이나, 별도의 철회/문서 판본 CAS는 누락. `NULL`/0/미관찰/철회 처리 구분.
- **A4-AX-013 [ ]**: 철회된 원본의 SQL ready=1 결과를 95 법률·Word 초안·직원/변호사 승인에 승격할 수 없음. 본 회차 그 downstream 경로 실행하지 않음.
- **X-047 [ ]**: R2 선저장 후 D1 최종 PUT 상태가 철회와 경합. 실제 R2 bytes PUT·D1 ACK 유실·429/503/timeout 강제주입 미실행.

서류 관점은 active 확인과 최종 업로드 사이 원문 철회/갈음 철회 검수, 계산사무장은 10분 quiet 계산/입력 재무효화, 변호사는 법적 인정과 문서 승인 재시작 조건으로 나누어 검토했다. **사람 승인 0건**.

## 5. 수정 정책/다음 검증

**실행 코드 변경하지 않음.** 단순 `page_jobs != withdrawn` 가드는 명령 철회 시 자손 page_jobs가 잔존하는 별도 main 결함, missing jobs, 문서 재등록·판본 역전, 사건 JSON이 R2 pointer일 수 있는 현실을 포괄하지 못한다. 따라서 최종 저장 시 **문서 소유 사건·문서 활성세대/원천 판본·철회 epoch**를 동일 트랜잭션 CAS로 결속할 수 있는 스키마/계약을 설계하고, #23/#201/#20 등 미병합 변경과 충돌 검사 및 IT/데이터/변호사 승인 후에만 별도 브랜치 PR을 권고. 삭제 전 R2 객체/SQL 포인터 실제 일치와 보관정책 검증 필요.

**다음 ID:** `A4-IT-012`(구판본 승격 차단), `A4-DOC-012`(철회/갈음 재요청), `A4-CALC-014`(계산 원천 무효화), `A4-LAW-008`(보정·법적 인정), `X-047`(R2→D1 불확정). 먼저 #201/#23/#20 변경 후 SQL과 main HEAD를 대조하고, 철회→GET/R2/원본·OCR/quiet 10분→법률95→Word/사람승인 자동 차단까지 연결한다.

**명시적 미실행:** 전체 main npm ci/TS/CI/Next build, 실제 PUT 함수 전체/V8, Cloudflare staging D1/R2/Cron/HTTP 2워커, 운영 n8n(설계만), 실상담·OCR PDF·계산18·95법률·Word·공식서식·법원 보정/접수증·서류담당자/사무장/변호사 승인, 429/503/timeout 장애주입. 제품 최종 인수 **0/5**, 운영 배포·운영 D1 migration·전자제출·인가 확정 **0**.
