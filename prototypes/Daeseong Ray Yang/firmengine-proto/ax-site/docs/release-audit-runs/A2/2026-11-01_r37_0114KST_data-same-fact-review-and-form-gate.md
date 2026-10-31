# FirmEngine A2 r37 — 데이터담당자: 동일 Fact의 상충 검토·승인 토큰·SQL 상태 연계

- 회차: 2026-11-01 01:14 KST 시작. 직전 r36 **변호사** → r37 **데이터담당자** → 다음 r38 **AX담당자**.
- 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 시작 main `42bc8e8643bf7005f28c615ed9d823661e83b569`; 문서 쓰기 직전 main `42bc8e8643bf7005f28c615ed9d823661e83b569`.
- 4개 미인수 ID: `A2-DATA-005`, `A2-DATA-018`, `A2-DATA-020`, `A2-DATA-024`. **모두 [ ] 유지 / 실제 제품 인수 0건**.
- 원본 고객문서·원본 OCR 값·키·.env·비공개 정답 없음. 합성 `SYN` 값만 사용.
- r36 이력 `docs/release-audit-runs/A2/2026-11-01_r36_0017KST_law-income-aggregation-approved-form.md` 읽음. main 보드 및 PR #76, #93, #96, #97, #98, #87 관련 코드/상태 검토. main 계산 코드 변경하지 않음.

## 1. 직접 재독한 판본과 계약

