# FirmEngine A2 15차 — OCR 정수형 원문과 typed 정밀도 계약

- 기준일: **2026-10-31 KST**, 인위적·비실명 입력만 사용.
- 주관 역할: **IT 담당자** (14차 AX 담당자 다음 역할). 범위: A2 피처 저장/계산/서식 출처만.
- 원본 main 시작 HEAD: `962ce43d6e1814b0924be7e58df6924b09058548`; 영수증 직전 최신 HEAD: `962ce43d6e1814b0924be7e58df6924b09058548`. 수정 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 이전 14차 영수증 `2026-10-31_r14_ocr-money-grouping-source-gate.md`, Draft PR #60, 원본 소스/SQL/기존 테스트/최근 main 커밋과 열린 PR을 재조회. PR #58은 별도 서식 게이트 Draft·미병합으로 유지.
- 확인 blob: main `lib/ocr-calculation-input.ts` `8f7f51bf41f7c944b76419d7cc894e49ac771473`; `lib/extraction.ts` `75931aad3fc7871395e62276bb5533e24b15d1a5`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 프로젝트 파일 구조: `extracted_features.raw_value_json/source_state/unit/validation_json`, typed `cases.payload`, `case_calculation_features.value_json/value_won/status`, `case_calculation_runs.input_sha256/reference_sha256/source_heads_sha256`로 구분. 이번에는 D1 삽입/재독·완전한 OCR→Fact→typed→계산 연쇄 **미실행**.

## 확인한 결함 (기존 main 및 14차 Draft PR #60에서 동일하게 재현)

`calculationSourceCellIssues`는 `integer`형에 대해 `raw.replace(/,/g,"")` 후 정규식만 검사하여 잘못된 구분기호와 JS 안전정수 범위 초과를 형식상 정상 `[]`으로 판정한다. 반면 실제 `projectPage`의 `integer(key)`는 `/^\\d+$/`와 `Number.isSafeInteger`를 요구한다. 따라서 **원천형식 검증은 통과하지만 typed 숫자는 null이 되는 비대칭**이 있다. 이것만으로 법원 문서 오기입 또는 잘못된 법률 인가가 발생했다고 입증한 것은 아니다.

| 합성 raw / datatype (present, clear, 인용 있음) | 독립 기대 | main 실제 원본문 V8 | #60 보완 전 | 보완 후 원본문 V8 |
| --- | --- | --- | --- | --- |
| `1,,2` / integer | 형식검토 | `[]` | `[]` | `SOURCE_INTEGER_FORMAT_REVIEW` |
| `1,2`, `,12`, `12,`, `12,34` / integer | 형식검토 | `[]` | `[]` | 형식검토 |
| `1,234` / integer | typed가 쉼표 미지원이므로 source-only 검토 | `[]` | `[]` | 형식검토 (자동 1234 변환 안 함) |
| `9007199254740993` / integer | JS 안전정수 초과·검토 | `[]` | `[]` | `SOURCE_INTEGER_UNSAFE_RANGE` |
| `0`, `12`, `00012`, `9007199254740991` / integer | 형식 통과(별도 법률 검토) | `[]` | `[]` | `[]` |
| `1,00,0000` / money | 금액 구분기호 오류 | `[]` | `SOURCE_MONEY_GROUPING_INVALID` | 동일 오류 |
| `1,000,000`, `0` / money | 금액 원단위 정상형식 | `[]` | `[]` | `[]` |
| `0.1` / money (KRW) | 원단위 불일치 | `SOURCE_MONEY_NOT_EXACT_KRW` | 동일 | 동일 |

- 실행 방식: GitHub의 **실제 `normalizeMoney` 및 `calculationSourceCellIssues` 함수 본문**에서 TS 타입만 제거해 JS V8에서 실행. main/PR #60 변경전 `integer` 비정상 쉼표 5종을 포함한 거짓-clear 조건을 독립 재현. 보완 후 **21/21 합성 조건** 독립 기대와 일치(형식·경계·명시적 0·금액 회귀).
- 새 3개 그룹 `tests/a2-ocr-integer-typed-r15.test.ts`는 GitHub에 **작성만** 함. 실제 `node --experimental-strip-types --test` 명령을 실행한 결과는 아님. 프로젝트 전체 Node/CI/staging D1/R2/Word 법원 서식·변호사 승인은 별도 미인증.

