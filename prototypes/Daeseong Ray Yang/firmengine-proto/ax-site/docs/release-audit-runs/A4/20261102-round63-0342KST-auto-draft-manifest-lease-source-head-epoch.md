# FirmEngine A4 63차 — 자동 Word 검토초안 Manifest의 작업권·판본 경합 (2026-11-02 KST)

## 범위 / 식별자 / 기준 버전
- 허용 파일 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 고객자료·원본 OCR·비밀키·.env·비공개 정답은 사용·공개하지 않음.
- 조사 시작 `main` 최신 HEAD: `f02df76fd6f9d05745a86d635ff9eadfc2e687ef`. 본 영수증 생성 직전 다시 확인한 `main` HEAD: `f02df76fd6f9d05745a86d635ff9eadfc2e687ef`.
- 원문 blob: `lib/automatic-review-draft.ts` `5ee8860250303ac9ca513b0be22e886f98c8e904`; `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`; `lib/export-artifact-transaction.ts` `a114235e5b5de57b5ae58b41026f939ee8543174`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 선행 A4 62차 영수증 `20261102-round62-legal-reference-epoch-aba-cas.md`, 기존 관련 Draft PR #17(HEAD `0ce1292a241d8baf98d5b9e230071cca980eb2fa`), #24(HEAD `dc5d93d45e944466ba126d2b998345d6c2f38843`), #150(HEAD `744a5f17e4189517e049419a871c9039597bc0ff`) 검토. 모두 Draft/Open/미병합 상태로 확인. #17과 #24는 같은 `automatic-review-draft.ts` 파일을 수정하므로 별도 충돌·병합 검증 필요.
- 6역할 순환: **사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX → IT**. 실무자 참여·최종 승인 없음.
- **선정 5개 ID 전부 [ ] 미완료:** `A4-IT-003` / `A4-DOC-011` / `A4-LAW-013` / `A4-DATA-013` / `X-046`. 계산사무장 `A4-CALC-016` 및 AX `A4-AX-013`은 간접 인계 조건만 검토. 각 ID의 완료 판정은 실제 제품 종단 수용 전까지 보류.

## 실제 검사한 원문 계약
- Main `generateAutomaticReviewDraft()`는 렌더링 직후 `assertCurrent()`를 확인하지만, R2/SQL artifact 생성 후 D1 `commitManifest`의 UPDATE는 `case_automatic_document_runs.status='pending'`와 `case_legal_review_heads`의 과거 `dataVersion` 및 `case_calculation_heads`의 **같은 case_id 조인**만 확인한다.
- 해당 UPDATE에는 현재 `case_data_change_state.data_version`, `cases.revision`, 현재 계산 Head의 `run_id`, 법률 job의 **활성 lease token**, DB 활성 `legal_reference_releases` 승인세대가 원자적으로 결속돼 있지 않다.
- 현재 main D1 batch의 첫 statement는 `analyses` writer 영수증을 **무조건 INSERT**, 두 번째 statement가 manifest UPDATE; UPDATE가 0행인 경우에도 첫 INSERT는 DB transaction 자체가 abort하지 않는 한 독립적으로 COMMIT 가능한 구조다.
- 별도의 법률 `transition()` lease CAS가 뒤늦게 0행을 반환해도, 앞서 커밋된 자동 Word 초안 manifest/분석영수증을 되돌리지 않는다. 이것은 Word 바이트/법원 제출/직원·변호사 승인까지 관찰했다는 뜻이 아님.

## 실제 실행 1 — main SQL 격리 Node 22.16 SQLite WAL, 두 독립 연결
- 로컬 증빙: `/mnt/data/firmengine-a4/round63_automatic_draft_manifest_cas_sqlite.test.mjs` (완전 합성 사례, 실제 main SQL 문자열을 blob에서 전사).
- 현재 사건: `case-A`, revision=3, dataVersion=7, calculation Head `run-A`, legal Head `review-A`, job `lease-A` 유효, 활성 reference `A1`; 완료 초안은 아직 `pending`.
- **13개 하위 검증 기대관찰 일치 + 1개 TAP 상위 = 14/14 pass.** 이것은 P1 부정대조를 포함한 시험 실행 성공이지 제품 안전성 PASS가 아님.

| 합성 개입 (마지막 preflight 이후) | 독립 기대값 | main SQL 관찰 | 후속 |
|---|---|---|---|
| 변경 없음, A1·lease A 유효 | manifest 1, legal 전이 1 | **1 / 1** | 정상 대조 |
| 두번째 연결이 lease A 만료 후 B 재점유 | 구 워커 A manifest 0 | **manifest 1** | 구 A legal transition **0**, 새 B lease 보존 |
| OCR/source version 7→8 | 구 manifest 0 | **manifest 1** | 구 A legal transition **0** |
| 계산 Head `run-A`→`run-B` | 구 manifest 0 | **manifest 1** | 구 A legal transition **0** |
| 활성 법률 기준 A1→B2 | 구 기준 draft 완료 보류 | **manifest 1** | 실제 Word/법률결론 미실행 |
| 진단용 lease·source·Head·release 승인세대 CAS | 비일치 0, 일치 1 | 비일치 **0** / 일치 **1** | 합성 대조, 제품 반영 아님 |
| 진단용 UPDATE만 0행으로 차단하고 영수증 INSERT 무조건 실행 | writer receipt 0이어야 함 | **UPDATE 0 / analyses INSERT 1** | 부분성공·고아 영수증 위험 재현 |