- main `lib/income-resolution.ts` blob `f370c4b14fd347089708c5c3241fa9c72522d4bf`; Draft [#97](https://github.com/firmengine/firmengine/pull/97) 해당 파일 blob `d340e7c0b051ce0fede8f897b05854e2904953db`. main `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; Draft [#98](https://github.com/firmengine/firmengine/pull/98) 승인 금액 토큰 조건식 재독.
- `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`: `Fact.state/recognition/refs/value/numeric`, `IncomeSource.recognition/aggregationTreatment/aggregationReviewed/aggregationReviewReason/factIds` 구분.
- `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`. `value_json`, nullable `value_won`, `status`, `source_fact_ids_json`, `input_refs_json` 독립 열.
- `lib/reference-decision-tables.json` 직접 파싱: **18모듈 / 입력 선언 91(고유78) / 출력 선언 42(고유40) / resultPaths 42(고유42)**. `lib/template-token-catalog.json` 직접 파싱: **D5103 37 / D5110 55 / D5111 82**. 이 수치는 **정적 등록 개수**, 실제 91입력→42출력→Word 검증은 아님.

## 2. 원문 Fact → typed 소득원 충돌 재현 (A2-DATA-005/020)

합성 입력: `Fact{id:"F-A", key:"income.net", value:"100000", state:"verified", recognition:"accepted"}`, `IncomeSource{id:"i-a", factIds:["F-A"], net:{amountWon:"100000"}, recognition:"accepted", aggregationTreatment:"independent_source", aggregationReviewed:true, aggregationReviewReason:"reviewed"}` 및 같은 Fact ID·금액·기간의 `i-b`. 두 번째 행의 승인상태·집계분류·검토사유·과세원천 역할만 변경한 9개 반례를 작성.

- 독립 기대: 완전히 같은 행은 1행으로 중복 제거; 동일 Fact여도 **accepted/rejected, accepted/unreviewed, independent/duplicate, reviewed/unreviewed, 사유상충, gross-only/net** 등 6가지 서로 다른 결정은 **2행+CONFLICT**. 값 자체가 0원으로 달라졌거나 Fact 버전 ID가 다르면 독립 행으로 보존.
- 검증법: GitHub에서 가져온 실제 `resolveIncomeRows` 함수 본문 중 TS 타입 표기를 제거해 JavaScript로 실행. `observationCore` 및 PR #97 `reviewDecisionFingerprint`는 실제 본문 사용. **시험의 동일 Fact 경로만 분리**하려고 `currentFacts`는 합성 Fact 배열, `sourceIdentity`와 `sourceObservationSignature`는 null stub으로 지정; 전체 provenance/OCR 결합 시험은 아님.
- **main 독립 기대 일치 3/9**: 6개 상충 판단을 `duplicates:["i-b"]`, `issues:[]`로 잘못 소거.
- **Draft #97 함수 본문 독립 기대 일치 9/9**: 상충 6개는 두 행 보존 및 `INCOME_SAME_FACT_REVIEW_CONFLICT` 사유 기록. 정식 프로젝트 Node/CI는 이 회차 미실행.

## 3. 계산 결과 → 승인 서식 토큰 연계 격리 (A2-DATA-018/020)

동일 Fact에 `i-a=accepted+independent_source+reviewed`, `i-b=rejected` 또는 `unreviewed` 또는 `duplicate+reviewed`를 충돌 주입. `context.filingPeriod=2026-01-01..2026-12-31`, 소득합계 합성 `"2400000"` 또는 승인된 명시적 `"0"`, `incomeRows`는 위 resolver가 남긴 행에서 생성. PR #98의 실제 `approved_monthly_income` 조건식을 V8로 실행하되 `factSourceLineageIssues`는 정상 stub, 계산 총액은 **합성 주입**.

| 시나리오 | 독립 기대 토큰 | main resolver + PR #98 조건식 | PR #97 resolver + PR #98 조건식 |
|---|---|---|---|
| 정상 단일 승인 240만 | 2400000 | 2400000 | 2400000 |
| 동일 Fact 두 번째 rejected | [확인 필요] | **2400000** | [확인 필요] |
| 동일 Fact 두 번째 unreviewed | [확인 필요] | **2400000** | [확인 필요] |
| 동일 Fact 두 번째 duplicate(둘 다 accepted) | [확인 필요] | **2400000** | **2400000** |
| 0원 accepted + 동일 Fact rejected | [확인 필요] | **0** | [확인 필요] |

- 독립 기대 일치 **1/5 → 4/5**. 중요: **#97+#98을 결합해도 `accepted/duplicate` 상충에 대한 서식 조건식 단독 보호는 부족**하다. #97이 남기는 `issues`를 토큰 게이트가 직접 소비하지 않음. 단, 실제 전체 `calculateCase()`가 `duplicate` 관측값을 `null` 처리할 수 있으므로 **제품 최종 숫자 오류로 단정할 수 없고, 전체 결합 시험이 우선**이다.
- `monthly_income` 관측 미리보기와 `approved_monthly_income` 승인값, `null`, 명시적 `0`, `source-only`를 동치 처리하지 않음. PR #76(부분·미래월), #93(D5103 첫/끝월·최종 검증)과도 병합 전 결합해야 함.

## 4. SQL 합성 저장·재독 (A2-DATA-024/020)

2026-11-01 인메모리 SQLite에서 현재 migration `0011`과 같은 3개 계산테이블 DDL + 최소 `cases` stub으로 합성 계산 run/feature 6행을 INSERT/SELECT. 스크립트: `/mnt/data/a2_r37_data_sql_replay.py` (작업 환경 로컬, Git 비적재).

- **9/9 독립 기대 일치**: 명시적 0 JSON/`value_won="0"` 보존, `null`/`NULL` 구분, `provisional` 원천 행, `source_fact_ids_json`, FK 정상.
- **DB 제약만으로 무결성 보장 불가**: `value_json="null"`인데 `value_won="0",status="computed"` 또는 `value_json="\"2400000\""`인데 `value_won=NULL,status="computed"`인 행이 모두 정상 INSERT됨. `status="blocked"`와 0원 금액의 공존도 가능. 이는 저장 허용 사실의 관찰이지 법적 승인이다는 뜻이 아님. 현재 [#70](https://github.com/firmengine/firmengine/pull/70)의 원화 재생 무결성 조건과 결합 검증 필요.
- 실제 Cloudflare D1/staging, 원문 OCR/Fact 실파이프라인, 42개 resultPath 저장·재조회, D5103 DOCX 렌더링은 **미실행**.

## 5. 공식 원문·적용일 분리 (법률 자동규칙 변경 없음)

- 국가법령정보센터 [채무자회생법 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777): **[시행 2026-10-02], 법률 제21490호(2026-03-24 타법개정)**. 변제계획 소득/재산 기재, 3년 기본·특별사정 5년 한도는 법률 조문 범위; 개별 법률 인정 소득액을 자동 산출한다는 규정 아님.
- 서울회생법원 [2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): **실무준칙 제424호 제2조 제2항 제7호 신설**. *게시일*만 확인했고 첨부 개정전문 부칙·경과조치/사건별 적용일 **미확인**. 서울 관할 외 자동 적용 금지.
- 국세청 [부가가치세 과세기간](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486), [종합소득세 개요](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7669&mi=2224): 일반과세자 통상 반기/간이과세자 통상 연간 VAT 기간과 종소세 과세·신고 기준은 동일 월소득 근거가 아님. **사업 순소득·VAT/종소세 중복 91입력 종단 대조는 미인증**.

## 6. 수정·통합 / 다음

- **이번 회차 제품 코드 수정 없음**: 이미 충돌 구분 개선 Draft #97, 서식 승인 조건 Draft #98, 집계 검토 Draft #96, 대표기간 Draft #76, D5103 Draft #93, SQL 재생 Draft #70이 열려 있어 검증 없이 중복 변경/독립 병합하지 않음. #97의 갈등 이슈와 #98 토큰 조건식의 연결은 **새 결합 회귀 시험이 필요한 고위험 미해결**.
- 다음 **AX담당자 r38**: (1) 최신 main에서 #97/#98/#96/#76/#93 간 테스트 충돌 맵 및 `INCOME_SAME_FACT_REVIEW_CONFLICT` 소비 위치, (2) 실제 `calculateCase()` → approved token → D5103 preflight 단위/Node 조합, (3) 0/NULL/승인전 SQL replay 가드 #70의 실제 실행, (4) 2026-10-01 서울 424호 부칙 실무자 검토.
- 전체 Node 테스트/CI, staging D1/R2/Cron, 실제 Word, 법원 공식 서식·변호사/계산사무장 승인 **미인증**. 운영 배포·운영 migration·전자제출·법원 인가 실행하지 않음.
