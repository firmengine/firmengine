# FirmEngine A1 26차 — Export 증빙 보존·OCR 행 식별·변제 회차

- 관찰 시간: 2026-10-31 13:56:01 KST (UTC 2026-10-31T04:56:01.899Z); 저장소 `firmengine/firmengine` main 한정. 첫 검사 main `e65bdd990874ab71d379b321b010483df4f0cad4`; 작성 직전 재조회 HEAD `e65bdd990874ab71d379b321b010483df4f0cad4`.
- 업무 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A1-IT-014 / A1-AX-009 / A1-CALC-012**만 부분 감사, 전부 `[ ]` 유지.
- 역할 순환: 직전 **서류담당자/변호사/데이터담당자** → 이번 **IT담당자/AX담당자/계산사무장**. 상담→85서류→OCR→정규화→18계산→95법률→문안/보정의 종단 사용자 검수는 이 회차에 실행하지 않음.
- 최근 main: A4 r25 소스·manifest 상태 코드/테스트 문서, A3 r25 데이터 감사, A2 r25 피처/산식 감사 등 동시 변경 확인. 시작 영수증: A1 25차 `20261031-round25-reload-legal-contract-original-pointer-1248KST.md` 확인. 관련 PR #24/#25/#29/#37은 미병합 Draft, 새 #77도 Draft.
- 실제 소스 blob: `lib/export-artifact-transaction.ts` `a114235e5b5de57b5ae58b41026f939ee8543174`; `lib/extraction.ts` `75931aad3fc7871395e62276bb5533e24b15d1a5`; `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`. Drizzle `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`. 관련 `tests/export-artifact-transaction.test.ts` `a684612f61234a9fb0ac30261684733ba749eefc`; `tests/extraction.test.ts` `3ad778aaf64933e0c730d1b37d78df853d298e7e`; `tests/repayment-plan-model.test.ts` `b5ba94a3264a42fcbda6135f6c59f4fdfb0d9988`.
- 모든 실행은 실제 TypeScript 소스의 해당 함수 본문에서 **타입 주석만 제거하여 V8에서 실행**한 합성 격리 테스트. import·React/Next.js·Cloudflare D1/R2·Node 프로젝트 테스트·CI·실제 문서/OCR·법원 서식 **미실행**. 합성만 사용, 실제 고객자료와 원본 OCR 사실값 미사용.

## A1-IT-014 — Export 취소/타임아웃/재시도에 따른 live artifact 보존

- main `commitExportArtifactTransaction` 실제 함수+보조함수 본문을 변환하여 합성 SQL row map / R2 byte map / manifest array 및 주입 hook으로 실행.
- 독립 기대 → main 실제 (6조건):
  1. 정상 upload→record→manifest: SQL 2, R2 2, manifest 2 보존 **일치**.
  2. 두 번째 upload 후 예외: 2개 임시 R2 삭제, SQL 0, manifest 0 **일치**.
  3. persistRecords after insert 실패: SQL/R2 임시값 정리, manifest 0 **일치**.
  4. manifest commit 이미 성공, D1 ACK 유실 예외: **독립 기대 live SQL/R2 2개 보존**, main **SQL/R2 모두 삭제**(manifest는 2개 남음) → **기존 P0 결함 재현**. D1 운영에서 실제 ACK가 유실됐다는 증거는 아님.
  5. manifest 확정 409 실패: 임시 SQL/R2 정리 **일치**.
  6. manifest 뒤 afterCommit 로깅 실패: SQL/R2/manifest 보존 **일치**.
