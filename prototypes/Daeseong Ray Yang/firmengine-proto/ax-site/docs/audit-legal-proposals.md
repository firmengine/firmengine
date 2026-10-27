# 법률 제안 자동화 감사: living cost와 서울회생법원 제424호

검토일: 2026-10-27. 이 기능은 출처가 연결된 제안값을 채우고 결손을 드러낸다. 법률상 인정, 가구원 확정, 변제계획 인가 또는 인가확률을 산출하지 않는다. 합성 테스트는 코드 경계만 검증하며 99.0% 문서정확도 근거가 아니다.

## 자동 제안 경계

| 입력/결정 | 필요한 증거 | 계산·제안 | 차단 또는 사람 검토 |
|---|---|---|---|
| 신청연도별 기준중위소득 | 신청일, 공식 연도 표, 서울 관할 | 공개된 가구원별 중위소득 × 3/5를 정수 원 단위 중간값으로 계산하고 정확 소수액을 유지 | 신청일·관할·명시적 가구원 수가 없거나 표에 없는 연도/가구원 수면 blocked. 반올림 규정은 확인하지 못해 임의 적용하지 않음 |
| 가구원 수 | 현재 `household.recognizedMembers` | 제안 계산 입력만 사용 | `reportedMembers`로 대체하지 않음. 가구원 인정은 별도 법률검토 필요 |
| 추가 생계비 | `household.additionalLivingCost`와 현재 source-valid household fact | 기초 60%와 별도 표시 | 지속성·합리성·법원 인정은 별도. 누락은 0원으로 단정하지 않고 미확인 |
| 서울 §424 제2항 7호 후보 | 서울 관할, 2026-10-01 이후 접수, 임금 이력, 최저임금 판본, 총채무, 개인채권자/목록 완전성, 최근 1년 채무 | 각 근거가 verified+accepted이고 출처 계보가 유효할 때만 후보 경로 제안 | 7호는 네 조건이 누적. 어느 하나라도 unknown이면 후보판정 보류. 원문은 “최근 2년간 최저임금 미만의 급여를 받았을 것”; 현재 자동 월수 기준을 만들지 않고 `wholeTwoYearBelowMinimum`이라는 명시적 법률검토 결론이 source-backed/accepted된 경우에만 yes/no를 반영한다. 월별 자료는 검토 입력용이고 이 Boolean을 자동 산출하지 않는다. |
| 구 §424 후보 항목 1–6 | 기존 카탈로그 사실을 각각 명시적 근거로 검토 | 현재 wrapper는 명시된 catalog key 중 연령, 중증장애, 미성년 자녀, 한부모, 공식 임대차사기 결정을 조합해 unknown/yes/no 표시 | 이 매핑은 법적 항목과 catalog key의 연결을 검증하는 초안이다. 항목 1–6 전체 법문을 코드로 자동 확정하지 않으며 확인된 단일 yes는 사람 검토 후보만 생성. 이전 시행일은 `unsupported_version` |
| 변제기간·인가 | 접수일, 예외 사유, 법률·법원 판단 | 입력된 현재 계획개월 수를 표시 | 36/60개월은 이 패치에서 자동 제안하지 않음. 서울 예외 적용, 법 §614, 변제가능성, 최종 인가는 사람/법원 판단 |

## 사용 중인 원문과 반올림

