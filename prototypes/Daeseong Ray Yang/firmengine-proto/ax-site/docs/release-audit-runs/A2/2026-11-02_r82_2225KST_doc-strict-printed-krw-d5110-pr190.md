# FirmEngine A2 r82 — 사용자·서류담당자: D5110 가시 금액 형식 보존 및 7열 산식 재독
- 시작 날짜: 2026-11-02 22:25 KST. **역할 순환** r81 IT → **r82 사용자·서류** → r83 계산사무장.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 실고객 문서·개인정보·OCR 사실값·.env·키·비공개 정답 **없음**, 모든 입력은 SYN 합성.
- 최초 실측 main HEAD `ea367ab2b6237a9093e53e1537ef9d72e8b9fafe`; 직전 r81 영수증 및 중앙 보드 blob `f30ab693eaf93708ae40328a0ee478693f3a4c46`를 읽었다. receipt write 직전 main HEAD `ea367ab2b6237a9093e53e1537ef9d72e8b9fafe`.
- main 원본문 `lib/document-filing-readiness.ts` blob `9b994210443e12b596170c2bd11a75cd77db905d`, 부모 Draft #181 동일 파일 blob `cad2c6673abb5ae8acbcadb36d940a00deef1e9d`. 부모 Draft #181 미병합 HEAD `ed83128212411c2260fe6d8c710589922eeb2835`. r81 #188 Draft도 미병합이며 원천 Fact 소유·동일사건·producer/revision은 별도 미검증.
- 읽은 코드: `document-filing-readiness.ts`의 `parseWon` / `isD5110SevenCellTable` / `formulaStatus` / `assessDocumentFilingReadiness`, `form-contracts.ts`, `document-writer.ts`, `repayment-plan-model.ts`, `case-calculation-feature-store.ts`, `form-template-data.ts`, `package.json`. 관련 r76/r81 영수증·#181/#166/#188 및 최근 PR·main SHA 대조.

## 1. 실행 입력 / 독립 산술 기대 / 관찰
- GitHub **실제 #181 함수 본문**에서 TypeScript 타입 표기만 제거하고 JavaScript V8 격리 평가. 독립 검증 oracle: 원화 정수 표시는 쉼표를 사용하는 경우 세 자리 묶음, `₩`는 선행 통화기호, `원`은 후행 단위; 숫자 내부 공백·`원` 또는 쉼표 묶음 파손을 **자동 수리하지 않고 unknown**으로 분류. 이 oracle은 **표시 무결성** 기준이지 법원/회계 인정 기준이 아님.
- 합성 문자열 23종: 정상 `0`, `0원`, `100`, `1,234`, `1,234원`, `₩1,234`, `₩ 1,234원`, `−1,234원`, `9007199254740993`, `100,000`, `1,000 원` 등과 잘못된 `1,00`, `1,234,56`, `12원34`, `1원2`, `0 0`, `12₩34`, `1,,000`, `01`, 빈값 / undefined. **기존 원본문 15/23 기대일치, 수정 후보 23/23**. 원본문의 `1,00`→100, `1원2`→12, `0 0`→0이 실제 관찰되었다.
- D5110 **7열 ①~⑦**: ①소득 / ②생계비 / ③가용소득=①−② / ④수수료 / ⑤실가용소득=③−④ / ⑥개월 / ⑦총액=⑤×⑥. **36/48/60개월 각 4종 = 12건** `formulaStatus` 원본문 V8 실제 평가: 정규 `1,000원,400,600,100,500,m,500m` → consistent, 비정규 `1,00,40,60,10,50,m,50m`·`1원0,4,6,1,5,m,5m`·`0 0,0,0,0,0,m,0` → 독립 기대 unknown. **기존 3/12 일치(비정규 9건 허위 consistent), 후보 12/12 일치**.
- 독립 보조 산술: 36/48/60개월 정상 500원×m = **18,000/24,000/30,000원**, malformed `1,00`의 기존 오독 100−40−10=50원은 **표기값을 임의 수리하여 얻은 계산**이므로 진정한 금액으로 인정 금지. BigInt 9,007,199,254,740,993원 입력을 JS Number로 축소 금지.
- **기술 status** `consistent`는 Word에 표시된 수치의 수식 검사 결과만 말한다. `officialParity=not_verified`, `readyForElectronicFiling=false` 유지. `0`은 관측된 정확 0인 경우만 0이고 `null`·미관찰·상충·source-only·승인전·NA와 다르다.

