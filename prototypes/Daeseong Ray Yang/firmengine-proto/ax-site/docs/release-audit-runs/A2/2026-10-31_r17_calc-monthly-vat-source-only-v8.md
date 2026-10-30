# FirmEngine A2 17차 — 계산사무장: 월별 사업소득·VAT source-only 증빙 경계

- 감사일: 2026-10-31 KST. 주관 역할: **계산사무장** (이전 r14 AX → r15 IT → r16 사용자·서류담당자 → 이번 r17 계산사무장).
- 감사 시작 GitHub `main`: `d1e285c5160669d8f9be9f2e441f04553bc3116f`; 최근 A1/A3/A4의 보드·영수증 변경을 확인하고 A2 최신 r16 영수증을 읽음. #58/#60은 Draft·미병합 (이번 회차 변경하지 않음).
- 유일한 인수 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`; 미완료 5 ID: `A2-CALC-006`, `A2-CALC-009`, `A2-CALC-010`, `A2-CALC-016`, `A2-DATA-012`. 전부 **[ ] 부분 검증**.
- 직접 읽은 소스: `lib/business-monthly-workbench.ts` blob `0174f228473516e94664be445d8f46a33f833f80`, `lib/business-net-reconciliation.ts` `60a4fc295943dce404a7f99efffe88f58dd2d4ff`, `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, `lib/income-resolution.ts` `f370c4b14fd347089708c5c3241fa9c72522d4bf`; `tests/business-monthly-workbench.test.ts` 존재·소스만 확인.
- 저장 계약 정적 확인: `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`. OCR 원문/Fact/typed/SQL feature 직접 insert/re-read 및 D1 staging은 **미실행**.

## 실행 방법 및 독립 산술 오라클

GitHub main에서 내려받은 **실제** `assembleBusinessMonthEvidence` 순수 함수 본문과 바로 위의 날짜/금액 helper를 TS 타입 주석·타입 단언만 제거해 V8에서 실행했다. 날짜, 월, BigInt, 가드·문맥 분기는 소스 원문을 유지했다. 정식 TypeScript/Node 프로젝트 테스트, DB·Word·전체 CI를 실행한 것이 아니다. 임의 인물·문서 ID `SYN`만 사용했으며 고객 개인정보/키/비공개 정답 없음. 각 원문 소스 행은 `{factId,sourceRecordId,sourceDocumentIds,sourcePages,amountWon,observedState,reviewState,verifiedAndAcceptedSource,periodStart,periodEnd,periodOverlap,use:"source_only_not_legally_approved"}`의 실제 workbench 계약에 맞춘 순수 합성객체.

| 합성 입력 | 독립 기대(법률인정 아님) | 실제 V8 관찰 |
|---|---|---|
| 대표기간 2026-01~12; 1~11월 각각 총매출 3,000,000원·비용 1,000,000원, 12월 원천행 없음 | 정확히 12월 누락, `null`, coverage 미완료; 11개월을 12개월로 대체 금지 | 12개 월 생성, 12월 `BUSINESS_MONTH_NO_SOURCE_ROWS` + 총매출/비용 누락, incomplete=true |
| 12월 모두 총매출 3,000,000원·비용 1,000,000원(서로 다른 sourceRecordId) | 다른 원천간 승인되지 않은 계산 2,000,000원을 확정 금지 | 모든 `arithmeticDifferenceWon=null`, `legalNetApproved=false` |
| 같은 2026-01 sourceRecordId에 총매출 3,000,000원·개별 비용 1,000,000원 | 산술 프리뷰만 2,000,000원; 법률인정 false | preview `"2000000"`, approved=false |
| 1월 총매출 3,000,000원·비용 1,000,000원·별개 `input_vat` 100,000원 | 비용원가 1,000,000원(입력 VAT 중복 차감 금지), VAT 별도 source-only | cost `"1000000"`, VAT `receiptAndTaxFacts`에 존재; 법정순소득은 미인증 |
| 한 달 서로 다른 총매출 3,000,000원 2행 | 6,000,000원 임의 합산 금지 | `sourceGrossWon=null`, `BUSINESS_GROSS_TOTAL_MULTIPLE` |
| 같은 원천 비용 `null` | `null`이지 0원 아님 | 비용=null·preview=null |
| 같은 원천 비용 실제 `0` | 프리뷰 3,000,000원 가능, 법률인정 false | 비용 `"0"`·preview `"3000000"` |
| 2027-01의 미래월 행을 2026 대표기간에 입력 | 기간 외 행 추적, 2026 소득 아님 | `outsideSelectedPeriodFactIds=["future"]`; 월매출=null |
| 2026-01-15~31 부분월 | 월별 완료자료로 강제 환산 금지 | `unassignedSourceFacts`에 `SOURCE_PERIOD_NOT_EXACT_ONE_CALENDAR_MONTH` |
| 비용 -100,000원 | 비정상 비용 차단, 자동 음수 경비 반영 금지 | cost=null·preview=null |
| 한 달 비용 개별행 1,000,000원과 총계행 1,000,000원 동시 | 2,000,000원 이중 차감 금지 | cost=null, `BUSINESS_COST_TOTAL_AND_LINES_OVERLAP` |

