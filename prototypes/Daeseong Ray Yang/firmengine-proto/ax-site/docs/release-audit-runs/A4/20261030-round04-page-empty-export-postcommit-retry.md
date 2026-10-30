# A4 제4회 감사 — 빈 OCR 페이지 업로드와 export 감사 이벤트 실패/재시도

- **감사일:** 2026-10-30 KST, 16시 회차. 시작 main `b1752b2e7fd2b9ab5c78eb479c649ba7dc876c5a`. 이 문서 저장 전에 감사 재현 테스트 자체를 main에 별도 안전 커밋(`89cbd8cc049387916127c0c65263ca2c94705a73`)으로 보존.
- **범위:** 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 고객 문서·원문 OCR·PII·비밀키·운영 D1/R2에 대한 실제 접근 없음.
- **역할 순환:** 이전 A4 3차 IT/데이터/AX 다음 **사용자·서류담당자(`A4-DOC-010`) → 계산사무장(`A4-CALC-014`) → 변호사(`A4-LAW-013`) → 데이터담당자(`A4-DATA-020`)**. 교차 `X-029`, `X-041`. 4개 모두 **[ ] 부분검증**, 전체 인수 완료 0개.
- **소스 확인:** 실제 main 파일 `app/api/cases/[id]/documents/[doc]/route.ts` blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`, `lib/export-artifact-transaction.ts` blob `a114235e5b5de57b5ae58b41026f939ee8543174`, `app/api/cases/[id]/export/route.ts` blob `4f9384e840517455cdec25f0fa734b593d31e533`, `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/document-writer.ts` blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`. 기존 `tests/export-artifact-transaction.test.ts`, `tests/document-snapshot-isolation.test.ts`와 이전 A4 1~3차 영수증 읽음.
- **동시 작업 인계:** 기존 A4 #15/#16/#19/#23 및 A1 #24, A2 #25, A3 #26은 이 회차에 열린 PR로 확인. 특히 **A4 PR #23**은 같은 문서 라우트의 원본 `PUT kind=original`, **A1 PR #24**는 별도 export commit ACK 불확실성을 수정하려는 작업. 이 변경을 덮거나 병합하지 않았다.

## 발견 1: P1 — 빈 페이지 이미지가 R2에 올라가 OCR pending으로 저장될 수 있음

**main의 실제 경로:** `PUT kind=page`는 `request.arrayBuffer()` 결과에 대해 `byteLength>8_000_000`만 검사하고 0을 검사하지 않는다(85행). 이어 `bucket().put`(89행) 및 `page_jobs.image_hash=sha256(bytes),status='pending'`(90행)으로 진행. 같은 파일의 `PUT kind=variant`는 이미 1바이트 미만을 거절(64행)하므로 일반 이미지와 rescue crop의 저장 계약이 달랐다.

**독립 기대:** 이미지 본문이 0바이트면 R2 쓰기/SQL pending 이전에 명시적인 413으로 거절하고 재제출을 안내한다. 1바이트와 정확히 8,000,000바이트는 크기 검증에서 통과, 8,000,001바이트 및 잘못된 길이는 실패. 이는 단지 **크기 게이트**이며 PNG/JPEG의 실제 이미지 디코딩·암호 PDF 검증은 별도의 미완 작업이다.

