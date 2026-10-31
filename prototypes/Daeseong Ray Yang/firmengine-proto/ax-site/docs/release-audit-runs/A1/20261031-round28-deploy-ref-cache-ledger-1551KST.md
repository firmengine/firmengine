# FirmEngine A1 28차 — 소스/배포 지문·OCR 캐시 판본·채권별 변제원장 정합성

- 실행 시작: 2026-10-31 KST. 시작 `main` HEAD `9a1e5c4c65ada547bba30fc96b7a35282ec6020d`, 영수증 쓰기 직전 HEAD `9a1e5c4c65ada547bba30fc96b7a35282ec6020d`.
- 담당 역할: IT담당자 `A1-IT-017`, AX담당자 `A1-AX-010`, 계산사무장 `A1-CALC-013`. 직전 27차 서류·변호사·데이터 담당자에서 순환. 모두 **[ ] 미완료**. 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 우선.
- 허용경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만; 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 미수행. 공개 저장소에 고객 문서·비공개 정답·키/.env 미기록.
- 선행 확인: `main` SHA, 최근 A4/A3/A2 커밋·Draft PR #37/#43/#49/#78/#79, 27차 A1 영수증, 14차 A1 배포 영수증, `db/schema.ts`, 실제 함수/참조 판본/테스트. 전체 CI·브라우저·실제 D1/R2/Cron·공식 법원 서식·변호사 승인은 이번 회차 미검증.

## A1-IT-017 — main / 보관된 2026-10-29 v43 배포 영수증 대조

- `docs/releases/ax-v43/deployment-receipt.json` blob `5cf3179d2ff429bbda8b879d8aa1f8bbbc31ff51`, 저장된 원 배포 `source_commit=72b23f2c3faee5656caeeb1e6e6afce9a65de3cb`, 당시 상태 `succeeded` (2026-10-29 11:57:15 KST).
- v43 `docs/releases/ax-v43/source-file-manifest.json` blob `dec7460fd44424ba462618af1a215fc12b5c5230`, 기록된 파일 528개. 실제 GitHub 원본 JSON의 `source/` 경로 3개 `git_blob`을 동일 파일의 현재 `main` Git blob과 비교.
- `lib/reference-release.json`: v43 `5537e47c163fb87447f51560e1433866d67faf76` / main 동일 **(Git 파일 blob 일치)**. 내부 reference release `id=firmengine-reference-2026-10-29.1`, revision 1, 선언된 SHA256 `347dbe44af48986386fb83c0438dd8ac8d42f2c725e505749f4375e88b9fe231`.
- `db/schema.ts`: v43 `67fd5eac4dd83f6e3773d021bde3f937f67bc3df` / main `933f8686845ac14669312dd21bf85e02c62ed5e6` **불일치**.
- `package.json`: v43 `939c0b543bd201213bdebf3350958935f1451fcd` / main `8129160e33af3ae250c757a6a8195a29674ad031` **불일치**.
- 독립 기대: 과거 배포 원본과 현재 main 동일을 주장하려면 모든 해당 파일 blob과 실제 사이트의 현 배포 source SHA·스키마·reference SHA가 대조돼야 함. 관찰: 과거 영수증 1/3 파일 동일, 2/3 다름. **과거 v43 대 현 main 불일치**만 확인; 2026-10-31 현재 실제 사이트가 v43인지는 미관찰. 스테이징·운영 D1 스키마/사이트 배포 SHA 미조회. 상태 [ ].

## A1-AX-010 — 실행 입력과 OCR 캐시 키의 판본 고정

