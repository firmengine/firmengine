# FirmEngine A2 r90 — 변호사: 세금채권 분류·배분재원 교차검증 및 법률 승인 경계

- 회차: 2026-11-03 06:07 KST 기준. 순환 **r89 계산사무장 → r90 변호사 → r91 데이터담당자**.
- 허용된 GitHub 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 한정.
- 시작 시 확인한 최신 main SHA: `ebf869c47bb57b5d20a3ecad53515e9ff7b2bdee` (2026-11-02 21:01:35 UTC); 직전 A2 r89 영수증·PR #203/#194/#192·중앙 보드·실제 소스·기존 테스트·계산 SQL DDL 재독.
- 실제 main blob: `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`; `lib/legal-calculation-readiness.ts` `9edab755df5adae5f143d15285c550feb0e0f6d5`; `lib/office-writer.ts` `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`; `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`. 법령 카탈로그 `legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`.
- PR 코드 SHA: Draft #203 reconciler `fcefc9239808c9c1356b6eb4bc438efe5ac51bf9`; Draft #194 stacked reconciler `2a3645defb2b613da68f3a9044f149713925fd4e`. Draft #194는 #192(원금/이자 구성액 상한), #188 등 상위 스택에 의존한다. **main 제품 코드에는 각 변경이 반영되지 않았다.**
- 사용자 자료·OCR·문서·키·실제 사례는 일절 사용하지 않음. 모든 ID `SYN-*`는 합성. 이번 회차 **제품 수정/신규 PR/병합/배포 없음**. PR #203에 독립 HOLD 검토 [댓글 #6588583772](https://github.com/firmengine/firmengine/pull/203#issuecomment-6588583772) 기록.

## 1. 독립 통합 교차시험: A2-LAW-007 / 022 / 023 (모두 [ ] 유지)

**입력 원형(실제 TypeScript 함수가 소비하는 구조):** `data.context.{planMonths,paymentSchedule.expectedInstallments,paymentSchedule.phases[].monthlyAvailableWon,monthlyPriorityPayment.amountWon,monthlyEstatePayment.amountWon,monthlyTrusteeFee.amountWon}`, `data.debts[].{id,classification,priority,legalReview,principal.amountWon,interest.amountWon,factIds}`, `calculation.{ordinaryRepaymentBudgetWon,monthlyPaymentWon,disposableIncomeWon,planTotalWon}`, `ledger.{status,issues,rows[].{installment,debtId,claimClass,fundingSourceId,principalWon,interestWon,otherComponentWon,balanceAfter,sourceIds}}`.

각 조건은 36·48·60개월 별로 동일 구조 사용. `classification=tax,priority=ordinary,legalReview=unreviewed`는 법률상 우선권 인정값이 아니라 **합성 원천 상태**다. 양수 시 월 배분 원금은 명시적 `"1"`, 이자 `"0"`, sourceIds `["SYN-F"]`; 0원은 `"0"`, 미지급은 zero trustee-fee 행으로 36/48/60개월을 채워 missing-month와 구별. `principal=개월수+1`, 지급 `개월수`면 미지급 **1원**. VAT·종소세는 월 소득 및 채권 원금으로 자동 환산하지 않는다.

| 36/48/60 각 3번 반복한 합성 사건 | 독립 기술 기대(병합 후보) | main 단독 | #203 단독 | #194 스택 단독 | 메모리 결합 기술 후보 |
|---|---|---|---|---|---|
| 세금분류 원금=개월수, 월1원 전액 배분, 법적 검토 unreviewed | 기술 reconciled, **법률 미인증** | reconciled | reconciled | reconciled/covered | reconciled/covered |
| 세금분류 원금=개월수+1, 월1원 지급 | blocked/부족 1원 | **reconciled** | **reconciled** | blocked | blocked |
| 세금분류 원금 양수, 매월 0원 | blocked/미지급 | **reconciled** | **reconciled** | blocked | blocked |
| 세금분류를 ordinary claimClass로 잘못 표시 | blocked/클래스 불일치 | **reconciled** | blocked | **reconciled** | blocked |
| 세금 우선행에 ordinary_budget 재원 사용 | blocked/재원 불일치 | **reconciled** | blocked | **reconciled** | blocked |
| 세금분류 원금 명시적 0원, 배분 0원 | reconciled, **0 유지** | 별도 미측정 | 별도 미측정 | 별도 미측정 | reconciled/covered |
| 일반채권 정상·월1원 | reconciled | reconciled | reconciled | reconciled | reconciled |
| 기존 priority 정상·월1원 | reconciled | reconciled | reconciled | reconciled | reconciled |

**실제 실행:** GitHub `main`, #203, #194의 정확한 `reconcilePlanLedger` 함수본문을 확보하고 import/TypeScript 타입 표기만 제거, `moneyValue`는 합성 `amountWon`을 BigInt로 바꾸는 어댑터로 교체하여 V8 격리실행. 위의 7개 공통 시나리오 × 3개월유형 = **버전별 21/21 독립 기술 기대 판정 일치**. 추가로 #194 소스에 #203 diff의 **클래스/재원/채권ID 확인 블록과 미등록 클래스 합산 제외**만 메모리에서 합성한 **비커밋 통합 후보**에서 8개 시나리오 × 3개월유형 = **24/24 기대 판정 일치**. 주요 시나리오별 `priorityCoverage`와 `issues`도 재독. 이는 **실제 Git 병합, 프로젝트 Node 러너, CI, 운영 DB/D1, Word 출력이 아니며 병합가능성 인증 아님**.

