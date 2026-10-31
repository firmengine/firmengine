# FirmEngine A2 23차 — 계산사무장: 대표기간 밖 월별행·사업소득 VAT 격리

- 일시: 2026-10-31 11:12 KST (감사 시작), 프로젝트 `firmengine/firmengine` main. 초기 읽기 HEAD `be57e16b0e1cadce27fb6773b1ff51d3fca8a71a`, 영수증 저장 전 HEAD `be57e16b0e1cadce27fb6773b1ff51d3fca8a71a`.
- 역할 순환: r22 사용자·서류담당자 → **r23 계산사무장** → r24 변호사.
- 선택 ID: **A2-CALC-006 / A2-CALC-015 / A2-CALC-016 / A2-CALC-030**. 모두 **부분 검증 [ ] 유지**. RELEASE_READY 0건.
- 읽은 자료: main 최근 커밋/PR #58/#67/#71, r22 영수증, 단일 중앙 보드, `assessment.ts`, `form-mapping.ts`, `business-net-reconciliation.ts`, `document-preflight.ts`, `0011_case_calculation_features.sql`, `calculation-audit.test.ts`, `form-month-calculation-integrity.test.ts`, 18모듈/91입력/서식 토큰.

## 1. P1 발견 — 선택 대표기간 밖 월소득이 D5103에 계산 완료 금액으로 노출

