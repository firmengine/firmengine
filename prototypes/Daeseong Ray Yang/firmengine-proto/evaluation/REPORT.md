# 독립 평가 결과

평가 대상: 제공된 개인사업자 샘플 1건. 제출본은 생성 입력에서 분리했습니다.

- 생성 입력: 증빙 92페이지 / 제출본 holdout: 24페이지 / 행정문서 제외: 2페이지
- 평가 모델: `gpt-6-luna`, Responses API `store: false`
- 정답 추출: 별도 요청·프롬프트로 수행. 전문가가 확정한 법률 정답은 아닙니다.

## 필드 비교

- 비교 가능한 목표: 21개
- 생성값 있음: 4개
- 일치: 3개 / 차이: 1개 / 보류·미생성: 17개
- 전체 비교 대상 기준 일치: 3/21
- 생성된 값 기준 일치: 3/4

| 필드 키 | 제출본 페이지 | 비교 결과 | 법적 인정·계획 판단 영향 | 산출물 값 확인 |
|---|---:|---|---|---|
| client_name | 1 | match | 없음 | value_present_with_label |
| monthly_income | 69 | withheld_or_missing | 있음 | not_compared |
| household_size | 69 | withheld_or_missing | 없음 | not_compared |
| recognized_living_cost | 69 | withheld_or_missing | 있음 | not_compared |
| debt_principal_total | 4 | withheld_or_missing | 없음 | not_compared |
| debt_interest_total | 4 | withheld_or_missing | 없음 | not_compared |
| debt_total | 4 | withheld_or_missing | 없음 | not_compared |
| assets_total | 33 | withheld_or_missing | 없음 | not_compared |
| bank_balance | 34 | match | 없음 | value_not_found_with_label |
| insurance_surrender | 33 | match | 없음 | value_present_with_label |
| housing_deposit | 35 | different | 없음 | value_present_with_label |
| business_deposit | 35 | withheld_or_missing | 없음 | not_compared |
| vehicle_value | 33 | withheld_or_missing | 없음 | not_compared |
| real_estate_value | 33 | withheld_or_missing | 없음 | not_compared |
| monthly_disposable_income | 23 | withheld_or_missing | 있음 | not_compared |
| repayment_months | 23 | withheld_or_missing | 있음 | not_compared |
| monthly_payment | 31 | withheld_or_missing | 있음 | not_compared |
| total_repayment | 31 | withheld_or_missing | 있음 | not_compared |
| repayment_rate | 32 | withheld_or_missing | 있음 | not_compared |
| liquidation_value | 32 | withheld_or_missing | 있음 | not_compared |
| monthly_trustee_fee | 31 | withheld_or_missing | 있음 | not_compared |

## 채권자와 실제 산출물

- 채권자 목표 행 수: 10
- 채권자 원금·이자 비교: {"withheld_or_missing": 20}
- 실제로 열어 본 DOCX/XLSX: 7개
- 산출물 확인 결과: {"value_present_with_label": 3, "not_compared": 17, "value_not_found_with_label": 1}
- holdout 페이지 인용 발견: 없음

- 생성 입력 페이지 목록: 확인됨
- 생성 입력의 holdout 페이지: []

- 예정된 증빙 중 입력에서 빠진 페이지: []

## 해석

금액 차이는 원본 추출 오류, 기준기간 차이, 법률적 인정 판단을 나누어 검토해야 합니다. 미확인 값을 보류한 결과를 오답이나 성공으로 숨기지 않았습니다.

이 평가는 한 사건의 독립 비교입니다. 전체 사건에 대한 정확도, 법원 제출 적합성, 업무시간 20% 단축을 입증하지 않습니다. 실제 양식과 전문가 검수 및 시간 비교가 추가로 필요합니다.

개인정보와 목표·생성 금액은 보고서에 포함하지 않았습니다. 자세한 비교 자료는 Git에서 제외된 `.runtime/evaluation/`에만 남습니다.
