# FirmEngine A2 r128 — AX담당자: 원장 상태·미관찰 총계·우선채권 정책의 계산→검토 게이트

- **일시**: 2026-11-04 KST. **직전** r127 데이터담당자 → **이번** r128 AX담당자 → **다음** r129 IT담당자. GitHub main 감사 및 수정 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위뿐.
- 시작 main: `dcff48e459f65db7c9fc0a205f32f24d997112ee`. 영수증 직전 재조회 main: `dcff48e459f65db7c9fc0a205f32f24d997112ee`. 이전 [r127 영수증](2026-11-04_r127_1912KST_data-ledger-identity-sql.md), 최근 GitHub commits/PR #237/#239/#221, A2 통합보드 재독.
- 본문 소스 blob: `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, `lib/case-execution.ts` `752049c087cc28b2d713eafb5dc3f7294623e8ae`, `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`. 기존 `tests/repayment-plan-model.test.ts` blob `b5ba94a3264a42fcbda6135f6c59f4fdfb0d9988`.
- 기준정보 `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, 토큰 `lib/template-token-catalog.json` `899c4d564fcb1726861f89dcf04dbf1b7e372687`.

## 1. 실제 원본문 V8 격리 실행 54조건 — 제품 Node 전체 실행이 아님

GitHub main `reconcilePlanLedger()`의 실제 본문을 가져와 TypeScript 타입선언만 제거하고 V8 함수로 실행. `moneyValue`는 합성 금액의 안전한 bigint stub. 기간 36/48/60개월 × `ordinary/priority` × `complete/provisional/blocked` × `"1"/"0"/"1,20"` = **54건**. 각 월 1원일 때 독립 총계는 36/48/60원, 실제 관찰된 0원은 총계 0원, 우선채권 정책 입력은 **생략**, sourceIds는 SYN 구성. 모든 소득·채권·문서는 가상 데이터.

| 구분 | 독립 보수적 기대 | main 관찰 | 기술적 의미 |
|---|---|---|---|
| 36/48/60개월 완료 원장, 정상 1원 | 각각 36/48/60원 | 총액 일치, reconciled | 산술만 통과 |
| 명시적 0원 × 36/48/60개월 | 0원 유지 | 0원 유지 | 실제 0원과 null 분리 필요 |
| `provisional`, 정상 숫자(두 채권유형×기간×0/1) | 검토보류 | **12/12 reconciled** | 원장 검토상태 오승격 |
| 우선채권 정책 없음(기간×원장상태×0/1) | unknown·실무검토 | **18/18 covered** | 정책 승인이 아닌 산술만으로 covered |
| 금액 문자열 `1,20`(두 유형×세 상태×기간) | 차단, 예외 없는 오류 | **18/18 SyntaxError** | 값 검증 후 BigInt 예외, 기존 #43 등과 통합 필요 |

`complete`라는 합성 status 자체는 법률상 인가나 실제 검토 서명이 아니므로 통과 해석 금지.

## 2. PR 패치 반영 가정하에 같은 함수 독립 비교 48조건

**실제 병합/배포 아님**. main 본문에 PR #237 기간·일반채권 합계 검증, 그 위 #239 provisional 금지, 그 위 #221 정책명시 요구의 *명시적 diff 변경만* 임시 텍스트 적용. 36/48/60 × ordinary/priority × complete/provisional × `"0"/"1"` × 정책 absent/confirmed = **48건**. 관찰:

| 후보 (V8 격리) | provisional 중 reconciled | 정책 absent 중 covered | 정책 absent review-task |
|---|---:|---:|---:|
| main | 24/24 | 12/12 | 0/12 |
| #237 | 24/24 | 12/12 | 0/12 |
| #237→#239 | **0/24** | 12/12 | 0/12 |
| #237→#239 + #221 변경 적용 | **0/24** | **0/12** | **12/12** |

