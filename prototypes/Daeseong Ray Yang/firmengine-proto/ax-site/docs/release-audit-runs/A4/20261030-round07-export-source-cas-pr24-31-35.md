# FirmEngine A4 7차 — Export 원천 버전 CAS 및 PR #24·#31·#35 결합 위험

- 2026-10-30 KST, 감사 시작 main SHA `aa17d40b653b282a9afb563d6059c1f6c508881e`; 작업 브랜치 생성 직전 main SHA `d35174d2cc908990bf08ee22ef3d7c2a4a564f4e`. 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 직전 [A4 6차](20261030-round06-export-audit-atomicity.md)의 후속이다. 기존 [Draft PR #24](https://github.com/firmengine/firmengine/pull/24)(D1 ACK 불확실 시 R2 보존), [#31](https://github.com/firmengine/firmengine/pull/31)(수동 Export requestId 재사용), [#35](https://github.com/firmengine/firmengine/pull/35)(manifest+2개 감사 이벤트 동일 D1 배치)는 **모두 현재 미병합**. 세 PR의 동일 route 수정과 #35의 `server-store.ts` 수정을 실제 diff로 비교했다.
- 역할 순환: **IT담당자 → AX담당자 → 데이터담당자**. 부분검증 ID: `A4-IT-003`, `A4-IT-012`, `A4-AX-003`, `A4-DATA-003`; 교차 `X-046`. **모두 [ ] 유지, 제품 인수 완료 0건**.

## 1. P0 — OCR 원문 데이터 변경이 최종 Export의 case-only CAS를 통과하는 경합

### 최신 main 실제 근거

- `app/api/cases/[id]/export/route.ts` blob `4f9384e840517455cdec25f0fa734b593d31e533`: PDF/Word 작성 이후 `getCase` 및 `snapshotSha256(current/data)` 비교는 사건 JSON/현재 사건 상태를 보지만, `case_data_change_state.data_version`의 원자적 비교가 없다.
- `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`: `saveCase`의 기본 UPDATE CAS는 `cases.revision`과 `cases.storage_token`을 비교하며, 자동초안용 `expectedHeads` 외에는 수동 Export의 SQL 원천 버전을 검사하지 않는다.
- `drizzle/0010_case_data_watch.sql`: OCR/문서/추출값 변경은 `case_data_change_state.data_version`을 증가시킨다. `0021_workflow_only_source_watch.sql`에서는 검토·산출물 전용 변경을 원본 변경과 분리하므로, **사건 revision이 동일해도 실제 원천 버전은 달라질 수 있다**.
- 실패 순서: 사용자가 `data_version=4` 자료로 문서를 준비 → 다른 OCR 직원이 원문 자료를 수정하여 `data_version=5` → 기존 `revision=7/storage_token=old`가 그대로면 구판본 Export가 SQL에 현재 manifest로 기록될 수 있다.

### 실제 재현과 수정

- Node `v22.16.0` / 내장 SQLite 합성 사건 `synthetic-case`에서 현재 sourceVersion 4를 먼저 읽고 5로 변경했을 때 **기존 revision/token만의 UPDATE는 1행 성공**했다. 이는 정상 합격이 아니라 **결함 재현 성공**.
- 수정 [Draft PR #40](https://github.com/firmengine/firmengine/pull/40): `lib/export-source-version-guard.ts`의 D1 `EXISTS (SELECT 1 FROM case_data_change_state WHERE case_id=? AND data_version=?)`를 **같은 `UPDATE cases` 문장에** 결합, `saveCase` artifact-only 옵션 `expectedSourceDataVersion` 추가, HTTP Export 생성 시작 시 읽은 그 값을 manifest CAS로 전달. 행 미존재/잘못된 버전은 명시적으로 차단. SQL migration·법률 산식·기준정보 변경 없음.
- 브랜치 `audit/a4-r07-export-source-cas-20261030`, PR HEAD `fd1e1df9f8252af01dd58e5c8e8e7e94188a52e2`. main에는 미병합이므로 **아직 운영 방어가 아니다**.

### 직접 실행한 독립 합성 SQLite 7건

| 조건 | 독립 기대 | 실제 관찰 |
| --- | --- | --- |
| 동일 source 4 + 동일 case 토큰 | manifest 1회 승인, 재시도 CAS 0행 | 일치 |
| OCR source 4→5, case revision 동일 | 이전 버전 manifest **0행** | 일치 |
| source 5를 명시한 새 요청 | manifest **1행** | 일치 |
| source 버전 행 누락 | 안전하게 **0행** | 일치 |
| 다른 사건의 버전은 유지, 내 사건은 변경 | 내 사건 **0행** | 일치 |
| 음수·소수·NaN·과대 버전/빈 사건 ID | 입력 오류 | 일치 |
| **기존 case-only CAS 부정대조** | OCR 변경 후 **잘못 1행 성공 재현** | 일치(결함) |

- `node --experimental-strip-types --test tests/export-source-version-guard.test.ts` 로컬 **7/7 실행·관찰**; 새 helper 단독 `tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext` 진단 0.
- 실제 실행한 파일과 PR #40 Git blob 동등: helper `3dd78df3a01e5bb32c9d69244acc1433b4b47e40`; test `d9f285b03eecf46b17643bdd48c903e93eef39c3`. 테스트는 합성 SQLite SQL 계약이며 실제 Next.js route/D1/R2 실행이 아니다.

## 2. 기존 미병합 3 PR의 결합 격리 검증

PR #24 `lib/export-artifact-transaction.ts` blob `10dc79b9ec9dcf29ff74901af6a621a17d880573`, PR #31 `lib/export-request-replay.ts` blob `4268b1d13061f4a1d17e0051984d559e8e3ecb96`, PR #35 `lib/case-audit-event-batch.ts` blob `7363feaeff8d7aba3fc182f8da5531423e78f7fe`와 PR #40 CAS helper를 **Git blob과 동일한 복사본**으로 로컬 Node test에 import했다. 실제 API/Next/R2 대신 SQLite+메모리 object map으로 트랜잭션·응답 유실·재시도 제어흐름을 합성했다. **6/6 실행**, 모두 명시된 독립 기대를 관찰했다.

| 합성 사례 | 관찰 / 법적·운영 판단 |
| --- | --- |
| 정상 Export | manifest 1개, SQL artifact 1행, R2 object 1개, 감사 event 2행 |
| D1 COMMIT 뒤 HTTP ACK 유실 + 동일 requestId 재전달 | PR #24가 R2/SQL 삭제하지 않고 PR #31이 기존 artifact 재사용, event 2행 유지 |
| 감사 이벤트 INSERT 유니크 실패 | PR #35 동일 DB 트랜잭션 manifest rollback, PR #24는 재조정 전 R2/SQL 보존 |
| OCR source 변경 중 manifest 저장 | PR #40 CAS 0행으로 차단, 감사 0건, R2/SQL은 미확정 orphan 상태로 남음 |
| **요청 A 성공 → 정상 새 요청 B 성공 → 지연된 A 재전달** | PR #31의 현재 manifest에는 B만 남아 A 조회가 `new` 반환 → **세 번째 artifact 생성 가능(P1 미해결)** |
| 두 요청이 동일 구토큰을 보고 동시에 진행 | 한 건만 manifest+event 2행 확정, 다른 요청은 충돌; **R2/SQL orphan 1건 남음(P1 미해결)** |

**중요:** 6/6 통과는 정상적인 시스템 완결성을 뜻하지 않는다. 앞의 네 개는 기대하는 복구 또는 차단 동작이고 마지막 두 개는 결함·누락을 **정확히 재현한 것**이다. 실제 Cloudflare D1 두 워커/Word 파일/HTTP 경쟁 수행이나 3개 PR 병합본 CI가 아니므로 제품 합격 처리 금지.

## 3. 미해결 결함과 안전한 병합 선행조건

1. **P1 — 영속 Export 요청 원장 없음:** PR #31은 `exportRequestId`를 현재 manifest 1건에만 저장한다. A→B 재생성 이후 늦게 도착한 A가 새로운 요청처럼 평가되어 중복 생성할 수 있다. **사건 ID+requestId**의 D1 unique receipt/상태(CLAIMED·COMMITTED·UNCERTAIN·SUPERSEDED)와 현재 manifest가 교체된 뒤에도 응답할 수 있는 불변 작업 영수증 필요. 예전 승인을 재활성화하거나 오래된 생성물을 최종본으로 사용해서는 안 된다.
2. **P1 — 충돌 작업의 orphan SQL/R2 정리 미구현:** PR #24는 ACK가 불확실하면 영구 보존하는 보수적 설계로 원본 손상 위험을 줄인다. 반면 실제 409와 두 HTTP 경합에서도 임시 artifact가 남는다. 다른 사건/현재 manifest를 삭제하지 않는 **참조해시·요청원장 기반 reconciliation queue/TTL·수동 승인 복구**가 필요하다. 응답 유실만으로 delete를 실행하면 P0 원본 파괴가 재발한다.
3. **병합 충돌 선결:** PR #24·#31·#35·#40은 모두 `export/route.ts`를 바꾼다. #35·#40은 `server-store.ts`도 바꾼다. 통합 시 `exportRequestId`·`sourceDataVersionAtExport`·`expectedSourceDataVersion`·`auditEvents`·`onCommitUncertain`을 각각 유지해야 한다. **문서 준비 시 읽은 원천 버전이 최종 D1 CAS까지 동일**해야 하며, 두 감사 이벤트는 별도 사후 INSERT가 아니라 같은 batch여야 한다.
4. 공식 서식에 반영된 법적 인정·검토된 채권·변제금의 판본 변경은 최종본을 재검토해야 한다. 이번 감사는 산식·법률 요건을 변경하지 않았다.

## 4. 역할별 결론 / 다음 시작점

- `A4-IT-012`: case-only CAS의 stale 원천 통과 **격리 재현**, Draft PR #40 수정 SQL 계약 7/7. 현재 main/실 D1 미반영·미인증.
- `A4-IT-003` 및 `X-046`: 두 요청의 경합을 SQLite+object map으로 재현해 하나만 승격, 다른 하나는 orphan. **실제 2워커/Cron staging 미인증**.
- `A4-AX-003`: requestId A→B→A 지연 재전달은 PR #31에서 new로 판정되는 gap **격리 재현**. 지속 영수증 및 브라우저 재시작 E2E 미완.
- `A4-DATA-003`: PR #35의 동일 manifest/감사 2건 원자성은 격리 검증. 실제 DB·HTTP 중복 알림/outbox/유니크 처리 미인증.
- **이번 회차 제품 인수 완료 0건**, 모든 체크박스 `[ ]` 유지. 원본 PDF·개인정보·실제 고객 자료·비밀키는 일절 사용하지 않았다.
- **미실행:** 전체 `npm ci`/Node 테스트·lint/Next 빌드, staging D1/R2/Cron 실장애, Word/PDF 생성/실제 법원 서식, 변호사 독립 승인, 운영배포·법원 제출.
- **다음 A4:** durable export request receipt/동시 POST 분쟁/기존 생성본 재전달의 안전 상태계약, orphan 재조정 설계 및 로컬 D1 SQL 회귀. 고위험 스키마 변경은 별도 PR·실무자 검토; 운영 DB migration 금지.

**결론:** 새 P0 원천 버전 경합 1건 재현/차단 Draft PR #40, 기존 3개 PR의 결합 격리 실행 6건, P1 영속요청·orphan 공백 2건을 확인했다. 실제 통합/출시 합격은 여전히 0건.
