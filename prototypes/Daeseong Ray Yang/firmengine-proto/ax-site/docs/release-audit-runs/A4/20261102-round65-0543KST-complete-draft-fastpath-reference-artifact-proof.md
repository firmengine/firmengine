# FirmEngine A4 65차 — 자동 Word `complete` 재생 fast-path의 기준판본·artifact 증명 공백 (2026-11-02 KST)

## 범위·근거·실제 관찰 수준
- 절대 변경범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 금지.
- 읽기 시점 main HEAD `995ed7dedf77a902098c8855cabd117dab248266`; `lib/automatic-review-draft.ts` main blob `5ee8860250303ac9ca513b0be22e886f98c8e904`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`; `lib/reference-runtime.ts` `9993469a164740e8a9128874b299a967b420e230`.
- 최근 main 상위 커밋: `995ed7ded`(A3 r65), `281b001b4`, `8f038643f`; 다른 축 변경 미수정. 감사 기준은 중앙 보드의 기존 미완료 체크와 64차 `20261102-round64-ghost-receipt-pr17-pr24-retry.md` 영수증.
- 비교 PR: #17 Draft HEAD `0ce1292a241d8baf98d5b9e230071cca980eb2fa`(`automatic-draft-manifest-cas.ts` `ebb2de08c1371ed3c37d9946f37b3ce251a8b628`), #24 Draft HEAD `dc5d93d45e944466ba126d2b998345d6c2f38843`; #150 Draft HEAD `744a5f17e4189517e049419a871c9039597bc0ff`. **모두 이번 조회 당시 미병합, 완료 증명 아님.**
- 역할 순환: **변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장**. 실제 담당자·변호사 승인이나 운영조직 검수의 대체가 아니라 각 검토 관점 순환.
- 선정 미검증 체크 [ ] **5개**: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-046`. 계산 `A4-CALC-016`, AX `A4-AX-013`은 인접 stage를 간접 확인만 함. 모두 최종 합격 **0/5**.

## 64차에 이어 읽은 실제 소스의 조건
- `generateAutomaticReviewDraft`는 `assertCurrent(input)`에서 case revision, `case_data_change_state.data_version`, calc-head run ID, legal-head review ID, 작업권 token/status/lease 기한을 먼저 확인.
- 이어지는 `SELECT status,artifacts_json FROM case_automatic_document_runs WHERE legal_review_run_id=? AND case_id=?` 후 `existing?.status === 'complete'`라면 `JSON.parse(existing.artifactsJson).map(...)`를 **바로 반환**.
- 이 완료 재생 분기는 `referenceIdentity()`의 request-scoped 활성 SHA/승인세대를 비교하지 않고, writer receipt/manifest source·calc·reference provenance, artifact 행 소유권·존재, R2 바이트·해시도 읽지 않음. PR #17은 **새로운 완료 커밋 시 CAS**를 보강하지만 이 **기존 완료 재생** 경로는 변경하지 않음.
- 상위 `case-legal-automation.ts`는 draft 생성 호출 **직후** `assertCurrent`를 따로 수행하므로 메서드 반환 위험과 **실제 legal `draft_ready` 상태 확정**을 동의어로 표현하지 않음. 상위 guard 및 실무 승인 우회는 미재현.

