# FirmEngine A2 r86 — AX담당자: SQL Fact JSON 형식이 법원서식 계산근거로 잘못 연결되는 경계

작성 2026-11-03 02:12 KST. 순환: r85 데이터담당자 → **r86 AX담당자** → r87 IT담당자.
대상 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. **모든 테스트 입력은 SYN 합성**이며 실제 고객자료·OCR 원문·식별자·키·비공개 정답은 미사용. 운영 배포/마이그레이션/전자제출 없음.

**선정 A2 체크 ID:** `A2-AX-004` / `A2-AX-009` / `A2-AX-017` / `A2-AX-018`. 네 ID 모두 **부분검증 [ ]**, 최종 RELEASE_READY **0건**.

## 1. 선행 근거 및 GitHub 판본
- 시작 main HEAD `ce682613031ceca8f710deca705497270ab6d538`; 최근 `ce682613` (A1 보드 병합), `c7f2adac` (A1 영수증), `c2d18c61` (A4 보드 병합) 확인. 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` main blob `4a9f7aaed86e6e6b75e4e935b9247644b73558a6` (초기 읽기).
- r85 영수증 `docs/release-audit-runs/A2/2026-11-03_r85_0115KST_data-form-won-lineage-sql-pr195.md`, [Draft #195](https://github.com/firmengine/firmengine/pull/195), 동일 파일 [Draft #100](https://github.com/firmengine/firmengine/pull/100), r84 세금채권 [Draft #194](https://github.com/firmengine/firmengine/pull/194)를 확인. #195 main 대비 2 commits ahead / 9 behind; #100 main 대비 2 ahead / 422 behind (조회 당시). #195/#100과 모두 `lib/lawgraph-document-field-projection.ts` 파일이 겹치므로 통합 회귀·충돌 심사 전 병합 금지.
- main 실제 소스: `lib/lawgraph-document-field-projection.ts` blob `a017294aa814f4d33360c2531abf91d9eb79a6e0`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`. 기존 `tests/lawgraph-document-field-projection.test.ts` blob `63e1b89a02c0235f0106fd7eec69d1f936da2ec5` 및 `tests/case-calculation-feature-store.test.ts` blob `844525d8633442d571ced2c48ed5bd00ba7bb5a0` 읽음.

## 2. P1 후보: SQL 저장 문자열 Fact ID 타입이 검증 없이 서식 근거로 전달
main `buildStoredLawgraphDocumentFields()`는 SQL `source_fact_ids_json`을 `JSON.parse(... ) as string[]`만 수행한다. TypeScript 캐스트는 실행 중 타입 검증이 아니다. 0011 스키마의 `TEXT NOT NULL`은 배열/문자열/중복/빈 ID 유효성을 강제하지 않는다.

**실제 main 원본문의 `const normalized=rows.map(...)` 표현식을 추출, 타입 캐스트만 제거하고 V8 격리 실행**:
| SYN source_fact_ids_json / value_json | 독립 기술 기대 | main 관찰 | 수정 #198 관찰 |
|---|---|---|---|
| `[\"SYN-F1\"]` / `100` | 배열 보존 | accepted | accepted |
| `[]` / `0` | 비어 있는 근거 그대로 (승인 아님) | accepted | accepted |
| `[]` / `null` | 미관찰 null 그대로 | accepted | accepted |
| `[]` / `\"unknown\"` | unknown 그대로 | accepted | accepted |
| `\"SYN-F1\"` / `100` | rejected | **accepted string** | rejected |
| `42` / `100` | rejected | **accepted number** | rejected |
| `null` / `100` | rejected | **accepted null** | rejected |
| `[\"SYN-F1\",42]` / `100` | rejected | **accepted mixed** | rejected |
| `[\"SYN-F1\",\"SYN-F1\"]` / `100` | rejected | **accepted duplicate** | rejected |
| `[\"\"]`, `[\" SYN-F1 \"]` | rejected | **accepted** | rejected |
| `{` in Fact JSON or value JSON | rejected | generic SyntaxError | coded rejected |

- 총 **13조건**, 독립 기술 기대 일치 **main 6/13 → Draft #198 13/13**. main은 형식상 부적격 source Fact JSON 7종을 수용. 이는 법원 인가 또는 금액 계산이 통과했다는 입증이 아니며, 다른 게이트에서 차단될 수 있다.
- 후보는 `decodeStoredCalculationEvidence()`에서 JSON 파싱 오류를 `CALCULATION_FORM_EVIDENCE_JSON_INVALID`, 배열/문자열/중복 오류를 `CALCULATION_FORM_FACT_IDS_INVALID`로 구별해 throw. 기존 `case-legal-automation.ts`는 projection error를 잡아 `LAWGRAPH_FORM_FIELD_PROJECTION_FAILED` 결손으로 반영하는 경로가 **정적 확인**됨. 해당 경로 실제 API 종단 실행은 안 함.
- **불변:** 유효 `[]`, `0`, `null`, `unknown` 값 그대로 유지; 소득·채권 금액 수정 없음. 빈 Fact 배열 또는 형식상 정상이나 다른 사건의 Fact는 여전히 검증 전 상태로서 **source-only/법률 승인으로 자동 승격되지 않음**. 존재·소유·현재 인정·생산 판본을 확인하는 미해결 추적 필요.

