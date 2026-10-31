# FirmEngine A2 r36 — 변호사: 소득 집계분류 검토와 승인 서식 토큰 경계

- 회차: 2026-11-01 00:17 KST 기준. r35 계산사무장 → **r36 변호사** → r37 데이터담당자. 지정 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만 변경.
- 최초 main SHA: `4047d58b1a293f089d33d2aad1e9d837b7209e5c`; 영수증 기록 직전 main SHA: `4047d58b1a293f089d33d2aad1e9d837b7209e5c`. main `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; 이전 r35 영수증 blob `42daadfab8969f92ed0227534a60b331654669e8`.
- 보드 체크: **A2-LAW-011, A2-LAW-015, A2-LAW-022, A2-LAW-023**. 4개 모두 **[ ] 미완료**. 법률·회계 적합성, 법원 제출/인가, 정식 인수 모두 미인증.

## 1. main 및 진행 PR/기존 영수증 확인
- r35 영수증 `docs/release-audit-runs/A2/2026-10-31_r35_2316KST_calc-aggregation-review-unapproved-treatment.md`: 지급자별 미승인 집계분류에도 수치가 사건 월소득으로 전파되는 문제. Draft [#96](https://github.com/firmengine/firmengine/pull/96)에서 미승인 명시적 분류의 계산 보류를 제안했으나 `unknown` 분류는 의도적으로 이전 동작을 유지; 프로젝트 Node/CI, SQL/Word 미실행.
- 최근 main에는 A1 타 에이전트 커밋이 계속 유입되어 대상 파일 blob SHA 확인 후 별도 브랜치에서만 제품 변경. 기존 Draft [#76](https://github.com/firmengine/firmengine/pull/76)은 같은 `form-mapping.ts`의 대표기간 완전월, [#93](https://github.com/firmengine/firmengine/pull/93)은 D5103 월별증빙·최종본 차단, [#84](https://github.com/firmengine/firmengine/pull/84)은 청산가치 승인상태, [#97](https://github.com/firmengine/firmengine/pull/97)은 동일 Fact 상충 결정을 수정 중. 독립 병합 금지.
- `lib/assessment.ts`, `lib/form-mapping.ts`, `lib/domain.ts`, `lib/document-preflight.ts`, `drizzle/0011_case_calculation_features.sql`, `package.json`, `reference-decision-tables.json` 및 `template-token-catalog.json`를 읽음. SQL `value_json`/nullable `value_won`/`status` 별개 저장과 계산 run/head 판본이 분리됨을 확인; **실제 SQL 실행·저장 재조회는 이 회차에 수행하지 않음**.

## 2. 합성 데이터 경계 / 독립 기대
가상의 소득 원본 `SYN-WAGE-PAYER-A` (실제 PDF/OCR 아님) → `Fact{id:"F",key:"income.net",state:"verified",recognition:"accepted",value:"28800000"}` → typed `IncomeSource{id:"W",kind:"wage",factIds:["F"],net:{amountWon:"28800000"},periodStart:"2026-01-01",periodEnd:"2026-12-31",amountBasis:"period_total",aggregationTreatment:"unknown",aggregationReviewed:false,aggregationReviewReason:"",recognition:"accepted"}` → 합성 `CalculationResult{monthlyIncomeWon:"2400000",incomeRows:[{id:"W",monthlyWon:"2400000"}]}` → 실제 `approved_monthly_income` 바인딩 술어 검사.
- 독립 BigInt 산술 28,800,000 ÷ 12 = **2,400,000원**, 0 ÷ 12 = **0원**. **계산 결과는 이 회차에서는 합성 주입**했으며 실제 `calculateCase()` 전체를 실행한 것은 아님.
- 기대: `aggregationTreatment`가 unknown/미지정, `aggregationReviewed` 거짓, 검토 이유 빈칸, 대표기간 미지정, 관측 null, 법률 인정 미완료이면 **승인된 서식 토큰은 `[확인 필요]`**. 명시적으로 검토된 0원은 `0`으로 보존. 이 기대는 **내부 검토 게이트**의 요구사항이지 새로운 법률상 인정 기준이 아님.
- SQL feature 매핑은 `value_json`, `value_won`, `status`를 별도로 저장하도록 되어 있으나 합성 결과를 SQL에 실제 INSERT하지 않았고, 공식 D5103 DOCX를 생성하지 않음.

## 3. 실제 main 표현식 격리시험과 수정안
GitHub main의 실제 `buildFormBindings()` 내 `approved_monthly_income` 삼항식 코드를 추출해 V8 `new Function`으로 실행했다. 의존 `factSourceLineageIssues`만 합성 정상 반환값으로 대체. PR 분기에서 다시 가져온 변경 후 **Git blob `b7b77a873bf27d8a53b54a4807f3e2e96fa47430`** 에 대해서도 동일 10개 케이스를 재실행함. 실제 소스식/합성값 검증이며 전체 모듈 import/TS 프로젝트 테스트가 아님.

| 합성 조건 | 독립 기대 토큰 | main 실제 | PR #98 실제 |
|---|---|---|---|
| 분류·사유 모두 검토완료 240만 | `2400000` | `2400000` | `2400000` |
| 독립소득 명시·미승인 | `[확인 필요]` | **`2400000`** | `[확인 필요]` |
| 연속자료 검토표시만·사유 공백 | `[확인 필요]` | **`2400000`** | `[확인 필요]` |
| `unknown` 분류·미승인 | `[확인 필요]` | **`2400000`** | `[확인 필요]` |
| 분류 미지정 | `[확인 필요]` | **`2400000`** | `[확인 필요]` |
| 검토완료된 명시적 0 | `0` | `0` | `0` |
| 검토 전 명시적 0 | `[확인 필요]` | **`0`** | `[확인 필요]` |
| 계산 금액 `null` | `[확인 필요]` | `[확인 필요]` | `[확인 필요]` |
| 대표기간 `null` | `[확인 필요]` | **`2400000`** | `[확인 필요]` |
| 법적 인정 `unreviewed` | `[확인 필요]` | `[확인 필요]` | `[확인 필요]` |

기대와 일치 **main 4/10 → 수정 분기 10/10**. 이것은 내부 승인 토큰 반례의 정확한 재현이지 실제 D5103 최종 생성 또는 법원의 법률상 인가 불합격 입증이 아님.

## 4. 수정 / 검증 단계
- Draft [PR #98](https://github.com/firmengine/firmengine/pull/98), 분기 `audit/a2-r36-law-approved-income-guard-20261101-0017`; 코드 커밋 `6f7b34bcccfe30f4737ffdcf789b0aaae2084fa4`, 신규 회귀 테스트 `586f111b59115bd97eec9a001866bedc55fe88e3`.
- 수정은 `lib/form-mapping.ts`의 **승인된 월소득** 토큰 조건식만 강화: 대표기간 존재 + 모든 계산에 포함된 소득원 집계분류 명시·담당자 검토·사유 필수. `monthly_income` 관측 미리보기, 원천 Fact, 계산엔진 월소득, 세무 산식은 그대로.
- 새 `tests/a2-law-approved-income-guard-r36.test.mjs`는 실제 소스식을 읽어 10개 합성 경우를 검증하도록 작성. **GitHub 저장 테스트파일을 Node `--test` 명령으로 실행하진 못했음**. 격리 V8 10/10과 구별.
- GitHub 비교 API에서 변경경로 **2개 모두 ax-site 내부** 확인, Draft·미병합. #76 같은 토큰 수정과 충돌하므로 신중한 병합 필요. 법률/계산 의미를 최종 확정하지 않음.
- 미해결: #76의 완전월·미래월/경계월 검사, #93의 첫/끝월 11/12 누락, #96의 사건 전체 월소득 집계, #84 청산가치 검토, #49/#87 계산 head 저장 경쟁, 실제 18모듈→91입력→SQL→서식 E2E.

## 5. 정적 계약과 법률 원문
- `lib/reference-decision-tables.json`: 계산 모듈 **18**, 입력 선언 **91**, 출력 선언 **42** (JSON 재파싱). `lib/template-token-catalog.json`: **D5103 37**, **D5110 55**, **D5111 82** 토큰. 정적 등록 수이며 91개 피처 실제 계산이나 Word 출력 성공 의미 아님.
- [국가법령정보센터 채무자회생법 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777): **법률 제21490호, 시행 2026-10-02**; 3년 기본/특별사정 5년 범위 및 변제계획 기재사항. 이번 검토에서 법률 자동규칙 추가하지 않음.
- [서울회생법원 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): **게시 2026-10-01**, 실무준칙 제424호 제2조 제2항 제7호 신설. **개정전문 PDF·부칙/경과조치·개별 사건 적용일 미검증**이므로 공지일을 적용일로 대체하거나 승인 없이 규칙 실행 금지.
- [국세청 부가가치세 과세기간 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 통상 6개월, 간이과세자 통상 1년 과세기간. [종합소득세 공식 개요](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7669&mi=2224). 신고·과세기간이 개인회생 법적 인정소득과 자동 동치라는 규칙은 없음. VAT/종소세 중복 및 실제 사업순소득 대조 미완료.

## 6. 다음 담당자 및 미인수
- 다음 r37 **데이터담당자**: #98/#76의 `approved_monthly_income` 보존 병합 충돌, #96/#97의 동일 Fact·원천집계 승인 충돌, 기준정보 SHA/Fact/typed/SQL feature 이력 연결, `null`/명시적 `0`/미관찰/승인전 및 월별 첫·마지막·미래월 적재·재조회 확인.
- 정식 Node 프로젝트 테스트·타입검사·전체 CI·staging D1/R2/Cron·실제 DOCX와 법원 공식 서식 동등성·법률 실무자 승인 모두 **미실행/미확인**. 운영 배포, 운영 D1 마이그레이션, 실제 전자제출, 법원 인가 확정 **실행하지 않음**. 개인정보/실고객 문서/OCR 사실값/키/.env/비공개 정답 공개 Git 기재 없음.
