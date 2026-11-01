# A2 53차 계산사무장 감사 — default 변제원장 월별 원금/이자 나머지 집중 반례

- 기준일: 2026-11-01 KST. 시작 main HEAD `6c1dbf5cfbbd4cffd13250aa6764c148b6040f1c` (직전 A2 r52 보드 `9c382a8b` 포함); 감사 영수증 작성 직전 main `6c1dbf5cfbbd4cffd13250aa6764c148b6040f1c`. 6역할 순환: A2 r52 사용자·서류담당자 → **r53 계산사무장** → 다음 r54 변호사.
- 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내 A2 계산·데이터/서식 계약. 체크 **A2-CALC-025, A2-CALC-026, A2-CALC-030** 모두 **[ ] 유지**. 코드 존재·격리 테스트·Node/CI·staging D1/R2·DOCX·법원인가는 각각 별도 상태.
- GitHub 원문 blob: `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`; `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`. 관련 기존 `tests/repayment-plan-model.test.ts`, Draft #25/#29/#37/#43, #106/#129/#130을 확인했고 병합하지 않았다.

## 1. 입력/독립 기댓값/실제 결과 (전부 합성, 원본 사실 아님)

입력은 저장형식 중 **typed NumericInput**(`normalizeMoney("10000")` 원금·이자, `normalizeMoney("0")` 회생위원 보수, `sourceIds=["SYN-F1"]`)와 `CalculationResult`의 `monthlyPaymentWon="2"`·`planTotalWon=N×2`, `allocations=[{debtId:"D1",allocatedPrincipalWon:N+1,allocatedInterestWon:N-1,factIds:["SYN-F1"]}]`; `paymentSchedule=null` default 원장. **실제 원문 `domain.ts`의 normalizeMoney/moneyValue, repayment-plan-model, plan-reconciliation 함수를 TypeScript 타입 표기만 제거한 V8 격리 실행**. 법원 인정·소득 증빙이 아니며 공식 숫자 사례가 아니다.

| N개월 | 원금 배분 / 이자 배분 | 독립 기대 | main 실제 | 후보 Draft 실제 |
|---|---:|---|---|---|
| 36 | 37/35원, 합계72원 | 총계72 및 매월2원 제안액 초과 여부 검토 | 1회 3원, 36회 1원, 총72원, **원장 provisional/issues=[]** | 같은 금액 보존, `DEFAULT_ORDINARY_MONTHLY_PROPOSAL_EXCEEDED:1`, blocked |
| 48 | 49/47원, 합계96원 | 총계96 및 매월2원 제안액 초과 여부 검토 | 1회 3원, 48회 1원, 총96원, **provisional/issues=[]** | 같은 금액 보존, 검토보류 |
| 60 | 61/59원, 합계120원 | 총계120 및 매월2원 제안액 초과 여부 검토 | 1회 3원, 60회 1원, 총120원, **provisional/issues=[]** | 같은 금액 보존, 검토보류 |

독립 산술: 원금/이자 나머지를 별도로 월초부터 분산하면 첫 회 합계가 3원, 마지막 회 1원이 된다. **전체 합계가 월제안액×기간과 같아도 모든 달의 납부액이 동일하다는 뜻은 아니다.** 원안 `reconcilePlanLedger` 자체는 이미 36/48/60 모두 `CATEGORY_BUDGET_EXCEEDED:1:ordinary` 및 `MONTHLY_BUDGET_EXCEEDED:1`로 **blocked**를 반환했다. 따라서 **제품 최종 변제계획 발급 오류로 확정하지 않는다**. 원장 단독의 `issues=[]/provisional`와 하위 조정기 상태 불일치를 초기에 표시하는 후보만 작성했다.

추가 독립 V8 경계: 36/48/60 각각 균등 분할 `principal=N, interest=N`, 명시적 0원, 월제안액 null(미관찰), 비정상 `"9,00"` 등 총 **15건**. main+후보 코드의 관찰을 비교했고 후보의 **독립 기대 15/15 일치**; null은 provisional 상태 보존, 숫자형 비정상은 blocked, 명시적 0은 0 유지. 모두 **함수 본문 격리검증**, Node 프로젝트 테스트/CI 아님.

