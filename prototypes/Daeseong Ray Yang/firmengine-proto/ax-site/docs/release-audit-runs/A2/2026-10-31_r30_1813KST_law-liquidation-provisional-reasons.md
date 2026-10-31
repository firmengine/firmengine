# FirmEngine A2 r30 — 변호사: 청산가치 수치/법적 인가 경계·원인코드 감사

- 회차: 2026-10-31 KST, **r29 계산사무장 → r30 변호사 → 다음 r31 데이터담당자**.
- 저장소 `firmengine/firmengine`, 허용 디렉터리 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만 수정. 시작 main `e1d344db40b4af7d8a243eae5c1142c060c82486`, 영수증 생성 직전 main `e1d344db40b4af7d8a243eae5c1142c060c82486`. A1/A3/A4 변경 미수정.
- 중앙 보드 ID: **A2-LAW-013, A2-LAW-015, A2-LAW-018, A2-LAW-022, A2-LAW-023**. 모두 **부분 검증 [ ] 유지**, 제품 인수 완료 0건.
- 선행 r29: [청산가치·변제예산·배분 영수증](2026-10-31_r29_1709KST_calc-liquidation-review-pro-rata.md); [Draft PR #84](https://github.com/firmengine/firmengine/pull/84). 기존 #67/#79도 `assessment.ts`를 변경하므로 독립 병합 금지.
- 읽은 실제 main 파일/blob: `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/context-validation.ts` `7ea7262cca177cc92a59f65fe917cc14573786db`, `lib/legal-rules.ts` `bfb4e1cc4696c7e6044ffb28b06f8bbed578dd7b`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `package.json` `8129160e33af3ae250c757a6a8195a29674ad031`; r29 영수증과 PR #84 패치·신규 테스트·최근 main 커밋/PR도 확인.

## 1. 합성 입력 / 독립 예상 / 실제 조건식 비교 (A2-LAW-013/022/023)

실제 현업 증빙이 아닌 **합성**: 재산 1개 (`asset-1`), 지분 100%, 평가액 1,000,000원, 담보상환/처분비용/보호가액 각각 명시적 0원, 원문 Fact `verified/accepted`, typed `amountWon="1000000", normalizationStatus="exact"`; 비교 대상 `approvedPresentValue.amountWon="30000000"`, 기준설명 존재, 두 검토 boolean=true. 독립 BigInt 차액 **30,000,000−1,000,000=29,000,000원**. 현재가치 500,000원 사례는 **500,000−1,000,000=−500,000원**. 명시적 0원과 null은 혼합하지 않음.

GitHub 원본문 `assessment.ts`의 `liquidationComparison` 분기와 Draft #84 변경 분기식을 **동일 의미 JS 표현식으로 격리 재실행**(프로젝트 import/전체 계산엔진 실행 아님). 독립 기대값 대비 **main 5/9, #84 9/9**.

| 합성 경우 | 독립 기대 | main 격리 관찰 | PR #84 격리 관찰 |
|---|---|---|---|
| 모두 검토, PV 30m / 청산 1m | met (내부 수치 비교) | met | met |
| PV 검토 false, 금액은 존재 | unknown | **met** | unknown |
| 재산평가기준 검토 false | unknown | **met** | unknown |
| 개별 재산 recognition=unreviewed | unknown | **met** | unknown |
| 공유 담보 귀속범위 reason 존재 | unknown | **met** | unknown |
| 모두 검토, PV 0.5m / 청산 1m | not_met | not_met | not_met |
| 모두 검토, 명시적 0 / 0 | met (산술만) | met | met |
| 현재가치 null | unknown | unknown | unknown |
| 재산 기준일 불일치 경고 | unknown | unknown | unknown |

`assessCase()`는 `liquidationComparison=met`을 **개별 finding outcome=pass**로 연결하지만, 전체 status/문서 finalization에는 별도의 다른 검토 게이트도 존재한다. 개별 PASS를 법원의 인가나 전체 최종 제출 승인으로 해석하지 않음.

## 2. 추가 발견·안전한 진단 보완 (A2-LAW-022/023)

Draft #84는 검토전 `liquidation_comparison` trace를 `provisional`로 낮추지만 **재산평가기준 미검토, 개별재산 unreviewed, 공유담보 범위 reason** 때문에 보류한 경우 `reasons=[]`가 될 수 있었다. 내부 담당자가 **어떤 사람 검토가 필요한지** 재독해할 수 없는 진단 누락이다.

- Draft #84 한정 `lib/assessment.ts` 원인코드 출력 보완 커밋: `0a73f701acd3e0033fcb680075b67caf51e60492` (기존 파일 blob `e53579c396a9ae193cc5f258e1d78416c4478589` CAS).
- `tests/calculation-18-output-golden.test.ts`에서 PV/재산평가기준/재산 unreviewed에 원인코드가 존재하는지 검증문 2개 추가 커밋: `341900c55e4228f5c4e11a5e24d945bc942af8ac` (기존 blob `63b43c47ac400cafae264f4e46d50edabfdedc04` CAS).
- 신규 원인코드: `ASSET_VALUATION_BASIS_REVIEW_REQUIRED`, `ASSET_RECOGNITION_REVIEW_REQUIRED:asset-1`; 기존 `PRESENT_VALUE_REVIEW_REQUIRED`, `PRESENT_VALUE_BASIS_MISSING`, `ASSET_AS_OF_RECONCILIATION_REQUIRED`, 자산행 reason을 중복제거하여 trace에 기록.
- 동일 형태의 `reasons` 표현식 **JS 격리 7개** 독립 기대 대조: 변경 전 4/7, 변경 후 **7/7**. `met/not_met/unknown`의 숫자 계산·법률 규칙은 **이번 수정에서 변경하지 않음**.
- 기존 Draft #84 신규 실제 Node 프로젝트 테스트: **실행하지 않음**. 커밋·테스트 작성·JS 격리 통과와 Node/전체 CI 통과는 별개. PR HEAD `341900c55e4228f5c4e11a5e24d945bc942af8ac`, Draft·미병합; 변경 파일 2개 모두 허용 경로.

## 3. 법률 원문과 사건별 인정 경계 (A2-LAW-013/015/018)

- **국가법령정보센터 법 제611조**, 법률 제21490호 **[시행 2026-10-02]**: 변제계획 내용, 3년 원칙 및 특별사정 5년 이내. 원문: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777
- **국가법령정보센터 법 제614조**, 같은 시행판: 인가결정일 기준 전체 채권 총변제액과 파산배당액 대조, 공정·형평·수행가능성·비용 등 추가 요건. 이의가 있으면 개별 이의채권자 배당, 전체 가용소득 제공, 최소변제액 등 **별도** 요건이 필요. 원문: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710773 . 현재 `assessCase`는 이의 채권자별 비교가 미구현이면 `unknown`으로 유지한다. 본 내부 수치 비교는 법률상 인가 조건의 충분조건이 아님.
- **서울회생법원** 2026-10-01 공식 보도자료: 실무준칙 제424호 제2조제2항 **제7호 신설** 공지. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . **보도자료 첨부 PDF 전문/부칙/경과조치, 사건별 적용일 미검증**. 공지일을 시행/사건 적용일로 승격 금지, 서울 외 법원 자동복사 금지.
- **국세청** 공식 안내 (VAT 매출·과세체계 vs 종합소득세 소득금액): https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 . 세무상 소득·매출 및 법원 인정 변제재원은 별도. 이번 회차 VAT/종소세 숫자 산식 또는 중복 제거는 실행 검증하지 않았고 합격 표시 없음.

## 4. 저장형식·계약 정적 재독해 (제품 통합검증 아님)

- `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 계산 모듈 / 91 inputs 선언(78 고유) / 42 outputs 선언(40 고유 이름) / 42 고유 resultPaths**. 직접 JSON 파싱.
- `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5110 55 / D5111 82** 토큰. 직접 JSON 파싱.
- 원문 `Fact`(state, recognition, factIds, period) → typed `NumericInput`(`amountWon`/status) → BigInt 산술·trace(`provisional/calculated/blocked`) → SQL feature(`value_json` NOT NULL, `value_won` nullable, `status` NOT NULL) → 서식 토큰의 **정적 계약만 확인**. 합성 데이터의 실제 Fact INSERT, SQL feature 저장/재조회, Word 바이트, 토큰 종단매핑 **미실행**. 미관찰=null, 0="0", 비해당, 상충, source-only, 승인전 상태를 구분.

## 5. 실제 미완료 및 다음 r31

- 정식 Node 22 PR #84 회귀 테스트, 프로젝트 전체 CI, PR #67/#79 `assessment.ts`와 비파괴 통합, #58/#81 D5103 preflight 및 #71 SQL 재검증, staging D1/R2/Cron, 공식 Word/법원 양식, 법원 424호 첨부 부칙/적용일, 변호사·계산사무장 승인 모두 **미완료**.
- 다음 **r31 데이터담당자**: 법적 검토 flag·재산 Fact 인정·PV 기준일이 사건 revision/source head와 일치하는지, `approvedPresentValue`가 계획 변경 뒤 재검토되는지, 18모듈 91 입력/42 결과 SQL replay·D5103/D5110/D5111 연계 합성 검증. **수치 존재만으로 PASS 확정 금지**.
- 운영 배포, 운영 D1 마이그레이션, 실제 전자제출, 법원 인가 확정 **미실행**. 법률/회계 적합성은 변호사·실무자 승인 전 **미인증**. A2 제품 인수 완료 **0건**.
