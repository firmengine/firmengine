# FirmEngine AX A1 제37차 — 발급·발생기간, 가구생계비, 법률 서식 토큰 계보

- 실행 시작 기준: 2026-11-01 00:47 KST. 작업 범위: `firmengine/firmengine` **main**의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만. 첫 확인 main `d99ecb3f09b4af4e00a633e631875a5be049f43a`; Draft 브랜치 생성 직전 main `dbd3c61a84300e66a406802d4dd1eb563c34e5ed`.
- 직전 제36차 IT/AX/계산 → 이번 **서류담당자(A1-DOC-010)·변호사(A1-LAW-010)·데이터담당자(A1-DATA-015)** 역할 순환. 단일 보드 및 제36차 영수증, 기존 제11/19차 영수증, main 최근 커밋·PR, `db/schema.ts`, 코드/테스트 본문 확인.
- 모든 입력 **완전 합성/비식별**. Git에 실제 고객 자료·개인정보·OCR 원문·키/.env·비공개 정답 없음. 테스트는 GitHub 실제 main 소스에서 타입 표기만 제거하여 V8 격리 실행(의존성·DB는 합성 대체)하거나 정적 교차 확인한 것. Node/CI/D1/R2/브라우저/공식법원서식/사람승인과 구별. 세 ID 모두 **[ ] 미완료**.

## A1-DOC-010 — 발급일·발생기간·신청일 차이와 요구서류 후보

- main `lib/case-requirement-monitor.ts` blob `5dfacd3a7738358fb27b95016d0e63bd93c8bb1b`, `lib/case-document-requirement-store.ts` blob `a670cb4e6a38aa6e782e898b5ed30aad80619c6d`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `lib/domain.ts`의 EvidenceDocument 확인. 실제 문서 발급일·내용기준일을 별도 검증하는 typed/관리형 법원기준 적용 경로는 여전히 검증되지 않음.
- 합성 사건: 신청일 2026-10-30, 자료 대상기간 `2026-06-01~2026-07-31`(자유 텍스트), documentId=doc1, page=1, 타입=doc-type. **독립 기대:** (1) 일치 유형 없음은 no_classified_candidate, (2) 분류만 있으면 document_type_candidate, (3) OCR head까지 있으면 ocr_committed_candidate; **세 경우 모두** 발급일·발생기간의 법률상 유효성 및 요구서류 충족을 자동 승인하지 않음.
- 실제 `caseRequirementMonitor` 함수 본문(V8, 합성 SQL/의존 호출 대체) **3/3 기대 일치**: 단계 위 세 상태, `subjectAndPeriodVerified=false`, `requirementFulfilledInferred=false`. 실측 발급일 자체는 입력되지 않았고 검증·인정할 typed 필드가 없으므로 **기간 유효성은 미관찰/미구현**. 날짜 차이 허용기준 임의 하드코딩/법적 승인/코드 변경 없음.

## A1-LAW-010 — 가구원 및 추가생계비 법원재량과 미승인값

- main `lib/living-cost-proposal.ts` blob `e74e7362ad25c234da87fa726aae755507902720`, 기준 `lib/reference-parameters.json` blob `e57a9d7c99efe052d4581d780ed478d876eb3330`, 연결 `lib/legal-proposals.ts` blob `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`.
- 실제 `proposeLivingCost` 함수 본문과 main 기준정보 값을 V8에서 격리 결합한 **7/7 기대 일치**: 서울·2026·1인 = 2,564,238×60%=1,538,542.8원 `proposal`; 가구원 null / 비서울 관할 / 미지원 2023년 = `blocked`; 별도 추가생계비 `"0"`은 명시적 0으로 보존, 없음은 null, 음수 문자열은 null. 이 산출은 `needsRecognizedHousehold=true`, `needsAdditionalExpenseRecognition=true`, `legalEffect=draft_proposal_only`로 표시되며 **법적 인정 금지**.
- **미인증:** 실제 부양인·중위소득 적용 판본·추가생계비 증빙/청구·실지급 대조·법원 인정·변호사 독립 승인, 전체 `buildLegalProposals` HTTP/DB 결합 및 시효·재량 판단. 법률 해석 변경 없음.

## A1-DATA-015 — D5103 토큰의 잠정·과거 Fact 참조를 무검토 확정으로 표시 (신규 P2 후보)

