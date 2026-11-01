# FirmEngine A2 r47 — 계산사무장 / 월별 소득원 결손과 동일 Fact 중복 검토

- 일시: **2026-11-01 KST**. 직전 r46 사용자·서류담당자 → 이번 **계산사무장** → 다음 r48 **변호사**.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 전용.
- 최초 조회 main HEAD: `479e66e69ef0404717802b849550082cc428f0ad` (최근 A1 r47 커밋). 본 문서 커밋 직전 HEAD: `479e66e69ef0404717802b849550082cc428f0ad`. main 제품 코드는 **미수정**.
- 중앙보드 A2 3개 ID **A2-CALC-014, A2-CALC-016, A2-CALC-018**, 모두 **[ ] 부분검증·미인수**. 기존 판단/영수증 보존.
- 확인: 중앙보드, r46 영수증, 최근 main 커밋/공개 Draft PR, main `lib/assessment.ts`/`lib/form-mapping.ts`/`lib/domain.ts`/`lib/document-writer.ts`/`lib/case-calculation-feature-store.ts`, `drizzle/0011_case_calculation_features.sql`, 기준정보/서식 등록 JSON, #117 소스와 테스트, #106/#96/#102 주요 수정. 관련 PR #97/#98 및 #108~#117은 병렬 스택으로 독립 병합 금지.

## 실제 합성 테스트: 입력 → 독립 기대 → 관찰

모두 **가상의 2026년 Jan–Dec 선택기간**, 가상 `source_id` / `source_stream_id` / `source_fact_ids`, 기한 `evidenceCutoff=2026-12-31`, 문자열 원화 금액을 사용. `selectedPeriod`는 담당자가 선택한 내부 확인범위일 뿐 **법정 12개월 의무가 아님**. 소득 법적 인정과는 분리.

**원본 #117 helper blob** `0b53df28dabea31c71d644678ac7dc22dbf95776`를 GitHub에서 읽고 TypeScript 타입 표기만 제거해 **V8 격리 실행**. 10개 독립 기대 중 **5/10 일치**. 특히 복수 소득원 전체 월의 union으로 급여 12개월 + 사업 11개월을 `complete`로 출력. 같은 Fact ID가 B1/B2에 중복 기재되어도 추가 검토가 없음을 뒤이어 Draft 초기본에서 별도 재현.

**Draft PR #119**: https://github.com/firmengine/firmengine/pull/119. Base는 #117 head `f823bec8d0ee6077dabc75d2ee97a884dd628171`; 최종 PR head `2e77f7aa1024cdbf7eaabb2bc4ed814aecb1071a`. 기존 #117·#115·#113·#108에 쌓인 **stacked Draft, 미병합**. 변경된 파일 정확히 4개: `lib/income-period-coverage.ts`, `lib/form-mapping.ts`, `lib/document-writer.ts`, `tests/a2-r47-source-stream-coverage.test.ts`. 모두 허용 디렉터리. 검토용 소득원 그룹 ID, 개별 소득원 ID, Fact ID, 검토상태/원천역할을 내부 bindings에 보존하고 완전한 월 집합이 복수 소득원의 부분 결손을 감추는 상황을 진단. 두 stream이 동일 Fact를 재사용할 때 `D5103_CROSS_STREAM_FACT_REVIEW_REQUIRED`. source-only VAT 원천/미확정 상태/Fact 미연결은 검토보류. `0` 문자열은 유효 관측으로 유지.

**수정 소스 재조회 후 GitHub 저장 테스트 본문**을 V8에서 타입 표기/Node import만 제거해 실제 실행: **17/17 독립 기대 일치**. helper blob `4c147631f109b9f07007c0285e7c15be9f01cb46`, test blob `f834f88a4b3bc30750713196e03cc0025da7e7bf`. **Node `node:test` 원본 runner/전체 CI/실제 `calculateCase()`/document writer/DOCX는 미실행**. 17/17은 **TS->JS V8 격리검증만**.

