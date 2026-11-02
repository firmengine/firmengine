# FirmEngine A2 r84 — 변호사 관점: 세금 분류 채권의 변제원장·우선채권 커버리지 교차검증

- 기준: **2026-11-03 00:23 KST**. 역할 순환 **r83 계산사무장 → r84 변호사 → r85 데이터담당자**.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 운영·전자제출·법원 인가 행위 없음. 모든 금액·Fact ID는 **SYN 합성**이며 고객 정보·OCR 원본·키·.env·비공개 정답 미포함.
- 읽은 시작 `main` SHA **`e877e416ad47cecd4c3c3069ec5d2ccaf0f0ad84`**; A2 보드 기존 blob `f7e63c188b8564647a7f0c88750a2bf37a2cca12`. 최신 main 최근 A4 감사 커밋 등, [r83 A2 원장 영수증](2026-11-02_r83_2326KST_calc-source-component-reconciliation-pr192.md), Draft PR #192·이전 #188/#190 상황을 먼저 조회.
- 실제 GitHub 모듈과 테스트·SQL 기준: Draft #192 부모 `lib/repayment-plan-model.ts` blob **`8194631ec6fae948e5db12825219afbab47f50b2`**, `lib/plan-reconciliation.ts` blob **`9e496860699c0144e62ad0d7327f2d49340c00c9`**; main `tests/repayment-plan-model.test.ts`, `drizzle/0011_case_calculation_features.sql` blob **`0caa359d250dce45765d269d271ad63170ec3efa`** 및 기준정보/서식 토큰 카탈로그를 재독.
- 기초 위험: 원장 작성은 `debt.classification === "tax"`를 `priority` 행으로 분류하지만, **검토완료 일정의 제로 지급 확인과 재대조의 `isPriority`는 같은 조건을 누락**. `priority:"ordinary"`이면서 `classification:"tax"`인 **상충/승인전** 입력에서 지급 누락·부분 지급이 정상 판정될 수 있다. 법률상 세금채권 우선권을 자동 판정하지 않고 기존 코드 두 판단 축 간 모순만 진단한다.

## 1. 독립 기술 오라클 / 실제 함수 격리 실행

조건은 **독립적으로 먼저 정함**: 현 시스템이 이미 `classification:"tax" → claimClass:"priority"`로 계산한 원장에 대해서는 동일 기술상 우선채권 지급 누락·기간 내 부족분이 재대조에서 발견되어야 한다. 단, 이 독립 오라클은 **세금의 실제 법정 우선권·재단채권 여부나 승인기간을 판단하지 않는다**.

합성 공통 입력: 사건 `SYN-CASE` revision 8; 채권 `SYN-DEBT`, Fact `SYN-FACT-1`; 원금·이자를 별도 원화 문자열로 관측; 이자 명시적 **`0`** (일부 추가 작성 테스트는 미관찰 `null`); 회생위원보수 `0`, 월 우선채권 가용 예산 `1`, 월 재단예산 `1`, 월 총 가용소득 `1`; 검토된 변제일정 `reviewed:true`, 시작일 `2026-12-31`; 월수 **36/48/60**; 월 지급 `0` 또는 `1`.

| 합성 채권/배분 조건 | 독립 기술 기대: 원장/재대조 | 부모 #192 실제 | 수정 후보 실제 |
| --- | --- | --- | --- |
| 세금 분류, 원금100·지급0 | blocked / blocked | **complete / reconciled** | blocked / blocked |
| 세금 분류, 원금=기간+1원·매월1원 | complete / blocked | **complete / reconciled** | complete / blocked |
| 세금 분류, 원금=기간원·매월1원 | complete / reconciled, priorityCoverage=covered | complete / reconciled, coverage **누락** | complete / reconciled, covered |
| 세금 분류, 원금·이자 명시0·지급0 | complete / reconciled, coverage=covered | complete / reconciled, coverage **누락** | complete / reconciled, covered |
| 일반채권, 지급0 | complete / reconciled(법률 승인 아님) | complete / reconciled | complete / reconciled |
| 명시적 priority, 원금100·지급0 | blocked / blocked | blocked / blocked | blocked / blocked |
| 명시적 estate, 원금100·지급0 | blocked / blocked | blocked / blocked | blocked / blocked |

