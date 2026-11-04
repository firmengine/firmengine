# FirmEngine A1 — 121차 코드 완결성·상호 기능충돌 감사 (2026-11-04 KST)

- 작업 경계: `firmengine/firmengine`, `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. **감사 기준 main HEAD `bb4926013c15db0085bf6547a7d4c21621825605`**, 중앙 보드 Blob `958ef76bcb6c492abe390bd8f3f23d85265e62a7`. 직전 A1 120차(IT→AX→계산사무장) 이후 **사용자·서류담당자 → 변호사 → 데이터담당자** 순환. 최신 GitHub main 최근 커밋(A1 r120/A2 r121/A3 r121), Draft PR #82/#86/#159, `db/schema.ts`, `tests/calculation-audit.test.ts`, A1 103·120차 영수증 및 본문 코드를 확인하고 검증.
- 검증 종류: GitHub에서 읽어온 **실제 TS 함수·표현식 본문을 타입 선언만 제거**해 Code Mode V8 `Function`으로 격리 실행. 요구서류 후보 단계는 문서/페이지/헤드/잡 배열 합성. 청산가치는 합성 계산 trace + 원본 법률 finding 표현식. 금액은 원본 `normalizeMoney`와 `moneyValue`를 함께 실행. **별도 합성의존성/trace는 실제 DB·AI·법원 결과가 아님.** 85종 전체 서류, 18계산, 95법률, C01-C02-C04, 두 사건 동시수정, HTTP/Node/TypeScript/CI/staging D1·R2/Cron/공식서식/변호사 승인·배포는 실행하지 않음.

## A1-DOC-010 [ ] — 발급일·발생기간·신청일
- 소스: `lib/case-requirement-monitor.ts` Blob `5dfacd3a7738358fb27b95016d0e63bd93c8bb1b`; `lib/domain.ts` Blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`. `EvidenceDocument`의 `uploadedAt`는 존재하지만 `issuedAt`·내용 기간 판정용 독립 typed 승인 필드는 없음. `Fact.periodStart/periodEnd/asOf`는 별도 원천 관측 정보이지 발급일이 아님.
- 실제 실행: `caseRequirementMonitor`의 `activeDocs` → `requirements=checklist.requirements.map`까지 **원본문**의 TS generic/매개변수 타입만 제거해 V8 실행. 비식별 합성 13조건: 문서 없음, 활성유형 1쪽, OCR 헤드, 삭제 문서, 동일 페이지 2유형, 다른 유형, 한 문서 2쪽, 2문서, 가상 발급 2019년, 다른 주체, 다른 기간, 미분류 실패 job, 문서 ID에 `:` 포함.
- 독립 기대: 후보 단계/페이지/헤드는 해당 상태로 나타내되, 기간·주체·발급일의 **법적 충족은 자동 승인 금지**. 관찰: **13/13 기대 일치**, 모든 조건 `subjectAndPeriodVerified=false`, `requirementFulfilledInferred=false`. 발급일 2019년/다른 사람/다른 기간도 동일 유형이면 *후보*로 표기되지만 충족으로 승격되지 않음. 실제 신청일 비교·유효기간 정책/개별법원 승인 **미구현 또는 미관찰**, E2E 미인증.

