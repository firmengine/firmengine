# FirmEngine A2 r75 — IT담당자 / Fact ID 목록 정규성·SQL 계보 재조회 감사

- **일시/범위**: 2026-11-02 15:10 KST 시작, `firmengine/firmengine/main`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 A2만. r74 AX → 이번 r75 IT → **다음 r76 사용자·서류담당자**. 합성 데이터만 사용, 실제 고객/원본 OCR/개인정보/키/.env 없음.
- **시작 main HEAD** `332de1e65f0c7f857c7c94392c952941a2e1a0e9`. 쓰기 직전 확인 HEAD `332de1e65f0c7f857c7c94392c952941a2e1a0e9`. 최근 main 커밋 A1 r75 `332de1e...`, 이전 r74 A2 `03f63d6...`, r74 영수증 `de4ec20fe201fa594b67b6f5690c67e31906e59a` 읽음. 최신 A1/A4 PR과 Draft #175 등 비교, 타 축 수정 안 함.
- **소스·스키마 blob 재조회**: main `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`; Draft #175 `1a5193ba86919892d1d088c1e87e37b37e73a2fa`; main `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/preapproval-calculation-replay.ts` `9517e71ee238955ee4af679bce1ebced888c4432`, `lib/debt-source-integrity.ts` `40b7c227d3e73ae141a79a71a9165603ad321c24`, `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, `app/api/cases/[id]/approval-readiness/route.ts` `731f66a10d4af704b432dcd298061b452941fd13`, `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`, `tests/repayment-plan-model.test.ts` `b5ba94a3264a42fcbda6135f6c59f4fdfb0d9988`. r69 IT·r74 AX 영수증과 Draft #165/#173/#175 읽음.

## 1. 실제 실행: main vs Draft #175 기본 원장 V8

- **원본 GitHub 함수 본문** `buildRepaymentPlanModel()`의 default 분기만 TypeScript 타입 표기를 제거해 V8에서 호출. `addTrusteeFeeRows`와 `orderRows`는 월 보수 **0원** 및 정렬의 기능상 동등한 합성 대역으로 주입. **명시 일정 분기·실제 Node 앱 import는 테스트하지 않음.**
- 입력: 합성 사건 revision=8, 보통채권 A 원금 `100`원·이자 `20`원, 배분 원금 `50`원·이자 `10`원, planTotal `60`원, 36/48/60개월; Fact ID `SYN-FACT-A`. 변형은 null, 비문자, 공백, 빈 배열, 외부 ID, 중복 ID, 음수가 아닌 비정규 원화 `05`, 판본 과거 revision 7, 이자 미관찰, 원금 초과, 배분 총액 불일치, BigInt `9007199254740993`원 등 **17종 × 3기간 = 51건**.
- **관찰**: main 함수 51건 모두 `provisional`(메인 제품에는 이전 Draft 검증 미병합). Draft #175: **blocked 30 / provisional 21, 예외 throw 0**. 정규 ID의 36개월 배분합 원금 50 + 이자 10 = **60원**, 48/60개월도 정확히 동일 총액; 명시적 이자 0은 0으로 보존. 거액 정수 9007199254740993원도 문자열/BigInt로 총액 보존.
- 그러나 Draft #175는 `[" SYN-FACT-A"]`, `["SYN-FACT-A "]`, `["SYN-FACT-A","SYN-FACT-A"]`의 3종을 36/48/60개월 모두 `provisional`로 통과해 ledger `sourceIds`에 그대로 기록. 원천 Fact ID 정규화와 중복 제거에 불일치 가능. **빈 배열 및 존재하지 않는 문자열 ID도 provisional**이나 업무·법률상 보조 Fact의 허용성은 확정하지 않음.

### Draft #178의 작은 방어 수정(미병합)

