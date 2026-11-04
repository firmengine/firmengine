# A2 r117 — IT담당자 | OCR 금액 파서·정수 typed 검증 통합

- 감사 기준: 2026-11-04 KST 오전 09시대. 역할 순환 r116 AX → **r117 IT** → r118 사용자·서류담당자. 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 최초 main HEAD `cf3479bfeced902a389db46aaf193ca53c59b3d8`, 기록 직전 HEAD `cf3479bfeced902a389db46aaf193ca53c59b3d8`. 최근 커밋/미병합 PR 메타 확인; 부모 #231 → #232, 원천가드 #60, 이전 r116 감사영수증, 중앙 보드 및 스키마/소스 재독.
- A2 체크: `A2-IT-004`(null·실제0), `A2-IT-006`(원화·정수 경계), `A2-IT-018`(법원/세무 판본), `A2-IT-020`(런타임 타입·OCR 포맷). **모두 [ ] 부분 기술검증, 제품 인수 0**. 가상 SYN 입력만 사용.

## 원본 코드/테스트/저장 스키마

- main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; #232 `lib/domain.ts` blob `93a99efb76bfeef61b57f3e5b2430a655d6165b7`.
- main `lib/ocr-calculation-input.ts` blob `8f7f51bf41f7c944b76419d7cc894e49ac771473`; 기존 #60의 엄격 가드 blob `62329db8a6910bffe52f5f855f23b34fd56e4c4b`.
- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`; `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: `value_json TEXT NOT NULL`, `value_won TEXT`, `status TEXT NOT NULL`, `source_fact_ids_json TEXT NOT NULL`. `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, SQL INSERT/heads의 코드만 정적 열람, D1 실제 INSERT/SELECT는 이번 회차 미실행.
- 부모 #232 합성 Node 시험(`tests/a2-r116-money-source-unit-conflict.test.ts`) 재독. **테스트 파일 존재 ≠ 실행**.

## 실제 실행한 합성 기술 검증과 독립 기대

GitHub의 실제 함수 `normalizeMoney()` 및 `calculationSourceCellIssues()` 본문을 읽고 TS 선언 부분만 제거해 JavaScript V8 격리환경에서 재실행했다. 별도 소스 조각 재구현이 아닌 GitHub 본문을 사용했다.

| 합성 raw / unit / datatype | 독립 기대 | main 관찰 | 통합 #233 관찰 |
|---|---|---|---|
| `1,,2` / integer | SOURCE_INTEGER_FORMAT_REVIEW | `[]` 거짓 통과 | 형식 issue |
| `1,234` / integer | SOURCE_INTEGER_FORMAT_REVIEW | `[]` 거짓 통과 | 형식 issue |
| `-12` / integer | SOURCE_INTEGER_FORMAT_REVIEW | `[]` 거짓 통과 | 형식 issue |
| `9007199254740992` / integer | SOURCE_INTEGER_UNSAFE_RANGE | `[]` 거짓 통과 | 범위 issue |
| `0` / integer | `[]` (실제 관찰된 0) | `[]` | `[]` |
| `1,234원` / 만원 / money | invalid/null, source issue | exact 12,340,000원 | invalid/null + issue |
| `1,20원` / KRW / money | invalid/null, source issue | exact 120원 | invalid/null + grouping issue |
| `1,234원` / KRW / money | exact 1,234원 | exact 1,234원 | exact 1,234원 |
| `0원` / KRW / money | exact 0원 | exact 0원 | exact 0원 |
| `null` / KRW / unknown | 미관찰; 금액 0으로 대체 금지 | missing | missing |

- **정수 18조건**: main 6/18 기대 일치, #60의 엄격 가드·통합본 18/18.
- **금액 정규화 10조건**: main 6/10, 부모 #232 10/10.
- 통합 #233 **커밋 후 GitHub blob 재조회**한 본문에 대해 **27조건**(18 integer + 9 money) 격리 V8 재실행: **27/27 기술 기대 일치, 예외 0**. 합성 시나리오 전체 승인 27건이 아니라 동일 조건에서 관찰된 기술 응답이 오라클과 맞았다는 의미.
- #233 신규 `tests/a2-r117-ocr-integer-money-integration.test.ts` 추가: 정수 18, 금액 9, 추가 null/0/source-only/raw↔typed 비교 테스트 3개. **작성·커밋, Node 프로젝트 러너/CI 미실행**.

## 변경 및 승인 경계

- [Draft PR #233](https://github.com/firmengine/firmengine/pull/233): #232를 부모로 하는 미병합 stacked PR. `lib/ocr-calculation-input.ts`를 기존 #60의 엄격 정수/금액 OCR 게이트 코드와 일치시켜 기술 반례를 차단. 코드 blob `62329db8a6910bffe52f5f855f23b34fd56e4c4b`. 회귀시험 blob `d04a229b13926211fda9c63e6c7759344ec622fd`. 브랜치 HEAD `4ae8a5333fb0b3e7268983fc5651e3e2d47d23a8`.
- `main` 제품 코드는 바꾸지 않음. #60/#231/#232/#233 별도 병합 전 충돌·전 소비처 재테스트 필요. 원문 OCR 수정이나 금액 임의 추정, 법률·회계 기준 변경 없음.
- source-only, unknown, null, not_applicable, conflicting unit, actual zero, 승인 전은 별도 상태. 허위 0 대체/법적 인정/서식 확정 금지.

## 정적 계약, 독립 산술, 미관찰

- 계산모듈 18, 입력 선언 91(고유 78), 출력 선언 42(고유 40), 결과경로 42. D5103=37, D5106=48, D5110=55, D5111=82 토큰(각 등록 template SHA는 토큰 catalog 기준). **정적 JSON 파싱뿐이며 실제 엔진 18모듈·SQL typed 왕복·실제 DOCX 재독/금액 대조는 이번 미실행.**
- SYN 예: 금액 `1,234` + 추출단위 `만원` → 12,340,000원, 명시적 `1,234원` + `만원` → invalid/null. `0원` + `KRW` → 0원, `null` → missing/null. independent arithmetic and lexical oracle only; 월순소득·채권/청산가치/변제기간 인정값 아님.
- 급여·사업·VAT·종합소득세·채권/재산 계산 소비처 전체, Fact/typed/SQL feature→42출력→4서식, 36/48/60개월 배분, staging D1/R2/Cron, 전체 Node/TS/CI, 공식 법원 양식 및 변호사·계산사무장 승인 미실행/미인증. 실제 고객정보/실원문/개인정보/키/env 미저장.

## 2026-11-04 공식 출처 직접 웹 확인

- [서울회생법원 2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 제424호 제2조 제2항 제7호 신설 및 보도일 **직접 확인**. **개정전문 PDF·부칙/최초 접수일별 시행 적용은 이번에 직접 재독하지 않음**, 미인증/수동심사.
- [법제처 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): **법률 제21490호, 시행 2026-10-02** 각 원문 재조회. 기술 합계·인수 검증 ≠ 법률상 인가.
- [국세청 VAT 공식 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 6개월·간이과세자 원칙상 1년 과세기간 확인. VAT 매출→월순소득 자동 산입/법률 인정 금지.

## 다음 r118 사용자·서류담당자

1. #60/#231/#232/#233의 Node22 실제 프로젝트 러너·정적 타입/패키지/연결 소비처 검증 후 중복 PR 통합 전략 확정. source 값 invalid가 실제 `case_calculation_features`의 0원으로 바뀌지 않는지 확인.
2. `D5103/D5106/D5110/D5111` 출력 필드에서 0/null/invalid·source-only·반올림·원장 blocked를 구별하는 실 Word 재독 및 36/48/60개월 다채권 보수 검증.
3. #225/#226/#230의 법원 최초 접수 원천 Fact·관할·사건 귀속/승인 누락, #43/#223/#229의 변제원장 합계 오판과 통합회귀. 변호사/계산사무장 최종 승인 전 모두 [ ].
