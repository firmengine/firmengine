# FirmEngine A2 55차 — 데이터담당자: 서로 다른 계산 ID의 동일 SQL output_path 점유 오판

- 관찰 시각: **2026-11-01 약 19:10 KST**. 직전 54차 변호사 감사 → **55차 데이터담당자** → 다음 56차 AX담당자.
- 작업 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 한정. 최초 관찰 main HEAD `69ab0b85fb588ecc0e353596301a7cfd28758914`; 중앙 인수 보드 blob `3ecf58ffc0b5a8b44bdee510e6ad45dd6527b4e5`. 실제 코드와 54차 영수증, Draft #33/#70/#71/#130/#133, SQL migration, 기존 회귀소스 읽음.
- 대상 **A2-DATA-017, A2-DATA-018, A2-DATA-020, A2-DATA-024**: 4건 모두 **[ ] 미완료/부분 검증**. 데이터 중복성 검사는 변제계획 인가 또는 계산금액 법적 승인을 뜻하지 않는다.
- 직전 54차 증빙: `docs/release-audit-runs/A2/2026-11-01_r54_1811KST_law-variable-schedule-term-effective-source.md`. 기존 `lib/preapproval-calculation-replay.ts` main blob `9517e71ee238955ee4af679bce1ebced888c4432`; 선행 Draft #71 blob `d381298c7bf5d698f646b1f8ca81a52f0e6808c0`. 선행 #71 HEAD `42582fb14c13d2cb05d751dff6497c66be8dc756`; #71은 미병합·Draft.

## 1. 실제 소스 함수 및 SQL 스키마 독립검증

원본 구조: SQL `case_calculation_features` 는 `id`에 PRIMARY KEY, `run_id`에 FK가 있으나 `run_id + output_path` 유일 제약이 없다. 실제 migration `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`.

A2 55차 합성 입력(개인정보 아님): `case=SYN-CASE`, `run=SYN-RUN`, `outputPath=/assessment/calculation/monthlyIncomeWon`, `sourceFactIdsJson=[\"SYN-F1\"]`, 두 행 `(id=SYN-ROW1, calculationId=income_average, valueJson=\"2400000\", valueWon=2400000, status=computed)` 및 `(id=SYN-ROW2, calculationId=income_aggregation, valueJson=\"2400000\", valueWon=2400000, status=computed)`. 실행 JSON `assessment.calculation.monthlyIncomeWon=\"2400000\"`. 실제 원문이나 인정된 소득이 아니라 **합성 단일 출력값**이다.

- **독립 기대:** 같은 계산실행 내 동일한 물리적 JSON pointer를 서로 다른 계산 ID가 중복 점유하는 경우 검토보류; 금액을 2배 합산하거나 임의로 중복 제거하지 않는다. 본문 `expectedOutputs`의 계산ID+경로 검사는 그대로 유지한다.
- **실제 SQLite 실행:** migration 0011의 세 계산테이블/인덱스를 동일 DDL로 만든 `:memory:` DB + 테스트용 `cases(id)` FK stub에서 계산 run 1건과 위 두 SQL feature insert가 모두 성공. SELECT 2행, 중복 `output_path` 1종(빈도 2), `PRAGMA foreign_key_check=[]`. **SQL 제약만으로 의미 중복 차단 불가능**. Cloudflare staging/운영 D1이 아니다.
- **실제 #71 소스 V8 격리실행:** TypeScript 타입 표기만 제거한 `auditStoredCalculationReplay` 원본문. 동일 계산ID의 동일 path 중복은 `DUPLICATE_OUTPUT_PATH` 검출하지만, 서로 다른 계산ID가 동일 path를 공유하면 `valid=true, replayedPaths=2, issues={}`로 **거짓 정상**. 순서 역전과 명시적 0에서도 동일. 파일 내 `seen` 키가 `calculationId + NUL + outputPath`인 것이 원인이다.
- **수정 후보 실측:** 저장액/법률기준 변경 없이 `physicalPaths` 별도 집합으로 중복을 판단하고 `replayedPaths`를 실제 물리적 포인터 수로 고쳤다. 계산ID+경로 `seen`은 기존 `expectedOutputs` 일치 검사 전용으로 보존. V8 격리 **8/8 독립 기대 일치**. 기존 3개 거짓 정상 반례가 검토보류로 바뀜. 변경 후보 소스 blob `c3b2817b03d288523ee5d656d4e10f8a35087228`.
- 검증 행별: 정상 단일(기대/실제 true/true), 동일 calc 반복(false/false), 이종 calc 동일경로(false/false; 기존 true), 역순(false/false; 기존 true), 서로 다른 유효 출력(true/true), 0원 충돌(false/false; 기존 true), 단일 null/missing(true/true), 이종 calc + 금액변조(false/false; 이때 DUPLICATE와 OUTPUT_VALUE_MISMATCH 동시 검출).
- Node 회귀 **8개 테스트 파일 작성·커밋**, 정식 프로젝트 Node runner/전체 CI **미실행**. 테스트 blob `9a6a17e0046d29af92d6e8599fc041fffe7e5802`. 실제 D1·42 outputPath 전체 API replay·법원 DOCX 생성 미검증. V8 격리 8/8을 정식 Node/CI 통과로 승격하지 않는다.

## 2. 계층별 저장 및 독립 산술의 범위