**조치:** [Draft PR #27](https://github.com/firmengine/firmengine/pull/27) `audit/a4-evidence-page-empty-guard-20261030-r4` head `dca3a7e6fdd3ba954f10ffb95974514d522ca4d7`. 변경 3개 파일: `lib/evidence-page-upload.ts` 신설·`tests/evidence-page-upload.test.ts` 신설·문서 페이지 라우트의 일반 페이지 및 재판독 후보 길이 가드를 통일. 코드 변경은 **main 미병합**이며 기존 법률 산식·승인 로직에는 변화가 없다.

**실행한 테스트:** Node v22.16.0 `node --experimental-strip-types --test tests/evidence-page-upload.test.ts` → **3/3 PASS**, `tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/evidence-page-upload.ts` → **진단 0**. 실행한 로컬 helper 및 test의 `git hash-object`는 PR의 Git blob `dce73f880c394e406e83c14dc899161661be5727` 및 `f045af3f58cca952e9c98ac43f214646fc635bdd`와 정확히 일치. 라우트의 2곳 호출 통합은 **정적 코드 확인**, 실제 Next.js HTTP PUT·Cloudflare R2/D1 테스트는 미실행.

## 발견 2: P1 — export commit 이후 이벤트 쓰기 실패가 사용자 재시도 시 중복 생성으로 이어짐

**main의 실제 경로:** `app/api/cases/[id]/export/route.ts`는 95행에서 각 산출물에 `crypto.randomUUID()`를 할당, 104~134행에서 `commitExportArtifactTransaction`으로 R2/SQL/manifest를 확정, **135행에서 그 뒤에** `event('document_writer.prepared')`, `event('export.generated')`를 실행한다. `lib/server-store.ts`의 `event()`는 독립 SQL INSERT. 따라서 manifest 확정 이후 이벤트 INSERT가 실패하면 catch가 API 오류를 반환하나 산출물은 이미 남는다. 같은 POST를 재호출하면 새로운 ID/객체가 추가되고 manifest는 새 파일 집합으로 바뀔 수 있다.

**독립 기대:** D1 audit event 실패 후에도 성공한 산출물/검수 상태의 재시도가 기존 작업 영수증에 수렴해야 한다. 재시도에서 생성된 중복 object/SQL 행이 없으며, 감사 로그 누락은 별도 **내구성 있는 outbox/reconciliation** 대상으로 남아야 한다. 이벤트 실패를 무조건 무시하거나 이미 기록된 인간 승인을 자동 복원하는 것은 허용하지 않는다.

**직접 실행:** 본 회차에 `lib/export-artifact-transaction.ts`를 GitHub main에서 **바이트 동일하게** 격리 로컬 테스트 폴더로 복제해 `git hash-object=a114235e5b5de57b5ae58b41026f939ee8543174`를 확인한 다음, 실제 `commitExportArtifactTransaction`을 import한 Node v22 테스트에서 라우트의 POST 호출 순서(새 랜덤 ID→R2/SQL/manifest 확정→독립 event 실패)를 합성 Map으로 재현했다. **1/1 실행 PASS**는 **결함 재현 성공**을 뜻한다.

| 합성 단계 | 기대 | 실제 관찰 |
|---|---|---|
| 첫 요청의 산출물 확정 후 이벤트 실패 | 재시도 가능한 동일 작업 영수증 | 요청 실패로 반환, SQL artifact 1행/R2 1객체 및 manifest는 이미 확정 |
| 동일 내용의 POST 재시도 | 이전 artifact 동일 ID 재사용 | 별도 새 ID 생성, SQL 2행/R2 2객체 |
| 현재 manifest | 이전 요청과 동일 작업에 수렴 | 두 번째 ID만 current로 참조, 첫 artifact는 history/저장소에 잔류 |
| 기존 직원/변호사 검수 | 실제 변경 없으면 유효성 판단 필요 | `newExportManifest`가 리뷰 필드를 새로 null로 초기화함. 별도 실 HTTP 검증은 미실행 |

**실행 영수증을 재현 가능한 파일로 main에 보존:** [`20261030-round04-export-retry-repro.test.ts`](20261030-round04-export-retry-repro.test.ts), Git blob `f2010a74f87cf949c62b7650fe3ca1d45856ad1f`. 명령:
`node --experimental-strip-types --test docs/release-audit-runs/A4/20261030-round04-export-retry-repro.test.ts`
→ **1/1 PASS(결함 특성화, 안전성 합격 아님)**. 이 테스트는 **Next.js/실제 D1/R2/Word 전체를 실행하지 않은 함수 기반 격리 모델**이다.

**중복 수정 회피:** A1 [PR #24](https://github.com/firmengine/firmengine/pull/24)는 manifest COMMIT ACK 미확정에서 데이터 삭제를 막는 별개 수정으로, 이 회차에서 확인한 **정상 manifest COMMIT 후 별도 이벤트 쓰기 실패→같은 POST 재호출 중복**은 여전히 남는다. 무근거 event 예외 무시 패치를 main에 넣지 않았다. 수정방향은 요청 단위 고유 idempotency key, 승인된 manifest에 묶인 durable receipt/outbox, 동일 키 재시도에서 동일 결과 반환, event 기록 복원 큐, DB/R2 장애주입 검증이다. 이 설계는 현재 export/리뷰 저장 계약과 겹치므로 별도 고위험 PR 및 실제 통합 검증이 필요하다.

## A4-CALC-014 / A4-LAW-013 서식 변경 후 승인 무효화 부분확인

- `lib/domain.ts`의 `touchCase`는 source 변화 시 revision 증가·기존 current 파일 invalidated·직원/변호사 review null 처리. `currentExportReviews`는 최종모드·동일 revision·`manifestFingerprint`·선행 직원 승인까지 필요. `lib/document-writer.ts`는 저장 계산 inputSHA·referenceSHA·revision이 현재 사건과 다른 경우 문서작성을 거부하는 코드 경로가 있다. **정적 CODE_REVIEWED**만 기록.
- 앞의 export postcommit 에러로 같은 문서가 의도치 않게 다시 생성되면 `newExportManifest`가 기존 리뷰를 초기화하는 안전측 결과가 나타날 수 있다. 리뷰 자동 승격은 확인되지 않았지만 **고객 입장에서는 오류 응답 뒤 불필요한 재검수 요구·이전 검수 상태 맥락 손실**이 생길 수 있다. 실제 직원 문안수정/Word byte→변호사 승인→원본변경 E2E는 아직 **미실행**.

## 검증 계층 및 다음 순서

| 범위 | 판정 |
|---|---|
| 현재 소스·PR·보드 확인 | 최신 main 기준 실제 파일/기존 영수증 확인 |
| 새 page length helper Node 회귀 | **3/3 PASS**, helper 단독 TS 검사 0 |
| 실제 main export transaction 함수 + 라우트형 event 실패 모델 | **1/1 결함 재현**, 원본 파일 Git SHA 동일 |
| 현행 page/upload/export 실제 HTTP | 미실행 |
| 최신 프로젝트 전체 Node test/lint/build | 미실행 |
| Cloudflare staging D1/R2/Cron, 2worker·lost ACK | 미실행 |
| Word/PDF 실제 바이트·변호사·법원 | 미실행 |
| main 운영 코드 변경·운영 DB/사이트 배포·전자제출 | 없음(PR #27과 합성 재현파일만) |

**다음 A4 체크:** `A4-LAW-013` Word 바이트 검수와 `A4-CALC-014` 원본 변경 후 구 계산의 stale 결과 무효화 실제 저장 테스트, `A4-DATA-020` export POST durable idempotency/outbox 설계·검증, `A4-DOC-010` 실제 이미지 헤더/픽셀/암호 파일 거부 경로, 교차 `X-041`·`X-047` 운영 장애 주입. 열린 PR #23/#24/#27의 같은 라우트 및 저장 계약 충돌을 확인하고 리베이스 전 무조건 병합 금지.

> **이번 회차 완료된 제품 인수 체크 ID는 0개**. 네 담당 관점의 선택한 ID들은 부문 검증만 수행하여 보드의 `[ ]`를 유지해야 한다. 고객 자료·비밀값·운영 D1/R2·법원 절차를 사용하지 않았다.
