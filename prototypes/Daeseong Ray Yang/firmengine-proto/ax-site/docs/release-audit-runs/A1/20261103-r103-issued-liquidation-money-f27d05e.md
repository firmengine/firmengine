# FirmEngine A1 — 103차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-03 KST)

- **대상·한계:** `firmengine/firmengine` / `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 역할 **사용자·서류담당자 → 변호사 → 데이터담당자** 순환. 직전 102차 `A1-IT-009 / A1-AX-009 / A1-CALC-009` 영수증을 이어받음.
- **감사 기준 시작 main HEAD:** `f27d05e5ebef8037fadbd5f03d58a72266106b2b` (A3 인수보드 갱신). 대상 중앙 보드 blob `84a03b334a1b68eaea7106d101e51ebcb5e4ac39`. 최근 커밋과 Draft PR #82/#86/#159 및 #95/#156의 상태 확인. `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 기존 `tests/pipeline-audit.test.ts` blob `71cf7c848a4df81c74b0a124444b85aba798950a` 점검.
- **실제 실행 방식:** GitHub에서 읽은 원본 TypeScript **관련 함수 본문**을 Code Mode V8의 `Function`에서 실행 가능하도록 **TS 타입 선언만 제거**해 격리 실행. 문서 모니터의 D1 쿼리·목록·workflow projection은 합성 대체. 법률 `assessCase`의 **청산가치 finding 표현식만** 원문 그대로 실행하며, 계산/trace는 합성. 원화의 `normalizeMoney` 함수 본문은 `ONE=1n,ZERO=0n` 주입. **프로젝트 Node/TS/CI/staging D1·R2·Cron/모델·브라우저/공식서식·변호사 승인·운영 배포는 실행하지 않음.** 검증 총 42조건 중 현재 main **28/42 독립 기대 일치**(10+4+14); 제품 정확도/전체 인수율이 아님.

## A1-DOC-010 [ ] — 발급일·사실 발생기간·신청일의 구별

