# A2 r123 — IT담당자: D5103·D5110 금액형식 비정상 시 서식 예외/허위0 차단 Draft

- 기준: **2026-11-04 15:16 KST**, 조회 main HEAD `09ce521ade340cdf810a7e96978fe2b7ef47378e`, 이전 A2 r122(AX) 이후 IT담당자 회차. 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- 보드 체크: **A2-IT-004, A2-IT-013, A2-IT-016, A2-IT-020 — 전부 [ ] (부분 검증)**. 제품 인수·공식 서식 승인 0건.
- 이전 receipt: [r122](2026-11-04_r122_1412KST_ax-filing-source-proxy-status-origin.md). 최신 main/PR 목록 및 실제 함수·스키마·기존 영수증 먼저 읽음.
- 실제 코드 main `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`, #234 blob `216ea2f889d146b1762be65b097da2f896e826dc`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; SQL `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`. 읽기만 수행한 원천/typed/SQL 경로는 종단 실행 인증 아님.

## 결함·원인·독립 기대 / 실제
main `buildFormBindings`는 `monthlyIncomeWon`과 `recognizedLivingCostWon`이 단순 non-null이면 `BigInt(...)`로 D5110 세전/수수료 후 가용액을 계산. D5103 사업소득도 소득그룹 `monthlyObservedAverageWon`이 non-null이면 `BigInt(...)`로 합산. 그러나 원화 정수 문자열 여부를 실행 시 검사하지 않음.

정확히 실제 GitHub 함수 표현식에서 추출한 JavaScript를 **V8 격리 실행**하고 독립 기술 기대(비정상형=>숫자 미표시/검토보류)를 비교. 이때 TypeScript 타입표기/nonnull assertion만 실행용 제거; 본문 산술은 보존.

| 합성 입력 (전부 SYN, 원문 사용자 자료 없음) | 기대 | main 실제 | #234 실제 | 신규 #235 실제 |
|---|---|---|---|---|
| 월소득 `3000000`, 생계비 `1000000` | 2,000,000원(산술값) | 2,000,000 | 2,000,000 | 2,000,000 |
| 월소득 `1,20`, 생계비 `1000000` | 표시보류 | **SyntaxError** | **SyntaxError** | null→[확인 필요] |
| 월소득 `2000000`, 생계비 `BAD` | 표시보류 | **SyntaxError** | **SyntaxError** | null→[확인 필요] |
| 월소득 `0원`, 생계비 `0` | 표시보류 | **SyntaxError** | **SyntaxError** | null→[확인 필요] |
| 월소득 numeric 0 (문자열 아님), 생계비 `0` | 표시보류 | 허위 0 | 허위 0 | null |
| 사업그룹 `1,20`, 계산 월소득 `2000000` | [확인 필요] | **SyntaxError** | **SyntaxError** | [확인 필요] |
| 사업그룹 `0`, 계산 월소득 `BAD` | [확인 필요] | 허위 0 | 허위 0 | [확인 필요] |
| 급여만 있고 사업그룹 0개 | [확인 필요] | 허위 0 | [확인 필요] | [확인 필요] |
| 명시적 사업 `0` / 두 그룹 100만+200만원 | 0 / 300만원 | 동일 | 동일 | 동일 |
| 큰 정수 `9007199254740993`−`9007199254740992` | 정확히 1원 | 1 | 1 | 1 |

**같은 독립 테스트 18개(세전 9+사업 9): main 세전 5/9, 사업 3/9 = 8/18; #234 세전 5/9+사업 5/9=10/18; #235 세전 9/9+사업 9/9=18/18.** 수정안 브랜치 커밋 후 GitHub 본문을 다시 읽고 동일한 V8 표현식 재실행. 이는 Node 프로젝트 테스트 러너/전체 빌드/실제 계산기 호출 아님.

