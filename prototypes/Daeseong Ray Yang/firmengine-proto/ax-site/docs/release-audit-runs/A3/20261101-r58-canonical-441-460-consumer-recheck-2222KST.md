# FirmEngine A3 r58 — canonical #441–460 소비처 심층 재감사 (2026-11-01 KST)

## 기준·진행 이력·검증 수준
- 시작 main HEAD: `197caae9a6f4f86686ce9cbaca9bcc676a86d4c7`. 변경 허용: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 직전 [r57 #421–440](20261101-r57-canonical-421-440-consumer-recheck-2122KST.md)과 동일 범위의 역사 [r23 #441–460](20261031-r23-canonical-441-460-1122KST.md) 확인 후 최신 등록표/코드 재조인.
- 역할 순환 **AX→IT→사용자·서류→계산사무장→변호사**, 다음 회차 **데이터**. 체크 ID `A3-AX-014`, `A3-IT-006`, `A3-DOC-008`, `A3-CALC-015`, `A3-LAW-015` 모두 **부분 [ ]**.
- 실제 GitHub 원본의 JSON 계약과 `feature-lineage-audit.ts` 원본 술어를 V8에서 격리 실행·독립 대조. Node CI/전체 빌드, 실제 OCR/PDF, D1/R2/Cron, 법원 공식 서식, 변호사 승인, 사이트 배포 **미실행/미인증**. 고객 자료·키·비공개 정답 사용 없음.

## 전체 인덱스 및 이번 20개 표
- **693 canonical/693 등록표 순서 일치, 고유 693, 85 문서/48 family/1,808 원천 슬롯**. 18 계산/91 선언입력(고유78), 위험95/규칙50/예외46. 124개 A3 체크 ID 기존 `[x]` 0(보드).
- **#441–460: 20 ID, 27 슬롯, 3문서** (`tax_arrears`, `local_tax_assessment`, `salary_statement`), 2 family (`local_tax`,`payroll_payslip`). 원천 위치 선언 27/27(`required_source_anchor` 20 + `source_locator_required` 7), 교차행 차용 금지 선언 27/27. 이는 실제 페이지/행/원본 SHA/quote/bbox 재독 검증이 아니다.
- 정확 적용조건 등록 **14/20**, 미등록 **6/20**(#448–453) 각각 0% 승인. 정확 typed **1/20**(#457 `income.employer`), 계산18/91의 정확 입력 **0/20**, material `must_reconcile`/`context_only` **0/20**(원본 목록), 서식 정확 토큰 **0/20**, 95/50/46 정확 승인형 canonical 증거계약 **0/20**(등록 위험/룰/예외 및 `legal-evidence-criteria` seed 확인). 0개 직접소비 ≠ 무용/삭제/비해당/0원.

| # | canonical ID | 서류·슬롯 | 타입/단위 | 대상/시간역할/금액소유자 | P/U | 적용조건 | typed / 직접계산 / 정확 token |
|---:|---|---|---|---|:---:|---|---|
| 441 | `local_tax::issue_date` | tax_arrears,local_tax_assessment (2) | date / source date format normalized to ISO without loss | taxpayer / document_issue_date / not_applicable | 11/00 | 등록 | source-only / 0 / 0 |
| 442 | `local_tax::paid_amount` | tax_arrears,local_tax_assessment (2) | money / currency and exact source unit if monetary | taxpayer / not_applicable / taxpayer | 11/11 | 등록 | source-only / 0 / 0 |
| 443 | `local_tax::surcharge` | tax_arrears,local_tax_assessment (2) | money / currency and exact source unit if monetary | taxpayer / not_applicable / taxpayer | 11/11 | 등록 | source-only / 0 / 0 |
| 444 | `local_tax::tax_base` | tax_arrears,local_tax_assessment (2) | money / currency and exact source unit if monetary | taxpayer / not_applicable / taxpayer | 11/11 | 등록 | source-only / 0 / 0 |
| 445 | `local_tax::tax_period` | tax_arrears,local_tax_assessment (2) | period / source date format normalized to ISO without loss | taxpayer / tax_period_year / not_applicable | 11/00 | 등록 | source-only / 0 / 0 |
| 446 | `local_tax::tax_type` | tax_arrears,local_tax_assessment (2) | category / not_applicable | taxpayer / not_applicable / not_applicable | 11/00 | 등록 | source-only / 0 / 0 |
| 447 | `local_tax::taxpayer` | tax_arrears,local_tax_assessment (2) | party_role / not_applicable | taxpayer / not_applicable / not_applicable | 11/00 | 등록 | source-only / 0 / 0 |
| 448 | `local_tax_assessment::jurisdiction_scope` | local_tax_assessment (1) | string / not_applicable | document_subject / not_applicable / not_applicable | 1/0 | **미등록(0% 승인)** | source-only / 0 / 0 |
| 449 | `local_tax_assessment::no_assessment_text` | local_tax_assessment (1) | string / not_applicable | document_subject / not_applicable / not_applicable | 1/0 | **미등록(0% 승인)** | source-only / 0 / 0 |
| 450 | `local_tax_assessment::row_or_subtotal_kind` | local_tax_assessment (1) | category / not_applicable | document_subject / not_applicable / not_applicable | 1/0 | **미등록(0% 승인)** | source-only / 0 / 0 |
| 451 | `local_tax_assessment::tax_assessment_year` | local_tax_assessment (1) | year / not_applicable | document_subject / not_applicable / not_applicable | 1/0 | **미등록(0% 승인)** | source-only / 0 / 0 |
| 452 | `local_tax_assessment::tax_notice_status` | local_tax_assessment (1) | category / not_applicable | document_subject / not_applicable / not_applicable | 1/0 | **미등록(0% 승인)** | source-only / 0 / 0 |
| 453 | `local_tax_assessment::tax_object` | local_tax_assessment (1) | identifier / not_applicable | document_subject / not_applicable / not_applicable | 1/0 | **미등록(0% 승인)** | source-only / 0 / 0 |
| 454 | `payroll_payslip::income.payroll.allowances` | salary_statement (1) | money_or_itemized / KRW | applicant_debtor / period_scope / not_applicable | 1/1 | 등록 | source-only / 0 / 0 |
| 455 | `payroll_payslip::income.payroll.bonus` | salary_statement (1) | money / KRW | applicant_debtor / period_scope / applicant_debtor | 1/1 | 등록 | source-only / 0 / 0 |
| 456 | `payroll_payslip::income.payroll.employee` | salary_statement (1) | party_role / not_applicable | applicant_debtor / not_applicable / not_applicable | 1/0 | 등록 | source-only / 0 / 0 |
| 457 | `payroll_payslip::income.payroll.employer` | salary_statement (1) | party_role / not_applicable | employer / not_applicable / not_applicable | 1/0 | 등록 | income.employer / 0 / 0 |
| 458 | `payroll_payslip::income.payroll.gross_base` | salary_statement (1) | money / KRW | applicant_debtor / period_scope / applicant_debtor | 1/1 | 등록 | source-only / 0 / 0 |
| 459 | `payroll_payslip::income.payroll.hours_days` | salary_statement (1) | decimal_or_count / hours/days | applicant_debtor / period_scope / not_applicable | 1/1 | 등록 | source-only / 0 / 0 |
| 460 | `payroll_payslip::income.payroll.issue_date` | salary_statement (1) | date / not_applicable | issuer / document_issue_date / not_applicable | 1/0 | 등록 | source-only / 0 / 0 |

## 실행한 정적 테스트 / 원본 함수 단언
- 현재 최신 기준 **19/19 구조 불변식 일치**. 등록표 순서·원본 문서/패밀리 조인·슬롯·적용조건·typed·18계산/91입력·locator·복수행 금지·원본 함수 플래그·선택 보드 ID를 독립 기대와 비교. 미등록 조건을 통과 처리한 것이 아니라 미등록 6건을 정확히 발견한 검사 결과다.
- 원본 `hasPeriod()` **27/27 true**, `hasUnit()` **10/27 true**; 기존 Draft PR #51 비교 술어 **15/27 true**. 이 검사는 기간·단위가 실제 증명된 결과가 아니라 **요구 여부 분류**다.
| 검증 | 원본 입력(type; temporal; family) | 독립 기대(main/PR51/unit) | 관찰(main/PR51/unit) |
|---|---|:---:|:---:|
| T01 #446 tax_type | `category`; `not_applicable`; `local_tax` | 1/0/0 | 1/0/0 |
| T02 #451 tax_assessment_year | `year`; `not_applicable`; `local_tax` | 1/0/0 | 1/0/0 |
| T03 #457 employer | `party_role`; `not_applicable`; `payroll_payslip` | 1/0/0 | 1/0/0 |
| T04 #460 issue_date | `date`; `document_issue_date`; `payroll_payslip` | 1/1/0 | 1/1/0 |
| T05 #445 tax_period | `period`; `tax_period_year`; `local_tax` | 1/1/0 | 1/1/0 |
| T06 #455 bonus | `money`; `period_scope`; `payroll_payslip` | 1/1/1 | 1/1/1 |
| T07 #450 row_or_subtotal | `category`; `not_applicable`; `local_tax` | 1/0/0 | 1/0/0 |
- 위 7개의 예상/관찰 모두 일치. main 원본 함수는 실제 본문 호출; PR #51과의 비교 술어는 읽은 PR 함수 동치 로직의 격리 실행이며 PR 코드를 main에 배포하지 않았다.

## 소비처 단계 및 공백·결함 후보
1. **증거→DB Fact**: `db/schema.ts`의 `extraction_runs.sourceHash`, `extraction_records.ordinal`, `extracted_features.canonicalFieldId/rawValueJson/quote/bboxJson/sourceState/projectionKey`, `extraction_field_coverage` 스키마 경로 확인. 실제 27개 원천의 문서/페이지/복수행/단위/기간/납세자/급여대상 및 원본 해시·D1 재독은 미관찰. 원천의 `present/explicit_none/unobserved/null/0/NA/conflict`는 상이.
2. **typed/계산**: 정확 #457 `income.employer`만 선언; 91 입력과 직접 일치 0. #442 납부·이전 #436 체납, #443 가산·이전 #440 징수비, #444 과세표준·부과액, #454 수당/#455 상여/#458 기본급·다음 #461 실수령은 단순 합산 불가. #459 `hours/days`는 돈이 아님. #450 소계/상세 구분은 원천 검산용이며 합계 중복 사용 금지.
3. **법률**: 95 위험·50 규칙·46 예외에서 이번 정확 canonical 필수계약 0. `legal-evidence-criteria.ts` 정적 기본 seed `checks=[]`, 실제 운영 승인정책/관할/시행일/변호사 승인 불명. `#449 no_assessment_text`는 해당 문서 범위의 원문 후보이지 전체 채무 0원·완납/법적 면책 아님. **미등록 법률요건 자동 합격 0%.**
4. **서식·갈음·보정**: `OCR_DECLARED_FORM_TARGETS` 정확 token 0. 원본 `reviewScope(local_tax)`는 generic `EVIDENCE_INDEX`, `reviewScope(payroll_payslip)`은 D5103/D5110 **검토 후보**; 실제 서식 토큰/출력값·반복행·sourceVersion·공식 법원 적합성 미인증. `preapproval-correction-item-store.ts`의 `requiredCanonicalFieldIds`와 갈음 승인 코드 존재는 확인했으나 #441–460의 사건별 A←B+C/법원 실제 보정명령·접수증 소비는 미실행.
5. **P2 적용조건 공백 6개**: #448 `local_tax_assessment::jurisdiction_scope`, #449 `local_tax_assessment::no_assessment_text`, #450 `local_tax_assessment::row_or_subtotal_kind`, #451 `local_tax_assessment::tax_assessment_year`, #452 `local_tax_assessment::tax_notice_status`, #453 `local_tax_assessment::tax_object`. 정확 필드 적용조건 미등록으로 0% 인수. 자동 비해당/삭제/값 합산 금지.
6. **P1 검토 — PR #51 연도 증거 회귀 재현**: #451 `datatype=year`, `temporal_role=not_applicable`, family `local_tax` → main `hasPeriod=true`, Draft PR #51 `false`. 불필요 신원·분류 기간 경고를 줄이는 과정에서 과세연도 증거가 누락될 수 있음. 이전 r23 지적/기존 PR 유지, 법률의미·시간역할 변경은 실무자 승인까지 보류. [Draft PR #51](https://github.com/firmengine/firmengine/pull/51).
7. **P2 검토 — 지방세 family 후보 차이**: `reviewScope(local_tax)`→`EVIDENCE_INDEX` 후보만, `reviewScope(tax_public_arrear)`→`D5106,D5110` 후보. 실제 법률상 체납채권 분류·공식 서식·관할 정책은 승인 전이므로 자동 승격/프로덕트 변경 금지.

## 보드 A3 5개 ID의 부분검증 (모두 `[ ]`)
- **A3-AX-014**: #451 year의 시간역할, #459 hours/days, 급여 KRW 및 형식화 정책 후보. 모델 실제 추출·오인식 시험 없음.
- **A3-IT-006**: 19개 source-only와 원본 locator 보존 계약 확인; 실제 D1 Fact / R2 원문 해시 재독 미실행.
- **A3-DOC-008**: 지방세 13 ID/20 슬롯 2서류, 급여 7 ID/7 슬롯 1서류. 사건별 요구·갈음·보정 미검증.
- **A3-CALC-015**: 지방세 세목/기간/소계·상세 및 급여 항목 비합산 검토. 실제 월 계산/검산 재실행 안 함.
- **A3-LAW-015**: 법령50/위험95/예외46 정확 canonical 계약, 승인 seed/법원 시점/관할 미완. 실무자 검토 전 0% 합격.

## 인수 연결 및 다음 시작점
- 최근 관련 소스 blob SHA: idx=`27ecdddd208d`; intake=`ae6aa4fd2ef1`; defs=`9decab974e09`; fams=`9884b3fecf44`; supp=`63b2bf853acb`; app=`6076b26f782c`; logic=`de81bc3b8c46`; bindings=`60ee5c7762d5`; forms=`977de86ba698`; calc=`6924e3977caf`.
- 다음 **#461 `payroll_payslip::income.payroll.net_pay`~#480**, 다음 선임 **데이터담당자**. 초기 전체 693/693 정적등록과 구별해 심층 재감사 **460/693(66.4%)**, 잔여 233. A3 인수 최종완료 0/124. 고객자료/키 등 공개 Git 반영 없음; 운영 D1 마이그레이션/전자제출/법원 인가·사이트 배포 미실행.
