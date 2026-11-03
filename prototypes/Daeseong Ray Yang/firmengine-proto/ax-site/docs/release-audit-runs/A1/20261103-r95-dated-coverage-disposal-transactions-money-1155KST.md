# FirmEngine AX A1 — 95차 복수문서 기간·처분 조사·삼중 원화단위 감사 (2026-11-03 KST)

- **범위:** GitHub `firmengine/firmengine` / `main` 중 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위. 순환 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**.
- **시작 main HEAD:** `f73a59dbabe7358f1cb21c5ead9e38ee268428a4`; 시작 단일 보드 blob `5ac89b1c1b3bc708d8c7102e19563b60c136e415`. 94차·59차 영수증, 최근 GitHub commit/PR, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 상담카탈로그/결정표, 요구서류·처분·원화 소스와 기존 `tests/intake-workflow-domain.test.ts` 등 열람.
- **실행 경계:** GitHub 실제 함수 본문을 TypeScript 타입 표기만 제거해 Code Mode V8에서 합성 입력을 실행. 외부 의존성은 명시한 mock만 사용. **Native Node test/tsc/lint/build/CI/browser/staging D1/R2/Cron, 실제 서류/원문 OCR/실무자 승인 미실행**. 모든 ID **[ ] 유지**.

## A1-DOC-006 [ ] — 복수문서의 요구 기간과 실제 관측 월을 일치시킬 것

