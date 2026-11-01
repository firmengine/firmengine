# FirmEngine A2 r62 — AX담당자: 원화 피처 직렬화·Fact 계보·법률 승인 경계

- 기준일: 2026-11-02 KST. **r61 데이터담당자 → r62 AX담당자 → r63 IT담당자** 순환.
- 작업범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 시작 main `5518b89dd085b4713c8c8c8ab308604fc98de8a5`; r61 기록과 main 최근 커밋/PR을 확인.
- 중앙 보드 검토 ID: **A2-AX-004, A2-AX-015, A2-AX-017, A2-AX-018**. 모두 **[ ] 부분검증**. 최종 인수 0건.
- main 실제 소스 blob: `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`. 미병합 [Draft #148](https://github.com/firmengine/firmengine/pull/148)의 같은 파일 blob `eec10fb49653ced2928ae3ea9455c246339c7073`. 스키마 `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`.
- 시험 커밋: `5d52c85bcd8c3cb573d660a08c7582f1f0ba9737`. [Draft PR #151](https://github.com/firmengine/firmengine/pull/151)은 #148 위에 쌓은 **테스트 전용 Draft**; 변경 파일은 `tests/a2-r62-ax-feature-row-serialization.test.ts` 단 1개. main 제품 코드 변경 없음.

## 1. 실제 생산 피처 직렬화의 합성·독립기대·관찰

GitHub #148의 `statusOf`, `won`, `classifyStoredFeatureMoney`, `calculationFeatureRows` **실제 TS 함수 본문을 가져와 타입 표기만 제거하고 V8에서 호출**. `getCalculationSpecs`에는 main의 실제 `reference-decision-tables.json` 계산 카탈로그를 전달. 가상 CaseExecution: `SYN` 1사건, `income_group:SYN` 계산 trace, Fact `SYN-F1/F2`, 합성 급여행 `SYN-W1/W2`, 승인여부 false. 원문 OCR/실제 고객 자료는 전혀 사용하지 않음.

| 합성 입력/상황 | 독립 기대 | 실제 관찰 |
|---|---|---|
| 월금액 `"2400000"` | computed / Won=2400000 | 일치 |
| 월금액 `"0"` | computed / Won=0 | 일치 |
| 월금액 `null` | missing / Won=NULL | 일치 |
| 월금액 `"unknown"` | missing / Won=NULL | 일치 |
| `"9,00"`, `"1 000"`, `"[미관찰]"` | blocked / Won=NULL / 형식오류 | 3건 일치 |
| JS 안전정수 초과 숫자 `9007199254740992` | blocked / Won=NULL | 일치 |
| 같은 수치의 정수 **문자열** `"9007199254740992"` | 계산 결과의 임의 자리수 손실 없음 | computed / 문자열 보존 |
| `courtApprovalInferred=false` | not_applicable, 승인 추정 금지 | 일치 |
| `incomeRows.netIncomeWon` W1 `"9,00"` | blocked | 일치 |
| W2 `"0"` | computed / Won=0 | 일치 |
| W1 행에 연결된 `SYN-F1` | 원천 Fact ID 보존 | `["SYN-F1"]` |
| `traces.resultWon` W1 `"9,00"` | blocked | 일치 |
| `proposals.livingCost.amountWon` `"9,00"` | blocked | 일치 |
| `proposals.termCandidate.termMonths=36` | Won 금액과 혼동하지 않음 | computed (월수, 법률 승인 아님) |

**원본문 격리 V8 16/16 독립기대 일치.** #148 원화 검증은 **계산금액이나 법률상 인정소득을 결정하지 않음**. 이 V8 시험은 실제 `persistCaseCalculationFeatures()`/D1/Word의 종단검증이 아님.

추가 작성한 [#151의 Node 회귀시험 소스](https://github.com/firmengine/firmengine/pull/151) 3그룹은 synthetic CaseExecution을 실제 `calculationFeatureRows`에 공급해 값/상태/원천 Fact/서식 제안값의 불승격을 단언함. **프로젝트 Node 러너/전체 CI에서는 실행하지 않았으므로 통과 표시 불가**. #151의 PR HEAD status checks 0건, workflow runs 0건 조회.

## 2. 실제 0011 스키마와 합성 SQLite 재독

`0011`의 계산 run/feature/head 열·외래키·인덱스에 맞춘 인메모리 Python SQLite DDL(사건 테이블만 FK stub)에서 **4종 합성 피처**를 `INSERT OR IGNORE` → `SELECT`로 재독: `"0"/"0"/computed`, `null/NULL/missing`, `"9,00"/NULL/blocked`, 16자리 이상 정수 문자열. **4/4 값·status·Fact 계보 일치, 외래키 위반 0**. SQL 행이 올바르게 저장된다는 사실은 분류기가 실행된다는 증거가 아님.

별도 같은 feature ID의 이질 금액 재삽입은 `OR IGNORE`로 무시되고 기존 차단행 유지. r61의 **조건부 idempotency 충돌 은폐** 위험이 남음. 정상 동일 run에서 발생한 실결함은 미입증이므로 DB 원자성/계산 의미 변경을 자동 병합하지 않음. 향후 IT 담당자에게 별도 read-before-write/CAS/사전오염 검출·실제 D1 격리시험 필요.

## 3. 카탈로그·독립 산술과 공식 법률/세무 기준

- 실제 main 카탈로그 JSON 재파싱: **18 계산모듈, 91 입력 선언(고유78), 42 출력 선언 및 42 결과경로**. D5103/D5110/D5111 등록 토큰 각각 **37/55/82개**. 출력/SQL/Word E2E 검증 아님.
- 별도 독립 산술 기준: 2026년 가상 급여 월 2,400,000원 × 12 = 28,800,000원, 가상 사업 순소득 월 1,000,000원 × **관측 11개월** = 11,000,000원, 관측합계 39,800,000원. 사업 12월은 **미관찰**, 0원 대입 불가. 가상 VAT 상반기 매출 60,000,000원·전년도 종합소득세 신고액 20,000,000원은 **source-only**이며 추가 월수입으로 중복 합산 금지. 900,000원×36/48/60개월은 각각 32,400,000/43,200,000/54,000,000원(기간의 법률 적합성 별도). 청산가치 32,000,000원 vs 변제액 현재가치 30,000,000원은 2,000,000원 차이(인가 의미 없음).
- **국가법령정보센터** 채무자회생법 **[시행 2026-10-02, 법률 제21490호]** [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777) 3년 원칙/특별사정 5년 범위; [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) 법원 변제계획 인가요건. 산술 계산과 법률 판단은 분리.
- **서울회생법원** [2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 제424호 제2조 제2항 제7호 신설 사실 확인. **PDF 개정전문 부칙·경과조치·사건별 적용일은 이번에도 미인증**. 공지일만으로 승인 없는 자동규칙 적용 금지.
- **국세청** [부가가치세 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세 통상 반기, 간이과세 통상 연 과세기간. VAT 매출/종합소득세 신고액을 법원 인정 월소득으로 자동 승격하지 않음.

## 4. 남은 항목과 다음 회차

| ID | 이번 검증 | 현재 |
|---|---|---|
| A2-AX-004 | 0/null/unknown/비정상 Won·승인전 분리; 16/16 격리 | **[ ] 부분** |
| A2-AX-015 | 실제 원본문 serializer+main 계산 카탈로그 독립 대조, SQLite 4/4 | **[ ] 부분** |
| A2-AX-017 | computed/blocked ≠ 법률 인정·법원 인가, false/NA 유지 | **[ ] 부분** |
| A2-AX-018 | sha·입력·기대·관찰·미검증 수단·Draft 상태 기록 | **[ ] 부분** |

**다음 r63 IT담당자:** #148 → #151을 프로젝트 Node 러너에서 실행; #71→#135→#136→#138 Fact 계보와 SQL replay, #130/#141 서식, #133 변제배분, #144/#145 변제기간 숫자 파서 통합 영향 점검. 실제 D1 거래 실패/재시도·동일 run ID 상충 감지·42개 결과/3서식 DOCX 재독 및 6역할 최종 서명은 아직 미실행. 운영 배포/운영 D1 마이그레이션/실제 제출/인가 확정·개인정보/키 공개 Git 적재 **없음**.
