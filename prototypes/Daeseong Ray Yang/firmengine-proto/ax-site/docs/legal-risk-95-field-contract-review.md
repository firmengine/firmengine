# FirmEngine 법률 위험 95건 — OCR 근거 피처 계약 전수 조사

대상은 `lib/risk-catalog.json` 현재 95개. 이 중 **88개는 필수 피처 계약(`required_features`)이 빈 배열**이다. 이름·설명만으로 누락이 없는지 또는 법률상 통과했다고 판단할 수 없다. 향후 각 체크별 적용 법령·관할·기간·대상·부정적 증거·서류 대체요건을 전문가가 승인해야 한다.

| 위험 ID | 명칭 | 분류 | 현재 required_features | 연관 법률 규칙 | 조치 |
| --- | --- | --- | --- | --- | --- |
| DOC-01 | 개인회생절차개시신청서 | common_documents | **미정의** | KR-PR-011 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-02 | 개인회생채권자목록 및 필요한 부속명세 | common_documents | **미정의** | KR-PR-010 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-03 | 재산목록 | common_documents | **미정의** | KR-PR-027 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-04 | 수입 및 지출에 관한 목록 | common_documents | **미정의** | KR-PR-020,KR-PR-021 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-05 | 급여소득자·영업소득자 소명자료 | common_documents | **미정의** | KR-PR-004,KR-PR-005 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-06 | 진술서 | common_documents | **미정의** | KR-PR-011 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-07 | 변제계획안 및 변제예정액표 | common_documents | **미정의** | KR-PR-041,KR-PR-043,KR-PR-047 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-08 | 자료제출목록에 기재된 자료 및 제출현황 정리 | common_documents | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DOC-09 | 주민등록등본 | common_documents | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DOC-10 | 주민등록초본, 가족관계·혼인관계증명서 | common_documents | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DOC-11 | 본인 지적전산자료조회결과서·지방세 세목별 과세증명서 | common_documents | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DOC-12 | 국민건강보험 자격득실확인서·국민연금 산정용 가입내역확인서 | common_documents | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DOC-13 | 소득세 등 납부증명, 소득금액증명 등 | common_documents | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DOC-14 | 재직증명서·고용 확인서 등 | common_documents | `income_source.employer` | KR-PR-004,KR-PR-014 | 필드 ID/대상·기간·자료 확인 필요 |
| DOC-15 | 근로소득원천징수영수증 | common_documents | `income.monthly_net`, `income.period`, `income.recurring_evidence[]` | KR-PR-014,KR-PR-015 | 필드 ID/대상·기간·자료 확인 필요 |
| DOC-16 | 사업자등록 및 매출·비용·소득 자료 | common_documents | `income.business_revenue`, `income.necessary_cost`, `income.period` | KR-PR-016,KR-PR-018 | 필드 ID/대상·기간·자료 확인 필요 |
| DOC-17 | 채권자별 부채증명·계약·판결 등 | common_documents | **미정의** | KR-PR-010,KR-PR-013 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-18 | 재산별 잔고·시가·권리 확인 | common_documents | **미정의** | KR-PR-027,KR-PR-032 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-19 | 신청일 전 10년 이내 신청 사건 관련서류 | common_documents | **미정의** | KR-PR-009 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-20 | 신용회복위원회·캠코 등 채무조정 자료 | common_documents | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DOC-21 | 인지·송달료·예납금 납부 확인 | common_documents | **미정의** | KR-PR-046 | 필드 계약 작성 전 자동 통과 금지 |
| DOC-22 | 위임장 등 대리관계 자료 | common_documents | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-01 | 본인 소유 부동산 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-02 | 전·월세 거주 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-03 | 가족·지인 집 무상거주 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-04 | 차량·이륜차·건설기계 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-05 | 예금·적금·청약·외화 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-06 | 보험 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-07 | 증권·펀드·비상장주식·출자금 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-08 | 가상자산 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-09 | 일용·프리랜서·플랫폼 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-10 | 최근 이직·휴직·복직·신규취업 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-11 | 사업운영 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-12 | 폐업 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-13 | 퇴직금·퇴직연금·공제회 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-14 | 연금·공적 급여 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-15 | 가족·지인 채무 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-16 | 보증·연대채무·구상금 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-17 | 채권양도·추심회사 변경 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-18 | 국세·지방세·사회보험 미납 | conditional_evidence | **미정의** | KR-PR-033 | 필드 계약 작성 전 자동 통과 금지 |
| COND-19 | 양육비·직원임금·퇴직금 | conditional_evidence | **미정의** | KR-PR-034,KR-PR-037 | 필드 계약 작성 전 자동 통과 금지 |
| COND-20 | 소송·지급명령·압류·경매 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-21 | 이혼·재산분할 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-22 | 상속 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-23 | 전세사기·보증금 미반환 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-24 | 최근 매각·증여·고액 출금 | conditional_evidence | **미정의** | KR-PR-030 | 필드 계약 작성 전 자동 통과 금지 |
| COND-25 | 추가 교육·의료·주거비 | conditional_evidence | **미정의** | KR-PR-023,KR-PR-024,KR-PR-025 | 필드 계약 작성 전 자동 통과 금지 |
| COND-26 | 해외 재산·채무·근무 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-27 | 대여금·매출채권·공탁금·환급금·보상금 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| COND-28 | 기타 경제적 권리 | conditional_evidence | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-01 | 배우자 토지·세금 자료 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-02 | 본인 예금 거래 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-03 | 보험 가입·증권 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-04 | 배우자 부동산 시가 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-05 | 부동산 매매대금 사용 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-06 | 배우자 임대차 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-07 | 과거 주거지 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-08 | 폐업 정산 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-09 | 무상거주 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-10 | 최근 이직·현 주거 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-11 | 10년 내 과거 신청 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| ORDER-12 | 개명·배우자 | additional_court_orders | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-01 | R01 정기 송금 상대방이 채권자목록에 없음 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-02 | R02 신용조회에는 없지만 독촉·소송 문서가 있음 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-03 | R03 예금조회 0원인데 이자 출금이 반복 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-04 | R04 회사·가족의 대출이 본인에게 청구됨 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-05 | R05 보험료 출금은 있으나 보험재산 없음 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-06 | R06 증권사·거래소로 이체했는데 잔고자료 없음 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-07 | R07 지방세·자동차보험·담보이자와 재산목록 불일치 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-08 | R08 최근 이사했는데 종전 보증금 행방 불명 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-09 | R09 매각대금 입금 이후 큰 현금 인출 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-10 | R10 배우자·가족에게 큰 금액 또는 명의 이전 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-11 | R11 폐업했는데 사업재산 0으로 신고 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-12 | R12 장기근속·최근 퇴직인데 퇴직 관련 자료 없음 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-13 | R13 부모·배우자 사망 또는 상속분할이 확인됨 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-14 | R14 최근 이혼·재산분할 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-15 | R15 해외송금·외국근무·해외투자 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-16 | R16 소득신고보다 입금·생활지출이 큼 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-17 | R17 앱·플랫폼 거래 후 아직 정산되지 않음 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-18 | R18 세금·양육비·직원급여·벌금 미납 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-19 | R19 과거 사건 목록과 현재 목록 다름 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-20 | R20 본인 외 명의 재산에 본인 대금이 사용됨 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-21 | R21 기준일 사이에 잔액 급변 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-22 | R22 추가생계비 영수증이 사업경비에도 포함 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-23 | R23 최근1년 무차입이라고 했으나 카드 현금서비스 존재 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| DETECT-24 | R24 외상으로 빌려준 돈·공탁·환급을 잊음 | omission_detection | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| POLICY-OUTFLOW-500K | 50만원 이상 출금·이체 사용처 | explicit_product_extensions | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| TAX-CLASSIFICATION | 조세·사회보험 체납의 개별 법적 분류 | explicit_product_extensions | `tax_arrears.tax_type`, `tax_arrears.period`, `tax_arrears.due_date`, `tax_arrears.priority_status`, `tax_arrears.estate_claim_status`, `tax_arrears.non_discharge_ground` | KR-PR-033,KR-PR-037 | 필드 ID/대상·기간·자료 확인 필요 |
| INCOME-MULTIPLE | 복수 직장·영업·부수입 누락 확인 | explicit_product_extensions | `income.sources[]` | KR-PR-017,KR-PR-020 | 필드 ID/대상·기간·자료 확인 필요 |
| ASSET-VALUATION | 재산별 기준일·지분·시가·담보·보호근거 | explicit_product_extensions | `assets[].ownership_share`, `assets[].gross_value`, `assets[].valuation_as_of`, `assets[].valuation_method` | KR-PR-027,KR-PR-031,KR-PR-032 | 필드 ID/대상·기간·자료 확인 필요 |
| ASSET-DISPOSAL | 처분재산의 대금과 대체재산 중복 검토 | explicit_product_extensions | `assets[].disposal_history[]`, `assets[].successor_asset_ids` | KR-PR-030 | 필드 ID/대상·기간·자료 확인 필요 |
| CASE-2013MA668 | 보정 응답과 해소 구분 | public_case_observations | **미정의** | KR-PR-049 | 필드 계약 작성 전 자동 통과 금지 |
| CASE-2013MA101 | 최근 채무 비율만으로 자동 기각 금지 | public_case_observations | **미정의** | KR-PR-039 | 필드 계약 작성 전 자동 통과 금지 |
| CASE-2010MA1179 | 편파변제의 회복·계획수정 검토 | public_case_observations | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |
| CASE-2024DA221042 | 인가 후 전액 대위변제의 누락 보증인 예외 | public_case_observations | **미정의** |  | 필드 계약 작성 전 자동 통과 금지 |

기존에 정의된 필요 피처 **19개의 고유 키**도 OCR 표준 canonical ID와 직접 동일하다고 인증되지 않았다. 95개 법률 항목 중 0개를 자동 인가·제출 판정으로 승격할 수 있다.
