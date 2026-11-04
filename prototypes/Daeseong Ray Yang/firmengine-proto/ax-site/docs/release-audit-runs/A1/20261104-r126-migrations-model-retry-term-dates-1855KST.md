# FirmEngine A1 — 126차 코드 완결성·상호 기능충돌 감사 영수증

- **일자:** 2026-11-04 KST (18:55 회차). **범위:** `firmengine/firmengine`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부에 한정. 공개 Git에 민감 데이터 미사용.
- **감사 시작 및 영수증 작성 직전 확인한 main:** `5f7b2e2e1b7c221423862f76d8631dd0cd96350c`. GitHub main 최근 커밋: A3 r126(`5f7b2e2e`, `3280d85d`), A2 r126(`58b9fac4`, `8cfbde51`), A1 r125(`1ae446dc`, `ae8cb39a`). 현재 열린 Draft #37, #42, #238, #239 등 조회. 기존 A1 r125 및 r74/r84/r88 영수증, 인수 보드/스키마/SQL/실제 함수/테스트 소스를 읽음.
- **역할 순환:** IT담당자 → AX담당자 → 계산사무장. 이번 선택 ID **A1-IT-012 / A1-AX-012 / A1-CALC-012**, 전부 **[ ] 미완료**. **테스트 계층:** Drizzle SQL 원문 정적 검사 및 TypeScript 원본문을 타입 제거해 V8에서 합성 DB/모델/금액 helper와 연결한 격리 실행. 전체 Node/TS/SQLite/D1/브라우저/배포와 구분.

## A1-IT-012 — Drizzle 0000–0022 순서·참조 일치

- 근거 SHA: `drizzle/meta/_journal.json` **`45ec213999a1cf35bc65bdaf79f63a053e7d9796`**, `db/schema.ts` **`933f8686845ac14669312dd21bf85e02c62ed5e6`**. journal의 0000~0022 **실제 23개 SQL 파일 본문·각 SHA** 모두 직접 조회; `0000_chunky_cardiac.sql` blob `8dfc207156013820c41def90e787c781c34acf6d`, `0010_case_data_watch.sql` blob `6f14a419b760a79f38c027be0456bd6644b862b0`, `0022_preapproval_court_correction_items.sql` blob `bec8b19780eaa951c4994530060c916f903a40fe`.
- 독립 정적 기대 → 관찰: journal 23 entries와 SQL 23개 1:1·순번/파일 연결 확인; 앞 12 SQL에서 CREATE TABLE **40**, ALTER **3**, CREATE INDEX **25**, 뒤 11 SQL에서 CREATE TABLE **16**, ALTER **3**, CREATE INDEX **14**. 총 CREATE TABLE **56종**, schema `sqliteTable` **56종**, 양방향 이름 누락 **0/0**. 정규표현식 기준 CREATE 중복 0, 선행 테이블 없는 ALTER 0, 기존 테이블 없는 INDEX 0, 후반 index 이름 중복 0. **정적 식별 수준에서는 문제 미관찰**.
- 위 수치는 SQL syntax parser/SQLite 실제 migration 실행·기존 DB 데이터 재생·컬럼/제약 전체 diff·rollback·Cloudflare staging D1 테스트가 **아니다**. 기존 40차/74차의 정적 수준 증빙을 최신 SHA로 재검토한 것이며 인수 완료 아님.

## A1-AX-012 — 법률 모델 실패·재시도·병렬 중복 호출

- 실제 main `lib/pipeline.ts` blob **`79dce5f9822cf2debe1f886ab93ece4a256659e6`**의 `reviewLegal` 함수 **전체 본문**을 타입 제거 후 V8에서 실행. 합성 사건 revision=2, source version=4, 고정 input/reference SHA, 위험 ID 1개. DB SQL read/insert, provider `callLuna`, 이벤트, snapshot hash는 합성 스텁. 첫 두 변환 시험은 fixture의 `legalReviewInstructions`와 `LEGAL_REVIEW_SCHEMA` 주입 누락으로 모두 참조오류가 발생해 **폐기·분모 제외**; 의존성을 보완해 재실행한 아래 **6개 유효 시나리오**만 채점.
- 독립 기대는 **동일 사건·동일 소스 판본에 대한 불필요한 이중 모델 호출 회피**, 이미 성공한 분석 재사용, 실제 소스 버전 변경 때 새 호출 허용:
  1. 정상 첫 응답 후 동일판본 재요청: 모델 **1**, 분석 INSERT **1** → **기대 일치**.
  2. 모델 응답 성공 후 `event(model.call)` 실패, 동일판본 재시도: 모델 **2**, 분석 **1**, 오류 1 → **불일치**(기대 1/1).
  3. 두 요청이 SELECT 완료 후 동일 모델 응답을 await하는 barrier 병렬: 모델 **2**, 분석 **2** → **불일치**(기대 1/1).
  4. 분석 INSERT **실제 commit 후 ACK만 소실**한 합성 스텁: 모델 **1**, 분석 **1**, 재시도는 `legal_complete` → **기대 일치**.
  5. INSERT **commit 전 실패**, 재시도: 모델 **2**, 분석 **1** → **불일치**(동일판본 비용 선행 중복 방지 기대 1/1).
  6. 모델 호출 중 source version이 4→5 변경됨: 첫 응답 `legal_snapshot_changed`, 다음 요청 모델 합계 **2**, 분석 **1** → **기대 일치**(판본 갱신에 따른 정당한 재평가).
