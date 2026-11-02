# FirmEngine A2 r79 — 데이터담당자 / 검토된 변제원장 미관찰 원금·이자, SQL 계보

- 시각: 2026-11-02 19:10 KST. 작업 허용 디렉터리: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 순환: r78 **변호사** → r79 **데이터담당자** → r80 **AX담당자**.
- 감사 시작 main HEAD: `29d84a153cc7be02c7b7778cb6c8380766916fe4`; 기록 직전 재조회 HEAD: `29d84a153cc7be02c7b7778cb6c8380766916fe4`.
- 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` main blob `9103b09b7ec22ce1555a3a0a63111b579511c5a9` 확인. r78 영수증, Draft #183 스택, main `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`, Draft #183 blob `cc0b064dfcb33a94e26c31428cd6f66c394feb4b`, `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa` 재독. 최근 main 커밋 및 열린 A2 Draft PR 상태 확인.
- 신규 **[Draft PR #185](https://github.com/firmengine/firmengine/pull/185)**: #183 브랜치를 base로 하는 스택(후속 부모 PR 병합 필요), 변경 2파일 모두 허용 prefix 내부. 변경은 reviewed 변제원장에서 정확히 관측된 원금/이자가 아닌 경우 **기술적 complete만 blocked로 전환**. 합성 Node 테스트 21건/미해결 TODO 4건 작성·커밋했지만 **프로젝트 Node runner 미실행**. 별도 병합·실무자 검토 필수. 자동 법적 인정·보정·제출·배포 없음.

## 1. 검토된 변제원장의 원천 금액 미관찰을 0원으로 읽는 P1 후보

- 실제 `buildRepaymentPlanModel` reviewed 분기는 `BigInt(d.principal?.amountWon??"0")+BigInt(d.interest?.amountWon??"0")`를 초기 잔액으로 사용. `null`을 0으로 바꾸고 `after=balance>paid?balance-paid:0n`로 음수 잔액 표시도 억제. source principal/interest가 missing/invalid라도 기술 `complete` 판정을 내릴 수 있다.
- 원본·typed 합성 구분: `rawValue:"100"` → `normalizeMoney("100")`→ `{amountWon:"100",unit:"KRW",currency:"KRW",normalizationStatus:"exact"}`; 이자 0도 별도 `normalizeMoney("0")`로 명시. 반례는 `normalizeMoney(null)` (미관찰, amountWon=null), `normalizeMoney("1..2")` (invalid, amountWon=null). 이는 **생성한 합성 객체**일 뿐 OCR 인식행이나 실제 채권 Fact 원문을 직접 실행한 증거가 아니다.
- 사건 `revision=8`, 계산 `caseRevision=8`, reviewed 기간 36/48/60, 원금 100원/이자 0원, 월 1원, trustee fee 명시 0, 각 채권에 `SYN-FACT-A`; 원금 100원에 36/48/60원 변제 시 독립 기댓 잔액 **64/52/40원**.
- 실제 main 및 Draft #183 **함수 본문 자체**에서 TypeScript 타입 표현만 제거한 V8 격리시험을 실행 (`moneyValue`는 정규화된 합성 입력 검사용 adapter로 대체). 기간별 10조건 × 3기간 × 2버전(main/#183)=**60회 관찰**. #183 대비 제안 가드를 삽입한 별도 격리시험 **30회 추가 관찰**. V8 테스트는 본제품 Node import/실제 계산 모듈 구동이 아니다.

| 합성 입력 × 36/48/60 | 독립 기술 기대 | #183 실제 | #185 수정후 V8 | 판단 |
| --- | --- | --- | --- | --- |
| 원금 `null`(missing) | blocked, 원장 0행 | **complete** 3/3 | blocked 3/3 | 기술 결함 수정 후보 |
| 이자 `null`(missing) | blocked, 원장 0행 | **complete** 3/3 | blocked 3/3 | 기술 결함 수정 후보 |
| 원금 `invalid` (원문 `1..2`) | blocked, 원장 0행 | **complete** 3/3 | blocked 3/3 | 기술 결함 수정 후보 |
| 원금100/이자0 유효 | complete(기술 전용), 지급36/48/60 | complete | complete | 회귀 보존 |
| 원금0·월지급0(명시적0) | 기술 0원 유지 | complete | complete | 0은 null 아님 |
| 동일 debt ID 2건 | blocked | blocked | blocked | #183 기존 방어 유지 |
| 과거 calculation revision | blocked | blocked | blocked | 기존 방어 유지 |
| 분류 tax, 지급 행 없음 | 법률 HOLD | complete | complete | 자동 법률 변경 금지 |
| 원금 5원, 36/48/60원 지급 | 초과지급 HOLD | complete, 잔액 0 clamp | 동일 | 산식·법률 검토 전 미수정 |
| FactIds 빈 배열 | source ownership HOLD | complete | complete | 실제 사실관계 결합 미검증 |

- 독립 기대가 확정된 **21/21 기술 케이스는 수정 후보와 일치**(9 신규 차단+12 기존 회귀). **추가 9건은 status 관찰만 했으며 법적 합격/기술 통과로 산입하지 않았다**.
- #185 정확한 코드 차이: `reviewed` 경로에 `moneyValue(debt.principal)===null || moneyValue(debt.interest)===null` 검사 후 `REVIEWED_SOURCE_DEBT_COMPONENT_UNRESOLVED`로 `blocked, rows=[]`; 산식·배분액·법적 분류·재산·시행일 규칙 변경 없음.
- **실무 검토 필요**: 명시적 비해당 또는 제외 채권의 이자 미기재를 언제 허용할지, 채권별 미관찰과 합법적 0의 구별. 단순 기술 가드의 적용범위가 확정되기 전 제품 PR 병합 금지.

## 2. migration 0011 동일 SQL DDL의 로컬 SQLite 저장·재독

- Python SQLite **3.46.1 in-memory**, `PRAGMA foreign_keys=ON`; 원본 `drizzle/0011_case_calculation_features.sql`의 `runs/features/heads` 3 TABLE+2 INDEX DDL과 최소 합성 `cases(id)` parent를 그대로 실행. 실제 전체 migration, 앱 D1 client, staging/운영 DB 아님.
- 합성 `caseId=SYN-A2-CASE`, `revision=8`, `dataVersion=4`, `runId=SYN-A2-R79-RUN`; 원문/Fact/typed/SQL **형식 대응용 모형**(동일 저장 API를 호출한 종단 증거 아님). 원화 `value_json` JSON 문자열 vs SQL nullable `value_won`, `source_fact_ids_json` JSON 문자열, `status` 각 열 분리.
- **10/10 합성 feature INSERT 및 SELECT 재독**, `PRAGMA foreign_key_check=0`; 관측 결과:
  1. 명시적 0: `value_json="0"`(DB 열에 저장된 JSON 문자열 표기: `0`), `value_won="0"`, `status=computed` 보존.
  2. 미관찰: `value_json=null`(JSON 텍스트), `value_won=SQL NULL`, `status=missing`; 원천 전용 케이스는 `blocked` 메타로 보존 (source-only 자체는 DB status enum이 아님).
  3. 상충은 `status=conflict`로 문자열과 별도 저장되며, **법률상 확정 아님**.
  4. `source_fact_ids_json=["FACT-NOT-IN-CASE"]`, `["FACT-A","FACT-A"]`, `[]` 모두 **저장 허용**, FK 위반0. 이는 사실관계·동일 사건 소유관계의 보증이 아니라 DB가 외래 Fact 검증을 수행하지 않는다는 관찰.
  5. `value_json="50"`와 `value_won="70"`의 **서로 다른 값 허용**; 원화 일관성은 앱/재조회 단계 검증 의존.
  6. **malformed `value_json={not-valid-json`도 INSERT 성공**, SQL `json_valid=0`, FK 오류 0. D1/앱에서 `JSON.parse` 예외 처리 필요.
- 현재 SQL에는 Fact ID 소유관계에 대한 FK가 없고 `caseCalculationFeatures.sourceFactIds`는 trace에서 추출한 문자열 배열, `PlanLedgerRow.sourceIds`는 debt Fact 또는 calculation allocation Fact에서 유래. **두 데이터 구조를 같은 생산자·사건·판본으로 조인해 검증하는 실제 소비처는 이 회차에 종단 실행하지 않았다.** 형식 일치≠동일 source Fact 존재≠법률 인정.

## 3. 정적 계약 및 공식 출처

- main reference JSON blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 계산 **18모듈 / 입력선언 91 (고유 78) / 출력선언 42 (고유40) / 저장 resultPaths 42 (고유42)** 직접 JSON 파싱. 18개 모듈과 91개 입력 실제 실행·42개 출력 golden 금액은 **미인증**.
- main token catalog blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`, public catalog blob `9bae52fdf47fbc0935314bb5267503e4182080bd` 직접 JSON 파싱: D5103 **37/35**, D5110 **55/53**, D5111 **82/80** 등록/매핑 토큰; 각 2개 차이는 `review_status`, `revision`; 공개 서식은 전부 `reviewer_pending`. Word 생성·바이트 재독/법원 공식서식 확인 아님.
- 독립 급여/사업소득 산술 참고: 급여12×2,400,000 = **28,800,000원**, 사업소득 관측11×1,000,000 = **11,000,000원**, 관측 합계 **39,800,000원**. 사업 미래 12월 `null`을 0으로 보간하지 않고, VAT 신고매출/종합소득세 신고액을 법원 인정 월순소득에 자동 가산하지 않음.
- **서울회생법원** 2026-10-01 보도자료: 실무준칙 **제424호 제2조 제2항 제7호 신설** [법원 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187). 첨부 개정전문 부칙/경과조치·사건 적용일 미인증; 공지일≠자동 효력일.
- **국가법령정보센터** `채무자 회생 및 파산에 관한 법률` [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): **[시행 2026-10-02, 법률 제21490호]**. 변제기간·우선/재단채권·청산가치·인가요건은 내부 기술 complete와 무관. 개별 사건의 관할법원/접수일/경과조치/변호사 승인 미인증.
- **국세청** [부가가치세 개요](https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401): 일반과세자 반기/간이과세자 통상 연간 과세기간; 신고매출/종합소득세·월순소득은 원천 용도가 다른 항목으로 보존.

## 4. A2 해당 ID (완료 [x] 0건, 부분 기록만)

| 체크 ID | 이번 관찰 | 상태 |
| --- | --- | --- |
| **A2-DATA-009** | 원금/이자 각각 null/invalid 분리, reviewed 허위 complete 9건, #185 차단후 9/9 | [ ] 부분 |
| **A2-DATA-017** | 원장 sourceIds와 저장 source_fact_ids_json 생산경로 정적 대조, 실제 same-run/same-Fact 종단 검증 미완 | [ ] 부분 |
| **A2-DATA-020** | 0/null/invalid/conflict/source-only/승인전 구분; 0원은 정상 보존, null은 보수적 block 후보 | [ ] 부분 |
| **A2-DATA-024** | 0011 DDL SQL 10행 저장·재독 및 FK0; D1 API·전체 migration 미실행 | [ ] 부분 |

**실행/미실행 구별**: V8 원본 함수 분기 실행/SQL 메모리 DDL 실행/JSON 정적 파싱/공식 HTML 확인 **완료**. 신규 Node 시험 선언 21건+TODO4 **작성만**. 전체 Node/CI, 실제 원문→Fact→typed→SQL→42계산→법원서식 DOCX 재독, staging D1/R2/Cron, 변호사·계산사무장 승인, 사이트 배포 **미실행·미인증**. 운영 D1 migration, 전자제출, 인가확정 **금지·미실행**. 제품 인수 완료 **0건**.

**r80 AX담당자**: #185 부모 #183~#168 스택 병합관계·회귀 Node runner 실측 우선, CaseData.factIds의 존재·유효/철회 및 same-case owner 검증, SQL outputPath/status→승인 준비도→D5110/11 표시·재독 일치, 36/48/60 초과지급/세금채권 누락은 실제 변호사 확인 및 독립계산 기대 정의 전 자동 규칙 변경 금지.
