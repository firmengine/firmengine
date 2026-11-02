# FirmEngine A4 — 69차: 직원 인계 alreadyLinked 재생의 미검증 R2/SQL 증빙

작성일: 2026-11-02 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. **고객 데이터/실 OCR/키/env/법률 판정 정답 미사용**.

## 실제 GitHub 근거 및 판본
- 감사 시작 main HEAD: `4d7a08d86d7aab4f36498e2fb6ad02e36fff64d8`; 감사 영수증 작성 직전 main HEAD: `4d7a08d86d7aab4f36498e2fb6ad02e36fff64d8`. 다른 에이전트의 A2/A3 커밋과 열린 PR 목록을 조회했다.
- main `lib/automatic-draft-handoff.ts` blob `a525e3c12672966c993f83021d5f169b170bebe9` 및 `lib/automatic-draft-handoff-contract.ts` blob `43cd0e0245bb74d396879880161654cf80a2978e`. POST route `app/api/cases/[id]/automatic-draft-handoff/route.ts` blob `1ba46ee3d55c5a02560525a047cc91062e3e15a2`. `tests/automatic-draft-handoff-contract.test.ts` blob `01724a1f0e214701fdc89458ef776c2606c0f1ee`. `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56` 확인.
- 관련 계산/법률 스키마 0011/0012/0017 및 68차 영수증 `20261102-round68-staff-handoff-immutable-run-owner-epoch.md` 확인. Draft #17/#24/#161/#164 모두 Open/Draft/미병합 확인. #164의 읽기 시점 Run 동일성 강화는 **이번의 linked 재생 증빙 검사를 대체하지 않는다**.
- `docs/ax-n8n-e2e-scenario-matrix-20261030.md`는 설계 및 인수시험 정의이며 실 n8n 운영 워크플로 실행 영수증이 아니다.

## 소스 상의 위험 분기
`adoptAutomaticDraftForReview()`은 `const decision=decide(...)` 이후 바로 `if(decision.alreadyLinked)return {status:"already_linked",...}` 실행한다. 그 아래의 (a) 요청 `expectedRevision`/`expectedStateFingerprint` 검사, (b) SQL `artifacts` 소유권/해시/키 검사, (c) R2 `bucket().get` 및 실제 바이트 SHA-256, (d) Writer receipt·계산 검토 자료 재대조, (e) 후행 `head()`와 `saveCase(...expectedHeads)`를 거치지 않는다. 읽기 API `readAutomaticDraftHandoff()`에서도 `linked` 계산은 저장 Manifest와 직전 run 메타데이터를 기반으로 하며 SQL/R2 실제 proof 확인이 없다.
이것은 **이전에 한 번 링크된 초안을 다시 보는 경로의 증빙 미검증** 위험 후보이다. 신규 링크 경로에는 SQL/R2 proof 루프가 존재하므로 두 경로를 혼동하지 않는다. 실제 고객 오연결/유출/승인 우회는 미관찰.

## 실제 Node 독립 합성 재현
- Node 22.16.0 `node --experimental-strip-types --test`, `node:sqlite` WAL 독립 두 연결, 사건 `case-A`/타 사건 `case-B`, 원본판본 7, revision 3, 법률 run `legal-A`, 계산 run `calc-A`, 이미 linked인 Manifest, 합성 artifact hash. 모든 자료는 가상.
- main `automaticDraftHandoffDecision()`의 본문을 동일 제어식으로 전사한 **source-equivalent 독립 harness** 및 main POST의 early-return 순서를 모사했다. **실제 Next.js handler의 mock 통합시험이 아니며 D1/R2 API 실행도 아니다.**
- 13/13 관찰 일치: (1) 정상 linked→already_linked; (2) unlinked→proof 경로 후보; (3) 워커 B SQL row DELETE COMMIT 후 A→already_linked; (4) 다른 사건 SQL owner 변경 후→already_linked; (5) 가상 R2 삭제→already_linked; (6) R2 바이트 변조→already_linked; (7) R2 GET 503을 미관찰 상태로 두었으나 GET 호출 0건/이미 linked 응답; (8) 오래된 expectedRevision/fingerprint 입력도 fastpath 계약에는 반영되지 않음; (9) 활성 reference SHA 다름→차단; (10) 원본 dataVersion 다름→차단; (11) 법률 Head 변경→차단; (12) pending edits 있는 같은 linked 상태→already_linked (제품 정책 검토 필요); (13) Manifest 해시 변경→차단.
- 두 SQLite WAL 연결에서 한 연결이 합성 SQL artifact를 삭제/사건 소유권 변경 COMMIT한 뒤 다른 연결이 linked 분기 결정을 내리는 **순차 interleaving**을 실행했다. 실 분산 HTTP 두 워커/CAS commit 경쟁을 재현한 것은 아니다.
- 독립 기대값: 정상일 때만 기존 링크 재사용 *후보*; SQL row 누락/타사건 귀속은 상충·복구보류, R2 누락은 missing, 바이트 hash 불일치는 상충, R2 GET 503/timeout은 **미관찰**이며 없는 파일 또는 확정 성공이 아니다. 오래된 호출자의 fingerprint는 idempotency 정책에 따라 409 또는 별도 현재 증빙 대조를 요구한다. `pendingEdits`를 linked 재호출에서 허용할지는 직원/변호사 정책 검토 대상이며 자동 오류라고 단정하지 않는다.
- 신규 테스트 파일 `round69_staff_handoff_already_linked_proof_sqlite.test.mjs` SHA-256 `f137e7e4a59947a2746eda849a59ef57c16fffb7b989cd26718464c600aad2db` (격리 작업 산출, 공개 Git에 합성 fixture 외 증빙 미적재). 64~68차의 기존 합성 테스트 포함 로컬 일괄 재실행 **77/77 기대 관찰 일치**: 8+13+12+16+15+13. **기존 위험 부정대조 포함: 제품 안전성 77개 인수가 아님.**
- 저장소 실제 전체 Node/TS/Next/CI: **미실행**. staging D1/R2/Cron·n8n 운영 워크플로·실 HTTP 두 워커·실제 Word 바이트·직원/변호사 승인·실제 법원 보정 이벤트: **미실행**.

