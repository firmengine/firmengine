# FirmEngine A2 r29 — 계산사무장: 청산가치 승인 경계·변제예산·원단위 배분

- 일시: 2026-10-31 KST, **r28 사용자·서류담당자 → r29 계산사무장 → r30 변호사**.
- 저장소: `firmengine/firmengine`, 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 감사 시작 main `fade903d8f540b1aac4f3f870816c88e9efe2473`; 영수증 생성 직전 main `fade903d8f540b1aac4f3f870816c88e9efe2473`. 타 에이전트 A1/A3/A4 병렬 변경을 수정·덮어쓰지 않음.
- 단일 보드 A2-CALC **022/025/026/028**. 네 ID 모두 **부분검증 [ ] 유지**. 제품 최종 인수 **0건**. 전 회차 [r28 영수증](2026-10-31_r28_1608KST_doc-final-approval-source-only.md) 및 Draft #58/#67/#71/#76/#79/#81 참조.
- 읽은 실제 자료: 최신 main·최근 커밋/PR, `lib/assessment.ts` (`ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`), `lib/business-net-reconciliation.ts` (`60a4fc295943dce404a7f99efffe88f58dd2d4ff`), `lib/business-monthly-workbench.ts` (`0174f228473516e94664be445d8f46a33f833f80`), `lib/income-resolution.ts`, `lib/form-mapping.ts`, `lib/case-calculation-feature-store.ts`, `db/schema.ts` (`933f8686845ac14669312dd21bf85e02c62ed5e6`), `tests/calculation-18-output-golden.test.ts` (`f8115941802e03d10546c3ece6da4219a944c3e2`), `tests/refactor-calculation-acceptance.test.ts`, `tests/repayment-budget-failclosed.test.ts`, 기존 A2 영수증.

## 1. P1 확인: 숫자 비교값이 사람 검토 전 eligibility PASS로 승격

`assessment.ts` main은 `liquidationValueWon`과 `presentValueWon`의 숫자가 모두 있으면 `liquidationComparison="met"|"not_met"`를 바로 선택하며, **`presentValueReviewed=false`, `assetValuationBasisReviewed=false`, 개별 asset `recognition="unreviewed"` 및 `assetRows[].reasons` 검토 필요를 비교조건에 반영하지 않음**. 같은 파일 `assessCase()`는 `"met"`을 eligibility `outcome:"pass"`로 전달. trace 자체는 provisional일 수 있어 상태 불일치가 발생. 이는 법원의 인가판정을 이미 한다는 뜻이 아닌 **내부 심사 PASS 의미의 P1 후보**다.

독립 기대값은 법률 판단이 아닌 내부 승인경계: 검토되지 않은 숫자는 산술 preview를 남기되 `liquidationComparison="unknown"`; 검토 완료된 수치만 `met/not_met` 표시.

실제 main 비교식 그대로 V8으로 10개 합성 조합 실행(타입/의존성 격리, 전체 모듈 import 아님): **main 6/10, 수정안 10/10** 독립 기대 일치.

| 합성 조건 | 독립 기대 | main 관찰 | Draft #84 관찰 |
|---|---|---|---|
| 검토 완료 PV 30,000,000 / 청산가치 1,000,000 | met (수치만) | met | met |
| 검토 완료 PV 500,000 / 청산가치 1,000,000 | not_met (수치만) | not_met | not_met |
| PV 검토 미완료, 금액 존재 | unknown | **met (오승격)** | unknown |
| 재산평가기준 검토 미완료 | unknown | **met** | unknown |
| 재산 개별 recognition=unreviewed | unknown | **met** | unknown |
| 담보차감 범위 검토 사유 잔존 | unknown | **met** | unknown |
| PV=null / 청산가치=null (각 별도) | unknown | unknown | unknown |
| 재산 기준일 미일치 경고 | unknown | unknown | unknown |
| 검토 완료된 청산가치 명시적 0원 | met (수치만) | met | met |

