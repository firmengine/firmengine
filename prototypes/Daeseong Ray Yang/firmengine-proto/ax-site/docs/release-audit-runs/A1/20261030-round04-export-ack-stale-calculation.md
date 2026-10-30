# FirmEngine AX A1 제4회 감사 — export ACK 소실/법률초안 인계/구 계산 참조 재승격
날짜: 2026-10-30 KST 15:53 회차. 최초 HEAD `eeb343bee19d617e3d47b988abe219b78935b7a1`; 코드 수정용 새 브랜치 기준 main `eca4e37df70f92c4fa4ccdf2a94a2b00d8006416`. 수정을 수행한 파일 모두 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 실제 사건정보/비밀키/실제 OCR 값 없음.

## 이번 회차 인수 범위·역할
- **IT 담당자 A1-IT-008**: R2에 export 파일을 쓴 뒤 D1 아티팩트/manifest 부분저장 실패, 특히 D1 `COMMIT`은 완료됐지만 ACK가 유실된 경우.
- **AX 담당자 A1-AX-015**: 자동 법률 검토초안 `rendered_json`/ZIP/서식 바이트→직원 명시적 handoff→수정→변호사 검수의 동일 artifact SHA·판본 연결.
- **계산사무장 A1-CALC-015**: 원본 `data_version`/사건 `revision`/reference release 변경 전후 구판본 계산 결과의 현재 head 덮어쓰기.
- 전 회차 3차의 서류/변호사/데이터 역할에 이어 **IT→AX→계산사무장** 순환. 모든 체크 ID는 운영·법률 인수 **미완료 [ ]** 유지.

