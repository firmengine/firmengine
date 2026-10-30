# A4 13차 — 교차 사건 R2 objectKey 재사용이 정상 증빙으로 오인되는 진단 오류

- 날짜: 2026-10-31 KST. 최초 읽은 최신 main: `3863b63be9842ee18ac9f539f080889f423ccb21`. 코드 전 blob: `f4a1f350c63e58afea09af8932e071ba654fb279`; 수정 코드 commit: `4ba2e86336ba1ea79ae1988a7aa39b84bd9bcc24` / blob: `9ee61e80123d2c267c65d497bc77baf8b9656e5b`. 신규 테스트 commit: `a550130b98dc76e660336dcd4ae992fa1ea2f86e`, blob: `c2b9a0e0a06e16196cf838484deba1411343e03f`.
- 담당 관점 순환: IT → AX → 서류 → 데이터 중심. 계산사무장/변호사 관점의 판본·독립 승인 인계도 점검 대기이며 실제 계산/Word/사람 승인은 미실행.
- 이번 선정 체크: **A4-IT-004**, **A4-DOC-015**, **A4-DATA-020**, **A4-AX-003**, 교차 **X-047**. 전부 [ ] 유지, 제품 완료 0건.
- 읽은 실제 자료: 최신 main/12개 최근 commit/열린 PR, 단일 인수 보드의 위 5개 ID, `db/schema.ts`의 artifacts/events, 현재 `app/api/cases/[id]/export/route.ts`, `lib/export-artifact-transaction.ts`, `lib/server-store.ts`, `lib/export-reconciliation.ts`, 기존 reconciliation test 16/7개와 12차 감사 영수증. Draft PR #24/#31/#35/#40/#45의 변경 파일 목록 및 주요 헬퍼 원문을 읽음.
- 범위: 읽기전용 진단 코드. `artifacts.id`는 PK지만 `artifacts.object_key`에는 DB 전역 UNIQUE가 보이지 않으므로 서로 다른 사건의 행이 동일 객체 키를 참조하는 불일치 가능성은 **합성 입력으로** 검사. 실제 운영 DB에서 발생했다는 증거는 없음.

## 입력/독립 오라클/관찰

합성 사건 `synthetic-one`의 현재 B: revision=4, SQL/manifest/R2 objectKey=`cases/synthetic-one/artifacts/B`, SHA256=`a` 64자, R2 바이트 digest 일치. 타 사건 `synthetic-two`의 artifact ID X가 B와 같은 R2 objectKey를 참조하는 추가 SQL 증빙을 주입했다.

**독립 기대:** current B에 타 사건의 다른 artifact ID가 같은 R2 객체를 가리키는 경우, 인증 경계를 가로지르는 소유권 충돌이므로 `currentArtifactsVerified=false`; 다른 사건의 artifact ID/사건 ID는 결과에 노출하지 말고 삭제 권한은 항상 false. 과거 A만 충돌한다면 A 조사 경고를 남기되 정상 B를 무조건 stale 처리하지 말 것.

**수정 전 부정대조 실행:** 실제 main 코드 blob `f4a1f350c63e58afea09af8932e071ba654fb279`의 함수 본문을 V8에서 **타입 선언만 기계적으로 제거**해 실행. 주입 후 `issues=[]`, `currentArtifactsVerified=true`가 관찰됨 — 요구 오라클과 반대인 거짓 정상 판정. 이는 운영 D1/Worker 테스트가 아님.

**수정 내용:** 타 사건 SQL 행의 `objectKey`가 요청 사건의 `cases/{caseId}/artifacts/` 접두사에 속하면 `FOREIGN_CASE_OBJECT_KEY_ALIAS`를 단일 비식별 경고로 기록. 해당 objectKey가 현재 manifest의 객체 키라면 `currentArtifactsVerified=false`. 과거 키만 해당하면 조사 경고만 남기고 현재 B 판본 검증은 독립 보존. `autoDeleteAllowed=false` 불변.