- **[Draft PR #178](https://github.com/firmengine/firmengine/pull/178)**, #175를 base로 분리. HEAD `440a36a797bebe6a976bf3d0a185a26b8cde7c4a`. `lib/repayment-plan-model.ts`에서 `id!==id.trim()` 및 한 allocation 내 ID 중복을 기존 `DEFAULT_ALLOCATION_INVALID`로 fail-closed. 금액·배분 산식/기간/법률 인정·자동승인은 변경하지 않음.
- 실제 #175 함수본문과 수정 후보를 각각 V8 격리 실행: 36/48/60 × 9 조건 **27/27 독립 기대 일치**. 리딩/트레일링 공백·중복 **9조건**은 기존 provisional → 후보 blocked; canonical 1개·2개, null/numeric 차단, 빈/외부 문자열의 **미확정 provisional**은 유지. `sourceIds` 값과 합계를 재배분하지 않음.
- Node 회귀시험 `tests/a2-r75-it-canonical-factids.test.mjs` 15건 + TODO 3건 작성·커밋. **제품 Node 러너에서 미실행**, 전체 CI 미실행. PR은 Draft/미병합, 실제 생산자 ID 형식·법률 보조 Fact 정책 및 기존 스택 회귀 확인까지 merge 금지.
- 변경 파일 두 개가 모두 허용 경로 안에 있고, #175 기준 ahead 2/behind 0 확인.

## 2. 실제 실행: SQLite 0011 동형 인메모리 저장 7행

- **Node v22.16.0**, `node:sqlite` DatabaseSync. main migration `drizzle/0011_case_calculation_features.sql`의 runs/features/heads DDL을 동일 정의로 구성, `cases` 부모 합성 stub 추가. **실제 Cloudflare D1/staging이 아니라 로컬 SQLite**.
- 합성 `value_json/value_won/status/source_fact_ids_json` 7행 `INSERT OR IGNORE` / `SELECT` 실행, **7/7 문자열/NULL/상태 재독 일치**, `PRAGMA foreign_key_check=0`.
- 예시: `"0" / "0" / computed` vs `null / NULL / missing` 구분, `"00100" / NULL / blocked` 원문 보존, `["SYN-FOREIGN"]`·`[" SYN-FACT-A"]`·`["SYN-FACT-A","SYN-FACT-A"]`가 source_fact_ids_json에 원문 그대로 적재됨. 문자열 JSON 배열에 실제 Fact FK 제약 없음.
- 같은 feature PK에 원화 `2400000`→`9000000`, Fact A→B를 다시 넣자 `INSERT OR IGNORE changes=0`으로 기존 값 유지, 별도 head INSERT `changes=1`. **정상 deterministic run ID가 실제로 충돌한다는 증거는 아님.** 저장 정책 변경 금지.
- main `case-calculation-feature-store.ts`의 `factIds()`는 Set으로 중복을 제거하므로 기본 원장 `sourceIds`와 SQL 계보가 **가공정책상 달라질 수 있음**. 서로 다른 산출물의 source IDs 배열을 일대일 비교해서 법적 적합성 판단하지 않는다. 실제 생산자 expected Fact와 현행 accepted/index/철회 상태까지 연결하는 종단시험 필요.

## 3. 계산/서식 계약 (main 현행 blob 정적 재파싱)

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 모듈, 입력 91회/고유 78, 출력 42회/고유 40, 결과 경로 42회/고유 42**.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103/D5110/D5111 **37/55/82 토큰**.
- `public/templates/catalog.json` blob `9bae52fdf47fbc0935314bb5267503e4182080bd`: mapped **35/53/80**; 각 `review_status`, `revision` 두 토큰 미매핑; 3개 모두 `reviewer_pending`. **실제 91 입력 소비·18모듈 실행·42출력 SQL→DOCX 바이트 생성/재독은 미실행.**
- 독립 산술 확인: 관측 급여 `2,400,000×12=28,800,000`, 관측 사업순소득 `1,000,000×11=11,000,000`, 관측 단순 합계 **39,800,000원**. 미래 12월 **null/미관찰**(0원 아님). VAT 신고매출·전년도 종합소득세는 **source-only**이며 합산/법원 인정 자동확정 금지. `900,000×36/48/60=32,400,000/43,200,000/54,000,000`원은 명목 산술일 뿐 수행가능성·현재가치/청산가치 인가조건 검증 아님.

## 4. 공식 원문·관할·시행일 (자동 규칙 적용 금지)

- **서울회생법원 2026-10-01 공지**, 실무준칙 제424호 제2조 제2항 제7호 신설: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . **개정전문/부칙/경과조치와 개별 사건 적용일 미검증**, 공지일≠사건별 적용일, 타 법원 자동 확장 금지.
- **국가법령정보센터 [시행 2026-10-02, 법률 제21490호]** 제611조 https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 , 제614조 https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 3년 원칙/특별사정 5년 한도, 우선·재단채권 및 청산가치/공정성/수행가능성 인가 판단은 데이터/원장 형식 검증과 별개.
- **국세청** https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401 : 일반과세자 반기, 간이과세자 통상 연간 VAT 기간(유형전환·예정신고 예외). **VAT 매출 ≠ 인정 월순소득**.

## 5. 중앙 보드 ID / 다음 담당

| 보드 ID | 실제 관찰·증거 | 제품 인수 |
|---|---|---|
| **A2-IT-012** | Fact ID 공백/중복으로 원장 sourceIds 비정규·순서 중복 위험, V8 27/27 후보 기대 일치; 실제 SHA/order 전수 미검증 | **[ ] 부분** |
| **A2-IT-015** | SQL 0011 동형 Node SQLite 7/7, 0/null 구분, Fact FK 없고 충돌 무시 재현; staging D1↔typed 재계산 미실행 | **[ ] 부분** |
| **A2-IT-019** | ledger sourceIds vs SQL source_fact_ids_json의 계보 파생 경계와 외부/철회 Fact 미검증; 실제 OCR/source hash→Word hash 미관찰 | **[ ] 부분** |
| **A2-IT-020** | 타입 오류·공백·중복 ID fail-closed 후보 Draft #178, 신규 Node 15건 선언·미실행 | **[ ] 부분** |

**다음 r76 사용자·서류담당자**: Draft #178/#175/#173/#172/#168 스택 실제 Node 22 프로젝트 통합시험, 원천 Fact 소유·철회/보조 Fact 의미, `sourceIds`↔생산자 Fact↔저장 SQL, 승인 준비도 #165, D5110/D5111 서식 사전검증 #166의 미확정 표시 및 실제 DOCX 바이트/재독. 특히 합성 외부/중복 Fact 입력이 최종 서류 생성 전 차단되는지 확인하고 변호사/서류 실무자에게 적용기준을 인계한다.

**제품 최종 인수 완료 0건.** 주요 수정은 Draft PR #178만, main 제품 미변경. 전체 CI, staging D1/R2/Cron, 공식 법원서식 동등성, 법률/회계 실무자 인증, 사이트 배포·운영 D1 migration·전자제출·법원 인가 확정 **미실행**.