## 사전 인수 확인
- 기존 A1 1~3차 영수증과 중앙 보드의 A1 ID를 확인. 미병합 수정: [PR #12](https://github.com/firmengine/firmengine/pull/12) 검토/문안 append-only, [#17](https://github.com/firmengine/firmengine/pull/17) 자동초안 완료 CAS, [#20](https://github.com/firmengine/firmengine/pull/20) 원문 철회→typed 승인 강등.
- 다른 스트림의 [A4 PR #23](https://github.com/firmengine/firmengine/pull/23)은 **원본 서류 업로드** D1 포인터 ACK 소실 처리다. 이번 A1 대상은 **별도의 생성 export·AI 자동초안**의 `commitExportArtifactTransaction`; 두 PR의 담당 파일이 다르다. [A2 #21](https://github.com/firmengine/firmengine/pull/21)/[A3 #22](https://github.com/firmengine/firmengine/pull/22) 포함 다른 수정사항은 건드리지 않음.
- 실제 읽은 소스: `lib/export-artifact-transaction.ts` main blob `a114235e5b5de57b5ae58b41026f939ee8543174`, `lib/server-store.ts` main blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/automatic-draft-handoff-contract.ts` main blob `43cd0e0245bb74d396879880161654cf80a2978e`, `lib/case-calculation-feature-store.ts` main blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `db/schema.ts`, 기존 export·handoff·calculation tests 및 PR 파일 변동.

## A1-IT-008 — P0 증거파일 삭제 결함 (실제 소스 함수 실행)
- **독립 기대**: 이미 `cases/synthetic/artifacts/file-1` 키를 SQL manifest가 참조하게 된 다음 `D1_BATCH_ACK_LOST` 오류가 발생해도 해당 `artifacts` 행과 R2 바이트는 **남아 있어야** 한다. 응답 실패≠DB 미커밋.
- **실행 합성 입력**: 고객 정보가 없는 `case-synthetic`의 artifact 1건, bytes `[1,2,3]`, uploaded row `synthetic-artifact`; `commitManifest`가 manifest 배열을 실제 업데이트한 다음 전송 ACK 소실 예외를 throw.
- **수정 전 main 실제 관측**: `commitExportArtifactTransaction`의 원본 TypeScript 함수에서 타입 구문만 제거하고 V8 격리 실행. manifest에는 문서 ID가 남아 있지만 catch가 `deleteRecords`와 `deleteObject`를 호출해 **SQL 행 0건·R2 0건**으로 바뀜. 기대와 명백한 불일치. 동일 원본 함수로 이미 확인된 pre-commit conflict는 정상 cleanup, 정상 commit은 보존, afterCommit event 오류에서도 보존.
- **실제 호출 경로 2개**: `app/api/cases/[id]/export/route.ts` (일반 draft/final 생성), `lib/automatic-review-draft.ts` (법률 검토용 자동초안) 모두 위 helper 사용. `server-store.saveCase`는 D1 CAS 이후 `finishDerivedEvaluation`을 수행하므로 커밋 후 후처리 예외가 호출자에게 도달할 여지도 존재.
- **수정**: [Draft PR #24](https://github.com/firmengine/firmengine/pull/24) (`audit/a1-export-manifest-ack-safe-20261030-1553`)는 manifest commit hook 호출 이후 결과가 불명확하면 **삭제 없이 보존**, 두 호출경로에 `onCommitUncertain` best-effort 감시 이벤트 추가, upload/record 단계의 실패에는 기존 cleanup 유지. 실제로 커밋되지 않은 409 충돌에서도 안전우선으로 임시 고아 파일/행이 남을 수 있어 **운영 reconciliation/retention 설계가 반드시 추가되어야 함**.
- **수정 브랜치 실제 함수 본문 격리 V8 7/7 기대일치**: ACK 소실 후 manifest 커밋 유지 / 확정 불가 명시적 거부 후 보수적 보존 / 정상 커밋 / 업로드 오류 cleanup / SQL row 저장 오류 cleanup / onCommitUncertain 이벤트 실패 후 보존 / postcommit event 오류 후 보존. `tests/export-artifact-transaction.test.ts`에 신규 ACK소실·이벤트 오류 회귀 2개 등록, 기존 conflict/cleanup 2개 기대값을 정확하게 조정. **저장소 원본 Node·CI·D1/R2 실행 미인증**.
- 이 문제는 같은 종류의 PR #23과 별도이며, main과 staging/운영은 미변경.

## A1-AX-015 — staff 명시 인계 계약 부분 검증
- 코드: `lib/automatic-draft-handoff.ts`는 `case_calculation_heads`, `case_legal_review_heads` 및 reference SHA를 current head에서 조회하고, `artifacts` SQL 행과 실제 R2 object SHA를 검증한 뒤 `prepareDocumentWrite` 산출물과 `writer_receipt`를 비교한다. 직원 핸드오프 API는 `case_editor`와 `caseworker_review` 권한을 요구한다. `saveCase(..., {mutationCategory:'artifact_only',expectedHeads:...})`의 동일 D1 배치 CAS를 사용한다. `app/api/cases/[id]/automatic-draft/adopt/route.ts`는 동일 canonical route를 호출한다.
- 직접 실행: **GitHub 원본 `automaticDraftHandoffDecision` 함수 본문**에서 TS 타입 선언만 제거하여 V8 격리 총 **8/8**. 정상 후보는 eligible=true, 원본 버전/법률 run/계산 case revision/reference 변경·기존 final 파일·기존 current 파일·미적용 편집이 있으면 모두 eligible=false.
- **경계**: 계약 함수 합격은 실제 R2/Word/직원 편집→변호사 승인 E2E 합격이 아니다. PR #17 draft commit CAS와 PR #24 export ACK 수정이 모두 main 미병합이므로 제품 인수는 보류.

## A1-CALC-015 — P0 구 기준정보 계산 head 재승격 반례 (고위험·수정 분리)
- 저장 소스의 실제 head upsert SQL은 `cases.revision` 및 `case_data_change_state.data_version`만 확인하고, 동률 버전에서는 `excluded.data_version>=... AND excluded.case_revision>=...`를 허용한다. **같은 사건 revision/data_version으로 두 계산 run이 서로 다른 reference SHA를 가질 때**, 이 SQL만으로는 최신 기준정보 계산을 오래된 run이 다시 덮는 것을 막지 못함.
- **실제 격리 SQLite**: `cases('case-synthetic',revision=7)`, `change_state(dataVersion=4)`, 현재 calculation head `calc-ref-new`(reference SHA `bbbbbb...`); 지연된 구 run `calc-ref-old`(SHA `aaaaaa...`)를 최신 head upsert SQL로 실행. **실제 결과 changed=1, head='calc-ref-old'**. 독립 기대는 *참조 릴리스가 변경된 이후 구 릴리스 계산이 현재 head를 대체하지 못함*. 실패 재현. 같은 입력에 사건 revision=8 혹은 데이터 버전=5로 증가시킨 두 가지 경계는 changed=0으로 차단 확인.
- `recomputeCaseDataUpdate`는 계산 전후 원본 version/revision은 검사하지만 **reference SHA 변화는 DB commit 직전의 동일 원자 CAS로 비교하지 않음**. 이후 재계산 poll이 reference SHA mismatch를 발견할 수 있으나 그 사이 구 계산 head가 current로 남는 가능성은 있다. 실제 E2E 법률/Word가 잘못 출력됐다고 증명된 것은 아님.
- **수정 미실시**: 현재 기준정보 active head·승인/시행일 DB 계약, 새 규칙 배포 중 모듈 참조를 원자적으로 묶는 방법과 장기 stale retry를 먼저 검토해야 함. 계산/법률 의미를 바꿀 수 있어 무검증 main hotfix 금지. 다음 회차 우선 설계/별도 PR 검토.

## 실행층별 판정
| 계층 | 증거/판정 |
|---|---|
| 원본 소스 및 이력 대조 | GitHub 실제 main SHA, file blob SHA, 최근 커밋/PR 12·17·20·21·22·23 대조 |
| V8 합성 본문 실행 | main export ACK 유실 증거삭제 재현; PR #24의 실제 수정 코드 **7/7**; handoff 계약 **8/8** |
| Python SQLite 단위 SQL | 계산 구 reference 덮어쓰기 **1건 재현**; 원본 version/사건 revision 변경 **2건 차단** |
| Node 원본 회귀/타입/린트/빌드 | **미실행**; PR에 회귀 파일 추가만 확인 |
| staging D1/R2/Cron·동시 worker | **미실행/미인증** |
| 실제 Word/PDF·변호사·법원 서식 | **미실행/미인증** |
| 현재 main 수정·운영 배포·실제 전자제출 | **없음** |

## 다음 A1 회차
6역할 순환에 따라 **서류담당 A1-DOC-016** (서류검수가 법률/제출 상태를 자동 바꾸는지), **변호사 A1-LAW-018** (법원 제출/인가 상태 분리), **데이터 A1-DATA-016** (DB Schema/Drizzle/Migration 실환경 동등성)을 우선한다. 동시에 이번 두 P0에 대해 원본 Document/Export ACK 손실 시나리오의 실제 D1/R2 fault injection, 구 기준정보 계산 head 원자 보호 설계가 필요. 모든 체크박스는 [ ] 유지. **제품 전체 인수 0건, V8 합성 15건 기대 일치, SQLite 3건 관측, Draft PR #24 한 개, 새로운 결함 2종.**
