# A2 3차 — D5103 월별 증빙행 전체 누락·계산 SQL 재독·91 입력 계약 감사

- 2026-10-30 15:13 KST부터, 최초 GitHub **main** `5443783149589f485fcfd87cdc984e2902c57142` 확인. 기존 A2 13:17/14:11 회차를 이어받았고, 직전 A1/A4/A3 커밋 및 미병합 PR #13·#18·#19·#20을 읽어 중복 수정하지 않았다.
- 범위: 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 본 회차 IDs: **A2-IT-015, A2-DATA-016, A2-CALC-021, A2-DOC-015, A2-LAW-020**. IT→데이터→계산사무장→서류담당자→변호사 관점 5개. 체크박스 **전부 [ ] 유지 / 최종 제품 인수 0건**.
- 코드 최초 blob: `lib/document-preflight.ts=dc771c0ff0497d24df19478b0366ebbb397bfbf2`; `tests/form-month-calculation-integrity.test.ts=7bbf112a9460010301868b68158c95512a64b835`; 계산 store `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0011_case_calculation_features.sql=0caa359d250dce45765d269d271ad63170ec3efa`.

## 1. P1 재현 — 확정 또는 관측 월소득이 있어도 D5103 월행 0개인 최종본의 내부 준비도 'ready'

