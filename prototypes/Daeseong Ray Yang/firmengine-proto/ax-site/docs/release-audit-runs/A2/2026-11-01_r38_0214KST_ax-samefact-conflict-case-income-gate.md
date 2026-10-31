# FirmEngine A2 r38 — AX담당자: 동일 Fact 분류상충의 사건 월소득·D5103 승인값 경계

- 기록 기준: **2026-11-01 02:14 KST**. 직전 r37 **데이터담당자** → 이번 r38 **AX담당자** → 다음 r39 **IT담당자**. 시작 main HEAD `163b35f318aae51eccdb1f942f1e6a2ec48367ee`; 영수증 작성 직전 main HEAD `163b35f318aae51eccdb1f942f1e6a2ec48367ee`.
- 단일 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 미검증 A2 ID **A2-AX-010 / A2-AX-012 / A2-AX-015 / A2-AX-017** 4개, 전부 **부분 검증 [ ] 유지**. 제품 인수/변호사·세무 승인 **0건**.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 고객문서, 실제 OCR·개인정보, 비공개 테스트 정답, 키, .env는 사용·Git 기록하지 않음.
- 최근 main 커밋 `163b35f` (A1 보드), `9b09dfd` (A1 영수증), 기존 A2 [r37](2026-11-01_r37_0114KST_data-same-fact-review-and-form-gate.md) 재독. 관련 Draft #97/#98/#96/#93/#76, #84/#79/#67, 원본 테스트 및 SQL 0011 확인.

## 1. 직접 재독한 소스 판본·정적 계약

