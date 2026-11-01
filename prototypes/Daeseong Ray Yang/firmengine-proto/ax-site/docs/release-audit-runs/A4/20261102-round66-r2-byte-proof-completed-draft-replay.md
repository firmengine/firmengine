# FirmEngine A4 66차 — 완료 Word 초안 R2 바이트 증명/ACK 불확실 재생 검증
작성 기준: 2026-11-02 KST · 대상 저장소 `firmengine/firmengine` · 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **내부만**

## 실행 전 판본 확인
- 실행 전 main 최근 HEAD: `1c1d90a9fee949cb638010a86e04028aaed20e50` (이후 병렬 A1/A2/A3 업데이트 가능성; 이 문서 생성 SHA는 별도 기록).
- 중앙 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`: blob `aeb343d539bc19967d4af7a4ba254e3c5bdcfb8a` 읽음. 65차 A4 영수증(ghost receipt/completed fastpath 이전 조사) 읽음.
- 실제 main `lib/automatic-review-draft.ts` blob `5ee8860250303ac9ca513b0be22e886f98c8e904`: `assertCurrent` SELECT 후 `case_automatic_document_runs.status='complete'`이면 `artifacts_json`의 id/name/kind를 즉시 반환, 현행 artifact SQL row/owner/hash 및 R2 GET 바이트 해시·writer receipt·기준정보 승인세대 조회 없음.
- main `lib/export-artifact-transaction.ts` blob `a114235e5b5de57b5ae58b41026f939ee8543174`: manifest 시도 실패 시 cleanup 수행할 수 있음.
- 스키마 `drizzle/0012_case_lawgraph_reviews.sql` blob `313375977527c76be5c87668b91bbbb24a0fef8a`: `case_automatic_document_runs.artifacts_json/status`; `drizzle/0017_legal_reanalysis_orchestration.sql` blob `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`: `case_legal_automation_jobs` 및 lease 조건. `lib/reference-runtime.ts` blob `9993469a164740e8a9128874b299a967b420e230`: reference id/revision/sha256 읽기 지원.
- Draft PR #17 (head `0ce1292a241d8baf98d5b9e230071cca980eb2fa`, SQL helper blob `ebb2de08c1371ed3c37d9946f37b3ce251a8b628`): 완료 writer receipt/manifest CAS 강화만 후보. Draft PR #24 (head `dc5d93d45e944466ba126d2b998345d6c2f38843`, transaction blob `10dc79b9ec9dcf29ff74901af6a621a17d880573`): manifest ACK 불확실 시 R2/SQL 보존 후보. 양쪽 모두 **Draft·미병합**, 둘 다 `lib/automatic-review-draft.ts` 수정 → 통합 충돌 가능. PR #17/#24 코드를 수정하지 않음.
- main `app/api/cases/[id]/process/route.ts` blob `e153bdb44ec7614de4cd9a9adfaf76e5e7fc4b64`: TS pipeline 직접 호출 경로 정적 확인. n8n 참조 설계와 운영 n8n 인스턴스 실행 동등성은 **미관찰**.

## 신규 합성 입력·독립 기대·실제 관찰 (Node v22.16.0, node:sqlite WAL 두 연결)
- 신규 테스트 파일: `round66_completed_draft_r2_byte_proof_replay_sqlite.test.mjs` (본 대화의 독립 산출물; GitHub 저장소 테스트로 커밋하지 않음).
- 입력: `synthetic-A`, revision=3, sourceVersion=7, calc=`calc-A`, legal=`legal-A`, lease=`token-A`; 완료 manifest에는 artifact-A의 id/name/kind/objectKey/SHA-256, SQL artifact row 및 writer receipt 존재. R2는 **실제 R2가 아니라 Map에 저장한 가상 바이트**. 독립 기대는 동일 사건·판본·승인세대·receipt·manifest·SQL artifact row·R2 GET 바이트 SHA가 모두 일치한 경우만 `candidate_consistent_requires_human` (법률 승인 아님).
- 정상 대조: 기존 complete shortcut ID 반환, 독립 증빙 후보 일치.
- R2 바이트가 다른 값으로 변조되는 합성경우: 기존 shortcut **ID 반환**, 독립 기대 `conflict_r2_bytes`.
- R2 404(객체 삭제) 합성: 기존 shortcut **ID 반환**, 기대 `conflict_r2_missing`.
- R2 GET 503 합성: 기존 shortcut **ID 반환**, 기대 `unobserved_r2`; 503을 404나 해시불일치로 확정하지 않음.
- SQL artifact hash 상충/SQL objectKey 상충: 두 경우 모두 기존 shortcut **ID 반환**, 독립 기대 `conflict_sql_proof`.
- 완료 기록의 writer receipt 행 누락/타 사건 소유: 기존 shortcut **ID 반환**, 독립 기대 각각 `unobserved_receipt`/`conflict_receipt_owner`.
- 기준 승인 A→B→A (SHA는 A와 같지만 승인세대 1→3, synthetic approval_epoch): 기존 shortcut **ID 반환**, 독립 기대 `stale_reference`. 실제 스키마에 synthetic approval_epoch가 구현되어 있음을 주장하는 시험은 아니며, reference id/revision/sha의 저장·비교 계약 확인 필요.
- pending + 과거 receipt: 기존 shortcut 미반환(정상 대조); 독립 기대 `ghost_receipt`. source version 7→8: 기존 `assertCurrent`가 shortcut 차단(정상 대조).
- 두 SQLite 연결에서 첫 조회 후 R2 Map 바이트 교체: 두번째 조회도 이전 ID를 반환; 독립 기대 바이트 상충. **실제 R2 two-worker/HTTP race 미실행.**
- 신규 로컬 Node test: **12/12 기대한 코드 행동 재현**, 과거 round56~65 파일과 병렬 재실행 전체 **111/111** (결함을 의도적으로 재현하는 부정대조 포함, 제품 안전성 111건 합격 아님).

## 상태의 의미와 한계
`unobserved_r2`=GET 실패/미관찰, `conflict_r2_missing`=합성 GET 404, `conflict_r2_bytes`=관찰된 GET bytes 해시 상충, `unobserved_receipt`=SQL receipt 부재, `ghost_receipt`=pending+과거 receipt, `stale_reference`=기준 승인세대 변경. `NULL` 증거와 SQL 0행, 금액 0원, 비해당, source-only 자료 및 승인 전 단계는 서로 다른 상태다. 이번 시험에서 금액 0원·비해당/보정 마감일 NULL을 실제 처리한 사실은 **없음**. 사람 승인 없이 법률·최종본 승격 **금지**.

## A4 체크 ID 및 역할 순환
이번 직접 부분감사(모두 `[ ]` 유지): `A4-IT-005`(ACK 후 재사용), `A4-DOC-011`(문안 재생성 경합), `A4-LAW-013`(실제 Word 바이트·사람 승인 증빙 미달), `A4-DATA-013`(D1/R2 보상·영속 증거), `X-046`(두 연결, 타 사건·지연 재생). 계산사무장 `A4-CALC-016`, AX `A4-AX-013`은 간접 출처·인계 검토이며 체크 완료로 표기하지 않음. 역할 순서: **데이터 → AX → IT → 사용자·서류 → 계산사무장 → 변호사**.

## 결론과 다음 검증
P1 **후보**: 완료 Manifest SQL 상태만으로 파일 실체·byte hash·영수증 출처가 증명되었다고 볼 수 없다. 현행 완료 shortcut이 실제 SQL artifact·R2 GET 바이트를 읽지 않는 코드 결손을 확인했으나, 실제 운영 장애·고객 문서 오염·변호사 승인 우회가 발생했다는 뜻 아님.
- PR #17/#24는 `automatic-review-draft.ts` 동일 파일 수정이므로 **현행 main 대비 통합 merge/diff, 동일 UUID·불확실 ACK/기존 고정 receipt 충돌, commit/rollback 원자성** 함께 검토. 64차 ghost receipt와 이번 complete shortcut 검증을 함께 통과해야 하며 자동 cleanup 삭제·자동 성공 금지.
- 다음 ID: `A4-IT-005`, `A4-DATA-013`, `A4-DOC-011`, `A4-LAW-013`, `X-046`. 실제 staging D1/R2에서 GET bytes 해시·ACK 소실/429/503/timeout, 두 HTTP worker 중복 이벤트·R2 성공 후 D1 실패/응답유실·실제 Word 재생성·기존 직원/변호사 승인 무효화 시험 필요.
- **미실행:** 전체 저장소 Node-native/TypeScript/Next/CI, staging D1/R2/Cron, 실제 Word 바이트, 법률 95개, 직원/변호사 검수·공식 서식·실제 보정 이벤트·관할판본/갈음 철회·마감기한/10분 quiet 종단, 운영 n8n.
- **금지작업 미수행:** 운영 배포, 운영 D1 migration, 전자제출, 법원 인가 확정, 실제 고객자료/비밀키·.env 업로드. 제품 코드 변경 없음. 신규 최종 인수 0/5, 제품 전체 0건.
