# FirmEngine A2 r61 — 데이터담당자: 정수 원화 피처 저장상태·동일 run 재시도 무결성

- **감사 기준:** 2026-11-02 KST; **r60 변호사 → r61 데이터담당자 → r62 AX담당자**. 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`로 한정.
- 시작 main `95e85860bce648e3efd24cce111bf952e7922c82`; 최신 main commits/열린 Draft PR #145/#144/#141/#138 등, r60 영수증과 단일 중앙 보드, 스키마/소스/기존 테스트 재조회. 이 기록 직전 main **`95e85860bce648e3efd24cce111bf952e7922c82`**.
- 검토 ID: **A2-DATA-016, 017, 020, 024**. 모두 **[ ] 부분 검증**; A2 제품 최종 인수/법률 인정·계산사무장 승인 **0건**.
- 실제 main blob: `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `lib/preapproval-calculation-replay.ts` `9517e71ee238955ee4af679bce1ebced888c4432`; `app/api/cases/[id]/approval-readiness/route.ts` `731f66a10d4af704b432dcd298061b452941fd13`; `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`; 기존 `tests/case-calculation-feature-store.test.ts` `844525d8633442d571ced2c48ed5bd00ba7bb5a0`.

## 1. 실제 금액 피처 저장 코드: 원화 미정규화값의 computed 오판 (A2-DATA-017/020)

**독립 기대값:** 이름이 `Won`으로 끝나는 관측 금액이 올바른 원화 정수 문자열/안전한 정수로 정규화되지 않으면 `computed`와 `value_won=NULL`이 동시에 나타나서는 안 됨. 원문 값은 삭제·0원 대입하지 않고 **내부 검토보류**로 유지. 정상 `"0"`, `null`, `not_applicable`, source conflict는 서로 다르게 유지.

실제 main `statusOf(value,"calculated")` 함수와 `won(name,value)` 원본문을 GitHub blob에서 추출하여 V8에서 실행. 다음 표는 **실제로 관찰한 값**이며 엔진에서 해당 이상 입력이 자연 발생했다는 증명은 아님.

| 합성 `output_name`·관측값 | 독립 기대 저장상태 | main 원함수 관찰 (`status/valueWon`) | Draft #148 후보 관찰 |
|---|---|---|---|
| `monthlyIncomeWon="0"` | computed / "0" | computed / "0" | computed / "0" |
| `monthlyIncomeWon=null` | missing / null | missing / null | missing / null |
| `monthlyIncomeWon="unknown"` | missing / null | missing / null | missing / null |
| `monthlyIncomeWon="2400000"` | computed / "2400000" | 동일 | 동일 |
| `debtRows.principalWon="-100"` | computed / "-100" (법률적 정당성 별도) | 동일 | 동일 |
| **`monthlyIncomeWon="9,00"`** | **blocked / null, 검토사유** | **computed / null** | **blocked / null** |
| **`monthlyIncomeWon="1 000"`** | blocked / null | **computed / null** | blocked / null |
| **`monthlyIncomeWon="1.5"`** | blocked / null | **computed / null** | blocked / null |
| **`monthlyIncomeWon=9007199254740992`** | blocked / null | **computed / null** | blocked / null |
| **`monthlyIncomeWon="[미관찰]"`** | blocked / null (표시 문자열 원화값으로 오투입) | **computed / null** | blocked / null |
| `monthlyIncomeWon="0"`, reason=SOURCE_CONFLICT | conflict / "0" | 동일 | 동일 |
| `incomeRows.label="salary"` | computed / null (비금액 문자) | 동일 | 동일 |
| `incomeGroups.observedMonths=12` | computed / null (비금액 수량) | 동일 | 동일 |
| `monthlyIncomeWon=null`, engine=not_applicable | not_applicable / null | 동일 | 동일 |

**원본문 기반 V8 총 14건의 후보 독립 기대 일치 14/14**. 코드가 실행돼야 하는 실제 엔진 경로/Node 프로젝트 테스트를 돌렸다는 뜻이 아님. 기존 main에서 잘못된 원화 형식 5건의 `computed + valueWon=null` 상태를 관찰.

