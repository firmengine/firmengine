# FirmEngine A2 r103 — 데이터담당자: 우선채권 정책 미관찰과 계산·서식 데이터계보 독립감사

- 일시: **2026-11-03 KST**, r102 변호사 → **r103 데이터담당자** → r104 AX담당자. 작업/수정 경계: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- 최초 확인 main HEAD: `c8251ebb14bee794e55ddb1cb36aab1d79a9d9a3` (A1 r102 보드 병합). 최근 A2 r102 main 영수증 `b4c9ed51e1990be4f685d0bb37a1d0b5f9d75bf3`, 보드 `df51f10f3ac044e158677b5a7d7f9e3f2392c28b` 재독. 최근 Draft #194/#203/#215 및 #219/#220의 미병합 상태를 구분.
- main 실제 blob: `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`, `lib/case-execution.ts` `752049c087cc28b2d713eafb5dc3f7294623e8ae`, `lib/office-writer.ts` `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`.
- SQL 저장 스키마: `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/case-lawgraph-store.ts` `eea435bb78f804c79a213c464af54e8014a3c3a5`; 관련 테스트 `tests/refactor-calculation-acceptance.test.ts` `0370bbdf4c1af0b192b294b50dd63b679f7a0b01`.
- **최종 인수·법률 확정 승인 0건.** 실제 고객·OCR 원문·개인정보·키/.env·비공개 정답 없음. 전부 `SYN-` 가상 값.

## 1. 신규 P1 결함 후보 — priorityPolicies 원천·확인정보 없는데 covered 반환

현재 `CaseData.debts[]`에는 `priority`, `classification`, `legalReview?`, `factIds[]` 등이 있고, 별개 `reconcilePlanLedger(data, calculation, ledger, options={})`의 네 번째 인수 `priorityPolicies?: Record<string,{deadlineInstallment, applicability}>`는 **선택사항**이다. 실제 생산 소비처 `case-execution.ts`와 `office-writer.ts`는 네 번째 인수를 넘기지 않는다. 이 함수 단독에선 승인자·근거 Fact ID·정책 적용법원·시행일·case revision·source SHA를 확인하지 않으며 0011 계산 피처 열에도 해당 정책의 별도 승인 열은 없다. 간접 JSON 내부 보존 가능성까지 전수 배제한 결과는 아니다.

기존 표현식: `policy?.applicability === "unknown" || !policyValid ? "unknown" : uncovered===0n ? "covered" : "blocked"`. 즉 **정책 객체 자체가 없더라도** 전액 지급이면 `covered`, `legalReviewTasks=[]`이다. `status="reconciled"`는 기술 합계 의미이므로 실제 인가/문서 출력 성공까지 증명하지 않는다. 독립 데이터-승인 경계 기대는 정책 누락/유효하지 않은 입력 → `unknown`·검토과제, 명시적 `confirmed`·유효 기간인 경우에만 covered/blocked 후보로 분기(그래도 법률 확정값 아님).

**독립 테스트:** GitHub main 실제 `reconcilePlanLedger()` 몸체에서 TypeScript 타입 표기만 제거해 V8 `Function` 격리 실행. `nat`은 원본문과 동치, `moneyValue`는 합성 `{amountWon:string}`→BigInt 최소 대역. 36/48/60개월 각각 1원/월 + 원금 36/48/60원, 이자 0, priority 클래스, 단일 `SYN-D1`, 소스 `SYN-F1`(실존 Fact 아님). 외부 합산 기대는 `1n*BigInt(term)`: **36/48/60원**, 원본 프린시펄 보존. 조건 9가지/기간: 정책 생략, 빈 맵, null 정책, unknown, 유효하지 않은 applicability, 잘못된 deadline, 명시적 confirmed 전액, 명시적 0원 confirmed, confirmed 전액 미지급.

