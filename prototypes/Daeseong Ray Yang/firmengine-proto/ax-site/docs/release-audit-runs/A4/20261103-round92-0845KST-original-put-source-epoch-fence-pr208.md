# FirmEngine A4 92차 — 원본 PUT의 원천 스냅샷·최종 D1 CAS 결속 후보

작성일: 2026-11-03 08:45 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만. 이 문서는 공개 가능한 **전부 합성 데이터**와 코드 확인 결과만 기록하며 실제 고객 문서·OCR 추출 사실값·개인정보·비밀키·법적 인정값은 포함하지 않는다.

## 1. 읽은 main / 이력 / 기존 증빙

- 최초 재조회 `main` SHA `80ea2c7e1d04a5be5cae5368bcfc110f66fd779b`. 최근 A3 r92/A2 r92/A1 r91/A4 r91 커밋을 확인했다. 현 인수 보드 blob `6aafd0df94575585d8d8c7f1487ad2c07186cdaf`에서 A4 관련 5 ID를 확인했다.
- main 원본 PUT `app/api/cases/[id]/documents/[doc]/route.ts` blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`; 케이스 저장/스냅샷 `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`; 명령 철회 `lib/case-command-store.ts` blob `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`; domain `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` 조회.
- 전 회차 [A4 r91 철회 PUT 경합 영수증](20261103-round91-0741KST-original-put-after-withdrawal-cas.md), r91 [원문 SQL 합성 테스트](20261103-round91-0741KST-original-put-withdrawn-document-race.test.mjs), 이전 r90 POST CAS 패자 고아/이전 r89 감사 이벤트 재시도 불완전, Draft PR #23(원본 D1 ACK 소실), #201(POST ACK 이후 OCR 보존), #208(이번 수정 후보)을 확인했다. 세 PR 모두 Draft/미병합이며 main 반영이 아니다.

## 2. 결함 및 검증 전략 — 91차 반례를 실제 저장 판본에 맞게 보완

**main의 현재 원문 최종 SQL**
```sql
UPDATE documents SET original_key = ?,ready = 1
WHERE id = ? AND case_id = ? AND ready = 0 AND sha256 = ?;
```
`record()`는 시작 시 `getCase()`에서 active 문서를 확인하지만 R2 스트리밍 이후 최종 D1 SQL은 사건 revision, storage_token을 확인하지 않는다. 워커 A가 active를 읽음 → 워커 B `document.retract` COMMIT(사건 revision/token 변화, 작업행 withdrawn) → A가 최종 원본 PUT UPDATE를 실행하면 main SQL은 1건 변경한다. 독립 기대는 **최종 시점의 원천 판본이 바뀌었으면 채택 0건**이다.

`documents` 테이블 자체에는 active/withdrawn 컬럼이 없다. `page_jobs`는 자손 문서 철회 누락/행 누락이 가능하므로 status만으로 원천 승인 여부를 확정할 수 없다. `cases.payload`는 대형 사건에서 `r2-case-v1` 포인터일 수 있어 `json_each(payload,'$.documents')` 기반 active 가드도 완전하지 않다.

**비운영 Draft PR #208 후보**는 `getCase()`가 이미 검증한 객체별 `caseSnapshots`에서 revision/token을 가져와, 최종 원본 PUT의 `UPDATE ... AND EXISTS (SELECT 1 FROM cases WHERE revision=? AND storage_token=?)`와 구판본 중복 업로드 재조회에 결속한다. source 변경뿐 아니라 review-only token 변경에도 보수적으로 재요청시키므로 재시도 UX/비용은 검토 필요. `ready=1`은 이후 철회돼도 역사적 저장 사실로 남을 수 있어 법적 유효성/재생성 승인의 대체 조건이 아니다. **PR은 실제 main 코드가 아니라 별도 고위험 Draft 제안이다.**

## 3. 실제 입력·독립 기대·실행 결과

Node.js **22.16.0**, `node:sqlite` 파일 기반 WAL의 **독립 연결 A/B 두 개**, `cases(id,revision,storage_token,payload)`, `documents(id,case_id,sha256,original_key,ready)`, `page_jobs` 최소 합성 스키마. 사건 `SYNTH-C`, 문서 `DOC-A`, hash `a×64`, 가상 R2 key를 사용. R2 바이트/실제 법원 원문은 사용하지 않았다.

| 시험 입력 | 독립 기대 | 실제 관찰 |
|---|---|---|
| 활성 상태, 기존 main UPDATE | ready 1 | 1행 저장 |
| 활성 상태, 후보 source-epoch UPDATE | ready 1 | 1행 저장 |
| A 스냅샷 R1/T1→B 철회 R2/T2→A **main** UPDATE | 최신 인정 **차단해야 함** | **1행 저장 (부정대조/결함)** |
| 같은 경합에서 후보 UPDATE | stale 차단 | 0행 |
| 무관한 source revision 변경 | 보수적 재시도 | 0행 |
| 동일 revision에서 review-only token만 변경 | 구판본 재시도 | 0행 |
| revision 단독가드 / token-only 변경 | 불충분 예시 | 1행 통과 |
| 두 독립 워커 동일 ready=0 claim | 승자 1/패자 0 | 1/0 |
| 원본 SHA 변경, 다른 문서 ID | stale/other 차단 | 각각 0행 |
| **PUT 후** 철회 | 과거 SQL pointer와 현재 승인 분리 | ready=1/작업 withdrawn (최신 승인 아님) |
| page_jobs 행 누락 | 후보 source CAS는 여전히 수행 가능, OCR 완전성 별도 | 1행 (별도 게이트 필요) |
| 대형 사건 `r2-case-v1` 포인터 | token guard는 JSON 문서열 필요 없음 | 1행 정상 |
| 포인터 case에 `json_each` 단독 가드 | 적용 불가 | 0행 (false block) |
| JSON-only 가드 + token 변경 | 안전하지 않음 | 1행 통과 |
| D1 COMMIT 후 ACK 유실 | R2 삭제 금지, 복구 영수증 필요 | main `finally` 삭제 위험 **코드 확인**, 실제 R2 호출 미실행 |

- 실행: `node --test /mnt/data/firmengine-a4/r92/20261103-r92-original-upload-source-snapshot-cas.test.mjs` **16/16 pass / 0 fail**, 총 263.849446ms. 이 중 **main 결함 부정대조**와 가정한 후속 삭제 조건을 포함하므로 제품 16건 합격이 아니다.
- 실행 코드 SHA-256 `dc6a4e57c504f84083fa1982f5fde482c61e520fb2bd5849c4fdb14aa7b1a2e6`, 출력 SHA-256 `91ea4e74017a479c8731e9c25b5a4fe61ae672f601ce8fe9e04b391ce5108ade`.
- Draft #208의 `tests/original-upload-source-epoch-r92.test.mjs`에는 8개 회귀를 추가했으나 **실제 GitHub checkout 대상으로 그 테스트 8건은 이번에 실행하지 않았다**. 실제 변경 TypeScript 전체/Next CI 미실행. 원문 SQL / 인수 보드 / DB 스키마는 GitHub 소스에서 별도 직접 확인.

## 4. 6역할 순환·체크 ID (완료 0/5)

이번 검토 관점은 **데이터 → AX → IT → 사용자·서류 → 계산사무장 → 변호사** (직전과 출발 역할 다름). 실제 사람 검수·결재·공식 서식 승인 0건.

- **A4-IT-012 [ ]**: main의 구 원천 시점 PUT 승격 1행, 비교 후보 CAS 0행. 동시에 #23 ACK 유실 복구 통합/HTTP 2워커 미검증.
- **A4-DOC-012 [ ]**: 문서 철회/갈음 철회·직원/변호사 재승인 의미는 source-epoch 차단만으로 증명 안 됨. 실제 독립 검수/Word 인계 미실행.
- **A4-CALC-014 [ ]**: 원본 교체·철회로 재계산 필요함은 source 상태를 구분할 뿐, 10분 quiet·18산식·청산가치/변제계획 재계산은 미실행.
- **A4-LAW-008 [ ]**: 보정명령 기한/증빙/관할판본, null/미확정/상충/비해당 구분과 법률 인정/변호사 승인은 미실행. SQL ready 또는 단위테스트로 법적 확정 금지.
- **X-047 [ ]**: R2 선저장→D1 실패/ACK 소실/429·503·timeout/동시 철회의 모든 복구 미검증. 후보 CAS는 철회 조건의 1개 조각만 개선.

## 5. 실패·복구 인수 / 다음 체크

- **실제 재현:** 별도 두 DB 커넥션으로 철회 후 메타데이터 ready 승격 반례 재확인(기존 main SQL), 동일 DB에서 revision+token CAS 대조 0행 확인. 실제 TypeScript/Cloudflare D1/R2/RPC를 호출한 재현 아님.
- **제안:** [Draft PR #208](https://github.com/firmengine/firmengine/pull/208) (허용 경로 3파일만) — `lib/server-store.ts` 스냅샷 identity, 원본 PUT SQL guard 및 readback fence, 테스트 추가. **merge 금지**: #23 동일 라우트 변경 충돌, #201 POST 원장/고아 잡 복구, ACK 유실 시 기존 `finally DELETE`, 동시 권한/보정 워크플로와 실무자 인수를 해결해야 함.
- **다음 검사:** `A4-IT-005`(ACK 재조회), `A4-IT-006`(R2/D1 부분성공), `A4-DATA-003`(멱등), `A4-AX-013`(Word 재검수/재생성), `X-047`(철회+응답유실 결합).
- **단계 상태:** `null`=값 없음, `0`=실제 UPDATE 변경 0행, `미관찰`=D1 결과 미확정, `비해당`=별도 판단, `상충`=원천/승인판본 차이, `source-only`=근거만 보존, `승인전`=사람 결재 전. 서로 등가로 취급하지 않았다.
- **n8n:** 설계 문서/보드 F20 수준과 운영 워크플로는 다름. 이 회차 운영 n8n 미접속·미실행.
- **미실행:** 전체 main npm ci/TS/lint/build/CI, 실제 PUT POST+R2 스트림, staging D1/R2/Cron, 실 HTTP 두 워커·중복웹훅/429·503·timeout 장애주입, 상담→서류→OCR→quiet 계산→95법률→Word→직원/변호사 검수→보정 이벤트 E2E, 실제 법원 양식/변호사 승인.
- **운영 실행 금지 준수:** 운영 배포·D1 운영 마이그레이션·법원 전자제출·법원 인가 확정 전부 0. **제품 인수 완료 0/5**.
