# FirmEngine A4 — 74차: 직원 Word 재사용 시 계산 캐시 변경 위험과 read-only Draft

- 확인 시점: 2026-11-02 KST, 최신 `main` SHA `111872749afa8234233552c6e4b9d1982da28a4d`. 작업 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 중앙 보드 blob `eec17e77396dd4b4dca59f0dae0058435ec6e14f` 사전 확인.
- 이어받음: [73차 영수증](20261102-round73-1346KST-staff-already-linked-r2-reproof-pr174.md); Draft [#174](https://github.com/firmengine/firmengine/pull/174) `d4f4cc314f6175a40bd18a4124e17191cae9543a` 미병합. 64~73차의 과거 영수증/완료 재생·직원 인계 경합 관련 미완료 상태 유지.
- 읽은 실제 소스: main `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/automatic-draft-handoff.ts` blob `a525e3c12672966c993f83021d5f169b170bebe9`, PR #174 위 코드 및 tests, 중앙 보드, 73차 영수증, 최근 GitHub main/PR 목록. `caseExtras -> readDerivedEvaluation -> resetAndRetryDerivedEvaluation/finishDerivedEvaluation` 원본 함수와 SQL 조회/INSERT/UPDATE 확인.
- 역할 순환: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**. 직접 선정 **5 ID**: `A4-IT-005`, `A4-CALC-016`, `A4-DATA-013`, `A4-AX-013`, `X-046`. 서류 `A4-DOC-011`과 변호사 `A4-LAW-013`은 인계 연계 간접검토. 전 항목 **[ ] 미완료**.

## 문제와 독립 기대

Draft #174가 이전 `already_linked` 조기 성공을 제거하고 D1 artifact·R2 bytes·Writer receipt를 검사하도록 개선하지만, 중간의 `caseExtras(data)`는 *읽기 전용 함수가 아니다*. `readDerivedEvaluation`은 누락된 계산 캐시에 `INSERT analyses ... pending`, 이전 기준 SHA/손상된 저장값에 `UPDATE analyses ... pending`, 이미 pending인 경우 `finishDerivedEvaluation` 호출을 할 수 있다. 계산 및 R2 PUT은 10분 quiet 가드와 결과 크기 등에 의존한다. **따라서 단순한 Word 재조회가 계산 DB 변경을 유발할 수 있는 소스 경로를 확인했다.**

독립 기대: 재사용 요청은 현재 SQL/R2 증거가 정상이어도 *계산 캐시 신규 생성·수정·재계산을 발생시키지 않아야* 한다. 누락/null, pending, 출처/기준/해시 상충은 **재사용 보류**로 보고 정상 완료로 승격하지 않는다. 503/timeout은 미관찰이며 R2 실제 미존재와 다르다.

## 실행 증빙 — 합성 SQL, 실제 운영 결과 아님

로컬 Node `v22.16.0` / `node:sqlite` WAL 2 DB 연결, 무해한 합성 사건 `synthetic-case` revision=3 / sourceSha=64자 테스트 상수, 현재·구 reference SHA를 사용. main `server-store.ts`의 조회/INSERT/RESET SQL을 독립 시험에 전사하여 현재 분기와 read-only 후보의 반환/DB 행을 관찰.

| 입력 | 기존 코드 경로의 독립 모사 관찰 | 제안한 read-only 계약의 독립 모사 관찰 |
|---|---|---|
| 캐시 행 없음 | pending INSERT 1건 | MISSING / DML 0 |
| 구 reference SHA | pending RESET UPDATE | STALE_UNVERIFIED / DML 0 |
| pending 행 | `finishDerivedEvaluation` 호출 조건 진입 | PENDING / DML 0 |
| 해시 이상 | pending RESET | STALE_UNVERIFIED / DML 0 |
| 유효 complete | 변화 없는 complete | 변화 없는 complete |
| 두 WAL 연결·누락 행 | 기존 INSERT 1 / 읽기전용 0 | DML 0 |
| 구 기준 상태 재요청 3회 | 기존 RESET 경로 있음 | 3회 DML 0 |
| 재생성 후 `exportManifest` 추가(합성) | 원본 JSON-stringify 입력 SHA가 달라짐 | 실제 제품의 재생 가능성 **추가검증 필요** |

로컬 신규 **8/8 기대 관찰 일치**, 이전 r69~r72 합성 재실행 포함 **56/56 pass, 0 fail, 0 skipped**. 부정대조를 포함하므로 제품 안전성 56건 합격이 아님. 독립 소스전사 시험 파일 SHA-256 `56af2db4fe4cc0f9b2fcb3ba702c5a45ad80049c74865c334983c49ac4aab302`, 로컬 경로 `/mnt/data/firmengine-a4/r74/derived_eval_replay_readonly.test.mjs`, 출력 `/mnt/data/firmengine-a4/r74/regression-results.txt`. **이것은 애플리케이션 모듈을 실제 import한 테스트가 아니다.**

## 수정 후보 및 남은 고위험 사항

[**Stacked Draft PR #176**](https://github.com/firmengine/firmengine/pull/176), head `d17f8eb303c41555fc3b399b3c25a848c7d0aefc`; **Draft #174의 브랜치를 base로 사용**, main 실행 코드는 변경하지 않음. 3파일만 수정·생성: `lib/server-store.ts`(readOnly opt-in, missing/reset/pending 분기 무변경), `lib/automatic-draft-handoff.ts`(alreadyLinked만 readOnly), `tests/automatic-draft-linked-replay-no-evaluation-mutation.test.mjs`(소스 정적 계약+WAL 합성). main 병합 없음, 공식 테스트 PASS 아님.

**추가 위험/병합 보류:** `readDerivedEvaluation` 입력 SHA는 `JSON.stringify(data)`에 의존한다. Manifest가 새로 연결된 뒤 CaseData가 달라지면 이전 계산 캐시와 SHA가 상충하여 이번 보수 후보가 유효한 기존 링크까지 409로 보류할 가능성이 있다. 합성 객체에서 해시 변화만 관찰했으며 실제 `getCase/saveCase` 연쇄는 미실행. 안정적인 원천 identity/receipt를 통한 read-only 검증 설계 및 실제 저장소 E2E가 선행되어야 한다. PR #164/#167/#170의 원본·기준 승인세대 CAS/원자 감사와 #17/#24/#161 중복 receipt/ACK 복구 통합도 미완료.

- **staging D1/R2/Cron: 미실행. 실제 HTTP 두 워커·API/webhook·실 Word 생성/재생성·직원/변호사 검수·실 보정 이벤트: 미실행.** 전체 TypeScript/Next/CI: 미실행. 신규 GitHub 저장소 테스트 파일: 작성·커밋했지만 저장소 내부에서 실행하지 않음.
- **상담 → 서류 → OCR → 10분 quiet calculation → 95법률 → Word → 직원·변호사 승인 → 실제 보정** 전체 stage 인계는 미실행. 이번 범위는 Word 이미 연결된 재조회와 계산 캐시 부작용. n8n 설계의 존재는 운영 n8n 워크플로 실행의 증거가 아님(이 회차 n8n 실행 미실행).
- 상태 구분: `0`은 격리 시험 DB의 DML 0, 운영 사건 수 0이 아님; `null/행 없음`은 캐시 증거 누락; `미관찰`은 실 D1/R2/HTTP 응답 미검증; `상충`은 이전 SHA/판본; `source-only`는 Draft 후보; `승인전`은 사람 검수 없음; `비해당`은 법원 인가 및 전자제출 판단.
- 추가 수정 또는 merge 전에 해당 PR의 source/test 최신 blob SHA 및 `main` HEAD를 재조회해야 한다. 다른 에이전트 PR 미변경. 현재 공개 Git 변경에 실제 고객 사실값·OCR·키·.env 없음.

## 다음 회차

우선 `A4-IT-005`, `A4-CALC-016`, `A4-DATA-013`, `A4-AX-013`, `X-047`: (1) manifest 추가 직후 평가 캐시 identity/hash가 변하는지를 실제 synthetic `getCase/saveCase`로 실행, (2) 안전한 영수증 read-only 조회 설계 및 PR #176/#174 회귀, (3) R2 PUT 성공→D1 ACK 유실 / timeout·429·503 / 중복 webhook / 두 워커 경쟁 재현. 서류·변호사 실무자 검수 전 승인 승격 금지.

**74차 직접 선정 최종 인수 0/5, 제품 전체 최종 인수 0건.** 운영 배포·운영 D1 migration·실제 제출·법원 인가는 전혀 실행하지 않음.
