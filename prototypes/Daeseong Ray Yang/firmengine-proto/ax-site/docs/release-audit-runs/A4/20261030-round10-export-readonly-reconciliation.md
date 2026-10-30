# FirmEngine A4 10차 — Export SQL/manifest/R2/영속 영수증의 보존 우선 증거 정합성 점검

- **일시:** 2026-10-30 KST, A4 10차 회차. 시작 main `31edfb5f00b585cba8068abfb55edfed930925fd`; 새 코드/테스트 반영 뒤 재확인 main `882e978a05f4cfff9e9e09f384dc237fe869f76d`. 대상 범위는 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- **담당자 순환:** 이전 A4 9차의 IT→데이터→AX→서류 다음에 **변호사→계산사무장→서류담당자→데이터담당자**로 교차 검토.
- **이번 검토 ID (4개):** `A4-LAW-013`, `A4-CALC-014`, `A4-DOC-011`, `A4-DATA-020`; 교차 시나리오 `X-046`, `X-047`. 4개 항목과 X 모두 **[ ] 부분 검증** 유지; 제품 최종 인수 0건.
- **변경 파일:** `lib/export-reconciliation.ts`, `tests/export-reconciliation.test.ts` (각각 지정 경로 아래만). 실행 및 GitHub blob 동등성 검증:
  - helper blob `a4932d520036c0a540e02a502cc2aed291237a73`
  - test blob `e130d7c46e2c3a11415c2324cb835a9b424fd7aa`.
- **커밋:** `c0db1553` (초기 read-only helper) → `b2801a12` (14 tests) → `999b7950` (교차사건 R2 key/중복키 fail-closed) → `882e978a` (추가 2 tests). 실제 main 코드에 반영. Export route와 모든 schema, 운영 D1/R2, 기존 고객 정보는 변경하지 않음.

## 1. 최신 main·이전 회차·PR·스키마 조사

- 본회차 시작 main의 `app/api/cases/[id]/export/route.ts` blob `4f9384e840517455cdec25f0fa734b593d31e533`, `lib/export-artifact-transaction.ts` blob `a114235e5b5de57b5ae58b41026f939ee8543174`, `lib/exports.ts` blob `699411b5b20a4a4558761d3015d8827797c7991f`를 실제 읽었다. `db/schema.ts`의 `cases.storage_token`, `artifacts(id,case_id,revision,object_key,hash)`, `events`, `case_data_change_state.data_version` 등 저장 계약을 대조했다.
- 기존 [A4 8차](20261030-round08-export-durable-request-ledger.md)와 [9차](20261030-round09-export-receipt-artifact-sql-proof.md), 기존 `tests/export-artifact-transaction.test.ts`를 읽었다. 이전 #45 계약은 SQL artifact의 사건/버전 존재만 보장하며 R2 HEAD/실바이트 SHA, manifest 참조, 작성 이후 직원·변호사 재검수를 증명하지 못한다.
- 실제 GitHub PR 목록 기준 Draft **#24, #31, #35, #40, #45는 모두 미병합**이고 수동 Export API에 겹치는 변경이 있다. 이번에는 이 PR을 재병합하거나 다른 담당자 변경을 덮어쓰지 않았다.
- 현재 main Export는 매 POST 새 artifact ID를 만들어 R2→D1 `artifacts`→`saveCase` manifest 후 별도로 감사 이벤트 2건을 기록한다. `commitManifest`의 D1 성공 응답 유실에 대해 일반 cleanup helper는 삭제를 시도한다. 기존 A4에서 확인한 문제이므로 본회차에 새 실환경 사고로 단정하지 않는다.
- `newExportManifest()`는 생성할 때 `reviews.caseworker=null, reviews.lawyer=null`로 초기화한다. 이것은 새 버전의 재검수 필요를 뜻하지만 실제 Word 바이트·직원 검수·변호사 승인 E2E를 검증하지 않았다.

## 2. 이번 개선 — **삭제 권한을 절대 부여하지 않는** 격리 증거 대조 함수

`reconcileExportEvidence`는 **읽기 전용**으로 동일 사건의 현재 manifest, `artifacts` SQL행, 영속 요청 receipt, R2 존재·실제 바이트 SHA 증거를 조인하고 실패 이유 코드를 반환한다. 현재 Export route에는 연결하지 않았고 R2 또는 DB를 **쓰기/삭제하지 않는다**. 미확인 결과는 `autoDeleteAllowed=false`로 남긴다.

- **정상:** 같은 사건·revision·manifest hash·SQL row·실제 R2 바이트 SHA가 일치할 때만 해당 **현재 artifact 증거**를 verified로 판단한다. 이는 법원 제출/법적 인가/Word 내용 검증과 전혀 다르다.
- **역사 재생:** A 완료→새 B 현재→지연된 A 재전달 상황에서 A의 `committed` SQL/R2 증거를 **현재 manifest에 없다는 이유로 고아 파일로 삭제하지 않는다**.
- **영속 영수증 `claimed/uncertain`:** 불확정 상태는 반드시 PRESERVE 판정. HTTP 응답 유실·원격 R2 HEAD 불명·조회 실패는 삭제 허가가 아니다.
- **현재 누락/상충:** current manifest row 누락, 다른 사건 ID·revision, SQL/manifest hash 불일치, R2 미존재/바이트 SHA 불일치를 별도 코드로 기록. **HEAD 존재만으로 내용 무결성 합격 금지**(ETag를 SHA-256으로 사용하지 않음).
- **중복/오배정:** 서로 다른 SQL ID가 동일 objectKey를 참조하는 경우 순서 무관하게 검토 보류. 현재 사건인데 R2 `cases/<다른사건>/artifacts/<id>`를 참조하는 것도 명시적 차단.
- **무참조 SQL row:** 영수증/manifest에 안 보이는 row는 `UNREFERENCED_SQL_PRESERVE`이며 안전 삭제의 증거가 아니다. 옛 검수본·실패 중간 상태일 가능성이 있다.

