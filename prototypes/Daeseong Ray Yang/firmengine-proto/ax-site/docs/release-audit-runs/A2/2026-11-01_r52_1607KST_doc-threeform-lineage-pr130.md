# FirmEngine A2 r52 — 사용자·서류담당자: D5103/D5110/D5111 사전검증과 소득 Fact 계보의 합성 충돌 해소 후보

- 기준 시각: 2026-11-01 KST, 이전 r51 IT담당자 → **이번 r52 사용자·서류담당자** → 다음 r53 계산사무장.
- 허용 Git 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 만. 감사 시작 시 GitHub main HEAD **`4dca208f4db798fd019f3048d7e2aa28db5d9342`**, 영수증 작성 직전 main HEAD **`4dca208f4db798fd019f3048d7e2aa28db5d9342`**.
- PR 기준: Draft #129 HEAD **`7b39ca3ab308d472aaa4891b4b1b9eefa90f24e3`**; #129 preflight blob `315dde15a255ca5af248dcd6ec7cee2797496726`, 별도 Draft #106 preflight blob `9f7e39159a635e3ec678b40ddd31e6a0cc001130`.
- 보드의 **A2-DOC-004 / A2-DOC-005 / A2-DOC-015 / A2-DOC-016** 4개를 우선 점검. 각 항목은 **[ ] 미완료/부분 검증**, 이번 실제 법률·계산·제품 인수 **0건**.

## 1. 실제 원본 비교와 충돌

#129는 D5103 월행의 내부 5필드 `source_id, source_stream_id, source_fact_ids, source_review_status, source_calc_role`를 `UNKNOWN_ROW_TOKEN` 검사에서 예외로 보존하나, #106의 D5103 승인소득/0행/월공백 및 D5110/11 별도 승인·숫자 가드는 여전히 #129에 포함되어 있지 않았다. #106 파일만 그대로 덮어쓰면 반대로 #129의 내부 계보 필드를 알 수 없는 row token으로 차단한다. 두 Draft의 실제 함수 소스를 직접 읽어 비교했으며 **main 제품 코드는 해당 어느 기능도 포함하지 않음**.

## 2. 독립 합성 입력/기대/관찰 — 소스 본문 V8 격리

실행 방법: #129 원본 및 #106+계보허용 통합 후보의 `evaluateDocumentPreflight` 실제 함수 본문에서 TypeScript 타입 표기만 제거하고 V8에서 실행. 입력 계약 목록은 합성 mock `FORM_CONTRACTS`, 내부 `reviewLegalPlanArithmetic`은 이 단위 경계를 관찰하기 위한 빈 issues mock, SHA digest는 격리 stub. **정식 Node/TypeScript 프로젝트·계산 18모듈·실제 파일 렌더링은 실행하지 않음.**

| 가상 시나리오 | 독립 기대 (내부 검토만) | 원본 #129 관찰 | Draft #130 후보 관찰 |
|---|---|---|---|
| D5103 월 관측 2,400,000원/승인금액 [확인 필요], final | 승인보류 blocker | 해당 코드 누락 | `D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED`, blocked |
| 같은 D5103, draft | 경고+미완료 상태 | 경고코드 누락 | warning, draft_with_unresolved |
| D5103 승인금액 존재/월별행 0, final | 누락월 증빙 차단 | 해당 코드 누락 | `D5103_MONTH_ROWS_MISSING`, blocked |
| D5110 관측/월 변제 900,000원·승인소득 미관찰, final | 승인 보류 | 해당 코드 누락 | `PLAN_APPROVED_MONTHLY_INCOME_UNRESOLVED`, blocked |
| D5111 위와 동일, final | 승인 보류 | 해당 코드 누락 | 동일 blocker, blocked |
| D5110 위와 동일, draft | 경고+미완료 상태 | 해당 코드 누락 | warning, draft_with_unresolved |
| D5110 월 변제액 -900,000원 | 음수 검토 | 해당 코드 누락 | `PLAN_SCALAR_NEGATIVE_INVALID`, blocked |
| D5111 월 변제액 `9,00` | 숫자형식 검토 | 해당 코드 누락 | `PLAN_SCALAR_NUMERIC_INVALID`, blocked |
| D5110 채권 원금 `BAD` | 채권자 숫자 검토 | 해당 코드 누락 | `PLAN_CREDITOR_ROW_NUMERIC_INVALID`, blocked |
| D5103 미등록 `month.unexpected` | unknown token blocker | blocker | blocker 유지 |
| D5103 내부 5개 Fact 계보 key | unknown token 오탐 금지 | unknown 없음 | unknown 없음 |

**후보 실제 격리 11/11 독립 기대 일치.** 기존 #129에서 이 중 새 필요한 gate 9개 누락. 승인·관측·0/null/법률인정은 서로 다른 상태이며, 숫자를 임의 보정하거나 법적 인가로 승격하지 않음. 새 Node 회귀 **6 그룹 테스트 소스 작성·커밋, 실행하지 않음**.

## 3. 수정/커밋/출력 경계