- **부모 #192 실제 함수 본문**(`buildRepaymentPlanModel`, `reconcilePlanLedger`)을 TypeScript 타입·import만 제거한 V8 격리환경에서 재실행. 외부 `moneyValue`는 `amountWon → BigInt`의 **결정적 합성 대역**. 본문 월별 루프·상태/issue 분기는 유지.
- **7조건×3기간=21개** 상태 오라클 중 부모 **15/21**, 수정 후보 **21/21** 일치. 기존 불일치 6건은 지급0(3기간) 및 부분지급(3기간)에서 **허위 정상**. 이는 실제 프로젝트 Node 실행 결과가 아닌 **원본문 V8 격리결과**다.
- 추가로 신규 `.test.mjs`에 **8조건×3기간=24개 합성테스트 + TODO 3개** 작성. 최신 후보 파일 자체를 V8 대역에서 시험 본문 실행하여 **24/24 pass, 0 fail, 3 TODO**. `normalizeMoney`는 테스트에서 합성 `amountWon` 대역으로 주입했으므로 실제 `node --experimental-strip-types --test` 통과라 주장하지 않는다. **프로젝트 Node 테스트 러너 0건, 전체 CI 0건.**
- 독립 산술: 부분지급 `원천 기간+1 − (1원×기간) = 1원 미지급`(36개월 37−36=1, 48개월 49−48=1, 60개월 61−60=1). 원천 0과 미관찰 `null`은 구분; 후자는 추가 작성 테스트에서 `REVIEWED_SOURCE_DEBT_COMPONENT_UNRESOLVED`와 우선커버리지 `unknown` 대상.
- **기술적 `reconciled`가 변제계획 법원 인가·법률 적합성·서식 승인이라는 의미가 아니다.** 48/60개월은 제611조에 따른 별도 특수 사정·법원 판단 필요.

## 2. Raw → Fact → typed → SQL feature → 원장 → 서식의 경계