**관찰: 11/11 합성 V8 기대 일치**. 이 결과는 `assembleBusinessMonthEvidence` 함수 본문의 특정 순수-증빙 경계만 증명하며, `businessNetReview`의 승인 흐름·전체 `calculateCase`·실제 저장·공식 서식의 합격 증거가 아니다.

## 계산·서식 등록 명세 및 위험분리

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 실제 파싱: **계산모듈 18 / 입력 선언 91 (고유 78) / 출력 선언 42 / resultPaths 고유 42**.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 실제 파싱: **D5103=37, D5110=55, D5111=82 등록 토큰**.
- 소스 흐름 경계: `raw_value_json/source_state` → 원문 Fact/review → `cases.payload` typed → `case_calculation_features.value_json/value_won/status/output_path` → D5103/D5110/D5111. 현 회차는 소스·DDL·카탈로그를 **읽기만** 했고 91 입력/42 출력 종단 매칭, 실제 SQL round-trip, DOCX 바이트를 확인하지 않았다.
- `business-monthly-workbench`는 VAT/세액/실입금을 법정 순사업소득으로 임의 채택하지 않으며, 계산은 산술 프리뷰와 법률상 인정의 구별이 필수. `business-income-policy.ts` 기본 rules=[] 및 공식 출처·관할·기간·검토자 조건을 정적 확인했지만 실제 Reference Bundle/staging 적용상태는 미관찰.
- `null`=미관찰, `"0"`=실제 확인 0, 외부월=원천 추적 보존, 부분월=미배정, 동일시기 다중 총매출=상충, VAT=source-only, 법률상 인정/사람 승인 전=미승인으로 **별도 유지**.

## 공식 법률·세무 기준 (2026-10-31 조회; 자동 적용 없음)

1. 국가법령정보센터: 「채무자 회생 및 파산에 관한 법률」 **[시행 2026.10.02, 법률 제21490호(2026.03.24 타법개정)]**, 제611조(변제계획 내용과 기간). 원문 https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221. 이번 감사에서 사업소득/기간을 법적 인정액으로 승격하지 않음.
2. 서울회생법원 보도자료 **2026.10.01**, 실무준칙 제424호 **제2조 제2항 제7호 신설** 공지. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187. 공지 HTML은 확인했지만 **첨부 PDF의 조문/경과조치/사건 적용일은 미검증**. 관할 외 자동 복제 금지.
3. 국세청 VAT 공식 안내: 일반과세자는 매출세액에서 매입세액을 차감, 간이과세자는 별도 업종별 부가가치율/공제 방식이며, 일반 6개월·간이 1년 과세기간 구분. https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2355. 법률상 인정 순사업소득을 VAT 신고금액과 단순 동치로 두지 않음.

## 변경/다음 항목

- 이 회차 **제품 코드 수정 없음**: 11개 순수 함수 합성 기대 모두 통과해 새 결함이 입증되지 않았음. 이번 문서는 감사를 이어가기 위한 영수증이며 통과 체크가 아니다.
- 보드 5개 ID에만 이번 증거를 보존 병합하고 기존 `[ ]`를 유지한다. **인수 완료 0건**.
- 다음: 계산사무장 → 변호사 담당자 순환. `A2-CALC-001/002/016` 급여 11/12·상여·세전/세후 금액의 전체 `calculateCase` 재현, `A2-CALC-004/005/006/009/010` VAT 일반/간이·기존 사업 review crosswalk, `A2-DATA-016/017/018` 18×91→42 SQL feature 저장·재독, #58/#60의 **정식 Node/TS 회귀 실행**과 D5103/11 Word 대조.
- 별도 미완료: #25/#29/#37/#43/#47/#50 변제원장 통합, #58/#60 Draft 병합 심사, staging D1/R2/Cron, 전체 CI, 공식 Word·법원 서식, 변호사·세무회계 전문가 승인. 운영배포/DB 운영 마이그레이션/실제 전자제출은 하지 않았다.