## 수정·브랜치·상태
- 미병합 기존 [Draft #234](https://github.com/firmengine/firmengine/pull/234)의 head `dac4a1a06b0d9770681ce2ede36bef9593b76bde`를 정확히 부모로 새로운 [Draft #235](https://github.com/firmengine/firmengine/pull/235) 생성. #234 병합/리베이스 선행 필요. main 제품 코드는 그대로.
- 수정 브랜치 `audit/a2-r123-it-form-money-invalid-hold-20261104`, commit `07dc75a7c846ae075102deb4b655861ff44cca6c`, 수정 `lib/form-mapping.ts` blob `3f65549f6387222e8e4d5bc228b2899f8b34d3b1`. 원화 정수 문자열일 때만 BigInt로 산술하고 null/비정상형은 기존 미확정 표시. **기존 0, 음수, BigInt 큰 정수의 연산 자체는 유지**. 법률상 수치 승인규칙 변경 없음.
- 합성 회귀시험 `tests/a2-r123-form-money-invalid-hold.test.ts` blob `d845ebf6274e54b0c26b2dec5b39458db015f732`에 18개 케이스 작성. **Node 프로젝트 러너에서 실행하지 못함; V8 실행만 18/18.**
- `case-calculation-feature-store.ts`는 `statusOf(value,engineStatus)`가 `"1,20"/computed`를 computed로 표시하면서 `won(name,value)`은 `valueWon=null`이 될 수 있는 구조. 또한 차단된 집계의 임시 `"0"`과 실제 관찰 0원을 `provisional/0`만으로 구별하기 어려움. **이번 수정 대상이 아니며 원천→Fact→typed→SQL E2E 결함 확정은 아님**. `drizzle/0011`의 value_json/value_won/status 컬럼은 재독했으나 실제 D1 SQL 조작하지 않음.
- D5103 business binding 및 D5110 pre-fee 관련 표현식 검증이며 D5106/D5111 및 실제 DOCX 출력 전체 검증이 아님.

## 기준정보/공식 원문
- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 정적 JSON 직접 파싱: 18 modules, 91 input 선언(78 고유), 42 output 선언(40 고유), 42 resultPaths.
- main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 직접 파싱: D5103=37, D5106=48, D5110=55, D5111=82 토큰. 토큰 개수는 실제 양식 치환 정확도 아님.
- 서울회생법원 **2026-10-01** [실무준칙 제424호 제7호 신설 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187) 직접 웹 확인. [r120](2026-11-04_r120_1212KST_law-424-appendix-source-only.md)은 부칙 2026-10-01 시행·시행 이후 최초 접수만 적용을 기록; **이번 회차 PDF 부칙 원문 직접 재독 없음**. 최초 접수 Fact/관할/승인 미확인→사건별 자동 규칙 적용 금지.
- 국가법령정보센터 [채무자회생법 제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) **2026-10-02 시행, 법률 제21490호** 원문 직접 웹 확인. 변제기간 및 청산가치 인가조건은 단순 금액 계산/문서 표시와 별개.
- 국세청 [부가가치세 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2355) 직접 확인: 일반 6개월, 간이 원칙적 1년. VAT·종소세 신고자료를 월순소득 확정값으로 자동 승인하지 않음.

## ID·다음 검증
- `A2-IT-004` [ ]: 미관찰/null/실제0·비정상형의 D5103/D5110 서식 표시, isolated 18조건; SQL 0원 계보 미완.
- `A2-IT-013` [ ]: `computed/NULL`, `provisional/0`, `blocked/NULL` 상태와 서식 소비 경계 미완.
- `A2-IT-016` [ ]: 서식 pre-fee·business 18조건, 다른 서식 토큰/실 DOCX 미완.
- `A2-IT-020` [ ]: TS 타입과 런타임 금액 문자열 상충 회귀 테스트 18개 작성/격리실행, 전체 Node/TS/CI 미완.
- 다음 회차 **사용자·서류담당자**: #234→#235 stacked PR 병합계획/실무자 서식 표현 검토, #229 ledger null 및 #233 OCR 원문/추출 단위 검증, 초기접수 Fact→법원 준칙 source lineage, 계산 18모듈·SQL→D5103/D5110/D5111 E2E 및 Node 테스트 실행. 원본 OCR/고객/키/운영마이그레이션/전자제출/법원인가 미사용·미실행.

**최종 인수 완료 0건.** 전체 CI, staging D1/R2/Cron, 법원 공식 서식 재독, 변호사·실무자 승인, 사이트 배포 모두 미인증.