- **main 안전 기대 5/6**. 기존 [Draft PR #24](https://github.com/firmengine/firmengine/pull/24) 후보 실제 함수 blob `10dc79b9ec9dcf29ff74901af6a621a17d880573`, head `dc5d93d45e944466ba126d2b998345d6c2f38843`의 격리 4/4 기대 일치: ACK 유실이면 live 유지+uncertain receipt 1; upload/persist 실패면 정리; 409 실패도 불확실 보존·사후 orphan 대조 필요. 이미 보고된 결함으로 **신규 집계하지 않음**, 중복 수정하지 않음.
- 미검증: 실제 요청 cancel/timeout, 동일 idempotency key 재시도, D1 commit ACK/race, R2 객체 해시·배포 연동. 보안상 정리 대상과 현재 확정 manifest의 교집합을 운영에서 대조해야 함.

## A1-AX-009 — 다수 행 누락 OCR의 오합치·원문 identity

- main `preserveAgreedFieldsAfterOmission` 실제 함수와 `checksFor / recordCategoryStatus / validAgreement / canonicalKey` 보조함수 본문 V8. 독립 기대 → 실제 4조건:
  1. baseline 단일 거래 A에서 승인된 `amount=100`, reread 단일 거래 B에 `date=2026-09-02`만 존재, 소스 anchor는 없음: **기대 기존 100이 B에 복사되면 안 되고 complete=false**, 실제 **B에 100 복사되고 complete=true** → 신규 P2 오합치 재현.
  2. baseline/reread 둘 다 동일한 일반 라벨이고 anchor 없이 금액만 누락: 기대 source identity 미검증 보류, 실제 **복원+complete=true** → 신규 P2의 추가 변형.
  3. 2개 계좌 고유 verified `account_id` anchor, reread에서 순서 뒤집힘: 100/200을 각각 정확 계좌로 복원하고 complete=true **일치**.
  4. anchor 없는 다중행 2개: complete=false/금액 미복원 **일치**.
- **main 독립 기대 2/4**. 근본 원인은 단일 동일 category만 보고 다른 행일 수 있는 OCR reread에 기존 verified field를 복사하는 fallback. 개인 원문 출처 분리 원칙 및 source-only 사실 보존 위험.
- 작은 수정을 별도 **[Draft PR #77](https://github.com/firmengine/firmengine/pull/77)**에 등록: verified·unique source row anchor가 없으면 그 행의 사실을 새 행에 복사하지 않고 partial/review-required로 남긴다. 수정 함수 blob `1a7c52f179442ad739526567854f86dbd0fbb605`, PR head `d61f9874a276108cda7c4152d2e6c4c80b108de8`. 신규 `tests/ocr-omission-row-identity.test.ts` 5개 합성 Node 테스트 소스 작성·커밋(**Node 테스트 실제 실행하지 않음**). 브랜치 변경 실제 V8 **5/5 독립 기대 일치**: 이종단일행, 동일 라벨 무식별, verified anchor 순서교체, 동일 anchor 2행, 금액 불일치.
- **주의:** anchor 없는 단일 실제 행의 정상 보존도 부분 보류될 수 있음. OCR 후속 재판독·사람 검수량/UX/원본 대조율 영향은 AX·서류·변호사 검토 및 프로젝트 통합 테스트 필수. main에는 제품 코드 병합하지 않음.

## A1-CALC-012 — 36/48/60개월·예외월 변제 회차

- main `buildRepaymentPlanModel` 실제 함수 본문+날짜 함수 타입만 제거, 합성 ordinary 채권 1개(원금 99,999원·월 20원), 월 회생위원 보수 관측 **0원**, 계획기간 설정, snapshot revision 1 사용. **0원은 관측/입력된 숫자이며, null/미관찰과 다름**.
- 7개 독립 기대 → 실제:
  1. 36개월 2026-01-31 시작: debt 36행+fee 36행, 마지막 2028-12-31, `complete` **일치**.
  2. 48개월: 48+48행, 마지막 2029-12-31 **일치**.
  3. 60개월: 60+60행, 마지막 2030-12-31 **일치**.
  4. 36회차를 18+18 나눠 두 번째 2027-07-31: 36+36행/2028-12-31 **일치**.
  5. 18회차 누락된 phase gap: `blocked`, `MISSING_OR_DUPLICATE_MONTH` **일치**.
  6. 2026-02-29(윤일 아닌 날) 입력: `blocked` **일치**.
  7. **검토완료 reviewed=true지만 모든 36회차 paymentDate=null**: 독립 기대 재검토/차단, 실제 **`complete`** → 기존 누락 날짜 미차단 문제와 관련. [Draft PR #37](https://github.com/firmengine/firmengine/pull/37)은 하위 `reconcilePlanLedger`의 검토완료 null 날짜를 차단하는 제안으로 미병합. 후속 전체 계산/서식 E2E 및 기간별 계산 확정 필요.
- **main 독립 기대 6/7**. 본 테스트는 schedule builder만 검증하며 총액/법원 양식/법률 실무상 36·48·60개월 인정 여부를 확정하지 않음. `complete`는 내부 모델 상태이지 법원 인가/실제 제출 가능의 동의어가 아님. split phase 월말 31→28→31과 수정 PR #25/#29의 합성 조합 테스트가 남음.

## 수행·검증 수준·후속

- **합성 실행 총 26시나리오**: main 17조건(IT 6 + AX 4 + CALC 7), 기존 후보 PR #24 4조건, 새 PR #77 5조건. main 제품 안전 기대 **13/17**, 후보는 각 4/4·5/5 격리 일치. 이 수치는 제품 전체 정확도나 인수율이 아님.
- 코드 조치: A1-AX-009 **Draft PR #77 2파일**(함수의 무식별 fallback 제한 + Node 회귀 5개 소스). IT 기존 PR #24, CALC 기존 PR #37과 중복 변경하지 않음. 중앙 보드에는 이 세 ID만 반영; 셋 모두 `[ ]` 미완료.
- 검증 수준: source-only/V8 격리 통과 ≠ 전체 Node/typecheck/CI ≠ staging D1/R2/Cron ≠ 실제 공식 Word 서식/변호사 승인 ≠ 사이트 배포. 원문 OCR에서 나온 개인 사실/키/.env/비공개 정답 공개 Git 적재 없음. 운영 배포·운영 D1 migration·법원 전자제출·법원 인가 확정 수행하지 않음.
- 다음 역할 **서류담당자/변호사/데이터담당자**. 권장 다음 ID **A1-DOC-011**(A←B+C 갈음서류 부분충족 및 PR #57), **A1-LAW-016**(새 원문/계산/기준정보 변경 후 기존 승인 무효화), **A1-DATA-011**(정정·철회 이력 및 최신값).
- 필요 인수: PR #77 Node 테스트/다른 OCR PR 통합 후 다수행·단일행 raw/source-only/human-review 비교, PR #24/#37 통합 regression 및 원격 staging D1/R2, 36/48/60회차 지급기일과 D5110 실제 공식 서식·변호사 검토.
