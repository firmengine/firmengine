# FirmEngine A4 — 77차 (2026-11-02 17:46 KST): staff Word 인계 시 자동초안 Run 상태/Artifact 세대의 CAS 누락

- **범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 의 실행흐름/예외/동시성/복구만; 공개 Git에 합성 사건 식별자만 사용.
- **읽은 main SHA**: `57208fe72f7b583b7f6e6af16bd320640ffbbed6`. 이전 76차 main/영수증 및 Draft PR #167/#170/#174/#176, 중앙 보드 ID, 실제 SQL `lib/automatic-draft-handoff.ts`, `lib/server-store.ts`, `drizzle/0012_case_lawgraph_reviews.sql`, 관련 Writer를 확인.
- **관찰된 main blob SHA**: `automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`; `server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `document-writer.ts` `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`. 중앙 보드 원본 blob `4536333fb7a72133dbed2dca5811106987964bf1`.
- **직접 선택한 미검증 ID(모두 [ ] 유지)**: `A4-IT-005`, `A4-DOC-011`, `A4-DATA-013`, `A4-AX-013`, `X-047`. 계산사무장 `A4-CALC-016`·변호사 `A4-LAW-013`은 간접 인계/승인 조건만 검토(별도 체크 완료로 산입하지 않음).
- **6역할 순환**: 변호사 → 데이터 → AX → IT → 사용자·서류 → 계산사무장 (직접 법률인정/금액산정/승인 없이 순서대로 안전요건 검토).

## 새 합성 반례 — 원본 자동초안 Run의 최신성은 최종 저장 CAS와 원자 결속되지 않음

1. 실제 `head()`는 현재 `case_data_change_state`·계산/법률 Head를 조회하고, `completeRun()`은 `case_automatic_document_runs`를 별도 SELECT한다. `adoptAutomaticDraftForReview()`는 최초 `run.status===complete` 확인 뒤 R2 바이트, SQL artifact, Writer receipt를 읽고 마지막에 **Head만** 다시 SELECT한다. `decide(data,run,after,artifacts)`는 최초 메모리 스냅샷 `run`·`artifacts`를 재사용한다.
2. `saveCase(...,{mutationCategory:'artifact_only',expectedHeads})`의 현재 원자적 UPDATE CAS는 원본 버전·계산/법률 Head·계산 기준정보 SHA·사건 token/revision을 조건으로 사용하지만 **자동초안 Run status, run caseRevision, artifacts_json의 현재 값은 비교하지 않는다**.
3. 합성 워커 A가 정상 `complete` Run 및 artifact 목록 A1을 읽은 다음, 독립 워커 B가 **같은 사건/Head를 유지한 채** Run `status=failed` 또는 `pending`으로 변경하거나 artifacts_json을 A2로 바꾸거나 run caseRevision을 낮춘다. A의 Head 재조회는 이전과 같으며, 기존 CAS는 1행 저장할 수 있다. 기대는 보류/충돌 0행이다.
4. 추가 Run 세대 조건을 **비교용 SQL 후보**로만 구성하여 동일 두 WAL 연결에서 실패닫힘 0행을 확인. 현재 저장소 코드는 수정하지 않았다. 이 후보는 DB의 동시 재검사 계약이 필요하다는 시험용 오라클로서 운영 방안 확정이 아니다.
5. **발생 가능성의 한계**: 검색한 main 작성경로는 `pending→complete`만 갱신한다. 이미 `complete`인 run이 정상 플로에서 되돌려지는지 확인되지 않았다. 따라서 이를 실서비스의 현재 장애 또는 일반 사용경로 P1 확정으로 표현하지 않는다. 관리 복구/비정상 겹침 상태에서의 **조건부 동시성 보호 공백**이다.

## 실제 로컬 실행 (Node v22.16.0 / node:sqlite WAL 두 연결)

입력: `SYN-R77-CASE`, case revision 3, source version 7, token `tok-before`, completed run `SYN-R77-DRAFT`, SQL artifact 목록 A1, calc/legal Head/CAS/reference SHA 일치. A는 Run/Head를 읽고 B는 D1형 SQLite 트랜잭션으로 개입한 뒤, A가 원본 `saveCase` CAS와 **별도 비교용 강화 CAS**를 각각 다른 fixture에 실행한다. 실제 Cloudflare D1/R2 호출이 아니다.

| 개입/독립 기대 | 관찰 원본 main 동등 CAS | 비교용 Run 세대 CAS |
|---|---:|---:|
| 정상 complete + 동일 A1 → 저장 가능 | 1 | 1 |
| B가 complete→failed → 차단 기대 | **1 (부정대조/위험)** | 0 |
| B가 complete→pending → 차단 기대 | **1 (부정대조/위험)** | 0 |
| B가 A1→A2 artifact list 변경 → 차단 기대 | **1 (부정대조/위험)** | 0 |
| B가 run.caseRevision 3→2 → 차단 기대 | **1 (부정대조/위험)** | 0 |
| B가 legal head 변경 → 기존 차단 기대 | 0 | 0 |
| B가 계산 reference SHA 변경 → 기존 차단 기대 | 0 | 0 |
| B가 사건 storage token 변경 → 기존 차단 기대 | 0 | 0 |

- **최초 테스트 실행**: 9/10, 실패 1은 합성 테스트의 잘못된 `head` 동등성 기대(다른 token은 Head 불변)였다. 테스트 기대식을 바로잡고 신규 **10/10** 재실행 통과. **r75+r76+r77 합성 회귀 35/35** 통과. 부정대조가 포함되므로 제품 안전성 인증이 아니다.
- 재현 코드 `automatic_draft_run_epoch_cas.test.mjs` SHA-256 `7deb89a6137c853955149a5d8b9eef38b43f412088abf3b1d3e0fcb000d987dc`; 신규 실행출력 SHA-256 `0d16580655d15cb74e2dacc345a0150eae50d8450db0a20df260c1f5e2e65361`; 통합 회귀 출력 SHA-256 `85b0ae5a451f48f9522f8c201ff902969b71fe86bec8639e2cf8303776c160f8`. 파일은 로컬 산출물; 저장소 테스트 runner/실제 모듈 import 실행은 **미실행**.
- **미실행**: 전체 Next/TS/CI, staging D1/R2/Cron, 실제 HTTP 2워커, 10분 quiet, 실제 95법률 종단, DOCX 바이트 및 공식 서식, 직원/변호사 승인, n8n 운영 워크플로. 설계 문서는 운영 흐름 증빙이 아니다.
- **stage 경계**: 상담→서류→OCR→quiet 계산→95법률→Word 최초 생성은 과거 소스 구조만 간접 확인; 이번 직접 수행은 **Word complete Run→직원 인계** CAS 합성 단계뿐. 편집→Word 재생성→직원/변호사 승인→실제 보정 이벤트 종단은 미실행.
- **상태 구분**: CAS **0**=이번 합성 저장 0행; `NULL`=증빙 값 부재; `UNOBSERVED`=R2 503·실 Cloudflare 미관찰; `CONFLICT`=Run 상태·판본/JSON 상충; `source-only`=테스트 후보; `승인전`=직원/변호사 검토 전; `비해당`=법원 인가/제출 처리 금지.

## 해결·후속

- 이번 회차 해결: **원인 범위와 실패닫힘 비교용 CAS의 수치 재현**. 서비스 실행 코드 변경/병합 없음. 기존 Draft #167/#170(승인세대·감사 원자화), #174/#176(이미 연결된 문서 증빙/읽기전용 캐시)도 미병합 유지.
- 실제 보완안은 최종 `saveCase` 트랜잭션의 원자적 Run status/ownership/source epoch/artifacts 목록 대조 및 중복/변경 원장의 불변성 정책 검토. 일반 경로에서 Run status 재작성 가능성, 이행 비용 및 이력 불변성 확인 필요. 단순한 SQL 비교만으로 파일 R2 바이트 최신성을 확정하지 않는다.
- **다음 ID**: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-047`. 다음 작업은 임시 R2 오류·D1 ACK 소실, `already_linked`의 원본/인계 세대 분리, 사용자 편집→재생성→기존 승인 무효화, 실제 DB 2-worker test.
- 직접 선택한 5 ID **최종 인수 완료 0/5**. 전체 최종 인수 **0**. 개인정보·원문 OCR·실사건·비공개 정답/키 공개 Git 기록 없음. 운영 배포/DB 마이그레이션/전자제출/법원 인가 수행 없음.