- 새 별도 **Draft PR #130**: https://github.com/firmengine/firmengine/pull/130 (base Draft #129, 제품 main 미병합), head `bfe5ac4e3ed55611a8cca1e6febd1b3581ecc30a`.
- 코드 커밋 **`8a471ea825d1913b79c99ea4fb236504752ed809`**: `lib/document-preflight.ts`에 #106의 내부 숫자·소득 게이트를 #129 내부 계보 필드 허용과 비파괴 결합. **Draft warning 코드가 있음에도 `status=ready`였던 추가 불일치**는 초안 `unresolved`로 기록해 `draft_with_unresolved` 반환하도록 제안.
- 테스트 작성 커밋 **`bfe5ac4e3ed55611a8cca1e6febd1b3581ecc30a`**, `tests/a2-r52-lineage-three-form-preflight.test.ts`, 6 그룹, 프로젝트 러너 **미실행**.
- PR 변경 2개 파일 경로 모두 ax-site 아래로 GitHub PR 파일목록 직접 확인. 기존 PR #106/#129 소스 및 다른 에이전트 브랜치는 덮어쓰지 않음.
- **중요:** V8 모의 입력에서 `preflight`가 expected blocker/warning인지 확인한 것이며 `prepareDocumentWrite` 전체, `calculateCase()`, DOCX 바이트, staging D1/R2/Cron, CI 성공과 절대 동등하지 않다. 실제 D5110/11 단독문서 생성 여부도 종단 미관찰.

## 4. 저장 스키마·산식 계약·독립 수치

GitHub main 재파싱: `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`의 **18 계산모듈/입력 선언 91(고유 78)/출력 선언 42(고유 40)/resultPaths 42**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`에서 **D5103/D5110/D5111 등록 토큰 37/55/82**. 정적 계약 수량일 뿐 실제 91 입력·42 출력 전수 실행 아님.
- 실제 main `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`의 `value_json`, `value_won`, `status`, `source_fact_ids_json` 등 저장 분리 확인. 이번 회차 SQL INSERT/SELECT 및 D1 재조회 **미실행**; 0/null/미관찰/status 상충 입력은 스키마 수준에서 보호된다고 주장하지 않음.
- 합성 급여 **2,400,000원×12개월=28,800,000원**; 합성 사업 순소득 **1,000,000원×11개월=11,000,000원**; 합성 관측합계 **39,800,000원**. 사업 12월은 **미관찰**, 1,000,000원을 0원 또는 확정값으로 바꿔 총액 40,800,000원이라고 단정하지 않음. 실제 산식 계산모듈 실행 결과도 아님.

## 5. 공식 법령/법원·세무 원문과 사건 적용 경계

1. 국가법령정보센터 [채무자 회생 및 파산에 관한 법률 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777) 및 [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **[시행 2026-10-02, 법률 제21490호, 2026-03-24 타법개정]** HTML 원문 확인. 변제기간/재산소득·인가요건은 내부 증빙 완결과 별개의 법률 판단. 사건 기준시점·법원별 적용은 변호사 검토 전 미인증.
2. [서울회생법원 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187) **작성 2026-10-01**, 제424호 제2조② **제7호 신설 공지** 원문 확인. 첨부 개정전문 PDF/부칙·경과조치·사건별 시행/적용일은 **이번 회차 미검증**. **공지일을 자동 사건 적용일로 사용하지 않음**.
3. [국세청 2026-11-01 확인 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 원칙 **반기**, 간이과세자 원칙 **연간** VAT 과세기간, 종합소득세 별도 신고. VAT 총매출/세액/종소세 소득을 월별 사업 순소득·법원 인정액으로 자동 변환하지 않음.

## 6. ID/인수상태/다음 검증

- **A2-DOC-004 [ ]** D5103 승인 월액·원천 0행·내부 Fact 5필드 인터페이스의 V8 후보 검증; 실제 수입/지출·생계비·공식서식 미인증.
- **A2-DOC-005 [ ]** D5110/11 월변제액 음수/오인식·채권자 원금 숫자 및 승인 월소득 검토; 변제기간 36/48/60, 전체 채권자 배분·원화 잔여·Word 미실행.
- **A2-DOC-015 [ ]** 세 서식 final 미확정 소득 차단과 draft 경고상태를 격리 관찰; 실제 서류 API/요건별 필수첨부·최종 렌더러·공식서식 인수 미실행.
- **A2-DOC-016 [ ]** 명시적 0과 미관찰/승인전은 분리해야 함을 전제로 V8 예시 작성. Node test의 0/missing 구별은 작성만 하여 미실행, SQL·DOCX 값은 미검증.
- **다음 r53 계산사무장:** PR #130과 #129/#106 의존·중복을 통합 Node 테스트로 검증. 원문→Fact→typed→18모듈→42출력→SQL 저장→D5103·D5110·D5111 실제 금액·토큰 E2E, 급여12+사업11·이직6+6의 별도 승인기간, 0/null·VAT/종소세 중복/채권잔액·청산가치·36/48/60변제 배분. 법률상 유효기간·서식 공식성 및 전문직 승인을 반드시 별도 단계로 남김.

**제품 인수 완료 0건.** Node/CI, staging D1/R2/Cron, 공식 Word 양식/변호사·계산사무장 승인, 법원 인가 및 실제 사이트 배포 모두 미인증·미실행. 운영 배포·운영 마이그레이션·전자제출 금지 준수.