**새로운 교차 위험:** #203만 병합해도 세금채권 1원 미지급이 여전히 기술 `reconciled`다. #194만 병합해도 잘못된 채권 등급/재원 연결이 `reconciled`다. 둘을 독립 기술 수정으로 보는 것은 타당하지만, **양쪽을 실제 결합 검증 없이 각자 완료 처리해서는 안 된다**.

**법률 승인 위험:** 세금 채권의 `legalReview="unreviewed"`라도 전액 배분 시 main, 두 Draft 및 비커밋 합성 모두 `reconciled`; `legalReviewTasks`는 빈 배열이었다. #203의 `classification==="tax"` → priority 기대분류는 **이미 존재하는 원장 생성기의 기술 규칙과의 일치 비교일 뿐 법적 우선권 심사가 아니다**. 원천 Fact 존재, 동일 사건, 조세의 종류·납기/우선권/재단채권 여부, 권리관계·관할·인가요건은 별도 사람 승인 전 미인증. `office-writer.ts`는 final에서 `planReconciliation.legalReviewTasks`를 차단 조건에 포함하지만 **이 합성 전액 tax 케이스에는 과제 자체가 생성되지 않았음**. 이미 승인된 법적 분류라는 결론 금지. 별도 인정/근거/버전 게이트 설계는 변호사 검토 전 제품 코드에 강제하지 않음.

## 2. 법원·시행일·출처: A2-LAW-019 / 021 ([ ] 유지)

- **2026-11-03 공식 웹 확인:** [서울회생법원 2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187)에는 실무준칙 제424호 제2조 제2항 제7호 **신설 발표**가 있다. 보도자료 **공지일**이 특정 신청 사건의 **적용일**이라는 증명은 아니다. 첨부 PDF의 424호 부칙·경과·신청일/관할 별 사건 적용은 **이번 회차 직접 열람·검증하지 않음**.
- [국가법령정보센터 채무자회생법 제611조](https://www.law.go.kr/LSW/lsLinkProc.do?joNo=061100&lsNm=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0&mode=11), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759), **2026-10-02 시행 법률 제21490호**: 제611조 제1항의 일반 우선권 채권/재단채권 전액 변제 기재 및 제5항 3년 원칙·5년 특별 사정; 제614조 법률적 적합성, 공정·형평, 수행가능성 및 청산가치 비교는 단순 원장 `reconciled`와 별도.
- [국세청 부가가치세 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2355): 일반과세자 6개월, 간이과세자 통상 1년의 신고기간. 세금신고 기간·매출과 법원 인정 월 순소득은 자동 동일시 금지. 해당 자료를 개별 세금채권 우선권 판단의 법률 근거로 사용하지 않음.
- 최신 main `lib/legal-catalog.json` 원문 재파싱: `law-611`, `law-614` `effectiveFrom="2026-10-02"`, `application_review_required=true`; `seoul-practice-2026` `territorial_scope="서울회생법원"`, `edition_effective_date=null`, `application_review_required=true`. 그러므로 서울 준칙을 부산·관할 미관찰 사건이나 시행일 미결정 사건에 자동 확장하면 안 된다. 카탈로그 자체 역시 실제 법적 적합성의 증거가 아님.

## 3. SQL 피처·계산계약·서식 토큰 (정적 재독만)

- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` **18 계산모듈, 91 입력 선언(고유 78), 42 출력 선언(고유 40), 결과경로 42개(고유 42), 미등록 계산 의존 0개** 재파싱.
- main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` **D5103 37, D5110 55, D5111 82 토큰** 재파싱.
- SQL 0011의 `case_calculation_runs`, `case_calculation_features`, `case_calculation_heads` 및 `source_fact_ids_json`·`value_json`·`value_won` 저장 계약 재독. 본 회차에서는 **실제 SQL INSERT/SELECT나 18모듈의 전체 실행, 42결과 재계산, 공식 DOCX ZIP/XML 생성·재독 없음**. 선행 회차의 SQLite 모사 6/6은 이 회차의 실행으로 합산하지 않음. Raw/Fact/typed/SQL feature/원장/서식의 일체 계보 아직 미인증.

## 4. 종료 상태·다음 역할

- 중앙 보드 `A2-LAW-007, A2-LAW-019, A2-LAW-021, A2-LAW-022, A2-LAW-023`의 **해당 ID만 부분 감사 영수증 보존 병합**; 모두 미완료 `[ ]` 유지. 법률·계산 적합성 최종 인수 완료 **0**.
- **차기 r91 데이터담당자:** 실제 원천 `Fact.id`의 존재/인정/소유관계/판본 → `debt.factIds`/원장 `sourceIds` → SQL `source_fact_ids_json`/run revision → D5110/11 출력근거의 종단 연결 확인. 다음 계산사무장/변호사 교차에서는 #192·#194·#203 간 실제 Git 충돌 해소, 36/48/60·명시 0/null/미관찰·법적 부채유형/납기 전수 합성 Node 회귀 + 변호사/실무자 분류 승인 필요.
- 수행하지 않음: 전체 CI, staging D1/R2/Cron, 공식 법원서식과의 동등성, 법원별/사건별 법률 효력 확정, 실제 고객문서·전자제출, 운영 배포·D1 운영 마이그레이션·법원 인가.