**별도 [Draft PR #148](https://github.com/firmengine/firmengine/pull/148):** branch `audit/a2-r61-data-won-status-20261102-0109`, main SHA `95e85860...` 기반. `lib/case-calculation-feature-store.ts`에 `classifyStoredFeatureMoney` 순수 저장분류 가드, 신규 `tests/a2-r61-data-monetary-feature-status.test.ts` 4그룹 작성. 원문/실제 금액·산식·원천 Fact·법률 판정은 변경하지 않으며, 잘못된 Won 표현만 저장 status=blocked 및 reason=`INVALID_MONETARY_FEATURE_VALUE`로 보존. 코드 커밋 `da7f203147472071dd904f9228efceec5f952c6c`, 테스트 커밋 `f94cbab467af2f1dc5371770f996b78418219a8c`, 수정 blob `eec10fb49653ced2928ae3ea9455c246339c7073`. 커밋 재조회 V8 14/14, PR 변경 파일 2개 모두 허용 범위 내부, compare ahead=2/behind=0. **GitHub 프로젝트 Node 테스트·전체 CI 미실행**, Draft·미병합·실무검토 필요.

## 2. 실제 0011 SQL 구조를 사용한 합성 insert→재독 (A2-DATA-017/024)

`drizzle/0011_case_calculation_features.sql`의 **세 계산 테이블 DDL 및 인덱스와 동일 내용**을 Python `sqlite3 :memory:`에 생성. `cases(id,revision)`, `case_data_change_state(case_id,data_version)`만 외래키 검사용 가상 stub. 실제 `case-calculation-feature-store.ts`의 feature `INSERT OR IGNORE` 열/값 계약과 head `INSERT ... SELECT ... ON CONFLICT` 술어를 그대로 실행. 사건 `SYN-CASE`, revision 7, dataVersion 4, `SYN-RUN`, 가상 Fact `SYN-F1`만 사용.

| 독립 합성 검증 | 독립 기대 | 실제 SQLite 관찰 |
|---|---|---|
| 원화 `value_json='"2400000"',value_won="2400000"` 최초 저장 | 저장/재독 | 1행 보존 |
| 정확히 같은 feature ID·값 재시도 | 정상 멱등 허용 | `changes()=0`, 행 보존 |
| **같은 feature ID에 `"9000000"` 덮어쓰기 시도** | **불일치를 명시적으로 감지해야 함** | **`changes()=0`, 기존 `"2400000"` 유지** |
| 위 상태에서 원래 head UPSERT 수행 | feature 충돌 시 승격 검토보류 | **`changes()=1`, head=`SYN-RUN`** |
| 명시적 0 `"0"/"0"/computed` | 0 보존 | 그대로 재독 |
| 미관찰 `null/SQL NULL/missing` | null 보존 | 그대로 재독 |
| JSON `null` + `value_won="0"` + computed | 의미적 상충 신고 | SQL은 1행 저장 허용 |
| `source_fact_ids_json="NOT_JSON"` | JSON 계보 오류 신고 | SQL은 1행 저장 허용 |
| FK 점검 | 관계 위반 0 | `PRAGMA foreign_key_check=[]` |

**조건부 신규 위험:** run ID는 `rawResultSha`, 원천 head SHA·reference 등을 포함한 결정적 해시이므로, 같은 정상 생산자·같은 run에서 서로 다른 금액이 저절로 나온다고 단정할 수 없음. 다만 **사전 존재하는 오염행, 배포 버전과 serializer 계약 변동, 같은 ID 충돌**이 있으면 `INSERT OR IGNORE`가 이를 숨기고 head UPSERT가 가능함을 SQL 수준에서 확인. **정상 제품 실행에서 실제 발생한 P1 확정이 아니며**, 멱등쓰기 정책·D1 원자성을 건드리는 수정을 이번 PR에 혼합하지 않음. 후속 IT/데이터 담당자가 read-before-write/CAS/충돌 검출 정책을 별도 PR과 실제 D1 격리시험으로 검토해야 함. #138의 read-side Fact 검증·#136의 출력집합 검증과도 통합 필요. 운영 SQL/data migration 미실행.

## 3. 실제 계산 계약·원문→Fact→typed→SQL feature→서식 연결 경계 (A2-DATA-016/017)

`lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18모듈, 입력 선언 91(고유78), 출력 선언 42(고유40), `resultPaths` 42(고유42)**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5110 **55**, D5111 **82** 토큰. JSON 파일 실제 재파싱 결과. 91개 typed 포인터, 42 SQL 출력, 실제 DOCX의 개별 토큰 값까지 전수 실행한 것은 아님.

**합성 원천/Fact/typed 대응 산술(독립 Python, 제품 엔진 미실행):**
- 가상 2026년 급여 원천: `SYN-WAGE-01..12`, 월 2,400,000원, 같은 월 Fact를 중복 계산하지 않는다는 가정 → **12×2,400,000=28,800,000원**. 인정 월소득이 아님.
- 가상 2026년 사업소득 관측: `SYN-BIZ-01..11`, 월 1,000,000원 → **11×1,000,000=11,000,000원**; 12월 **미관찰(null)**, 0원으로 대체하지 않음.
- 관측 합계 **39,800,000원**은 서로 다른 기간·원천의 합이지 법률상 인정된 월순소득/변제재원이 아님. 가상 VAT 상반기 매출 60,000,000원, 전년도 종소세 신고액 20,000,000원은 **source-only 세무자료**로 별도 보존하고 위 소득에 중복 합산하지 않음.
- 월 900,000원×36/48/60개월 = **32,400,000/43,200,000/54,000,000원**; 48·60개월은 법 제611조 특별사정 검토 필요. 청산가치 32,000,000원 vs 현재가치 30,000,000원 차이 **2,000,000원**(법원 인가/예외 판단 아님).
- 37원+35원 채권 구성 = 총 72원. 36개월 월 2원 단순 예산이어도 원금/이자 잔여원 분배는 첫 회 3원 가능(선행 Draft #133 참조). **실제 `executeCaseNodes`·D5110/D5111 Word/DB 연동 산식 검증은 미실행**.

## 4. 법원·법률·국세청 공식 근거와 승인 경계

- **국가법령정보센터** 채무자회생법 **[시행 2026-10-02, 법률 제21490호] [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777)**: 변제기간은 3년 원칙, 특별사정 5년 범위. **[제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759)**: 공정·형평·수행가능·청산가치와 법원 인가요건. 본 회차 적용 법률 **2026-10-02 시행판**, 법원 사건별 소급·경과는 미승인.
- **서울회생법원** [2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): **실무준칙 제424호 제2조 제2항 제7호 신설** 공지 확인. PDF 첨부의 부칙·경과조치와 사건별 효력일 **미확인**. 공지일을 무승인 자동규칙 적용일로 승격하지 않음. 사건 관할도 합성 데이터상 실제 지정 없음.
- **국세청** [부가가치세 및 종합소득세 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반 VAT 통상 반기, 간이과세자 통상 연단위, 종합소득세 연간 소득 합산 신고는 통상 다음해 5월. 세무매출/신고액을 개인회생 월소득으로 자동 전환하지 않음.

## 5. 보드 ID·남은 검증·다음 회차

| ID | 이번 실제 작업/관찰 | 상태 |
|---|---|---|
| `A2-DATA-016` | 18/91(고유78)/42 결과경로, D5103/10/11 37/55/82 정적 파싱. typed 원문 포인터×91 종단 미확인 | **[ ] 부분** |
| `A2-DATA-017` | main 저장원화 status/valueWon 상충 V8 재현, Draft #148 커밋 재시험 14/14; SQL 동일 ID/값 불일치 OR IGNORE 은폐 조건부 재현 | **[ ] 부분** |
| `A2-DATA-020` | `"0"`/null/unknown/상충/비해당/형식오류 분기 실제 main+후보 V8, SQL 0/NULL 보존·JSON/WON 의미상충 검사 | **[ ] 부분** |
| `A2-DATA-024` | 실제 0011 DDL 동형 SQLite INSERT→SELECT 및 FK0; 동일 run ID 재시도의 조용한 충돌은 발견하였으나 실제 staging D1/앱 호출 미실행 | **[ ] 부분** |

**다음 r62 AX담당자:** Draft #148 분류가 실제 `calculationFeatureRows()`·`persistCaseCalculationFeatures()`·`listCaseCalculationFeatures()`와 결합돼도 올바르게 검토상태로 남는지 프로젝트 Node 러너·합성 D1에서 시험. 임의로 원화 금액을 보정하거나 부채/VAT를 합산하지 않기. #71→#135→#136→#138 저장 재생/Fact 계보, #130/#141 서식, #133 잔여원, #144/#145 파서, #49/#87 head CAS의 충돌·선행순서 점검. 승인된 법원 준칙 전문·부칙 원문과 사건별 관할/시행일 대조, 변호사·계산사무장 확인 전 법률 인정/출력 승인 불가.

**미실행/미인증:** 프로젝트 Node 회귀시험·전체 CI, 운영/staging D1/R2/Cron, 18모듈·91입력 실전수, 42개 SQL 결과 전수, 실제 DOCX 생성·재독 및 공식 서식 동등성, 최종 변호사/계산사무장 승인. 실제 고객 원문/OCR/개인정보/키/.env/비공개 정답 공개 Git 미적재. 운영 배포·D1 운영 마이그레이션·실제 전자제출·법원 인가 확정 **수행하지 않음**.