#221은 `priorityPolicies` 명시 시에만 `covered`; 그러나 **main의 `executeCaseNodes`는 `reconcilePlanLedger(data, calculation, planLedger)`만 호출하여 정책 옵션을 전달하지 않는다.** 따라서 #221 결합 시 우선채권 사건은 기본적으로 검토 필요로 남을 수 있다(보수적, 법률승인 미추론). 사람 관리 기준정보·판본·Fact·승인자를 연결하는 설계가 필요하다. #237/#239의 이력·변제기간 변경은 계산사무장·변호사 검토 전 병합하지 않는다.

## 3. 추가 P1 후보 — 계산 총액 null일 때 Plan gate 자체 생략

main `case-execution.ts` 원조건식:
`hasExplicitSchedule || baseAssessment.calculation.planTotalWon !== null`.
합성 `hasExplicitSchedule=false`, `planTotalWon=null`, 원장 행 존재/원장 blocked/우선채권 검토과제가 있어도 `planValidationApplies=false`이므로 **planBlockers=[]** (원본문 해당 세 줄의 JS 표현식 직접 실행). 이는 계획 검증 게이트의 특정 경로 누락이라는 뜻이며, **다른 baseAssessment/문서 preflight가 자동승격을 허용한다는 뜻은 아니다**.

