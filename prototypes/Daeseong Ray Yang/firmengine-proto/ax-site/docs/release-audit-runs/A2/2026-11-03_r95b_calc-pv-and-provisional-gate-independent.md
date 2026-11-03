# FirmEngine A2 r95b — 계산사무장 독립 PV·변제원장 최종 게이트 교차검증 (2026-11-03 KST)

> **범위/안전:** firmengine/firmengine main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 소스만 읽고 A2 체크 `A2-CALC-027`, `A2-CALC-028`을 부분 감사. 직전 A2 r94 사용자·서류담당자 → 이번 계산사무장. 공개 고객자료/OCR/개인정보/키/실정답 미사용. 법률·계산사무장 승인 전 모든 확정값 미인증. 기존 Draft 변경/운영 배포/D1 이관/전자제출 없음.
>
> **시작 main HEAD:** `2f185650aee92b8d9ecac493cc6fccac60d5c629` (2026-11-03 01:55:06 UTC). 당시 중앙 보드 blob `e3b4b9d5e2c0e06424cc9cd58441e8a197b77b24`; 수정 전 재조회 필수. 최근 main A1/A3/A4 감사 커밋과 A2 r94 영수증 및 Draft #212, #215, #84, #194, #203 재독.

## 1. 실제 코드/기존 테스트/스키마 판본

- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5` (PV 입력 및 `liquidationComparison`, `trace.status`, `Finding(liquidation)`), `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`(`moneyValue`/원화 정규화).
- main `lib/legal-calculation-readiness.ts` blob `9edab755df5adae5f143d15285c550feb0e0f6d5`; 기계식 산식 검토는 법원의 인가가 아님. `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980` 및 `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3` 원문 확인.
- 기존 미병합 [Draft #84](https://github.com/firmengine/firmengine/pull/84)는 이 PV review 미승인 `met` 문제를 다룬다. PR이 현재 **mergeable=false**여서 현 main 반영 증거 없음.
- [Draft #215](https://github.com/firmengine/firmengine/pull/215) head `aaef95f63150596538a4f0fa95278ca2c6d2d5c8`, 소스 blob `lib/case-execution.ts=eacdee216d0b1c77474f44efe7991ffaa33dd7e3`, `lib/office-writer.ts=b5cfe0541b2b1dda176c362ad25846469292b20f` 및 테스트 `4b4dca7e3ffe129548d538fae665b0b49d8cff25` 직접 열람. #215는 변제원장의 `provisional`를 final blocker로 전달하는 후보이지, PV·법률 승인을 바꾸는 PR은 아님.
- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 계산 **18모듈 / 입력 91 선언(고유 78) / 출력 42 선언(고유 40)** 정적 재파싱. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: 등록 토큰 **D5103 37 / D5106 48 / D5110 55 / D5111 82** 정적 재파싱. 실제 모듈·SQL 저장/재조회·DOCX 토큰값 실행은 별개 미완료.

## 2. 실제 수행한 독립 테스트 / A2-CALC-027 (PV 계산 근거)

Node **v22.16.0** 로컬 격리환경에서 GitHub main `assessment.ts` PV·청산가치 비교 표현식 및 명시적 검토 상태 분기를 추출·타입 분리 후 실행(합성 `NumericInput`의 `amountWon`/KRW/exact 등만 사용). **12/12 기술적 동작 재현 / 0 FAIL**. 테스트는 실제 프로젝트 전체 import가 아니며 합성 Node 단위 재현임.

| SYN typed 조건 (합성 금액·상태) | 독립 기대: 승인상태 유지 | main 관찰: 숫자비교 / trace | 판정 |
| --- | --- | --- | --- |
| PV 근거 문구 공백 또는 PV null, 청산 100원 | 수치 미관찰, 0으로 대체 금지 | `unknown / blocked` | 기술 일치 |
| PV 90원, 청산 100원, 양쪽 검토 true | 수치 미달, 법적 결론 아님 | `not_met / calculated` | 기술 일치 |
| PV 110원, 청산 100원, 양쪽 검토 true | 수치 충족, 법적 결론 아님 | `met / calculated` | 기술 일치 |
| PV 명시적 0원, 청산 명시적 0원, 양쪽 검토 true | 0원 보존 | `met / calculated` | 기술 일치 |
| PV -1원 | 음수 미적격, 0 대체 금지 | `unknown / blocked` | 기술 일치 |
| PV 150원, 청산 100원, 자산 평가일 불일치 | 기일 미확정 | `unknown / provisional` | 기술 일치 |
| **PV 150원, 청산 100원, PV·자산 모두 미승인** | **승인전 `unknown` 필요** | **`met / provisional`** | **승인 분리 결함 후보** |
| **PV 150원, 청산 100원, PV만 미승인** | **`unknown`** | **`met / provisional`** | **동일** |
| **PV 150원, 청산 100원, 자산만 미승인** | **`unknown`** | **`met / provisional`** | **동일** |

나머지 입력은 PV=청산 및 청산 null 경계. 이 12/12 수치는 **기존 코드가 위와 같이 동작한다는 재현 건수**이지 법률상 기대와의 12/12 합격이 아님. 현재 main `assessCase`의 `Finding(liquidation)`은 `liquidationComparison==='met'`이면 `pass`가 될 수 있다. 별도 `trace.status=provisional`과 final gate가 존재하여 실제 최종 제출 통과는 관찰하지 않았음. 정식 PV 할인율, 기준일별 지급흐름, discount factor, 법원 적용일은 이번 실행에서 **수치적으로 계산되지 않았고 source-only/검토전**으로 남음. 명목 원장 `36/48/60 × 900,000원 = 32,400,000 / 43,200,000 / 54,000,000원`은 독립 정수곱일 뿐 할인 PV나 법원 인정액 아님.

## 3. Draft #215 release blocker 별도 교차 실행 / A2-CALC-028 참고

#215의 `planBlockers`와 `planIssues` **실제 분기 표현식**을 원문대로 분리 복사해 Node v22.16.0의 `node --test`로 실행: `[36,48,60] × 7합성 조건 × 2게이트` = **42 PASS / 0 FAIL / 3 TODO(미실행)**. 합성 reviewed-complete, provisional-no-issues, blocked, provisional+법률 HOLD, 비해당, 명시적 검토전, 원화 0와 null 분리 포함. 이것은 **완전한 프로젝트 러너로 실행한 테스트가 아니며**, `planValidationApplies`를 fixture로 주입했으므로 실제 계산 실행/저장 판본/원천 Fact/서식/Word 검증이 아님. [PR #215 독립 검토 댓글](https://github.com/firmengine/firmengine/pull/215#issuecomment-6593807734)에도 분리 기록함.

**결론:** `A2-CALC-027` PV 산식/할인 기준 **[ ] 미인증**; `A2-CALC-028` 미승인값 `met` 승격 **[ ] 미인증**. 새로운 법률 자동규칙 적용 금지. `0`/null/미관찰/비해당/상충/source-only/승인전 모두 별도 상태 유지. 숫자/기준월/원천/법률 인가를 단일 PASS로 취급하지 않음.

## 4. 공식원문 확인 — 고정된 날짜와 관할 분리

- [서울회생법원 2026-10-01 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 제424호 제2조 제2항 제7호 **신설**; 공지일과 사건별 준칙 적용일·부칙 경과조치는 다름. 개정전문/PDF 법률 적용 검토·변호사 확인 **미완료**, 자동규칙으로 쓰지 않음.
- [국가법령정보센터, 2026-10-02 시행 법률 제21490호 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): 변제기간·현재가치/청산가치·인가요건은 산술 계산만으로 충족 확정 금지. 시행일과 개별 사건 적용일 구분.
- [국세청 부가가치세 과세기간](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272): 일반과세자 통상 반기, 간이과세자 통상 연간. VAT/종합소득세 신고액은 승인 없이 인정 월순소득으로 환산·중복합산 금지.

## 5. 후속 담당자·검증 단계

1. [#84](https://github.com/firmengine/firmengine/pull/84)의 미승인 PV 비교 `unknown` 후보와 #215 provisional ledger final HOLD를 **상호 충돌 없이** 별도 브랜치에서 통합; 실제 Node TS/18×91×42 계산·원장 / D5103-D5110-D5111 생성·ZIP/XML 재독 및 staging D1/R2/Cron 별도 시험.
2. 법정 3년/최대5년 특별사정(법 제611조), 법 제614조 PV의 인가결정일·채권자 동의·청산배당 등 자료와 실무자 기준·기일·출처 관리. 공식 서식 버전·변호사 승인 전 제품 최종 인수 0.
3. **다음 역할: 변호사**(이 회차 계산사무장). #215/#84 PV·법률 release 계약을 실제 사건 판본/동일 사건 Fact ID·승인 상태까지 연결해 판단. 제품 main/운영 배포, D1 마이그레이션, 전자제출·인가 확정 실행하지 않음.
