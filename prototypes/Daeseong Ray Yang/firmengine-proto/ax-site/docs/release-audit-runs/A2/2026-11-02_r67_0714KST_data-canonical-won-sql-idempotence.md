# FirmEngine A2 r67 — 데이터담당자: 원화 저장 정규형·Fact 계보·SQL 재저장 검증

- 시작 시각: **2026-11-02 약 07:14 KST**. 역할 순서: r66 변호사 → **r67 데이터담당자** → r68 AX담당자.
- 대상: 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`; 다른 경로·제품 main 변경 없음. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 실행 없음.
- 첫 main HEAD: `bb5c5f86d824a05f0c23eff9171445f0366cf8a4` (A1 r67 문서 커밋). 최신 재조회/영수증 작성 직전 main: `bb5c5f86d824a05f0c23eff9171445f0366cf8a4`, 보드 blob: `42e99ee916090be235bceac0861da74b64a0c2c0`.
- 확인 자료: r66 영수증 `docs/release-audit-runs/A2/2026-11-02_r66_0614KST_law-stale-term-approval-boundaries.md`; r61/r63 데이터·IT 영수증; 열린 PR #138/#148/#151/#153/#157 및 #159의 변경경로, `tests/case-calculation-feature-store.test.ts`; 실제 main `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/preapproval-calculation-replay.ts` blob `9517e71ee238955ee4af679bce1ebced888c4432`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`.
- 중앙보드 A2 선택 ID: **A2-DATA-003, A2-DATA-017, A2-DATA-020, A2-DATA-024**. 네 ID 모두 **[ ] 부분** 유지, 전수 인수 통과 0건. 기밀·실제 OCR·고객 데이터·.env·키 미사용.

## 1. A2-DATA-003/017/020 — 실제 직렬화 소스의 원화 정규형 경계

`calculationFeatureRows`, `statusOf`, `factIds`, `won`, #148 `classifyStoredFeatureMoney`의 실제 GitHub 함수 본문에서 TypeScript 타입 표기만 제거해 V8 격리 실행. `getCalculationSpecs`는 테스트용 한 개 가상 소득모듈로 교체; 실제 계산엔진을 실행한 것은 아님. 가상 trace `income_group:SYN`, Fact `SYN-F1`을 사용.

| 합성 engine 원화 입력 | 독립 기대 (저장 상태/원화 열) | main 관찰 | 기존 Draft #148 관찰 | Draft #160 패치 관찰 |
|---|---|---|---|---|
| `"2400000"` | computed/`2400000` | 기대와 같음 | 같음 | 같음 |
| `"0"` | computed/`0` | 같음 | 같음 | 같음 |
| `null`, `"unknown"` | missing/NULL | 같음 | 같음 | 같음 |
| `"9,00"` | blocked/NULL | **computed/NULL** | blocked/NULL | blocked/NULL |
| `"00"`, `"-0"`, `"-00"` | **blocked/NULL** | **computed/원문** | **computed/원문** | blocked/NULL |
| `"00100"`, `"-01"` | **blocked/NULL** | **computed/원문** | **computed/원문** | blocked/NULL |
| `"-100"` / `"-1"` | 원화 형식 유효 (법률 정당성 별도) | 같음 | 같음 | 같음 |
| 큰 정수 **문자열** `"9007199254740992"` | 정밀도 손실 없이 문자열 computed | 같음 | 같음 | 같음 |
| 안전정수 초과 **숫자** / boolean false | blocked/NULL | computed/NULL | blocked/NULL | blocked/NULL |
| 원문 역할 상충 + 0원 | conflict/`0` | 같음 | 같음 | 같음 |