## 실제 실행 2 — 기존 Draft PR #17 SQL 후보 대조
- PR #17의 실제 `lib/automatic-draft-manifest-cas.ts` patch SQL을 독립 `/mnt/data/firmengine-a4/round63_pr17_manifest_remaining_gaps_sqlite.test.mjs`에 전사. 두 SQLite 연결, **8개 하위 기대 관찰 + 상위 TAP = 9/9 pass**. 모두 합성 관찰이며 운영 CI 아님.
- **개선 확인:** 정상 A1 = receipt/manifest **1/1**, source 7→8 = **0/0**, lease A→B = **0/0**, Head A→B = **0/0**. 기존 main의 무조건 영수증 INSERT도 상태 불일치 시 조건부 INSERT로 개선하는 후보.
- **남은 네 미보호 반례(각 receipt INSERT / manifest UPDATE **1/1**):**
  1. DB 활성 reference `A1→B2`인데 `cr.reference_sha256=A`를 그대로 신뢰. 현재 활성 release ID/revision/SHA를 SELECT하지 않음.
  2. `A1→B2→A3` 새 ID/revision·동일 SHA 복원도 구 A1 워커와 구별하지 않음.
  3. 사건 `case-A`의 Head/job/legal Head를 비정상적으로 `case-B`의 계산 Run에 연결. `cr.case_id=c.id` 부재.
  4. `case_calculation_runs.input_sha256`과 `case_calculation_heads.input_sha256` 불일치. `cr.input_sha256=h.input_sha256` 부재.
- 위 입력들은 **실제 DB 부정 상태를 인위 생성한 안전성 반례**다. 정상 제품에서 이러한 교차 참조가 발생하거나 개인정보가 누출된 사실은 관찰하지 않았음.
- #17에 독립 재현 및 병합 보류 의견을 [PR 코멘트](https://github.com/firmengine/firmengine/pull/17#issuecomment-6562315220)로 실제 남겼다. #17을 덮어쓰거나 병합하지 않음.
- 로컬 53~63차 스크립트를 함께 `node --test` 재실행: **107/107 TAP 예상 관찰 일치**(구 결함 부정대조 포함, 제품 인수 107건 합격이 아님). 전체 repository Node-native/TS/Next/CI는 미실행.

## stage·실증·복구 경계
- 상담→필요서류→OCR→10분 quiet calculation→법률 95→자동 Word→직원/변호사 검수→실제 보정 이벤트의 **종단 흐름 미실행**. 이번 회차 실제 코드는 자동 draft `commitManifest`와 법률 `transition` 경계만 정적 읽기 + 독립 SQL 재현.
- 중복 웹훅, timeout/429/503, 실제 R2 PUT 성공 후 D1 503/응답 유실, 운영 n8n과 설계 n8n 동등성, 실제 staging D1/R2/Cron/두 HTTP 워커 **미실행**. SQL batch의 0행/INSERT 부분성공은 SQLite 합성으로만 검사했음.
- 미관찰(네트워크 ACK)/`NULL`(저장 불명)/정확한 `changes=0`/비해당/상충/source-only/승인전 상태를 구분. 법률 판단/서식 적합성/직원·변호사 승인/법원 사건 접수·인가로 승격하지 않음.
- 원본·기준정보 판본/법원 관할·마감기한 미확정/갈음 철회·원문 변경/Word 재생성/검수 무효화/실제 보정명령은 **현재 회차 실행 증빙 없음**. 설계 및 원문상 요구만 확인.
- 운영 배포, D1 운영 마이그레이션, 고객자료 변경, 전자제출, 법원 인가 확정 **전부 수행하지 않음**.

## 다음 검증 / 미해결
1. **P1 후보 미해결:** #17의 조건부 writer receipt와 manifest CAS를 기반으로 `case_calculation_runs.case_id`, run/head input SHA, active reference release `id/revision/SHA`를 원자적으로 결속할지 실무 정책 검토. 특히 A→B→A 재승인 시 기존 법률·Word 실행 재사용 정책 확정 필요.
2. #17과 #24의 동일 파일 충돌 조정 및 R2 COMMIT ACK 유실 때 삭제 금지·영속 진단·고아 자료 수거 정책을 **실 staging**에서 별도 검증.
3. 법률 job `transition`과 draft `commitManifest` 사이의 lease 승계/원본 재변경 경합, staff/lawyer 기존 승인 무효화, 실제 Word 바이트 무결성, 95 법률 결과의 source/reference 연결 종단 검증.
4. 후속 우선 ID `A4-IT-003`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-046`; 간접 `A4-CALC-016`, `A4-AX-013`. 이 회차 **선정 5개 최종 인수 0/5, 제품 전체 인수 0건**.
