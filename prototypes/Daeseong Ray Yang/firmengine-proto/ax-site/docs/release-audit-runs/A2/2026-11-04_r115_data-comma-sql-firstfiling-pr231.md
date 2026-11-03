# A2 r115 — 데이터담당자 / 금액 쉼표, SQL 상태, 최초접수 근거

- 날짜 2026-11-04 KST. 역할: r114 변호사 → r115 데이터담당자 → r116 AX담당자. 허용 경로: prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/ 내부.
- 시작 main HEAD bc72b1a773527a88dbc9a7591ad4edad4a17e2d6; 영수증 저장 직전 main HEAD bc72b1a773527a88dbc9a7591ad4edad4a17e2d6. 최근 main A1/A3 r114 커밋, A2 r114 보드 기록 재독. 중앙 보드 최초 blob 3716c61c9e067722f30d44f1606d9c8b8d44b2ca. 이전 r97/r109/r114 A2 영수증과 PR #225/#226/#230/#229 재독.
- 실제 GitHub 코드/스키마 blob: domain.ts 39ab41856f6d7a379aca7217d24b28f7f5f7616a; legal-proposals.ts abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c; seoul424-candidate.ts fb4f7f09e37e957481996304fbe4916764c8d7da (PR #230 92f1bc09d35062da1bb3328fcb3a930050dcfb96); case-calculation-feature-store.ts bb5f88b26e68f5ae2234741063ac9301a927e27a; drizzle/0011_case_calculation_features.sql 0caa359d250dce45765d269d271ad63170ec3efa; db/schema.ts 933f8686845ac14669312dd21bf85e02c62ed5e6; tests/legal-proposals.test.ts. 모든 입력 SYN-* 합성자료. 고객/개인정보/키/.env/원본 OCR/비공개 정답은 Git 비저장.

## A2-DATA-003: 잘못된 쉼표가 원화 확정액으로 오인되는 결함
main domain.ts normalizeMoney 원본문의 무조건적인 replace(/,/g, "")에서 구문 오류 5건 재현. 실제 함수에서 TypeScript 타입만 제거, V8 new Function(ONE=1n, ZERO=0n) 격리 호출 18회. 기술적 독립 기대: main 13/18, Draft #231 후보 18/18. 수정된 브랜치 함수 blob 8af6c5d87a207100ed13ee76ea369cd662c384b3를 GitHub 재조회하여 18/18 재실행.

| 합성 OCR raw/단위 | 독립 기대 | main 실제 | Draft #231 실제 |
|---|---|---|---|
| 1,20원 / KRW | invalid/null | exact 120 | invalid/null |
| 1,,2원 / KRW | invalid/null | exact 12 | invalid/null |
| 1,23,456 / KRW | invalid/null | exact 123456 | invalid/null |
| 1,2345 / KRW | invalid/null | exact 12345 | invalid/null |
| 1,234,56 / KRW | invalid/null | exact 123456 | invalid/null |
| 1,234원 / KRW | exact 1234 | exact 1234 | exact 1234 |
| 1,234.5 / 만원 | exact 12345000 | exact 12345000 | exact 12345000 |
| 0 / KRW | exact 0 | exact 0 | exact 0 |
| null / KRW | missing/null | missing | missing |

나머지는 +1,234/-1,234, 1,234,567, 1234, 1e3, 1,000.00, 12,345.0001만원, 1,234.5원, 비인식 단위 포함. rawValue 원문 보존, 승인소득·VAT·채권가액은 확정하지 않음.

- 변경: [Draft PR #231](https://github.com/firmengine/firmengine/pull/231), 부모 main, 허용 경로 내 2파일만 변경. lib/domain.ts에서 정규 천단위 그룹 이외 쉼표 입력은 invalid, tests/a2-r115-money-group-normalization.test.ts 18개 합성 Node 검증 선언. 실제 Node runner/CI는 **미실행**. 공유 파서이므로 병합 전 급여/사업·VAT/종소세·채권/재산 전반의 타입/입력 호환성 검증 및 사람 승인 필요. 제품 변경은 main 미병합.

## A2-DATA-020: 0 / null / blocked / provisional 의미 경계

main case-calculation-feature-store.ts의 statusOf+won **실제 함수본문**을 V8 격리 실행: 보수적 독립 기대 8/9 일치. 핵심: engineStatus=blocked, value="0" (상위 임시 placeholder라고 가정)은 기대 blocked/missing/conflict, 실제 provisional+valueWon="0". blocked + null은 blocked/null, calculated + 실제 관찰 0은 computed/"0", calculated+null은 missing, conflict+0은 conflict이며 각각 기대 일치. 함수 주석은 차단된 집계의 **관찰된 개별 기여액**을 provisional로 보존할 수 있게 설계. 그러므로 단독 결과를 확정 결함이라고 단정하지 않는다. 상위 임시 0원과 실제 관찰 0원 구분 계약 미인증; #43/#223/#229 소비처 통합 P1 HOLD. won("amountWon","00")="00", won("amountWon","-0")="-0"도 관찰했으나 정규형 보완 Draft #160이 존재하며 main 통합 미완.

## A2-DATA-024: 0011 동형 SQLite 합성 insert→readback

Github 0011 migration에서 직접 확인한 3개 SQL 테이블(runs/features/heads)과 열 이름, 타입, FK, 인덱스를 인메모리 SQLite로 재현. cases(id)=SYN-CASE-A, run=SYN-RUN-A, feature 13개 열 정확 사용. **합성 feature 9행 삽입·재조회 9/9, 미존재 run FK 1건 거부, foreign_key_check 0**. 저장이 성공한 행: 정상 관측 0원, value_json=null/value_won="0"의 상충, value_json=null/status=computed의 허위 상태, 타사건 모양 Fact ID, 배열이 아닌 문자열 Fact IDs, 미등록 approved 상태, value_won="0010", 동일 outputPath 중복, 2027-06 미래월 경로. 이는 SQLite가 의미상 오류를 허용한다는 실측이지 제품의 실제 쓰기 경로가 그 값을 저장했다는 증거가 아님. staging/운영 D1 **미실행**. 실제 source/raw→Fact→typed→SQL→42 output→Word 종단검증 미실행.

## A2-DATA-015: 법원 최초 접수일 Fact 미연결
main createCase는 applicationDate=asOf, courtId=seoul 기본값. legal-proposals.ts는 applicationDate를 evaluateSeoul424().firstFilingDate로 전달하고 평가 결과 court_scope/effective_date factIds는 []. PR #230의 관할/Fact ID 형식검사는 실제 법원 최초접수증의 사건귀속/판본/검토자 확인까지 하지 않는다. 현재 코드 재독+기존 r109 데이터 격리 결과 재확인이고 실제 접수일 상충 사건은 관찰하지 않음. 새로운 임의 Fact 키/무승인 법률규칙을 넣지 않고 인간 검토 필요.

## 기준정보/서식/독립 검산
- main reference-decision-tables.json 실제 파싱: 18 계산모듈, 91 입력 선언(고유78), 42 출력 선언(고유40), 42 resultPaths. blob 6924e3977caf748ce8a3d617fae15aff7d2fe2ce.
- main template-token-catalog.json 실제 파싱: D5103 37, D5106 48, D5110 55, D5111 82. blob 899c4d564fcb1726861f89dcf04dbf1b7e372687. 실제 DOCX 생성/재독 또는 전수 데이터 대조는 아님.
- 독립 산술 900,000원/월 × 36·48·60개월 = 32,400,000 / 43,200,000 / 54,000,000원. 원금배분·PV·법적 기간 인증 아님.

## 공식 원문/시행일
- 서울회생법원 2026-10-01 공식 보도자료: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 ; 제424호 제2조② 제7호 신설을 이번 직접 확인. PDF https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2 이번 직접 재조회는 시간초과. 과거 r97/r108은 2026-09-23 개정·2026-10-01 시행·시행 후 최초접수를 확인했으나 이번 회차 직접 부칙 인증은 아님.
- 국가법령정보센터 제611조 https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR ; 제614조 https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR . 2026-10-02 시행 법률 제21490호 타법개정 판본 직접 확인. 법원 인가/청산가치 요건은 기술적 합계와 구분.
- 국세청 VAT 공식 https://ems.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574 일반과세자 6개월, 간이과세자 원칙적 1년 과세기간 확인. VAT/종합소득세 신고를 승인된 월순소득으로 자동 전환하지 않음.

## 보드/다음
A2-DATA-003, A2-DATA-015, A2-DATA-020, A2-DATA-024 **모두 [ ] 부분**. 다음 r116 AX: Draft #231의 프로젝트 Node/전체 산식 회귀 및 기존 파서 관련 PR 충돌, #225→#226→#230 최초접수 Fact·사건 귀속·승인, #43/#223/#229 임시 0원 계약→SQL/서식, 18/91/42 실제 경로와 D5103/06/10/11 재독. **제품 최종 인수 0건**. 전체 CI·staging D1/R2/Cron·Word 바이트/법원서식 동등성·실무자/변호사 승인 미관찰. 운영배포·D1운영 migration·전자제출·법원인가 확정 수행 안함.
