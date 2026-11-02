# FirmEngine A1 — 74차 코드 완결성·상호 기능충돌 독립 감사

- 기준일: 2026-11-02 KST. 감사 시작시 확인 GitHub `main` HEAD `5dc6a2e024a0f631bc341ff396d6742033164f39`; 중앙 보드 원본 blob `0b1808e7020721053c29ee16bf5c01db8508cc1b`. 회차 종료 SHA는 보드 최신 커밋으로 별도 기록.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 한정. 73차 영수증, 중앙 보드의 3개 ID 및 선행 34/38/40차 영수증, 2026-11-02 최근 GitHub 커밋·열린 Draft PR 상태, `db/schema.ts`, 실제 함수/테스트 및 Drizzle migration 소스를 재확인했다.
- 역할: **IT담당자 → AX담당자 → 계산사무장**. 대상 **A1-IT-012 / A1-AX-007 / A1-CALC-005**. 모두 **[ ] 미완료**.
- 증거 수준: GitHub 원본 코드에서 TypeScript 함수의 타입만 제거한 **V8 격리 실행**, SQL 파일을 모두 직접 읽은 **정적 DDL 대조**. Node 프로젝트 테스트, SQLite/D1 실제 migration, 실제 API·DB·브라우저·CI·배포 검증이 아니다. 금액·사건·월·원천값은 전부 합성.

## A1-IT-012 — migration 0000~0022 정적 대조

- Drizzle `drizzle/meta/_journal.json` blob `45ec213999a1cf35bc65bdaf79f63a053e7d9796`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; `drizzle/0000_*.sql`부터 `drizzle/0022_*.sql`까지 **실제 23 SQL 파일의 본문/blob SHA를 각각 직접 읽고 정적 JavaScript 검사**.
- 입력: journal entry 0~22의 idx/tag/when, SQL 전체 `CREATE TABLE`/`ALTER TABLE`/`CREATE INDEX`/`DROP TABLE` 대상, Drizzle `sqliteTable` 명칭.
- 독립 기대 → 관찰: **(1)** entry 23개/SQL 23개 = 23/23; **(2)** journal idx 0~22 연속 = 예; **(3)** tag와 파일 1:1 = 예; **(4)** 타임스탬프 증가 = 예; **(5)** 23개 전부 소스 직접 읽기 = 예; **(6)** ALTER 및 CREATE INDEX 대상은 선행·현 migration의 생성 테이블에 존재 = 모두 예; **(7)** 중복 테이블 생성/ DROP TABLE = 0/0; **(8)** SQL CREATE TABLE **56종**과 `db/schema.ts` `sqliteTable` **56종**의 이름 집합이 정확히 같음(양방향 차집합 0/0). **정적 검사 8/8 기대 일치.**
- 재현 경계: JS 정규표현식으로 SQL 명령 대상만 검사했다. **컬럼/제약/인덱스 전체 일치, 문장별 SQL 파서 실행, SQLite 적용, Cloudflare D1 migration, 레거시 레코드 역호환 및 롤백 검증은 미수행**. 현 DB에 23개가 실제 적용되어 있다고 판단하지 않는다. 40차보다 테이블 이름 양방향 대조를 추가한 부분 증빙만 확보.
- 코드 변경 없음; **A1-IT-012 [ ]**.

## A1-AX-007 — 모델 산술 차단 및 결정론 계산 영수증 전달

- 실제 main `lib/case-agent.ts` blob `8b6f6f615c05551f8783e4efbee60dbf81bd3993`, `lib/calculation-adapter.ts` blob `556ef86b887d1d729af2c56d071211c74b4d5e46`, `lib/calculator-tools.ts` blob `13025c1feb8f16d1c52b41ca8de35ac4b2e3c7c0`; `lib/case-execution.ts` blob `752049c087cc28b2d713eafb5dc3f7294623e8ae`, `tests/calculator-tools.test.ts` blob `4dbfc74926144524ea3ff60ae2af66e402a588c6` 확인.
- `runCaseCalculatorNode` 실제 본문에 합성 `context={id:case-A,revision:7}`, SHA `sha-A`, `CURRENT_RULESET.id=rules` 및 synthetic `callCalculatorTool` 반환 객체 주입. 독립 기대→관찰 6조건 **6/6**: 동일 case/revision/SHA 수용·`modelPerformedArithmetic=false` 영수증; 다른 case ID 거절; 오래된 revision 거절; 다른 input SHA 거절; 도구 `INVALID_INPUT` 거절; 결과 case identity 누락 거절. 시험의 SHA와 tool 응답은 **합성 stub**이며 실제 crypto·MCP 호출을 실행하지 않았다.
- `adaptCalculationInput` 실제 본문 V8 실행 **8/8**: 정상 `ready`, stale revision `blocked`, 월소득 `null` `blocked`, 명시적 0원은 `missing` 아님, provisional trace `provisional`, 소득 검토 issue `provisional`, 계획기간 `null`은 `not_applicable`, 추가생계비 중복 위험은 `provisional`. 외부 데이터는 독립 합성.
- `calculator-tools.ts`는 `calculate_case`에서 결정론 `executeCaseNodes`를 호출하도록 정적 연결되어 있다. **AI가 최종 초안의 금액·문구를 변조하거나 저장값으로 역주입하는 API/서식 경로는 테스트하지 않았다.** `ready`는 법률상 승인/법원 제출 합격이 아님.
- 제품 코드 변경 없음; **A1-AX-007 [ ]**.

