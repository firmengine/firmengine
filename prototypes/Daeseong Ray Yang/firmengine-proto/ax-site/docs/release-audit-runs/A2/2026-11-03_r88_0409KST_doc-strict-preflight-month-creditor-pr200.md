# FirmEngine A2 r88 — 사용자·서류담당자: D5103 월액 / D5106 채권금액 사전검증의 오인식 차단

- 검사 회차: **2026-11-03 04:09 KST 시작**. 순환: r87 IT → **r88 사용자·서류담당자** → r89 계산사무장.
- 저장·수정 허용: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 고객자료·개인정보·실제 OCR·키·.env 없음. 모든 예시는 SYN 합성.
- 최초 main HEAD `cda4521495aee0b6241c7552effffe64fc5232ae`; 최근 main A1 r87 (cda4521/1a9db0e), A4 r87 (5bf59a6/6233495), A3 r87 (fc8db6c/d11db30), A2 r87 (64f44ca/4fe7c48) 확인. r87 영수증과 Draft #199/#198, r82 영수증과 Draft #190/#181, 현재 보드 및 실제 소스 재독.
- 원본 blob: `lib/document-preflight.ts` `dc771c0ff0497d24df19478b0366ebbb397bfbf2`, `lib/form-contracts.ts` `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef`, `lib/document-writer.ts` `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`, `lib/legal-calculation-readiness.ts` `9edab755df5adae5f143d15285c550feb0e0f6d5`. SQL 0011 blob `0caa359d250dce45765d269d271ad63170ec3efa`.
- 검토 ID: **A2-DOC-002 / A2-DOC-004 / A2-DOC-016 / A2-DOC-018**; 모두 **부분 [ ] 유지**, 제품 최종 인수 0건.

## 1. 관찰 결함과 독립 기대

실제 main `document-preflight.ts`는 표시 숫자에서 쉼표·공백·₩·원을 위치 구별 없이 삭제하여 `1,00 → 100`, `0 0 → 0`, `1원2 → 12`로 읽는다. D5103 월별 `net_income`의 `D5103_MONTH_EVIDENCE_UNRESOLVED`가 발생하지 않거나, D5106 채권 행 `principal`에서 합계 100과 잘못 표시한 `1,00`을 같은 금액으로 오판한다.

- **실행한 독립 시험 A:** GitHub main 숫자판독 표현식 vs 신규 표현식을 JavaScript V8에서 직접 실행. 정상 0/0원/쉼표/선행 ₩/BigInt/음수와 잘못된 쉼표·중간 원·숫자 중간 공백·null/미관찰/승인전/비해당/unsafe Number 등 **27조건**, 기술 기대 일치 **main 18/27 → Draft 후보 27/27**.
- **실행한 독립 시험 B:** GitHub 원본 D5103 월행 게이트와 채권 합계 분기 본문(TypeScript 표현만 제거)을 동일 V8에서 실행. 2026-01/06/12 × 월액 6조건=18, 채권행 6조건=6: **main 14/24 → 수정 후보 24/24**, main false-safe 10건을 확인. 예: `2026-06, 1,00원` → 기대 `D5103_MONTH_EVIDENCE_UNRESOLVED` final blocker; main blocker 없음; 후보 blocker. `creditor.principal=1,00`, `total_principal=100` → 기대 검토보류; main 합계 정상; 후보 `REPEAT_ROW_AMOUNT_FORMAT_INVALID` final blocker.
- 정확히 관측한 것은 **표시 금액 파싱과 두 사전검증 분기의 V8 격리 실행**. 제출서류 생성 전체, 실제 SQL 값 소비, DOCX 바이트 재독, 실무 승인 결과는 아니다.
- 검토자 승인된 정확한 `0`은 0으로 보존. `null`, 미관찰, 비해당, 상충, source-only, 승인전은 0으로 대체하지 않음. 반대로 문자열이 정상 `100`이라고 해서 원천 Fact의 존재·승인 상태를 보증하지 않음. 채권 금액별 총합·법적 원금 인정은 별도 문제.

## 2. 실제 변경과 검증 계층

