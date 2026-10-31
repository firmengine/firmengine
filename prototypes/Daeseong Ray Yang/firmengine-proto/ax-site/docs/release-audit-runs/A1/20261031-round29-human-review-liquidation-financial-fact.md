# FirmEngine A1 29차 — 독립 문서 검수·청산가치 판단 표시·동일 Fact 교차 계산소비

- 실행일: **2026-10-31 KST**. 감사 착수 시 `main` HEAD: `fbc5350a6096ff2392c4e5291ebe6bd92a626e66`. 신규 PR의 최초 base SHA 역시 동일. 영수증 커밋 직전 HEAD를 다시 확인했으며 구 버전 SHA를 최신 배포 인증으로 취급하지 않음.
- 감사 대상: 단일 인수보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A1-DOC-016 / A1-LAW-011 / A1-DATA-008**. 직전 28차 IT·AX·계산사무장에서 **서류담당자·변호사·데이터담당자**로 순환. 모두 **[ ] 미완료**.
- 실행 범위: 실제 GitHub main 소스 함수 본문 또는 정확한 소스 표현식을 TypeScript 주석·타입 부분만 제거한 뒤 V8에서 결정적 합성 fixture로 실행. 테스트용 helper/source 검증은 결정적 stub. **Node 전체 앱 테스트, CI, 브라우저·HTTP, 실제 D1/R2/Cron, DOCX 렌더링, 공식 법원 서식 및 변호사 실무 검토는 하지 않음**. 위 격리 결과를 제품 종단 검증이라고 표현하지 않음.
- 공개 Git에는 실제 고객정보, 원본 문서·OCR 값, 비공개 정답, 인증정보·.env·키를 기록하지 않음. 운영 배포, 운영 마이그레이션, 전자제출·법원 인가 확정 미수행.

## 선행 main·PR·코드·스키마·기존 영수증 확인

