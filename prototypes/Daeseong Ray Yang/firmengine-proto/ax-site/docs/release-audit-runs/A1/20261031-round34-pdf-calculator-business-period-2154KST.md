# FirmEngine AX A1 34차 — PDF 다중유형·결정론 계산·사업소득 월 기간결합

- 일시: 2026-10-31 KST. 직전 33차 서류담당자/변호사/데이터담당자 → **34차 IT담당자·AX담당자·계산사무장** 순환.
- 검증 시작 GitHub **main HEAD** `82af233214c06b86620d86136cb047c97c4902df`. 최근 main `82af2332`(A4 row-field 테스트), `8225df94`, `6452aea9` 등과 직전 33차 영수증 및 단일 보드 `39e5648067eb4a4a641c6601b8775ce5b0f8076f` 확인. 열려 있는 미병합 A1 PR #24/#32/#49/#55/#77/#85/#88/#89/#90 등도 확인. 이번 결과는 이 시작 SHA에 근거하며 최신 배포 영수증 아님.
- 감사 대상 **`A1-IT-007`**, **`A1-AX-007`**, **`A1-CALC-003`** 모두 **[ ] 미완료**. 개인식별자료·실고객 원본·키·비공개 정답 입력하지 않음. 아래 금액·인물/원천 ID·해시는 전부 명시적 합성.
- 파일·스키마: `db/schema.ts`의 `documents/page_jobs/document_instances/case_calculation_runs/case_calculation_features` 선언, `package.json` Node >=22.13/test scripts, 기존 `tests/business-monthly-workbench.test.ts`, 관련 코드/33차 영수증을 읽음. 코드는 V8 함수 격리와 코드 경로 분석을 구분해 표기하며 Node 프로젝트/Cloudflare 연동 검증으로 승격하지 않음.

## 1. IT — A1-IT-007, 단일 PDF 다중 유형/동일유형 복수 PDF/암호·손상

- 실제 main 소스 blob: `components/workspace.tsx` `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`, `app/api/cases/[id]/documents/route.ts` `274f7a6e73988ca254607422d2ff2cddd1326ac0`, `app/api/cases/[id]/documents/[doc]/route.ts` `db20b9248e68d3ec412b5d3f4254254e0ffc8412`, `lib/pipeline.ts` `79dce5f9822cf2debe1f886ab93ece4a256659e6`.
- **실행한 합성 검증:** POST 함수 본문에서 TypeScript 매개변수 주석/모듈 import만 제거하여 V8에서 실행. `getCase/saveCase/DB.batch/samplePageRole` 등 외부 의존은 상태 유지형 합성 stub. 3쪽 원본 해시 A에 페이지 역할 evidence/filed_form/unknown 3행 별도 등록(기대/관찰 일치); 같은 SHA·같은 pageCount 재요청은 idempotent(일치); 같은 SHA·다른 pageCount는 409(일치); 별도 SHA B는 독립 문서 생성(일치); 잘못된 SHA는 400(일치); 임의 유효 형식 SHA C+pageCount 메타데이터 등록은 **실제 파일 바이트 없이도 201**(사실 관찰) → **6개 합성 입력 실행**. 마지막 1건은 업로드/원본 증빙 완료의 PASS가 아니라 별도 서버 원본 검증 공백임.
- 브라우저 클라이언트는 `pdfjs.getDocument(...).promise` 완료 후 등록하고 PDF 페이지 이미지를 생성함. 따라서 **일반 클라이언트 경로**의 암호·손상 PDF는 PDF.js 오류가 발생하면 등록 이전에 중단될 것으로 추론되지만, 암호/손상 실제 PDF 바이트를 사용한 브라우저 실행은 **하지 않음**. 서버 POST는 해시·페이지 수 메타데이터만 확인하고, 원본 PUT는 MIME·바이트 수·SHA를 확인하지만 PDF 본문 구문·실제 페이지 수·암호 여부는 독립 검증하지 않음. 임의 파일의 201 메타데이터 등록을 유효 PDF 수용/최종 R2 ready라고 주장하지 않음.
- 한 PDF 여러 유형은 페이지별 role/문서유형을 따로 보유하는 구조와 classification stage가 있으나 실제 혼합형 원문 전체 OCR·여러 유형 페이지 자동 분리는 미실행. 동일 유형의 서로 다른 PDF는 별도 SHA로 등록 가능한 계약; 실제 복수파일 UI/R2 종단 미실행.
- 안전 측면: PDF 파서/페이지수의 서버 신뢰 경계와 고아 등록 복구 검토 필요. 구조·R2 업로드 경로에 영향 있는 변경은 새 고위험 코드로 즉시 강행하지 않고 별도 검토 과제로 유지. **A1-IT-007 [ ]**.

## 2. AX — A1-AX-007, LLM의 산술 대신 결정론 계산 소스