- A2-DOC-015, A2-LAW-020. 현재 `lib/document-preflight.ts::evaluateDocumentPreflight`는 D5103 `rows.month`의 **존재하는 행만** 기간과 금액을 검사한다. `lib/legal-form-field-policy.json`에서 `D5103.month.period`는 **조건부(행이 있는 경우)**이고 다른 토큰 다수는 요구 여부 미승인으로 경고에 그친다.
- 합성 JSON (실제 고객 자료 전혀 사용 안 함): `{formCode:"D5103",mode:"final",bindings:{scalars:{client_name:"Synthetic",approved_monthly_income:"2,400,000"},rows:{month:[]}}}`. 템플릿 SHA와 평가ID는 합성 일치값.
- **독립 기대**: 월 소득이 존재하지만 구성 월별 행을 한 건도 확인할 수 없으므로 최종본은 `blocked`, 초안은 경고. 원문 증빙/법원 제출 여부를 임의 확정하지 않는다.
- **기존 실제 관찰**: GitHub 현재 main 함수 본문을 가져와 타입 표기만 제거한 **V8 격리 원본문 함수**에서 `status:"ready",blockers:[]` (대신 official-requiredness 미검증 경고만 발생). **실제 결함 재현**. 실제 타입·계산엔진·공식 DOCX 바이트는 이 격리 테스트에 포함되지 않는다. V8은 최소 D5103 contract 스텁을 사용하고 법적 산식 이슈 응답은 빈 배열, 해시 digest만 모의했다.
- **개선**: [Draft PR #21](https://github.com/firmengine/firmengine/pull/21), 브랜치 `audit/a2-d5103-empty-month-row-gate-20261030-1513`. `lib/document-preflight.ts`에 `D5103_MONTH_ROWS_MISSING` 추가. `approved_monthly_income` 또는 관측 `monthly_income`이 숫자이고 월행이 0개면 최종본만 blocker, 초안 warning. null·미확정은 숫자 0으로 채우지 않는다. 기존 행 오류는 그대로 `D5103_MONTH_EVIDENCE_UNRESOLVED`.
- 변경 후 동일 격리 함수 검사: 양의 월소득·빈 월행 최종본 **blocked**; 초안은 blocker 없이 경고; 월소득 미확정/행 0인 경우 새로운 차단 없음; 정상 `2026-10` 월행은 신규 오류 없음; 연간 기간을 단일 월행으로 위조한 경우 기존 차단 유지. **5/5 분기 의도 일치**(초안은 warning 기준). 원본 5개 가운데 P1 반례 1건을 확실히 재현; 다른 경계 4건은 이전 구현이 이미 정상.
- PR에서 `tests/form-month-calculation-integrity.test.ts`에 **Node 회귀 테스트 소스 4개를 추가**했으나, **Node 프로젝트 직접 실행/CI 미실행**이다. 별도 Draft로 두고 관련 공인 변호사/서류담당자 승인 전 main 병합하지 않았다. 이 수정은 **공식 법원 서식의 법률상 필수 항목 규정이 아닌 내부 원천누락 검증**이다.

## 2. A2-IT-015: 저장형식 SQL 합성 재독/경계

- `db/schema.ts` 및 `drizzle/0011_case_calculation_features.sql`와 `lib/case-calculation-feature-store.ts`, `tests/case-calculation-feature-store.test.ts`를 대조했다. `case_calculation_runs` 입력/참조판본/원본 해시, `case_calculation_features` JSON·원화 문자열·status·출처/산식, `case_calculation_heads` current 포인터를 별도 보존하는 구조를 확인했다.
- Python `sqlite3.connect(":memory:")` 격리 SQLite에서 **0011의 세 CREATE TABLE·두 INDEX 열 정의와 실제 `persistCaseCalculationFeatures` head-CAS SQL을 동일하게 구성하여** 단일 합성 사건 `synthetic-a2-1513`, `dataVersion=1,revision=1`을 INSERT/SELECT했다. `case_data_change_state`와 `cases`는 검사에 필요한 최소 구성만 모형화했다. 전체 Drizzle 마이그레이션/실제 D1 adapter/Node 원본문 호출이 아니다.
- **독립 기대→실측 9/9 일치**: (1) `"0"`가 value_json 문자열과 value_won `"0"`으로 유지, (2) 진짜 null은 `value_json=null` JSON 문자열/SQL `value_won=NULL,status=missing`, (3) 현재 버전 head 적용, (4) 동일 feature ID `INSERT OR IGNORE` 멱등, (5) sourceVersion/revision 상승 후 이전 버전 head 승격 차단, (6) 새 판본 head 승격, (7) 구판본 복원 차단, (8) 최신 head가 새 run ID, (9) `PRAGMA foreign_key_check` 통과.
- 단, 이 실험은 **원문 OCR→Fact→typed→결정론 계산→D1 저장/재독→Word 토큰 전체 round-trip이 아니다**. A2-IT-015는 계속 미인수. 실제 D1 staging, 배치 transactional semantics 및 Node `node:sqlite` 원본 테스트 실행은 남아 있다.

## 3. A2-DATA-016: 계산 명세·입력·출력 선언의 실제 최신 파일 확인

- GitHub **현재 `lib/reference-decision-tables.json`을 파싱한 실제 값**: `calculations.length=18`, `sum(inputs.length)=91`, 중복을 제외한 **고유 입력 경로 78개**, `sum(outputs.length)=42`. 이는 현재 선언된 **계약의 수**이지 OCR→typed 91개 경로가 실제로 모두 데이터베이스에 연결됐다는 검증이 아니다.
- 입력은 `lib/calculation-input-audit.ts`의 분류 `direct_canonical_ocr / derived_from_ocr_review_required / reviewed_case_context_not_ocr / source_verified_legal_fact_not_case_property / unbound typed / other` 등으로 구분된다. `lib/case-calculation-feature-store.ts`의 SQL `input_refs_json`은 선언된 입력 경로와 실제 trace input을 보유하며, 법률 인가/채택을 뜻하지 않는다.
- 모듈 id 18개: income_average, income_aggregation, debt_total, debt_cap, asset_liquidation, available_income, ordinary_budget, nominal_plan, allocation, liquidation_comparison, disposal_conservation, payment_schedule, living_cost_proposal, objection_minimum, seoul_short_term, transaction_review, form_projection, installment_distribution.
- 추가 미인증: 실제 사건 저장 `typed JSON pointer` 78개가 정확한 원본 id/unit/period에서 유효한 입력을 꺼내는지 전수 실행, 42 output path가 실제 저장/서식과 일치하는지, 전체 엔진을 완성 합성 사례로 실행.

## 4. A2-CALC-021: 담보/별제권 부족액의 법률인정 경계(정적 확인)

- `lib/assessment.ts::calculateCase` 채무 한도 부문은 `resolveDebtRows`, 검증된 채권 총액, 담보 분류/중복 보증/기준일/채권자의 법률 검토 여부를 근거로 `securedDebtWon`·`unsecuredDebtWon`을 산출한다. 원문 계약번호/발행기관 불명은 `lib/debt-resolution.ts`에서 자동 병합하지 않고 `DEBT_IDENTITY_AMBIGUOUS`로 남긴다.
- `lib/form-mapping.ts`의 `secured_recovery`와 `shortfall`은 채권 원문 사실을 서식에 투영하는 별도 토큰이며, 담보 부족액을 임의로 일반채권에 전환·중복 산입하는 합의된 법률 산식/승인으로 보지 않는다. 별제권의 실제 회수액 2,600,000원과 채권 4,000,000원의 **산술차 1,400,000원**은 검토용 예시일 뿐, 법적 채권 분류·회수 불확정·일반배분 채택 근거는 별도.
- **이번 회차에 계산 엔진 Node 실행은 없고 별제권 법률 판단·공식 서식 숫자 승인도 하지 않았다.** 이 ID는 `CODE_REVIEWED` 일부에 한정.

## 5. 공식 법령·양식·국세청 근거 및 최신판 한계

- **서울회생법원 2024.12 발행 「회생위원 직무편람」(제5판)**의 「개인회생사건 처리지침(재민 2004-4)」 제2조, **PDF 441번째 페이지(0-based 440)** 이미지 확인: 2023-02-23 개정/2023-03-01 시행 원문은 채무자 수입 및 지출에 관한 목록을 **D5103**, 변제계획안을 **D5110 또는 D5111**로 열거한다. https://slb.scourt.go.kr/rel/information/qna/member_manual.pdf . **2026년 법원 전자소송 실제 최신 양식의 모든 필수 필드는 이 문서만으로 인증할 수 없다.**
- 법제처 국가법령정보센터 채무자회생법 **[시행 2026.10.2.] [법률 제21490호, 2026.3.24. 타법개정]**: https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276565 . 제579조 한도, 제611조 기간, 제614조 인가 판단의 전문 적용은 신청일·사실관계·변호사 검토가 필요.
- 서울회생법원 **2026-10-01 제424호 신설 제7호**는 전회차 공식 준칙 PDF 페이지 검토·Draft PR #18에 별도로 기록했다. 이번 회차는 실제 법률 규칙을 코드에 변경하지 않았으며 **관할 미확정·법원 판본 미승인값 자동 채택 금지**. https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2 .
- **국세청 공식 부가가치세 안내**: 일반과세자 부가세는 매출세액−매입세액, 간이과세자는 별도 계산; 기간과 세액은 개인회생 법률상 순소득이 아님. https://sc.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272 (2026-10-30 대조). 이번에 세법 적용금액은 새로 확정하지 않았다.

## 6. 회차 결과 및 다음 A2 핸드오프

- **신규 P1 코드 결함 1개**: D5103 월 소득 존재·월행 0건에서 final `ready` 오판. 수정 코드 + 4개 Node 회귀 테스트 원본을 **Draft PR #21**, 변경 파일 2개·GitHub 비교에서 이 경로 내 2개 파일만 수정 확인.
- **실행**: 원본 함수 V8 격리 시나리오 5개 전후(수정 전 1개 실패/수정 후 5개 의도 일치), 격리 SQLite 소스 DDL/CAS 재현 9/9, 최신 계약 JSON 18/91/78/42 실제 파싱. 합성 입력은 모두 가상 금액/사건 ID. Node 전체테스트·실제 D1/R2·실제 Word/PDF·법률/세무 전문가 검증·전자제출 **미실행**.
- **통과 [x] 0건**. 회차별 `CODE_REVIEWED` 일부/격리 `SYNTHETIC_EXECUTED`를 본문에만 기록. main 소스 **미변경**(코드 수정 PR에만), 문서 영수증 및 중앙 보드의 자기 A2 ID만 갱신.
- **다음 역할 순환**: 계산사무장 → 서류담당자 → AX담당자 → IT/데이터. 우선 `A2-CALC-030`(원단위 0/null/할인/잔여원 엔진 오라클), `A2-DOC-005`(D5110 변제계획 배분·필드), `A2-AX-008`(세무 타입 schema 강제), `A2-IT-015`(진짜 Node+D1 staging), `A2-DATA-017`(42 output_path 재실행). PR #13/#18/#21은 다른 사람의 현재 변경을 보존하고 병합하지 않은 상태로 법률/출력 책임자 검토가 필요하다.