## 6역할 회전과 체크 ID (직접 부분기록 5개, [ ] 유지)
순서: **사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX → IT**.
- `A4-IT-005` [ ]: 이미 linked 응답은 DB/R2 증빙 재확인 없이 반환; R2 503은 미관찰. 실제 ACK 유실 복구 미실행.
- `A4-DOC-011` [ ]: 이미 linked인 Word를 다시 직원에게 제공할 때 변경·삭제된 파일을 유효 후보로 표시할 수 있음. 실제 문안 편집/재생성 및 Word 렌더 미실행.
- `A4-LAW-013` [ ]: 이전 Word artifact ID 재반환은 최종 DOCX 바이트·공식 서식·변호사 승인 증명이 아님.
- `A4-DATA-013` [ ]: 합성 SQL artifact 삭제/타사건 owner 변조, R2 삭제/바이트변경·503 분리; 운영 DB/R2 보상 미실행.
- `X-046` [ ]: SQLite 두 연결의 read→SQL DELETE/owner 수정→linked 응답 순차 경합은 확인, 실 HTTP 두 워커/원자적 CAS 미실행.
- 간접 인계: `A4-CALC-016` [ ] 계산 최신성 결과 확인만, writer 동시 계산 미실행; `A4-AX-013` [ ] 직원→변호사 리뷰/재생성 실제 연결 미실행.

## 복구 설계 및 차기 검증
한 번 연결된 인계도 현재 사건·법률/계산 Head/활성 승인세대, Manifest와 SQL artifact의 사건 소유권/해시/키, R2 실제 바이트 SHA-256, Writer receipt를 재대조하기 전 확정 성공으로 응답하면 안 된다. 연결 시점 증빙이 영속 불변임을 별도 증명할 수 있다면 캐시 재사용 정책을 정의할 수 있다. **저장 미관찰/null/0/비해당/상충/source-only/승인 전**은 분리한다. 요청 fingerprint 무시·pending edits 재사용의 정책 의미는 직원/변호사 검수와 함께 정해야 한다.
- 신규 링크 경로의 SQL/R2 proof와 기존 링크 fastpath를 공통 검증기로 묶는 구조가 후보. 다만 응답·재시도 정책 및 외부 R2 호출 의미가 바뀌므로 **별도 Draft PR + 실제 실무자 리뷰 필요**; 이번 회차는 운영 코드를 수정하지 않았다. #17/#24/#161/#164 병합 시 동일 파일/재생 분기 교차 테스트 필수.
- 다음 ID: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-046`. 다음 시험: 직원 POST 이미 linked fastpath의 D1 ACK 유실/HTTP 재시도, R2 404/503/timeout, SQL receipt 누락, Head A→B→A, 요청 fingerprint 경합, 새 Word 후 기존 직원·변호사 검수 무효화.
- 운영 배포, D1 운영 마이그레이션, 실제 전자제출, 법원 인가 확정 **미수행**. **69차 신규 최종 인수 0/5, 전체 최종 인수 0**.