[Draft PR #84](https://github.com/firmengine/firmengine/pull/84), 브랜치 `audit/a2-r29-liquidation-approval-gate-20261031`, HEAD `d56d574a72003f50b49cb6d555546c940878225f`. 제품 코드 커밋 `0198021d`, 합성 Node 회귀 2그룹 추가 커밋 `d56d574a`. 코드 `lib/assessment.ts`·테스트 `tests/calculation-18-output-golden.test.ts` **2개만**, 둘 다 허용 경로. PR은 **Draft·미병합**, Node 신규 테스트는 **작성만 했으며 실행하지 않음**. 다수 PR(#67/#79)이 `assessment.ts`를 별도 변경 중이므로 비파괴 통합검증 없이는 merge 금지. 법률 인정 산식·재산원문·사람 승인정보를 자동 변경하지 않음.

## 2. A2-CALC-022 — 재산·지분·담보차감 (부분)

실제 `liquidationContribution()` 함수 본문을 Git blob에서 추출, TS 타입 표기만 제거하고 `nonnegative`/정수 올림·월검증에 동일 의미의 로컬 보조 함수를 주입한 **V8 격리 11/11** 독립 기대 일치. 법률상 재산 인정이 아니라 산술·검토 사유만 검증.

- 가상 재산 시가 100,000,000원, 지분 50%, 신청인 지분 귀속 담보상환 20,000,000원, 비용 5,000,000원, 면제 검토액 10,000,000원 → **15,000,000원** (독립 `100m×0.5−20m−5m−10m`).
- 100% 지분 → 65,000,000원. 지분 50%의 담보범위 출처 미연결 → **null**, 미검토 범위 → 산술 15,000,000원과 `ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_REVIEW_REQUIRED`를 **동시 반환**; numeric preview를 자동 법률 PASS로 쓰면 안 됨.
- 재산가액 null, 유효하지 않은 기준일, 평가근거 누락, 음수 비용은 null과 원인코드로 보류. 명시적 지분 0%·담보액 0원 → 0원. 담보상환액 60m > 귀속 재산가액 50m → 0원과 `COLLATERAL_SHORTFALL_REQUIRES_CLASSIFICATION` 사유 동시 발생.
- 실제 source Fact·동산/보험/퇴직금/공유지분 법적 면제규칙·SQL 저장과 DOCX 판정은 **미검증**.

## 3. A2-CALC-025 — 일반채권 월 변제예산 (부분)

실제 `calculateCase()`에서 `disposable`, `ordinaryBudget`, `payment`, `planTotal` 산술 조건식만 추출(타입 `months!` 제거, maxMonths 가상 60개월 보조기준)한 **V8 격리 11/11** 기대 일치. 기본 합성: 월소득 3,000,000원 − 인정 생계비 1,500,000원 = 월 가용소득 1,500,000원; 보수/우선/재단 지급 각 명시적 0원 → 월 일반채권 예산 1,500,000원, 선택 제안액 1,000,000원.

- 보수100,000 + 우선200,000 + 재단300,000 → 일반채권 예산 900,000원, 기존 제안 1,000,000원 **예산 초과로 payment=null, planTotal=null**.
- 제안 월납부액 명시적 **0** → payment=0, planTotal=0 (산술 결과, 법원 인정 아님). 월소득=null, 생계비=null, 우선채권 월액=null은 각각 payment/planTotal null. 소득1m<생계비1.5m의 음수 가용소득 -500,000원도 지급액으로 채택하지 않음.
- 보수·우선/재단채권 실제 검증·계약 정확성/법률분류와 여러 채권 배당은 **미인증**.

## 4. A2-CALC-026 — 36/48/60개월 및 원화 잔여원 (부분)

같은 실제 산술 조건식 V8에서, 월제안액 1,000,000원 × 36/48/60회 → **36,000,000 / 48,000,000 / 60,000,000원** 대조. 최대개월수 60은 본 시험의 **가상 보조설정**, 사건별 법적 승인 아님. 61회는 해당 설정에서 planTotal=null.

실제 `allocateProRata()` 본문 V8 **13/13** (별도 독립 기댓값): 3채권 각 100원에 예산100원 → ID 순위 a34/b33/c33 (입력 역순 불변); 2채권 각 5원에 예산7원 → a4/b3; 예산101원·채권10/20 → 실제 배분30원 한도; 명시적 예산0/채권0, 채권0행, 중복ID/음수/소수 문자열 오류, 9,007,199,254,740,993원의 BigInt 반분 4,503,599,627,370,497 / 4,503,599,627,370,496 확인. **채권 0행에서 빈 목록을 반환하는 현상은 코드 관찰일 뿐 인수 통과 판단 아님**. 실제 36/48/60회 채권별 일정/월별 원장·잔여원·Word D5110/D5111·지급예산 보존 E2E **미검증**.

## 5. 데이터·형식·전체 계약 (정적 확인만)

- 원문 관측 → Fact(합성 예: `value="3000000"`, source period/record/hash/recognition 별도) → typed `NumericInput.amountWon="3000000"` → BigInt 계산 및 trace(status: provisional/blocked/calculated) → SQL feature `value_json` 및 `value_won`/status → D5103/D5110/D5111. **이 계층의 논리적 합성 표현만 작성했으며 실제 Fact INSERT/SQL SELECT/서식 생성은 실행하지 않음**.
- `db/schema.ts` 확인: `case_calculation_features.value_json TEXT NOT NULL`, `value_won TEXT` nullable, `status TEXT NOT NULL`. **미관찰(null), 명시적 0("0"), 비해당, 상충, source-only, 승인전을 분리**.
- `reference-decision-tables.json` Git blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 모듈**, 입력 **91선언/78고유 경로**, 출력 **42선언/40고유 이름**, 결과경로 **42/42 고유**.
- `template-token-catalog.json` Git blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5110 **55**, D5111 **82** 토큰. 실제 91→42→SQL→DOCX 파일 바이트 전수 확인 **미실행**.
- 사업소득/VAT/종소세 계층: `business-monthly-workbench.ts` 원천 증빙 산술 preview는 `legalNetApproved:false`를 유지, `business-net-reconciliation.ts`는 인간 검토·기준판본/원천 출처가 확인된 경우에만 별도 제안을 생성. 이번 회차 **VAT·종소세 산식 계산/중복제거 종단시험은 실행하지 않아 통과 표시 금지**.

## 6. 공식 기준(2026-10-31 원문 확인; 자동법률규칙 반영 금지)

- 국가법령정보센터 [채무자회생법 제611조 시행 2026-10-02, 법률 제21490호](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777): 변제계획 3년 원칙·특별사정 5년 이내; **36/48/60회 수학적 검산은 개별 사건 법률요건 승인 아님**.
- [서울회생법원 2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 제424호 제2조 제2항 제7호 신설. 공지일과 개별 사건 적용일은 구분; **첨부 개정전문/부칙/경과조치·사건별 적용 불확정**.
- [국세청 세무안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반/간이과세자 구별; 법원 인정 순사업소득 산식이나 VAT/종소세의 원천 중복 인정 금지. 실무자 승인 전 미인증.

## 7. 미완료·다음 회차

**검증 계층 분리:** 코드 존재 및 함수본문 V8 격리 **실행됨**(11/11 +13/13 +11/11 +10 비교 테스트), Draft #84 신규 Node 테스트 **작성만**, 정식 Node 프로젝트 실행 **미실행**, 전체 CI **미확인**, staging D1/R2/Cron **미실행**, 공식 서식 Word 바이트·법원 양식 동등성 **미실행**, 변호사·계산사무장·세무회계 실무자 승인 **미취득**, 사이트 운영 배포 **미실행**.

다음 **r30 변호사 관점**: Draft #84와 A1 유사 법률 PASS 방어의 표현 일치성 검토; #67/#79 `assessment.ts` 병렬 수정 비파괴 결합; #58/#81 서류 최종 승인 게이트와 #71 SQL replay, #76 대표기간 문서 출력의 실제 Node 통합 회귀. 법 제614조 청산가치/이의채권자별 배당·면제액 공식 기준·법원 개정 준칙 상세 경과조치 실무자 검토 필요.

**A2-CALC-022/025/026/028 모두 [ ] 유지. 제품 인수 0건.** 운영 배포, 운영 D1 마이그레이션, 실제 전자제출 및 법원 인가 확정 미수행.