- 원본 `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; 실제 `extractionCacheKey` 함수 본문을 타입 제거 후 V8 격리 실행 (7개 입력 변형). `lib/pipeline.ts` blob `79dce5f9822cf2debe1f886ab93ece4a256659e6`.
- 합성 기준: documentId `doc`, sourceHash `a×64`, 1쪽, mapping `family-v1`, prompt `prompt-v1`, model `ocr-model`, rule `rules-v1`. 독립 기대: source/mapping/model/prompt/rule 변경은 다른 키; 별도 reference SHA 변경이 OCR 실행에 영향을 주는 경우 그 판본까지 고정되어야 함.
- 실제 key 동일 여부: 기본 동일; referenceSha256 `b×64` 또는 `c×64`를 입력 객체에 추가/변경해도 **동일**; mapping v2, prompt v2, rule v2는 각각 **다른 키**; 페이지 [1] 순서 동등은 동일. 반환한 JSON 캐시 키 배열은 7필드(documentId, documentHash, pages, mappingVersion, promptVersion, model, ruleReleaseId)이며 **별도 runtime reference release SHA 필드는 없음**.
- 정적 호출 추적: `pipeline.ts` 154/512행 cacheKey 생성은 `document.sha256`, `PROMPT_VERSION`, `OCR_MODEL`, `CURRENT_RULESET.id` 사용. 동일 cacheKey checkpoint를 다음 처리에서 계속 수용할 수 있음. `lib/case-data-recompute.ts`는 별도 계산 head의 reference SHA 비교, `lib/case-calculation-feature-store.ts`는 reference release SHA 저장(기준정보↔계산 쪽 보호를 OCR와 혼동 금지).
- `lib/reference-prompt-policies.json` blob `9a347833b96e6a67081cd6aa2968ddbc6806584b`, 활성 84개 정책 중 수동 승인 변경 가능 지침 1개만 확인. 실제 OCR 프롬프트 변경이 baseline PROMPT_VERSION에 반영되는지, 운영 reference-only 변경으로 동일 캐시가 위험하게 재사용되는지는 **미재현**, source-only 검토공백. 법률 인정 또는 model 실행 PASS 표시 금지. [ ].

## A1-CALC-013 — 채권 ID / 원장 유형 / 자금 출처 반례 및 Draft 수정

- 원본 `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`; `lib/case-execution.ts` blob `752049c087cc28b2d713eafb5dc3f7294623e8ae`.
- 실제 `reconcilePlanLedger` 함수 본문을 GitHub에서 읽어 타입 표기를 제거하고 V8에서 실행. 의존 `moneyValue`만 결정적 합성 stub. 입력: `planMonths=2`, `d1` 채권 원금100/이자0, 월 가용50, 명목 총액100, 회차 1/2 일반채권 각50 및 각 0원 trustee fee. 운영 데이터/실제 D1 호출 없음.
- 사전 독립 기대·관찰:
  1. 정상 채권/예산/회차: `reconciled` 기대 → main `reconciled`.
  2. `d1`을 존재하지 않는 `phantom` 채권자 ID로 교체: `blocked` 기대 → main **`reconciled`**, issues [].
  3. 1회차 `trustee_fee` 0원 행 중복: `blocked` 기대 → main **`reconciled`**, issues [].
  4. ordinary 채권의 `fundingSourceId`를 `priority_budget`으로 위조: `blocked` 기대 → main **`reconciled`**, issues [].
  5. trustee_fee funding source를 `ordinary_budget`으로 위조: `blocked` 기대 → main **`blocked`** (기존 검사).
- 기존 main 5조건 중 2건 기대 일치. 수정안은 채권자 존재성, claimClass별 funding source, 회차당 trustee fee 단일성을 검증해 **5/5 기대 일치**. 추가 변제총액120 vs 배분100 입력은 기존 `reconciled`이나 `legalReviewTasks=ORDINARY_ALLOCATION_UNRESOLVED`로 분리되고 `case-execution.ts` 상위 canFinalize 차단으로 소비함을 확인했으며 **신규 결함으로 간주하지 않음**.
- [Draft PR #80](https://github.com/firmengine/firmengine/pull/80) 별도 브랜치 `audit/a1-r28-ledger-row-identity-20261031`, HEAD `bb82b7e40c010b327d9bd6f843136e14265973f4`. 수정 `lib/plan-reconciliation.ts` 새 blob `e0f39b09a33733c4f4300347e22485f6de9002f1`, 신규 회귀 `tests/plan-reconciliation-row-identity.test.ts` 5개 Node test **작성/커밋만, 정식 Node 실행하지 않음**. 소스+테스트 총 2파일, 모두 ax-site 내부. 기존 Draft PR #37/#43이 같은 파일 수정하므로 통합 충돌+법률·계산 실무 검토 전 미병합.
- 원가치 `presentValueWon`은 자체 할인현금흐름 역산이 아니라 출처·근거가 표시된 `approvedPresentValue` 입력이며, `liquidationComparison`은 청산가치와 비교(검토 전 provisional). 명목 `planTotalWon`·배분·청산가치/현재가치를 동의어로 사용하지 않음. `tests/calculation-18-output-golden.test.ts`는 월100만×36=3600만, 승인 PV3000만, 청산100만, 배분3600만 합성 golden을 선언하나 **이번 회차 해당 Node 테스트는 미실행**.

## 상태·향후

- `A1-IT-017 [ ]` 과거 배포/현재 Git blob 정적 대조, 실제 현재 배포 미관찰.
- `A1-AX-010 [ ]` 실제 캐시 키 본문 V8 7조건, reference-only 영향 E2E 미관찰.
- `A1-CALC-013 [ ]` 원본 주요 반례 V8 5조건(+총액 차이 1조건), 후보 5조건 독립 기대 일치. 제품 전체 인수 완료 **0건**.
- main 제품 실행 코드 수정 없음. Draft PR #80은 검토 대기; 전체 Node/test/types/lint/build CI, staging D1/R2/Cron, 공식 법원 DOCX, 변호사 승인 및 실제 사이트 배포 검증 모두 미실행.
- 다음 역할 **서류담당자·변호사·데이터담당자**: `A1-DOC-016` 독립 인수 승인 분리, `A1-LAW-011` 청산가치/가용소득/수행가능성, `A1-DATA-008` 동일 Fact 중복 계산 소비. 이미 다뤘던 결함은 신규 집계하지 않으며 미검증 [ ] 유지.
