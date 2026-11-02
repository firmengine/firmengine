# FirmEngine A2 r76 — 사용자·서류담당자 / 서식 미해결 표시와 DOCX 재독 보고 정합성

- 감사일시: **2026-11-02 16:20 KST**, GitHub `firmengine/firmengine` `main`, 작업 경로 **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정**.
- 역할 순환: r75 IT → **r76 사용자·서류담당자** → r77 계산사무장. 단일 중앙 보드 ID: **A2-DOC-015 / A2-DOC-016 / A2-DOC-018 / A2-DOC-020**. 네 ID는 전부 **[ ] 부분검증**. 제품 인수 완료 0.
- 시작 main SHA: **`b7778c54505371282c4d8bbc57de228bb1fe3a09`**. 문서 작성 직전 main SHA: **`b7778c54505371282c4d8bbc57de228bb1fe3a09`**. 최신 A1 r76 커밋 `b7778c5`, A4 r75 `768847c`, A3 r75 `0d4affb`, A2 r75 `b3f6ce1` 및 지난 영수증(15:10 KST) 검토.
- 실제 main 파일/blobs: `lib/document-filing-readiness.ts` **`9b994210443e12b596170c2bd11a75cd77db905d`**, `lib/document-preflight.ts` **`dc771c0ff0497d24df19478b0366ebbb397bfbf2`**, `lib/form-mapping.ts` **`514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`**, `lib/office-writer.ts` **`78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`**, `tests/document-filing-readiness.test.ts` **`551e5631f07de10147b28d49218ade250b2f001f`**, `lib/reference-decision-tables.json` **`6924e3977caf748ce8a3d617fae15aff7d2fe2ce`**, `lib/template-token-catalog.json` **`899c4d564fcb1726861f89dcf04dbf1b7e372687`**, `public/templates/catalog.json` **`9bae52fdf47fbc0935314bb5267503e4182080bd`**.
- 관련 미병합 Draft #165(저장 피처→승인 준비도), #166(필수서식 미확정값 사전검증), #178(원장 Fact ID 형식 및 중복) 확인. 이 회차에는 스택을 병합하거나 다른 에이전트 파일을 수정하지 않음.

## 1. 결함 재현: 사전검증 vs 실제 작성 문서의 재독 보고

**상태별 역할 분리:** `evaluateDocumentPreflight()`의 Draft #166 `absent`는 문자열 `[미관찰]`, `[미상]`, `[승인전]`, `[누락]`, `[오인식]`, `[판독]`, `[배분]`, `[미확정]`, `[원문만]`, `[원천만]`, `[검토완료]` 및 `source-only_bad`를 검토보류로 분류한다. 그러나 main `hasUnresolvedMarker()`는 `form.unresolvedTokens=[]`인 재독 문단/테이블의 같은 표시를 검토보류 사유로 보고하지 않는다. `renderPublicForm()`의 원본 `replace` 구현은 `undefined`, `MISSING_FORM_VALUE`, `[불일치...`에서만 unresolvedTokens를 모으기 때문에, 실제 화면에 남은 미확정 표시가 토큰 명단에서 누락될 조건이 존재한다.

**실제 실행 방법:** main `document-filing-readiness.ts`의 `allVisibleText()`, `hasUnresolvedMarker()` 본문을 그대로 가져오고 함수 인자의 TypeScript 타입 표기만 제거한 뒤 V8 `new Function`으로 실행. #166의 `MISSING` 및 `absent()` 본문도 타입 표기만 제거해 병행 실행. 새 정규표현식 후보에는 동일한 실행 방법 사용. 외부 함수 호출이나 모델 추정 결과가 아니다.

| 합성 입력(모두 가상, `unresolvedTokens=[]`) | 독립 기대 | 기존 main 재독 판단 | 수정 후보 |
| --- | --- | --- | --- |
| `0` / `0원` / `2,400,000원` | 미해결 표시 없음 | 없음 | 없음 |
| `[확인 필요] 원문` / `[불일치] 123` / `[상충]` | 미해결 표시 있음 | 있음 | 있음 |
| `[미관찰]` / `[미상]` / `[승인전]` | 미해결 표시 있음 | **없음** | 있음 |
| `[누락]` / `[오인식]` / `[판독]` / `[배분]` | 미해결 표시 있음 | **없음** | 있음 |
| `[미확정]` / `[원문만]` / `[원천만]` / `[검토완료]` | 미해결 표시 있음 | **없음** | 있음 |
| 단독 `source-only_bad` / `source-only` | 원천 전용 표시 있음 | **없음** | 있음 |
| 설명문 `일반 설명에서 source-only를 단어로 사용` | 미해결 표시 없음 | 없음 | 없음 |
| 테이블 셀 `[승인전]` / unresolvedTokens 빈 배열 | 미해결 표시 있음 | **없음** | 있음 |
| 메타데이터 `unresolvedTokens=[approved_monthly_income]` | 미해결 표시 있음 | 있음 | 있음 |

**실제 V8 측정:** 문단/테이블/메타데이터 **29가지 합성 기대** 중 기존 **15/29**, 수정 후보 **29/29** 기대 일치. 수정 후보의 추가 인식은 14개 테스트 조건(문단 13+테이블 1). 명시적 0, 정상금액, 일반 설명문의 source-only 언급은 미관찰/0으로 변환하지 않았다. **이 검사에서 실제 ZIP/DOCX 바이트는 생성하거나 열지 않았다.**

