# FirmEngine A2 r89 — 계산사무장: 변제원장 채권분류·재원 출처 불일치 차단

- 회차: **2026-11-03 05:10 KST**; 순환 **r88 사용자·서류담당자 → r89 계산사무장 → r90 변호사**.
- 정확한 작업 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 시작 GitHub main HEAD: `5ee2e879cb0ab905c6c9b739aec5bf1881cc354f`; 영수증 작성 직전 HEAD: `5ee2e879cb0ab905c6c9b739aec5bf1881cc354f`. 이전 r88 영수증, 중앙 보드, 최신 main 커밋/PR 및 아래의 소스/스키마/테스트 작성 코드를 재독.
- 확인한 main blob: `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; SQL 0011 `0caa359d250dce45765d269d271ad63170ec3efa`; `reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`; `template-token-catalog.json` `899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- 최근 검토: [r88](2026-11-03_r88_0409KST_doc-strict-preflight-month-creditor-pr200.md), [Draft #200](https://github.com/firmengine/firmengine/pull/200), [Draft #199](https://github.com/firmengine/firmengine/pull/199), [Draft #192](https://github.com/firmengine/firmengine/pull/192), [Draft #194](https://github.com/firmengine/firmengine/pull/194). #192·#194는 같은 reconciliation 파일을 변경하므로 후보 변경의 통합검토가 필요하며, #200은 다른 사전검증 파일이다.

## 1. 재현 결함: class/funding/채권 원천 연결 검증 누락

현재 main `reconcilePlanLedger()`는 ledger 행의 `claimClass`, `fundingSourceId`, `debtId`의 조합이 유효한지 확인하지 않는다. `claimClass="other"` 같은 미등록 분류는 분류별 합산기의 마지막 기본분기에서 **`trusteeFeeWon`으로 잘못 집계되며 `reconciled`**가 가능하다. 이외에도 ordinary↔priority fundingSource 잘못 교환, 같은 사건 `data.debts`에 없는 `debtId`, source 분류와 ledger 분류의 불일치가 정상이 될 수 있다. 이 상태는 **기술적 무결성 결함**이지 세금·담보·이자의 법률적 분류 확정이 아니다.

**사용한 합성 입력의 실필드 모양:** `data.context.planMonths`, `paymentSchedule.expectedInstallments/phases[].monthlyAvailableWon`, `data.debts[].{id,classification,priority,principal.amountWon,interest.amountWon,factIds}`, `calculation.{planTotalWon,ordinaryRepaymentBudgetWon,monthlyPaymentWon,disposableIncomeWon}`, `ledger.{status,issues,rows[].{installment,claimClass,fundingSourceId,debtId,principalWon,interestWon,otherComponentWon,balanceAfter,sourceIds}}`. 모든 식별자는 `SYN-*`; 고객자료 없음. 행별 `principalWon="1"`, 이자·기타 `"0"`, 다만 명시적 0원 시나리오는 원금 `"0"`. 36/48/60개월 각각 원금 합계 **36/48/60원**(0원은 0원), 소득·계획총액은 시나리오에 맞게 분리.

| 36/48/60개월 각각의 합성 조건 | 독립 기대 | 기존 main 원본문 V8 | Draft #203 V8 |
|---|---|---|---|
| 정상 ordinary + ordinary_budget | reconciled | reconciled | reconciled |
| 정상 priority + priority_budget | reconciled | reconciled | reconciled |
| 미등록 `claimClass="other"` | blocked, trustee 0 | **reconciled / trustee 합계에 잘못 계상** | blocked / trustee 0 |
| ordinary 채권 + priority_budget | blocked | **reconciled** | blocked |
| priority 채권 + ordinary_budget | blocked | **reconciled** | blocked |
| `debtId=SYN-GHOST`(data.debts에 없음) | blocked | **reconciled** | blocked |
| priority 원천채권을 ordinary 행으로 표시 | blocked, 사람 검토 | **reconciled** | blocked |
| 출처가 명시된 0원 ordinary | reconciled, 0 보존 | reconciled | reconciled |

- 실제 GitHub **main 및 Draft #203에 저장된 코드 본문**을 불러 TypeScript 타입 선언 부분만 제거한 V8 격리함수로 실행했고, **Draft 브랜치에 커밋한 합성 테스트 파일 본문 자체**를 V8 테스트 어댑터로 실행했다. 총 8조건 × 36·48·60개월 = **24조건**. main **9 PASS/15 FAIL**, 후보 **24 PASS/0 FAIL**, TODO **3건**(독립 기술 기대 기준). 조건당 월별 행 수는 36·48·60으로 구성했으며, BigInt 총액을 따로 비교했다. 실제 Node 프로젝트 러너·CI는 **미실행**.
- 새 오류코드: `INVALID_LEDGER_CLAIM_CLASS`, `LEDGER_FUNDING_SOURCE_MISMATCH`, `LEDGER_DEBT_NOT_IN_CASE`, `LEDGER_CLAIM_CLASS_SOURCE_MISMATCH`. 미등록 클래스는 `trusteeFeeWon` 합계로 자동 귀속하지 않도록 했다. 법률 분류를 자동 변경하지 않고 **blocked/검토보류**.
- 원천 `data.debts`의 자체 분류를 무조건 법률로 승인하는 규칙이 아님. 이 출처 자체가 미승인·상충이면 사람 확인 전 법적 인정을 절대 확정하지 않음.

## 2. 변경 상태와 다른 Draft 결합 위험

- **[Draft PR #203](https://github.com/firmengine/firmengine/pull/203)**, base main, 분기 `audit/a2-r89-calc-ledger-class-funding-20261103-0510`, **미병합**. 제품 수정 `lib/plan-reconciliation.ts` blob `fcefc9239808c9c1356b6eb4bc438efe5ac51bf9`, 신규 시험 `tests/a2-r89-calc-ledger-class-funding.test.mjs` blob `090aaafe14267bc47792c44c3678e88c53f65d4e`. 두 파일 모두 ax-site 안. 제품 변경·계산식의 main 직접 반영은 하지 않음.
- #192 원금/이자 구성액 누계 상한, #194 세금분류 coverage와 **같은 함수 파일에 변화가 있으므로 3개 Draft의 병합순서/충돌·회귀 검증 필수**. #188 Fact ID shape, #199 SQL 리스트 shape, #200 문서 사전검증도 별도 Gate. Draft branch 코드의 V8 통과는 stacked Draft 통합·CI 완료를 의미하지 않는다.
- 남은 프로젝트 Node 실행·전체 CI·staging D1/R2/Cron·실제 DOCX ZIP/XML 재독·공식 양식 검증 및 변호사/계산사무장 승인은 **모두 미인증**.

## 3. 0011 실제 SQL 저장형식과 합성 재조회 (로컬 / 독립)

- SQL 0011 원문 3개 테이블 `case_calculation_runs`, `case_calculation_features`, `case_calculation_heads` DDL을 SQLite 3.46.1 메모리에 동형 적용(대상 `cases` FK 테이블만 합성 생성), `PRAGMA foreign_keys=ON`. `SYN-CASE`와 36/48/60개월 `SYN-RUN-*` 3개, feature 6행을 실 `INSERT`→`SELECT` 수행: **6/6 재조회, FK 위반 0건**.
- 적재형식: `run_id/calculation_id/output_path/value_json/value_won/status/source_fact_ids_json/input_refs_json/formula`. 각각 `value_json={"claimClass":"ordinary"|"other","fundingSourceId":"ordinary_budget","expectedInstallments":36|48|60}`, `value_won="36"|"48"|"60"`, `status="provisional"`, `source_fact_ids_json=["SYN-F1"]|["SYN-FOREIGN"]`. **미등록 class를 담은 3행, 존재 미확인 외부 Fact를 가정한 3행도 SQL은 저장 허용**. 이는 실제 ledger를 SQL feature로 운영 저장한다는 뜻이 아니라 **JSON field의 DB 구조적 검증 부재에 대한 별도 합성 재현**이다.
- 본 회차 `source_fact_ids_json`의 실제 Fact 존재·동일 사건·승인/참조 SHA, 실행 판본↔DOCX 일치 **미검증**. SQL은 run FK만 제약하며 source Fact ID의 존재/귀속을 보증하지 않는다. `null`, 미관찰, source-only, 불확실, 비해당, 상충, 승인전은 0으로 보간하거나 법률 인증값으로 승격하지 않음.

## 4. 계약 정적 재파싱 및 법령 확인

- main `reference-decision-tables.json`: **18모듈, 입력 선언 91(고유 78), 출력 선언 42(고유 40), 저장 결과경로 42**. `template-token-catalog.json`: **D5103 37 / D5110 55 / D5111 82 등록 토큰**, 중복 0. **정적 파싱일 뿐 18개 계산 실행/91입력 소비/42출력 SQL 재연결/Word 바이트 검증 아님.**
- **서울회생법원** [2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 **제424호 제2조 제2항 제7호 신설** 공지 원문 확인. 첨부 개정전문 부칙·사건별 효력일/경과조치 **미인증**, 자동 기간단축 규칙 적용 없음.
- **국가법령정보센터** 2026-10-02 시행 **법률 제21490호** [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR) 확인. 변제계획 일반 3년/특별사정 5년 한도 및 인가/청산가치 법률 판정은 금번 class 무결성 검사와 별개.
- **국세청** [VAT 신고·납부 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2355): 일반과세자 반기, 간이과세자 원칙 연간 신고 기준 확인. VAT/종소세 신고액은 법원 인정 월 사업순소득으로 자동 합산하지 않음.

## 5. 인수 보드 ID와 다음 순환

| ID | r89 실행/관찰 | 남은 검증 (모두 미완료 [ ]) |
|---|---|---|
| **A2-CALC-019** | 원금/이자 36/48/60 정수 합계·채권 분류 vs row class 대조 | 실제 원천 채권 구성, 지연손해금·채권비용/Fact 승인 |
| **A2-CALC-020** | 같은 사건 채권 ID 부재 및 원천 class 불일치 차단 후보 | 양도/연대/담보 복수채권·중복 법적 판단 |
| **A2-CALC-025** | ordinary/priority 자금 출처 교환과 category 총액 오류 | 수수료/재단·세금/월 예산, D5110/11 배분 재독 |
| **A2-CALC-026** | 36/48/60 × 8조건 월별 원장·합계 별도 대조 | 잔여원/phase 경계·공식 변제기간 적용일 검증 |
| **A2-CALC-030** | 명시적 0·미등록 class/데이터 소유 불명·단위 분리 | null/NA/source-only/상충/승인전 전체 18모듈 golden |

**모두 부분 [ ] 유지 / 제품 최종 인수 0건.** 다음 r90 **변호사**는 claimClass의 법률적 인정/분류와 2026-10-01 제424호 개정 부칙/사건 적용일, #203↔#194↔#192의 법적·기술적 겹침과 원천 Fact→SQL→원장→D5110/D5111 검증을 우선한다.

고객정보·실제 OCR 값·키·비공개 정답·.env는 기록하지 않았고, 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 **미실행**.