- main `lib/lawgraph-document-field-projection.ts` 원본 blob `a017294aa814f4d33360c2531abf91d9eb79a6e0`, `tests/lawgraph-document-field-projection.test.ts` `63e1b89a02c0235f0106fd7eec69d1f936da2ec5`; `lib/form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`, `lib/case-lawgraph-store.ts` `eea435bb78f804c79a213c464af54e8014a3c3a5`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- **중요 재분류:** 제19차의 `FormBindings` 문자열·문서단위 provenance 공백과 별개로, 현재 `projectLawgraphDocumentFields`에는 토큰별 `calcFeatureRefs/sourceFactIds/citation` 생성과 법률 검토 실행 저장 경로가 **존재**한다. 따라서 전체 토큰 계보가 미구현이라고 단정하지 않음. 다만 화면 출력 토큰→계산 runId/수식/법률 승인 판본까지 종단 영수증과 공식 Word 결과 일치 확인은 미실행.
- 합성 D5103 `monthly_income="100"`/동일 outputName `monthlyIncomeWon`, 계산 상태 및 Fact의 현재 검토 상태를 바꿔 실제 main 함수 본문 V8 **6조건 중 3/6 기대 일치**. **오표시 3건:** (i) 계산 feature 상태 `provisional`인데 citation `manualReviewRequired=false`, (ii) 계산에 참조된 Fact ID가 현 유효 집합에 없는 경우에도 false, (iii) 해당 Fact가 `unreviewed`여도 false. 계산 `computed`+현재 승인 Fact, `blocked`, 원천 ID 없는 계산 출력은 기대 일치. 원문/산식/법률 승인 자체를 조작하거나 완료 처리하지 않음.
- 안전 변경: 별도 [Draft PR #100](https://github.com/firmengine/firmengine/pull/100) branch `audit/a1-r37-provisional-form-lineage-20261101`, 원 기준 main `dbd3c61a84300e66a406802d4dd1eb563c34e5ed`, PR HEAD `52a20a47cc22ef08323dbd4b5dfc07d6b688aa2f`; 수정 blob `8a8a0e63004328e8c4ccb2b0c08ca1cab0b52727`, 테스트 blob `d3b8ca33ace665e79b516582c4ac56cf035e041c`. 검토 필요 flag만 강화하며 계산/결과값/법률 판단/자동초안 구조 판정은 불변.
- **수정 브랜치 실제 저장 소스 재읽기 후 V8 7/7 독립 기대 일치**(현재 계산 승인, 잠정 계산, 부재 Fact, 미승인 Fact, 차단 결과, 원천 없는 계산, 출력값 누락). 신규 Node 회귀 1블록 작성·커밋하였으나 **Node 미실행**. GitHub combined status entries 0건은 CI 통과가 아님. 미병합 Draft, 실무 검토·통합 테스트 필요.
- 잔여: 수식/계산 run ID를 각 출력 토큰에 직접 붙인 영수증, Word 결과 토큰/반복행의 출력값 지문·검증, 여러 run/수정간 stale, 실제 법원서식/변호사 승인/실제 고객 사례는 미인증. [ ] 유지.

## 회차 결론과 다음

- 대상 **A1-DOC-010 / A1-LAW-010 / A1-DATA-015** 모두 **[ ] 유지**. 신규 P2 후보 1건 + 수정 Draft PR #100(코드·회귀테스트 2파일, ax-site 경로 한정). 이전 문제를 신규 결함으로 중복 계산하지 않음.
- 별도 검증 숫자: DOC main 소스함수 V8 **3/3**, LAW main 제안 함수 V8 **7/7**, DATA main **3/6** vs 수정 코드 **7/7**. 이 수치는 각각 독립 합성 조건, 제품 품질점수/법률 정확도/전체 인수 합산 아님.
- 다음 순환: **IT담당 A1-IT-011**(구 JSON/null 역호환), **AX담당 A1-AX-005**(없는 숫자·날짜·법률결론 환각 차단), **계산사무장 A1-CALC-005**(12개월 11개월 누락 평균 확정 차단).
- 전체 Node/CI/빌드·staging D1/R2/Cron·실제 API/브라우저·85서류 종단/18계산/95법률 전수·공식 양식·법원 원본/기한·실무자/변호사 승인·배포 **미실행**. 제품 전체 인수 0건. 운영 배포·D1 운영 마이그레이션·실제 전자제출·법원 인가 확정 **미수행**. 런타임 실제 Extra High 설정 확인되지 않음.