- 원문/Fact/typed **예시 형식**: 원문 `2,400,000원`, Fact `{id:\"SYN-F1\",value:\"2400000\",sourceOnly:true}`, typed `{amountWon:\"2400000\",normalizationStatus:\"exact\"}`, SQL feature `value_json=\"\"2400000\"\"`/ `value_won=\"2400000\"`. **추출·검토·typed 실제 변환은 이번 회차 미실행**. 따라서 OCR→Fact→typed 보존은 미인증이며 source-only를 승인소득으로 승격하지 않는다.
- 독립 산술 참고: 합성 월 급여 2,400,000×12=28,800,000원, 사업소득 1,000,000×11=11,000,000원, 관측 합계 39,800,000원. 12번째 사업소득월은 미관찰이며 총액에 추가하지 않는다. 36/48/60개월에 월 900,000원일 때 각 32,400,000/43,200,000/54,000,000원. **이번 회차 엔진 18모듈 전체를 실행하지 않았으므로 이 숫자를 계산엔진 출력 합격으로 표기하지 않는다.**
- main 카탈로그 JSON 실제 재파싱: `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 18모듈, input 선언 91(고유78), output 선언42(고유40), resultPaths42(고유42). `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5110 55, D5111 82 등록 토큰. **정적 계약 수 확인에 그치며 원문→실제 DOCX 18/91/42 전체 대조 통과가 아니다.**
- 분리한 상태: **미관찰=null**, **명시적0=\"0\"**, **비해당=not_applicable**, **상충=conflict**, **source-only=증빙 비교 전용**, **provisional/computed=계산 저장 상태**, **승인전=법적 인가 없음**. 서로 자동 전환하지 않는다.

## 3. 기존 선행 PR와 범위/검토 보류

- 수정은 새 **Draft PR #135** `https://github.com/firmengine/firmengine/pull/135`, 기존 **Draft #71 위에만 스택**. PR #71의 저장값-원화열 NULL/0·기대 출력 수·status 검사를 덮어쓰지 않는다. 새 PR 수정 파일은 `lib/preapproval-calculation-replay.ts` 및 `tests/a2-r55-cross-calculation-output-path.test.ts` 둘뿐이다. 코드 커밋 `2d28da92c14dac60aa39ce619bdd08124e66b0da`, 테스트 커밋 `40030f07cba45788c6674b9357cde747ee1d1be8`.
- #133의 36/48/60 원장 월별 전액/잔여원 검토, #130의 D5103/5110/5111 초안/최종 게이트, #25 월말·#29 채권잔액·#43 형식 예외 역시 선행 Draft이며 이번에는 병합·테스트·법률규칙 변경 없음. 실제 독립검증을 거치기 전 `ready`/법원 인가로 승격 금지.
- 신규 결함은 동일 JSON pointer 두 계산 feature가 **실제 엔진에서 생성된 사례를 아직 재현한 것이 아님**. 합성 SQL 상태에서 replay 거짓 정상 허용 가능성이다. 작성·저장 경로가 해당 상태를 만들지 않는지 별도 종단검증이 필요하다.

## 4. 공식 법률·세무 자료 / 시행·법원 경계

- 국가법령정보센터 **채무자회생법 제611조** `https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777`, **[시행 2026-10-02, 법률 제21490호]**, 원칙 3년, 제614조①4호 등 특별사정이면 최대 5년. 제614조 `https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759` 인가요건은 내부 합계·데이터 검증과 별개. 공식 조문 HTML 직접 재열람 완료.
- **서울회생법원** `https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187`: **2026-10-01 공지**, 실무준칙 **제424호 제2조 제2항 제7호 신설**을 직접 재확인. 첨부 개정전문 PDF의 **부칙·경과조치·개별 사건 적용일 미관찰**, 따라서 사건별 자동 시행일 지정 불가. 보도일을 모든 사건 효력일로 확정하지 않음.
- 국세청 공식 안내 `https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486`: 일반과세자 VAT 반기/간이과세자 통상 연간, 종소세 연간 신고·필요경비 구별. VAT 총매출/세액을 법률상 인정 월순소득으로 자동 취급하지 않음.
- **법원 공식 서식 동등성·변호사·세무/계산 실무자 최종 인수 전 모두 미인증. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 미실행.**

## 5. ID별 인수상태 및 다음 회차

- `A2-DATA-017 [ ]`: 실제 #71 SQL 재생 함수 이종 계산ID/동일 JSON pointer 거짓 정상 발견, Draft #135 V8 8/8 후보 수정. **42개 출력 전체 저장/재생 미검증**.
- `A2-DATA-018 [ ]`: 등록 3종 서식토큰 정적 수 및 outputPath-to-token 계약 읽음. 원천 Fact→SQL run→D5103/D5110/D5111 실제 DOCX 바이트 추적 **미실행**.
- `A2-DATA-020 [ ]`: 0/null/source-only/상충/승인전 상태 분리, 0원에서도 이종 계산 포인터 중복 거짓 통과 보완. SQL 의미적 제약/모든 상태 조합 미검증.
- `A2-DATA-024 [ ]`: 동일 migration 0011 3테이블/인덱스, FK stub 인메모리 SQLite에서 합성 두 행 저장·재조회·FK 검사. Cloudflare D1, 전체 원문/Fact/typed→SQL→Word E2E **미실행**.
- 다음 56차 **AX담당자**: #71→#135 통합 Node runner 실행, 실제 저장 코드가 동일 outputPath 이종 calc를 만들 수 있는지 기원 분석, 계산 feature 전체 42 출력 및 D5103/11 문서 토큰 검사, 원장 #133/원천 #130 병합 검증. **제품 인수 완료 0건**.
