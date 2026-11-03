# A2 r114 — 변호사 관점: 관할·제424호 원천 ID 런타임 경계 독립검증

- 기준: 2026-11-04 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부, A2만. 직전 r113b 계산사무장 영수증을 이어 변호사 역할로 순환. 운영 배포/운영 D1/전자제출/법원 인가 미실행.
- 작업 시작 main HEAD: `78b4a033d88f8f470fd923c9d3a30da35ac60083`. 최근 main 커밋: A1 r113 보드 병합. 기존 코드/PR: main `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`, stacked Draft #225 → #226 blob `2e6f879e182d7c428f58d91ed75793029f2a7a20`; 이전 A2 r108/109/110/111 및 r113b 영수증, `legal-proposals.ts` `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c` 재독.
- 사용자 데이터/실제 문서/개인정보/.env/비공개 정답은 사용하거나 공개 저장하지 않음. 본 입력은 `SYN-*`의 합성값만 사용.

## 재현 입력/독립 기대/관찰

원본 `evaluateSeoul424`, `validDate`, `wageCriterion`, `evidenceTri` 및 #226 수정 함수를 GitHub blob에서 읽어 TypeScript 형식 표기만 제거하고 V8 격리 실행. 기준 파라미터는 실제 `lib/reference-parameters.json` blob `e57a9d7c99efe052d4581d780ed478d876eb3330`에서 주입(서울, 2026-10-01, 채무 50,000,000원, 임금이력 2년, 최근채무 1년). mock 데이터는 원천/법원 승인 아님.

기본 합성 사례: 관할 `seoul`, 입력 접수일 `2026-10-03`, 1~6호 검토 = 명시적 `no` + Fact `SYN-C`; 7호 4조건 = 증빙 Fact `SYN-A`, 엄격한 boolean true, 전 기간 급여 판본 `SYN-2026`. 독립 기술 기대 = `candidate_for_human_review` (인가/법률 적격성 **아님**).

| 합성 변형 | 독립 기술 기대 | main | 부모 #226 | 신규 #230 |
|---|---|---|---|---|
| 정상 기준 입력 | candidate_for_human_review | candidate | candidate | candidate |
| courtId = null | unknown | **candidate** | unknown | unknown |
| courtId = `""` / `" "` / `" seoul "` / runtime 숫자 123 | unknown | **not_applicable** | **not_applicable** | unknown |
| courtId = `busan` | not_applicable | not_applicable | not_applicable | not_applicable |
| 급여 Fact IDs = `["SYN-A"," SYN-A "]` | unknown | **candidate** | **candidate** | unknown |
| 1~6호 YES Fact IDs = `["SYN-C"," SYN-C "]`, 급여정보 null | unknown | **candidate** | **candidate** | unknown |
| 급여 Fact IDs = `[" SYN-A "]` | unknown | **candidate** | **candidate** | unknown |
| 임금 인정플래그 문자열 `"false"` | unknown | **candidate** | unknown | unknown |
| 급여 판본 null/급여 객체 null/경로 배열 null | unknown | TypeError | unknown | unknown |
| 최초 접수 입력일 2026-09-30 | unsupported_version | unsupported_version | unsupported_version | unsupported_version |
| 2026-10-01 입력일 | candidate_for_human_review | candidate | candidate | candidate |

**22개 시나리오(22 호출/판본)의 독립 기술 기대값 일치**: main **5/22**, #226 **15/22**, #230 V8 수정 후보 **22/22**. 부모 #226 대비 7개 차이는 4종 무효 관할 입력 + 3종 공백·정규화 중복 Fact ID이다. 누락/비정상 ID를 임의로 `0` 또는 불충족 `no`로 대체하지 않고 `unknown` 유지. source Fact ID의 실제 존재·사건 귀속·승인 계보는 검사하지 않았음.

## 변경 및 검증 계층

- [Draft PR #230](https://github.com/firmengine/firmengine/pull/230), 부모 **미병합** #226(#225 의존). 허용 경로 내 2파일만 추가 변경: `lib/seoul424-candidate.ts` (blob `92f1bc09d35062da1bb3328fcb3a930050dcfb96`), `tests/a2-r114-court-factid-whitespace.test.ts` (blob `884ac9c921e38e66f1535a3eb073a504f73d9bd2`). 코드 커밋 `d0c55ceb2dfca7a810bf8b4ce8be733ef08d5c5d`, 시험파일 커밋 `c922e212e07fa1053ed7a9f29c8d98bc872228e1`.
- V8에서 원본문 기반 독립 합성시험 **실행** 22/22(수정 후보). Node 회귀 **22개 선언/커밋만**, 저장소 Node runner/전체 CI **미실행**. 실제 Fact→typed→SQL feature→계산/서식 API, staging D1/R2/Cron, 실제 DOCX 생성·재독·공식 서식 동등성 및 변호사 승인 **미검증**.
- 법적 의미 변경(접수일 기준, 해당 요건 등) 없음. 원문 `buildLegalProposals`는 여전히 `context.applicationDate`를 `firstFilingDate`에 넣어 실제 **법원 최초 접수증** Fact/사건 판본/승인을 검증하지 못함. 이는 P1 통합 HOLD이며 승인된 별도 입력 계약 필요.
- 정적 계약 재파싱: `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 18모듈, 91입력 선언(고유78), 42출력 선언(고유40), 42 resultPaths. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5106 48, D5110 55, D5111 82. **정적 계약 검사**, 계산 실행/Word 생성 아님.

## 공식 확인 기준 및 미인증

- 서울회생법원 2026-10-01 제424호 제2조 ② 제7호 신설 공식 보도자료: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . 개정전문/부칙 PDF는 이번 실행에서 시간초과로 새로 재독하지 못함. 기존 회차의 2026-09-23 개정/10-01 시행·최초 접수 경과 메모와 별개.
- 국가법령정보센터 법 제611조·614조: **2026-10-02 시행, 법률 제21490호**. https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR / https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR . 변제기간과 법원 인가의 법률 요건은 코드 후보상태·산술계산과 별개.
- 국세청 공식 VAT: https://ems.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574 . 일반 6개월·간이 1년을 확인. VAT/종합소득 신고와 법원 인정 월순소득을 자동 동일시하지 않음.

## 중앙 보드 ID (모두 미완료 [ ])

- `A2-LAW-015`: 10-01 서울 제424호 / 10-02 시행법 판본 구분, 최초 접수증 증빙 미인증.
- `A2-LAW-016`: 7호 네 요건 원천 Fact IDs 공백·정규화 중복 후보 오승격 및 방어 후보 22건.
- `A2-LAW-019`: 관할 없음/공백은 unknown, **명시적으로 다른 관할**만 not_applicable.
- `A2-LAW-021`: 공식 보도자료/법제처/국세청 원문과 검증 범위·PDF 미확인 기록.
- `A2-LAW-023`: candidate와 변호사 승인·법원 인가 구별, 승인 없는 승격 금지.

**다음 역할 = 데이터담당자.** `context.applicationDate`와 실제 법원 최초 접수일 Fact의 typed/SQL 입력 경계 설계, ID 존재·사건 귀속·판본·서명/승인 계보 검증, #225→#226→#230 순서 의존/Node 실행. #43/#222/#223/#229 변제원장 null·0·blocked 서식 종단검증. 운영 배포·운영 DB migration·전자제출 없음. 제품 법률/계산 인수 **0건**.