## 조치와 동시작업 보호

- 이미 열려 있던 **Draft PR #60**의 기존 브랜치에서만 작은 방어 수정. 갱신 전 PR HEAD `d92525f0fc7ece8983c213f2408acce65ca08cd9`, 대상 blob `f45dc624483c7296af28aaa2802b51f93804a182`을 재조회하고 CAS로 코드 커밋 `c73665423592e006a5d09c7727b68931b00e63b4` (신규 blob `62329db8a6910bffe52f5f855f23b34fd56e4c4b`) 처리.
- 별도 테스트 파일 생성 커밋 `95b80a273f076a65909dafd36889ffcbe3f1ae20`. 같은 파일을 또 고치는 병렬 PR을 만들지 않고 기존 #60에 통합. Draft·미병합 유지.
- 동작 변경: 정수 OCR을 자동으로 보정하지 않고 **형식 보류**. 정상 정수형 0과 미관찰/null/비해당는 서로 다른 상태로 보존해야 한다. 원문·Fact 값 자체를 조작하거나 법률 소득·채권 인정값을 승격하지 않는다.
- 관련 기존 테스트 `tests/ocr-calculation-db-contract.test.ts`는 1.25 정수오류를 검증하지만 이상 쉼표/2^53 경계를 검사하지 않았다. 신규 테스트가 해당 공백을 보완.

## 독립 계약 및 산술 (엔진 E2E 아님)

현재 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 계산 모듈, 91 입력 선언(고유 78), 42 출력 선언/결과 경로**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5110 55, D5111 82 토큰. 이는 **정적 명세**이며 입력91→SQL→출력42→실제 DOCX 전수 통과가 아니다.

독립 BigInt 단순 검산 (가용월액 1,000,000원으로 가정, 법률 인정액 아님): 36개월 36,000,000원, 48개월 48,000,000원, 60개월 60,000,000원. 실제 `calculateCase`/정산/서식 엔진에 이 데이터를 투입한 영수증은 이번 회차 없다.

## 공식 기준 대조 (개별 사건 적용은 전문가 승인 전 보류)

1. 국가법령정보센터 **채무자 회생 및 파산에 관한 법률** [시행 **2026-10-02**] [법률 **제21490호**, 2026-03-24 타법개정] **제589조**: 채권자목록, 재산목록, 수입·지출 목록, 급여/영업소득 입증자료 첨부를 확인. https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018130103
2. **서울회생법원** 2026-10-01 공지: 실무준칙 제424호 **제2조 제2항 제7호 신설**. 공지 HTML은 확인, 첨부 PDF의 상세 부칙/적용 대상을 개별 검증한 것 아님. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187
3. **국세청** 부가가치세 개요: 일반과세/간이과세의 신고기간 및 세액 계산 구분 확인. OCR 정수형 수정이 VAT·종합소득세·사업순소득 자동 인정 산식을 변경하지 않음. https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401

## 중앙보드 A2 미완료 [ ] 유지 / 다음

- `A2-IT-020`: 현재 TypeScript 정수형과 실제 typed projection의 구문·안전정수 계약 차이를 찾아 보완. 전체 타입/E2E 미인증.
- `A2-DATA-003`: 원문 쉼표·지수·대수·정수0/미관찰 형식 구별 V8 검증. SQL insert/replay 미실행.
- `A2-CALC-030`: 독립 V8 21/21은 원천 수치형식 오라클이지 18계산 91입력 42출력 검증이 아님.
- `A2-DOC-016`: 0원/비해당/null은 단일 source gate에서 구별 가능하나 실제 서식 토큰·Word는 미관찰.
- `A2-AX-008`: 프롬프트가 아닌 source datatype 코드를 통한 정형 차단, 실제 LLM/OCR/SQL 실측 미인증.

**다음 실행:** #60 실제 Node 테스트 3+4그룹 및 정적 계약/전체 회귀, #58과 결합된 OCR→Fact→typed→SQL→D5103/D5110/D5111 출력·해시, 급여·사업소득 11/12개월 결측과 VAT/종소세·중복 확인, 36/48/60 원장 PR들의 충돌 통합 및 변호사 승인. **제품 인수 완료 0건**. 운영 배포·운영 D1 마이그레이션·실제 전자제출/인가 확정 미실행.