## 3. 실제로 실행한 테스트/산술과 미실행 경계
- 독립 합성 Node 22.16.0, `node --experimental-strip-types --test tests/a2-r86-ax-form-evidence-shape.test.ts` (별도 로컬 복제한 동일 디코더 및 동등 회귀 입력): **35 pass / 0 fail / 3 TODO**. 프로젝트 의존성을 설치한 정식 repo 테스트가 아니므로 CI 합격 표시 금지. GitHub에 동등 회귀 소스 커밋.
- 실제 main/후보 GitHub 코드를 재독해 두 `rows.map` 표현식과 추가 디코더를 추출·타입 표기만 제거한 **V8 격리 13/13 후보 기대일치**. 숫자 `0`, `null`, `unknown`의 구분 유지.
- 독립 BigInt 계산 (실제 계산엔진 실행 아님): 월 500원 × 36/48/60회 = **18,000/24,000/30,000원**. 급여 12×2,400,000원 = **28,800,000원**, 사업 관측 11×1,000,000원 = **11,000,000원**, 산술 합 **39,800,000원**. 사업 미래 12번째 월은 `null`; 이 합계를 법원 인정소득이나 이중계상 없는 금액으로 **인증하지 않음**.
- main 기준정보 실파싱: `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` → 계산 **18 modules / inputs 91 (unique 78) / outputs 42 (unique 40)**. `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5110 55 / D5111 82 등록 토큰**. **정적 수량만** 확인; 18개 모듈 전체 실제 실행, 91 입력 팩트 소비, 42 SQL 결과/서식 토큰 전체 재독 완료 뜻 아님.
- 이번 회차 실제 SQL INSERT/SELECT, Cloudflare staging D1, R2/Cron, 18모듈 E2E, DOCX ZIP/XML 생성·재독, 전체 CI, 변호사·계산사무장 법률/세무 인수는 **미실행/미인증**.

## 4. 공식 원문 및 적용 보류 (2026-11-03 조회)
- 서울회생법원 **2026-10-01** [공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): **실무준칙 제424호 제2조 제2항 제7호 신설** 공지. 공지일과 사건별 적용일·부칙/경과조치는 별개. 첨부 개정 PDF 전문을 검증하지 않았으므로 **법률 미인증, 자동 규칙 반영 금지**.
- 국가법령정보센터 [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **[시행 2026-10-02] 법률 제21490호**. 제611조는 변제기간 원칙 3년/특별 사정 5년 한도를 규정; 제614조 인가조건에 법적 적합·공정/형평·수행가능·청산가치 등 포함. 합성 48·60개월은 **테스트 경계 조건**이며 일반 허용·인가 확정이 아니다.
- 국세청 [공식 부가세 안내](https://g.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 6개월, 간이과세자 1년. [국세청 사업·종소세 안내](https://d.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 종소세는 연단위 신고. VAT 매출/소득세 신고액을 동일 월 인정순소득으로 자동 더하지 않음.

## 5. 수정과 다음 담당
- **[Draft PR #198](https://github.com/firmengine/firmengine/pull/198)**, branch `audit/a2-r86-ax-sql-form-evidence-shape-20261103-0212` base main `ce682613031ceca8f710deca705497270ab6d538`, code HEAD `57434f2851a97c90832e6d486fe1dea82f7d82f5`. 3파일 변경 전부 ax-site 내부: `lib/calculation-form-evidence-decoder.ts` 신규, `lib/lawgraph-document-field-projection.ts` 소폭 변경, `tests/a2-r86-ax-form-evidence-shape.test.ts` 신규. **미병합 Draft**; main 제품코드 무변경.
- **r87 IT담당자**: PR #198 vs #195/#100 파일 충돌·타 회귀, 프로젝트 Node 본래 test runner, SQL `source_fact_ids_json` 형식 → 실제 Fact의 사건 귀속/현재성/판본 → 저장 계산 → D5103/D5110/D5111 동일금액 재독. `listCaseCalculationFeatures` JSON scalar/중복 허용 경로도 다른 API에서 동일한 차단이 필요한지 별도 진단. 법률 자동인정·계산 의미 변경은 변호사/계산사무장 승인 없이는 금지.