- **[Draft PR #200](https://github.com/firmengine/firmengine/pull/200)**, base main, 독립 브랜치 `audit/a2-r88-doc-strict-month-and-creditor-20261103-0409`; 변경 2파일 모두 허용 경로.
- `lib/document-preflight.ts`의 숫자 판독을 명시적인 원화 문자열 문법으로 좁혀 잘못된 쉼표·단위·중간 공백을 거부; unsafe JS number 거부. `creditor` 행 금액을 파싱 못한 경우 합계검사를 생략하고 정상처럼 지나가는 대신 final blocker / draft warning으로 기록.
- 변경 코드 blob `65ba55037cb4fc64c00ccf8c6203617f56ce2c00`; branch HEAD `d463ccceb08d08f4f66146fe11098bd969303e59`. 신규 `tests/a2-r88-doc-strict-preflight-amounts.test.mjs` blob `dab5d0ea7c3fdb379c4f31be44d4676939b47e84`: D5103 3개월×7조건, 채권 6조건, 합계 불일치·draft 분리 2조건, TODO 3건을 **작성·커밋했으나 프로젝트 Node 러너에서는 미실행**.
- main 제품 코드는 수정하지 않음. #166/#154도 `document-preflight.ts`, #190/#181은 별도 서식 재독 게이트를 변경하므로 통합·충돌 및 회귀 점검 전 Draft 미병합. 이 PR의 `mergeable` 상태와 CI 합격을 동일시하지 말 것.
- 실제 `FORM_CONTRACTS`/writer가 final blocker를 사용함을 정적 재독했으나 최종 writer 경로 실동작은 미실행.

## 3. 실제 저장·계산·서식 계약과 미실행 영역

- main `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 재파싱: **18모듈 / 입력선언 91(고유78) / 출력선언 42(고유40) / 저장 resultPaths 42(고유42)**.
- main `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 재파싱: **D5103 37 / D5110 55 / D5111 82** 등록토큰(각 중복 0).
- SQL 0011 원문 재독: `case_calculation_runs`의 `case_id/data_version/case_revision/input_sha256/reference_sha256`, `case_calculation_features`의 `run_id/calculation_id/output_path/value_json/value_won/status/source_fact_ids_json`. **이 회차 SQL INSERT/SELECT 및 실제 D1 시험 없음.**
- 저장모양 참조를 위한 **가상 미실행 fixture**: Raw `SYN-SRC: 2026-06 월순소득 '1,00원'` → Fact `SYN-F1 / review_pending` → typed `rows.month[0]={period:'2026-06',net_income:'1,00원'}` → feature 가상 `{value_json:'"1,00원"', value_won:null, status:'provisional', source_fact_ids_json:'["SYN-F1"]'}`. 이 사슬은 **SQL에 적재하거나 전부 실행하지 않음**. 원천 확인 없이 typed 또는 SQL feature에서 법률 인정금액으로 승격하지 말 것.
- 독립 산술 기준만 재확인: 합성 급여 2,400,000원 − 생계비 1,500,000원 = 900,000원/월, 36/48/60개월 단순 곱 = **32,400,000/43,200,000/54,000,000원**. VAT 신고매출/종소세 신고소득이 동일 사업 매출과 중복되면 추가 합산 금지. 미래월·소득원간 미관찰값은 0으로 간주하지 않음.
- 전체 계산 18모듈 실행·91 입력 소비·42 출력 SQL 재계산, staging D1/R2/Cron, 정식 Node 전체/CI, D5103/D5110/D5111 실제 DOCX ZIP/XML 금액·행·문단 재독, 공식 양식 대응, 변호사/서류·계산사무장 승인 **전부 미인증**.

## 4. 공식 원문 및 사건별 효력 경계

- **서울회생법원(2026-10-01 게시)** [변제기간 단축 대상 실무준칙 개정 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 제424호 제2조 제2항 제7호 신설 **공지 자체 확인**. 첨부 PDF 부칙/경과조치·개별 사건 적용일은 이번 회차 미확인, 모든 사건 자동 적용 금지.
- **국가법령정보센터** [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR) · [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): **[시행 2026-10-02], 법률 제21490호**. 3년 원칙/특별사정 5년 한도, 수행가능성·청산가치 인가 심사는 이 표시 숫자 테스트로 인정될 수 없다.
- **국세청** [부가가치세 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 반기, 간이과세자 통상 연간. VAT·종소세 신고액을 월 인정 소득으로 자동 합산·확정하지 않음.

## 5. 상태 / 다음 r89 계산사무장

| A2 ID | 본 회차 관찰 | 남은 사항 |
|---|---|---|
| `A2-DOC-002` | D5106 채권 반복행 6조건의 원금 표시 무결성 분기 | 다수 채권자·담보·우선채권·서식 반복행/실 Word |
| `A2-DOC-004` | D5103 2026-01/06/12×6 월행 금액 분기 | 급여/사업소득 중복·월별 cutoff/원문↔Fact↔typed |
| `A2-DOC-016` | 명시 0/null/미관찰·잘못된 문자열 분리, 27 원화조건 | 비해당·상충/source-only/승인전의 SQL→Word 전달·검토 |
| `A2-DOC-018` | writer/contract 정적 경로, 실제 Word 불실행 | DOCX 생성+ZIP/XML 바이트 독립 재독 및 공식서식 검토 |

**모두 부분 [ ] 유지 / 제품 인수 완료 0건.** 다음 r89 계산사무장은 #200/#190/다른 기존 Draft 충돌을 살핀 후 같은 사건 run·source Fact와 채권 원금/이자·36/48/60개월 변제배분을 저장 피처부터 문서까지 검증할 것. 무승인 법률 판정 변경, 운영 배포·운영 DB 마이그레이션·전자제출·법원 인가 확정은 수행하지 않음.