- 보건복지부, [연도별 기준중위소득](https://www.mohw.go.kr/menu.es?mid=a10708010900): 2024–2027년 1–7인가구 값이 게시된 표를 사용한다. 2026년에는 1인 2,564,238원, 2인 4,199,292원, 3인 5,359,036원, 4인 6,494,738원, 5인 7,556,719원, 6인 8,555,952원, 7인 9,515,150원이다. 정확한 60%는 각각 1,538,542.8원, 2,519,575.2원, 3,215,421.6원, 3,896,842.8원, 4,534,031.4원, 5,133,571.2원, 5,709,090원이다.
- 서울회생법원, [실무준칙 제405호 §§2–4](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2): 신청 당시 기준중위소득 60%를 기초로 하고 지속적 주거·의료·미성년자 교육 관련 추가비용을 합리적 범위에서 고려하는 구조로 사용한다. 소수 금액의 법원 제출용 원단위 반올림 지침은 이 구현의 출처에서 확인되지 않았다. 계산은 반올림하지 않은 정확한 소수 제안으로 보존한다.
- 서울회생법원, [실무준칙 제424호 개정본](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2): 2026-10-01 시행본에 §2(2)(7) “최근 2년간 최저임금 미만의 급여를 받았을 것” 문언을 확인했다. 이 자료는 후보 경로용이며 §614 인가요건과 법원 판단을 대신하지 않는다. 이전 버전은 여기서 부정 판정하지 않는다.
- 국민건강보험공단, [사회보험통합징수포털 제증명 메뉴](https://si4n.nhis.or.kr/jpca/JpCab00103.do)에는 보험료 ‘미납내역서’ 및 ‘기타징수금 미납내역서’ 발급 메뉴가 있고, [보험료 고지/납부내역 안내](https://www.nhis.or.kr/static/html/guide/sub2_020302.html)는 월별 고지·수납·미납내역 확인 흐름을 설명한다. 확인 가능한 공식 안내는 미납 여부/내역 서비스 존재까지이며, 사용자가 지목한 미납보험료·연체금·미납액계·체납처분비 각 컬럼의 인쇄 화폐단위 표기 및 정확한 표준 서식 사양은 확인되지 않았다. 따라서 문서에서 단위가 명시되거나 공식 서식 사양으로 확인될 때까지 자동 원화 정규화를 하지 않는다.
- 채무자회생법 §579·§611·§614 등은 별도 법률 판단이 필요한 영역이다. 본 패치에서는 개인회생 가용소득, 세금·사회보험료 체납 우선순위, 변제기간 또는 채권 현재가치 할인율을 계산하지 않는다. 금리·할인율을 만들어내지 않고 법정 우선순위도 새로 추론하지 않는다.

## 실행상 연결과 한계

- 실행 모듈: `lib/living-cost-proposal.ts` (공식 표, 정확 3/5 비율), `lib/seoul424-candidate.ts` (시행일·관할 게이트와 누적조건), `lib/legal-proposals.ts` (현재 `CaseData`의 명시 키만 읽고 source lineage + verified/accepted 확인), `components/legal-proposals.tsx` (독립 읽기전용 패널).
- 카탈로그의 `KR-PR-042` 및 `lib/legal-exceptions.json`은 설명/테스트 자료다. 텍스트 카탈로그만으로 UI 실행이 되지는 않는다. 이 구현은 새 패널로 호출 가능하지만 route 연결은 별도 wiring이 필요하다.
- 사실이 없거나 중복된 current fact, 미검증/미수락 fact, 깨진 source lineage는 unknown으로 남긴다. 원문에서 해당 내용이 발견되지 않았다는 것만으로 “아니오”를 만들지 않는다.
- §424 제2조 제2항 제1·3호의 나이 문턱은 신청인 식별이 해소되고 `applicant.age`가 원문 검증되며 `asOf`가 신청일과 정확히 일치할 때만 객관적 나이비교로 yes/no를 제안한다. 이 객관적 비교에는 별도 법률수락 표식이 요구되지 않지만 출처검증과 신청인 subject ID가 필수다. broad existing `applicant.severeDisability`, `household.minorChildren`, `household.singleParent`, `rentalFraud.officialDecision` flags never substitute for legal-specific findings.
- 법률특정 경로는 `legal.seoul424.statutory_severe_disability` (§2(2)(2)), `legal.seoul424.raising_two_or_more_minor_children` (§2(2)(4)), `legal.seoul424.statutory_single_parent` (§2(2)(5)), `legal.seoul424.qualifying_article14_rental_fraud_causing_insolvency` (§2(2)(6))만 읽는다. 각 predicate는 신청인 subject, source-verified accepted yes/no 사실이어야 하며 위 표에 적은 법정 증명·요건을 확인한다. official victim decision alone is insufficient for rental-fraud route; resulting or threatened insolvency causation must be included in the dedicated legal finding. Each route remains visible with fact IDs, source article, status and required-proof text; missing/ambiguous route remains unknown and does not erase a separate known positive route.
- `debts.privateCreditors`는 존재/개수 의미로 처리하여 true/양수면 개인채권자가 있는 것, false/0이면 없다는 뜻으로 반전한다. `debts.lastYearDebt`는 최근 1년 채무 존재 여부이므로 true면 제외 예외를 확인하지 않는 한 7호 누적요건은 불충족, false면 충족으로 해석한다. 해당 키의 의미가 달라지면 카탈로그 별칭 검수 후 변경한다.
- 합성 경계 테스트 통과는 입력/분기 회귀 검증일 뿐, 실제 원문 OCR 성능/99.0% 목표/법률 정확성의 통계적 입증이 아니다.
