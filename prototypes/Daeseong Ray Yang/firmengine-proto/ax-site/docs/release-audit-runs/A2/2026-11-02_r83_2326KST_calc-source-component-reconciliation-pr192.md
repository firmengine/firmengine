# FirmEngine A2 r83 — 계산사무장: 원금·이자 원천 구성액별 배분 보존 / 변제원장 교차 감사

- 기준: 2026-11-02 23:26 KST 시작. 순환 **r82 사용자·서류담당자 → r83 계산사무장 → r84 변호사**.
- 허용 변경: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 모든 데이터 SYN 합성. 고객 개인정보·원본 OCR·비밀키·.env·비공개 정답 없음.
- 감사 시작 main HEAD `d0e50d7565723d68e0605210b9cf695fd4aaa0e9`; 본 영수증 기록 직전 HEAD `d0e50d7565723d68e0605210b9cf695fd4aaa0e9`; 직전 단일 중앙 보드 blob `5462a0720174bef0657204b6473feb627fa0c71a`. 이전 [r82 영수증](2026-11-02_r82_2225KST_doc-strict-printed-krw-d5110-pr190.md), r81 영수증, 최근 main commits 및 Draft PR #188/#190을 확인. 이 서술은 본 영수증의 범위만 증명.
- main·부모 Draft #188 `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; #188 `lib/repayment-plan-model.ts` blob `8194631ec6fae948e5db12825219afbab47f50b2`. 현 main `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`; 기존 `tests/repayment-plan-model.test.ts` blob `b5ba94a3264a42fcbda6135f6c59f4fdfb0d9988`, `package.json` blob `8129160e33af3ae250c757a6a8195a29674ad031` 읽음.
- 기존 Draft #188은 미병합 Fact ID 기본/검토원장 방어, Draft #190은 별도 #181 기반 미병합 D5110 표시 재독; 본 수정은 **#188에 쌓은 Draft [#192](https://github.com/firmengine/firmengine/pull/192)**, 별도 독립 main 병합 불가.

## 1. 실제 원본 함수 실행 / 독립 산술 오라클 / 관찰

- 실제 GitHub `reconcilePlanLedger()` 함수 본문을 TypeScript 주석/타입 표기만 최소로 제거해 V8 `new Function`에서 실행. 외부의 `moneyValue`만 `amountWon→BigInt`인 합성 대역 주입; 실제 원본의 월별·채권별 금액 루프와 issue/result 분기는 그대로. 변제기간마다 원금·이자 납부를 별도로 BigInt 누적하고 각 **관측된 원금/이자 구성액**을 상한으로 비교하는 독립 기대 사전정의. 이것은 계산 의미에 대한 **기술적 무결성 oracle**이며 법원 인정/이자 변제 법적 판단은 아님.
- SYN 사건 revision8, 채권자 `SYN-D`, 원천 Fact `SYN-F-1`, 월 사용가능액=월 배분액, trustee fee **명시적 0원**, 월 1회씩 36/48/60개월, 계산 `planTotalWon=개월×월지급액`. 원천 원금과 이자는 임의 합계가 아닌 각기 별도 관측 구성액.
- 6종 × 36/48/60 = **18개 독립 시나리오**의 실제 함수 격리 실행. 기존 원본문: **9/18** 기술 기대 일치. 후보 패치 원본문: **18/18** 기술 기대 일치. 실패 9건은 전부 기존 `reconciled/issues=[]`이었지만 원금 또는 이자가 **해당 원천 구성액을 초과한 경우**다.

| 합성 원천 원금/이자 | 월 원금/이자 | 36/48/60개월 독립 누적 | 독립 기술 기대 | 기존 reconciliation 실제 | 후보 실제 |
| --- | --- | --- | --- | --- | --- |
| 100/0원 | 1/0원 | 원금 36/48/60, 이자0 | reconciled | reconciled | reconciled |
| 100/**0**원 | 0/1원 | **이자 36/48/60 > 원천 이자0** | blocked | **reconciled** | blocked |
| 100/20원 | 0/1원 | **이자 36/48/60 > 원천 이자20** | blocked | **reconciled** | blocked |
| **0**/100원 | 1/0원 | **원금 36/48/60 > 원천 원금0** | blocked | **reconciled** | blocked |
| 0/0원 | 0/0원 | 0원 | reconciled(기술) | reconciled | reconciled |
| 20/0원 | 1/0원 | 원금 36/48/60 > 총액20 | blocked | blocked | blocked |

- 수정에 의해 `PAYMENT_EXCEEDS_SOURCE_PRINCIPAL:SYN-D` / `PAYMENT_EXCEEDS_SOURCE_INTEREST:SYN-D`를 누적; 기존 `PAYMENT_EXCEEDS_CLAIM`과 월별 ordinary/disposable 예산 검사 유지. 원금↔이자 재분류, 배분 자동재설정, 미관찰→0 대체, 법률상 이자 인정은 **하지 않음**.
- #188의 **실제 `buildRepaymentPlanModel()` 함수 본문**도 V8 격리 재실행(주변 날짜·수수료·정렬 helper를 결정적 합성 대역): 원천 원금100/이자0, 검토된 계획 매월 원금0/이자1, 36/48/60개월에 `complete/issues=[]`; 행수 72/96/120(일반채권+명시적 0원 수수료행), 원장 이자 합계 36/48/60원, 원금0. 즉 **원장의 기술적 complete가 최종 reconciled 또는 법률 인가라는 뜻이 아님**. 이 원장+재대조를 실제 단일 Node 프로젝트 실행으로 결합한 증빙은 아직 없다.
- **실제 Node 프로젝트 테스트 실행 0건.** 이번 GitHub에 추가한 Node `.test.mjs` 18개 테스트 그룹+TODO 3은 **작성·커밋만** 했다. 위 18+3 기간의 V8 함수 격리는 프로젝트 Node/전체 CI, D1, R2, Cron, 실제 Word DOCX ZIP/XML 재독, 법원 서식 검증으로 대체 불가.