- main blob: `lib/case-agent.ts` `8b6f6f615c05551f8783e4efbee60dbf81bd3993`, `lib/calculator-tools.ts` `13025c1feb8f16d1c52b41ca8de35ac4b2e3c7c0`, `lib/case-execution.ts` `752049c087cc28b2d713eafb5dc3f7294623e8ae`, `lib/calculation-adapter.ts` `556ef86b887d1d729af2c56d071211c74b4d5e46`, `lib/case-data-recompute.ts` `c19584f1668b7f4849ac0fc8c910f7c1ce36187d`. `assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`에서 BigInt 계산 trace와 source gate 선언 확인.
- `runCaseCalculatorNode` 원본 함수의 TypeScript 타입만 제거, `callCalculatorTool/snapshotSha256`는 합성 stub으로 교체해 **5/5 기대 일치**: 동일 사건·revision·inputSha256 영수증이면 `tool=calculate_case`, `transport=in_process_mcp_dispatch`, `modelPerformedArithmetic=false`; 다른 사건 ID, 구 revision, 다른 inputSha256은 거절; 도구 INVALID_INPUT도 거절.
- `adaptCalculationInput` 함수 본문 격리 **3/3 기대 일치**: 유효 계산 snapshot `ready`(계산 승인·법원 인정 의미 아님), revision 불일치 `blocked`, 월 소득 `null` `blocked`.
- `calculator-tools.ts`는 `calculate_case`에서 `executeCaseNodes`를 호출. 여기서 OpenAI 모델이 산술 합계를 수행한다는 근거는 보이지 않음. 그러나 법률/서식 단계에서 AI 텍스트가 숫자를 새로 만들어 승인·출력으로 승격하는 전체 경로까지 실행한 것은 아님. **A1-AX-007 [ ]**.

## 3. 계산 — A1-CALC-003, 동일 사업자 복수 월·다사업자 복수행

- main `lib/business-monthly-workbench.ts` blob `0174f228473516e94664be445d8f46a33f833f80`, 기존 `tests/business-monthly-workbench.test.ts` `f06c4b4dfd6694da07a9ac28dc558c6520ee2906`. 월별 증빙은 사업자 법적 동일성을 자동 매칭하지 않으며 `legalNetApproved=false`로 반환.
- **신규 P2 후보 / main 실제 함수 합성 6조건 중 4/6 독립 기대 일치.** 매출 3,000,000원과 경비 1,000,000원 동일 sourceRecordId, 날짜 문자열은 2026-03-01~31로 정확하나 `periodOverlap="unknown"`(매출) 또는 `"partly_outside"`(경비)인 두 조건에서 `BUSINESS_PERIOD_PARTIAL_OR_UNKNOWN` gap이 있음에도 `arithmeticDifferenceWon="2000000"`와 `arithmetic_preview_not_legal_income` 표시. 독립 기대는 `null/needs_evidence`; 정상 inside·완전히 outside·금액 미검증·다른 recordId는 기대대로 처리. 현재 법률 승인값 오표시는 증명되지 않음.
- **조치:** [Draft PR #92](https://github.com/firmengine/firmengine/pull/92), branch `audit/a1-r34-business-period-preview-20261031`, HEAD `02b166f35ce0b735d6e1062111778e3b6d7c031a`. 수정 source blob `000992db45124f2a0a43791c249638d705bbed71`; 같은 월의 모든 원천행이 `verifiedAndAcceptedSource && periodOverlap==="inside"`일 때만 수치 차액을 표시하도록 제한. 새 Node 회귀 3블록 포함한 테스트 blob `22dbf397f2c4e10b435b72029b4da3336f8ecb21`. 파일 2개 모두 허용 경로, PR은 Draft·미병합.
- **실제 실행:** 수정 브랜치 소스에서 타입 선언만 제거한 순수 함수 V8 **9/9 독립 기대 일치**: 정상 같은 record의 산술 200만원, unknown/partly_outside/both unknown/outside, 금액 미검증, 다른 record, 동일월 다사업자 복수 총매출 검토보류, 1·2월 별도 묶음. Node 회귀 테스트는 **코드 작성·커밋만 완료, Node 실행 안 함**. 원천행·사업자 식별·월 정합성의 실제 DB/OCR 결과는 검증하지 못함. **A1-CALC-003 [ ]**.

## 4. 인수 판정과 다음 회차

- A1-IT-007: 등록 메타데이터 V8 합성 6조건, **실PDF 검증 아님**. A1-AX-007: 계산 노드 5/5 + read-only adapter 3/3 격리. A1-CALC-003: main 4/6, 수정 후보 9/9 격리. **서로 다른 증거 수준/독립 함수를 합산해 제품 합격률로 보고하지 않음.**
- 신규 P2 후보 1건 / Draft PR #92 1개 / Node 테스트 3블록 작성·미실행 / 새 배포·운영 마이그레이션·전자제출·법원 인가 확정 없음. 전 ID [ ] 유지, 전체 제품 인수 합격 0건.
- 메타 등록·코드 존재·정적 추적·V8 격리·Node·CI·실제 staging D1/R2/Cron·공식 서식·변호사 승인·운영 배포는 각기 별도 증빙이어야 함. 실제 고객 원문/원본 OCR/비밀·키는 공개 Git에 기록하지 않음.
- 다음 역할 **서류담당자·변호사·데이터담당자**, 다음 우선 ID `A1-DOC-008` (원문 PDF 근거 위치 UI), `A1-LAW-012` (관할·접수일에 따른 서울 424호 판본), `A1-DATA-009` (발급일·관측기간·기준일 데이터 판본). 과거 PR들과 충돌하는 수정을 하지 말 것.
- 실제 실행기의 추론 모드가 Extra High인지는 확인되지 않았으며 심층 검토 지침과 별도로 표시함.
