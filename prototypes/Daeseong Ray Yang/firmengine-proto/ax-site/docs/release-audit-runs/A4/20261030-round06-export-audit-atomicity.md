# FirmEngine A4 6차 — 수동 Export 감사 이벤트의 DB 원자 기록과 재시도 복구

- 일자: 2026-10-30 KST, 감사 시작 시 GitHub main `ebb46f00218c590fa67de6106f7063ca5528c369`.
- 적용 범위: 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 직전 A4 5차 [영수증](20261030-round05-export-request-idempotency.md), 수동 export 중복 방지 [Draft PR #31](https://github.com/firmengine/firmengine/pull/31). 최근 다른 축 PR #32/#33/#34 역시 미병합 상태로 확인.
- 이번 역할 순환: **서류담당자 → 계산사무장 → 변호사 → 데이터담당자**. 체크 ID: `A4-DOC-013`, `A4-CALC-014`, `A4-LAW-013`, `A4-DATA-014`, 교차 `X-041`. 합격 단계는 모두 **부분 검증·최종 [ ] 유지**.

## 원본·스키마·기존 이력

- 실제 main 소스: `app/api/cases/[id]/export/route.ts` blob `4f9384e840517455cdec25f0fa734b593d31e533`, `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/export-artifact-transaction.ts`, `lib/domain.ts`; `drizzle/0000_chunky_cardiac.sql`의 `cases`/`events`, `drizzle/0015_case_document_work_events.sql`, 전체 migration 0000~0022 및 현재 `drizzle/meta/_journal.json`을 확인했다.
- 기존 경로는 R2 object put → SQL `artifacts` rows → `saveCase(next,...,{mutationCategory:"artifact_only"})`를 통한 manifest CAS → `await event("document_writer.prepared")` → `await event("export.generated")` 순서였다. 두 이벤트가 별도 D1 INSERT이므로 **manifest가 저장된 후 감사 이벤트 실패**가 가능했다.
- 실제 main `saveCase`는 내부 `db().batch`에서 `cases.storage_token`/revision CAS 후 `analyses`와 명령 영수증 등 여러 행을 원자 처리한다. 같은 guard로 export 감사 이벤트를 묶는 방식이 D1 범위에서 직접적인 개선안이다.
- 원본 변경 시 `lib/domain.ts::touchCase`는 current export를 invalidated로 바꾸고 caseworker/lawyer review를 null로 돌리는 **정적 경로를 확인**. `currentExportReviews`는 최종본·현재 revision·manifest fingerprint·직원 선행 검수를 요구한다. 그러나 실제 Word 재생성/독립 변호사 승인/소득 재계산 E2E는 수행하지 않았다.

## 발견 결함과 구현안 (P1)

**재현된 기초 결함**: A4 4차 합성 POST 수행에서 manifest 확정 후 `events` INSERT 오류 → API 실패 → 동일 POST 재시도로 새로운 artifact/R2/SQL 행이 생겼다. A4 5차 [Draft PR #31](https://github.com/firmengine/firmengine/pull/31)은 동일 요청 UUID가 보존되는 경우 문서 중복생성을 제한하나, **원래 이벤트 INSERT의 누락 자체는 해결하지 못한다**.

새 [Draft PR #35](https://github.com/firmengine/firmengine/pull/35)는 4개 파일만 변경한다.

1. `lib/case-audit-event-batch.ts`: 유효한 두 운영 이벤트 종류만 허용하는 guard SQL/parameter helper.
2. `lib/server-store.ts`: `saveCase`의 `artifact_only` 옵션에 `auditEvents`를 추가하고 manifest UPDATE·CAS와 함께 같은 `db().batch`에 넣는다. 다른 사건 수정 명령이나 법원 승인 이벤트로 혼용 금지.
3. `app/api/cases/[id]/export/route.ts`: 생성물 저장과 같은 호출에 `document_writer.prepared`, `export.generated`를 전달하고 별도 postcommit event INSERT 두 건을 제거.
4. `tests/case-audit-event-batch.test.ts`: Node 내장 SQLite를 사용한 정상/경계/부정 6개 합성 시험 추가. SQL migration/금액/법률 기준 변경 없음.

### 실제 실행/독립 기대값

격리 로컬 실행: Node `v22.16.0`, TypeScript CLI `5.8.3` (PR의 두 새 파일과 정확히 동일 Git blob SHA).

```bash
cd <ax-site>
node --experimental-strip-types --test tests/case-audit-event-batch.test.ts
tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/case-audit-event-batch.ts
git hash-object lib/case-audit-event-batch.ts tests/case-audit-event-batch.test.ts
```

- Node **6/6 PASS**, 실패 0. 단독 helper TypeScript 진단 0.
- 실제 테스트 동일 blob SHA: helper `7363feaeff8d7aba3fc182f8da5531423e78f7fe`, test `a2f49d8b9628cf6677651196a9795b01ab5c2a1d`. 둘 모두 PR #35의 GitHub blob과 일치.
- 합성 case ID: `synthetic-export-case`; 원본 사건·실제 개인정보·실금액 사용 없음.

| 시나리오 | 독립 기대 결과 | 격리 SQLite 관찰 |
| --- | --- | --- |
| manifest CAS 성공 + 정상 감사 이벤트 | DB manifest와 2개 이벤트가 같은 COMMIT | PASS, 사건 token `after` 및 2개 이벤트 |
| stale storage_token CAS 실패 | manifest 0회 갱신, 이벤트 0건 | PASS |
| 이벤트 INSERT unique 위반 | 전체 트랜잭션 ROLLBACK, 이전 manifest 유지 | PASS |
| D1 COMMIT 완료 후 HTTP ACK 유실 | manifest·감사 이벤트 모두 그대로 보존 | PASS |
| 이미 완료된 요청의 stale CAS 재실행 | 이벤트 중복 기록 없음 | PASS |
| 승인되지 않은 법원 승인 타입/빈 detail | 명시적 오류 | PASS |

**정확한 인증 수준:** 위 표는 `GUARDED_CASE_AUDIT_EVENT_INSERT_SQL`을 그대로 사용해 Node/SQLite에서 실행한 격리 계약 시험이다. 전체 `saveCase`/Next HTTP Route·실제 Cloudflare D1 `db().batch`, R2 파일, Word 바이트, 법원 서식/변호사 승인, 2워커 동시 HTTP 호출을 **실행한 것이 아니다**. 새 PR은 미병합 제안이며 운영 적용되지 않았다.

## 역할별 판정/미해결

- `A4-DOC-013`: `touchCase`가 새 증빙 변경 시 내보낸 파일과 검수를 무효화하는 정적 코드 확인만. 서류담당자 실제 화면/재생성은 미실행.
- `A4-CALC-014`: 원본 변경 후 manifest 무효화 코드 확인만. 18개 계산 재실행·청산가치/변제계획 갱신 실제 E2E 미실행.
- `A4-LAW-013`: fingerprint+직원 선행 검수 가드 정적 확인. 실제 Word 최종 바이트 및 독립 변호사 서명 미인증. 별도 동일 actor 결함 [Draft PR #28](https://github.com/firmengine/firmengine/pull/28)과 함께 병합 전 회귀 필요.
- `A4-DATA-014`: 기존 event 사후기록 실패의 감사 공백을 두 이벤트의 동시 커밋으로 완화하는 합성 경계 6/6. **실패/보류/DLQ/Outbox 전체 조회·재처리 UI는 여전히 미구현·미인증**.
- `X-041`: 동일 requestId의 중복 생성 차단은 [PR #31](https://github.com/firmengine/firmengine/pull/31) 범위, 이번 [PR #35](https://github.com/firmengine/firmengine/pull/35)는 event 영속성. 실제 재생성/Word 승인 E2E 미실행.

## 병합·복구 주의 및 다음 A4

- **선행 충돌 검토**: PR #35와 #31, #24는 같은 export route를 변경한다. 최신 3-way diff로 리베이스·병합하고 `saveCase`의 `auditEvents`와 `exportRequestId`가 동시에 유지되는지 테스트하기 전 병합·배포 금지.
- **P0 잔여**: 현재 main의 export artifact transaction은 manifest COMMIT ACK가 불확실할 때 R2 삭제 위험이 있다. [Draft PR #24](https://github.com/firmengine/firmengine/pull/24)와의 결합 검증이 선결이다.
- **P1 잔여**: legacy 토큰 없는 POST, 브라우저 재시작, 2개 동시 POST에 대한 exactly-once, 외부 알림의 durable outbox/consumer, 실패 이벤트 DLQ/repair dashboard는 미완료다.
- 다음 우선 체크: `A4-DATA-003` 중복 POST/SQL 유니크 제약, `A4-IT-003` 2워커 lease, `A4-AX-017` 중복 모델 비용/실행 횟수, `X-046` 동시성. 서로 독립된 역할 관점과 실제 staging D1/R2/cron이 필요한 경우 미인증으로 구분한다.

**결론:** 코드 PR 1건, 합성 격리시험 6/6 PASS, 일부 정적 경로 확인. **제품 인수 완료 0건**; 기존 데이터/키/운영 DB/배포/법원 제출 변경 없음.
