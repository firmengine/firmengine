# FirmEngine A1 63차 — OCR 위치 증빙·소득금액증명 역할 우회·동일 Fact 교차소비

- 회차: **2026-11-02 KST**, 이전 62차 영수증 `20261102-round62-doc-withdrawal-model-routing-legal-preflight-0154KST.md`에서 이어감.
- 감사 시작 GitHub main HEAD `061a4a90f09ba681136aa79e20a3eb5d8add23a5`, 감사 영수증 직전 HEAD `061a4a90f09ba681136aa79e20a3eb5d8add23a5`, 단일 중앙보드 시작 blob `68b12541c08fc52d5cf737156994c131712cb8ee`.
- 역할 순환: **사용자·서류담당자 / 변호사 / 데이터담당자**. 확인 ID: **A1-DOC-008 / A1-LAW-009 / A1-DATA-008**, 전부 `[ ]` 미완료 유지.
- 범위: GitHub main 실제 소스+스키마+기존 검증/PR을 읽고 **실제 함수/분기 본문을 사용한 V8 격리 합성 실행** 및 UI 연결 정적 검사. 전체 Node/Next.js/API/CI/브라우저/staging D1·R2/Cron/OCR 모델/공식 법원 서식/전문가 승인 **실행 안 함**. 개인 고객정보, 실제 OCR 텍스트, .env, 키, 비공개 정답을 Git에 남기지 않음.

## A1-DOC-008 — 원문 숫자·문구와 페이지/bbox 위치 대조