- `calculateCase()`는 선택 대표기간 바깥 소득관측을 `aggregateIncomeObservations()`에서 제외하지만, `buildFormBindings()`의 `rows.month`는 `calculation.incomeRows` **전체**를 이용한다. 따라서 2026-01~12 선택 중 2025-12 또는 2027-01의 원천 월액 2,400,000원이나 명시적 0원이 D5103 월행에 정상 관측 금액처럼 표시된다. 법원에서 인정된 소득이라는 뜻은 아니나 내부 서식 상태가 잘못 해석될 위험이 있다.
- 2026-01~12 **12행×2,400,000=28,800,000원**; 2026-01~11 **11행×2,400,000=26,400,000원**; 관측 차이 **2,400,000원**. 이는 독립 BigInt 산술 기대값이며 법률상 인정소득이 아니다.
- 실제 `form-mapping.ts` main blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`의 **월행 생성 코드 조각과 정확한 `exactSourceCalendarMonth()` 본문**을 사용해 V8 격리 검증. `sourceValid`, 숫자 포맷, 입력 CaseData 부분은 합성 최소 대역. 과거·미래월에서 main 값 `2400000`/명시적 `0`을 그대로 노출함을 관찰.
- 수정안은 **Draft [PR #76](https://github.com/firmengine/firmengine/pull/76)**: 선택기간 시작 달력월 첫날·종료 말일 및 범위를 검증. 밖의 월은 `rows.month[].period`와 원천정보를 삭제하지 않고 `revenue/expense/net_income=[확인 필요]`로 유지한다. 없는 값을 0으로 바꾸지 않는다. 원천 Fact/typed 및 소득 산식 변경 없음.
- 수정 PR blob `f837d378407d01bd273d6222711494506d8945c5`의 실제 월행 코드 조각도 동일한 V8 대역으로 재실행: **10/10 독립 기대 일치**(12월 완전, 끝단 11월만, 과거·미래, 0의 내부·외부, 잘못된 대표기간 시작·끝, 대표기간 없음, 연도 경계). 특히 2027-01 자료는 관측 원천으로 남지만 D5103 계산값 **[확인 필요]**; 기간 안의 0은 **0**으로 남는다. 이 검증은 전체 `buildFormBindings` 실행이 아니다.
- source-backed 합성 `document/pages/Fact(rawValue,numeric)/typed income` 구성을 포함한 **Node 5개 테스트 그룹을 PR #76의 `tests/a2-r23-filing-window-month-form.test.ts`에 작성**, **실행하지 못함**. 소스/서식 실제 채움, staging D1/R2와 전체 CI/Word 파일 미검증. 계산법/법률상 대표기간 자동 확정 규칙은 도입하지 않음.

## 2. 월별 완전성 · VAT · 0/null 검사 (A2-CALC-006/015/016/030)

| 합성 입력 (독립 산술 또는 source-only) | 독립 기대 | 실제 본문 격리 관찰 | 판정 |
| --- | --- | --- | --- |
| 2026-01~12, 매월 240만원 | 12월 관측 2,880만원; 기간 내 월행만 계산 | 월행 코드 12개 numeric 유지 | 부분; E2E 미실행 |
| 2026-01~11, 12월 미관찰 | 12월을 0으로 채우지 않고 승인 보류 | 월행 11개 유지; `assessment.ts`의 `INCOME_PERIOD_COVERAGE_INCOMPLETE` 분기 **정적 확인** | 전체 calculateCase/D5103 결합 미인증 |
| 기간 외 2027-01 월액 240만원 | 원천 보존·서식 소득 확정값 배제 | main 240만원 → Draft #76 [확인 필요] | V8 부분 입증 |
| 기간 내 0 / 기간 밖 0 | 0 보존 / 밖은 원천 참고 | 수정안 V8 0 / [확인 필요] | V8 부분 입증 |
| VAT 매출원천 `gross_turnover_only`, 매출 300만원·경비 100만원 | 총매출로 소득 자동 승인 금지 | `monthlyIncome` 실제 본문에서 `null`+`INCOME_VAT_TURNOVER_NOT_NET_INCOME` | 분리 유지 |
| 매출300만원−검토된 비용100만원(원천 역할 `period_income_observation`) | 프리뷰 순액 200만원 | V8 `2000000`(검토를 실제로 승인하지 않음) | 산술만 입증 |
| VAT 역할인데 typed net=200만원 기재 | 출처역할이 우선, 자동승격 금지 | `null`+`INCOME_VAT_TURNOVER_NOT_NET_INCOME` | 분리 유지 |
| 원천 미관찰 경비 / net과 gross−cost 상충 / 음수 net | 차단, 0 대체 금지 | 각각 `null` + 전용 오류 | V8 부분 입증 |
| 2,400만1원 / 12개월 | 바닥 나눗셈 200만원(잔여 1원 별도) | `2000000` | 산술 격리 |

- `monthlyIncome` main blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`의 실제 함수본문을 TypeScript 선언만 제거하고, `moneyValue/nonnegative/monthSpan/floorDivide` 등은 합성용 순수 함수로 주입해 실행. 9가지 관찰 조건 모두 기록했으나 **그중 부분월 monthly 원본이 240만원을 반환하는 1건은 여전히 P1**이며 **기존 Draft [PR #67](https://github.com/firmengine/firmengine/pull/67)**에서만 수정 제안. 9/9이라는 수치를 법적 합격점으로 표기하지 않는다.
- 국세청 VAT 과세기간/과세형태와 종소세·원천징수 실무는 별개의 세무 판단이다. **VAT 납부액·매입세액을 위 200만원에 추가 산입·중복 차감하지 않으며 자동 법적 인정 규칙 없음.** 카드/계좌/신고서 원천의 전체 중복 및 세무 신고내역 실제 D1·SQL 재독은 미실행.
- SQL `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: `value_json TEXT NOT NULL`, `value_won TEXT NULL`, `status`, `source_fact_ids_json`, `input_refs_json`. **실제 SQL INSERT/SELECT와 D1 재독 미실행**; 0/null/source-only/blocked를 동일값으로 취급하지 않음.

## 3. 정적 계산/출력 계약 및 공식 기준 (관할·적용일)

- 등록 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18개 계산모듈, 입력선언 91개(고유 78), 출력선언/결과경로 각각 42개** 직접 재파싱.
- 서식 `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103=37, D5110=55, D5111=82** 토큰 직접 재파싱. 계산 91개 입력→SQL 42개 출력→Word 문서 전수 E2E가 아님.
- **국가법령정보센터**: 「채무자 회생 및 파산에 관한 법률」 [시행 **2026-10-02**] [법률 **제21490호**, 2026-03-24 타법개정], **제611조** 변제계획: https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221 (2026-10-31 직접 확인). 이번 내부 대표기간 행 표시 문제에서 법률상 자동 반려조건을 새로 추론하지 않음.
- **서울회생법원**: 보도자료 작성 **2026-10-01**, 실무준칙 **제424호 제2조 제2항 제7호 신설**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 (2026-10-31 확인). PDF 본문 부칙·경과조치·개별 사건 적용일 **미검증**. 무승인 규칙 자동적용 금지.
- **국세청**: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 (2026-10-31 확인). 일반/간이과세자 과세기간·세액 산식을 별도 구분. 법률·회계 적합성은 계산사무장/변호사의 최종 실무 검토 전 미인증.

## 4. 변경, 충돌, 다음 회차

- **제품 수정은 Draft PR #76 미병합**(허용 범위 내 `lib/form-mapping.ts` 및 `tests/a2-r23-filing-window-month-form.test.ts`만). 코드 커밋 `337e98b`, 합성 테스트 작성 커밋 `3ed7023`. PR #58(서식 내부 월공백), #67(부분월 급여), #71(SQL replay)과 종단/통합 검증 전 병합 보류. 다른 에이전트 변경 덮어쓰기 없음.
- 다음 **r24 변호사**: ① 선택 대표기간/법원별 예외 및 제424호 적용일·원문 전문·사람 승인 ② 11/12 끝단 누락이 `calculateCase→buildFormBindings→D5103 preflight` final에서 차단되는지 프로젝트 Node 실제 실행 ③ VAT/종소세 중복과 사업자 복수/급여 겸업의 승인 경계 ④ Draft #58/#67/#71/#76 통합 충돌·회귀 검증.
- **인수 0건**. 운영배포, 운영 D1 마이그레이션, 전자제출, 법원 인가 확정 모두 하지 않음. 고객자료/원본OCR/비공개키·정답 공개 Git 적재 없음.