- **합성 모양 예시(저장/실행 아님):** Raw `SYN-PAPER: 채권원금37원, 이자0원` → Fact `SYN-FACT-1 / principal=37 / interest=0 / state=extracted / recognition=unreviewed` → typed `debt.id=SYN-DEBT, classification=tax, priority=ordinary(상충/승인전), principal.amountWon="37", interest.amountWon="0", factIds=["SYN-FACT-1"]`.
- SQL Migration 0011은 `case_calculation_runs`(`case_id/data_version/case_revision/input_sha256/reference_sha256/source_heads_sha256`) 및 `case_calculation_features`(`run_id/calculation_id/output_path/value_json/value_won/status/source_fact_ids_json/input_refs_json/formula`)를 저장한다. `source_fact_ids_json=["SYN-FACT-1"]`, `value_won="36"`, `status="provisional"`는 **스키마 기반 예시**이며 실제 INSERT/SELECT·동일 사건 소유/producer/revision 검증 아님. 원장 `sourceIds`의 존재·소유·타입·승인은 **미검증**.
- 현 main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`를 정적 재파싱: 계산모듈 **18**, 입력 선언 **91(고유78)**, 출력 선언 **42(고유40)**, 결과경로 **42**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5110 **55**, D5111 **82** 등록토큰. **정적 카탈로그 확인**이지 18모듈 실행/SQL 조회/DOCX 생성·바이트 재독/법원 공식서식 동등성의 증거가 아니다.
- 급여·사업소득, VAT·종소세, 채권 원금·이자·지연손해금, 청산가치·PV, 공식 서식의 현장 인정은 이번 회차 실측 E2E가 아니다. 전회차 12×240만원=2880만원 + 관측 사업 11×100만원=1100만원의 산술합 3980만원은 **독립 예시**만 유지; 미래 12월 사업 `null`을 0으로 채우거나 법적 인정값으로 승격하지 않음. VAT/종소세 신고액과 반복 매출을 이중 소득으로 산입하지 않음.

## 3. 공식 원문·관할·시행일 (2026-11-03 조회)

- **[서울회생법원 2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187):** 실무준칙 **제424호 제2조 제2항 제7호 신설 공지**. **10월 1일은 공지 작성일**; 붙임 PDF 개정전문/부칙/경과조치·사건별 법원/신청일 적용 여부를 이번 회차에는 확인하지 못했으므로 **효력일 자동 설정·규칙 자동 채택 금지**.
- **[국가법령정보센터 법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR):** **법률 제21490호 / [시행 2026.10.02.]**. 제611조①② 우선권채권·재단채권의 변제계획 기재, 제611조⑤ 원칙 3년·특별사정 5년 범위, 제614조 공정·형평·수행가능성·인가기준. 실제 세금채권의 우선성·소멸시효·납기·변제예외는 **사건별 변호사 검토 대상**.
- **[국세청 과세기간/종합소득세 안내](https://d.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486):** 일반과세자 VAT 6개월, 간이과세자 통상 1년, 종합소득세는 별도 연간 신고. 신고세액과 월 가용소득을 법적 승인 없이 동일시하지 않는다.
- 적용 관할(서울 외 법원), 신청/인가 관련일, 법원 공인 최신 D5103/D5110/D5111 서식 및 변호사·계산사무장 최종 인수는 **미인증**.

## 4. 변경·충돌 방지·A2 체크 ID·다음

- **제품 변경은 [Draft PR #194](https://github.com/firmengine/firmengine/pull/194)에만**. 부모 [#192](https://github.com/firmengine/firmengine/pull/192)의 미병합 브랜치에 쌓은 별도 3파일 변경: `lib/repayment-plan-model.ts`, `lib/plan-reconciliation.ts`, `tests/a2-r84-law-tax-priority-review-parity.test.mjs`. 본문 **기존 tax→priority 매핑과 coverage 검사의 2축 일관성**만 수정; 원금/이자 재분류·새 인정규칙·시행일 룰·청산가치 산식은 변경하지 않음. 후보 repo HEAD `14752a28f63e22805bbb35321cf873f52878e960`; 변경 파일 3개는 **모두 허용 prefix**.
- 코드 자체 Draft 상태: 실제 법원·세무 분류 의미 변경 위험, 기존 #43·#188·#190 및 다른 병렬 Draft와 충돌/회귀 검증 필요. **실무자 승인·Node/CI·staging D1·R2/Cron·실제 DOCX ZIP/XML·공식 서식 검증 전 병합 보류.**
- 본 r84에서 다룬 보드 체크 ID **`A2-LAW-007`**(세금 우선권/지급 누락), **`A2-LAW-014`**(36/48/60 산술과 법적 변제기간 분리), **`A2-LAW-015`**(424 공지·적용 경계), **`A2-LAW-018`**(611/614 내부 기술검증 분리), **`A2-LAW-022`**(허위 reconciled 및 미승인 확정 방지). **전부 [ ] 부분 감사, 최종 제품 합격 0건**.
- **다음 r85 데이터담당자**: Tax+priority source Fact의 동일 사건·revision·producer·recognition 및 `source_fact_ids_json`→`sourceIds` 검증, SQL `0/null/미관찰/source-only/상충` 보존; #194/#192/#188 실제 Node 테스트, #190 서식 파서와 결합한 D5110/D5111 반복행 및 금액·우선채권 미납 검사. 법률 분류·원금 이자/이의·청산가치/할인율·법원별 준칙 및 사건별 시행일은 변호사·계산사무장 검토 전 **미인증**.