- 코드 blob: `lib/source-verification-identity.ts` `acdecd4e18970fe4faf6eb91dd4aefc97b83236b`; `components/workspace.tsx` `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 실제 `isValidSourceBBox` 원본 함수를 V8에서 실행: 정규화 네 꼭짓점 `[.1,.2,.5,.7]`·전체페이지 `[0,0,1,1]`는 참, 역전·상한1초과·길이3·null·문자열좌표·영역폭0은 거짓. **8/8 독립 기대 일치**.
- UI 정적 확인: `workspace.tsx` 361행의 Fact 인용문→원문 참조, 364행의 페이지 이미지 `PageImage`·원본 다운로드, 396행의 `PageImage` 인수는 `caseId,documentId,page,held`만 사용. `SourceRef.bbox` 오버레이/원문 숫자 위치 강조는 해당 UI 경로에서 **미구현**. 실제 JPEG 픽셀 대조·OCR 값 정합/브라우저 열람은 미검증. 과거 35차 보고와 구분하여 최신 blob 재확인. **[ ]**.

## A1-LAW-009 — 세무상 과거 소득과 실제 현재 소득의 승인 분기

- 원본 blob: `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `lib/canonical-field-binding.ts` `60ee5c7762d52b72a165b4f4f8214680eb98f148`; 기존 `tests/business-income-source-integrity.test.ts` `c7bd2d90f9d7060e0d3b64aea75e5941bf027912`.
- 세무 증빙 `tax_income::income_after_expenses`가 **과거기간 증빙**인데, typed `IncomeSource.sourceCalculationRole`만 `historical_tax_comparison`→`period_income_observation`으로 바꾸면 원본 `assessment.ts`의 `historicalUnreviewed` 및 `historicalPeriodUnreviewed`가 둘 다 false가 됨. 실제 본문을 추출한 V8 합성 6조건(원래 과거유형 승인 전/후, 세무 Fact 연결 유지한 채 역할 교체 승인 전/후, 세무 Fact 없는 정상, 법률 인정 전)은 **main 4/6 독립 기대 일치**. **두 개 우회 조건이 검토 보류 기대에 위배**. 전체 `calculateCase`가 실제 최종 소득에 산입했다는 E2E 증거가 아니며 다른 게이트의 차단 여부는 미검증.
- 신규 검토용 **[Draft PR #152](https://github.com/firmengine/firmengine/pull/152)**, branch `audit/a1-r63-tax-canonical-20261102-0253`, HEAD `7989696128582630c7a7324d091a57a3288b836e`. 변경 소스 `lib/assessment.ts` blob `0ab8a4a7bbe11f8e68d5bc9c29b136a61c703687`: 연결 Fact canonical이 `tax_income::`이면 mutable role을 변경해도 기존 대표기간·중복검토 필요조건을 유지하고, 검토 완료 조건이면 별도 자동 법률 승격 없이 기존 경로 유지. **GitHub 저장된 수정 함수 재독 V8 6/6 기대 일치**.
- 새 `tests/a1-r63-historical-tax-source-role.test.ts` blob `6556c97278d7f36c978334f6563e1390864a8ef0`에 Node 회귀 **2블록 작성·커밋, 실행하지 않음**. `assessment.ts`를 수정한 기존 PR #82 등 충돌 가능, 변호사·계산사무장 승인 전 **Draft·미병합**. 원문 소득금액증명의 금액이 실제 소득과 다르다는 법적 판정이나 법원 인정값을 자동 확정하지 않음. **[ ]**.

## A1-DATA-008 — 같은 Fact의 소득·채무·재산 이중 산입

- main `lib/material-calculation-source-gate.ts` blob `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`; 기존 [Draft PR #83](https://github.com/firmengine/firmengine/pull/83) (HEAD `e35bee219379854f3350cdb5e17d12d67c8d814b`) 수정 blob `8e3c571b287aa07f8e695afd45e9313bddf02d91`.
- 실제 `auditMaterialCalculatorSources` 함수 본문을 타입표시만 제거한 V8 격리 실행, 결정적 `currentFacts`/`moneyValue`/`validSourceRef` 스텁. 동일 canonical payroll Fact `f-income` 100원. 원천 행 1건(정상), 소득행 2건(중복), 소득+자산 같은 100원, 소득+채무 같은 100원, 다른 금액 250원 참조, 소득 250원 불일치, 계산행 없음, sourceState 명시 `explicit_none`의 **8조건** 검증.
- 독립 기대: 같은 Fact와 **같은 100원**이 소득+자산 또는 소득+채무 계산행에 소비되면 `CALC_INPUT_MULTIPLE_TYPED_MATCHES`; 다른 금액 250원 단순 문서 참조는 이번 교차검사만으로 자동 오류 판정 금지. **main 6/8**, **PR #83 8/8 기대 일치**. 실제 18계산 출력 중복산입·직원 승인·운영 DB·693 필드 전수는 미검증. PR #44/#63 같은 파일의 통합 충돌과 합법적 교차참조 구분 실무 검토 필요. **[ ]**.

## 결과·보안·다음 회차

- 본 회차 **신규 P1 검토 후보 1영역**(세무 canonical과 mutable role 탈동기), **신규 Draft PR #152 1개**(제품 코드 main 미변경), **Node 테스트 2블록 작성/미실행**, 기존 P2 #83 재현 1영역, bbox 위치 오버레이 미구현 1영역. V8 독립 기대 합산: DOC 8/8; LAW 원본 4/6 vs 저장된 PR 수정 6/6; DATA 원본 6/8 vs 기존 PR 8/8. 제품 인수 완료 **0 ID**.
- 원문 **미관찰/null/관측된 0/명시적 비해당/상충/source-only/법률 승인전**을 동일값으로 처리하거나 법률상 확정값으로 승격하지 않았음.
- 전체 프로젝트 Node, CI, TypeScript, build, staging D1·R2/Cron, 사이트 배포, 법원 보정 실행, 공식 양식/변호사 승인 미검증. 운영 배포·운영 D1 migration·전자제출·법원 인가 확정 미실행.
- 다음 순환 역할 **IT·AX·계산사무장**: **A1-IT-007**(다중 유형 PDF/암호·손상/서버 확인), **A1-AX-002**(출처/사실/추정/역질문 구조 출력), **A1-CALC-018**(사업소득 승인→이전 법률판본 stale). 