기존 #148은 불량 쉼표를 차단하나 `"00"` 등 비정규 원화 문자열 다섯 개를 계산완료로 저장. 원화 구문 규약의 단일 정규형 `^(?:0|-?[1-9]\\d*)$`만 허용하는 작은 개선을 **[Draft PR #160](https://github.com/firmengine/firmengine/pull/160)**으로 작성. #148을 base로 하는 stacked Draft, **main 미병합**. 원문 `value` 및 Fact ID는 수정하지 않고 원화 `value_won=NULL`·`INVALID_MONETARY_FEATURE_VALUE`·`blocked`로 검토 대기. `null`, 명시적 0, 비해당, 상충은 분리.

- 실제 함수소스 #148 이전/후와 #160 예정 패치의 **V8 합성 17/17 독립 기대 일치**, 기존 #148은 그중 **5건** 비정규 값 허위 computed. 별도 급여행·trace 전파 5개 행에서 Fact `SYN-F1/SYN-F2`, 0과 blocked가 유지됨을 관찰.
- 신규 `tests/a2-r67-data-canonical-won-storage.test.ts`의 **3 Node 테스트 그룹 작성·GitHub 커밋**, **프로젝트 Node 테스트 러너/CI에서 미실행**. GitHub에 저장된 코드만으로 프로젝트 합격이라고 표기하지 않는다.
- #148 원화 상태 변경, #151 행 직렬화, #138 Fact 생산자 계보와 충돌·회귀가 없는지 실제 Node/CI 추가 검증 필요. 본 회차 원문 OCR→Fact→typed→계산 엔진 전부 실행하지 않음.

## 2. A2-DATA-024/017 — SQL 0011 저장/재조회·동일 ID 충돌

`drizzle/0011_case_calculation_features.sql`의 runs/features/heads **동일 CREATE TABLE·INDEX DDL**과 `cases`/watch 부모 최소 합성 stub을 SQLite 3.46.1 인메모리에 구성. 실제 저장기의 `INSERT OR IGNORE` feature 열, 동일 조건의 head `INSERT ... SELECT ... ON CONFLICT`를 이용. 사건 `SYN-C`, revision 1, dataVersion 4; **실제 제품 D1 요청/트랜잭션 실행이 아니다**.

| 합성 Feature (원문/Fact/typed/SQL) | 독립 기대 | 관찰 SQL 재조회 |
|---|---|---|
| SYN-WAGE 월급여 2,400,000원 / SYN-F-WAGE | `"2400000"`/computed 보존 | 일치 |
| SYN-BIZ 관측 11개월 순소득 1,000,000원 / SYN-F-BIZ11 | 정수원·Fact ID 보존 | 일치 |
| SYN-FUTURE 12월 미관찰 | JSON null/SQL NULL/missing, 0 금지 | 일치 |
| SYN-VAT 연매출 60,000,000원 | 별도 세무 source-only, 순소득 추가 금지 | 독립 가상 `input_refs_json.taxRole=source_only`, SQL 원화 NULL |
| SYN-TAX 과거 종소세 20,000,000원 | 별도 세무 source-only, 순소득 추가 금지 | 독립 가상 메타보존, SQL 원화 NULL |
| SYN-ZERO 이자 0원 | JSON `"0"` + SQL `"0"` 유지 | 일치 |
| SYN-MALFORMED `"00100"` | raw 보존/blocked/SQL NULL | 일치 |

**7/7 인메모리 저장·재조회, 외래키 위반 0.** source-only 메타는 **합성 설계가 넣은 역할**이며 실제 제품 자동분류 결과가 아니다. 원문·Fact·typed는 합성 대응표; 실제 OCR/Fact 변환 경로를 실행한 것이 아니다.

현재 SQL은 동일 feature ID에 2,400,000원이 존재할 때 9,000,000원 재시도를 **IGNORE(changes=0)**하고, 그 뒤 head UPDATE는 **changes=1**. 이전 r61/r63의 **조건부 무결성 결함 후보 재현**. 정확한 같은 해시 run이 정상 생산자에서 이종 금액으로 발생했다고 입증하지 않음; 쓰기 정책 변경은 별도 고위험 PR/실제 D1 동시성 검증 전 보류. #153 테스트 및 #138 read-side 검증과 결합해야 한다.

