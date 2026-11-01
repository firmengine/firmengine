# FirmEngine A4 제48차 — 계산 poll 완료 뒤 lease DELETE ACK·소유권 경합

- 관찰일: **2026-11-01 KST 12:44 전후**. 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 시작 main: `2dc18618cd68ccccd2ef40069d38a2432072df59` (A3 48차 docs); 작성 직전 main 재조회: `2dc18618cd68ccccd2ef40069d38a2432072df59`.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 시작 blob `64de1971cee136409d1eb0bd4250739e8ea2290c`. 47차 인계 영수증 `20261101-round47-1144KST-calculation-head-batch-ack-review.md` 확인. 최근 main 커밋(2026-11-01 03:34Z A3, 03:19Z A2, 02:53Z A1) 및 PR #16 / #110 / #114 / #120 검토.
- 확인한 원본 blob: `lib/case-data-recompute.ts` `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`, `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `drizzle/0017_legal_reanalysis_orchestration.sql` `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`, `tests/case-calculation-poll-fairness.test.ts` `105e769cb6dd82bd38f4222ef427c67e76077a37`, `tests/case-calculation-feature-store.test.ts` `844525d8633442d571ced2c48ed5bd00ba7bb5a0`.
- 6역할 순환: **데이터담당자 → AX담당자 → IT담당자 → 서류담당자 → 계산사무장 → 변호사** (47차 마지막 시작 역할과 다름).
- 직접 검증 ID: **A4-IT-003, A4-CALC-004, A4-DATA-004, X-046** (4건 **[ ]** 유지). 관련 인계 정적/미관찰: **A4-DOC-013, A4-LAW-001, A4-AX-006**, 모두 **[ ]**. 체크 전부 미완료.

## 1. 재현 — 계산 종료와 lease 정리 사이 다른 워커 재선점

현재 main `drainCaseDataUpdates()`는 `recomputeCaseDataUpdate()`가 반환된 후
`DELETE FROM case_calculation_poll_jobs WHERE case_id=? AND lease_token=?`를 실행하지만
**DELETE 결과의 `meta.changes`를 확인하지 않고** 무조건 `results.push(value)`합니다.
이 DELETE는 부작용 있는 D1 실행이므로 'computed'와 'lease 정리 확인'을 동의어로 취급하면 안 됩니다.

합성 사건: `case-synthetic`, case revision=4, source dataVersion=7, run `run-7`, ref `ref-A`; A가 `lease_token=worker-A`를 가진 running 작업으로 calc head v7을 저장. 그다음 별도 WAL 연결 B가 source version=8로 변경하고 poll lease를 `worker-B`로 변경. A의 뒤늦은 DELETE는 **changes=0**, B의 lease 보존, calc head v7 < source v8. **독립 기대:** A는 자신이 최신 작업 완료를 확정하지 말고 소유권 상실/superseded로 분리. **실제 SQL 관찰:** DELETE 0, B token 유지, v7/v8 분기. 실제 main의 `results.push(value)`는 삭제 ACK 검사 없이 실행되는 분기이므로 old computed 결과를 그대로 내보낼 수 있다는 소스·SQL 결합 반례. 본 검증은 실제 `drainCaseDataUpdates` 전체 함수/HTTP를 실행한 결과는 아님.

같은 sourceVersion의 다른 워커가 lease를 선점해도 A DELETE=0이었고, 타 사건 C의 lease는 불변이었음.

## 2. ACK별 독립 기대 / 실제 합성 관찰

| 입력(모두 합성) | 독립 기대 | PR #123 실제 GitHub 수정 블록 V8 관찰 |
| --- | --- | --- |
| DELETE ACK changes=1 | 기존 computed 결과 | computed |
| DELETE ACK changes=0 (B 선점) | 소유권 상실, B lease 보존 | superseded |
| changes=null / undefined | 미관찰, 재계산 자동시작 금지 | cleanup_unobserved |
| changes=2 / -1 / 문자열 '1' | 비정상 영수증; success 금지 | cleanup_unobserved |
| DELETE throw (503) | DB 적용/COMMIT 불확정, retry_wait 거짓 변경 금지 | cleanup_unobserved |

- **PR #123** 수정 실제 GitHub blob `e279fde743c657fc990888715e5bac07cbf53f1c`에서 cleanup 본문을 추출, TS 타입 표기만 제거한 AsyncFunction V8 **8/8 기대 일치**. `cleanup_unobserved`는 API 내 임시 비확정 상태이며 DB에 신규 status 저장하지 않음.
- 별도 **Node v22.16.0 `node --test` + SQLite WAL 두 연결 10/10 관찰 일치**: 정상 DELETE 1/0, B lease 교체, ACK 0/null/2/undefined 등 분류, COMMIT 후 응답유실 가정, 503 before DELETE, source v7→v8/head v7, 타 사건 격리. **부정대조 포함, 전체 제품 안전 PASS 10건 아님.**
- PR #123에 `tests/case-calculation-poll-cleanup-ack-r48.test.mjs` 신규 테스트(8 V8 source-extracted + 1 SQLite WAL) 작성. **저장소 프로젝트에서 Node-native 직접 실행 미실행**; 테스트가 GitHub에서 실제 실행된 것으로 표시하지 않음.

## 3. 수정의 경계 / 복구 미결

- [Draft PR #123](https://github.com/firmengine/firmengine/pull/123), 브랜치 `audit/a4-r48-calculation-cleanup-ack-20261101`, 변경 **2파일** (코드+테스트), 모두 허용된 ax-site 내부. **Open / Draft / 미병합**. main 실행 코드는 변경하지 않음.
- 수정 후보는 computation 자체의 예외와 lease cleanup ACK 불확정을 구분하여 cleanup 오류를 무조건 계산 실패·retry_wait로 기록하지 않음. `DELETE=0`은 '기존 계산 실패'가 아니라 **A 소유권 상실**. ACK null/503/응답 유실은 **미관찰**.
- 다만 COMMIT된 계산 head가 current이더라도 cleanup ACK 유실 후 DB의 poll이 `running`으로 남을 수 있다. `cleanup_unobserved`에 대한 **영속 조회·오래된 poll 안전 회수·RunId/lease 대조**가 아직 없음. 따라서 기능 완전복구 아님. 실제 staging D1의 ACK 유실/부분성공/429/503/timeout/두 HTTP 워커 시험과 실무자 검토 전 **병합 금지**.
- PR #16의 poll source/reference CAS, #120의 head batch ACK와 실행 의미가 연결되며, 동일 경로 회귀 및 정확한 판본·기준정보 세대 일치가 필요. PR #110/#114 법률 상태·감사 원자화 후보도 미병합. 기준정보 변경 뒤 구 run이 head를 덮는 쓰기 CAS 문제는 그대로 남음.

## 4. 단계·증거 레벨

- `case-data-recompute`·계산 head·legal worker·scheduler·SQL schema 및 기존 단위 테스트는 **source-only** 확인. 상담→서류→OCR→10분 quiet calculation→95법률→Word 초안→직원/변호사 검수→실제 보정 이벤트의 전 단계 CAS/승인 인계 **종단 미실행**. `case-agent-scheduler.ts`의 계산→법률 호출 순서는 소스 존재 수준이며 통합 정상 실행으로 간주 금지.
- 운영 n8n 워크플로와 설계 워크플로 비교 **미관찰**. **staging D1/R2/Cron, 전체 TypeScript/Next/CI, HTTP 두 실제 워커, R2 성공 후 D1 실패·응답 유실, 중복 웹훅, 원문 변경/갈음 철회/관할판본 변경, 보정기한 미확정, Word 실바이트·사람 승인 전부 미실행**.
- `0`=DELETE 소유권 CAS 0행, `null`/ACK 누락/2=미관찰 또는 비정상, `not_applicable`=해당 없음(이번 시험 인증 안 함), `conflict`=source/head 세대 상충, `source-only`=코드 확인, `승인전`=실무자 검수 미완료로 분리. 실제 고객/개인정보/비공개 법률값/원본 OCR/키 등 사용하지 않음.

## 5. 다음 체크

1. **A4-IT-003/X-046** 두 실제 staging D1 HTTP 워커에서 v7→v8 lease 전환, ref 세대 변경, cleanup=0 / 응답유실 시 lease 보존 확인.
2. **A4-CALC-004/A4-DATA-004** head/RunId/reference SHA 영속 재조회 + `cleanup_unobserved` 복구 원장/무한 running 감시; #16/#120/#123 통합 회귀·CI.
3. **A4-DOC-013/A4-LAW-001/A4-AX-006** 새 증빙/기준 판본 → 재계산 → 95법률 → Word 재생성 → 직원·변호사 과거 승인 무효화; X-047 R2/D1 및 X-048 모델장애/보정기한 연계.

**신규 최종 인수 0건 / 전체 인수 0건.** 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 수행하지 않음.
