# FirmEngine A2 14차 — OCR 원화 숫자구분자 오인식·source→typed 차단 제안

- 작성: 2026-10-31 KST, 합성값만 사용. 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 회차 주관: **AX 담당자**. 13차(변호사 중심)의 `#21 + #53 → Draft #58` 인계를 확인. 다음 회차는 IT/서류·계산 검증 축을 우선 순환.
- 감사 읽기 시작/신규 파일 직전 main: `2b65045ba4c124ca68b30684bae1c0fd07c8b398`. 최근 main 커밋·open PR 검색, 중앙 보드 blob `00275afc3130d8e3024f9ff6f444bcf4e5fdba8a`, 13차 영수증 blob `1412d2a80830d74c970939b004e26428309e0d69`, 정적 계약·SQL 스키마·실제 source 정규화·projection 코드를 읽었다.
- 실제 main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/ocr-calculation-input.ts` blob `8f7f51bf41f7c944b76419d7cc894e49ac771473`; `lib/extraction.ts` blob `75931aad3fc7871395e62276bb5533e24b15d1a5`. SQL `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`.

## 재현 경계와 실제 입력
`normalizeMoney`는 쉼표를 모두 삭제하고 원화 정수로 변환한다. `calculationSourceCellIssues`의 현행 main은 그룹 표시 문법을 따로 확인하지 않는다. 정적 `projectPage` 코드는 `calculationSourceCellIssues`가 비어 있으면 해당 항목을 `usable` 후보로 올리며, raw Fact validation에는 반환된 오류를 보존하도록 구성됐다. 이 투영 전체를 본 회차에 프로젝트 실행하지는 않았다.

실행 방법: 위 **실제 GitHub 함수 본문**에서 TS 선언만 제거한 V8 격리 코드. `normalizeMoney` 원본문의 단위·정수 연산을 실행한 최초 재현, 이후 main 및 수정 PR의 `calculationSourceCellIssues` 본문을 재조회하여 14개 합성 시나리오의 실제 반환을 비교했다. 프로젝트 Node/SQL/Word E2E와 구분할 것.

| 합성 원문값·상태·단위 | 독립 형식 기댓값 | main 관찰 | Draft #60 실제 함수 V8 |
|---|---|---|---|
| `1,00,0000`, present, KRW | source-only, 그룹문법 오류·자동금액 보류 | `[]`; 1,000,000원 exact 파싱 | `SOURCE_MONEY_GROUPING_INVALID` |
| `1,,000`, present, KRW | source-only·보류 | `[]`; 1,000원 exact 파싱 | `SOURCE_MONEY_GROUPING_INVALID` |
| `1,234,56`, present, KRW | source-only·보류 | `[]` | `SOURCE_MONEY_GROUPING_INVALID` |
| `1,000,000` / `1000000`, present, KRW | 정상 원단위 1,000,000 | `[]` | `[]` |
| `0`, present, KRW | 관찰된 영(0), null 아님 | `[]` | `[]` |
| `1,000.5`, present, 천원 | 정확 변환 1,000,500원 | `[]` | `[]` |
| null, unknown | 미관찰 (0원 대체 금지) | `[]` (이 지역검사는 비관찰 상태를 판단하지 않음) | `[]` |
| `0.1`, present, KRW | 원단위 불일치 보류 | `SOURCE_MONEY_NOT_EXACT_KRW` | 동일 |
| `100`, present, USD | 외화 보류 | `SOURCE_MONEY_NOT_EXACT_KRW` | 동일 |

추가 `+1,000원`, `-1,000`, present 값과 unknown/쉼표, 단위 미기재도 검사. **변경 함수본문 14/14 기대 일치**, 이전 false-ready 3개 예시를 직접 재현. 이 결과는 순수 함수 격리 검증만 의미한다.

## 제안 코드·실제 GitHub 변경
- 별도 [Draft PR #60](https://github.com/firmengine/firmengine/pull/60), 브랜치 `audit/a2-r14-ocr-money-grouping-failclosed-20261031`, 분기 기준 main `2b65045ba4c124ca68b30684bae1c0fd07c8b398`.
- `lib/ocr-calculation-input.ts` blob `8f7f51bf...` → `f45dc624483c7296af28aaa2802b51f93804a182`. 커밋 `b73c76e14ce7a9bb8b70352ac7bd73d8b7181f30`: `SOURCE_MONEY_GROUPING_INVALID` 신규 입력 형식 오류. 원본값, `normalizeMoney`와 법률·세무 산식은 변경하지 않음.
- `tests/a2-ocr-money-grouping-r14.test.ts` blob `cf7e1f5d1e4ebc4a08a010b8c0686ee67b2b0abe`, 커밋 `d92525f0fc7ece8983c213f2408acce65ca08cd9`: 정상/오류/0/null/외화/현행 `projectPage` 합성 투영 **Node 4개 테스트 그룹 작성, 정식 Node 실행하지 않음**. 프로젝트 의존성/CI/실제 D1·R2/Word 인수 완료로 표시 금지.
- PR #60의 변경 파일 2개는 모두 `ax-site/` 내부. 인접 Draft #58은 `document-preflight.ts` 수정이며, PR별 기능 검증이 통합 병합·최종 양식 인수는 아니다.
- 코드 변경의 제품 승인·실무자 리뷰 없이 main에 자동 병합하지 않음.

## 정적 계약/세무 구분
- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18개 계산 모듈, 입력선언 91, 고유 경로 78, 출력선언 42, 결과경로 42**. 모든 모듈에 선언은 있으나 **91개 실제 입력·42개 SQL replay 합격 아님**.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5110 55, D5111 82 토큰. **실제 DOCX 결과 바이트·공식 양식 대조 미실행**.
- `business-source-evidence.ts`의 VAT, 매출, 경비, 원천징수, 현금수령은 각각 별도 role이며, `business-monthly-workbench.ts`는 임시 산술을 `arithmetic_preview_not_legal_income`으로 표시. 이번 회차에 VAT/종소세/월 순소득·청산가치 인정 산식을 실행하거나 변경하지 않음.
- 원문/OCR 형태: `present/rawValue/unit/quote` → `Fact.validation` 예상 코드 → 검토 이후 typed → SQL feature → 서식. **이번 실제 실행은 첫 source 검증 함수와 정적 라우팅까지**. Fact·typed·SQL·Word 전체 실제 결과는 **미관찰**, `null`과 `0` 구분은 테스트 준비/순수 함수 수준. 임의로 통과 처리 금지.

## 공식 출처·적용일
1. 국가법령정보센터 채무자회생법 [시행 **2026-10-02**] [법률 제21490호, 2026-03-24 타법개정] 제589조 개인회생채권자·재산·수입지출 목록 및 급여/영업소득 입증 첨부: https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018130103 . 법률상 인가/채무·소득 인정 불변.
2. **서울회생법원** 2026-10-01 보도자료: 실무준칙 **제424호 제2조 제2항 제7호 신설**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . 개정 PDF·부칙·사건별 시행/관할 판단 이번 회차 **미검증**, 자동규칙 적용 금지.
3. **국세청** 부가가치세 개요(일반·간이과세 구분): https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401 . VAT=사업소득/인정순소득 등치 불가; 세무 원문 적용범위 및 공제는 실무자 승인 전 미인증.

## 5개 보드 ID — **[ ] 부분 / 제품 인수 완료 0**
- **A2-AX-002** OCR raw/Fact/typed 세 금액 정합성: 원문쉼표의 부정확한 exact 파싱 재현·Draft 게이트. Fact+typed+D1 완주 미관찰.
- **A2-AX-008** Prompt가 아닌 정형 datatype의 계산 가능성: `money`/`money_or_itemized`/`money_or_unknown` 본문 형식검사 확인. 정식 CI 미실행.
- **A2-IT-004** null·unknown을 0원 기본값으로 바꾸는 경로: 원문 local helper는 0과 비관찰을 구분하며 상태가 `present` 아닌 값은 이 함수에서는 검증대상이 아님. 전체 API/SQL 경로 미확인.
- **A2-DATA-020** OCR typed·SQL 상태 분리: 오류 그룹문법을 source-only로 남길 proposed gate와 로그 코드 확인. 실제 D1 저장/재독해 미실행.
- **A2-CALC-030** 수치 형식 oracle: 14개 독립 기대/실제 V8 일치. 18×91/42 결과, 법원 공식 양식, 변호사 승인 모두 미인증.

## 후속
1. #60 브랜치에서 `node --experimental-strip-types --test tests/a2-ocr-money-grouping-r14.test.ts` 및 `node scripts/audit-product-contracts.mjs`, 전체 `node scripts/run-preapproval-regressions.mjs --full` 실행 필요. 테스트 파일은 작성만 한 상태.
2. #58 D5103/D5110/D5111 숫자 표시 게이트와 #60 OCR 원문 형식 게이트를 합쳐 정상 0·월 급여/사업소득·11개월 누락·VAT 중복·외화·미래월에 대해 실제 원문→Fact→typed→SQL 피처→Word 해시 검증.
3. #25/#29/#37/#43/#47/#50 및 SQL #33/#38 관련 36/48/60회·원단위 잔여·월말 지급일 충돌통합 및 staging D1/R2 검증. 운영 마이그레이션/배포·전자제출 금지.
4. 법원·시행일·제424호 부칙, 원화 표기 및 과세처리 기준은 실무자·변호사 사전승인 없이는 자동 확정 금지.

**인수 완료 0건. 운영 배포, 운영 D1 마이그레이션, 실제 전자제출, 법원 인가 확정 미실행.**
