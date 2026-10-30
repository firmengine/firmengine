# FirmEngine AX — 사업소득 5단계: 법률 검토형 월별 순소득 계산·서식 연결

작성 기준: 2026-10-30 KST · GitHub main / ax-site만 수정. 다른 작업 에이전트가 수정한 법률·상담·최종서식 로직은 유지.

## 실제 구현한 다섯 가지

1. **담당자 검토용 월별 매출·경비 선택.** `business-monthly-workbench.ts`와 `business-identity-crosswalk.ts`의 원문 행 ID를 선택한다. 기업명·날짜·금액의 유사성만으로 다른 서류를 합치지 않는다. 각 매출 원문 행과 비용 원문 행은 문서·페이지·canonical ID·원문 금액·월별 기간·사업자등록 사실과 결합되어야 한다.
2. **편집 가능한 공식 근거.** `policy.business_income.monthly_reconciliation`을 기준정보 관리 레지스트리에 추가했다. 기본 정책은 rules=[]로 비활성화되어 있다. 법원·시행일·실제 공식 출처·비용 범주·부가세 처리 조건을 담당자가 제안하고 독립적으로 기준정보를 검토해야 한다. 전역 프롬프트에 법률 조항을 하드코딩하지 않는다.
3. **검토 제안과 변호사 승인 분리.** 사건 명령 `business.net.propose`는 담당자가 실제 OCR fact ID와 월·사업자·경비를 선택한다. `business.net.adopt`는 별도 `lawyer_review` 권한과 상세 검토 사유가 필요하며 동일인의 자기 승인을 차단한다. 합성 원본 사건을 실제 승인한 것으로 기록하는 것도 금지한다.
4. **원문↔계산 완전 추적.** `business-net-reconciliation.ts`는 매출−개별 비용을 BigInt로 계산한다. 한 달의 원문 금액·단위·비용범주·동일 사업체 관계·사건 기준일·공식 기준정보를 검토하고 원문 fact ID/버전/인용/문서 해시/기준 판본을 포함하는 basisSnapshot 영수증을 저장한다. 원문 PDF나 extracted_features의 원본 행을 수정하지 않는다. `CaseData.workflowState.businessNetReviews[]`에 제안·승인 기록, `CaseData.incomes[]`에 승인된 1개월 소득원만 추가한다.
5. **법률 계산과 서식 연결.** 정확히 현재 검증된 승인 영수증에 해당하는 소득원만 기존 `assessment.ts` 계산에서 사용할 수 있다. 원래 VAT 매출 source-only 행은 여전히 보존하되 같은 금액을 두 번 소득으로 합산하지 않는다. 기존 `case-calculation-features`와 `form-mapping.ts`의 월별 D5103 행 및 D5110 월변제/총변제/채권자 분배 수치에 연결한다. 사건 기준일·원문 사실·비용 범주·정책 변경 시 다시 미확정 처리한다.

## 운영 확인 위치

- 업무 페이지의 **사업소득 월별 원문·법률 검토** 패널: 담당자와 변호사 권한에 따라 검토 제안과 승인 폼이 분리된다. 공식 기준정보가 승인되지 않았으면 버튼이 비활성화된다.
- `GET /api/cases/{id}/data?view=business_source_audit`: 실제 원문 금액 출처, 기간, 연결 정보.
- `GET /api/cases/{id}/data?view=business_monthly_workbench`: 월별 누락, 매출·경비 구성, 중복·불일치.
- `GET /api/cases/{id}/data?view=business_identity_crosswalk`: 사업자등록과 원문 행별 동일사업자 검토 후보.
- `GET /api/cases/{id}/data?view=business_net_review_status`: 공식 기준 검토 및 영수증의 현재/만료 여부.

## 스키마·저장양식 호환

- 기존 canonical OCR 693개 / 사업 금액 11개 / 사업기간 6개 ID는 그대로 사용한다. 새 OCR ID를 임의 생성하지 않는다.
- 법률상 매출·순소득을 원문 `income.sales.gross_sales` 한 필드에 덮어쓰지 않는다. 인증된 유도 소득행은 `IncomeSource {id,kind:'business',gross,expenses,net,periodStart,periodEnd,periodMonths:1,amountBasis:'period_total',payerIdentityId,sourceCalculationRole:'period_income_observation',factIds}`이다.
- 기준정보 승인 영수증과 월별 승인 기록은 기존 `legal_reference_releases` 스냅샷 및 사건 `cases.payload.workflowState`를 사용한다. 이번 작업을 위한 D1 테이블 추가/마이그레이션은 없다. 원천수정에 의한 기존 source-watch·재계산·결과 무효화 흐름을 유지한다.
- 오래된 `workflowState` JSON에는 `businessNetReviews`가 없을 수 있으므로 선택 속성/기본 빈 배열로 처리한다.

