# A2 2차 — 서울 제424호 미확정 관할 후보승격 반례·서식 월귀속·VAT·OCR 상태 감사

- 작성: **2026-10-30 14:11~ KST**. 점검 착수 main `74e9266e9cc5d698c177b6e6c8d7a2b13e13dd54`, 회차 보고 시 재확인 main `74e9266e9cc5d698c177b6e6c8d7a2b13e13dd54`.
- 대상: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **하위에 한정**. 이전 A2 1차의 source money 결함 Draft PR #13은 병합하지 않고 그대로 보존.
- 검토 ID **5개**: `A2-LAW-016`, `A2-AX-004`, `A2-DOC-004`, `A2-DATA-020`, `A2-CALC-006`. 법률/AX/서류/데이터/계산사무장 관점 순환. **통과 체크 0개**: 전부 부분 실행 및 정적/공식 대조로, 전체 Node/실제 DB·Word 출력·법률 승인 미인증.

## 1. 확인된 P0 결함: 관할 null에도 서울 제424호 후보로 잘못 승격

- 소스 `lib/seoul424-candidate.ts` 원래 blob SHA `fb4f7f09e37e957481996304fbe4916764c8d7da`, `evaluateSeoul424()`의 `court_scope` 상태는 null 관할을 **unknown**으로 남기지만 반환 최종분기는 제2조 제2항 1~6호 중 하나 또는 제7호 네 조건이 긍정이면 **candidate_for_human_review**를 반환했다.
- 이 모순은 관할 확정 전 서울 전용 단축기간 후보를 긍정으로 보여줄 수 있다. **자동 인가/법률 확정이 실행된 증거는 아님**. 법률상 후보 사전추천의 게이트 결함이다.
- 합성 원본 (개인정보 없음): `courtId=null`, `firstFilingDate=2026-10-27`, category route 하나 `yes` 또는 제7호 4조건 전부 sourceValidated/legallyRecognized `yes`, 참조기준 서울·2026-10-01·채무상한 50,000,000원. **독립 기대** 둘 다 `status=unknown;route=null`; **변경 전 실제** 둘 다 `candidate_for_human_review`. `court_scope=unknown`과 결과가 충돌.
- 반례 포함 총 8개 분기: 미확정 관할 제1~6호, 미확정 관할 제7호, 서울 정상 제1~6호, 서울 정상 제7호, 부산, 2026-09-30 이전 접수, 접수일 null, 미확정 관할/개정 전 접수. **기존 함수본문 격리 V8 6/8 기대일치 → 수정 함수본문 8/8 기대일치**. TypeScript 타입 주석만 제거하여 V8에 원본문 함수를 실행하고 공식 참조조회/월급증빙 helper를 합성 stubs로 고정했다. **프로젝트 Node 직접실행/CI 아님**.
- 수정 **Draft [PR #18](https://github.com/firmengine/firmengine/pull/18)** `audit/a2-seoul424-unknown-court-20261030-1411`. 함수가 후보를 반환하기 전 null 관할이면 진단 conditions를 보존한 `unknown` 반환. `tests/legal-proposals.test.ts`에 제1~6호/제7호/서울/부산/시행경계 실제 Node 회귀 테스트 소스 추가. 커밋 `8b1286dc13adcec85c49dc8f83858e65b049b63f`(함수), `13642a552e9171879dea06522f568be11fe343c2`(테스트). **최신 CI/배포 검증 없이 main 병합 금지**.
- 범위 한계: `courtId=""`나 생략(undefined) 등 타입계약 밖 입력은 별도 입력검증 확인 필요. 실제 사건에 적용할 법률전문가 최종 승인 필요.

## 2. OCR 0/null/unknown/비해당·상충 상태 — A2-AX-004, A2-DATA-020

- `lib/field-observation.ts`의 원본 `observeField()` 함수 body를 외부 field binding 참조만 stubs로 고정해 격리 V8에서 실행. **8/8 기대 일치**:
  1. `present + "0"`→`present/value_read`, 0원 관측 보존
  2. `unknown + null`→`unknown/uncertain`
  3. `not_seen + null`→`not_seen/not_observed`
  4. `explicit_none + null` + 원문위치/인용→`explicit_none/source_empty` (사건 법적 비해당 승인과 다름)
  5. `explicit_none`의 인용/위치 누락→`unknown/uncertain` + `state_anchor_missing`
  6. `present + null`→`unknown/uncertain` + `present_without_value`
  7. `blank + "0"`→`unknown/uncertain` + `state_value_conflict`
  8. `conflicting + "500"`→`conflicting/conflict`.
- **미인증**: OCR 프로덕션 모델 응답과 typed DB insert/reload, `Fact.numeric`까지 실제 상호대조, 최종 Word·D1 상태. 기존 [PR #13](https://github.com/firmengine/firmengine/pull/13)의 원문·typed 불일치 수정은 아직 별도 draft이며 유효하다고 가정하지 않음.

## 3. D5103·D5110 서식 원천/월별 값 — A2-DOC-004

- `lib/form-mapping.ts::exactSourceCalendarMonth()`의 실제 함수 body 격리 V8 테스트 **8/8 기대 일치**: 2026-10 전체월, 2026-02 평년, 2028-02 윤년은 월로 인정. 연간총액/월중 입사·부분월/월말 미충족/존재하지 않는 2월 30일/unknown basis는 **null** 반환, 단일 월 수입 행으로 승격 금지.
- 정적 연결: `buildFormBindings()`는 `calculation.incomeRows`에서 월별 기간이 실제 완전 월일 때만 `rows.month[].net_income`을 출력하며, `monthly_income`, `approved_monthly_income`, `monthly_business_income`을 별도로 관리한다. `document-preflight.ts`는 D5103 월귀속/금액 미확정 때 final blocker 코드를 둔다. 실제 `D5103/D5110` Word 매핑 및 제614조에 맞춘 공식 제출서식 동등성은 별도 인수.
- **주의**: 해당 Word render는 D5110 일부 토큰을 관측 월수입·기본 가용소득 설명으로 변경한다. 현 단계에서는 법원 공식양식의 기재원칙 충족 또는 승인된 소득값만 기재됐다고 **단정하지 않음**. 기존 `approved_monthly_income` 게이트와 document-preflight/최종 법률 승인 E2E가 별도로 필요하다.

## 4. VAT 세액과 사업 원가·순소득 경계 — A2-CALC-006

- 실제 `lib/business-net-reconciliation.ts::sourceFact()` 원본 함수 body를 격리 V8로 실행, 외부 canonical/lineage helper만 stubs: `gross_amount` 비용 후보는 수용, 같은 행의 `tax_component`(`input_vat`)를 비용 행으로 주입하면 `BUSINESS_SOURCE_FACT_NOT_VERIFIED`로 거절. **2/2 기대 일치**.
- 같은 소스 `preflightBusinessNet()`에서는 비용을 `COST+"gross_amount"` 전용으로 받으며 `input_vat` 등 추가 금전 항목은 별도 원문 검산용으로 보존한다. `totalCost`가 VAT 세액을 자동 차감하지 않는 코드 구조 확인. 기존 `tests/business-net-review-lifecycle.test.ts`에서 정식 영업소득 월별 결과/서식 검증 소스 존재 확인(이번에 Node 미실행).
- **독립 산술 기준 예시**: 2026-10 합성 매출 3,000,000원, 적격 필요경비 1,000,000원, 매출세액 300,000원, 매입세액 100,000원 → 세무상 부가세 납부세액(단순 일반과세 예시) 200,000원과 `매출-적격경비=2,000,000원`이라는 *서로 다른 연산*이다. 실제 적격경비 인정·법률상 변제재원 채택은 회계/변호사 독립 승인 전 미확정. **고객/운영 값 아님.**
- 국세청 공식 안내는 일반과세자의 VAT `매출세액−매입세액`과 간이과세자 별도 산식을 구분한다. 국세청 https://sc.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272 및 https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 (2026-10-30 확인). 이 경계가 **18계산/91입력·실제 D1 DB/서식**에서 지켜진다는 포괄적 증명은 아직 없다.

## 5. 공식 법률·실무준칙 원문 및 적용일

- 서울회생법원 [공식 실무준칙 통합 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2), **PDF 272쪽(0-index 272), 제424호 제2조 제2항 제7호**: 최근 2년 최저임금 미만 급여, 총채무 5,000만원 이하, 개인채권자 없음, 최근 1년 채무 없음(물품구입 신용카드채무 제외) **전부** 필요. 제2조 제3항은 법원 재량과 전체 사건 고려를 보존.
- **같은 PDF 392쪽(0-index 391) 부칙(2026.9.23.)**: 2026-10-01 시행, 그 이후 **최초 접수되는 사건부터 적용**, 시행 전 인가된 변제계획 효력 보존. 현재 프로그램의 `firstFilingDate` 확인이 필요하며 관할 미확정에 서울 기준 적용 불가.
- 국가법령정보센터 채무자회생법 시행 판본 **2026-10-02 / 법률 제21490호(2026-03-24 타법개정)**: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027010029 . 법률 판본과 준칙 적용일은 별개의 기준이며 사건 시점 별로 검토한다.
- **법원 전자소송 공식 D5103/D5110 최신 레이아웃·서식 필수값/2026 이후 운영 화면은 이 회차 미인증**. 기존 DOCX 템플릿 복원은 공식 법원 접수 가능성의 증거가 아니다.

## 6. 현재 결과·코드 변경·다음 ID

- 격리 실행 총 **26개 합성 판정**: 제424호 경계 8/8(수정 전 6/8), 0/null/비해당 상태 8/8, 월별 서식 귀속 8/8, VAT 금액 역할 2/2. **합성 body 실행에 한정**. Node 전체·실제 D1/R2/SQL round-trip·Word/PDF·18모듈/91입력 전수·법원 전자소송·변호사 독립 검토 **미실행**.
- GitHub **Draft PR #18**만 신규 코드 수정, main 소스 코드는 그대로 둠. 다른 PR #12–17을 임의 병합하지 않았음. head 브랜치 실제 2파일 diff만 확인했고, 해당 커밋에는 CI workflow/status가 보고되지 않음.
- **다음 ID 제안**: `A2-IT-015`(SQL D1 insert/read와 JSON typed round-trip), `A2-DATA-016`(18모듈·91 선언·고유 78입력), `A2-CALC-021`(별제권 부족액/채권 중복), `A2-DOC-015`(법원 서식의 확정·미확정 필드), `A2-LAW-020`(공식 서식 첨부·법원별 준칙). 우선 별도 PR #13 기존 원문/typed 수치 결함 검증과 함께 PR #18 Node CI 결과 검토.
