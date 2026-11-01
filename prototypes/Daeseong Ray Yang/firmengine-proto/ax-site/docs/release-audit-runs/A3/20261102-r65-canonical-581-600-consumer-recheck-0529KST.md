# FirmEngine A3 r65 — canonical OCR #581–600 소비처 심층 재감사 (2026-11-02 KST)

## 범위·실제 근거·인증 범위
- 사전/작성 직전 조회 GitHub main SHA: 8f038643f3a0bc695efc8bc4866921e03a0c295b. 변경 허용 경로: prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/ 하위만. 직전 r64 #561–580 이후 #581–600 20개를 실제 최신 인덱스로 조회. 최초 동일 범위 r30 영수증도 대조.
- 이번 역할 순환: AX담당자 → 사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자. 다음 IT부터. A3 전체 체크 ID: IT20/DOC20/CALC20/LAW22/DATA22/AX20=124, 완료 [x] 0.
- 사전 확인 최근 main 커밋: A2 r65 8f038643/7cd1e975, A1 r65 c77eed3d/11548faf, A4 r64 cb5a3c28. Draft PR #51(기간검사), #149(보정ID), #155(부동산 Fact/자산 바인딩) 모두 open/draft/미병합. 다른 에이전트 코드·보드 내용 덮어쓰지 않음.
- 검증 소스 blob SHA: canonical 27ecdddd208de82a2f5c675e7482485e3a8838c2; base family 9884b3fecf44643fefcdc4a421ed66ffc5477b3a; shared 9decab974e0909ae24ad927bdfe241d75b71f3a9; supplements 63b2bf853acb2e9620a6fb72377dc278ff3cd2a5; applicability 6076b26f782c4643a21a7b2f1a8f6261bb588b68; lineage de81bc3b8c460b8a4dde3fda9e13087e619e74ff; binding 60ee5c7762d52b72a165b4f4f8214680eb98f148; OCR form targets 977de86ba698bd805cc6b95d1384e3b49d0dbb4c; legal evidence seed 6c0b94535700d4fa4d356f8a91d5b9440b5ac52a.
- 관련 실제 코드/테스트 읽기: lib/shared-document-catalog.ts, feature-lineage-audit.ts, canonical-field-binding.ts, material-calculation-source-gate.ts, reference-decision-tables.json, template-token-catalog.json, document-substitution.ts, substitution-policy.ts/json, approve-document-substitution.ts, db/schema.ts, tests/feature-lineage-audit.test.ts, tests/document-substitution.test.ts, 기존 r30/r64 영수증. 테스트 파일의 존재는 이번 Node 실행/CI 합격이 아니다.
- 실 실행: GitHub 원본 JSON·TS 본문을 Code Mode V8에서 정적 조인/조건 함수 격리 실행. 고객 원본 PDF/OCR·D1 Fact/typed 저장/재독·실제 산식·전체 Node CI·staging D1/R2/Cron·공식 법원 Word/e-form/법률 승인·운영배포/전자제출은 미관찰·미실행.