| 대상 | 경로/버전 | Git blob SHA |
|---|---|---|
| main 동일 Fact resolver | `lib/income-resolution.ts` | `f370c4b14fd347089708c5c3241fa9c72522d4bf` |
| Draft #97 충돌 보존 resolver | `lib/income-resolution.ts` | `d340e7c0b051ce0fede8f897b05854e2904953db` |
| main 계산 | `lib/assessment.ts` | `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5` |
| Draft #96 계산/집계 | `lib/assessment.ts` | `bb6c2854e7317fbc633f356203c7509f6b3ba8ec` |
| main 서식 매핑 | `lib/form-mapping.ts` | `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e` |
| Draft #98 승인 토큰 | `lib/form-mapping.ts` | `b7b77a873bf27d8a53b54a4807f3e2e96fa47430` |
| SQL 저장 migration | `drizzle/0011_case_calculation_features.sql` | `0caa359d250dce45765d269d271ad63170ec3efa` |

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`를 JSON 파싱: **계산 18모듈 / 입력 선언 91(고유 78) / 출력 선언 42 / resultPaths 42**.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 파싱: **D5103=37 / D5110=55 / D5111=82 토큰**.
- `tests/income-resolution.test.ts`, `tests/case-calculation-feature-store.test.ts`, `lib/material-calculation-source-gate.ts`, `lib/domain.ts` 실내용 확인. 정적 계약 건수는 **전체 91입력 실행·SQL/DOCX 출력 성공과 동의어가 아님**.

## 2. 합성 5건 — 별도 PR들의 실코드 격리결합 및 독립 기대값

합성 원천 `Fact.id=SYN-F1`, 동일 `factIds=[SYN-F1]`, 동일 월별 순소득 기간 `2026-01-01~2026-12-31`(12개 완전 달력월), `recurring` 독립 의미 판단 없음, 두 typed `IncomeSource`의 id만 `SYN-A/SYN-B`. `recognition=accepted`, `aggregationReviewed=true`, `aggregationReviewReason=SYN-approved`; 금액은 합성 2,400,000원 또는 명시적 0원. `context.inventoryComplete.income=yes`, `incomePeriodReviewed=true`.

실제 #97 `resolveIncomeRows`·#96 `aggregateIncomeObservations` 함수 본문에서 TypeScript 표기만 제거하여 **V8 실행**, #98 `approved_monthly_income` **실제 조건식** 실행. `currentFacts`는 합성 Fact, `sourceIdentity/sourceObservationSignature`는 null stub, 날짜/금액 함수와 `factSourceLineageIssues`는 해당 격리 경로에서 합성 helper 사용. *제품 전체 `calculateCase`나 DOCX/SQL E2E가 아님*.

| 합성 분류 A/B | 기대 사건 월소득 / 승인 토큰 | 실제 격리 관찰 |
|---|---|---|
| independent / independent, 완전 동일한 결정 | 2,400,000 / 2,400,000 | 1행 병합·2,400,000 / 2,400,000 (일치) |
| **independent / series**, 동일 Fact 상충 | **null / [확인 필요]** | 충돌 issue 있음에도 **4,800,000 / 4,800,000** (실패) |
| **series / independent**, 동일 Fact 상충 | **null / [확인 필요]** | 충돌 issue 있음에도 **4,800,000 / 4,800,000** (실패) |
| independent / duplicate, 동일 Fact 상충 | null / [확인 필요] | 2행·issue, 집계 preview 2,400,000, 승인 토큰 [확인 필요] (토큰 통과, 사건 총액은 차단 필요) |
| **independent / series, 명시적 0원**, 동일 Fact 상충 | **null / [확인 필요]** | 충돌 issue 있음에도 **0 / 0** (실패) |

- 핵심: #97의 `INCOME_SAME_FACT_REVIEW_CONFLICT:SYN-A,SYN-B`는 `issues`에 기록되지만, #96 계산 `income` 술어와 #98 승인 토큰 술어가 이를 거절하지 않는다. 같은 Fact를 서로 다른 독립소득으로 간주하면 **2배 계상**이 가능하다.
- **검증 성격:** 각 합성 조건의 실제 V8 관찰을 기록한 반례. 5/5개 *실행*이지 5/5개의 제품 합격이 아니다. 이 조합은 아직 **Draft PR**들에 분리되어 있으며 현재 main 전체 앱에서 동일 결과가 발생했다고 단정하지 않는다.
- 안전 기대: 승인 전 계산 금액 `null` 및 승인 토큰 `[확인 필요]`; 원문 Fact와 개별 관측 그룹 preview는 보존. VAT gross/종소세 historical 비교는 월 순소득과 별개. 구체적인 승인규칙은 담당자의 검토 필요.

## 3. 새 방어 코드·회귀시험

- 신규 [Draft PR #102](https://github.com/firmengine/firmengine/pull/102), head `audit/a2-r38-ax-samefact-conflict-20261101-0214`, **main 미병합**. 세 파일만 변경:
  1. `lib/income-decision-conflict-gate.ts`: `INCOME_SAME_FACT_REVIEW_CONFLICT` 또는 `:` 접미사가 있는 issue일 때 case-wide 결과를 `null`로 격리.
  2. `tests/income-decision-conflict-gate.test.ts`: 긍정/0/null/상충/코드 접두어 판별을 합성으로 검증.
  3. `lib/assessment.ts`: resolver `incomeResolution.issues`를 `monthlyIncomeWon` 경계에서 소비, 그룹 관측 진단·원천값 변경 없음.
- Node v22.16.0 `node --experimental-strip-types --test tests/income-decision-conflict-gate.test.ts`에 해당하는 로컬 동일 본문 합성시험 **10/10 PASS**, `fail=0`. Node TAP 원문은 비공개 값 없이 로컬 `/mnt/data/a2_r38_synthetic/node-test-output.txt`에 보관.
- 새 파일과 수정 `assessment.ts`를 GitHub branch에서 재조회해 업로드 바이트 일치 **3/3**, Git blobs `e58993afae58f3e8dadb5a91c18067308e3877c4`, `03d626a56fd907f179dbfac21839ac747b9a7a04`, `df115a82a23fb0bca9b61adb18f3d598880ec042`.
- **중요:** main resolver에는 아직 이 충돌 issue를 생성하는 #97 변경이 없다. 따라서 #102 단독으로 현 main 동일 Fact 중복 문제를 해결하지 않는다. #97/#96/#98/#102의 합친 정식 Node 테스트는 **미실행**. PR #97/#98에는 병합차단 의존관계와 반례 댓글을 남겼다.

## 4. 법률 원문·회계 경계

- 2026-11-01 공식 조회: 국가법령정보센터 채무자회생법 판본 **시행 2026-10-02 / 법률 제21490호(2026-03-24 타법개정)** 표시 [공식 조문판본](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028275889). 이 페이지는 제503조이므로 **제611·614조 조문 자체를 이번 조회로 검증했다고 주장하지 않음**. [이전 A2 r37 제611조 출처](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777) 연결은 이번 웹 재접근 실패, 실무자 원문 재독 필요.
- 서울회생법원 [2026-10-01 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): **제424호 제2조 제2항 제7호 신설 공지** 확인. *공지일*만 확인했고 제7호 상세 문언·첨부 개정전문 부칙/경과조치·사건별 시행/적용일은 **미관찰**. 서울 외 관할 자동 적용 금지.
- 국세청 [공식 VAT 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 반기/간이과세자 통상 연간 신고단위. **VAT 매출총액·종소세 신고·실제 순소득·개인회생 인정액은 별도 상태/근거**, 이번 회차 산식·인정기준 자동변경 없음.
- 법률상 인정·변제기간 조정·법원 인가 확정은 어느 시험으로도 추정하지 않는다. 변호사·계산사무장 판단 전 **미인증**.

## 5. 다음 r39 IT 및 남은 차단

1. #97/#96/#98/#102 **비파괴 통합**, 동일 Fact/독립·연속·중복의 `calculateCase()`→`buildFormBindings()`→D5103 `evaluateDocumentPreflight()` 실제 Node 실행. #93·#76의 첫/끝 11/12월 누락·미래월, #84/#79/#67 동일 assessment 파일 충돌 점검.
2. VAT/종소세/급여/사업소득 원천별 월별·복수사업자·중복 계상, 원천 Fact→typed→SQL `value_json/value_won/status`→서식 37/55/82 토큰 전체 대조. 실제 SQLite/D1 이번 회차 **미실행**.
3. 독립 반례 `0` vs `null` vs 미관찰 vs 상충/승인전의 불변식과 reference SHA/CAS 오래된 head P0 차단을 실제 staging에서 확인. 운영 DB migration/전자제출 실행 금지.
4. 공식 개정준칙 부칙·시행일 및 2026-10-02 법률 제611·614조 원문, 법원별 적용 검토는 **법률 전문가 승인 전 미인증**.
5. **전체 Node 프로젝트 테스트/CI, staging D1/R2/Cron, 실제 Word/D5103 법원서식 동등성, 변호사 승인·배포: 0건**. Draft PR 미병합, 자동 법률 확정·운영 배포 금지.
