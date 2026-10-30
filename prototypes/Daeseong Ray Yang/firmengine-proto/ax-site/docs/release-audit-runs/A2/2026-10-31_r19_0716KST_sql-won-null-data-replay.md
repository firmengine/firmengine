# FirmEngine A2 19차 — 데이터담당자: SQL value_won NULL과 원화 결과 원장 재검증

- 감사 기준일: 2026-10-31 KST. 순환: 14차 AX → 15차 IT → 16차 서류 → 17차 계산 → 18차 변호사 → **19차 데이터** (다음 AX).
- 시작 `main` HEAD: `94ed1a5649e4ec43d91032959fc1329db60a42f9`; 기록 직전 HEAD: `94ed1a5649e4ec43d91032959fc1329db60a42f9`. 직전 18차 영수증 및 중앙 인수보드·GitHub 최근 커밋/PR를 확인함.
- **보드 ID(4개)**: `A2-DATA-005`, `A2-DATA-016`, `A2-DATA-017`, `A2-DATA-024`. 각각 **부분 검증, 모두 [ ] 미완**; 인수·법률·회계 승인 없음.
- 관련 원본 확인: `lib/preapproval-calculation-replay.ts` blob `9517e71ee238955ee4af679bce1ebced888c4432`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`, 승인 API `app/api/cases/[id]/approval-readiness/route.ts` blob `731f66a10d4af704b432dcd298061b452941fd13`, 기존 `tests/preapproval-calculation-replay.test.ts` blob `8d8459d43c9f1ebd8c596526e1b35fb620a3ae0f`. 자료에 실제 고객 정보 없음.

## 1. 원문/Fact/typed/SQL feature 경계 (가상 데이터)

**합성 source 예시**: 원문 `SYN-WAGE: 2026-01 월급 2,400,000원`. Fact `{id:"syn-f19",key:"income.net",rawValue:"2,400,000",value:"2400000",sourceUnit:"KRW",state:"verified",recognition:"accepted"}`와 typed `{net:{rawValue:"2,400,000",amountWon:"2400000",unit:"KRW"},periodStart:"2026-01-01",periodEnd:"2026-01-31"}`는 **수동 구성한 합성 예시**이며 실제 OCR·Fact 저장/법률상 인정을 실행한 것이 아님.

`0011` SQL은 `case_calculation_runs`/ `case_calculation_features`/ `case_calculation_heads`로 구분되며, feature는 `value_json TEXT NOT NULL` 및 `value_won TEXT`를 별도로 저장. 현재 저장기 `won()`은 이름이 `Won`으로 끝나는 정확한 정수 문자열을 두 열에 함께 보존함. 승인 API는 SQL `value_won AS valueWon`를 실제 replay 함수에 전달함. SQL NULL과 명시적 0원은 다름.

### 신규 P1 — 저장 숫자열 유실을 replay에서 정상 취급

합성 실행 `execution.assessment.calculation.monthlyIncomeWon="2400000"`, SQL 형태의 원화 피처 행 `{outputName:"monthlyIncomeWon",outputPath:"/assessment/calculation/monthlyIncomeWon",valueJson:"\\"2400000\\"",valueWon:null,status:"provisional",sourceFactIdsJson:"[]"}`.

독립 기대: 정확한 `"2400000"`이 JSON에 있으면서 `value_won`이 SQL NULL이면 **`STORED_WON_MISMATCH`로 차단**; null을 0원으로 바꾸지 않는다. 기존 replay는 양쪽 값 비교를 `valueWon!==null`일 때만 수행해 `valid:true` 반환. 승인 준비 API는 `storedCalculationReplay.valid`를 계산-현재성 조건으로 소비하므로 거짓 통과 위험.

| 실제 V8 격리 시나리오 | 기대 `valid` | main 실제 | 후보 실제 |
| --- | --- | --- | --- |
| 2,400,000원 / value_won "2400000" | true | true | true |
| 2,400,000원 / SQL NULL | false | **true** | false |
| 0원 / SQL NULL | false | **true** | false |
| 0원 / "0" | true | true | true |
| 정당한 미관찰 JSON null / SQL NULL | true | true | true |
| 법원 승인 추정 불가(scope false) / SQL NULL | true | true | true |
| 2,400,000원 / value_won "1" | false | false | false |
| BigInt 금액 9,007,199,254,740,993원 / 동일 문자열 | true | true | true |
| 위 BigInt 금액 / SQL NULL | false | **true** | false |

**실행방식**: main의 실제 `auditStoredCalculationReplay` 함수 본문에서 TypeScript 타입만 제거하고 V8에서 실행; 후보는 해당 원본문에 3행 가드만 추가하여 동일하게 실행. 독립 기대 **main 6/9 → 후보 9/9 일치**. 엄밀한 범위는 메모리의 1행 replay; 실제 Node 테스트, SQL INSERT/SELECT, D1 staging, 전체 CI, DOCX는 **실행하지 않음**.

- 수정안: **Draft PR #70** (미병합), 브랜치 `audit/a2-r19-sql-won-null-20261031-0716`. SQL `valueWon===null` + 정확한 정수 `Won` 출력 경로만 기존 `STORED_WON_MISMATCH`로 거부; 기존 오류코드 재사용, VAT·소득인정·변제산식 변경 없음.
- 코드 커밋 `854af466eb26d02243052da1d437a779f3447d13`; 신규 회귀 5그룹 `tests/a2-r19-sql-won-null-replay.test.ts` 커밋 `7297e6eceb4a703f834f5ece18e1d40ca67110ff`, **정식 Node 실행 미실시**.
- **Draft PR #33**은 같은 replay 파일의 저장 출력행 누락을 방어하므로 병합 시 합성/Node 통합 테스트 필수. 다른 에이전트의 #33은 변경하거나 덮어쓰지 않음.

## 2. 계약·독립 산술·보류 범위

- `reference-decision-tables.json` 실제 JSON 파싱: **18모듈/91 입력 선언(78 고유경로)/42 출력 선언(40 고유 이름)/42 고유 resultPaths**. `template-token-catalog.json` 실제 파싱: D5103 **37**, D5110 **55**, D5111 **82**. 이는 명세의 **정적 열거**일 뿐 91입력/42출력의 전 경로 저장·재조회 성공 아님.
- **독립 BigInt 산술**: 관측 급여 2,400,000원 − 가정 생계비 1,400,000원 = 1,000,000원; 명목 36/48/60회 합계 36,000,000/48,000,000/60,000,000원. 가정 비용·기간으로 실제 법률상 인정변제액을 추정/승인하지 않음. VAT·종합소득세 매출총액 이중 반영도 이번 코드는 변경하지 않음.
- 11/12개월 급여 누락·미래월, 사업자 VAT 중복, 채권/재산/청산가치, 전 5,000행 SQL 재조회와 D5103/D5110/D5111 공식 토큰 출력은 **미검증**. 이전 Draft #67(부분월 급여), #60(OCR 쉼표), #58(서식 숫자), #33(출력 누락)과 회귀 통합 필요.

## 3. 공식 원문 확인·적용 경계

- **국가법령정보센터**, 「채무자 회생 및 파산에 관한 법률」 제611조, **2026-10-02 시행판 법률 제21490호**: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221 . 소득·재산·변제기간에 관한 법정 필드가 있으나 이 replay 숫자열 검증은 법률상 인정을 수행하지 않음.
- **서울회생법원**, **2026-10-01 공지**, 실무준칙 **제424호 제2조 제2항 제7호 신설**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . 공지 본문 확인. **첨부 PDF 상세요건·부칙/실제 적용일/사건별 관할은 이번 감사 미검증**, 자동규칙 승격 금지.
- **국세청**, 부가세 일반/간이 구분과 신고기간: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272 . VAT는 월 인정순소득 산식과 동일하지 않음.
- 법률·세무회계 적합성 및 실제 공식 Word 양식 승인 **변호사/실무자 확인 전 미인증**.

## 4. 후속

다음 순환은 **AX담당자**. #33 + #70 동일 파일 통합 후 정식 Node 회귀(기존 5+신규 5·다른 A2 테스트) 및 0/null/미관찰/상충/원문-typed-저장 출력 전 경로 대조, #67 급여 11/12개월, #58 서식 숫자, #60 OCR 그룹 검증을 실행해야 함. 생산 운영 배포/D1 운영 migration/실제 전자제출/법원 인가 확정은 **수행하지 않음**. 제품 인수 완료 **0건**.