## A1-LAW-011 [ ] — 청산가치 숫자 비교와 사람 검토 상태 분리
- 소스: `lib/assessment.ts` Blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`. `calculateCase`에서 `liquidationComparison` 수치 결과와 `liquidation_comparison` trace의 `calculated/provisional/blocked`를 구분하지만 `assessCase`의 청산가치 finding 표현식은 `met→pass`, `not_met→fail`로 결정.
- 실제 실행: 원본 `add("liquidation",...)` 표현식 그대로 V8 실행. **3개 비교값(unknown/met/not_met) × 4개 comparison trace 상태(calculated/provisional/blocked/없음) × 3개 asset trace 상태(calculated/provisional/blocked)=36조건**. 독립 기대: unknown→unknown, 숫자 비교가 존재해도 trace 검토 미완료/차단은 review_required, 둘 다 calculated일 때만 숫자 pass/fail finding. 관찰: main **14/36 기대 일치**, `met`+잠정 trace가 `pass`, `not_met`+잠정 trace가 `fail`인 **22조건 불일치**. 이는 finding **표시 경계의 격리 반례**이며 전체 `assessCase`·최종 승인/법원 결과에 대한 진술이 아님.
- 기존 [Draft PR #82](https://github.com/firmengine/firmengine/pull/82) `assessment.ts` Blob `e6dd3ae3427d184bc59dec051caa4ed8b88a3ae7`의 변경된 조건식 동일 36조건 **36/36 기대 일치**. 열림·Draft·미병합. 실제 원장 계산·가용소득 및 수행가능성·채권자별 청산배당·법률 실무 승인 미검증.

## A1-DATA-010 [ ] — 원화 출처표기 충돌과 moneyValue 소비 경계
- 소스: `lib/domain.ts` Blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`의 `normalizeMoney`, `moneyValue` 실제 함수 본문 V8 실행(`ONE=1n,ZERO=0n`). 단위 원/천원/만원, 소수·음수·명시적 0, 외화, 잘못된 쉼표 등 **33개 독립 입력**.
- 독립 기대: 명시 `원/KRW`와 천/만원 단위 선언 충돌 또는 잘못된 쉼표는 invalid/null; 외화 review_required/null; 숫자 0은 exact 0; 미관찰 null은 missing; 미정수원은 review_required.
- 관찰: **main 22/33 기대 일치(11 불일치)**. 예시 `1,00 + KRW→exact 100`, `1,,000→exact 1000`, `1원 + 만원→exact 10000`, `0원 + 천원→exact 0`, `250 KRW + thousand_won→exact 250000`. 같은 함수에서 생성한 정규화 결과를 `moneyValue`로 소비하는 8개 조건은 **main 4/8**: 잘못된 두 단위 충돌과 쉼표 값이 재정규화 일치라는 이유로 그대로 소비됨. 단순 숫자 0과 null의 구분 자체는 유지.
- 기존 [Draft PR #86](https://github.com/firmengine/firmengine/pull/86) Blob `4847da1410d09191558b40e6e4c5d9d7d8db5e4e` 원화 표기 guard 단독 **29/33**, [Draft PR #159](https://github.com/firmengine/firmengine/pull/159) Blob `cf3474f5d8e1567e8597d23015dbd7272e9e4319` 쉼표 guard 단독 **26/33**, **V8 메모리 상의 두 guard 합성만 33/33**(실제 PR 병합·프로젝트 테스트·CI 통과가 아님). 두 PR 모두 열림·Draft·미병합, 동일 함수 충돌 및 중복 로직 회귀/데이터 정책 승인 필요. 외화 환산·VAT 포함 여부/순소득 인식/실제 계산·서식 미검증.

## 코드 조치·충돌·후속
- **신규 제품 코드 변경/신규 PR 없음:** 3개 기존 항목을 심화 재현하고 기존 #82/#86/#159의 코드가 별도 Draft로 이미 존재하므로 동일 파일 임의 덮어쓰기 금지. 법률 판단 또는 원본 회계 단위 의미를 변경하는 병합은 실무 검토·분기 통합 회귀가 선행되어야 함.
- 중앙 보드에서는 `A1-DOC-010`, `A1-LAW-011`, `A1-DATA-010` **3개 ID만 [ ] 보존 병합**, 각 ID에 격리 입력·실제 관찰·소스 SHA·영수증 연결. 공개 Git에 고객 사실값/OCR 원문/키·.env·원본 PDF·비공개 정답 기록 없음.
- 다음 역할 순서 **IT담당자 → AX담당자 → 계산사무장**. 다음 점검 ID: `A1-IT-010` (두 세션·동일사건 버전경쟁), `A1-AX-010` (모델/프롬프트/기준 SHA 판본), `A1-CALC-010` (0/null/음수/비해당·상충). 최신 보드와 본문으로 재확정할 것.
- 판정: **모든 세 ID 미완료 [ ]**, 전체 상담→85서류→OCR→정규화→18계산→95법률→문안/검수→법원 보정 종단 인수 **0건**. 본 감사의 13/13, 14/36, 22/33, 4/8 숫자는 서로 다른 V8 함수 합성 사례의 정합성으로 제품 정확도/법적 승인율이 아니다. Extra High 실제 실행 모드 미확인. 운영 배포, D1 운영 마이그레이션, 법원 제출·인가 확정 실행하지 않음.