| 합성 입력/조건 | 독립 기대 | #117 원본 관찰 | #119 재조회 V8 |
|---|---|---|---|
| 급여 W 12월 × 240만 원 | 소스 기준 본 게이트 complete | complete | complete |
| W 11월만 기록, 12월 미관찰 | 검토보류 + 12월 공백 | review_required | review_required |
| W 12월 × 240만 + 사업 B 11월 × 100만 | **B의 2026-12 누락 검토** | **complete** | **review_required**, B gap=`2026-12` |
| W 12월 + B 1월만 | B 선택기간 보류 | **complete** | review_required |
| 이직 W1 1~6월 + W2 7~12월 | 부적절한 합산 확정 금지, **담당자 기간 판단** | complete | review_required (후속 승인 우회 설계 필요) |
| B1 12월 × 100만 + B2 11월 × 70만 | B2 12월 결손 검토 | 원본 source 검증 불가 | review_required |
| B1/B2 모두 12월이나 `source_fact_ids` 동일 Fact 재사용 | **상충·중복 사용 검토** | 원본 source 검증 불가, Draft 초기본 **complete** | **review_required** + sharedFactIds |
| 두 사업자가 각각 12월, 서로 다른 Fact | 본 범위 complete | source 검증 없음 | complete |
| B가 source-only/unreviewed, VAT 총매출 역할 | 승인 월소득과 구분/검토보류 | **complete 가능** | review_required |
| 출처 Fact ID/stream ID 누락 | 미관찰·원천 연결 검토 | **complete 가능** | review_required |
| 문자열 `"0"`의 12개월 | 0 관측 보존 | complete | complete |
| cutoff `null` | 시점 미관찰, 승인 전 | review_required (#117) | review_required |

**독립 산술 (검토 예시)**: 급여 2,400,000×12=28,800,000원; 사업 1,000,000×11=11,000,000원; **관측합 39,800,000원** vs 12개월 동등관측 가정합 40,800,000원(차이 1,000,000원). B1 1,000,000×12 + B2 700,000×11 = 19,700,000원 vs 모두 12개월일 때 20,400,000원(차이 700,000원). 부족한 월을 **0으로 보정하거나 미래월 추정 금지**; 연간 가정차는 법원 인정소득이 아님.

**중요 반례 및 병합 보류:** 6개월 근무→이직→6개월 근무는 12개월 모두 유효할 수 있는데 #119는 소득원 각각의 월 결손으로 인간 검토를 요구함. 이직·계절사업을 합법적으로 확정할 수 있는 **사람 승인/원천별 기간 범위 근거의 구조화된 우회가 아직 없다**. 따라서 #119는 Draft이고 **법률·계산 실무자의 명시적 승인 없이는 병합 금지**. 본 변경은 계산 수치·법원 인정소득 산식을 변경하지 않음.

## 실제 저장계약·서식 정적 검증, SQL 합성 재현

- main `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 계산모듈/91 입력선언(고유78)/42 출력선언(고유40)/42 resultPaths** 직접 JSON 파싱. `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`와 `public/templates/catalog.json` blob `9bae52fdf47fbc0935314bb5267503e4182080bd` 재독: D5103/D5110/D5111 등록 토큰 **37/55/82**, public 매핑 **35/53/80**(기존 계약 기록), `reviewer_pending`; 신규 내부 source lineage 메타는 법원 서식 새 토큰/승인값이 아님.
- `lib/form-mapping.ts` main blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`: D5103 `rows.month` 기존 필드는 entity,period,revenue,expense,net_income만 전파하여 stable stream/Fact IDs를 소실. #119에서는 calculation `incomeGroups[].sourceIds`를 사용해 월별 행 ID와 별개로 reviewer source group을 유지. 법률 의미/원본 증빙의 E2E 일치 아직 미검증.
- `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: `value_json`, `value_won`, `status`, `source_fact_ids_json` 별도 저장. 현 회차 **기존 독립 인메모리 SQLite 합성 재실행 9/9 통과**, `null`/명시0/source-only 구분 확인. 동시에 JSON `null`/WON `"0"` 상충도 DB가 저장 가능한 사실 관찰. **실제 staging/운영 D1 실행 아님**.

## 공식 2026-11-01 원문 재확인 및 법률상 한계

- **법원**: 서울회생법원, 2026-10-01 개인회생 변제기간 단축 대상 실무준칙 **제424호 제2조 제2항 제7호 신설 공지**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . **첨부 개정전문의 부칙·경과조치 및 사건별 관할·적용일은 미확인**. 이 공지를 자동 법률기간 규칙으로 승격 금지.
- **법률 판본**: `채무자 회생 및 파산에 관한 법률` [시행 **2026-10-02**, 법률 제21490호] **제611조** 변제계획 내용·기간: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 ; **제614조** 인가 조건/청산가치: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 3년 원칙/특별사정 5년 이내 법문과 소득원 coverage helper는 별개. 변경 없음.
- **국세청**: https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 (일반 VAT 반기, 간이 통상 연간; 종합소득세는 연간; 장부 총수입금액-필요경비와 신고기간 별도). VAT 총매출/세액/종합소득세 신고금액과 개인회생 승인 월소득을 자동 동일시하지 않음.
- 법률/세무/회계 적합성은 **실제 변호사·계산사무장·서류 실무자 승인 전 미인증**.

## 중앙보드 상태 / 다음 회차

- **A2-CALC-014 [ ]**: 복수 사업소득원 12+11 및 동일 1월 공통 Fact 합성; 서로 다른 사업자·동일 거래의 법적 식별/세무 E2E 미검증.
- **A2-CALC-016 [ ]**: 대표기간 12/11 누락/0/null·source-only·cutoff 불완전의 별도 진단 및 신규 Draft #119. 전체 `calculateCase`/D5103 final 미검증.
- **A2-CALC-018 [ ]**: 복수 급여 지급자 6+6의 정상적 직장 변경은 인간 심사 필요; 현재 Draft의 보수적 경고가 정상 사례를 과도 차단할 위험 있어 검토 승인 전 병합 금지. 상여/지급월/복수기간 실제 E2E 미검증.
- 다음 r48 **변호사**: #119의 정상 이직·계절사업 기간 승인 예외 계약과 제424호 관할/부칙·시행일 판본을 검수; #117+#106+소득 집계 Draft #96/#97/#98/#102 전체 Node 시험, 월별 지급/배분·SQL/WON 정합성 검사. **실제 최종본 및 인가 확정·운영 배포/운영 D1 마이그레이션/전자제출 금지**.

**제품 인수 완료 0건.** 코드 존재/V8 합성 단위/전체 CI/staging D1·R2/Cron/실제 DOCX/공식서식 승인/법원 인가는 모두 다른 단계. 공개 Git에 실제 의뢰인 개인정보·원문 OCR 값·원본 문서·비공개 정답·키/.env를 사용하지 않음.