## 2. 원천/Fact/typed/SQL feature 계약 및 18모듈·91입력·서식

- 실제 migration 0011 정적 원문: `case_calculation_runs`는 `case_id/data_version/case_revision/input_sha256/source_heads_sha256` 및 기준정보 판본을 저장. `case_calculation_features`는 `run_id/calculation_id/output_path/value_json/value_won/status/source_fact_ids_json/input_refs_json/formula` 저장. 본 회차 SQL INSERT/SELECT 또는 staging D1 **미실행**. 원장 `sourceIds=["SYN-F-1"]`는 표시용 합성 근거이며 실제 원문 문서/Fact 존재·동일 사건 owner·producer/current revision과 일치 검증 **미완료**.
- 합성 입력 예: raw/source observation = `SYN-EVIDENCE:원금100원/이자0원`(실제 OCR 아님), Fact = `SYN-F-1 / principal=100 / interest=0 / unapproved`; typed = `debt.id=SYN-D, principal.amountWon="100", interest.amountWon="0", factIds=["SYN-F-1"]`; SQL feature 형태 예시 = `run_id=SYN-RUN, output_path=..., value_json="36", value_won="36", status=provisional, source_fact_ids_json=["SYN-F-1"]`(**스키마에 맞춘 예시일 뿐 SQL 실제 저장 아님**). 실제 법적 source status가 verified/accepted가 아니면 금액은 법적 확정값으로 승격하지 않음.
- 현 main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` **정적 재파싱**: 계산모듈 18, 입력선언 91(고유78), 출력선언42(고유40), resultPaths42. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: 등록토큰 D5103=37/D5110=55/D5111=82. 이는 **모듈 실행/서식 토큰 치환·Word 재독이 아니다**.
- 독립 산술 보조: 12개월 급여 2,400,000원×12=28,800,000원; 사업 관측 11개월 1,000,000원×11=11,000,000원, 관측합계 39,800,000원. 12월 미래/미관찰은 **null**, 0이나 수입원승인으로 대체하지 않는다. VAT 매출·종소세 신고액을 독립 소득액으로 중복 가산 금지. 당회차는 이 소득 테스트를 실제 모듈에 실행하지 않았다.

## 3. 공식 원문 확인·관할/시행일 경계 (자동규칙 반영 금지)

- [서울회생법원 공식 2026-10-01 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 **제424호 제2조 제2항 제7호 신설**. 2026-10-01은 **공지일**. 붙임 개정 PDF의 부칙/경과조치와 개별 사건 적용일 **미인증**.
- [국가법령정보센터 2026-10-02 시행 채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): 변제계획 내용·기간/인가요건. 기술적 `reconciled`는 법률상 적합·공정·수행가능/청산가치 보장과 동일하지 않음.
- [국세청 공식 VAT/종소세 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806): 일반과세자 통상 6개월, 간이과세자 통상 연간 과세기간, 종소세 신고는 별도. 신고액을 법원 인정 월순소득으로 자동 확정/합산하지 않음.
- 법률/회계 및 원금·이자 변경·변제기간 36/48/60개월의 적법성은 실제 계산사무장/변호사 승인 전 **미인증**, 신규 자동 적용 규칙 없음.

## 4. 수정 / 체크 ID / 다음

- 제품 수정 별도 [Draft PR #192](https://github.com/firmengine/firmengine/pull/192), base는 미병합 [#188](https://github.com/firmengine/firmengine/pull/188)의 브랜치, 수정 2개 파일 모두 지정 prefix 내부: `lib/plan-reconciliation.ts`, `tests/a2-r83-calc-source-component-reconciliation.test.mjs`. PR HEAD `325f6c64fe613d5578bc0eb46fcb051b7a873e97`; 원본문 blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, 후보 코드 blob `9e496860699c0144e62ad0d7327f2d49340c00c9`. 미병합; 기존 Draft #43의 같은 reconciliation 파일 및 #190 doc stack은 수동 충돌 조정 필요.
- 체크: `A2-CALC-019` (원금/이자 구성액 상한), `A2-CALC-025` (월별 ordinary/가용소득 예산 유지), `A2-CALC-026` (36/48/60 독립 월별 배분 18건), `A2-CALC-030` (0·기존 초과·합성 오류). **네 ID 모두 부분 [ ] 유지**, 전체 인수 완료 **0건**.
- **다음 r84 변호사**: 상충 가능한 채권별 원금/이자·지연손해금·법원 인정 분류/우선·재단채권 기간·세금채권 판본과 실제 후순위 배분 법적 차단 경계 분리. Draft #192/#188/#190의 실제 Node/CI, 원문→Fact→typed→SQL→ledger→D5110/D5111 반복행과 `source_fact_ids_json`/원장 `sourceIds`의 사건·판본·producer 일치성을 검증. 비해당/미관찰/null/0/상충/source-only/승인전 차이는 독립 유지.
- **운영 배포·운영 D1 migration·실제 전자제출·법원 인가 확정 수행하지 않음.** 전체 CI·staging D1/R2/Cron·Word ZIP/XML·법원 공식서식 동등성·계산사무장/변호사 승인은 미완료.