- `main`의 최근 A4 r28(`fbc5350a`), A3 r28(`f3b146f4`), A2 r28(`dd557a2e`), A1 r28(`c374bd88`), 이전 A1 28차 영수증 및 보드 원본 blob `96ed2070274b06301e1ffa485b3f2afeaf36b1ba` 읽음.
- 주요 정적 소스 blob:
  - `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`
  - `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378`
  - `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`
  - `lib/material-calculation-source-gate.ts` `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
  - `lib/income-resolution.ts` `f370c4b14fd347089708c5c3241fa9c72522d4bf`
  - `lib/debt-resolution.ts` `1e5cf8aa0e903896205010e415d71f76ec39ba2a`
  - `lib/asset-resolution.ts` `ffda6d7684a8d34f228a568d090602bfcdd89cbf`
  - `lib/case-execution.ts` `752049c087cc28b2d713eafb5dc3f7294623e8ae`
  - `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`
- 기존 합성 검증/테스트 원문: `tests/material-calculation-source-gate.test.ts`, `tests/calculation-18-output-golden.test.ts`, `tests/refactor-calculation-acceptance.test.ts`, `package.json`의 Node >=22.13 및 빌드·계약 검사 스크립트 읽음. 테스트 파일 **존재는 실행 완료가 아님**.
- `db/schema.ts`에서 사건·문서·산출물·사건 이벤트·명령 영수증 저장 구조 및 `case_mutation_receipts(case_id,command_id)` 고유성 확인. 실제 DB 실행은 없음.
- 기존 Draft PR #28(직원/변호사 독립 승인), #44/#63(금액 출처 검사), #80(원장 정합성) 확인; 신규 결함은 중복 PR로 간주하지 않고 기존 파일 충돌 가능성 기재.

## A1-DOC-016 — 독립 서명과 검토 상태 분리: **기존 P0 재현, 신규 집계 금지**

- `lib/domain.ts` 934–975행의 `manifestFingerprint`, `manifestIssues`, `currentExportReviews`, `reviewExport` 실제 함수본문 실행, 타입 표기만 제거. 모의 사건 `synthetic-01`, revision 1, `final` manifest 1개 `application` 파일, hash `h`, 영수증 없음으로 시작.
- 독립 기대 / 실제:
  1. 서명 없는 최종 manifest → 직원·변호사 `null/null` / 동일.
  2. 직원 검수 전에 변호사 서명 → 거절 / 동일.
  3. 직원 A 검수만 → 변호사 `null` / 동일.
  4. 직원 A → 별도 변호사 B → `A/B` / 동일.
  5. 직원 A → **동일인 변호사 A** → 변호사 인정 **금지** 기대 / **현재 변호사 A가 current로 인정**.
  6. 생성물 hash 변경 → 양쪽 검수 무효 / 동일.
  7. 사건 revision 변경 → 양쪽 무효 / 동일.
  8. `draft` manifest → 양쪽 무효 / 동일.
  9. 오래된 manifest 지문 제출 → 거절 / 동일.
- **main 8/9 독립 기대 일치, 1건 잘못 허용**. 이는 기존 PR [#28](https://github.com/firmengine/firmengine/pull/28)의 알려진 동일인 독립승인 결함이며 이번 회차 신규 P0로 재산정하지 않음. PR #28 미병합.
- `lib/case-commands.ts`의 `document.review`에서 `caseworker_review` / `lawyer_review` 권한 검사, 최신 final/processingReady/generationGate 및 `reviewExport` 호출 확인(**정적 연결 확인**). 같은 사용자에게 두 권한이 있으면 도메인 동일인 거절을 대신하지 못함. 실제 역할 토큰·HTTP·DB·법원 승인 종단 미검증.

## A1-LAW-011 — 숫자 비교와 사람 검토/수행가능성 분리: **신규 P2 후보**

- `lib/assessment.ts`의 실제 소스 543/545/546/662행 표현식을 그대로 V8 합성 환경에서 실행. `approvedPresentValue=120`, `liquidation=100` 등 합성 원화. `liquidationComparison="met"`은 숫자 비교이며 법원 인가/실제 청산가치 인정이 아님.
- 독립 기대 / main 관찰:
  1. PV·재산 평가 모두 검토, 120≥100: `pass` / `pass`.
  2. 현재가치 검토 **false**, 숫자 120≥100: `review_required` / **`pass`**, trace는 `provisional`.
  3. 재산 평가 검토 **false**, 숫자 120≥100: `review_required` / **`pass`**, trace는 `provisional`.
  4. 두 검토 모두 **false**, 숫자 120≥100: `review_required` / **`pass`**, trace는 `provisional`.
  5. 사람 검토 완료, 80<100: `fail` / `fail`.
  6. PV 누락: `unknown` / `unknown`.
  7. 청산가치 미확정: `unknown` / `unknown`.
  8. 평가 기준일 상충: `unknown` / `unknown`.
- **main 5/8** 일치, **미승인 finding 3건 `pass` 오표시**. 다만 `assessCase`는 별도 `present_value_review`, `asset_valuation_basis` findings 및 overall `generationGate.canFinalize`을 적용함. 숫자만으로 법원 승인/제품 최종 PASS가 확정됐다는 증거는 없음. 월 가용소득 `disposable`과 보수·우선·재단비용 차감 후 `ordinaryBudget`은 서로 다른 값이며, 계속소득 `recurring`은 별도 검토함. 수행가능성·실무상 인정·법원 판정은 별도 미검증.
- **[Draft PR #82](https://github.com/firmengine/firmengine/pull/82)**: `audit/a1-r29-liquidation-human-review-20261031`, HEAD `7af06dc00681883e98f68d7cc6f6a1a1a7bd8b3b`. `lib/assessment.ts` 새 blob `e6dd3ae3427d184bc59dec051caa4ed8b88a3ae7`: 청산가치 비교 및 관련 재산 trace가 모두 `calculated`일 때만 해당 finding `pass/fail`, 미승인 비교는 `review_required`, `unknown`은 유지. 후보 소스 동일 합성 표현식 **8/8 독립 기대 일치**. `tests/a1-r29-liquidation-review-finding.test.ts` 신규 Node 회귀 4건 **작성·커밋, Node 미실행**.
- 법률/회계 의미와 UI 문구가 바뀌므로 변호사·계산사무장 승인 및 앱 통합 CI 검증 전 미병합. 최종 법원 결과 의미를 코드가 확정하지 않음.

## A1-DATA-008 — 같은 factId의 교차 소득·채무·재산 원화 산입: **신규 P2 후보**

- `lib/material-calculation-source-gate.ts`의 `auditMaterialCalculatorSources` 원문 함수본문을 TS 표시 제거 후 V8 실행. 모의 Fact `f_income`, canonical `payroll_payslip::income.payroll.net_pay`, 원화 **100원**, 검증됨, 같은 `factId` 참조. 원본 조회·money/source helper는 결정적 stub. 실제 D1/법률 인정은 아님.
- 독립 기대 / 원본 관찰:
  1. 정상 소득 1행, 순액100 → issues 없음 / 동일.
  2. 같은 Fact로 소득 2행 → `CALC_INPUT_MULTIPLE_TYPED_MATCHES` / 동일.
  3. 같은 Fact에 소득100 + **재산100** → 중복 소비 검토보류 / **issues=[]**.
  4. 같은 Fact에 소득100 + **채무원금100** → 중복 소비 검토보류 / **issues=[]**.
  5. 같은 Fact가 소득100 + 재산250의 금액 불일치 문서참조 → 새 교차중복 가드는 해당 없음 / issues 없음.
  6. 소득 행의 숫자가 원천과 다름 → `CALC_INPUT_AMOUNT_MISMATCH` / 동일.
  7. 연결된 계산행 없음 → `CALC_INPUT_UNCONNECTED_MATERIAL` / 동일.
  8. `sourceState=explicit_none` → 숫자 계산 불산입 / 동일.
- **main 6/8 독립 기대 일치**, 다른 계산 범주에서 같은 금액의 원천 Fact가 계산 자료로 재사용된 2조건을 놓침. 실제 double-sum 최종 산출이나 운영 사건 문제가 있었다는 증거는 없음. 이 검증은 29개 material source 정의의 1개 canonical ID만 실험한 것이지 전체 693 전수가 아님.
- **[Draft PR #83](https://github.com/firmengine/firmengine/pull/83)**: `audit/a1-r29-cross-category-fact-double-count-20261031`, HEAD `e35bee219379854f3350cdb5e17d12d67c8d814b`. `lib/material-calculation-source-gate.ts` 새 blob `8e3c571b287aa07f8e695afd45e9313bddf02d91`: 하나의 material factId와 같은 원화 금액이 다른 소득·채무·재산 범주 typed 계산행에 동시에 연결되면 기존 `CALC_INPUT_MULTIPLE_TYPED_MATCHES`를 발생시킴. 서로 다른 금액 단순 참조는 이 조건에서 차단하지 않음. 후보 함수 V8 **8/8 기대 일치**. `tests/a1-r29-cross-category-fact-usage.test.ts` Node 회귀 5건 **작성·커밋, Node 미실행**.
- 동일 소스 수정 중인 Draft PR #44/#63과 파일 충돌 가능성. 별개 소득·자산 증빙으로 합법적으로 함께 참조하는 경우까지 잘못 차단하는지 전문가·통합 검증 필요. 본 PR은 법률·계산 의미 검토 전 미병합.

## 커밋·충돌·계층별 실제 관찰

- PR #82·#83은 GitHub에서 각각 **open/draft**, base `main`, 당시 `mergeable=true`. 두 PR 각각 **수정 소스 1개 + 신규 테스트 1개**, 총 4개 파일 모두 `ax-site/` 내 경로. 다른 에이전트 코드 변경 덮어쓰기·PR 병합 없음.
- 신규 PR 각 GitHub check-runs 확인 결과 **0건**. 실제 Node/전체 CI·타입·빌드·staging D1/R2/Cron·브라우저·Word·법률 실무자 승인·운영 배포 **전부 미관찰/미실행**.
- 기존 main 소스 격리 실행 **DOC 8/9 + LAW 5/8 + DATA 6/8 = 19/25 기대 일치**. 신규 PR 후보의 추가 V8 검증 **LAW 8/8 + DATA 8/8 = 16/16 기대 일치**. 소스 표현식 V8 재현은 전체 제품 인수율이 아님. 기존 P0 1건 재확인, **신규 P2 후보 2건**, 수정 Draft PR 2개. **완료 ID 0건**.
- 다음 역할 **IT·AX·계산사무장**: `A1-IT-018`(공개 번들·실제 키 누출), `A1-AX-011`(사람 승인 우회), `A1-CALC-014`(수정금액의 제안·원문·독립승인). 기존 PR #28/#44/#63 충돌·병합 계획 별도 검토.