- **유효 6개 중 3개 독립 기대 일치**. 기존 미병합 [Draft #42](https://github.com/firmengine/firmengine/pull/42)는 보조 event 실패를 완화하지만 병렬 실행/INSERT 선행 실패에 대한 durable claim·lease를 입증하지 않음. 운영 유료 과금 발생이나 이중 저장의 실제 사실이 아니라 합성 조건에서의 **P1 실행 경계**. 모델·D1/staging·실제 동시 worker 미실행.

## A1-CALC-012 — 36/48/60개월·분할·납부일

- 실제 main `lib/repayment-plan-model.ts` blob **`6b9e53caba3be1eab17373956aa19717cfeec980`**와 `lib/plan-reconciliation.ts` blob **`1c895fd2fd8a133368315532ed2ab9984d64b2e3`**의 `buildRepaymentPlanModel`·`reconcilePlanLedger` 본문·날짜 helper를 V8 타입제거 실행. `moneyValue`는 합성 `amountWon` BigInt stub 사용. 가상 채권 1건, 회차당 원금 1원·보수 0원, revision 일치, 첫 납기 2026-01-31 또는 미관찰/null.
- **15조건 중 11개 독립 기대 일치**, **4개 불일치**:
  - 시작 납기 2026-01-31, 검토완료 36/48/60개월: 생성 **72/96/120 행**(보수행 포함), 정상 최종일 2028-12-31/2029-12-31/2030-12-31; `complete/reconciled` 기대 일치.
  - **검토완료 + 전 회차 납부일 null**: 36/48/60개월 모두 여전히 `complete/reconciled` → **3건 불일치**(독립 기대 blocked). `null`은 납부일 0이 아니며, 법원 제출 확정 불가.
  - **18+18 두 단계 중 후반 단계만 납부일 미관찰**: 후반 18회 null인데도 `complete/reconciled` → **1건 불일치**.
  - 검토전+납부일 null: 36/48/60개월 `provisional` 유지(해당 상태를 최종 제출 확정으로 취급하지 않는 조건), 잘못된 2026-02-30은 blocked, 18+18 연속 단계는 정상·중단 단계는 blocked; 모두 기대 일치.
- 기존 미병합 [Draft #37](https://github.com/firmengine/firmengine/pull/37)이 승인 계획의 누락 납부일 정합성을 차단하려는 수정. **이번 회차에 #37 수정 원본문을 다시 실행하지 않았으며**, 결합 통합·실제 변제계획 생성 API/저장 D1/공식 D5110 DOCX/변호사 승인은 미검증. 계좌·자산·우선순위 실제 채권배분도 이 테스트에 포함되지 않음.

## 코드조치, 사람 검토 및 후속

- 선택 ID **A1-IT-012 / A1-AX-012 / A1-CALC-012 [ ] 유지**, 독립 격리 기준 AX **3/6**, CALC **11/15**. IT는 정적 SQL 개수·참조 검사만; 서로 다른 범주의 결과를 합산해 정확도/품질 점수로 제시하지 않음.
- **제품 코드 수정 0**, 신규 코드 PR 0. 기존 [Draft #37](https://github.com/firmengine/firmengine/pull/37), [Draft #42](https://github.com/firmengine/firmengine/pull/42)는 미병합이며 수정 범위가 겹치므로 중복 패치하지 않음. 동시 모델 호출의 과금/원장 인수는 단순 local patch가 아니라 durable claim/lease/ID 설계와 IT·AX 실무 검토 및 실제 staging 검증 필요. 법률/계산 의미·사람 승인 상태를 임의 변경하지 않음.
- 다음 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**, 보드의 **A1-DOC-013 / A1-LAW-015 / A1-DATA-013** 우선 (최신 main 보드로 재확인).
- 코드 존재·V8 합성·SQL 정적 판독과 **프로젝트 Node/TypeScript/CI, 실제 SQLite·D1 migration, staging D1/R2/Cron, 브라우저, 85서류·693 canonical OCR/18계산/95법률 종단, 공식 서식, 실제 직원·변호사 승인, 사이트 배포**는 별개이며 이번 회차 전체 E2E 인수 **0건**.
- 운영 배포·운영 DB migration·실제 전자제출·법원 인가 확정 **0건**. 실제 고객 문서/PII/원본 OCR facts/키/.env/비공개 정답 공개 Git에 미기록. **Extra High 실제 모델/추론 설정 미확인**.