| 조건 × 36/48/60 | 독립 기대 | main 실측 | Draft #221 격리 실측 |
| --- | --- | --- | --- |
| 정책 생략·빈 맵·null·미등록 applicability (각 3건, 합계 12) | unknown + 검토과제 | **covered, 검토과제 없음 12/12** | **unknown + 검토과제 12/12** |
| applicability=unknown (3건) | unknown + 검토과제 | 일치 3/3 | 일치 3/3 |
| deadline=0 (3건) | unknown | 일치 3/3 | 일치 3/3 |
| applicability=confirmed, 1원/월 전액 (3건) | covered, 기술합계 정확 | 일치 3/3 | 일치 3/3 |
| 미확인 정책 아래 명시적 0원 채권 (3건) | unknown, 0 유지 | covered 3/3 (별도 첫 실행) | unknown 3/3 (별도 첫 실행) |
| confirmed 0원 채권 (3건) | covered, 0 유지 | 일치 3/3 | 일치 3/3 |
| confirmed, 미지급 (3건) | blocked, 미납 이슈 | 일치 3/3 | 일치 3/3 |

**동일 9종×3기간 = 27개 테스트 집합**에서 독립 기대와 일치 **main 15/27 → Draft #221 변경본 27/27**. 중복/추가 조건은 표에서 구분하며 30개 신규 회귀파일 케이스는 **작성만**, 실제 Node runner에서는 미실행. 원문 격리에서 잘못된 `principalWon="1,20"`은 36/48/60 각각 `SyntaxError` (3/3) 재현; 이 결함은 **이번 PR에서 수정하지 않음**, 0으로 치환하지 않는다.

