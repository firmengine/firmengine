# FirmEngine AX A2 r127 — 데이터담당자: 원장 상태와 SQL 계산피처 실행 ID의 독립성 검사

- 수행일: **2026-11-04 KST**. 역할: r126 변호사 → **r127 데이터담당자** → 다음 r128 AX담당자. 작업 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만.
- 최초/커밋 전 main: `a5565a2ab0681bbce06a167757d7e01ee46ef094` (이번 commit 직전 재조회 `a5565a2ab0681bbce06a167757d7e01ee46ef094`). 기존 [r126 영수증](2026-11-04_r126_law-provisional-ledger-pr239.md) 및 중앙 보드 A2-DATA ID 재독. 최근 A1/A3 main 기록과 Draft #239(부모 #237) 상태 확인.
- 실제 main 소스 blob: `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/case-execution.ts` `752049c087cc28b2d713eafb5dc3f7294623e8ae`, `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`, `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`. 기존 `tests/repayment-plan-model.test.ts` 및 `tests/case-calculation-feature-store.test.ts` 재독.
- 기존 Draft [#237](https://github.com/firmengine/firmengine/pull/237), [#239](https://github.com/firmengine/firmengine/pull/239), [#221](https://github.com/firmengine/firmengine/pull/221)와의 의미 및 충돌 경계 검토. 모두 이 회차에서 **병합하지 않음**.

## 1. 핵심 관찰: 계산 SQL 영수증은 변제원장 상태의 독립 영수증이 아님

실제 `calculationFeatureRows(execution)`은 `execution.assessment.calculation`, `execution.proposals`, `courtApprovalInferred`에 대한 feature만 생성한다. `execution.planLedger`·`execution.planReconciliation`의 월별 행·원천 sourceIds·상태·재대조 사유를 별도 feature로 만들지 않는다. `persistCaseCalculationFeatures()`의 `rawResultJson`도 정확히 `{calculation:e.assessment.calculation,proposals:e.proposals,courtApprovalInferred:e.courtApprovalInferred}`이다. `runId`는 동일한 `caseId/dataVersion/caseRevision/inputSha256/ruleReleaseId/reference/contractVersion/sourceHeadsSha`와 **이 rawResultJson의 SHA-256**에서 도출한다.

따라서 **상기 ID 재료를 고정한 합성 실행 두 개**에서 계산·proposal 값은 같고 원장의 `provisional/complete/blocked`, 재대조 `blocked/reconciled`, 원장 금액·sourceIds·우선채권 coverage 또는 `generationGate`만 바뀌면 **저장용 계산 run ID 및 raw_result_json은 같다**. 이 관찰은 실제 사건 inputSha가 달라지는 경우에도 동일 ID가 발생한다는 뜻이 아니며, **계산 feature API가 원장 독립 승인증빙이 될 수 없다는 데이터 계보 범위 결손 후보**다. 실제 운영 E2E 손상은 미입증.

반면 `case-execution.ts`는 원장 및 재대조를 실행 응답에 포함하고 최종화 게이트에 일부 사유를 연결한다. 따라서 “SQL 계산피처에 없다”와 “최종 생성이 무조건 통과한다”는 **동의어가 아니다**. 기본 원장 `provisional`이 `reconciled`로 승격되는 문제는 앞선 r126의 #239에서 분리해 검토 중이며, 이번에 별도 법적 승인규칙을 작성하지 않았다.

## 2. Node 22.16.0 실제 독립 실행: 원본문의 저장 raw/ID 산식을 직접 이식

입력은 전부 `SYN-case`, revision 7, dataVersion 4, 64자리 합성 input/source SHA, `planTotalWon="36"`, 1회차 원금 `"1"`, 기술적으로 미검토한 원장이다. 실제 `case-calculation-feature-store.ts` 115·122행의 `rawResultJson`과 `runId` 표현식 및 `stable()` 순서를 그대로 이식해 **Node crypto SHA-256**으로 실행하였다. 전체 모듈 import나 실제 `persistCaseCalculationFeatures()` 제품 함수 실행은 아니다.

| 변형 (모두 baseline 비교) | 독립 기대: raw/ID 동일 여부 | 실제 Node SHA-256 관찰 |
| --- | --- | --- |
| 원장 `provisional` → `complete`, 재대조 `blocked` → `reconciled`, generationGate 변경 | 동일 (해당 필드가 저장 재료 밖) | **동일** |
| 원장 `provisional` → `blocked` | 동일 | **동일** |
| 우선채권 coverage `unknown` → `covered` | 동일 | **동일** |
| 원장 첫 행 금액 `1` → `2` | 동일 | **동일** |
| 원장 sourceIds `[]` → `["SYN-other"]` | 동일 | **동일** |
| proposals 후보 상태 변경 (양성 대조) | 달라짐 | **달라짐** |
| 계산 총액 36 → 37 (양성 대조) | 달라짐 | **달라짐** |

**7/7 독립 기술 기대와 일치.** baseline 합성 run ID: `calculation-4abae99b049f412c924062ad128e4c5ca5c0c44d17f8f8dd9b51fa2a8f3ca34c`; baseline raw SHA-256 앞16자 `f069f00415b9f208`. 36원은 테스트 입력이지 법원의 인정 변제액이 아니다. 입력 SHA까지 바뀌는 실제 원천 정정 상황의 ID 중복은 실증하지 않았다.

## 3. Migration 0011 SQL 저장형식 실측

GitHub 0011 DDL의 3개 계산 테이블과 합성 부모 `cases`를 SQLite **3.46.1 in-memory**로 구성, `PRAGMA foreign_keys=ON`. 합성 1 run / 5 feature / 1 head를 INSERT→SELECT; FK 위반 0. 재독 결과:

| output_name | value_json | value_won | status | 관찰 |
| --- | --- | --- | --- | --- |
| planTotalWon | `"36"` | `36` | computed | 수치 저장 |
| observedZeroWon | `"0"` | `0` | computed | 명시적 0과 NULL 구분 |
| missingWon | `null` | NULL | missing | 미관찰 금액 |
| blockedZeroWon | `"0"` | `0` | provisional | 승인 전 잠정 0과 계산된 0 별도 status |
| sourceOnlyWon | `"100"` | `100` | conflict | 상충 상태와 금액 공존 가능; 법률 승인 아님 |

`raw_result_json`에는 원장/재대조가 없고, 0011 테이블에 이를 위한 별도 전용 column이 없다. **스키마 허용을 제품 의미 적합으로 승격 금지**: 마지막 두 행은 제품이 생성했다는 증빙이 아닌 DB 계약 실험용 합성 row다. 실제 Fact FK, 소유자, 승인 기록은 이 시험에 포함되지 않았다. 실제 staging D1·전체 Node CI·문서 바이트 재독 미실행.

## 4. 기준정보·서식 계약 정적 검사

main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` JSON 파싱: **18 모듈 / 91 입력 선언(고유78) / 42 출력 선언(고유40) / 42 resultPaths**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` JSON 파싱: **D5103 37, D5106 48, D5110 55, D5111 82 토큰**. 42 출력경로를 모두 계산/DB/DOCX로 재생한 것이 아니므로 **정적 일치만** 인증.

## 5. 공식 출처 재확인 / 법원과 시행일

- 서울회생법원 [공식 보도자료(2026-10-01)](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187) 및 [제424호 공식 실무준칙 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2) **PDF 0-index 271, 272, 391 화면 직접 재독**: 2026-09-23 개정, **2026-10-01 시행**, 제2조 제2항 제7호 신설, 시행 후 최초 접수 사건 적용·기인가 효력 유지. 관할/최초접수증 원천 Fact·사람 승인 없는 사건 자동 적용 금지.
- 국가법령정보센터 [제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **법률 제21490호, 2026-10-02 시행판** 직접 재조회. 611조 변제계획·우선 채권 전액변제·기간, 614조 공정/형평/이행가능/청산가치 인가요건. SQL `computed`와 법원 인가 무관.
- [국세청 VAT 공식 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 6개월/간이과세자 원칙 1년, 세금 신고매출을 자동 월순소득 산정·이중합산하지 않음. VAT/종합소득세 계산 본체는 **이 회차 미실행**.

## 6. 중앙 보드 ID · 수정 · 후속

- **A2-DATA-015 [ ]**: reference SHA·sourceHeadsSha 포함 저장 ID 재독; 원장 정책/승인/재대조 판본은 이 계산 run ID에 독립 반영되지 않는 조건 확인. 승인·시행일/관할 추적 미인증.
- **A2-DATA-017 [ ]**: 현재 계산 output 경로와 원장 `sourceIds`·월별 행 별도 SQL-feature 미수록 확인. 42개 outputPath의 실제 저장/재생·실행 엔진/DOCX 미인증.
- **A2-DATA-018 [ ]**: sourceId→원장→D5110/D5111→SQL 계산 feature 연결이 이 feature 저장 함수에서 닫히지 않는 정적 경계 확인. 다른 원장 저장소·최종 문서 게이트 전체를 부정하지 않음.
- **A2-DATA-024 [ ]**: Migration 0011 SQL 1run/5feature/1head 저장 재독 및 FK 0; 원장 상태/검토가 raw_result_json과 별도 column에 없음을 확인. 실제 D1, raw/Fact/typed/Word 종단 미인증.
- **코드 수정 없음 / 신규 PR 없음.** 기존 #237/#239/#221은 법률/데이터 계약 및 실무자 검토 전 Draft HOLD. 데이터 계약을 임의로 확대하면 run ID·API·다운스트림 의미가 바뀌므로 자동 병합 금지.
- **다음 r128 AX담당자**: 원장 독립 불변 영수증이 필요한지 설계 결정(원장 상태/행/시점/원천/정책/검토자/해시 및 case revision), #237→#239와 #221/#194/#203의 실제 Node 통합검증, 원장 및 SQL feature + D5110/D5111 DOCX 한 사건 동일 스냅샷 대조. 36/48/60개월 다채권·0/null/미래월·비정상 BigInt 실행 확대.

**검증 단계**: 실제 원본문을 옮긴 Node 격리 7/7; 0011 동형 SQLite 합성 5행; 정적 18/91/42와 37/48/55/82 확인; 프로젝트 Node 테스트/전체 CI/staging D1·R2/Cron/공식 Word 원본 대조/법률·계산사무장·변호사 승인/배포 전부 미실행·미인증. **최종 제품 인수 0건.** 실제 고객·OCR 사실·키/.env·비공개 정답 공개 없음. 운영 배포·운영 DB 마이그레이션·전자제출·법원 인가확정 미실행.