## 독립 실행 (Node 22.16 / 파일형 SQLite WAL 두 연결)
- 실행 파일: `/mnt/data/firmengine-a4/round65_completed_draft_replay_head_reference_artifact_sqlite.test.mjs` (본 회차 첨부 출력). 테스트의 `assertCurrentSql`과 완료 manifest 조회 SQL은 위 실제 main 원문에서 전사; 나머지 환경은 합성 최소 스키마.
- 입력: 사건 A, revision=3, sourceVersion=7, calc=calc-A, legal=legal-A, 작업 token-A, lease 2099, `complete` Manifest `artifact-A`, artifact owner=case A, 활성 reference `ref-A`/승인세대 1. 사건 B는 타 사건 소유권 대조. 시각 `2026-11-02T00:00:00Z` 고정. 실제 법원·고객·키·원본 OCR 없음.
- **독립 기대:** 완료 재생은 현재 승인세대·manifest 출처·artifact 존재·사건 소유권·R2 증거 일치 확인 후에만 통과. 증거없음/상충/원문 변경은 보류·미관찰 분리; 자동 `complete`/법률 인가로 승격 금지.
- **관찰 13/13 expected behavior 일치** (이 숫자에는 기존 결함 재현·부정대조가 포함됨):
  1. 정상 A1 + artifact row 유효: 이전 artifact 1건 반환 (정상 대조).
  2. A→B (source/revision/heads/lease 유지): **이전 A artifact 반환**, 실제 활성 `ref-B`와 상충.
  3. A→B→A, 승인세대 1→3: **이전 A artifact 반환**, 같은 SHA로 신규 승인세대 구분 불가.
  4. artifact DB 행 삭제: **없는 artifact ID 반환**.
  5. artifact row의 `case_id`를 타 사건 B로 변경: **타 사건 ID 반환**.
  6. `complete`와 `artifacts_json=[]`: **성공처럼 0건 반환**.
  7. `complete`와 `artifacts_json=null`: `TypeError`(분류된 보류 아님).
  8. `complete`와 잘못된 JSON: `SyntaxError`(분류된 보류 아님).
  9~12. lease token 교체/source 7→8/calc head 교체/legal head 교체: 기존 `assertCurrent`가 실패 반환하는 **정상 차단 대조**.
  13. `pending` Manifest: 완료 재생 분기 진입하지 않는 대조.
- 55~65차 로컬 합성 스크립트 12개 **110/110 TAP 관찰 일치** (각 파일 독립 실행: 11,10,8,1,6,10,8,12,14,9,8,13). 기존 결함의 부정대조 수치가 포함되므로 **제품 안전성 110건 통과는 아님**.
- 두 SQLite 연결을 사용한 **순차 변이 주입**, 실제 클라우드 동시 2 HTTP 워커 아님. R2 해시·바이트 및 실제 Word·직원/변호사 검수 **검증하지 않았음**. 활성 reference 승인세대는 **합성 테이블**의 모델이며 현재 운영에 존재하는 승인세대 설계가 확인된 것은 아님.

## 조치 / 충돌방지 / 다음
- 고위험 기존 완료 문서 재사용·법률 승인 의미가 달라질 수 있어 실행코드·DB 스키마·배포는 **변경하지 않음**. PR #17에 본 반례와 원본·판본·R2 증명 없는 replay의 병합 보류 검토를 댓글로 기록: https://github.com/firmengine/firmengine/pull/17#issuecomment-6563668293.
- `A4-IT-005`: 완료 영수증 재조회와 안전한 재사용의 의미가 별개임을 재현. `A4-DOC-011`: 구 문안 replay 위험. `A4-LAW-013`: 실제 Word 바이트·승인 미검증. `A4-DATA-013`: SQL Manifest `complete` 자체가 R2/소유권 증명이 아님. `X-046`: 타 사건 artifact row 사용 부정대조(실제 두 워커 E2E는 미실행).
- 필요한 수정 후보: 완료 replay 전에 writer receipt + manifest + 현재 원본·계산·법률·기준정보 승인세대 + artifact owner/ID/hash/objectKey/상태 + R2 실존·hash 증거 결합; 누락/null/0/상충/unobserved/source-only/승인전 각각 별도 상태; 이전 receipt/증빙 덮어쓰기·R2 삭제 없이 재조정; 실제 승격은 사람 승인 유지. 복구 계약이 확정될 때까지 PR #17/#24 병합 보류 검토.
- 다음 체크 ID: `A4-IT-005`, `A4-DATA-013`, `A4-DOC-011`, `A4-LAW-013`, `X-046`; 64차 ghost receipt와 65차 완료 replay를 **같은 요청 UUID/영속 receipt**로 통합 경합 주입, #17/#24 코드 충돌 병합 시범, 실제 staging D1/R2/Cron의 R2 성공→D1 failure/ACK lost 및 429/503/timeout/중복 웹훅 검증.
- 상담→서류→OCR→10분 quiet calc→법률 95개→Word→직원/변호사 검수→실제 보정이벤트의 종단 E2E, 갈음 철회·관할판본·기한·재생성, n8n 운영 workflow와 설계 비교, 실제 고객자료 처리는 이번 회차 **미실행**. 운영 배포·운영 D1 migration·전자제출·법원 확정 **미실행**. 신규 최종 인수 0/5, 전체 인수 0건.