**제안 수정:** [Draft PR #221](https://github.com/firmengine/firmengine/pull/221) (`audit/a2-r103-data-priority-policy-evidence-20261103-1916`, branch commits `485643e6e4435e46f1cedd5bdef1d06102efa666` / `c7292e0c5f833f3eca5f7ad41961188bfd233cc3`). 기존 `applicability === "unknown"` 비교를 **`applicability !== "confirmed"`**로 바꿔 미관찰/무효 정책을 unknown으로. 금액·납기·채권분류·법적 인가 결정 변경 없음. 그러나 최종 게이트 검토과제 수가 달라질 수 있어 **Draft HOLD 및 변호사·계산사무장·IT 검토 필수**. 생산 main 계산 코드는 불변.

## 2. 0011 SQL 동형 저장·재조회(실제 SQLite 3.46.1)

GitHub 0011 DDL의 **계산 runs/features/heads 정의를 옮겨 인메모리 SQLite3**에 `cases` 부모 테이블 하나를 합성 생성하고 FK 활성화하여 실행. 입력 `SYN-A` 사건, `SYN-RUN` 실행, 계산 `SYN-D1`/타 사건 Fact ID, `value_json`과 `value_won` 상충, `source_fact_ids_json`에 null 원소, 서로 다른 calculation ID의 동일 output_path, head 포인터를 적재. 실제 D1 SDK·staging D1·사용자 원문 DB 아님.

- 실제 관찰 **7/7**: 검증되지 않은 Fact ID 저장 허용; `value_json=null/value_won="0"` 동시 허용; 타 사건처럼 보이는 Fact ID 허용; 동일 output_path를 서로 다른 calculation_id로 중복 허용; non-string `[null]` fact ID 저장 허용; head 저장·재조회 성공; `PRAGMA foreign_key_check` 이상 0건. 이는 **DB 제약에 별도 사실인정 검사가 없다는 관찰**이며 7/7 제품 적합 판정 아님.
- SQL `source_fact_ids_json`은 정규화된 Fact FK가 아니라 TEXT, `priorityPolicies`·담당자 승인·법원·적용일을 전용 열로 검증하지 않는다. `CaseData.debts[].factIds`가 실제 사건의 accepted Fact를 가리키고 계산 결과·서식 필드가 동일 판본인지는 상위 계층/실 D1에서 검증해야 함. 정책 confirmed 플래그는 법률상 우선권 인가를 보장하지 않음.

## 3. 등록 계약 18/91/42 및 법원서식 토큰 정적 재독

main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` **JSON 파싱**: 18 calculation modules / 91 input declarations (고유 78) / 42 output declarations (고유 40) / 42 resultPaths (고유 42). `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` **JSON 파싱**: D5103=37, D5106=48, D5110=55, D5111=82 tokens; 반복그룹 D5103 family/month, D5110 creditor/estate/priority/secured, D5111 allocation/creditor/disposal/estate/priority/secured. 계산 출력 42경로 전부 실제 실행·SQL·DOCX 바이트 재독 **하지 않음**.

## 4. 공식 원문·날짜 (2026-11-03 검증)

- **서울회생법원** 2026-10-01 공식 공지: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . 실무준칙 제424호 제2조제2항 제7호 신설. 공식 PDF https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2 **0-index 271·272·391쪽 이미지 직접 확인**: 2026-09-23 개정, 2026-10-01 시행, **시행 후 최초 접수 사건** 적용, 시행 전 인가계획 효력 유지. 개인 사건 관할/증빙 없으면 자동 적용 불가. 제7호 조건(최근 2년 최저임금 미만 급여, 채무 5,000만원 이하, 개인채권자 없음, 최근 1년 신채무 없음/물품구입 카드채무 예외) 누적 판정/승인 미수행.
- **법제처 국가법령정보센터** 채무자회생법 [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): 법률 제21490호 **2026-10-02 시행판** 직접 대조. 611조 우선권·재단채권 전액변제 및 기간 관련, 614조 공정·형평/이행가능/청산가치 등 인가요건. 10-01 준칙과 시행일 구분.
- **국세청** https://g.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7804&mi=2483 ; 공식 VAT 과세기간 안내. VAT 신고매출·매입세액·종합소득세 신고/실제 월별 사업소득은 서로 다른 원천·기간·의미. 이 회차 VAT/급여 수치 계산 **미실행**.

## 5. A2 ID 인수 경계 / 수정 / 다음

- **A2-DATA-009 [ ]**: `Debt.principal/interest`와 원장 금액 합계·분류·우선권 여부 비교. 36/48/60 기간 단일 채권의 원금/이자 구분과 `1,20` 실패 재현; 원문 잔액일/법률상 분류/인정 여부는 미확인.
- **A2-DATA-015 [ ]**: 기준/정책 승인 Fact와 계산 run/신청일, 법원 관할의 계보는 미연결. `priorityPolicies` 선택 인수, 실제 호출부 미제공; #221 정책 누락을 기술적 unknown으로 보존하는 후보 제안. 정책 사실성·승인자·case revision·SHA는 미인증.
- **A2-DATA-020 [ ]**: 명시 0원과 source-only, null, 잘못된 문자열/정책 unknown·미승인을 구분. 0원 채권이 존재해도 미확인 정책을 covered로 승격하지 않아야 함. 재생 불가 금액은 0으로 대체 금지.
- **A2-DATA-024 [ ]**: 실제 0011 DDL 동형 SQLite 7조건 저장/조회. raw→Fact→typed→SQL feature 42 경로→Word E2E, 운영/스테이징 D1, DB 실제 마이그레이션 미인증.

**추가 확인/병합 HOLD**: #221 + #194(세금 미지급) + #203(미등록 분류) + #215(provisional 최종 차단) + malformed BigInt guard를 통합한 Node 회귀·CI, 소유·판본과 Fact 인정, 원금/이자/잔액일, 서식 D5103·D5106·D5110·D5111 금액 재독 필요. 다음 r104 **AX담당자**가 통합 PR 충돌·입출력 계약·최종 HUMAN gate를 점검할 것.

**실행 단계 구분:** 코드 존재/인메모리 V8 27조건 격리/SQLite DDL 동형 7조건/30개 신규 테스트 작성/전체 Node 프로젝트 시험·CI 미실행/스테이징 D1·R2/Cron 미실행/공식 서식·실 DOCX 재독 미실행/변호사·계산사무장 승인 미인증/사이트 배포 미실행. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가확정 **수행 안 함**.