## 실제 독립 검증 수치
- 원본 JSON 전체 조인 21/21 구조 불변식 일치: 693 canonical(중복0), 85 공개서류, 48 OCR 패밀리, 141 document×family route, 1,808 document×family×field 슬롯, 고아/동일 route 내 필드 중복 0. 이번 20개 ID/27 route 슬롯/서류 5/패밀리 6, locator 원천앵커 선언 27/27, recordPolicy.noCrossRecordBorrowing 27/27.
- 정확 source applicability 등록 1/20(#581), 미등록 19/20(#582–600) 또는 26/27 route 슬롯. **미등록/미승인 요건 0% 합격**: 원문 source-only는 유지, 자동 비해당·0원/삭제 금지. 직접 typed 2/20 (#599 → income.gross; #600 → income.expenses), material source contract 0/20, 내부 form token exact 2/20 (#599 D5103.month.revenue, #600 D5103.month.expense); 실제 빈 템플릿 토큰 catalogue 둘 다 존재(2/2). 계산모듈18·선언 입력91, 이 두 원문 Fact의 실제 계산 입력검증/인정은 미실행.
- 법률 위험95, 법률 규칙50, 법률 예외46 실제 파일 기준 재확인; 이번 20 canonical 정확 리터럴 법률 승인 계약 0/20, LEGAL_EVIDENCE_POLICY_SEED.checks=[]이고 운영 편집 승인 정보 미조회. law/rule/exception의 이름·문서 후보만으로 법률 합격 취급 안 함.
- 실제 feature-lineage-audit.ts의 hasPeriod(role,family), hasUnit(datatype)를 이 27 슬롯마다 V8 실행: 기간 true 12/27, 단위 true 4/27. reviewScope 원본에서 확인한 후보: real_property_valuation→D5101/D5110; business_assets_liabilities→D5101/D5110; litigation_enforcement→D5100/D5105; identity_residence_record→D5100/D5103/D5105; pension_contribution_benefit→EVIDENCE_INDEX; payroll_payslip→D5103/D5110. 후보는 직접 토큰/공식 제출 적합성과 다르다.

## #581–600 정확 ID별 문서·페이지·복수행·단위·대상·기간과 소비 선언
P/U는 원본 hasPeriod/hasUnit 술어 true인 슬롯 수. 각각의 선언된 required_source_anchor는 문서 hash/page/quote/bbox·행 식별과 주체·기간 연계를 요구하지만 실제 원문/페이지/D1 행의 충족 여부는 미관찰. source-only는 증거·검산·역질문·법적 근거 검토를 위한 보존 대상.
| # | canonical OCR ID | 공개문서@추출 family | 타입/단위 | 대상/시간역할 | P/U | 적용조건 | 현재 정확 소비 선언 |
|---:|---|---|---|---|---:|---|---|
| 581 | real_property_valuation::valuation_method | real_estate_valuation@real_property_valuation | string / not_applicable | owner_legal / not_applicable | 0/0 | 등록 | source-only |
| 582 | receivable_collectability::collected_amount | receivable_collectability@business_assets_liabilities;@litigation_enforcement | money / source currency/unit | document_subject / not_applicable | 0/2 | 미등록 | source-only |
| 583 | receivable_collectability::collection_status | receivable_collectability@business_assets_liabilities;@litigation_enforcement | category / not_applicable | document_subject / not_applicable | 0/0 | 미등록 | source-only |
| 584 | receivable_collectability::counterparty_status | receivable_collectability@business_assets_liabilities;@litigation_enforcement | string / not_applicable | document_subject / not_applicable | 0/0 | 미등록 | source-only |
| 585 | receivable_collectability::demand_date | receivable_collectability@business_assets_liabilities;@litigation_enforcement | date / not_applicable | document_subject / source_date_time_or_period | 2/0 | 미등록 | source-only |
| 586 | receivable_collectability::receivable_id | receivable_collectability@business_assets_liabilities;@litigation_enforcement | identifier / not_applicable | document_subject / not_applicable | 0/0 | 미등록 | source-only |
| 587 | receivable_collectability::security_reference | receivable_collectability@business_assets_liabilities;@litigation_enforcement | id_list_or_text / not_applicable | document_subject / not_applicable | 0/0 | 미등록 | source-only |
| 588 | receivable_collectability::uncollected_reason | receivable_collectability@business_assets_liabilities;@litigation_enforcement | string / not_applicable | document_subject / not_applicable | 0/0 | 미등록 | source-only |
| 589 | resident_registration::address_change_date | resident_registration@identity_residence_record | date / YYYY-MM-DD | document_subject / source_date_time_or_period | 1/0 | 미등록 | source-only |
| 590 | resident_registration::historical_address | resident_registration@identity_residence_record | address / not_applicable | document_subject / not_applicable | 0/0 | 미등록 | source-only |
| 591 | resident_registration::residence_history_period | resident_registration@identity_residence_record | period / not_applicable | document_subject / not_applicable | 0/0 | 미등록 | source-only; period flag false |
| 592 | retirement_estimate::estimated_retirement_date | retirement_estimate@pension_contribution_benefit | date / not_applicable | document_subject / source_date_time_or_period | 1/0 | 미등록 | source-only |
| 593 | retirement_estimate::payout_condition | retirement_estimate@pension_contribution_benefit | string / not_applicable | document_subject / not_applicable | 1/0 | 미등록 | source-only; period flag true |
| 594 | retirement_estimate::retirement_scheme | retirement_estimate@pension_contribution_benefit | category / not_applicable | document_subject / not_applicable | 1/0 | 미등록 | source-only; period flag true |
| 595 | retirement_estimate::service_period | retirement_estimate@pension_contribution_benefit | period / not_applicable | document_subject / source_date_time_or_period | 1/0 | 미등록 | source-only |
| 596 | retirement_estimate::transfer_history | retirement_estimate@pension_contribution_benefit | text_or_list / not_applicable | document_subject / not_applicable | 1/0 | 미등록 | source-only; period flag true |
| 597 | salary_statement::employer_confirmation_status | salary_statement@payroll_payslip | enum / not_applicable | document_subject / not_applicable | 1/0 | 미등록 | source-only; period flag true |
| 598 | salary_statement::employer_signature_date | salary_statement@payroll_payslip | date / YYYY-MM-DD | document_subject / source_date_time_or_period | 1/0 | 미등록 | source-only |
| 599 | salary_statement::gross_total | salary_statement@payroll_payslip | money / KRW | document_subject / not_applicable | 1/1 | 미등록 | income.gross; D5103.month.revenue |
| 600 | salary_statement::total_deductions | salary_statement@payroll_payslip | money / KRW | document_subject / not_applicable | 1/1 | 미등록 | income.expenses; D5103.month.expense |

## V8 원본 술어와 갈음 정책 독립 기대값·관찰 결과
- 필드 단위 기간 검사 독립 기대는 datatype=period 또는 명시 temporal role에서 true, 그렇지 않으면 false(법원 공식 기준이 아닌 검증 휴리스틱). 원본 hasPeriod 12개 대표 시험에서 5/12 기대 일치, **7/12 차이**: #591 period/role=not_applicable → 기대 true·관찰 false(기간 누락 후보), #593/#594/#596/#597/#599/#600 role=not_applicable → 기대 false·관찰 true(비기간 필드 기간 검사 과잉 후보). #585/#589/#592/#595/#598은 true/true. 필드 규칙과 문서 단위 기간을 혼동할 수 있음. 기존 Draft PR #51의 family regex 수정은 #591 등 회귀 분석 전 병합/변경 금지.
- 서울/부산 salary_withholding→salary_statement(+salary_bank_statement) 갈음 정책 4 route는 전부 employerSignatureRequired=true. 원본 substitution-policy.ts의 matchPublishedSubstitutionRoute 함수 본문에서 callback의 TS 타입표기 1개만 격리 제거하고, JSON 원본 정책 사용·정책 검증기만 합성 stub하여 9개 branch case 시험: **9/9 기대 일치**. 입력/기대/관찰: 서명 true→seoul.salary_withholding.salary_statement 동일; 서명 false→null/null; source ID 상충→null/null; 법원 상충→null/null; 예외사유 짧음→null/null; 6개월+통장→seoul.salary_withholding.salary_statement_plus_bank 동일; 5개월+통장→null/null; source ID 비움→null/null; 원본문서 틀림→null/null. 전체 reconcile/실제 SQL 및 서명 사실 검증 시험 아님.
- approve-document-substitution.ts는 직원 proposal.employerSigned boolean을 수용. document-substitution.ts는 verified/accepted Fact, 원문 fingerprint, 기간, 법원 정책을 별도 대조한다. 그러나 두 함수에서 #597 salary_statement::employer_confirmation_status 및 #598 salary_statement::employer_signature_date의 exact canonical ID를 boolean과 직접 대조하는 선언/로직은 확인되지 않았다. 실제 갈음 우회·법원 승인 오류로 확정하지 않고 실문서 서명 Fact↔담당자 확인↔같은 발급인·기간 연결에 대한 P2 검증 후보로 기록.

## 소비처 공백·역질문·법률 및 실무자 검토
1. #582–588 7 canonical은 한 공개문서 receivable_collectability에 두 추출 family로 14 route 슬롯이 있다. 복수 family는 채권 2건의 근거가 아니다. #582 실제 회수액과 채권 원금·시가·잔여채권/청산가치 구분, 상대방/회수기준일/채권 ID/담보 참조 대조가 필요하다. 단위가 source currency/unit이므로 무단 KRW 환산·합산 금지.
2. #589–591 거주 변동일·이전 주소·이력기간은 서로 다른 원천사실. 특정 주소 변동기록만으로 전체 관할/거주기간 판단 금지. #591의 datatype=period와 temporal_role=not_applicable 충돌은 정책 관리자가 정정 필요 여부 검토.
3. #592–596 퇴직 예정일·지급 조건·제도·근속·이전 이력은 현재 지급액·자산 귀속·현금화 가능액과 동의어 아님. pension_contribution_benefit의 reviewScope가 EVIDENCE_INDEX만 반환해도 무용 아님. 미래 인출 제한/명의/귀속과 법률 보호 근거는 변호사 검토.
4. #597/#598 사용자 서명 상태·일자는 문서/페이지/당사자/발급인/원문을 통해 boolean reviewer decision과 검산 필요. 직접 typed0·form token0이더라도 급여증빙 갈음·원천 재요청에 보존. source-only 미관찰/마스킹/명시적 없음/0/비해당·상충을 하나의 통과상태로 합치지 않음.
5. #599 급여총액 및 #600 공제총액은 원문 KRW, income.gross/expenses typed 후보 및 내부 D5103 토큰에 연결된다. #461 실수령액, 지급기간/수령인, 원천징수/근로소득 포함 여부를 검토하기 전 같은 월 소득으로 단순 산술 합산/상쇄 금지. 법원 인정 가용소득과 구별.
6. 95위험/50법률규칙/46예외/공식 법원 서식·보정/갈음 정책은 현재 후보·관리형 선언과 승인되어 실제 쓰이는 사실을 구별해야 한다. 실무자 승인, 관할/시행일, 원본 SourceHash, DB Fact/typed, 계산/서식 E2E가 없으므로 승인 계약 0% 및 최종 인수 0건.

## A3 중앙 보드 연결 — 5개 전부 [ ] 부분검증 유지
- A3-AX-019: 채권 회수액·퇴직 예정치·급여총액/공제 등 의미 혼용 금지 선언, 실 AX 출력 미검증.
- A3-DOC-012: 서울/부산 갈음 정책 4개 서명 필수와 #597/#598 exact Fact 연결 공백, 직원 실승인 미관찰.
- A3-CALC-001: #599/#600 직접 typed 후보 2개/내부 form token 2개; 실수령/귀속월/18개 계산 실재 호출 미실행.
- A3-LAW-014: 채권 회수/퇴직재산/근로소득 법률 인정, 관할·시행일·실제 공식 서식/변호사 검토 미승인.
- A3-DATA-019: #582–600 19 ID·26 슬롯 source applicability 미등록(0% 승인), 문서·페이지·복수행 분리 선언 27/27.
- 본회차는 코드 수정 없이 원천/테스트/정책 갭을 보존했다. #591 시간역할·기간검사는 Draft PR #51과 관련해 현장 확인/중복 PR 회피가 필요하고, 법률·계산 의미 변경은 사람승인 전 불가. main 기존 파일·제품 로직·운영 DB/배포/법원 제출 변경 없음.

**다음 시작**: canonical #601 secured_claim_security::actual_payoff → #601–620, 다음 IT담당자부터 순환. 누적 심층 재감사 600/693 (86.6%), 잔여 93개, A3 124 체크 ID 최종 인수 0개. Node 전체 CI·staging D1/R2/Cron·공식 서식·변호사 승인·사이트 배포는 모두 미인증.
