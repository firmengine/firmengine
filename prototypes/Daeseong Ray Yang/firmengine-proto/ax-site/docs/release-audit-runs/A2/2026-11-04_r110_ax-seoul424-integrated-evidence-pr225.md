# FirmEngine A2 r110 — AX 담당자 / 서울 제424호 증빙 게이트 통합

- 감사일: 2026-11-04 KST. 역할순환: r109 데이터담당자 → **r110 AX담당자** → r111 IT담당자.
- 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이내의 코드·테스트·보드·본 영수증만.
- 시작 main HEAD: `d7f340241231797bf6ff3d90fc3349e404d6c573` (A1 r109 문서변경). 원본 evaluator blob `fb4f7f09e37e957481996304fbe4916764c8d7da`, #224 evaluator blob `8a3c7cb5127a095fa9cbf48f5eef6ef72c532f33`; 법률호출자 `legal-proposals.ts` blob `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`.
- 최근 본 A2 영수증 [r109](2026-11-04_r109_0115KST_data-filing-proof-sql-state.md), 기존 미병합 Draft [#18](https://github.com/firmengine/firmengine/pull/18) / [#217](https://github.com/firmengine/firmengine/pull/217) / [#224](https://github.com/firmengine/firmengine/pull/224) 실제 patch/원본문 확인. 제품 코드 **main 미수정**.
- 고위험·법률 인식 변경 가능성을 고려해 최신 main에서 별도 브랜치 `audit/a2-r110-integrated-seoul424-20261104` 생성, **[Draft PR #225](https://github.com/firmengine/firmengine/pull/225)**로 통합 후보 제시(2파일만 수정: evaluator + 신규 합성 회귀시험).

## 1. 독립 검증의 정확한 수준

원본 main 및 통합 Draft의 실제 GitHub `evaluateSeoul424`/wage/evidence 함수 본문에서 TypeScript 타입 구문만 제거한 다음 V8 `new Function` 격리 실행. 서울·시행일·2년·1년·5천만원 등의 참조함수는 **합성 stub**으로 고정. 가상 `SYN-*` ID만 사용. **동일 22개 합성 입력·독립 상태/경로/법원인가표시 기대값 대조: main 9/22, Draft #225 22/22.** 이는 독립 기술 기대치 일치 수이지 Node 프로젝트/CI/실사건/법률 인정 합격수가 아니다.

| 합성 입력 또는 변경점 | 독립 기술 기대 | main 실제 | Draft #225 격리 실제 |
|---|---|---|---|
| 정합 제7호 4요건·정상 Fact IDs·서울·2026-10-03 | category_7 사람검토 후보 | 일치 | 일치 |
| 제1~6호 valid yes, evidence 있음 | category_1_to_6 사람검토 후보 | 일치 | 일치 |
| 관할 null + 제7호 yes | unknown | **category_7 후보** | unknown |
| 관할 null + 제1~6호 yes | unknown | **category_1_to_6 후보** | unknown |
| 제1~6호 yes이지만 Fact ID 없음, 제7호 yes | category_7만 후보 | **category_1_to_6 후보** | category_7 후보 |
| 제1~6호 Fact ID 없음/공백, 제7호 미관찰 | unknown | **category_1_to_6 후보** | unknown |
| 급여 Fact ID 공백·중복 | unknown | **category_7 후보** | unknown |
| 급여 value=null 또는 최저임금 판본=null | unknown, 예외 없음 | **TypeError** | unknown |
| 총채무 불리언 대신 문자열 `"false"` | unknown | **category_7 후보 (truthy)** | unknown |
| 개인채권자 조건 value=null | unknown | **not_candidate** | unknown |
| 총채무 Fact ID 공백 / 최근채무 ID 중복 | unknown | **category_7 후보** | unknown |
| 개인채권자 명시 false | not_candidate_on_known_facts | 일치 | 일치 |
| 2026-09-30 | unsupported_version | 일치 | 일치 |
| 2026-10-01 | category_7 사람검토 후보 (가상증빙 한정) | 일치 | 일치 |
| 최초 접수일 null / 날짜 오류 `2026-02-30` | unknown | 일치 | 일치 |
| 부산 법원 | not_applicable | 일치 | 일치 |
| 제1~6호 valid yes와 제7호 조건 null | category_1_to_6 사람검토 후보 | 일치 | 일치 |

각 격리 실행 결과 `courtApprovalInferred=false`를 검증. 날짜 `2026-10-03`도 **신청일이 최초 접수일임을 입증하지 못한 가상 입력**임을 명시; 사람검토 후보는 적용확정이 아님. 계보·기준판본·원천실존/귀속/승인인자를 증명한 사례는 0건.

## 2. 수정내용·회귀시험·병합 위험

- #18 관할 null 게이트와 #217 제1~6호 양성 근거 Fact ID 게이트, #224 제7호 네 요건의 빈/공백/중복/비배열 Fact IDs 게이트를 **한 평가기**에 합성. 한 경로 미확인은 다른 독립 경로의 충분한 가상요건을 부당 차단하지 않도록 별도 취급.
- 추가 AX 방어: 제7호 불리언이 null/string이면 `unknown` (JS `Boolean("false")` 오승격 차단), 급여 value/minimumWageVersion 자료형이 깨지면 TypeError 대신 `unknown`.
- 회귀 소스 `tests/a2-r110-seoul424-candidate-integration.test.ts` 22개 시나리오를 커밋. **Node 프로젝트 러너로는 미실행**, 전체 CI도 미실행. V8 격리 22/22와 구별.
- 제품 병합 보류: 실제 `buildLegalProposals`의 `context.applicationDate → firstFilingDate` 연결에는 최초접수증 Fact/관할검증·사건 owner/revision/승인자 계약이 없다. `sourceValidated`, `legallyRecognized` 및 형식 맞는 Fact ID만으로 실제 인정/변호사승인 증명 안 됨. #18/#217/#224/#225를 동시 병합하지 말고 법률·데이터 담당자와 누적 의도 및 기준정보 판본 검토 후 합본 선택.
- [#43](https://github.com/firmengine/firmengine/pull/43)·[#203](https://github.com/firmengine/firmengine/pull/203)·[#222](https://github.com/firmengine/firmengine/pull/222)·[#223](https://github.com/firmengine/firmengine/pull/223) 원장 차단값 0/null·정상 0원 분리와 계산→SQL→서식 종단 검증은 별도 미완료.

## 3. 계산·서식 정적 계약 및 독립 산술

GitHub main 두 JSON 직접 파싱: `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 계산모듈, 입력 선언 91(고유 78), 출력 선언 42(고유 40), 결과 저장경로 42(고유42)**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5106 48 / D5110 55 / D5111 82 토큰**. 이는 정적 JSON 계약 검증이며 개별 토큰 수치, SQL 저장 및 실제 Word 파일 출력 재독 완료와 동의어가 아님.

독립 산술 제어값(법원 승인/법적 현재가치와 무관): 매월 900,000원 × 36/48/60개월 = **32,400,000/43,200,000/54,000,000원**. 이번 회차에서 18모듈 실제 실행/42 output SQL 재조회/최종 법원서식 숫자 추출은 하지 못했음.

## 4. 공식 법원·법령·국세청 기준 재조회

- [서울회생법원 2026-10-01 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): **실무준칙 제424호 제2조 제2항 제7호 신설** 재확인. [제424호 실무준칙 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2)는 이번 r110 웹 열람 타임아웃. r108에서 기록한 **2026-09-23 개정/2026-10-01 시행/시행 뒤 최초접수 사건 적용**과 분리하여 재검증 주장하지 않음.
- 법제처 국가법령정보센터 [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR)와 [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): **[시행 2026-10-02] 법률 제21490호**, 제611조 3년 원칙/법정 특별사정 5년·우선권 변제계획, 제614조 수행가능성/청산가치/인가요건 원문 대조. `candidate_for_human_review`를 인가로 승격하지 않음.
- [국세청 부가가치세 공식 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2355): 일반과세자 6개월, 간이과세자 1년 과세기간 안내. VAT 신고매출·종소세 신고소득·법원 월별 인정소득은 서로 자동 동일시하지 않음. 2026년도 구체적 세법/사건 적용은 세무담당자 미인증.

## 5. 체크 ID 및 후속 실행

- **A2-AX-004 [ ]**: null/0/unknown/허위 boolean 필드 분리: 22개 후보 격리 확인 중 null/string 위험 해결 제안. 원천 typed→SQL→서식 미인증.
- **A2-AX-006 [ ]**: 서울 2026-10-01 공식 보도, 법 제611/614 2026-10-02 시행판, 국세청 안내 직접 확인. PDF 부칙 이번 회차 재열람 실패·실사건 적용 미인증.
- **A2-AX-017 [ ]**: 후보·승인/인가 독립, courtApprovalInferred=false 22/22, 최초접수 Fact 부재 확인. 승인 E2E 미실행.
- **A2-AX-018 [ ]**: main blob/수정 blob/22 합성 예상-관찰/모델 종류/미인증 단계를 판본별 기록. 통합 full CI·42출력 E2E 미완료.

**제품 final accepted 0건.** 전체 CI/Node 러너, staging D1·R2/Cron, DOCX 바이트 생성·토큰 수치 재독, 법원 공식서식 완전동등성, 변호사·계산사무장 승인 전부 미인증. 운영 배포/운영 D1 마이그레이션/전자제출/법원 인가 확정 **미수행**.

**다음 r111 IT담당자**: #225와 원본 #18/#217/#224의 변경 중복·파일/blob 판본 회귀 및 Node 러너·CI 수행 가능 경계 검토, 최초접수일·관할 fact contract의 검증된 입력→typed→case revision 연결, blocked 원장 값을 SQL/서식에서 실제 0원과 구분하는 격리 및 실환경 테스트.