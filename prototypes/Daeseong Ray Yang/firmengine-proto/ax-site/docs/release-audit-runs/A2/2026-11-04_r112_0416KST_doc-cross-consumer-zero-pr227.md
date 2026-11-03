# FirmEngine AX / A2 r112 — 사용자·서류담당자, 변제원장 월액의 서식 소비처 교차독립감사
작성: 2026-11-04 KST (04:16 시작) · 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만 · 제품/법률 인수 **0건**
주요 ID: `A2-DOC-005`, `A2-DOC-015`, `A2-DOC-016`, `A2-DOC-018` (모두 [ ]).

## 1. 실제 읽은 저장소와 인수 기준
- 시작 및 변경 직전 main HEAD: `af1e582ad406e7e056586a94d525ef99ef4675af`; 본 영수증과 보드 업데이트의 부모 커밋. 기존 보드 blob: `51b80add6a2abe60bb07a67640cd16bed8306eef`, tree: `da0163059ff7defe13100bd71099bf86e5fe01c3`. 다른 에이전트 변경을 덮지 않고 네 ID 문장만 덧붙임. r111 IT 영수증과 이전 r106 서류 영수증, 현존 Draft #223/#225/#226 및 main 원본 코드, SQL 0011을 읽음.
- main 실소스 blob: `lib/form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; `lib/document-annexes.ts` `9041330c95858390647d355cc3d1cbdbcab76b47`; Draft #223 annex `f96fad1409a3681fffb5789a49e6a572a89ffb7c`; `lib/office-writer.ts` `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`; `lib/exports.ts` `699411b5b20a4a4558761d3015d8827797c7991f`; SQL `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`. Draft #227 새 branch만 제품코드 변경, main 계산/서식 제품 파일 불변.
- 정적 계산 기준 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18모듈/입력91선언(고유78)/출력42선언(고유40)/resultPaths42**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5106 48 / D5110 55 / D5111 82**. JSON 파싱/정적 목록으로 확인했을 뿐 18모듈·91입력 전부를 실행하거나 DOCX 필드를 재독한 것은 아님.

## 2. 원본 계산 부속 함수 vs #223 실제 V8 격리검증 (각각 33조건)
실제 GitHub 함수 `repaymentPlanLedgerAnnex`를 TS 인수 주석만 제거해 V8 격리 실행. 36·48·60개월 × 11조건. 월 1원 관측시 독립 원금 합계 36/48/60원; 명시 0원인 경우 0원 유지. 반환 `source_backed`는 **코드의 표시상태**로서 법률상 인정이나 공식서식 적합을 뜻하지 않음.

| 합성 입력 | 독립 기술 기대값 | main 실제 | Draft #223 실제 |
|---|---|---|---|
| 정상 36/48/60월, 월 원금1원 | 합계 36/48/60, source_backed | 일치 | 일치 |
| 관측한 원금0원 | 관측 0원을 그대로 표시 | 일치 | 일치 |
| `reconciliation=blocked` + 가짜 합계 `0` | 합계 [확인 필요], blocked | **0원 표기** | 보류 |
| 원천 36/48/60원, 저장 총계0, 가짜 reconciled | blocked | **source_backed 0원** | 보류 |
| `ledger=blocked` + 계산 숫자 유효 | 합계 [확인 필요], blocked | **합계 36/48/60원 정상 대조처럼 표시** | 보류 |
| 첫 원금 `1,20` 또는 이자 `null` | 예외 없이 blocked | **SyntaxError/TypeError** | 보류 |
| 중복 회차·누락월·0회차·분류별 합계 불일치 | blocked | **source_backed 오판** | 보류 |

**독립 기대 일치: main 6/33(실행 예외6건 포함) vs #223 33/33(예외0).** 이는 V8 함수 격리만. #223은 기존 부모 #50 위에 쌓인 Draft이고, 실제 Node 프로젝트 러너/Word/DB E2E 미실행.

## 3. 신규 교차 소비처 반례 — D5106/D5110 등 creditor.monthly_payment
main `form-mapping.ts`에서 `rows.creditor[*].monthly_payment` **실제 IIFE 본문**을 실행(타입 파라미터만 제거, synthetic `ledger` 및 `reconciliation`). 36/48/60개월 × 7조건 = 21조건.

| 합성 입력 | 독립 기대값 | main 관찰 |
|---|---|---|
| 매월 1원 정상 36/48/60회 | `"1"` | `"1"` |
| `ledger=blocked` / `reconciliation=blocked` | `[확인 필요]` | `[확인 필요]` |
| 원천 지급 36/48/60원인데 reconciliation 총액 `"0"`로 stale, status만 `reconciled` | `[확인 필요]` | **`"1"` 허위 검증표시** |
| 36/48/60회 중 1회만 존재, status `reconciled` | `[확인 필요]` | **`"1"` 허위 검증표시** |
| 첫 지급 원금 `"1,20"` | `[확인 필요]` | **SyntaxError**, 예외 미보호 |

**main 12/21 독립 기대 일치, 6건 잘못된 월액, 3건 실행 예외.** 원장부속 #223만 수정해도 이 다른 소비처 결함은 남음. `office-writer.ts`의 final gate/generation/readRenderedDocx는 **코드 정적 확인**, 실제 writer/Word 생성 및 readback **0건**.

## 4. 수정 제안과 테스트 영수증
- **[미병합 Draft PR #227](https://github.com/firmengine/firmengine/pull/227)**, branch `audit/a2-r112-doc-form-monthly-arithmetic-20261104`, 커밋 `00107cb54f67e7d15a17bda39123bbb55ee729fb`.
- 수정 파일 ax-site 내부 **3개만**: `lib/form-mapping.ts` (표시용 월액 IIFE를 guard로 교체), `lib/plan-form-monthly-guard.ts` (신규, null/0/정형 문자열·배분/기간/분류별 합계 확인), `tests/a2-r112-monthly-form-consistency.test.ts` (신규 합성 테스트).
- `node --experimental-strip-types --test tests/a2-r112-monthly-form-consistency.test.ts` 명령을 **Node v22.16.0 standalone 모듈 트리(동일 기능 신규 소스)**에서 실제 실행: **42 PASS / 0 FAIL / 0 SKIP**, 36/48/60개월 × 14시나리오. 유형: 정상 1원, 명시 0원, blocked ledger, blocked reconciliation, stale total0, 누락월, `1,20`, null, 승인전 legalReviewTasks, 누락 budget, 회차 불균등, 알 수 없는 claimClass, 회생위원 보수 trustee_fee, 복수채권자. 결과는 **격리 Node 테스트**, GitHub checkout의 전체 프로젝트 러너/CI 통과가 아님.
- 금액 재계산 산식/법원 기간·채권 법률인정 정책/입력 Fact/DB/배포 **변경하지 않음**. `null`은 미관찰·무효·상충·승인전 등을 포함할 수 있는 출력 보류 신호이며 실제 `0`과 다름. 기술적 `reconciled`와 법적 `approved`는 전혀 동의어가 아님.

## 5. 공식 법률·국세청 원문 검증과 인증 경계
- 서울회생법원 2026-10-01 공식 발표: 제424호 제2조 제2항 **제7호 신설**, [보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187). 개정전문 PDF/부칙 **이번 r112 직접 재독 안 함**. 이전 r108의 시행후 **최초 접수 사건** 원칙과 본 감사의 원문 재열람 범위를 구분. `applicationDate`를 첫 법원 접수확인일로 간주하지 말 것.
- 국가법령정보센터 [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR): **2026-10-02 시행, 법률 제21490호** 원문 직접 재조회. 총변제액·배분·청산가치 및 인가요건은 단순 산술 대조와 별개.
- 국세청 [부가가치세 개요](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272) 직접 재조회. VAT 신고매출·종합소득세 신고 금액은 법원의 인정 월 순소득과 다르며 자동 승인 금지.

## 6. A2-DOC ID별 실제 결론과 다음
- `A2-DOC-005` **부분 [ ]**: 36/48/60 변제 월액/합계 재대조; main 6/33, #223 33/33, 법률상 변제기간 승인은 미인증.
- `A2-DOC-015` **부분 [ ]**: 원장 표의 표시 보류와 채권자 월액 칸의 검증 부족을 분리. main 다른 소비처 12/21, PR #227 표시 방어 제안; 실제 생성보류 E2E 미확인.
- `A2-DOC-016` **부분 [ ]**: 실제 0원 및 placeholder 0원 분리, 비정상/미관찰/null/승인전은 표시 보류.
- `A2-DOC-018` **부분 [ ]**: D5103/06/10/11 **정적 토큰 수만 확인**, 실제 Word 파일 숫자/행/문단 바이트 재독 및 법원 공식 양식 동등성 **0건**.

**다음 r113 계산사무장:** #227+기존 #43/#50/#203/#222/#223 통합 충돌 및 계산/서식 부속 동시 검증, 36/48/60 월별 복수채권 원금·이자·비용 보존, typed Fact→SQL 0011→42 output→D5103/06/10/11 실제 readback, 법원 최초접수 Fact/승인계보. 전체 Node 프로젝트 러너·최신 CI·staging D1/R2/Cron·Word/PDF 공식 서식·실무자/변호사 승인·운영 배포/전자제출/법원인가 **전부 미실행/미인증**.