## 2. 검증 후보 및 충돌
- **[Draft PR #133](https://github.com/firmengine/firmengine/pull/133)**, head `21579110e8cdab23856d783fae55a45332366e3a`, base main. `lib/repayment-plan-model.ts`의 기본원장 경로에만 보수적 월제안액 초과/비정상 검사 추가. 원금·이자 배분·지급월·금액·법적 의미는 **수정하지 않음**, 검토 상태만 blocked. 신규 `tests/a2-r53-default-monthly-remainder.test.mjs` **15건 작성/커밋**, **Node 러너 미실행**.
- 기존 #25/#29도 동일 `repayment-plan-model.ts`를 변경하며 #43은 `plan-reconciliation.ts` 비정상 원장값 안전 차단 제안. Draft #130은 별개 서식 preflight 통합. **Draft #133 병합 금지**, 변동 변제월액/일정 정책 및 승인 의미에 대한 계산사무장·변호사 검토와 실제 Node·E2E 통합 필수.
- 추가 읽기/음성대조: 현재 main `reconcilePlanLedger`에 비정상 `principalWon="BAD"`, null, `"9,00"` 입력 시 `BigInt` 예외를 격리 재현; **기존 Draft #43에서 해당 fail-closed를 이미 수정 제안**한 사실을 diff로 확인. 중복 수정/커밋하지 않았으며 main은 아직 미병합/고위험 검토중이다.

## 3. 저장 스키마·계산 계약·서식 토큰
- 현재 main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 실제 JSON 재파싱 **계산 18모듈, 입력 91(고유78), 출력42(고유40), resultPaths42(고유42)**.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5110 55 / D5111 82** 등록 토큰 정적 확인.
- `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`의 `case_calculation_runs` / `case_calculation_features` / `case_calculation_heads` DDL을 **in-memory SQLite**로 합성 재현: 사례 stub FK·run 1건·feature 5건 INSERT/SELECT 성공. 관측 3원 및 2원, 명시적 0원(`value_json="\"0\""`, `value_won="0"`), 미관찰(`value_json="null"`, `value_won=NULL`), **상충 `value_json=null`+`value_won=0`도 저장 허용**. 이는 DDL 저장 허용성 결과이지 실제 D1의 앱 저장·replay·semantic validation 증빙이 아니다.
- 본 회차는 **원문→Fact 추출, 전체 18계산 모듈/91입력/42출력 전수 실행, SQL 저장 앱 호출, 실 D1, 실제 DOCX 바이트 및 공식 서식 토큰 치환 검증을 하지 않았다.** 추출값/원본 개인정보는 사용하지 않았다.

## 4. 공식 법률·세무자료 (2026-11-01 웹 직접 확인)
- [국가법령정보센터 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **[시행 2026-10-02, 법률 제21490호, 2026-03-24 타법개정]** 원문. 제611조⑤ 원칙 3년(36개월)·특별사정 최대 5년(60개월) 경계 확인. **48/60개월 합성 실행은 사건별 기간 적법성/청산가치 조건을 승인하는 테스트가 아니다.** 제614조 인가 요건은 계산 원장 검증과 별개다.
- [서울회생법원 2026-10-01 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): **실무준칙 제424호 제2조② 제7호 신설** 명시. 첨부 PDF 개정전문·부칙·경과조치·개별 사건 적용일 **미검증**, 공지일을 자동 적용일로 삼지 않았다.
- [국세청 세무 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자는 원칙적으로 반기, 간이과세자는 연간 VAT 신고기간, 종합소득세는 별도 연간 과세소득 신고. VAT 매출·세액/종소세 신고액을 월 순소득·법원 인정액으로 자동 대응하지 않았다.
- 변호사·세무회계 실무자 공식 서식 적합성 및 적용일 승인 **미인증**.

## 5. 보드 ID와 다음 우선검증
- **A2-CALC-025 [ ]**: 월예산과 원장 월별 합계의 구조적 불일치 검출. 산식 전체 및 비용/우선채권/생계비 승인 미완료.
- **A2-CALC-026 [ ]**: 36·48·60개월 원금/이자 원화 나머지 및 첫달 초과의 독립 기대값/실제 V8 확인. 기산일·월말 변경·승인된 변동계획/실서식 미완료.
- **A2-CALC-030 [ ]**: 0/null/비정상 숫자·예외·SQL 의미상 충돌 구분. 18모듈/91입력 전수 golden, 전체 Node/CI 및 D1 미완료.
- 다음 회차 **변호사 관점**: #133의 월제안액 검토 차단이 허용된 탄력적 변제계획과 충돌하는지 법적/실무적 확인, #25/#29/#43/#130의 동일·인접 모듈 통합 Node 테스트, 채권/재산/청산가치·36/48/60 변제 서식 D5110/11 실제 바이트 대조. 2026-10-01 서울 제424호 신설 제7호 개정전문/부칙/경과조치 실제 파일 및 사건 적용일 확인 전 **자동규칙 금지**.

**제품 인수 완료 0건.** main 제품 수정/운영 배포/D1 운영 마이그레이션/실제 전자제출/법원 인가 확정 없음. 고객정보·키/.env·원본 OCR 사실값 없음.
