# FirmEngine A4 78차 — D1 COMMIT ACK 소실 뒤 **과거 저장 증명**을 **현재 직원 Word 연결**로 오인할 수 있는 응답 계약

작성: 2026-11-02 18:44 KST · 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래 실행흐름/예외/동시성/복구만. 전부 합성 사건. 실제 고객 문서, 원본 OCR, 개인식별값, 키, .env, 비공개 정답 없음.

## 1. 우선 열람한 원천 / 판본

- 최초 조회 main `3cdc2fe0e073a016bc68d12771a9d3ec6b801e47` (2026-11-02 18:41:07 KST); 본 영수증 업로드 직전 확인 main `3cdc2fe0e073a016bc68d12771a9d3ec6b801e47`. 최근 A3 r78, A1 r77, A2 법률 r78 커밋이 병렬 유입. 이 변경은 A4 코드 범위를 덮어쓰지 않음.
- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `8bb6055bd61bedec053df165af31a8d13809824f`; [ ] 미인수 ID·과거 75~77차 내용 확인. 이전 [77차 영수증](20261102-round77-1746KST-staff-run-epoch-cas-race.md)을 먼저 읽어 Run status/artifact JSON 최종 CAS 미결과 분리.
- 실행코드/blob: `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`; `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `lib/automatic-review-draft.ts` `5ee8860250303ac9ca513b0be22e886f98c8e904`; `lib/automatic-draft-handoff-contract.ts` `43cd0e0245bb74d396879880161654cf80a2978e`; `lib/export-artifact-transaction.ts` `a114235e5b5de57b5ae58b41026f939ee8543174`.
- 스키마/테스트: `drizzle/0012_case_lawgraph_reviews.sql` `313375977527c76be5c87668b91bbbb24a0fef8a`; `drizzle/0017_legal_reanalysis_orchestration.sql` `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`; `tests/automatic-draft-handoff-contract.test.ts` `01724a1f0e214701fdc89458ef776c2606c0f1ee`; `tests/export-artifact-transaction.test.ts` `a684612f61234a9fb0ac30261684733ba749eefc`.
- 당시 확인한 관련 PR: #164, #167, #170, #174, #176 모두 Open/Draft/미병합(시각 기준); #176은 #174의 stacked base, 즉 main에 기능 반영됐다는 뜻이 아님.

## 2. 실제 코드의 독립 관찰과 질문

`saveCase(...,{mutationCategory:'artifact_only',expectedHeads})`는 `UPDATE cases ... WHERE revision=? AND storage_token=? AND EXISTS(현재 calc/legal head...)`와 `INSERT analyses ... WHERE 현재 token`을 동일 D1 batch로 실행한다. 해당 batch가 **실제 COMMIT된 후 응답만 유실되어 catch 진입**하면, `SELECT storage_token`과 `SELECT analyses WHERE id=evaluationId`를 조회하고 **`row.token===newToken || !!proof`**이면 committed=true로 간주한다. 고유 evaluation receipt가 남아 있다는 사실은 **A 작업이 과거 커밋되었다는 증거**이지만, 그 뒤 워커 B가 원문/Manifest/법률 Head를 갱신해도 **A 링크가 지금 유효하다는 증거는 아니다**.

그런데 `adoptAutomaticDraftForReview()`는 이 `saveCase`가 복구 성공한 뒤 감사 이벤트를 별도 저장하고 `{status:'linked'}`를 반환한다. 오류 후 재조회에서 `proof`만으로 복구한 경우, **historical_commit=true / current_link=false**가 동시에 성립할 수 있어 현재 연결 상태를 오해할 여지가 있다. 이는 **현재 실제 배포에서 발생 확인된 사고가 아니라 특정 인터리빙에서의 응답 의미 충돌 후보**다. 단순히 과거 COMMIT 증명이 틀렸다는 주장은 아님.

## 3. 독립 합성 실험: Node v22.16.0 + 파일형 SQLite WAL 두 연결

입력: 사건 `SYN-R78-CASE`, revision=3, dataVersion=7, token=`token-old`, current calc=`SYN-R78-CALC`, legal=`SYN-R78-LEGAL`, SHA=`a×64`. 워커 A가 같은 revision의 직원 Word Manifest(`SYN-R78-DOC-A`)를 `token-a`로 D1 동등 UPDATE+derived evaluation INSERT 트랜잭션 COMMIT. ACK 소실을 **합성 제어 순서**로 구현(실제 Cloudflare ACK 유실은 주입하지 않음). 그 뒤 워커 B가 독립 SQLite connection으로 source revision=4, 동일 revision의 `DOC-B` 교체, 혹은 legal Head 변경. A는 실제 main의 recovery predicate를 전사해 조회. 현재 유효성은 별도 최신 `cases.payload`/revision/token/legal head로 독립 대조.

| 입력·개입 | 독립 기대 | source 동등 복구 판단 관찰 | 최신 상태 관찰 |
|---|---|---|---|
| A 정상 COMMIT, 후속 워커 없음 | 과거 저장·현재 연결 모두 참 | `linked` | current DOC-A=true |
| A COMMIT, ACK 유실, B 없음 | 영수증 재조회로 안전 확인 후보 | `linked` / proof=1 | current DOC-A=true |
| A COMMIT 뒤 B가 새 원본 v8 확정 | 과거 commit=true, **현재 link=false** | **`linked`** / proof=1 / token=B | revision=4, manifest=null |
| A COMMIT 뒤 B가 DOC-B로 인계 교체 | 과거 commit=true, **현재 link=false** | **`linked`** / proof=1 / token=B | 현행 artifact=DOC-B |
| A COMMIT 뒤 B가 legal head 교체 | 과거 commit=true, 법률 인계 효력 **재검증 필요** | **`linked`** / proof=1 | legal run=B |
| B가 먼저 원본 변경, A 늦은 CAS | A 미커밋, 충돌 처리 | UPDATE=0 / INSERT=0 | A proof 없음 |
| B가 먼저 token 선점, A 늦은 CAS | 한 워커만 성공 | UPDATE=0 / INSERT=0 | A proof 없음 |
| ACK/receipt 조회 미관찰 | 미확정을 성공으로 승격 금지 | 비교용 상태 오라클 `UNOBSERVED` | staging 미실행 |
| 과거 receipt와 현재 링크 분리 | 서로 다른 status로 보고 | proof=true | currentLink=false, 승인전 |

**신규 TAP 9/9 기대 관찰 일치**, 75~78차 회귀 **44/44**(기존 결함을 일부러 재현한 부정대조 포함). 저장소 모듈 import/실 HTTP worker/전체 CI 성공이 아님. 재현 파일 SHA-256 `27fdefa88fbd7a8895eb25c145671e8aa6f909a6c652d9b6f2f1774f7b0c1fc9`; 신규 실행 출력 SHA-256 `5128a6579b9be5ef7f602b445f58c1d4402601d099fb2986856e0c6ae4f1abb7`; 누적 회귀 출력 SHA-256 `6c81fd57e32d8be6cf308cd18db93c07d71b74b89ce9b9f527bd12b7a1810704`. 파일은 이 회차 로컬 합성 산출물, GitHub 테스트 runner/PR에 이 실행결과를 거짓으로 합격 반영하지 않음.

## 4. 6역할 관점과 [ ] 체크 ID

순환 순서 **데이터 → AX → IT → 사용자·서류 → 계산사무장 → 변호사**; 사람 자체 검토·법률/회계 승인을 진행한 뜻이 아님.

- 직접 선택한 **5개 [ ] 미완료**: `A4-IT-005`(영수증 재조회와 현재 상태의 차이), `A4-DOC-011`(직원 재생성/교체가 기존 링크 응답을 supersede), `A4-LAW-013`(과거 인계 성공은 현행 Word 검수/변호사 승인 아님), `A4-DATA-013`(COMMIT+ACK 모호성의 D1 증거/현재 포인터), `X-047`(R2/D1 ACK 유실 교차 시나리오 중 D1 복구 부분만).
- 계산사무장 `A4-CALC-016` 및 AX `A4-AX-013`은 source/derived 평가 결과와 인계세대 연결을 **간접 검토**, 직접 완료 산입하지 않음.
- 정상 COMMIT 직후 최신 조회가 참이어도 그 즉시 다른 워커가 바꾸는 경합은 **읽기 후 원자적 영구보장 불가능**. 응답 계약을 historical commit vs current/latest-head로 구분하고 검증 시각/판본을 표시하는 정책이 필요하다. 이력/승인 의미 변경 우려가 있어 코드 변경·자동 병합 금지, 기존 Draft PR #170/#174에서 검토.

## 5. 실제 복구 결정 및 미실행

이번 회차 해결: 고유 영수증을 통한 **과거 COMMIT 사실 확인**과 **현재 문서 연결 상태 판정**을 분리해야 하는 조건부 반례 재현. 실제 제품 코드 변경 없음. 법률·계산 승인/서식 의미 변경은 실무자 검토 전 수정 금지. 다음 정책 후보: post-ACK 복구 결과를 `committed_current`/`committed_superseded`/`not_committed`/`unobserved`로 구분할지 정하고, 무결성이 확인된 R2/SQL/Run/Head 최신 재조회에만 현재 연결 표기, 완료 receipt는 원본 덮어쓰기 금지.

**stage 경계**: 상담→서류→OCR→10분 quiet calculation→95법률→자동 Word 생성까지는 이전 소스·기존 영수증 참고만 함. 이번 직접 실행은 **staff Word artifact-only 저장/D1 ACK 복구/후속 변경 경쟁**의 SQLite 합성 1개 구간. 원문 변경은 B의 DB 버전 가상 갱신으로만 실험. 갈음 철회·관할 판본·법원 기한 NULL·Word 재생성 실바이트·직원/변호사 실제 검수·보정 이벤트는 **미실행**.

**실행수준 분리**: 코드 조회=실행 인증 아님; Node 합성 9/9=실제 애플리케이션 통합 아님; 리포지토리 CI/Next/TS=미실행; 실제 staging D1/R2/Cron=미실행; R2 PUT→D1 ACK 유실/429/503/timeout·중복 웹훅·실 HTTP 두 워커=미실행; 공식 법원 서식/변호사 승인/사이트 배포=미검증. n8n `n8n-reference/NODE_MAP.md`는 **설계상 구 Python API HTTP 노드**를 설명하며, 현재 `ax-site`는 Next.js/TS 직접 흐름; 운영 n8n 게시·활성 상태는 미관찰.

**상태 분리**: `NULL`=자료 부재, SQL `0`=변경 행 0개, `UNOBSERVED`=ACK/DB/R2 조회 미확정, `CONFLICT`=현재 판본·Manifest 상충, `source-only`=합성 수준, `승인전`=사람 검수 전, `비해당`=법원 인가 확정·전자제출 수행 안 함. 0원이라는 값은 검증된 계산 결과가 아님.

다음 우선 체크 ID: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-047`. 다음 수행: PR #164/#167/#170/#174/#176 병합 전 복구/검토세대 계약을 독립 대조하고, 실제 staging 두 HTTP 워커·R2 GET 바이트·D1 receipt 최신 판정·Word 재생성/승인 무효화를 실제 경로에서 검증. **이번 신규 최종 인수 0/5, 전체 제품 최종 인수 0.** 운영 배포, 운영 D1 마이그레이션, 전자제출, 법원 인가 확정 전부 미수행.