- **main 소스 SHA:** `lib/case-requirement-monitor.ts` `5dfacd3a7738358fb27b95016d0e63bd93c8bb1b`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`. `EvidenceDocument`에 업로드일은 있으나 독립 발급일/증빙 대상 기간/신청일 대비 기한 승인 필드는 없음. `Fact`의 `periodStart/periodEnd/asOf`는 따로 존재하여 발급일과 동일시 금지.
- **합성 입력·실행:** 요구서류 `documentTypeId=income`, `subjectId=person1`, 요구기간 `2026-01~12`; (1) 동일 유형 활성 1쪽, (2) OCR 커밋 1쪽, (3) 삭제 문서, (4) 동일 쪽 2유형, (5) 다른 유형, (6) 활성 문서 2개, (7) 다른 주체의 분류 문서, (8) 발급일 2019-01-01, (9) 발급일 2026-10-31, (10) 문서 없음.
- **독립 기대:** 후보 단계는 문서 활성/유형/OCR head만 반영; 발급일·주체·요구기간 미검증 상태에서 `subjectAndPeriodVerified=false`, `requirementFulfilledInferred=false`, `legalSufficiencyInferred=false`; 오래된 발급일도 법원 유효성 승인으로 승격하지 않음.
- **관찰:** 원본 `caseRequirementMonitor` 함수의 의존성 합성 V8 실행 **10/10** 기대 일치. 실제 동일 유형 문서는 후보로만, OCR 커밋은 `ocr_committed_candidate`로만 출력. 다른 주체/과거·최근 가상 발급일도 똑같은 후보로 표시되며 자동 충족은 **항상 false**. 따라서 **날짜 유효성 자동판단은 구현 확인되지 않음**; UI 발급일 안내·직원 승인·실제 DB/서류 85종/법원 정책 종단은 미검증. 결함 확정/합격 승격 금지.

## A1-LAW-011 [ ] — 청산가치 보장·가용소득·수행가능성 구분

- **main 소스 SHA:** `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; 기존 Draft [#82](https://github.com/firmengine/firmengine/pull/82) `lib/assessment.ts` blob `e6dd3ae3427d184bc59dec051caa4ed8b88a3ae7`, head `7af06dc00681883e98f68d7cc6f6a1a1a7bd8b3b`, 미병합.
- **합성 입력:** `liquidationComparison=unknown/met/not_met`; `liquidation_comparison` trace 및 `asset:*` trace 각각 `calculated/provisional/blocked/없음`으로 조합한 10조건. **독립 기대:** 미확정 금액은 unknown, 확정 수치·모든 관련 trace calculated만 pass/fail, 미승인·미완료 trace가 있으면 수치 대조 `met`여도 `review_required`(법률승인 아님).
- **관찰:** 현재 main의 실제 `add("liquidation", ...)` 표현식 **4/10** 기대 일치. `met`+PV 잠정 또는 자산 잠정/blocked 에서 `pass` 4건, `not_met`+잠정 trace에서 `fail` 2건 (독립 기대 `review_required`). Draft #82 표현식 **10/10** 기대 일치. 이는 **finding 한 항목의 표시 경계** 재현이며 `calculateCase` 전체·`assessCase` 전체·법원 판정 오작동 확증은 아님.
- 코드의 `ordinary_budget`/`disposable` trace 및 채권자 이의 시 `objection_all_disposable_income` 항목은 **별도 분기**로 정적 확인하였으나 이 회차에는 실행하지 않음. 수행가능성 승인·가용소득 전부 제공 법률인정·채권자별 청산배당은 미검증. 정책 수정 없는 기존 Draft #82 병합/실무 검토 필요.

## A1-DATA-010 [ ] — 원·천원·만원·외화 및 부가세 포함 표기

- **main 소스 SHA:** `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; 기존 Draft [#86](https://github.com/firmengine/firmengine/pull/86) blob `4847da1410d09191558b40e6e4c5d9d7d8db5e4e` / HEAD `9349ad44eb459b3c3bf2d2d457060753c417090a`; [#159](https://github.com/firmengine/firmengine/pull/159) blob `cf3474f5d8e1567e8597d23015dbd7272e9e4319` / HEAD `5e6612ede582b863d171a6174f10c335432c00fa`. 둘 다 Draft·미병합.
- **합성 22조건:** 정수 원화 100·명시적 0·문자 `1원`, `1원`+만원, `0원`+천원, `250 KRW`+만원, 소수 `2.5`천원, `100`만원, `1,000`/잘못된 `1,00`·`1,,000`·`12,34,567`·`1,0000`, null, 빈문자, abc, KRW 외 USD, `1.001`천원, 소수원 `1.1`, 음수 `-1`, `-1,000`, `1,000 원`+만원.
- **독립 기대:** 원문 명시 `원/KRW`과 별도 천·만원 선언이 상충하면 `invalid/null` (명시적 0도 예외 없음); 잘못된 쉼표는 invalid; 타통화는 `review_required/null`; 진짜 null은 missing, 숫자 `0`은 exact 0, 음수는 산술 숫자 상태로만 보존(법적 인정 아님).
- **관찰:** 원본 `normalizeMoney` 본문 V8 실행에서 main **14/22**, #86 단독 **18/22**, #159 단독 **18/22**, 두 가지 검사를 *V8 메모리에서만* 함께 적용한 합성 후보 **22/22** 기대 일치. main 반례: `1원 + 만원 → 10000 exact`, `0원 + 천원 → 0 exact`, `1,00 → 100 exact`, `12,34,567 → 1234567 exact`. 서로 다른 PR은 동일 함수 경계 변경이므로 **실제 병합·Node 회귀·CI 없이 메모리 결합 통과를 제품 수정으로 간주하지 않음**.
- `NumericInput`에는 `rawValue/amountWon/unit/currency/normalizationStatus`가 있으나 VAT 포함 여부를 독립 금액 속성으로 구분하는 필드는 해당 타입에서 확인되지 않음. VAT 포함 매출과 순소득은 별도 계약·원천·회계 전문가 확인 없이는 자동 통합·승격 금지. 신규 판단 정책을 임의로 하드코딩하지 않음.

## 조치·안전 경계·다음 ID

- **제품 실행 코드 수정·신규 PR 없음.** 이미 열려 있는 #82, #86, #159가 각 결함 후보를 다루고 있어 중복 변경을 회피함. #86+#159의 병합은 소스 SHA 기반 통합 회귀를 별도 브랜치에서 검토해야 함. 고객정보·실제 PDF/OCR 원문·.env·API 키·비공개 정답 미수집·미기록.
- **이번 보드 갱신 대상은 오직** `A1-DOC-010`, `A1-LAW-011`, `A1-DATA-010`. 3개 모두 **[ ] 미인수**; 소스 존재/합성 통과/CI/staging/공식서식·변호사 승인/배포 구분. 실제 고객 문서·개인정보·원본 OCR 사실값 공개 Git 반영 없음.
- **다음 역할:** IT담당자 → AX담당자 → 계산사무장. **다음 ID:** `A1-IT-010`(두 브라우저·동일 사건 CAS), `A1-AX-010`(모델·프롬프트·기준정보·원본 hash 판본), `A1-CALC-010`(0/null/음수/비해당·상충 분리).
- 상담→요구서류 85→OCR→정규화→18계산→95법률→자동초안·직원문안검수→보정명령, 갈음 A←B+C, C01/C02/C04, 복수행·동시 사건 **전체 종단 통과 0건**. 실제 Node/CI/staging DB/R2/Cron/사이트 배포·공식서식·변호사 승인·법원 인가/제출 없음. Extra High 모드 실제 적용 여부 미확인.