## 3. 계산·서식 등록 계약 및 독립 산술

`lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 실제 JSON 파싱: **18 계산모듈, 91 입력 선언(고유 78), 42 출력 선언(고유 40), 42 결과경로(고유 42), 미등록 의존성 0**.
`lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5110 55 / D5111 82 토큰**. 등록명세의 정적 확인이며 91 typed 포인터/42 실제 SQL행/Word 문서 바이트 재독이 아님.

독립 정수 검산: 급여 2,400,000×12=28,800,000원, 사업 관측 1,000,000×11=11,000,000원 → 관측합 **39,800,000원**. 사업소득 12월 null, VAT/종소세 과거 신고액은 관측합에 더하지 않음. 월 900,000×36/48/60=32,400,000/43,200,000/54,000,000원(명목), 현재가치 30,000,000과 청산가치 32,000,000의 **차이 2,000,000원**. 이 숫자는 법원 인정소득/변제계획 인가 판단이 아님.

## 4. 법률 원문 및 적용일 경계 (2026-11-02 확인)

1. **서울회생법원** 2026-10-01 [보도자료 원문](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 **제424호 제2조 제2항 제7호 신설** 공지 확인. 게시일≠개별 사건 적용일. 첨부 개정전문 PDF 부칙·경과규정/사건 접수·개시일별 적용 **이번에도 미관찰**, 자동 승인규칙 반영 금지.
2. **국가법령정보센터**, [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 채무자회생법 **[시행 2026-10-02; 법률 제21490호]** 및 3년/예외 5년·청산가치/공정성/수행가능성 별도 확인. 법 시행일≠개별 사건 적용법 판본 판단.
3. **국세청** [부가가치세 과세기간 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 반기/간이과세자 통상 연간. 매출·세액은 월 법률 인정 순소득과 다름.

법원 424 개정전문 첨부 PDF의 시행/부칙과 개별 사건 관할·선후적용 판단은 **변호사·계산사무장 미인증**. 자료 source-only/미관찰/null/0/상충/비해당/승인전 상태를 합치지 않았다.

## 5. 체크 ID·실제 수정·다음 회차

| A2 ID | 이번 실제 검증 | 보드 상태 |
|---|---|---|
| A2-DATA-003 | 원화 소수/숫자 정규형, 0/선행 0·음수 0 구별; Draft #160 | [ ] 부분 |
| A2-DATA-017 | 실제 직렬화 함수·형식/Fact 계보, SQLite 7합성 재조회, 42경로 정적 | [ ] 부분 |
| A2-DATA-020 | 명시적 0/null/상충/blocked/not_applicable/source-only 승인경계 | [ ] 부분 |
| A2-DATA-024 | 0011 DDL SQLite 7/7, 동일 ID 이질 replay/Head 허용 재현 | [ ] 부분 |

**다음 r68 AX담당자:** Draft #160/#148/#151 실제 Node/TS 테스트 실행, #138 Fact 계보·#153 멱등쓰기·#157 stale revision·#154 서식 미확정값 통합. 정상 원문→Fact→typed→SQL→D5103/10/11 서식 토큰까지 값·판본·출처 일치 검사. 특히 SQL 충돌 감지/원자성은 운영 아닌 staging D1에서 별도 검토. 제424호 개정 PDF 부칙/경과·사건별 적용일과 법률·세무 인가는 실무자 확인 전 미인증.

**제품 최종 인수 0건.** 실제 관찰은 GitHub 코드/PR/스키마·정적 JSON, 실제 함수 V8 격리, Python SQLite 가상 DB 및 독립 산술·공식 HTML 조회까지. 작성한 Node 테스트는 미실행. 전체 프로젝트 CI·staging D1/R2/Cron·실제 DOCX·공식서식 동등성·변호사 승인·사이트 배포는 미실행.
