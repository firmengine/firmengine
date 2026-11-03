# FirmEngine A2 r98 — AX담당자 / 제424호 증빙경계·현재가치 보류 독립감사

일자 **2026-11-03 KST** · 바로 전 r97 **데이터담당자** → 이번 **AX담당자** → 다음 **IT담당자**. 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부에 한함. 제품 최종 인수 **0건**.

## 1. 시작 기준과 읽은 실제 파일
- 시작 시 확인 main HEAD `953eba551ed0547d615c0adf170bf9a2c9136c8c`; 기록 전 재확인 HEAD `953eba551ed0547d615c0adf170bf9a2c9136c8c`. 최근 main에는 A1 r97 보드 보존병합, A3 r97 데이터 감사, A2 r97 데이터 영수증이 포함되어 있음.
- 인수보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`에서 A2 AX의 **A2-AX-006 / 007 / 017 / 018**를 우선 검토하고 직전 `docs/release-audit-runs/A2/2026-11-03_r97_1315KST_data-first-filing-and-pv-source-lineage.md`를 재독.
- main 원본문/Blob: `lib/seoul424-candidate.ts` `fb4f7f09e37e957481996304fbe4916764c8d7da`, `lib/legal-proposals.ts` `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`, `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`. `db/schema.ts`, `lib/case-feature-snapshot.ts`, `tests/legal-proposals.test.ts`와 기존 A2 r97, PR #18/#84/#209 자료 비교.
- 비교 Draft: #18 법원 관할 guard 브랜치 head `13642a552e9171879dea06522f568be11fe343c2`, 후보 함수 Blob `9c304f880a3fa16ac74e6127a3ad1bc0d9ce748d`; #84 PV 미승인 guard Blob `773b240ec48be94d34e8f25f1c5c16d509ce09de`. 두 PR 모두 미병합.

## 2. 실제 테스트 — 원본문 TypeScript 서명/타입만 제거한 격리 V8
보조 `referenceParameter*`는 **합성값**(관할 seoul, 시행 2026-10-01, 채무 50,000,000원, 최근 급여 2년, 최근채무 1년, 검토완료 Fact `SYN-*`)을 전달했다. 실제 DB/API/법률 승인 사실이 아님.

**제424호 메인 vs #18 (합성 10조건):** 독립 기대 일치 main **7/10**, #18 **9/10**. main에서 (1) 관할 `null` + 제7호 양성, (2) 관할 `null` + 제1~6호 양성 → 각각 후보로 오승격. #18은 두 경우 `unknown` 보존. 세 번째 반례는 제1~6호 `yes`이나 `factIds=[]`인 입력 → **main/#18 모두 `candidate_for_human_review`**. 유효 서울/타 관할/시행 전/당일/무효일자/임금근거 누락도 검사.

**새 Draft #217 수정 후보 (PR #18 위에 쌓임):** 제1~6호 긍정 route에서 사용 가능한 Fact ID가 하나도 없으면 해당 route를 `unknown`으로만 내림. 금액·법원·시행일·채권 산식과 독립 제7호 판정은 그대로 유지. 원본문 V8 격리 **9/9 독립 기대 일치**:
- source ID `[]`, 7호 경로 미확인: 독립 `unknown` / 부모 #18 `candidate_for_human_review` / #217 `unknown`.
- source ID `[" "]`, 7호 경로 미확인: 독립 `unknown` / 부모 #18 `candidate_for_human_review` / #217 `unknown`.
- ID `["SYN-reviewed-source"]`, source route `yes` → 정상 후보 유지. 제7호 전부 양성 + 제1~6호 증빙 누락 → 독립 제7호 후보 유지.
- 관할 `null` + 제1~6호 근거양성은 #18과 #217 모두 `unknown`. 정상 서울·시행 이전·무효/누락 날짜·부산 관할의 판정도 유지.
- 이 검사는 Fact ID의 **문자열 존재만** 확인한다. 실제 Fact 존재/동일 사건/원본/source SHA/법률 검토·실무 승인 여부는 확인하지 못한다. 그러므로 #217은 **Draft HOLD**.

실제 커밋: #217 코드 `41b63622930930efa3520689a77264c5a55296ae`, 회귀시험 작성 `c5ffb22d17bf0032ba62c6c900a25af6a882e4b5`. PR diff의 변경은 허용된 `lib/seoul424-candidate.ts`, `tests/legal-proposals.test.ts` **2개뿐**, PR의 base는 #18 (main에 제품 수정 없음). Node 회귀 테스트는 **작성했으나 실행하지 않음**; 전체 프로젝트 Node runner, tsc, CI 미실행.

**PV/청산가치 원본문 비교 (합성 9조건):** `assessment.ts` 실제 `liquidationComparison` 식을 실행, main **5/9** 독립 기대 일치 / Draft #84 **9/9**. 예: PV 150원·청산 100원이어도 PV 미검토 / 자산평가 미검토 / 자산 인정 미완료 / 자산 사유 존재의 네 경우 main `met`, #84 `unknown`; 정상 승인 PV150/청산100 → `met`, PV90/청산100 → `not_met`, 명시적 0/0 → `met`, PV null/평가일 불일치 → `unknown`. 이는 **수식 표현식 격리시험**이며 실제 `calculateCase()` 종단 실행/법률 판정 인증이 아니다. #84 미병합.

## 3. 최초 접수일·관할 원천 경계
실제 `buildLegalProposals()`: `context.applicationDate`를 직접 `evaluateSeoul424({ firstFilingDate: appDate||null, courtId: context.courtId||null,...})`로 전달하며 `court_scope`/`effective_date` 조건은 `factIds:[]`. `createCase()` 기본값 `applicationDate=asOf`, `courtId=seoul`; 이 값은 최초 접수 서류의 원천 Fact 증명이 아님. `2026-10-02`로 단순 채워 넣은 날짜와 실제 증빙 `null`을 분리할 도메인/담당자 승인 계약이 아직 없다. **제424호 자격 자동 승격 금지.** #217은 이 문제를 해결하지 않음.

## 4. 정적 산식/서식 계약 및 독립 산술
main `lib/reference-decision-tables.json` Blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` JSON을 직접 파싱하여 **18 모듈**, input 선언 **91/고유78**, output 선언 **42/고유40**, 결과경로 **42** 확인. `lib/template-token-catalog.json` Blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 파싱: D5103 **37**, D5106 **48**, D5110 **55**, D5111 **82**. 이는 **정적 수량 검증**, 출력토큰 실데이터 판독/원본→Fact→typed→SQL→DOCX 검증 아님.
- 독립 BigInt 산술 예시: 합성 월 900,000원 × 36/48/60개월 = **32,400,000 / 43,200,000 / 54,000,000원**(명목합계, 할인 PV가 아님).
- 범위 밖 과제: 급여/사업소득 11~12월/겸업/VAT·종소세 중복, 채권·청산·배분 42경로 실 SQL·Word E2E. 계산 값과 법률 인정은 별도.