## 3. 실제 실행한 독립 합성 Node 테스트

환경 `Node v22.16.0`. 로컬에서 GitHub와 **동일 Git blob**으로 다음을 실행했다.

```sh
node --experimental-strip-types --test tests/export-reconciliation.test.ts
tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/export-reconciliation.ts
```

**결과:** `16/16 PASS`, 실패 0건, 취소 0건, helper TypeScript 진단 0건. 독립 기대와 관찰은 다음과 같다.

| 합성 조건 | 독립 기대 → 실제 관찰 |
| --- | --- |
| 동일 사건/현재 revision/manifest·SQL·실제 R2 SHA 일치 | 문제 0건, current verified=true → PASS |
| 현재 manifest에 SQL행 없음 | CURRENT_SQL_MISSING + COMMITTED_SQL_MISSING, verified=false → PASS |
| A committed→B current, A SQL/R2 역사 증거 있음 | A 자동 삭제/고아판정 없음 → PASS |
| uncertain·claimed, 무참조 SQL/미확인 R2 | preserve, 자동삭제 false → PASS |
| 진짜 무참조 SQL row | 보존 우선 감사 경고, 자동삭제 false → PASS |
| R2 HEAD missing / HEAD success인데 바이트 SHA 없음 | 각각 R2_OBJECT_MISSING / R2_BYTES_UNVERIFIED, verified=false → PASS |
| R2 실제 바이트 SHA vs SQL hash 불일치 | R2_BYTES_HASH_MISMATCH, verified=false → PASS |
| 다른 사건 SQL row·구 revision·manifest hash 상충 | 각 오배정/구버전/불일치 별도 차단 → PASS |
| 현재 파일 목록 0개 | CURRENT_MANIFEST_EMPTY, verified=false → PASS |
| 두 SQL row 같은 object key (입력순서 양쪽) | DUPLICATE_OBJECT_KEY, current verified=false → PASS |
| current SQL row의 R2 경로가 다른 사건 | OBJECT_KEY_SCOPE_MISMATCH, verified=false → PASS |

실험 수치는 실제 서류·금액을 포함하지 않는 `case-1`, `case-2`, `A`, `B`, 임의 해시로만 구성했다.

## 4. 체크 ID별 판정과 남은 결함

- `A4-LAW-013` **부분**: 신규 `newExportManifest`가 직원·변호사 승인 null로 초기화되는 코드 경계를 확인. 그러나 Word 실제 파일 바이트→독립 변호사 재검수/승인 복구/서식 적합성 **미실행**.
- `A4-CALC-014` **부분**: SQL artifact revision이 현재 사건 revision과 다른 합성 사례를 차단. 이는 **실제 18모듈 계산/원천 변경→변제계획·청산가치 재실행을 증명하지 않음**.
- `A4-DOC-011` **부분**: A→B 이후 과거 A의 committed/SQL/R2 증거를 보존하는 격리 테스트. 브라우저 재시작/문안 편집/재생성/승인 인계 미실행.
- `A4-DATA-020` **부분**: 무참조 SQL, 원격 R2 확인 불가, 중복 object key, 교차사건 오배정, SHA 상충의 **읽기 전용 진단계약 구현/16개 시험 통과**. 실제 D1/R2 읽기 adapter·Outbox·receipt adoption/회수/삭제는 구현하지 않았다.
- `X-046` **부분**: 과거 A→B 역사 보존·artifact ID/사건 단위 결속만 시험. 실제 두 HTTP 워커·원자 D1 claim은 **미실행**.
- `X-047` **부분**: R2 HEAD 부재/존재만 확인/바이트 SHA 불일치/응답 미확정의 진단만 실행. 실제 R2 장애주입·ACK 유실·최종 복구는 **미실행**.

## 5. 다음 A4 진행 순서

1. PR #24/#31/#35/#40/#45의 Export POST 단일 원자 workflow를 별도 통합 PR에서 rebase 없이 새 main 파일별 diff/트랜잭션 CAS 확인 후 통합. 메인에 있는 이번 audit helper는 **선행 진단 도구**이지 운영 중복 생성 수정이 아니다.
2. **읽기 전용 D1/R2 실환경 adapter**를 격리 staging 사건 대상으로 작성하고 SQL row→manifest→receipt→R2 실제 SHA를 대조한다. HEAD/ETag만으로 완전 검증 금지. 자동 삭제는 금지.
3. 두 HTTP worker 동시 POST, A→B→늦은 A, R2 성공/D1 실패, D1 commit ACK 유실, 감사 outbox 실패를 실제 staging에서 수행.
4. 원본 변경 뒤 문서 재생성/기존 계산 및 법률 승인 무효화, 직원→변호사 순차 서명, 법원 보정 원본·기한·접수증까지 E2E 검증.

**미실행·미인증:** 전체 저장소 Node CI/npm ci/lint/build, staging 또는 운영 D1/R2/Cron, 실제 Word/D5110, 공식 법원 서식·관할 실무준칙·법률 전문가 승인·배포. 제품 전체 인수 0건. 운영 DB·사이트·법원 전자제출·실제 고객 데이터 변경 없음.