## A1-CALC-005 — 명시 월수와 달력 span 충돌

- 실제 main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; 기존 [Draft PR #101](https://github.com/firmengine/firmengine/pull/101)의 소스 blob `654b9e0fc98cf3c945fe77a9bc08c970e34fcc5c`. 양쪽 모두 `monthIndex`, `monthSpan`, `monthlyIncome` **실제 함수 본문**을 타입만 제거하고 `moneyValue/nonnegative/referenceFormula/maximumCalculationMonths/floorDivide`는 독립 합성 대체해 동일 V8 조건 10개 실행.
- 독립 기대와 관찰(단위 KRW, 금액은 가상):
  1. 2025-01-01~01-31 / `monthly` / 1개월 / 1,000,000: **1,000,000**, main/PR 둘 다 일치.
  2. 2025-01-01~12-31 / `monthly` / **명시 1개월** / 1,000,000: 기대 `null + INCOME_PERIOD_DENOMINATOR_CONFLICT`; main **1,000,000 / [] (불일치)**, PR **null/충돌 (일치)**.
  3. 2025-01-01~02-28 / `monthly` / **명시 1개월** / 1,000,000: 기대 null/충돌; main **1,000,000 / [] (불일치)**, PR 일치.
  4. 2025-01-01~12-31 / `monthly` / 명시 1개월 / **명시 0원**: 기대 null/충돌; main **0 / [] (불일치)**, PR 일치. **0과 미관찰을 구분**.
  5. 완전한 12개월 span / 명시 12개월 / `monthly` / 1,000,000: 기대 1,000,000, 모두 일치.
  6. 12개월 span / `monthly` / 기간수 **미기재**: 함수 자체의 기대 1,000,000, 모두 일치. 단 실제 12개월 증빙 입증으로 승격하면 안 됨.
  7. 완전한 12개월 span / `period_total` / 명시 1개월 / 12,000,000: 기대 null/충돌, 모두 일치.
  8. 2025-01-15~01-31 / `period_total` / 1개월: 기대 null/`INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS`, 모두 일치.
  9. 기간 시작·끝 모두 미관찰 / `monthly` 1,000,000: 함수 한정 원문 월액 1,000,000(전체 집계 승인 아님), 모두 일치.
  10. 같은 1월 / `gross=3,000,000,expenses=1,000,000,net=null` / `monthly`: 함수 산술 2,000,000, 모두 일치.
- **main 7/10, PR #101 10/10 독립 기대 일치**. 실제 11개월 누락을 12개월 관측으로 승격하는 **전체 집계·18계산·D1·법원 서식 종단 경로는 미실행**. 월별 소득액 유효성과 **관측기간 전체 충족 여부**는 서로 다른 계약이다.
- #101은 **Draft·미병합**이고 #67/#79/#96도 `assessment.ts`를 변경하므로 새 PR/중복 패치 없음. 사무장 실무 검수 및 전체 통합 회귀 필요. **A1-CALC-005 [ ]**.

## 회차 판정 및 다음 ID

- 이번 회차: 정적 SQL 8/8; AX 노드 6/6·adapter 8/8; CALC main 7/10 vs 기존 PR 10/10. **서로 다른 단위/환경의 분모를 합산해 제품 정확도를 만들지 않는다.**
- 신규 확정 결함 **0**, 신규 제품코드 변경 **0**, 신규 PR **0**. 기존 P1 원본 반례 유지. 이미 열린 #101을 강제 병합하지 않았으며 법률/계산 의미 변경 없음.
- 다음 역할 순환: **사용자·서류담당자 A1-DOC-014**(OCR 정정과 원문 보존) → **변호사 A1-LAW-015**(직원 제안/변호사 독립 승인) → **데이터담당자 A1-DATA-014**(18계산·입력91 경로). 중앙 보드에서 실제 설명 재확인 후 진행.
- 미관찰/null/0/비해당/상충/source-only/승인 전은 별도 상태. **실제 Node 프로젝트 회귀·TypeScript·전체 CI·빌드·staging D1/R2/Cron·브라우저·85서류/복수행/갈음 A←B+C/C01-C02-C04/보정명령·18계산/95법률 E2E·공식 법원 서식·직원/변호사 승인·사이트 배포 모두 이 회차 미검증**. 운영 배포·운영 마이그레이션·실제 전자제출·법원 인가 확정 **미실행**.
- 실제 실행 환경의 Extra High 추론 수준은 확인되지 않았다. 공개 Git에 고객 정보·실원문·OCR 정답·키/.env는 전혀 기록하지 않는다.
