# FirmEngine A4 11차 — R2 성공·D1 행 누락 및 상충 probe의 거짓 무결성 진단 차단

- 일시: 2026-10-30 KST (A4 회차 11). 시작 main `e40bee642a77c556b7459365c665231d7594925b`; 커밋 직전 parent `e40bee642a77c556b7459365c665231d7594925b`. 변경 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이외 수정 없음.
- 역할 순환: 직전 10차 변호사→계산사무장→서류담당자→데이터담당자 다음, 이번 **AX→IT→서류→데이터→계산사무장→변호사** 순서. 담당별 선정 ID: `A4-AX-003`, `A4-IT-006`, `A4-DOC-011`, `A4-DATA-020`, `A4-CALC-014`, `A4-LAW-013`; 교차 `X-047`. 실행증거 중심 ID는 IT/DOC/DATA/AX/X이며, 계산·법률은 법적·계산적 현재성 경계만 점검하고 별도 E2E 수행하지 않아 보드의 해당 ID를 합격으로 바꾸지 않음.
- 읽은 자료: 최신 main/최근 8개 커밋 및 open PR 목록, `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 해당 ID, `db/schema.ts`의 cases/artifacts/events/case_data_change_state, `lib/server-store.ts` CAS, 현재 `app/api/cases/[id]/export/route.ts`, `lib/export-artifact-transaction.ts`, `lib/export-reconciliation.ts`와 기존 16테스트, 7·9·10차 영수증. 기존 Draft PR #24/#31/#35/#40/#45의 변경 파일 및 미병합 상태 확인.
- 기준 main blob: `lib/export-reconciliation.ts` `a4932d520036c0a540e02a502cc2aed291237a73`, 기존 테스트 `e130d7c46e2c3a11415c2324cb835a9b424fd7aa`. Node 22.16.0 로컬 복사본에 대한 `git hash-object`가 해당 GitHub blob과 정확히 일치.
- 변경 blob: 진단 `e06a32df777cfe8bb83af80d1ca0dc210d28517c`, 기존 16개 테스트 예상값 조정 `597d480713e861a2edf58c6b8a90351bf6e7b87b`, 신규 9개 경합·부분실패 회귀시험 `ad4a98d4ce6be693c93592974f32dd21c6a37916`. 이 세 SHA는 실제 테스트한 로컬 파일의 `git hash-object`와 GitHub `create_blob` 결과가 동일.

## 합성 입력 → 독립 기대값 → 관찰

| 재현·반례 | 입력(모두 합성) / 독립 기대 | 기존 main 실제 관찰 | 수정 후 실제 관찰 |
| --- | --- | --- | --- |
| R2 PUT 성공 → D1 artifact INSERT 실패 | `caseId=synthetic-case`, 현재 B(revision=4, SHA=a×64)만 SQL/manifest 있음. 추가 R2 `.../artifacts/untracked` HEAD=true/SHA=a×64, 해당 SQL 행 0. **미참조 R2 키를 삭제 없이 경고**해야 함. | `issues=[]`, `currentArtifactsVerified=true`: 누락 객체가 탐지되지 않음. | `R2_UNTRACKED_OBJECT_PRESERVE`; `autoDeleteAllowed=false`. 현재 B 자체의 바이트 검증은 별도 true로 유지. |
| HEAD 실패→재시도 성공, 순서 역전 | 현재 B의 동일 R2 objectKey에 `exists=false` 후 `exists=true, verifiedSha256=a×64`; **한 번의 마지막 성공으로 현재성 확정 금지**. | `issues=[]`, `currentArtifactsVerified=true` 거짓 정상. | `R2_PROOF_CONFLICT`, `currentArtifactsVerified=false`; 보존. |
| Timeout/503·HEAD 불확실 | 미참조 R2 키 `exists=null` (0·부재와 구별). | row-driven 루프에서 진단 없음. | `R2_UNTRACKED_PROOF_UNKNOWN`; 삭제 금지. |
| HEAD=false인 SQL 미참조 키 | 확정 부재로 관측되었으나 요청 원장·다른 근거가 없으므로 자동 삭제 권한 부여 금지. | 추가 무결성 증거 없음. | 존재 확인 경고 미발급, `autoDeleteAllowed=false`. |
| 다른 사건 R2 경로 | `cases/other-case/artifacts/Z`, 현재 synthetic-case 정상. | 다른 사건 키는 row 조회 범위 밖. | 다른 사건 키를 감사 출력에 포함하지 않음. |
| SHA가 다른 중복 R2 proof | 현재 B에 동일 objectKey / 해시 a×64와 b×64가 동시에 주어짐. | 마지막 해시가 승리해 데이터 불일치만 표시·원인 불명. | `R2_PROOF_CONFLICT`; 현재 무결성 확정 금지. |
| 동일 중복 전달 | 같은 key/exists/SHA가 같은 proof 두 번. | 마지막 값 사용. | 멱등으로 충돌 경고 없음. |
| 미참조 객체의 상충 proof | 존재 true와 false가 섞임. | 행 없는 객체의 상태 자체 미관찰. | `R2_PROOF_CONFLICT` + `R2_UNTRACKED_PROOF_UNKNOWN`; 존재를 단정하지 않음. |

**실행 영수증:** 원본 GitHub blob과 바이트 동일한 로컬 기준의 부정대조 재현 2건(`R2SucceededD1Missing: issues=[],verified=true`, `conflictingRetryLastSuccess: issues=[],verified=true`). 기존 main 16테스트에 신규 9테스트 추가: `node --experimental-strip-types --test tests/export-reconciliation*.test.ts` **25/25 PASS, 0 FAIL**. 변경 전 신규 요구시험 8건 중 **5건 FAIL/3건 PASS**로 문제 검출력 확인. `tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/export-reconciliation.ts` 진단 **0** (로컬 TypeScript 5.8.3). 전체 저장소 Node/Next/CI를 실행한 것은 아님.

## 보호 범위·무효 주장 방지

- 읽기전용 `reconcileExportEvidence`의 진단 사각지대만 좁힘. R2 목록/HEAD/바이트 SHA를 **호출자가 실제로 관찰해서 전달한 경우만** 판정한다. 전체 R2 버킷 inventory를 실시했다거나 모든 고아 객체를 발견했다고 주장하지 않는다.
- `currentArtifactsVerified`는 **현재 B artifact SQL·manifest·바이트 증거만** 뜻하며, 결손/고아 SQL·R2 전체 없음, 저장계약 완료, Word 의미의 정확성, 신청서 인정, 직원·변호사 승인, 법원 인가를 뜻하지 않는다.
- 여전히 실제 Export route가 이 진단을 호출하지 않음. PR #24(ACK 보존), #31(현재 requestId), #35(감사 D1 batch), #40(OCR 원천 CAS), #45(영속 요청 원장/SQL)는 이 회차에 **병합·배포·활성화하지 않음**. 각 PR의 공통 route 수정 충돌과 영속 receipt 원장 route 미연결이 다음 통합 차단요인이다.
- staging D1/R2/Cron, 두 실제 워커, 429/503 실장애 주입, 10분 quiet calculation, 95법률 실행, 실제 Word/공식 서식, 검수/전자제출/인가 **모두 미실행**. n8n은 설계/후속 후보이지 현행 운영 실행 경로로 인증하지 않는다.
- 데이터값 상태의 `null`(HEAD 불확실), `false`(HEAD에서 확인한 부재), `true`(존재), 바이트 SHA 미검증을 분리한다. 사람 검토 없는 법적 확정값 승격 금지. 실제 고객 파일/OCR 원문/PII/키 사용 없음. 운영 DB·R2·사이트 변경 없음.

## 다음 A4 우선 체크

1. Draft PR #24/#31/#35/#40/#45의 공통 Export route/manifest CAS/receipt claim+commit/감사 원자 배치에 대한 **단일 통합 PR**(고위험 별도 브랜치) 및 정확한 병합 diff/기존 테스트 회귀.
2. 같은 요청의 두 HTTP worker 동시 POST, A→B→늦은 A, 브라우저 reload, R2 PUT 성공·D1 저장 실패·COMMIT ACK 유실, 감사 이벤트 삽입 실패의 실제 staging D1/R2 재현.
3. 사건별 D1 artifact row·현재 manifest·영속 receipt와 R2 inventory/바이트 SHA를 권한 범위 안에서 읽기전용으로 수집하는 어댑터·보존 우선 복구 영수증. 자동삭제·운영 마이그레이션 금지.
4. `A4-CALC-014` 변제계획 재산정 판본 및 `A4-LAW-013` 실제 Word 바이트 재검수/서명은 별도 독립 실무자 검증 후 판단.

**제품 최종 인수 완료 0건.** 이번 회차 합성 테스트 통과는 운영 및 법률상 인수와 다름.