- **main 소스:** `lib/document-fulfillment.ts` blob `d8434f2b81fdfe79be6254714d8428dccf272214`; read-only 호출부 `lib/case-workflow-view.ts` blob `dc7f62f914e9496066ea7f8316229d8d123af4f5`.
- **재현 원인:** `deriveRequirementStatus`가 `requiredPeriod='2026-01~2026-12'`로 명시돼도 수집한 월의 **개수만** 비교하고 해당 월이 요구 기간에 속하는지는 검사하지 않는다. 외부 기간 12개월을 받으면 요청된 12개월을 완성한 것으로 표시한다. 기존 Draft #143의 타 문서 페이지 혼입 이슈와 **별개의 결함**.
- **독립 합성 11조건 (원본 함수·실제 두 GitHub blob 재조회 V8 실행):** main **5/11**, 수정안 **10/11** 독립 기대 일치. 합격: 2026년 12개월 단일문서, 1~6월+7~12월 문서 두 건, 진짜 6개월 부족, 1개월 공백, 무기준 `12 months`. main 불합격: 요구연도와 다른 2025년 12/13개월, 2025년 12개월+2026년 6개월, 미래 2027년 12개월, 2025년 하반기~2026년 상반기. 수정안은 해당 5조건을 `partial`로 보류. **양쪽 모두 불합격 1건:** 2026년 1~6월 + 5~12월의 부분중첩을 `complete`로 처리. 같은 월의 다른 사업장·계좌 증빙이 정상일 수도 있으므로 일률적인 자동 `conflict` 변경은 하지 않음.
- **수정 조치:** 별도 [Draft PR #216](https://github.com/firmengine/firmengine/pull/216), HEAD `159f9713cdbdc3987498b00661ab91add173225b`, 코드 blob `b60500ffbccc3dd786bcf63b2d24c4e38412dd71`, 회귀 테스트 blob `151600b530f5c630ab649d59e88f0392c769ae4a`. 명시적 유효 YYYY-MM~YYYY-MM 요구기간이면 요청된 개별 월을 기준으로 수령 상태 판정, 무기준 `12 months`는 기존 단순 길이 정책을 유지. 실제 커밋된 본문을 재조회하여 위 **10/11** 확인. 신규 **Node 테스트 6건 파일 작성·커밋만 완료, Node 실행 안 함**. 직원 확인·법률인정·정규화 Fact 승격 없음.
- **남은 리스크:** 부분 중첩, full-date(-DD) 요구기간 문자열, 85서류 실제 업로드·A←B+C 갈음·C01/C02/C04·staging D1 통합, 기존 #143과의 동일 파일 통합. PR은 Draft/미병합.

## A1-LAW-007 [ ] — 처분·증여·편파변제 후보 조사 사실을 비해당 판단의 판본에 연결

- **소스:** `lib/disposal-applicability.ts` blob `f707de8b34e5e06ff56e87435389a4de8879304f`; `lib/domain.ts` Transaction `kind: 'asset_disposal'|'debt_payment'...`, `lib/transaction-review.ts` blob `5a16674a2bfb2694c4c0c440b44a1f87e6fe619c`. `lib/reference-intake-catalog.json` blob `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`의 INTAKE-044·045, `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`의 WF-40·41 확인.
- **실제 V8 합성 8조건:** 현행 원본 `disposalApplicabilityBasisFingerprint` + `evaluateDisposalApplicability` 사용, `currentFacts(data)=data.facts`, `currentReferenceSnapshot()=null`은 명시적 합성 대체. 원래 빈 자산 목록·완전성 `yes`·내부 검토영수증 `confirmed` 상태를 가정. 기준불변 `confirmed`, 검토대기 `candidate`, 검토자 미기재 `candidate`, inventory 미완전 `stale`, 자산 추가 `stale`, asOf 변경 `stale`: **6개 기대 일치**. 그러나 `transactions`에 합성 `kind='asset_disposal'` 수입행 또는 `kind='debt_payment'` 지급행을 새로 추가해도 **basisFingerprint 불변, 'not applicable' 내부 confirmed 유지**: **2개 기대 불일치**, 최종 **6/8**.
- **독립 기대:** 새로운 처분 거래나 선택적 상환 검토 후보가 들어온 경우 재조사·`stale` 또는 별도 의심 검토가 필요. 다만 `debt_payment` 자체가 곧 편파변제라는 뜻은 **아님**. 함수의 자산원장만 기준으로 하는 계약이 이 거래검토 체인과 의도적으로 분리됐는지 실무자 검토 필요. 이 기록의 `confirmed`는 내부 '비해당 검토 영수증' 상태이지 부인권·처분 적법성·법원 승인 상태가 아니다.
- **코드 조치:** 없음. 법률 판단 범위와 저장된 영수증의 실효성/무효화 정책 변경이므로 별도 고위험 이슈로 기록하고 LAW/AX/DATA 실무자 승인을 요구. 수정을 위해 운영 main 변경하거나 검토의미를 임의 승격하지 않음. **실제 95법률 분기·원문 증빙·D1 사건·법원서식 미검증**.

## A1-DATA-006 [ ] — 원문 숫자·Fact numeric·typed numeric 단위 일치

- **소스:** main `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`. 기존 [Draft PR #86](https://github.com/firmengine/firmengine/pull/86) 코드 blob `4847da1410d09191558b40e6e4c5d9d7d8db5e4e`.
- **실제 `normalizeMoney`+`moneyValue` V8 독립 합성 12조건:** main **8/12**, PR #86 **12/12** 기대 일치. 주요 반례: 원문 `1원` 선언 `만원` → main `10000` + `exact` (독립 기대 null/invalid); 원문 `1원` 선언 `천원` → main `1000`; 원문 `1 KRW` 선언 `만원` → main `10000`; 원문 `0원` 선언 `만원` → main `0` exact (독립 기대 단위상충). 원문 `0원`/단위 KRW는 명시적 0 유지, null은 missing, non-KRW는 review_required, 소수 KRW는 review_required, 단위없음 `2`·만원은 20000 등 정상 보존.
- **실제 `sourceFactMoneyValue` 삼중 대조 추가 1조건:** 원문 `1원` + sourceUnit `만원` + numeric.amountWon `10000` + typed value.amount `1원`/unit `만원` → main **10000 반환(불일치)**, PR #86 코드로 재실행 **null 반환(기대 일치)**. 본 조건은 합성 증빙 검증이 아닌 함수 계약 관측이며 실제 Fact 저장/typed object 수정 여부는 입증하지 않음.
- **코드 조치:** 중복패치 없음. PR #86 Draft·미병합; 실제 OCR page values/lineage·85문서/693필드·18계산/95법률·법원 제출값 검증 미완료. source-only/null/0/not_applicable/conflict/승인전 구분을 별도 유지.

## 최종 A1 인수 게이트와 다음 순환

- **A1 DOC/Law/DATA 모두 [ ] 미완료**, 제품 종단 통과 **0건**. 이번 main 실행 코드 수정 **없음**. 신규 Draft #216의 제품 코드+Node 회귀 테스트만 격리 브랜치에 커밋.
- **다음 회차 역할:** IT담당자 **A1-IT-006**(부모·자식 문서 철회 시 page_jobs 중단), AX담당자 **A1-AX-006**(공식 법률 조회 실패 시 검토보류), 계산사무장 **A1-CALC-006**(채무 원금·이자·비용·담보·보증 구성행).
- **불포함:** Node test/tsc/lint/build/전체 CI, 브라우저, staging D1·R2·Cron, 실제 고객 사례·OCR, 85종 실제 문서, 18계산/95법률 종단, 공식 법원 서식·변호사 승인, 운영 배포/운영 D1 마이그레이션/실제 제출·인가. 실제 Extra High 추론 모드 확인 불가.
