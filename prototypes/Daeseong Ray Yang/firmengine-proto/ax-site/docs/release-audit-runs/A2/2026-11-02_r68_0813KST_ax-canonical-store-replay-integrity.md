# FirmEngine A2 r68 — AX담당자: 원화 저장값과 재독 감사의 계약 충돌

- 회차: **2026-11-02 08:13 KST**. 담당 순서 **r67 DATA → r68 AX → r69 IT**. 지정 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 시작 main HEAD `e14f05e4585bdcc532204f17766ceb1d90822597`; 최근 A1 r68 / A4 r67 / A3 r67 / A2 r67 커밋 및 열린 Draft PR #136/#138/#148/#151/#153/#154/#157/#160을 확인. 중앙 보드 기준 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `5dc216937331a74370ea0300f98d6e05e7b70326` 시작 관찰. r67 상세 영수증 및 실제 0011 SQL, 기존 Node 테스트를 읽음.
- 실제 코드 blob: #138 `lib/preapproval-calculation-replay.ts` = `d82d5fa187e34bb7a2ce261a379f54841640fc7b`; #160 `lib/case-calculation-feature-store.ts` = `29b14cbd8865c375f38306d76124e2700f749a3e`; main `drizzle/0011_case_calculation_features.sql` = `0caa359d250dce45765d269d271ad63170ec3efa`.
- 이번 체크 ID는 **A2-AX-004 / A2-AX-015 / A2-AX-017 / A2-AX-018**. 네 항목 모두 [ ] 부분검증, 제품 최종 인수 0. 실제 고객 문서·OCR 사실값·키·.env·비공개 정답 사용 없음.

## 1. 교차 코드 결함 — 분류된 blocked 원화 문자열을 재독 검증이 오염으로 오판

#160의 실제 writer 함수는 `"00100"`, `"-0"`, `"9,00"`를 raw 값은 유지하되 `status=blocked, value_won=NULL`로 저장하는 게 독립 기대와 일치한다. 그런데 #138의 실제 replay 함수는 **관측된 값에 blocked 상태 자체를 허용하지 않고**, 원화 regex `^-?\\d+$`로 선행 0을 유효한 원화로 간주한다.

| 합성 데이터 (raw → status → SQL won) | 독립 기대(데이터 재독만) | #138 기존 | 신규 Draft #163 |
|---|---|---|---|
| `"2400000" → computed → "2400000"` | 재독 일치 | 일치 | 일치 |
| `"0" → computed → "0"` | 명시적 0 보존 | 일치 | 일치 |
| `null → missing → NULL` | 미관찰·null 보존 | 일치 | 일치 |
| `"00" / "-0" / "-00" / "00100" / "-01" → blocked → NULL` | **raw 보존·검토보류**, 데이터 재독 일치 | **STORED_STATUS_VALUE_CONFLICT + STORED_WON_MISMATCH** | 일치 |
| `"9,00" / "1 000" / "[미관찰]" → blocked → NULL` | **raw 보존·검토보류**, 데이터 재독 일치 | **STORED_STATUS_VALUE_CONFLICT** | 일치 |
| 이전 버전 `"00100" → computed → "00100"` | 잘못된 완료 상태 차단 | **허위 valid=true** | 상태 + 원화 불일치 |
| 이전 버전 `"9,00" → computed → NULL` | 잘못된 완료 상태 차단 | **허위 valid=true** | 상태 불일치 |
| `"00100" → blocked → "00100"` | 값-원화열 불일치 차단 | 차단 | 차단 |
| 원천 Fact `SYN-F1` 기대, 저장 `SYN-F2` | 계보 불일치 차단 | 차단 | 차단 |

실제 GitHub 함수 본문에서 TypeScript 타입 표기만 제거하고 V8 격리 실행하여, **19 합성 입력의 독립 기대 일치가 기존 9/19 → 후보 19/19**로 개선됨을 관찰. 신규 PR 브랜치의 수정된 실제 소스 blob `673747359f563011c53eb53e7d5272fdef530126`을 **재조회해서 19/19 반복 검증**, 비금액 `courtApprovalInferred=false`의 `not_applicable` 재독도 일치. 외부 모델·실제 법원 판단·전체 엔진을 실행한 것은 아님.

### 변경·검수 경계