| 실행 합성 입력 | 독립 기대 | 수정 후 관찰 |
|---|---|---|
| B 단독 SQL+R2 SHA 일치 | B verified=true / 경고없음 | 일치 |
| 타 사건 X → 현재 B 객체키, 뒤에 수집 | B verified=false / 비식별 경고 | 일치 |
| 타 사건 X → 현재 B 객체키, 앞에 수집 | 수집 순서 무관 차단 | 일치 |
| 무관한 타 사건 X → 타 사건 객체키 | 현재 B 정상 / 타 사건 비노출 | 일치 |
| 과거 A 키만 타 사건 X가 참조 | A 경고, B verified=true | 일치 |
| 타 사건 X·Y가 같은 현재 B 객체키 참조 | 경고 중복 없이 B 차단 | 일치 |
| 타 사건 X가 비현재 키 Z 참조 | 경고, B current는 독립 판정 | 일치 |
| B R2 조회 미실행 | verified=false / 확인불가 경고 | 일치 |
| 현재 B와 동일 artifact ID revision 상충 | verified=false / 상충 경고 | 일치 |

**실제 실행 범위:** 수정 직전 원본 함수의 부정대조를 V8 실행하여 거짓정상 1건 관찰. 수정 전후, 그리고 Github에 커밋된 blob을 다시 fetch하여 JS 함수 본문을 타입 제거 후 V8에서 **9/9 오라클 일치**를 재검사. 별도로 신규 `tests/export-reconciliation-r13.test.ts`의 `node:test` 7개를 저장소에 기록했으나 **Node 실행은 하지 않음**. 기존 32개 테스트도 이번 회차 재실행하지 않음. TypeScript 프로젝트 검사/전체 CI/staging D1·R2·Cron/실제 HTTP 두 워커는 모두 **미실행**. 이 실행 범위 차이를 혼동 금지.

## 5개 Export PR 겹침과 통합 게이트

실제 GitHub 열린 PR의 파일 목록·변경부 기준:
- #24: `export/route.ts` + `export-artifact-transaction.ts` — manifest 응답유실 때 SQL/R2 보존.
- #31: **같은 `export/route.ts`** + UI + domain + replay helper — 동일 현재 manifest requestId 재사용; A→B→늦은 A는 불충분.
- #35: **같은 `export/route.ts`** + **`server-store.ts`** + 감사 이벤트 배치 — manifest CAS와 이벤트 원자화.
- #40: **같은 `export/route.ts`**, **`server-store.ts`** + sourceVersion CAS guard — OCR 원본 변경을 UPDATE 조건에 반영.
- #45: `db/schema.ts` + `drizzle/0023_*.sql` + journal + 영속 receipt helper. **실제 Export HTTP route 연결 없음.**

따라서 #24/#31/#35/#40의 수동 병합이 필요하고 #45의 claim(원본/사건 식별)→R2/SQL write→동일 D1 batch CAS+감사 2개+receipt commit→불확실 ACK 조회/복구를 추가해야 함. 지금은 위 **5개 Draft PR 모두 미병합**이었음(이번 읽기 시점). 부분 병합을 운영 완료·법률 승인으로 승격 금지.

## 미인증 및 다음 회차 ID

- 본 결함은 SQL/D1에서 실제 cross-case alias가 발생했다고 단정하는 것이 아니라, **여러 관찰 원천이 주는 데이터를 모은 읽기전용 증빙 진단기가 거짓 정상으로 판단하던** 합성 반례. 실제 `export/route.ts`는 진단 helper를 호출하지 않음.
- 사람이 허가한 원본/계산/법률판본·Word 바이트·직원 선행검수/변호사 후행검수·실제 법원 보정명령/기한을 자동 확정하지 않음. null/없음/0/source-only/상충/승인전을 분리. 실제 개인정보/OCR/비공개 정답/키 사용 안 함.
- 운영 배포·D1 운영 migration·R2 삭제·실제 전자제출은 전혀 하지 않음.
- **다음 우선:** `A4-IT-003` + `A4-DATA-003` + `A4-AX-003` + `X-046`에서 5 PR의 단일 통합 브랜치/PR과 D1 두 워커 원자 CAS를 검증; `A4-DOC-012`/`A4-CALC-016`/`A4-LAW-013`에서 Word/계산/사람 승인을 별도 증거로 확인. 실제 staging 없다면 항상 '미실행'.

**제품 최종 인수 완료 0건, 현재 보드의 5개 체크 ID는 모두 부분 검증 [ ] 상태.**
