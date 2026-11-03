# FirmEngine A1 — 99차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-03 15:56 KST)

- **범위:** `firmengine/firmengine` / `main`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 선행 98차 다음 순환 **사용자·서류담당자 → 변호사 → 데이터담당자**. 점검 ID `A1-DOC-008`, `A1-LAW-009`, `A1-DATA-008`. 세 ID 모두 **[ ] 미완료**.
- **감사 시작 및 저장 전 확인 main HEAD:** `c5527f6ef80448edcf94bdf426086239adc0ea43`, 중앙 보드 blob `9067c03438ed03a79874c4f36a184e29e6cb73ba`. 최신 main/최근 커밋·PR 목록 및 98차 영수증(`aeabaa90cf075210f4e2566f9a3f55a6d0144d21`), `db/schema.ts`(`933f8686845ac14669312dd21bf85e02c62ed5e6`), 해당 기능 소스/기존 테스트/PR #83 #152 #218를 조회. PR #83/#152/#218 모두 **Draft 미병합**.
- **검증 실행 범위:** GitHub에서 받은 **실제 TypeScript 함수/조건문 본문을 JS로 타입 구문만 제거**한 후 V8 격리 실행. `currentFacts`, `moneyValue`, `validSourceRef`, 인덱스·DB/문서연결 등은 통제된 합성 의존성. **원본 TS의 특정 함수/조건문 실행**과 제품 전체 Node/브라우저/실 D1/R2/법률 인수는 다르다. 아래 수치는 합성 조건 단위 결과만 표시.
- **비밀·고객 자료 없음:** 합성 Fact 100/50/0과 가상 bbox·소스만 사용, 실제 PDF/OCR/개인정보/.env/키/비공개 정답 없음.

## A1-DOC-008 [ ] — 문구·숫자와 원본 PDF의 페이지·좌표 연결

- 소스 `lib/source-verification-identity.ts` blob `acdecd4e18970fe4faf6eb91dd4aefc97b83236b`; `components/workspace.tsx` blob `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`; `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`.
- `isValidSourceBBox` / `sameSourceBBox` / `sourceBBoxesAreDistinctAndDisjoint` **실제 함수 20/20** 기대 일치. 독립 기대·관찰 결과 표(각 값 bool):

| 조건 | 합성 입력 | 독립 기대 | 실제 관찰 |
|---|---|---|---|
| D01 | 정상 정규화 bbox [.1,.2,.4,.5] | true | true |
| D02 | 전체 페이지 [0,0,1,1] | true | true |
| D03 | 너비 0 | false | false |
| D04 | 높이 0 | false | false |
| D05 | 좌우 역전 | false | false |
| D06 | x > 1 | false | false |
| D07 | x < 0 | false | false |
| D08 | NaN | false | false |
| D09 | Infinity | false | false |
| D10 | 문자열 좌표 | false | false |
| D11 | 3개 좌표 | false | false |
| D12 | null | false | false |
| D13 | 완전히 같은 두 bbox | true | true |
| D14 | 다른 두 bbox | false | false |
| D15 | 둘 다 무효 bbox | false | false |
| D16 | 서로 분리된 두 bbox | true | true |
| D17 | 꼭짓점에서 닿는 두 bbox | true | true |
| D18 | 일부 겹치는 두 bbox | false | false |
| D19 | 완전 내포된 두 bbox | false | false |
| D20 | 단일 bbox 목록 | false | false |

- 실제 UI 코드 정적 교차확인: `SourceRef.bbox?: [number,number,number,number]`는 선언되어 있으나 `workspace.tsx` 원문 근거 모달은 인용문+ `<PageImage caseId={...} documentId={source.documentId} page={source.page} />`+원본 다운로드로 구성. 이 호출에서 `bbox`/`highlight`/`overlay` props를 전달하지 않음. **OCR 해당 위치 시각 강조는 이 경로에서 구현 미확인**; 이미지 조회 자체는 정적으로 존재. 실제 PDF 좌표→화면 화소 변환·회전·확대·브라우저 클릭/권한/페이지 이미지 픽셀은 **미실행**. UI 좌표 변환 방식 결정을 요구하므로 무검증 즉흥 패치 없음.