- 합성 정상 `planTotalWon="0"`, provisional/우선채권 정책 없음: main planBlockers=[]; #239 결합 시 `PLAN_LEDGER_NOT_REVIEWED`; #221 동시 결합 시 `PRIORITY_COVERAGE_POLICY_REVIEW:SYN-D`까지 추가.
- 합성 `planTotalWon=null`, provisional, 우선채권 정책 없음: main 및 #237/#239/#221 결합 모두 planBlockers=[] — 별도 적용조건 결손.
- **수정안 [Draft PR #240](https://github.com/firmengine/firmengine/pull/240)**: `planFinalizationBlockers` 순수 helper 도입. 금액 null인데 원장행 존재하면 `PLAN_TOTAL_UNOBSERVED`, reconciliation blocked·정책 검토과제·미검토 명시적 일정 모두 별도 차단. `"0"`은 정상 관찰 0으로 유지. 별도 브랜치 `audit/a2-r128-ax-unobserved-plan-gate-20261104`; **main 제품코드 미수정**.
- #240 실제 GitHub 소스에서 새 helper 본문 TS만 제거한 V8 **12/12 조건 일치** (36/48/60×3 + 3 단독: null 원장행/명시 0/정책 검토/blocked-no-issue/정상 no-data/일정미승인). Node `node:test` 12건 + TODO 2개 소스 작성·커밋, **프로젝트 러너/CI 미실행**. 순수 helper 테스트는 통합 실행 증거가 아니다.
- **별도 회귀 위험:** 기존 main `tests/repayment-plan-model.test.ts`는 생성 원장 provisional을 `reconciled`로 단언. #239의 의미변경과 해당 assertion 충돌 예상; 통합 Node 실행 전 테스트 기대·업무 승인 재검토 필요.

## 4. 저장·계약·서식 범위

- live JSON 파싱: **18 계산모듈, 입력 선언 91(고유78), 출력 42(고유40), resultPaths 42**. D5103/D5106/D5110/D5111 **37/48/55/82 토큰**. 정적 계약만 확인; 실제 엔진 18모듈 수행/42 출력 SQL 재생/Word 토큰 대치·DOCX 재독은 이번 미실행.
- r127의 계산 raw/SQL ID와 원장 상태 분리 사실을 인계 확인: `case-calculation-feature-store.ts`는 원장 rows/status/reconciliation/policy approval을 별도 ID 재료로 저장하지 않음. 이번에 실 D1 쓰기, 원문→Fact→typed→SQL→문서 E2E는 **실행하지 않음**.
- `source-only`, `unknown`, `not_applicable`, `provisional`, `blocked`, 명시 `0`, `null`, 법률 승인 상태는 상호 대체하지 않는다.

## 5. 실제 공식 원문·법원·시행일 (2026-11-04 직접 조회)

- [서울회생법원 준칙 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2) **실제 화면 0-index p.271·272·391**: 2026-09-23 개정 제424호 제2조 제2항 제7호, **2026-10-01 시행**, **시행 이후 최초 접수 사건** 적용 및 기존 인가 효력 유지. 관할·최초접수일 Fact·판본·실무자 승인 없이는 사건 자동적용 금지.
- [채무자회생법 제611조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221) 및 [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 법률 제21490호 **2026-10-02 시행판** 개별 조문 확인. 우선채권 전액변제/기본 변제기간/수행가능·청산가치 등은 법률 판단이며 V8 결과와 무관.
- [국세청 부가가치세](https://d.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480): 일반과세자 6개월, 간이과세자 원칙적 1년. VAT/종합소득세의 월순소득·이중합산 본체는 이번 **미실행**, 신고매출을 월순소득으로 승인하지 않음.

## 6. 통합보드 ID / 조치 / 다음

- **A2-AX-004 [ ]**: `"0"`·null·blocked/provisional·unknown·source-only 분리. V8 54조건; 합성 금액 문자열 `"1,20"` 예외18건 별도 차단 필요.
- **A2-AX-015 [ ]**: 36/48/60×0/1 독립 원단위 기대, main 54조건 및 세 PR 분리/결합 48조건 직접 실행; 실행범위는 V8 원본문 및 diff 변환에 한정.
- **A2-AX-017 [ ]**: 우선정책 누락에도 `covered` 반환, 잠정원장 재대조, planTotal null로 plan 게이트 생략. 법률 승인 오해 금지. #240 Draft HOLD.
- **A2-AX-018 [ ]**: SHA·PR·입력·독립 기대·실측·공식 출처·미실행 단계 기록. 제품 최종 인수 0건.
- 다음 **r129 IT**: #240의 타입체크+실제 Node test, #237→#239+#221/#43 호환 및 기존 테스트 assertion 전수, `raw→Fact→typed→calculation→ledger→D1 SQL→D5110/11 DOCX` 동일 케이스 snapshot E2E; 법률/회계 승인, Staging D1/R2/Cron/실제 Word 바이트는 개별 분리.

**제품 최종 인수 0건.** 실제 프로젝트 Node 러너/전체 CI·staging D1/R2/Cron·공식 DOCX·법률/계산사무장/변호사 승인/사이트 배포 모두 미실행·미인증. 비공개 원천·고객 문서·키/.env·비공개 정답 공개 없음. 운영배포·운영 마이그레이션·전자제출·법원 인가 확정 **미실행**.

## 7. 중앙 보드 동기화 시도 결과 (후속 회차 필수)

중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 `A2-AX-004/015/017/018` **기존 항목을 보존해 각 ID에 r128 영수증 링크만 추가**하려고 파일 SHA `31b6361612312f3aa3e37578cf580f6196b66b37`을 먼저 확인했다. 그러나 보드가 약 643KB여서 GitHub 커넥터의 `update_file`에서 ReadTimeout/내부 오류, 대체 Git blob 쓰기에서도 내부 오류가 발생했다. 최종 재조회에서 원래 blob SHA가 동일하고 해당 ID에 **r128 본문이 아직 없음**을 확인했다. **따라서 중앙 보드는 이 회차 갱신 완료라고 주장하지 않는다.** r128 검증 사실과 A2-AX ID 매핑은 이 독립 영수증에 남았으며, 다음 회차에서 보드 충돌 없는 병합을 재시도해야 한다. 이 문제로 **체크박스는 모두 미완료 [ ]**, 제품 인수 상태 변동 없음.

미병합 #239에는 기존 테스트의 `generated/provisional → reconciled` 기대와 #239 변경의 불일치 가능성을 PR 댓글로 전달했다. 이것 역시 프로젝트 Node CI 실행의 대체가 아니다.
