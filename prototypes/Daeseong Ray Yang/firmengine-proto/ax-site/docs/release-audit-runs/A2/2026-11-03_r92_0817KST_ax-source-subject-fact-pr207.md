# FirmEngine A2 r92 — AX담당자 / 서식 계산계보의 빈·중복 Fact 및 대상자 일치성

- 기준일: 2026-11-03 KST. 역할 순환: r91 **데이터담당자** → r92 **AX담당자** → r93 **IT담당자**.
- 허용 영역: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 최초 조회 main HEAD `d113f0f64e0408c5da05058a0309b6aa02621d11`; 영수증 쓰기 직전 HEAD `d113f0f64e0408c5da05058a0309b6aa02621d11`.
- 기준 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (이전 blob `1a0c59fd3eb807d8e3c5e7b5acbcba7f05b7f5b0`), 체크 `A2-AX-004 / A2-AX-009 / A2-AX-017 / A2-AX-018` 모두 **[ ] 부분검증**.
- 직전 r91 [영수증](2026-11-03_r91_0724KST_data-fact-lineage-owner-pr205.md), Draft [#205](https://github.com/firmengine/firmengine/pull/205) head `997b6ce96bb19580c0e628395d85d4f62bdbcf04`, 원본 `lib/lawgraph-document-field-projection.ts` blob `a017294aa814f4d33360c2531abf91d9eb79a6e0`, #205 blob `d8044d1186289c6e89030cdd645a34d16fb0b2f1`를 실제 fetch. Schema `drizzle/0011_case_calculation_features.sql`, 피처 저장 `lib/case-calculation-feature-store.ts`, 실제 projection 테스트 및 기존 테스트 영수증 대조.
- 본 회차 후보 **stacked Draft [#207](https://github.com/firmengine/firmengine/pull/207)**: `audit/a2-r92-ax-lineage-subject-nonempty-20261103`→#205 브랜치. 변경 source blob `7ae803bc9b3de2f0865969c9b07c9ea9971f6475`, synthetic test blob `1f682129dd3128bc02e749a781ef3e7ce8867d72`, head `95c430d42a72d30c8de6372946db4bb921ea8399`. **main 제품 소스 무변경, PR 미병합·HOLD**.

## 실제 검증: raw/Fact/typed/SQL feature → 출력 서식
실제 production 함수를 GitHub main/#205에서 취득해 TypeScript 타입 주석만 제거한 V8 Function 격리 실행. `FORM_CONTRACTS`(D5103 `monthly_income`/D5110 `creditor.principal`), `BASIC_FORM_CODES`, `currentFacts`, `factSourceLineageIssues`, `requiredKindsForCase`는 테스트에서 **명시적으로 합성 mock** 사용. **전체 프로젝트 Node/SQL API/DOCX는 실행하지 않음.**

- 합성 원문 표시 `1,000원`/저장 원화 `"1000"`, 명시적 `0원`/SQL식 `"0"`, 미관찰 `null`; 합성 typed `sourceFactIds`의 적격 F1/빈 배열/중복 F1/타 사건 가상 ID/공백 ID, 계산 원천 `subjectId`의 동등/타대상/누락을 분리. `36/48/60`개월 각각 12조건(총 **36 기술조건**), 독립기대 status와 source 원본문 결과를 비교.
- **#205 원본 24/36 기대 일치**, 나머지 **12건 잘못된 `linked_calculation`**: 매 기간 빈 `[]`·중복 `[F1,F1]`·scalar 다른 subject·채권 repeat-row 원천 subject 누락 각각 1건.
- **#207 후보 36/36 독립 기술기대 일치**(격리): 이미 적격 F1을 가진 동일 subject는 `linked_calculation`, 부적격/빈/중복/대상상충은 `lineage_review_required`, null은 `missing_value`. 기존 원문 `value` 및 calc ID 참조는 **수정하지 않고 유지**, 법적 승인/실제 근거 존재로 해석 금지.
- 수정: `r.subjectId===subjectId`를 정확히 요구; `sourceFactIds`가 배열이 아니거나 **빈 배열/중복/앞뒤 공백/현재 사건 적격 Fact 아님**이면 기술적 승인표시 대신 수동검토로만 분기. SQL schema/산식/실제 채권 인정액 변경 없음.
- 주의: `0원`은 명시값, `null`은 미관찰, `[]`은 원천미확인이지 `0` 또는 법률상 비해당이 아님. `source-only`, `not_applicable`, 보류/상충/미래월/법률 승인전 구분은 전체 E2E 미검증.
- 신규 `tests/a2-r92-ax-source-subject-lineage.test.ts`: 36·48·60개월×4그룹 = **12 Node 테스트 선언 + 3 TODO 작성·커밋**, **실제 프로젝트 Node 러너 미실행**. GitHub commit status **0건**, 해당 PR head Actions `workflow_runs=[]`; CI PASS 주장 금지.
- 독립 원단위 산술(계산엔진이 아닌 BigInt): 가용소득 900,000원×36/48/60개월 = 32,400,000 / 43,200,000 / 54,000,000원. 0×각 기간=명시적 0. 단, 채권별 배분·청산가치/세액/법적 기간 판정은 검증하지 않음.

## 스키마/계약 및 통합 충돌 HOLD
- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 독립 파싱: **18 calculations, 91 declared inputs (unique 78), 42 outputs (unique 40), 42 resultPaths**.
- main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5110 55 / D5111 82** 토큰. 정적 계약만 확인.
- 상충: [#195](https://github.com/firmengine/firmengine/pull/195)의 합성 테스트는 `data.facts=[]`, `sourceFactIds=[SYN-FACT-1]`을 `linked_calculation`으로 기대하나, r91/#205와 r92/#207은 **법적·자료적 원천 미확인**이므로 review가 기대값. 실제 Node 테스트 병합 시 기대수정·원천검증이 필요.
- [#100](https://github.com/firmengine/firmengine/pull/100) 승인전/철회 원천 경고, [#195](https://github.com/firmengine/firmengine/pull/195) 잘못된 원화 문자열, [#198](https://github.com/firmengine/firmengine/pull/198) SQL 디코더, [#199](https://github.com/firmengine/firmengine/pull/199) list readback, [#205](https://github.com/firmengine/firmengine/pull/205) Fact 인정 대조는 **서로 다른 변경/일부 같은 코드 지점**. PR #207 단독 병합 금지, 통합 전 실제 Node 전체/18×91→42 결과·SQL Fact/run 소유/정확한 문서 토큰 재독 필수.
- #198 디코더가 정상 SQL JSON 배열 `[]`을 타입상 허용하는 것은 의도적. 그러나 **법원서식 `linked_calculation` 승격은 별개의 문제**로 검증근거 없으면 #207에서 review.

## 공식 원문·관할·시행일 (법률 인증 아님)
- 서울회생법원 2026-10-01 [공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187) 직접 열람: 실무준칙 제424호 **제2조 제2항 제7호 신설**. 첨부 개정전문 PDF **직접 열람/부칙 검증 안 함**; **서울** 관할과 사건 시점 적용일은 변호사 확인 필요. 자동규칙 변경 금지.
- 국가법령정보센터 [2026-10-02 시행, 법률 제21490호 제611조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221), [제614조](https://www.law.go.kr/LSW/lsLinkProc.do?joNo=061400&lsNm=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0&mode=11) 공식 조문 직접 열람. 3년 원칙/특별사정 5년 이내 및 인가요건을 단순 36/48/60 산술 통과와 혼동하지 않음.
- 국세청 [부가가치세 신고 안내](https://j.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486) 공식 원문: 일반과세자 6개월·간이과세자 통상 1년. VAT 공급가액/세액·종소세 신고액은 **법원 인정 월순소득으로 자동변환 금지**. 세무/법률 실무 인증 전.

## 다음 r93 (IT담당자)
1. #207/#205/#195/#100/#198/#199를 단일 임시 테스트 브랜치에서 충돌 해소하되, 격리 통과를 합격으로 바꾸지 말 것. 예상 불일치인 #195 테스트를 최신 원천 인정 계약으로 수정하는지 검토.
2. 실제 프로젝트 Node 러너 및 TypeScript 검사, SQL 계산 피처의 run/case/revision 소유·Fact 존재/인정·0/null/중복/미래월 E2E, 18모듈/91입력/42출력 재독.
3. D5103/D5110/D5111 실제 DOCX ZIP/XML, 공식 법원서식과 실무자 검수, staging D1/R2/Cron 각각 별도 영수증. 모든 미검증 ID [ ] 유지, **제품 최종 인수 완료 0건**.
4. 개인정보/실사건/OCR 정답/env/key를 GitHub에 저장하지 않음. 운영 배포·운영 DB migration·전자제출·법원인가 **실행하지 않음**.
