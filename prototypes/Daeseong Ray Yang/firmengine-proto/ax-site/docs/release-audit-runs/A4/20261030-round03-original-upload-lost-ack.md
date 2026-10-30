# A4 3회차 — R2 원본 업로드 성공 후 D1 COMMIT 응답유실로 증빙이 삭제되는 결함

- 검증 시작: **2026-10-30 15:46 KST**, GitHub main `eeb343bee19d617e3d47b988abe219b78935b7a1`. 코드 수정 시 main 같은 SHA 유지, 별도 PR branch로만 코드 저장.
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하.
- 역할 순환: 이전 A4 2차 서류/변호사/계산/데이터에서 **IT담당자 + 데이터담당자 + AX 검증관점(복구 경로)**으로 전환. 체크 ID **A4-IT-005, A4-IT-006, A4-DATA-013**, 교차 **X-047**. 모든 체크는 아직 **[ ] 부분검증**, 실운영/법원 검증 미실행.
- 선행 A4 1·2차 감사 영수증 읽음. 선행 [PR #15](https://github.com/firmengine/firmengine/pull/15), [#16](https://github.com/firmengine/firmengine/pull/16), [#19](https://github.com/firmengine/firmengine/pull/19) 및 타축 #17/#20/#21/#22 모두 시작 시 미병합. 다른 작업자의 코드는 덮어쓰지 않음.

## P0 독립 재현 — SQL 포인터가 R2 객체를 가리키지만 객체 삭제됨

**실제 main 소스:** `app/api/cases/[id]/documents/[doc]/route.ts` `PUT ?kind=original`의 R2 스트리밍 `bucket().put` → 해시 확인 → `UPDATE documents SET original_key=?, ready=1` → `finally {if(!retained) bucket().delete(key)}`. 관련 `lib/server-store.ts` D1/R2 저장 및 `lib/export-artifact-transaction.ts`는 별도 export 흐름임을 확인.

**합성 입력**: `case=synthetic, document=doc, originalKey=cases/test/original/new, sha256='a'×64`. R2 `put` 성공, D1 `UPDATE`는 실제로 `ready=1/original_key=key`를 커밋했으나 그 응답이 네트워크에서 사라져 caller에게 예외. 기존 경로는 `retained=false` 상태로 `finally`를 통과하여 이미 D1에 연결된 R2 객체를 삭제함.

**독립 기대값**: commit 성공 여부가 불확실하면 D1 포인터를 재조회하고 `ready=1,original_key=업로드한 key,sha256=기대 해시`라면 **R2 삭제 금지**, API는 성공/복구 결과를 반환. 동일 문서를 다른 worker가 먼저 등록했으면 해당 경쟁자의 R2 키는 보존하고 이번 요청의 임시 키만 제거. SQL 조회도 실패하면 503 + 잠재 orphan 보존 후 후속 복구 필요. 활성 SQL 포인터에 연결된 원본파일 삭제는 허용 불가.

**실행 관찰(로컬 Node 격리, 기존 라우트 해당 try/finally 제어구조를 시뮬레이션; 전체 라우트 실제 실행 아님)**:

| 시나리오 | 기존 흐름 실제 관찰 | 수정된 helper 기대/관찰 |
| --- | --- | --- |
| R2 성공, D1 COMMIT 성공, 응답 유실 | SQL `ready=1`; **R2 객체 없음** | SQL `ready=1`; **R2 객체 보존**, `recovered:true` |
| 정상 D1 write | 기본 성공 | 1/1 대상 R2 보존 |
| 같은 문서 재요청, 다른 key가 이미 채택됨 | 원본 포인터 재사용·현재 키 정리 | `idempotent:true`, 현재 임시 키만 삭제 |
| D1 쓰기·조회 둘 다 불확실 | 기존에는 파일 삭제 | `OriginalUploadCommitUncertain`: 객체 보존·503, 운영 정리 필요 |
| D1 CAS 0변경·현재 포인터 비승인 | 409 | 409·임시 키 정리 |

재현 파일은 공개 Git에 실제 원본이나 고객값으로 적재하지 않았음(합성 메모리 Map/객체만 이용).

## 코드 수정 — 최소 3파일 Draft PR #23

- [**Draft PR #23**](https://github.com/firmengine/firmengine/pull/23), branch `audit/a4-original-upload-lost-ack-20261030-round3`, head `537c6b671ec533e6810ea2fcb3f84f09dcc649d5`.
- `lib/original-upload-commit.ts` (Git blob `7bd20c41dbc33f182f7b15839a6d2dac4f7b9893`): CAS 성공/조회/응답유실/동시등록/불확실성을 보수적으로 분리.
- `app/api/cases/[id]/documents/[doc]/route.ts` (PR blob `a55370b2a754a5a586f50e70db408ad204856775`): 원본 `PUT`의 D1 UPDATE와 readback을 helper로 묶고, **불명확 성공에서 R2 삭제하지 않도록** `retained` 처리. 완료된 D1 연결은 `recovered:true`로 응답, 불확실 조회는 503.
- `tests/original-upload-commit.test.ts` (Git blob `08d40c473e76ff246f05f65f57aa6da0d1778567`): 인메모리 고유 ID·해시만 사용하는 **9개 회귀**.

**실제 검증 명령/환경**: Node **v22.16.0**; `node --experimental-strip-types --test tests/original-upload-commit.test.ts` → **9 PASS / 0 FAIL**. 로컬 테스트 대상 두 파일의 `git hash-object`가 **각 PR의 원본 Git blob SHA와 완전히 일치**하여 코드/테스트 파일 동일성 확인. `tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/original-upload-commit.ts` → **진단 0건**. 별도 baseline/candidate 제어흐름 격리 스크립트 관찰은 baseline SQL ready1/R2 false → candidate SQL ready1/R2 true.

## 잔여 결함/통합 경계

1. **아직 인수 불가**: 실시간 Cloudflare D1/R2 객체·실제 업로드 stream/응답유실·다중 worker·D1 migration/Cron, 전체 Node 테스트, `npm ci/lint/build`, 공식 서식/변호사 검토 모두 **미실행**. GitHub PR head에는 이 감사 당시 Check Run **0개**·combined status pending.
2. **불확실 D1 응답에서 보수적으로 R2 객체를 남기는 경우** 최종 SQL 포인터가 미채택이면 orphan이 생길 수 있다. 별도 **R2 orphan 검출/보관기간/검토자 승인 후 안전 삭제** 운영 복구 설계가 필요하다. SQL current와 R2 object hash를 대조하지 않은 무차별 정리는 금지.
3. **별도 P1 검토 필요**: `app/api/cases/[id]/export/route.ts`는 manifest 확정 후 `event('document_writer.prepared')`와 `event('export.generated')` 중 실패 시 API 오류로 돌아갈 수 있다. 같은 POST 재호출은 `crypto.randomUUID()` 산출물 ID를 새로 만들므로 중복 R2/SQL artifact 위험이 있다. 해당 경로는 **정적 코드 검토에 따른 잠재 결함**이며 이번 회차 실행/수정하지 않았다. API 완료영수증/idempotency key와 durable outbox 설계 별도 필요.
4. 현재 문서 `PUT page`의 결정적 object key 재시도 및 `variant` 업로드 부분실패 경계는 다음 회차 독립 감사 대상. 검토만으로 안전하다고 단정하지 않는다.
5. 기존 A4 [PR #15/#16/#19]는 미병합이며 이번 PR과 다른 파일 소유. 앞서 발견된 법원 보정명령 오연결/계산 lease 경합도 main에서 보호되지 않았다.

## 현재 단계와 다음 체크

- **CODE_REVIEWED + ISOLATED_NODE_HELPER_PASS**: A4-IT-005 / A4-IT-006 / A4-DATA-013 / X-047의 하위 증빙 업로드 경계만. 각 체크박스 `[ ]` 유지.
- **STAGING_D1_R2_PASS, END_TO_END, LAWYER_SIGNED, RELEASE_READY**: **미인증**. 제품·법원 적합성을 주장하지 않음.
- 다음 A4: (1) 실제 staging D1 응답유실·후속 read 실패에서 SQL/R2 정합성; (2) `export` 중복/영수증·event 실패의 합성 테스트; (3) `PUT page`/variant DB 실패 뒤 orphan/동시성; (4) R2 보상정리 체계와 current source version 오염 가능성.
