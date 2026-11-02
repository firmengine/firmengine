# FirmEngine A4 — 70차 실행·동시성·복구: 직원 Word 인계의 활성 기준 승인세대 CAS

작성: 2026-11-02 10:43 KST; 변경 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 공개 Git에 개인정보/고객 원문/비공개 정답/키/환경변수 없음.

## 시점별 근거·이전 회차 인수
- 감사 시작 `main`: `37fed7ea762fd9eea2003924ca0e99b5dd4cabb2`; 최근 main: A3 70차 `37fed7e`·`dfea202`, A2 70차 `c72c443`, A4 69차 `fb95cc9`. GitHub 최근 Open Draft #17/#24/#161/#164 확인. 본 회차 제안: **Draft PR #167** (`audit/a4-r70-staff-reference-epoch-cas-20261102-1043`)이며 미병합.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `4476c080b952b295453aa5f0f9987f87a09453ff` 확인. 69차 영수증 `20261102-round69-staff-already-linked-unverified-r2-replay.md` blob `604169bbe3aefb1a0b9eed6c553057cf8a41334f` 확인: 이미 linked fastpath의 SQL/R2 proof 재검증 누락은 **여전히 미해결**. 새 검증은 그와 별개의 **최초 신규 직원 인계 최종 저장 CAS**이다.
- main 실제 소스·스키마: `lib/automatic-draft-handoff.ts` blob `a525e3c12672966c993f83021d5f169b170bebe9`; `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `lib/automatic-draft-handoff-contract.ts` `43cd0e0245bb74d396879880161654cf80a2978e`; `lib/reference-runtime.ts` `9993469a164740e8a9128874b299a967b420e230`; `lib/reference-context.ts` `537a231c915445cf7ed5481fa5b35e63612229a7`; `lib/reference-store.ts` `16164f17d4a5d849d586a1b094922b020b57103a`. SQL `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`, `0012_case_lawgraph_reviews.sql` `313375977527c76be5c87668b91bbbb24a0fef8a`, `0017_legal_reanalysis_orchestration.sql` `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`. 기존 `tests/automatic-draft-handoff-contract.test.ts` `01724a1f0e214701fdc89458ef776c2606c0f1ee` 확인.
- `docs/ax-n8n-e2e-scenario-matrix-20261030.md`는 설계·인수 테스트 정의일 뿐, 현재 운영 n8n 실행 및 staging D1/R2/Cron 영수증이 아니다.

## 재현한 신규 P1 후보: 활성 승인세대 변경 중 직원 Manifest COMMIT
1. `adoptAutomaticDraftForReview()`는 초기 `referenceIdentity().sha256`와 계산 Head SHA를 대조하고 R2/SQL 바이트를 조회, 이후 `saveCase(...expectedHeads)` 호출. main `saveCase`의 **같은 UPDATE**는 `cases.storage_token/revision`, source dataVersion, 계산/법률 Head 및 `case_calculation_runs.reference_sha256`만 대조한다. `legal_reference_releases`의 **현재 active ID/revision/SHA는 검사하지 않는다**.
2. SQLite WAL **두 연결**로 가상 사건 `case-A`, source v7 / revision 3 / calc-A / legal-A / source token-old, 계산 ref SHA A, 최초 활성 `ref-A1(rev 10,SHA A)`를 배치. 워커 A는 기존 계산/법률 출처를 읽고 대기한다. 워커 B가 `ref-B(rev 11,SHA B)`를 승인한 후 워커 A가 구 Head로 UPDATE. **기존 main predicate 변경 1행**; 독립 기대값 0행(구법령 초안 인계 차단).
3. B가 다시 내용 A로 복원하되 `ref-A3(rev 12,SHA A)`라는 **새 승인세대**를 만들면, 계산 Run의 SHA는 여전히 A이므로 **기존 main predicate 변경 1행**. SHA만 보는 CAS는 ABA를 구분하지 못한다. 구 승인세대 재사용을 허용할지는 실제 변호사·기준정보 관리자 판단 대상이며 자동 법률 인정 아님.
4. 비교용 **설계 후보**로 `active legal_reference_releases id + revision + sha256` 조건을 같은 UPDATE에 추가하자 A→B 및 A→B→A 모두 0행. 정상 사건 1행, 원본 v8·계산 Head B·법률 Head B·작업 token 변경·계산 ref SHA B·법률 revision 변경은 기존 CAS 0행 대조.
5. **실제 실행:** `node --test /mnt/data/firmengine-a4/round70_staff_handoff_atomic_active_reference_epoch_sqlite.test.mjs`, Node **v22.16.0**, `node:sqlite` WAL, **12/12 독립 기대 관찰 일치**. 12건에는 기존 위험한 UPDATE=1을 **의도적으로 기대한 부정대조** 포함. 최초 실행 11/12는 fixture의 다른 워커 token 값을 잘못 기대한 **테스트 오라클 오류**였고, 해당 기대를 바로잡아 최종 12/12를 재실행했다. SHA-256: `bb7efefd27051c1a9d09e05d14db0d3add1140728e9e81cba181fe6ee3a52f86`.
6. 이 시험은 실제 main SQL의 핵심 `headGuard` 조건·bind 순서를 **전사한 최소 테이블** 계약검증이다. 실제 Cloudflare D1/전체 db.batch/Next HTTP/두 분산 워커/실제 R2/Word 바이트 테스트가 아니다. 생산 고객 데이터 미사용.

## 수정 후보·미병합·실행 한계
- 별도 **Draft PR #167**: `lib/server-store.ts`의 `expectedHeads`에 ref ID/revision 추가, `legal_reference_releases status='active'` 원자 조건 추가; `lib/automatic-draft-handoff.ts`에서 요청 시점 reference identity 대조 후 최종 CAS로 전달; `tests/automatic-draft-active-reference-epoch-cas.test.mjs` 추가. 3개 파일 모두 지정된 `ax-site/` 하위이며 `main` 운영 실행코드 미변경. PR test는 production `headGuard/headParams` 원문을 직접 추출하는 방식이며 **저장소 Node 테스트는 작성만 했고 실행하지 못함**.
- 위험 계약: 기준정보 테이블 미설치 시 fail-closed가 운영 가용성에 미치는 영향; ref A→B→A 재승인 후 기존 검수 재사용 금지의 실제 법률·업무 정책; 현재 PR #164과 동일 파일 충돌. 직원/변호사 및 IT 담당자가 정책·schema·하위 테스트를 승인하기 전 **병합 금지**.
- 69차 `already_linked` fastpath SQL/R2 proof 누락, 64차 ghost receipt 복구 교착, PR #17/#24/#161/#164 통합, R2 PUT 성공 후 D1/ACK 실패·중복 웹훅·429/503/timeout·10분 quiet·95 법률·Word 수정/재생성/사람 승인의 **실제 종단 흐름은 여전히 미해결·미실행**.

## 6역할 순환 및 보드 ID (직접 5개·모두 [ ])
순서: **계산사무장 → 변호사 → 데이터 → AX → IT → 사용자·서류** (이전 69차 서류 시작 다음 순환).
- `A4-IT-012` [ ]: 신규 직원 인계 저장 CAS에서 활성 기준 승인세대 A→B 및 ABA 누락 재현. Draft #167 미병합, D1 원자 batch 미실행.
- `A4-DOC-011` [ ]: 기존 초안을 직원 워크벤치로 넘길 때 새 기준 승인세대의 후발 COMMIT이 구 Writer를 무효화해야 함. 실제 Word 문안 편집 동시경합·직원 UX 미실행.
- `A4-LAW-006` [ ]: A→B→A는 SHA가 같아도 별도 법령 승인세대; 자동 기존 변호사 승인 무효화/유효성 판정 미실행.
- `A4-DATA-013` [ ]: D1 UPDATE에 활성 reference 조건을 같이 두는 후보와 중복 조건 추출 검증. 운영 D1/R2 원자성·보상트랜잭션 미실행.
- `X-046` [ ]: 두 SQLite 연결의 간격 승인 변경과 이후 저장 12가지 합성 대조. 실제 Cloudflare HTTP 2워커 및 lease·response loss는 미실행.
- 간접 검토: `A4-CALC-016` [ ] 계산 Head ABA·중복 writer 종단 미실행; `A4-AX-013` [ ] 재생성/검수 인계 미실행. 6역할은 검토 순환하되 5개 주요 ID 외 간접 항목에 완료 표시는 하지 않음.

## 실패복구와 다음 체크
- 원문/서류/OCR 변경→**10분 quiet**→계산 Head→95 법률→자동 Word→직원/변호사 검수→실제 보정 이벤트를 같은 활성 규칙 승인세대까지 결속하는 정책이 필요. `null/0/미관찰/비해당/상충/source-only/승인전`을 모두 분리하고 자동 접수·인가 금지.
- 다음 회차: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-046`; #167의 repo Node 테스트·정식 TS/CI 실행, #164 병합 충돌, 기존 링크 재시도 404/503/ACK 유실 및 사람 승인 무효화 검증. 운영 D1 migration·production deployment·전자제출·법원 인가 **미수행**.
- **70차 최종 인수 완료 0/5, 제품 전체 최종 인수 0건.** 합성 SQL 일부 일치와 운영·공식 법률 인수는 별개.
