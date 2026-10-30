# FirmEngine A4 8차 — Export 영속 요청원장 및 A→B→지연 A 재전달 무결성

- **검수일:** 2026-10-30 KST (시간별 A4 회차).
- **검수 시작·작업 브랜치 기반 main:** `2963c11adfef59ac6ad13c8d930c3def127a1fa0`. 영수증 작성 전 확인 main: `2963c11adfef59ac6ad13c8d930c3def127a1fa0`.
- **수정 허용:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만.
- **역할 순환:** 직전 A4 7차 IT→AX→데이터 다음, 이번 서류담당자→계산사무장→변호사→데이터→AX의 교차 검토. 검토 ID: `A4-DOC-011`, `A4-CALC-014`, `A4-LAW-013`, `A4-DATA-003`, `A4-AX-003`; 교차 `X-046`.
- **모든 인수 체크 상태 [ ] 유지**: 기존 PR들의 미병합 상태와 실제 운영 검증 부족으로 제품 최종 합격은 0개.

## 1. 현재 main·기존 PR·코드·스키마의 관찰

- 현재 main `app/api/cases/[id]/export/route.ts`(blob `4f9384e840517455cdec25f0fa734b593d31e533`)는 매 POST 새 artifact UUID를 발급하고 `commitExportArtifactTransaction`을 실행한 뒤 별도 audit event를 기록한다. 사건 `revision/storage_token`은 비교하지만 독립 `case_data_change_state.data_version` 원자검사가 없는 경로가 있다.
- `lib/server-store.ts` `saveCase`는 현재 manifest 갱신에 case revision/token CAS를 사용하고, `case_mutation_receipts`는 사건 편집 명령의 receipt이다. 수동 Export의 **과거 요청 A 전체 이력**을 보존하는 별도 `(case_id, request_id)` 원장은 현재 main에 없다.
- `drizzle/0007_case_commands.sql`의 command receipt, `0010_case_data_watch.sql`의 원천 dataVersion, `0021_workflow_only_source_watch.sql`의 검수/산출물 전용 변경을 직접 확인했다. 기존 0022까지 journal 기록.
- 직전 [A4 7차](20261030-round07-export-source-cas-pr24-31-35.md)의 실제 격리 결함: Export A 완료→새 요청 B 완료→늦게 재전달된 A가 PR #31의 **현재 manifest 1건만 검사**하는 구조에서는 새 Export로 처리될 수 있다. 두 동시 POST는 한 건의 manifest만 승격되더라도 R2/SQL 고아 기록을 남길 수 있다.
- 기존 [Draft PR #24](https://github.com/firmengine/firmengine/pull/24) ACK 유실 시 삭제 방지, [#31](https://github.com/firmengine/firmengine/pull/31) 현재 manifest 기반 같은 요청 재사용, [#35](https://github.com/firmengine/firmengine/pull/35) 감사이벤트 같은 D1 batch, [#40](https://github.com/firmengine/firmengine/pull/40) source dataVersion CAS는 **이번 확인 시 모두 main 미병합**. 동일 export route 등 공통 파일의 독립 변경을 덮어쓰지 않았다.

## 2. 능동 개선 — [Draft PR #45](https://github.com/firmengine/firmengine/pull/45) (고위험 DB 계약, 미병합)

다른 PR들의 export route를 수정/재병합하지 않고, 독립 브랜치 `audit/a4-r08-durable-export-request-receipts-20261030`에 **영속 요청 원장 기반계약만 제안**했다.

1. `drizzle/0023_case_export_request_receipts.sql`: 사건+요청 ID 복합 PK, `claimed/committed/uncertain/failed` 상태, request hash/모드/사건 revision/원천 dataVersion/법률기준 SHA/claim token/산출물 ID JSON/manifest fingerprint/생성·완료시각. 기존 사건 편집 명령 receipt와 분리. `drizzle/meta/_journal.json` 및 `db/schema.ts` 동일 계약 추가. **운영 D1 migration은 수행하지 않음**.
2. `lib/export-request-ledger.ts`: 원본 revision/token+원천 dataVersion을 SQL 동일 INSERT의 WHERE에서 검사한 뒤 `ON CONFLICT(case_id,request_id) DO NOTHING`으로 최초 요청만 claim. 완료는 **반드시 manifest 갱신·감사 이벤트와 같은 D1 atomic batch에서** 별도 새 storage token과 현재 원천 버전으로 검증해야 한다.
3. 이전 A 이후 B가 현재 manifest를 대체했어도 A의 committed receipt는 보존한다. 늦은 A는 `historical_committed_do_not_reissue` 또는 확인대기/충돌로 처리하므로 **새 생성 허가를 주지 않는다**. 아직 현재 본이라도 SQL artifact hash와 R2 HEAD를 재검증해야만 재사용 가능하다.
4. R2 결과 불확실·응답 유실은 `uncertain`으로 남겨 자동 재claim·자동 삭제하지 않는다. 고아 파일을 확신 없이 제거하는 로직을 추가하지 않았다.

**중요 한계:** DB 스키마/SQL 계약과 격리 테스트까지만 구현했고 실제 HTTP Export route, 브라우저, 워커, queue, 감사 outbox와 연결하지 않았다. 이 PR을 그대로 병합하거나 migration만 적용하면 시스템의 중복 생성이 해결됐다는 의미가 아니다. PR #24/#31/#35/#40의 병합 충돌·원자 인계, 사람 검수·운영 staging E2E가 선결이다.

## 3. 실행 영수증 — 실제 Node 22 / SQLite 합성 검사

- 실행환경: Node `v22.16.0`, TypeScript CLI `5.8.3`; `node --experimental-strip-types --test tests/export-request-ledger.test.ts` → **10/10 PASS, 0 FAIL**.
- `tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/export-request-ledger.ts` → 진단 0.
- 로컬 실행과 GitHub PR 파일의 **Git blob SHA 일치**:
  - SQL `d9808d92020d6fd2f3da796c54f57d7dca0d24d6`
  - helper `b027d98b85ee1cc58926f55c7e65b74ed876a067`
  - test `3efc3fe7928dcfa4c2f86c7dfea5442ba72ed657`
- 합성 사건 `synthetic`·`other`; 임의 요청 `request-0001`, 금액/개인정보/실제 고객값 없음. 공식 서식·법률 결론을 자동 검사한 것은 아님.

| 테스트 사례 | 독립 기대 | 실제 관찰 |
| --- | --- | --- |
| 같은 사건·같은 요청 claim 반복 + B 생성 뒤 지연 A claim | A 중복 INSERT 0, B 별도 최초 claim 1 | PASS |
| sourceDataVersion 4→3·caseRevision 변경·storage token 불일치 | 잘못된 claim 0건 | PASS |
| 잘못된 UUID/해시/음수/소수 등 입력 | 조기에 오류 | PASS |
| 새 manifest storage token과 claim token 불일치 | commit 0, 올바른 token 1, 중복 0 | PASS |
| source version 4→5로 바뀐 뒤 결과 저장 | commit 0, claimed 유지 | PASS |
| manifest·receipt·audit가 하나의 SQLite 트랜잭션 중 audit 중복 실패 | 전부 ROLLBACK, 이전 token 유지 | PASS |
| 응답 불확실 후 retry | uncertain + claim 재획득 0 | PASS |
| A committed 후 현재 fingerprint가 B로 변경 | A 역사 원장 유지, 재생성 불가 | PASS |
| 다른 사건으로 요청 ID 혼용 | identity conflict | PASS |
| 0개/중복/잘못된 artifact ID 완료 | 오류 | PASS |

**정확한 인증 수준:** 실제 소스와 같은 Git blob에서 Node SQLite의 제안 SQL을 실행해 본 **계약 시험**이다. `tests` 전체·`npm ci`·lint/Next 빌드, 운영 또는 staging D1/R2/Cron, 실제 2-worker HTTP POST, 실제 Word/PDF 파일, 공식 법원서식, 변호사 법률 승인·사이트 배포는 모두 **미실행/미인증**이다.

## 4. 체크 ID별 부분 판정과 다음 회차

- `A4-DOC-011`: 새 문안 생성이 이전 요청의 동일 ID와 혼동되지 않아야 한다. 영속 식별자 DB 계약만 검증. 실제 직원 문안 편집·두 사용자의 UI 동시 편집·재생성·원본 인계 미실행.
- `A4-CALC-014`: OCR 데이터 버전 4→5 때 구요청 receipt commit 0을 합성 확인. 18 계산모듈·변제계획/청산가치 재계산 종단 미실행.
- `A4-LAW-013`: 오래된 A의 재전달이 새 B 생성본을 대체하지 않는 안전 결과를 계약상 확인. 실제 Word 바이트/변호사 최종 서명 미실행.
- `A4-DATA-003`: 고유 (case,request) SQL 원장 중복방지 및 트랜잭션 rollback을 합성 확인. 실제 D1 두 워커 경쟁·외부 웹훅/Outbox 중복 전달 미실행.
- `A4-AX-003`: 요청 원장의 request hash/원본/관할 기준 버전 계약을 검사. HTTP route가 아직 새 helper를 호출하지 않으므로 제품 완결 아님.
- `X-046`: SQLite 원자 unique·CAS 및 두 요청 순차 경합만 시험. 실제 두 HTTP worker·R2 저장 경쟁은 **미실행**.

**다음 A4**: #24/#31/#35/#40 + #45의 동일 route/저장 commit 경계 통합 제안, claimed 이후 R2 실패·ACK 유실 복구 상태·outbox, B가 생긴 뒤 구 A의 영속 receipt 처리, 검수 후 Word 바이트/사람 승인 무효화 검증. 고위험 스키마/법률·계산 의미 변경은 리뷰 전 merge 금지.

**제품 인수 완료 0개.** 운영 DB 변경, 시스템 배포, 실제 원본·개인정보·법원 제출·인가 처리 없음.
