# FirmEngine A2 r42 — 변호사: D5103 선택기간·증빙 cutoff·복수 원천의 승인 경계 (부분)

- 감사일 **2026-11-01 KST**. 역할 순환 r41 계산사무장 → **r42 변호사** → r43 데이터담당자.
- 시작/기록 전 main HEAD `17ff58b887dc8103d518e9b9c8b53e2b4de16965`; 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 우선. 대상 **A2-LAW-011 / A2-LAW-014 / A2-LAW-015 / A2-LAW-022** 4개 모두 **[ ] 미완료**. 이번 회차 제품 인수 **0건**.
- 허용경로는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 실제 고객 자료, 원문 OCR, 비공개 정답, 개인정보, API 키, .env 사용/공개 적재 없음. 운영 배포/D1 운영 migration/전자제출/법원 인가 없음.

## 1. 읽은 main / Draft / 기존 검증

- main 검토 전 HEAD `17ff58b887dc8103d518e9b9c8b53e2b4de16965`, 최근 A1/A2 커밋 및 Draft #108/#106/#98/#102/#97/#96/#76 상태 확인: 모두 Draft·미병합. r41 영수증 `2026-11-01_r41_0515KST_calc-selected-period-boundary-and-evidence-cutoff.md` 및 중앙 보드 A2-LAW 이력 확인.
- main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`: `CaseContext.filingPeriod`, `incomePeriodReviewed`, `evidence_cutoff`, `asOf`를 서로 별도 필드로 정의.
- main `lib/context-validation.ts` blob `7ea7262cca177cc92a59f65fe917cc14573786db`: `filingPeriod` 변경 시 과거 검토 상속 방지; `evidence_cutoff` 개별 ISO 날짜만 검증. `asOf`와 cutoff의 교차 검토는 이 검사에서 관찰되지 않음.
- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`: `incomeGroups.observedMonths` 기반 coverage, `incomePeriodReviewed` 별도 점검. 실제 종단 `calculateCase()` 미실행.
- main `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`: D5103 `rows.month`는 실제 `incomeRows`에 연결; `approved_monthly_income`는 현재 별도 review 조건이나 Draft #98의 집계분류 가드는 미병합. D5110 렌더링에서 관측 `monthly_income`과 승인값의 의미를 별도 검토해야 함.
- main `lib/document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`; main `lib/document-writer.ts` blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`; Draft #106은 3서식 사전검사, Draft #108은 writer에 선택기간 helper를 추가. **단독 main에는 통합되어 있지 않음**.
- Draft #108 `lib/income-period-coverage.ts` blob `d3cc44be8fc18b5760d280f1e8aee9076`; `tests/a2-r41-period-coverage.test.ts` blob `6c2a1ddf6da21a0cf10507ef5afbd7e816ffeb70`. 이전 r41 Node 15/15는 기존 시나리오만 해당.
- main `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`는 `value_json`, `value_won`, `status`, `source_fact_ids_json` 독립 저장. **이번 회차 DB insert/reload 자체는 실행하지 않음**.

## 2. 실제 실행한 합성 V8 격리시험 — 10건 / 독립 기대 7건 일치

**실행 재현 방식:** GitHub Draft #108에서 가져온 함수 본문 `checkSelectedIncomePeriodCoverage`의 TypeScript **타입 선언만 제거**하여 V8에서 호출. 입력은 비실제 가상 `monthRows=[{period:'YYYY-MM',net_income:'2,400,000',entity:'SYN-WAGE'}]` 및 선택기간·cutoff. 독립 기대는 **내부 증빙 완결성/검토보류 규칙에 대한 기대**이며 **법원의 인정소득·최종법률 확정이 아님**.

| 입력 조건 | 독립 기대 | 실제 V8 관찰 | 판정 |
|---|---|---|---|
| 2026-01..12, 실제 12개월, cutoff 2027-01-31 | complete | complete | 일치 |
| 선택 01..12, 1월 미관찰 | review_required / missing 2026-01 | 동일 | 일치 |
| 선택 01..12, 12월 미관찰 | review_required / missing 2026-12 | 동일 | 일치 |
| 선택 2026-10, cutoff **2026-10-01**, 10월 전체월 행 240만 | **review_required**(월말 이후 원천 관측 근거 미확인) | **complete**, codes=[] | **불일치 P1 후보** |
| 같은 입력, cutoff **2026-10-31** | complete | complete | 일치 |
| 10..11월 행, cutoff 10월말 | review_required / 2026-11 이후월 | 동일 | 일치 |
| 11..12월 행, **cutoff 없음** (감사 현재 11/1) | **완성본의 시점 검증 보류** | **complete**, codes=[] | **시점 상태의 미표시: 조건부 위험** |
| 급여 Jan..Dec 12개 + 별도 사업 Jan..Nov 11개, cutoff 2027-01-31 | **원천별 관측기간 결손 검토** | **complete**, codes=[] | **그룹별 검사 부재: 조건부 위험** |
| 명시적 0원 Jan | complete(0 관측) | complete | 일치 |
| Jan `[확인 필요]` | review_required / Jan missing | 동일 | 일치 |

- **실제 V8 함수 10/10 실행, 독립 기대 7/10 일치·3/10 불일치(그중 2건은 다른 단계에서 차단할 수 있어 전체 제품 결함 확정 불가)**. `evidenceCutoff`는 월만 비교하며 cutoff가 해당 월의 첫날이어도 **그 월 전체 수입의 완료 근거를 확인하지 않음**.
- 월 2,400,000 ×12 = 28,800,000원, ×11 = 26,400,000원, 결손 차액 = 2,400,000원. **독립 산술일 뿐 법률상 인정 월소득 아님**.
- 변제계획 **독립 산술**: 월변제 900,000원 ×36 = 32,400,000원, ×48 = 43,200,000원, ×60 = 54,000,000원; 명시적 0원 ×36=0원, `null` ×36=`null`. 계산 기간 선택의 정당성/제614조 인가는 미판단.
- Draft #108 PR conversation에 3개 반례 및 결합 전 수용조건을 **댓글 ID 6549213360**으로 남김: https://github.com/firmengine/firmengine/pull/108#issuecomment-6549213360 . 코드는 변경·병합하지 않음.

## 3. 정확한 계약 분리 — 18/91/42와 DOCX 토큰

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 모듈, 91 입력 선언(고유78), 42 출력 선언(고유40), 42 resultPaths(고유42)** 정적 JSON 파싱.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: DOCX 실제 등록 토큰 **D5103 37 / D5110 55 / D5111 82**.
- `public/templates/catalog.json` blob `9bae52fdf47fbc0935314bb5267503e4182080bd`: 공공 원형 매핑 토큰은 **35 / 53 / 80**이며, 차이 2개는 각각 **`review_status`, `revision`**(내부 DOCX 추가)임을 양방향 set 차집합으로 직접 확인. 따라서 두 숫자는 서로 다른 정의이며 오계산 아님. `approval_status=reviewer_pending`, 수정 가능한 복원양식이므로 공식 서식 동등성 인수 아님.
- 본 회차는 91개 입력값 전체의 원문→Fact→typed→SQL→DOCX 종단 재실행이 아니며, static contract와 helper V8만 실행됨. 실제 Node 프로젝트 테스트·tsc/CI/D1/R2/Cron/실 DOCX 비교 전부 **미실행**.

## 4. 공식 근거 재조회 — 시행·관할·적용 미확정 분리

- 국가법령정보센터 **채무자 회생 및 파산에 관한 법률** **법률 제21490호 [2026-10-02 시행]** [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777): 변제개시일부터 원칙 3년 이내/특별 사정 5년 범위; 36/48/60 산술과 법률상 기간 승인 분리. [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 공정·형평·수행가능성 및 인가결정 기준일 청산가치와 법원의 인가 판단은 독립.
- 서울회생법원 **2026-10-01** [공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): **실무준칙 제424호 제2조 제2항 제7호 신설**을 확인. **첨부 PDF 개정전문/부칙/경과조치/정확한 사건별 적용일은 미검증**. 공지일=개별 사건 적용일이라 간주하거나 자동 적용 금지.
- 국세청 [공식 부가가치세 과세기간](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 반기, 간이과세자 통상 연간. VAT 공급대가, 사업 순소득, 종소세 신고금액, 법원 인정소득은 서로 다른 피처이며 이번에 상호 자동 변환/법률 규칙 변경하지 않음.

## 5. A2 ID별 현 단계 및 다음 회차

- **A2-LAW-011 [ ]**: 관측 금액과 법률 인정 구분, cutoff 중간월 및 다중 급여/사업원천 V8 반례; Fact/SQL/서식 종단 및 전문가 소득검토는 미인증.
- **A2-LAW-014 [ ]**: 제611조 시행판과 36·48·60 BigInt 독립 산술, 사건별 변제기간 판단 미인증.
- **A2-LAW-015 [ ]**: 서울 제424호 제7호 공지 확인, PDF 부칙/시행/관할별 사건 적용 미확인.
- **A2-LAW-022 [ ]**: source-only 시점 검증과 `approved_monthly_income` 분리 필요. Draft #108의 'complete'를 법률 승인으로 승격 금지; #106/#98/#102 실제 통합 미실행.
- 다음 **r43 데이터담당자**: cutoff·asOf·source Fact period의 비교, 소득원별 관측구간과 case aggregate, #106+#108 통합 뒤 D5103/5110/5111 실 Node 회귀; SQL `value_json`·`value_won`·status·source IDs 동등성/불일치; 0/null·미관찰/충돌/승인 전 구분. P0 기준정보 SHA head 쓰기 경합은 여전히 미해결. 담당자 승인 전 Draft 병합 금지.

**코드 존재 ≠ V8 격리 일치 ≠ Node 전체 CI ≠ 실제 D1·R2 / DOCX ≠ 공식법원서식 ≠ 변호사·실무자 인수 ≠ 운영 배포/법원 인가.**