## 2. 변경 / 독립 판본 / 미실행
- main 제품 코드 **변경 없음**. 부모 #181의 HEAD에서 `audit/a2-r82-doc-strict-d5110-readback-20261102-2225` 생성 → [Draft PR #190](https://github.com/firmengine/firmengine/pull/190), base **#181의 브랜치**. 수정 `lib/document-filing-readiness.ts` (기존 무차별 쉼표·통화단위 삭제→표시 정규성 검사) 및 신규 `tests/a2-r82-doc-strict-d5110-readback.test.mjs` **정확히 2개 파일만**, 모두 허용 prefix. 변경 branch HEAD `0bff88093bc8ebbf392aaabe3a917b9a6d7ec9ea`; 이전 함수 blob `cad2c6673abb5ae8acbcadb36d940a00deef1e9d`, 변경 후 `5d737adcdbbe89ea7ed72815f7a930052c612f9a`.
- 신규 Node 테스트 **8 test 그룹 + TODO 3 작성·커밋, 프로젝트 Node runner에서 실행하지 않음**. 실제 DOCX 생성·ZIP/XML 재독, SQL→서식 모든 숫자/행, full CI, staging D1/R2/Cron은 미실행·미인증. 단독 V8 통과가 PR 머지나 법률승인 아님.
- 본 회차 **정적 재파싱**: `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 계산모듈 / 91 input(고유78) / 42 output(고유40) / 42 resultPaths**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5110 55, D5111 82 등록토큰. 이건 **계약 정적 파싱**일 뿐 실 계산·3 DOCX 토큰대체·공식양식 동일성 검증이 아니다.
- 이전 r81의 합성 원금 100원/이자 0원·36/48/60개월 잔액 64/52/40원은 기존 영수증의 사실이며, 본 회차 동일 실제 ledger/SQL/staging 계산을 **재실행하지 않았다**. 누락/외부 Fact ID 및 owner·producer/revision 검증은 여전히 미인증.

## 3. 공식 문서 확인(해당 법원·시행일·원천, 승인 전)
- [서울회생법원 2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 제424호 제2조 제2항 제7호 **신설 공지 게시일 2026-10-01**. 개정전문 PDF 부칙/경과규정과 개별 사건 적용일은 읽어 확인하지 못해 **미인증**, 무승인 자동규칙 변경 금지.
- [국가법령정보센터 2026-10-02 시행 법률 제21490호 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR) 변제계획 내용·변제기간; [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR) 공정성·수행가능성·청산가치 인가요건. 2026-10-02 법률 판본 시행이 사건별 관할·준칙 자동 적용 확정은 아님.
- [국세청 부가가치세 공식 과세기간](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806): 일반과세자 반기, 간이과세자 통상 연간. VAT/종합소득세 신고액은 월별 순소득과 중복합산하거나 법원 인정 소득으로 자동 승격하지 않는다.

## 4. 중앙 보드 체크 ID (모두 부분 [ ] 유지)
| 체크 ID | 확인 | 미완료 조건 |
|---|---|---|
| `A2-DOC-005` | D5110 36/48/60×4 산식 12건, 표시값의 허위 수식 일치 P2 발견·후보 수정 | 실제 D5110 계획배분표/채권·공식서식·DOCX 금액 E2E |
| `A2-DOC-016` | 23종 정확0/정상/비정규/null 및 문자열 BigInt 출력 구분 | source-only·NA·conflict·승인전 typed→SQL→DOCX 왕복 |
| `A2-DOC-018` | D5103/D5110/D5111 정적 37/55/82 토큰 확인, 공식 수식 7셀 산술 격리 실행 | 실제 Word 생성, 숫자/행/문단 바이트·XML 독립재독 |

### 다음 r83 — 계산사무장
- Draft #190/#181 문서 재독과 #188/#186 변제원장 분기를 동일 테스트 러너에 **실제** 실행; parent PR 계층 충돌·중복 파일 수정 병합 점검.
- 36/48/60개월 채권자별 원금·이자·세금/우선채권 배분합의 **정확한 계산 판본**을 SQL stored values→D5110/D5111 7열·반복행으로 대조; raw/Fact/typed/SQL source lineage, 외부 Fact/빈 Fact·소유관계·0/null/미래월과 원금 초과지급을 독립 재계산.
- 서울회생법원 제424호 부칙/경과규정, 사건별 법원/접수일 및 공식 서식·변호사/실무자 승인 전 절대 법률 인가·확정 금액 승격하지 말 것.

**제품 인수 완료 0건.** 운영 배포/운영 D1 마이그레이션/전자제출/법원 인가 확정 실행하지 않음.