## A1-LAW-009 [ ] — 과거 세무 소득 원천의 역할 변경 우회

- 소스 `lib/assessment.ts` main blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; 기존 [Draft PR #152](https://github.com/firmengine/firmengine/pull/152) 코드 blob `0ab8a4a7bbe11f8e68d5bc9c29b136a61c703687`. 실제 `calculateCase` 안의 `historicalUnreviewed`/`historicalPeriodUnreviewed` guard 문장(및 PR에서는 `taxIncomeFactLinked`)만 격리 평가. 전체 계산 엔진 `calculateCase` **실행하지 않음**.
- 독립 기대는 법률상 인정 소득이 아니라 **과거 신고 소득을 대표기간에 사용하기 전 미승인 상태에서 보류하는가**이다. 인식/기간 보류 둘을 분리. **main 5/10 / Draft #152 10/10** 기대 일치.

| 조건 | 합성 입력 | 독립 기대 | main 관찰 | PR #152 관찰 |
|---|---|---|---|---|
| L01 | tax_income::... / period / accepted / 집계검토 없음 | 보류(period) | 미보류 | 보류(period) |
| L02 | tax_income::... / period / unreviewed | 보류(recognition) | 미보류 | 보류(recognition) |
| L03 | tax_income::... / historical / accepted / 집계검토 없음 | 보류(period) | 보류(period) | 보류(period) |
| L04 | tax_income::... / historical / unreviewed | 보류(recognition) | 보류(recognition) | 보류(recognition) |
| L05 | tax_income::... / period / accepted / independent_source+사유 | 비차단 | 비차단 | 비차단 |
| L06 | payroll_payslip::... / period / accepted | 비차단 | 비차단 | 비차단 |
| L07 | payroll_payslip::... / historical / accepted | 보류(period) | 보류(period) | 보류(period) |
| L08 | tax_income::... / period / approved=true but 사유 공백 | 보류(period) | 미보류 | 보류(period) |
| L09 | tax_income::... / period / approved=true but treatment unknown | 보류(period) | 미보류 | 보류(period) |
| L10 | tax_income::... / fieldObservation fallback / period | 보류(period) | 미보류 | 보류(period) |

- **P1 후보 유지:** `tax_income::income_after_expenses` 원천을 `period_income_observation`으로 재명명하면 main의 현재 guard가 과거 세무증빙 비교 조건을 생략한다. PR #152는 원천 canonical ID를 검토. 그러나 원천 관측연도·실제 급여·사업장·세무회계 검토·최종 소득 인정/월평균/서식은 별도 단계이며 **전부 미검증**. 변호사·계산사무장 검수 및 PR 관련 파일 충돌/통합 테스트 전 **병합 금지**.

## A1-DATA-008 [ ] — 동일 Fact의 소득·채무·재산 교차 소비

- `lib/material-calculation-source-gate.ts` main blob `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, [Draft #83](https://github.com/firmengine/firmengine/pull/83) blob `8e3c571b287aa07f8e695afd45e9313bddf02d91`, [Draft #218](https://github.com/firmengine/firmengine/pull/218) blob `3c00d03f32bc2d14b118102eac3127f13824b048`. 기존 `tests/material-calculation-source-gate.test.ts` main blob `eb37d53f09ad13fa0d13839325db8fd635c76bb7` 확인.
- 29개 `MATERIAL_CALCULATION_SOURCES` 정의를 실제 소스에서 파싱하고, 각 버전의 **동일 `auditMaterialCalculatorSources` 함수 본문을 타입 제거 후 격리 실행**. 합성 Fact의 유효 참조를 stub에서 true로 지정하고 범주별 금액을 명시한 **13개 시나리오 × 3버전** 관찰.
- 관찰 코드 `MULTIPLE`=`CALC_INPUT_MULTIPLE_TYPED_MATCHES`, `UNCONNECTED`=`CALC_INPUT_UNCONNECTED_MATERIAL`, `AMOUNT_INVALID`=`CALC_INPUT_AMOUNT_INVALID`, `SOURCE_INVALID`=`CALC_INPUT_SOURCE_INVALID`, `없음`=issues 빈 배열.

| 조건 | 합성 입력 | main 실제 | Draft #83 실제 | Draft #218 실제 |
|---|---|---|---|---|
| F01 | bank Fact100→asset100 | 없음 | 없음 | 없음 |
| F02 | same Fact→asset100 두 행 | MULTIPLE | MULTIPLE | MULTIPLE |
| F03 | asset100+debt principal100 | 없음 | MULTIPLE | MULTIPLE |
| F04 | asset100+debt principal50 | 없음 | 없음 | MULTIPLE |
| F05 | asset100+income net100 | 없음 | MULTIPLE | MULTIPLE |
| F06 | asset100+income net50 | 없음 | 없음 | MULTIPLE |
| F07 | Fact 0→asset0+debt0 | 없음 | MULTIPLE | MULTIPLE |
| F08 | asset100+debt null | 없음 | 없음 | 없음 |
| F09 | asset100+debt 0 | 없음 | 없음 | MULTIPLE |
| F10 | Fact100 but no typed asset | UNCONNECTED | UNCONNECTED | UNCONNECTED |
| F11 | Fact.sourceState=unknown | AMOUNT_INVALID | AMOUNT_INVALID | AMOUNT_INVALID |
| F12 | verified Fact but refs=[] | SOURCE_INVALID | SOURCE_INVALID | SOURCE_INVALID |
| F13 | guarantee_joint_claim context_only | 없음 | 없음 | 없음 |

- 분명한 한 Fact 동일 금액 이중 산입 경계에서 **main 경고 누락**, #83/#218 모두 경고. 그러나 서로 다른 금액을 교차 연결할 때 **#83은 허용·#218은 경고**, 명시적 다른 범주 `0`도 #218은 금전 입력으로 간주한다. 별도 Fact·계산행의 합법적인 교차참조 가능성을 **이 실험으로 판정 불가**. 이 3개 정책 차이를 독립 합격/불합격으로 표시하거나 법률상 중복으로 확정하지 않음.
- **#83과 #218 병합 충돌·중복 해결 미완:** 동일 함수 패치의 선택적 수동 통합, 회귀 Node/18계산/추가 원천 행/실 D1·서식 검증, 계산사무장·데이터담당자·변호사 승인 필요. 두 PR 자동 병합 금지. 별도 수정 PR 새로 만들지 않음.

## 조치 / 인수판정 / 다음 회차

- **이번 제품 실행 코드 변경 없음 / 신규 PR 없음.** 기존 Draft #152, #83, #218이 동일 결함 또는 선택적인 방어안을 이미 포함. 시각 bbox 오버레이는 실제 UI·좌표·회전 E2E가 없는 상태에서 임의 수정하지 않음. 중앙 보드 **3개 ID에만** 감사 요약을 추가하고 이 **고유 경로 영수증**으로 상세 조건을 유지.
- **종단 제품 인수 0건.** bbox 함수 20/20, 세무 guard main 5/10·#152 10/10, 교차 Fact 조건 13×3건 실제 함수 격리 관찰은 각각 **부분 결과**, 서로 합산해 제품 통과율로 표현 금지.
- 다음 순환: **IT `A1-IT-008`** (R2 성공→D1 실패·ACK 불명확·고아 정리); **AX `A1-AX-008`** (법률 의견/반론/쟁점 해소 계약); **계산사무장 `A1-CALC-008`** (보증금·보험·퇴직금·지분·면제재산/보호금액).
- 누락 영역: 실제 PDF OCR 좌표/UI, R2/DB 판본·병렬, 상담→85서류→OCR→정규화→18계산→95법률→문안·보정 전체 흐름, 복수행·갈음 A←B+C/C01-C02-C04, Node/TS/빌드/CI/staging D1·R2·Cron, 공식 서식·직원/변호사 승인 및 사이트 배포 **모두 미검증**. `미관찰/null/0/비해당/상충/source-only/승인전` 구별; 법률상 인정/인가 추론 금지. 운영 배포·운영 마이그레이션·전자제출/인가 확정 미수행. Extra High 모드 실제 확인 불가.