- [Draft PR #163](https://github.com/firmengine/firmengine/pull/163) — #138 기반 **stacked Draft, 미병합**, 정확히 `lib/preapproval-calculation-replay.ts` + `tests/a2-r68-ax-canonical-won-replay.test.ts` 두 파일만 변경. 원단위 계산·원문·Fact·typed·SQL schema·승인 상태는 변경하지 않음.
- observed raw의 `blocked`는 데이터 재독 정합성으로 허용하되, `computed/provisional` + 비정규 원화 입력은 차단한다. 이때 재독 `valid=true`는 **보존·정합성만 뜻하며, 법적 적격소득/최종서식/법원인가를 뜻하지 않음**.
- **Node 회귀시험 6그룹 작성·커밋**. 실제 repository Node runner·전체 CI·lint·build **미실행**. #136/#138/#148/#151/#160의 병렬 스택을 단일 브랜치에서 조합하지 않았으므로 충돌 없는 통합인수로 표시 금지.

## 2. 실제 저장 SQL과 분리된 독립 합성 검산

Migration 0011의 runs/features/heads `CREATE TABLE/INDEX` 문장과 합성 `cases` 부모 stub으로 SQLite **3.46.1 인메모리** 재구성. `value_json/value_won/status/source_fact_ids_json/input_refs_json`을 재조회해 **6/6 독립 기대 일치**, 외래키 위반 0건. 합성 Fact `SYN-F1` 등만 사용. `"0"`/SQL `"0"` 대 `null`/SQL NULL, 비정규 raw/NULL/blocked, source-only VAT 별도 메타를 구별함. *source-only 분류는 가상 입력에 명시한 역할이지, 실제 제품 모델의 자동 판정이 아님.*

동일 가상 피처 ID에 서로 다른 금액 900만 원 재시도는 `INSERT OR IGNORE`로 changes=0, 이후 별도 head INSERT는 1행 성공. **기존 r63/r67의 조건부 재저장 무결성 위험 재현**; 정상 생산기 충돌 발생 입증/운영 D1 검증 아님. 고위험 저장정책을 변경하지 않음.

독립 BigInt 산술: 급여 2,400,000×12=28,800,000원, 사업 관측 1,000,000×11=11,000,000원, 관측합 **39,800,000원**. 미래 12월 미관찰은 0으로 보간하지 않음. VAT 연매출 60,000,000원·과거 종합소득세 자료는 별도 source-only 자료로 두고 순소득 합산 금지. 월 변제 900,000×36/48/60 = 32,400,000 / 43,200,000 / 54,000,000원(명목); 현재가치 30,000,000 대 청산가치 32,000,000 차액 2,000,000원. 어느 것도 법원 인정 산출이 아님.

main 실제 카탈로그 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` JSON 재파싱: **18 모듈, 입력 91(고유78), 출력 42(고유40), 저장 resultPath 42(고유42), 미등록 의존성 0**. 서식 catalog blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5110 55 / D5111 82** 토큰(각 고유). **정적 목록 검증에 한하며 91입력 소비/42 SQL 결과/실제 Word DOCX 재독은 미실행**.

## 3. 공식 원문·시행일 검토(2026-11-02 기준)

- **서울회생법원** 2026-10-01 [보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): **실무준칙 제424호 제2조제2항제7호 신설** 공지. 개정전문 첨부의 경과조치·사건별 적용일 **이번에도 미관찰**. 공지일을 사건의 법률 적용일로 추정하거나 자동규칙을 바꾸지 않음.
- **국가법령정보센터** [법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **[시행 2026-10-02, 법률 제21490호]** 판본 원문 확인. 변제기간 3년/특별사정 최장5년, 법원 인가요건·청산가치 보장은 내부 데이터 재독과 구별.
- **국세청** [부가가치세 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 반기, 간이과세자 통상 1년 과세기간. VAT 신고매출과 법원 인정 월순소득 별개; 종합소득세/원천징수 증빙도 자동승격 금지.

## 4. A2 체크·미실행·다음

| ID | 이번 실제 검증 | 상태 |
|---|---|---|
| A2-AX-004 | 0/null/unknown/blocked/conflict/비정규 원화, replay 상태 구분 19 V8 | [ ] 부분 |
| A2-AX-015 | 독립 BigInt 검산 및 실제 코드 재독 19 V8, SQL 가상 6건 | [ ] 부분 |
| A2-AX-017 | `computed`과 데이터 재독/법률 인가의 구분, `courtApprovalInferred=false` | [ ] 부분 |
| A2-AX-018 | 코드·blob·합성 입력/기대/관찰/실패 및 PR 판본별 영수증 | [ ] 부분 |

**r69 IT담당자 후속:** #163/#138/#160/#151/#148/#153/#157 통합 소스 기반 프로젝트 Node 회귀/전체 CI, staging D1 SQL same-ID conflict·head CAS, 18모듈-91입력 실제 출력/42 저장피처 행, D5103/D5110/D5111 DOCX 금액·Fact 근거 재독. DB replay `valid`와 업무 승인 분리 검증. 법률 공지 제424호 부칙·경과/접수일 판정은 변호사·계산사무장 검수 전 미인증.

**제품 인수 완료: 0건.** 전체 CI/Node runner·실제 staging D1/R2/Cron·Word 공식서식 동등성·실제 법률 승인·배포 미실행. 운영 배포, 운영 D1 마이그레이션, 전자제출, 인가 확정 실행 없음.