## 검증 범위(완료와 미완료를 구별)

**추가한 합성 테스트**: 기본 정책 OFF, 검증된 비용범주 두 개, 월별 매출 300만원−경비 100만원·50만원=순소득 150만원, 12개월 동일 사업자등록 재사용/개별 금액 중복 방지, 원문값/단위 수정 시 승인 무효화, 기준정보 변경 시 무효화, 유효하지 않은 공제항목, 담당자·변호사 역할 분리, 월소득/총변제액/D5103·D5110 연계, 채권자 1명·재산 1건의 변제배분·청산가치 비교.

**실제로 실행한 격리 함수 검사**: 관리자 기준정보 validator 10/10, 사업 금액 원문 ↔ numeric 무결성 7/7(총 17/17 일치). 이는 원본 소스 함수 본문에서 타입표기만 제거하여 수행한 V8 테스트이며, URL 전역이 없는 격리 샌드박스의 테스트에서는 공식 URL 파서를 별도로 주입했다. 검증 결과를 Node 전체 회귀 성공이나 법원 인가로 표현하지 않는다.

**아직 미실행**: GitHub Actions(워크플로 실행 결과 없음), 저장소 전체 Node/TypeScript 타입 검사/회귀 테스트, 실제 운영 D1 읽기·쓰기·동시사건·서류 생성, 공식 D5103/D5110 실물 PDF 제출본 비교, 85종 실서류별 원문 인식률. 관련 테스트 소스는 커밋했으나 실행/인증 결과가 아니다.

## 필수 운영 인수 게이트

- 정식 운영 전에 실제 법원 시행일·판본을 담당 변호사가 검증한 `policy.business_income.monthly_reconciliation` 공식 근거를 기준정보에 승인/적재한다. 그 전에는 제안·승인 동작이 안전하게 차단되는 것이 정상이다.
- 운영 D1에서 `case_state`의 원문 fact·영수증 판본이 정확히 재계산에 도달하는지와 저장된 `case_calculation_features` 금액·상태가 법원 서식 토큰과 일치하는지 테스트한다.
- 동일 매출과 입금 중복, 동일 경비 영수증 중복, 부분월/연간 자료, 환급/세액, 계약자/사업자 불일치, 부양가족 및 변제예산 불일치를 최종 담당자가 대조해야 한다.
- 법원 제출/법률상 인가 여부는 이 기능이 자동 승인하지 않는다. 산술 일치만으로 사건 전체의 실무 적합성을 보장하지 않는다.
## 변호사 승인 이후의 재검토 경계

사업소득 월별 자료가 새로 계산객체에 추가되면 사건의 원천 계산기준이 변경되므로 기존 승인(대표 소득기간, 법률 적용판본, 현재가치, 자산 평가, 채권 배분 검토)을 자동으로 재사용하지 않는다. `business.net.adopt`는 변호사가 **해당 월의 매출·경비·사업자 관계**를 승인했다는 의미이지, 사건 전체의 회생 인가나 최종 변제계획을 승인했다는 의미가 아니다. 기존 `resetReviews` 이후 D5103의 `approved_monthly_income` 등 최종 검토 필요 필드는 다시 검토 전 미확정으로 남는다.

### 실행하지 못한 최종 인증

신규 테스트에는 12개월 검증 소득 150만원, 월 변제금 100만원, 변제기간 36개월, 채권자 원금 1억원 및 예금 청산가치 100만원을 연결한 계산/서식/원장 대조 사례가 포함돼 있다. **테스트가 GitHub main에 저장된 사실과 테스트 실행 성공은 다르다.** 전체 TypeScript 빌드, 운영 DB 쓰기·다시 읽기, 법원 공식 제출서식 PDF 실물 검수는 아직 별도의 통합 실측이 필요하다.
