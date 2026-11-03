# FirmEngine A2 r108 — 변호사 관점: 서울 제424호 제7호 원천 Fact ID 상태 경계

- 회차: **r108**, 2026-11-04 00:12 KST 시작. 담당 역할: **변호사** (r107 계산사무장 → r108 변호사 → r109 데이터담당자).
- 작업범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 처음 조회한 main HEAD `dc38f209cbcff6e4877c6d44ea1e9de77c9c4bf8`. 시작 중앙 보드 blob `ac28c84c3df4c2efe95d36096c39fd70afcb002b`.
- 조회한 최근 main: `dc38f209` A1 r107 보드, `2c312e27` A1 r107 영수증, `d3df4379` A3 r107 보드, `1b913d27` A3 r107 영수증, `4042a1ae` A2 r107 보드. 관련 Draft #43/#194/#203/#215/#217/#221/#222/#223 재조회; 특히 #217은 1~6호 Fact ID를, #222는 세금·우선채권 정책을 다루며 **이번 제7호 증빙 네 요소와 별개**.
- 실제 main 코드 `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`, `lib/legal-proposals.ts` blob `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`; 이외 `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, `lib/case-execution.ts` blob `752049c087cc28b2d713eafb5dc3f7294623e8ae` 및 r107/r102/r104 영수증. `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; 계산 기준 JSON `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, 토큰 JSON `899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- **분석의 구분:** main 원 함수본문을 타입선언 표면만 제거하고 V8에서 재실행한 기술 관찰이다. 프로젝트 실제 Node `--test`, 전체 CI, D1·R2·Cron, DOCX·공식 서식·법원제출, 법률 판단 또는 변호사 승인을 실행/인증하지 않았다.

## 1. 신규 P1: 제7호 네 요건의 Fact ID 배열 형식 미검사

`evaluateSeoul424` → `wageCriterion` / `evidenceTri`는 `factIds.length`만 참이면 `sourceValidated=true` 및 `legallyRecognized=true`와 결합해 `yes`를 반환했다. Fact ID `[" "]`, `[""]`, `["SYN-D","SYN-D"]` 또는 런타임 문자열 `"SYN"`도 근거 배열로 오인할 수 있다. 본 증상은 1~6호 루트의 #217과 구분된다.

**합성 데이터의 실제 투입 형태:** `Seoul424Input`의 `courtId:"seoul"`, `firstFilingDate:"2026-10-02"`, `categoryRoutes:[{status:"no",factIds:["FACT-NO"], ...}]`; `wageHistory:{value:{wholeTwoYearBelowMinimum:true,reviewedPeriodYears:2,wholePeriodBelowMinimum:true,minimumWageVersion:"2026"},factIds:["SYN-WAGE","SYN-WAGE-V"],sourceValidated:true,legallyRecognized:true}`; 그 밖의 `totalDebtAtMost50MillionWon`, `noIndividualCreditors`, `noRecentYearDebtExceptGoodsPurchaseCard`는 모두 `{value:true,factIds:["SYN-..."],sourceValidated:true,legallyRecognized:true}`. 기준정보: 5천만원 상한, 최근채무 1년, 임금기간 2년. 전부 가상 객체이고 사건/실고객/진짜 OCR·Fact/법률 인정은 아니다. 계산 금액 자동승격에 사용하지 않는다.

### 독립 기대와 실제 V8 관찰 (원본 함수 직접 평가)

| 합성 변형 | 독립 기술 기대 | main 관찰 | Draft #224 관찰 |
|---|---|---|---|
| 정상 네 요건/유효 고유 Fact IDs | `candidate_for_human_review` | 동일 | 동일 |
| 임금 Fact ID `[" "]` | `unknown` | **candidate** | unknown |
| 임금 Fact ID 중복 | `unknown` | **candidate** | unknown |
| 임금 Fact IDs `[]` | `unknown` | unknown | unknown |
| 총채무 ID `[""]` | `unknown` | **candidate** | unknown |
| 총채무 ID 중복 | `unknown` | **candidate** | unknown |
| 개인채권자 ID `["\\t"]` | `unknown` | **candidate** | unknown |
| 최근채무 IDs `[]` | `unknown` | unknown | unknown |
| 최근채무 IDs를 문자열 `"SYN"`로 런타임 전달 | `unknown` | **candidate** | unknown |
| 법적 인정 false | unknown | unknown | unknown |
| 네 요건 중 명시적 false | `not_candidate_on_known_facts` | 동일 | 동일 |
| 2026-09-30 최초 접수 | `unsupported_version` | 동일 | 동일 |
| 타 관할 `busan` | `not_applicable` | 동일 | 동일 |
| 임금 원천 미검증 | unknown | unknown | unknown |

**독립 기대 일치: main 8/14 → Draft #224 14/14.** 단일 V8 격리 본문 검증이며 전체 제품 회귀나 법률 인정률이 아니다.

### 조치