## 2. 수정 및 독립 재검증 경계

- [Draft PR #181](https://github.com/firmengine/firmengine/pull/181), `audit/a2-r76-doc-filing-visible-markers-20261102-1620` → `main`; 제품 본문 1개(`lib/document-filing-readiness.ts`), 회귀시험 1개(`tests/a2-r76-doc-filing-visible-markers.test.ts`)만 변경. 새 소스 blob `cad2c6673abb5ae8acbcadb36d940a00deef1e9d`, 테스트 blob `d079610119f2d7597d3682d69f6e2cdd9ad8ea7d`; 변경 branch HEAD `ed83128212411c2260fe6d8c710589922eeb2835`.
- 재독 보고의 `unresolved_markers_present`만 보강. **`officialParity=not_verified`, `readyForElectronicFiling=false` 불변**, 금액·기간·변제 배분·법률 인정·업무 상태 승격 모두 변경 없음.
- Node 정식 회귀시험은 **3그룹을 작성·커밋했으나 프로젝트 Node 테스트 러너에서 실행하지 않음**. 전체 CI/staging D1·R2/Cron 미실행. #166의 사전검증과 #181의 재독 보고를 실제 DOCX 생성 결과까지 통합하여 실행해야 함. 두 수정 모두 미병합 상태에서 병합 금지.

## 3. 계약·산술의 독립 재독 (정적/격리 수준)

- main `reference-decision-tables.json`: **18모듈**, 선언 입력 **91회/고유78**, 선언 출력 **42회/고유40**, 저장 결과경로 **42회/고유42**.
- D5103/D5110/D5111 **등록 토큰 37/55/82**, 공개 서식 mapped **35/53/80**. 세 서식의 차이는 각각 `review_status`, `revision` 2개. 공개 재구성은 세 서식 모두 `reviewer_pending`; 실제 Word 공식 판본 동일성 미인증.
- 합성 월별 산술 독립 BigInt: 급여 2,400,000×12 = **28,800,000원**, 사업 순소득 1,000,000×11 = **11,000,000원**; 관측 소득 산술합 **39,800,000원**. 사업 12월 미래 미관찰 **null**이고 0원으로 보간하지 않음. VAT 매출·종합소득세 신고자료는 **source-only**, 확정 월순소득에 중복 합산 금지.
- 합성 월 변제제안 900,000원×36/48/60회 명목합은 **32,400,000/43,200,000/54,000,000원**. 청산가치·현재가치·수행가능성·채권자별 배분 확인은 **미실행**. 18모듈/91입력 종단실행, 42결과 SQL 재조회 및 DOCX 토큰 수치 재독은 미실행.

## 4. 법률·국세청·법원 원문 (2026-11-02 재확인, 자동 채택 금지)

1. 서울회생법원 보도자료 **2026-10-01**: 「개인회생 변제기간 단축 대상에 관한 실무준칙 개정」, **실무준칙 제424호 제2조 제2항 제7호 신설** 공지. 원문 https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . 개정전문/부칙/경과규정과 개별 사건 적용일은 **미관찰**; 공지일만으로 사건 자동적용 불가.
2. 국가법령정보센터 **[시행 2026-10-02, 법률 제21490호]** 채무자회생법 **제611조**(기간 3년 원칙/특별사정 시 5년 상한) https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR ; **제614조**(형평·수행가능성·청산가치 등 인가요건) https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR .
3. 국세청 https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401 — 일반과세자 VAT 통상 **반기**, 간이과세자 통상 **연간**, 사업자 유형변경/예정신고 예외 확인. VAT 매출을 회생 인정소득으로 자동 승격 금지.

**공식 법원 서식·계산 의미·법률 및 세무회계 적합성:** 법원별 원문과 실제 사건 적용일/전문가 승인 전 **미인증**. 업무 담당자는 관리기준정보를 검토·승인해야 하며 이 회차는 법원 인정값을 확정하지 않음.

## 5. 중앙 보드와 다음 회차

| A2 ID | 수행한 관찰 | 현재 |
| --- | --- | --- |
| A2-DOC-015 | 미해결 표식이 공식 제출본처럼 보이는 재독 보고에서 누락될 조건, V8 반례/후보 재현 | **[ ] 부분** |
| A2-DOC-016 | 0원/미관찰/상충/원천 전용/승인전 표시 구분, 29조건 V8 | **[ ] 부분** |
| A2-DOC-018 | form registered/mapped 토큰 37/35·55/53·82/80 정적 확인, 실제 DOCX 바이트 미실행 | **[ ] 부분** |
| A2-DOC-020 | 내부 검토·source-only 텍스트의 최종 readback provenance 누락 방지 제안, 실제 공식 제출본 비노출 미인증 | **[ ] 부분** |

**다음 r77 계산사무장:** #178/#175/#173/#172/#168의 기본 변제원장을 실제 Node 통합시험으로 재생, 36/48/60개월의 배분합/채권 구성액/우선·재단채권/Fact 소유·빈 배열을 검증. #165 승인 준비도, #166 서식 preflight, #181 readback reporting까지 실제 Word ZIP 생성·재독으로 연결. 실무자/변호사 검토 전 병합·배포 금지. **main 제품 코드 변경 없음**, 운영 배포/운영 DB migration/전자제출/법원 인가 확정 **전부 미실행**.