## 5. 공식 원문 및 시행판 구별
- **서울회생법원**, 실무준칙 제424호 개정전문 **2026-09-23 개정** `https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2`, **인쇄 252·253쪽 및 372쪽 부칙 이미지 확인**. 제7호 네 누적 요건; **2026-10-01 시행**, 이후 최초 접수 사건부터 적용, 종전 이미 인가된 변제계획 효력에 영향 없음. 확인 가능한 조문 내용과 개별 사건의 증빙·관할·시행판 법률해석은 분리.
- **국가법령정보센터** `https://www.law.go.kr/법령/채무자회생및파산에관한법률/제611조` 및 `/제614조`. 법률 제21490호 **2026-10-02 시행판** 별도 구분(서울 준칙 10-01과 혼동 금지). 원문 링크의 동적 서비스는 이번 조회에서 조문 본문을 직접 표시하지 않아 **조문별 최신 전문 대조는 추가확인 필요**; 종전 감사의 법률 메타정보를 참고.
- **국세청** `https://j.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486`, 일반과세자 반기·간이과세자 연간 VAT 과세기간, 종소세 연간 기준을 직접 확인. VAT 신고매출/입금을 법원 인정 월순소득으로 자동 환산·결합하지 않음.

## 6. ID별 결과와 다음
- **A2-AX-006 [ ]** 법원 원문 PDF/부칙과 국세청 공식 안내 직접 확인; 법률 제611/614조 동적 전문 재조회 미완료. 출처·시행판 혼동 금지.
- **A2-AX-007 [ ]** 관할 null 후보 오승격 main 2건 (#18 보완), 긍정 category Fact ID 누락 main/#18 2건 (#217 격리 보완); 최초접수일 source Fact 무검증 유지.
- **A2-AX-017 [ ]** 미검토 PV `met` main 4건 재현(#84 보완), trace/source 검토와 최종 서식 사람 승인 독립 필요.
- **A2-AX-018 [ ]** 입력/독립 기대/관찰/브랜치/Blob/SHA/공식출처 위처럼 기록. 프로젝트 CI, D1, Word, 승인 영수증은 없으므로 합격 체크하지 않음.
- 다음 **IT담당자**: #217→#18, #84 및 #209 관련 병합·Node 프로젝트 테스트·SQL 계산판본/Fact 소유/법률 source SHA를 종단검증. 최초접수 증빙·법원 관할·PV 인정 계약은 변호사/계산사무장 실무 승인 전 HOLD. 공용 보드의 네 ID만 `[ ]` 유지·보존 병합.

## 7. 인수 게이트
**합성 V8 검사 통과 ≠ Node 테스트 통과 ≠ CI ≠ staging D1/R2/Cron ≠ DOCX/공식 법원서식 ≠ 변호사·실무자 승인 ≠ 법원 인가**. 전체 CI, 실제 SQL 42경로, 실제 DOCX 생성·재독, staging 시스템, 실무 승인 모두 **미실행/미인증**. 실고객 자료, 원본 OCR 사실값, 키/.env, 비공개 정답을 저장하지 않음. 운영 배포·운영 DB 마이그레이션·실제 전자제출·법원 인가 확정은 수행하지 않음.