- `lib/seoul424-candidate.ts` 에 `hasUsableFactIds` 가드 추가: 비어 있지 않은 문자열 배열·공백 이외 실제 문자열·중복 없음. 제7호 임금과 나머지 3요건의 근거 ID에 적용. 이상형은 `unknown`, 후보 route=null로 보류; 승인/법적 확정으로 승격하지 않음.
- **미병합 Draft PR [#224](https://github.com/firmengine/firmengine/pull/224)**. 신규 함수코드 blob `8a3c7cb5127a095fa9cbf48f5eef6ef72c532f33`; 추가된 `tests/a2-r108-seoul424-fact-id-evidence.test.ts` blob `cb1d633959bc3d9580d28c7c1b6ea68a9800f8d7`. 테스트 14개 작성·커밋했고 **프로젝트 러너에서는 실행하지 않았다**. V8 독립 검증 14/14와 구분해야 한다.
- 금액 계산/우선채권 정책/사건별 법률 인가는 변경하지 않았다. #217(1~6호)·#18(관할 미확인)과 합쳐 테스트 및 실제 실무자 승인 전 병합 금지.

## 2. 남은 승인·판본·결과 연결 문제

1. **최초 접수일 원천 미분리:** `buildLegalProposals`의 `const appDate=data.context.applicationDate`를 `evaluateSeoul424({firstFilingDate:appDate||null,...})`로 전달한다. 최초 법원 접수일 Fact ID·접수증·검증자 승인 정보 없음. `sourceChecked`는 수집 Fact의 `state=verified`, `recognition=accepted`, validation/lineage를 확인하지만 **사건 관할과 firstFilingDate의 진본 증명으로 대신할 수 없다**. `createCase` 기본 `applicationDate=asOf`, `courtId=seoul`은 진정성 증빙이 아니다. 가상 `applicationDate=2026-10-02`이더라도 최초 접수증 미관찰이면 독립 법률검토 기대는 `unknown`.
2. **관할 null 후보 승격 기존 위험:** main `evaluateSeoul424`는 관할 null 시 court_scope unknown을 조건에 남기지만, 충분한 제7호 조건에서 candidate를 반환할 수 있다. 기존 Draft #18/#217 해결 범위와 함께 검토할 것. #224는 이를 고치지 않는다.
3. **제611·614조와 기술적 covered 분리:** main `reconcilePlanLedger`는 빈 `priorityPolicies`에도 `covered` 오판과 형식오류 금액 `BigInt` SyntaxError 위험이 있으며 #222, #43, #203, #223이 상호 보완이 필요하다. 이 회차 법률 테스트에서는 원장 통합실행을 하지 않았다. 법원이 요구하는 채권 전액 지급, 현재가치·청산가치·이의·수행가능성은 기술적 합계로 대신할 수 없다.
4. **실제 저장형식 한계:** `CaseData.context.applicationDate/courtId`와 `Fact`의 `id/state/recognition/refs` 구조, `case_calculation_runs`의 `inputSha256/referenceSha256/dataVersion/caseRevision`, `case_calculation_features`의 `valueJson/valueWon/status/sourceFactIdsJson/inputRefsJson` 스키마를 정적 재독했다. 이 회차는 해당 SQL을 적재·재조회하거나 원문→Fact→typed→SQL→법률 판단→DOCX를 종단 실행하지 않았다. 미관찰/null/진짜0/source-only/승인전/상충 상태는 각각 별개다.

## 3. 전체 계산·서식 계약은 정적 재독에 한함

main 참조 JSON 실제 파싱: **18 모듈, inputs 91 선언/78 고유, outputs 42 선언/40 고유, resultPaths 42/42 고유**. 서식 token catalog 파싱: **D5103=37, D5106=48, D5110=55, D5111=82**. 각 문서 바이트·입력/출력 실계산 및 법원 서식의 실제 합격 아님.

## 4. 공식 원문 — 법원·시행일·원천

- **서울회생법원** [실무준칙 개정전문](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2): 웹 PDF 이미지 **0-index 271면 제424호(2026-09-23 개정), 272면 제2조②7호 4 누적요건, 391면 2026-09-23 부칙** 직접 열람. 2026-10-01 시행, **이후 최초로 접수된 사건부터 적용**, 기존 인가계획 효력 불변. 서울 외 관할 자동 적용 금지.
- **국가법령정보센터** 채무자 회생 및 파산에 관한 법률 [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): **[시행 2026.10.2.] 법률 제21490호** 본문 확인. 개인회생재단채권/일반우선권의 기재·전액변제와 법원 인가요건은 별도.
- **국세청** [VAT 신고안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 6개월·간이과세자 통상 1년 과세기간. VAT 신고매출/종합소득세 신고액을 승인 월순소득으로 바꾸지 않았다.

## 5. 중앙 보드 체크 ID / 다음 차수

- `A2-LAW-015 [ ]` — 서울 제424호 본문·제7호·부칙·2026-10-01 최초접수 경계 원문 확인. 사건 관할/접수 승인 미관찰.
- `A2-LAW-016 [ ]` — 제7호 4 누적요건의 원천 Fact ID 구조 14조건 원본 V8 main 8/14→Draft 14/14. 실제 Fact 존재·사건 소유·판본·정식 Node 미인증.
- `A2-LAW-021 [ ]` — 2026-10-02 법률/2026-10-01 서울준칙/국세청 원문 판본·출처 및 적용법원 구별. 개인 사건 적용/전문가 승인 미인증.
- `A2-LAW-023 [ ]` — 본 후보는 `candidate_for_human_review`; 변호사 승인·인가 또는 제출 성공 추정 금지. `firstFilingDate`/법원 관할 원천 근거 아직 비어 있음.

다음 r109 **데이터담당자**: `firstFilingDate`를 실제 최초접수 증빙 Fact/사건판본과 분리한 계약, 제7호·제1~6호 ID의 DB owner/revision 확인, #18/#217/#224의 결합·실제 Node 회귀, `priorityPolicies` 승인 계보 및 원장 실패값 null/0 전달. 18계산/91입력/42출력/Word 토큰 실제 E2E 필요.

**제품 인수 완료 0건.** 운영배포·D1 운영 마이그레이션·전자제출·법원인가 확정 미수행. 공개 Git에 실고객 문서/PII/OCR원문/키/.env/비공개 정답은 추가하지 않음.
