# FirmEngine A1 59차 — 복수문서 원문 수령·재산이전 조사·삼중 금액 대조

- 실행 기준: 2026-11-01 KST, 시작 main HEAD `87da0c902d173a6be01a279ae73c73f38da93d8c`; 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `3ca97cb1d2252c4090a2c252371316f5bf9f1141`. 범위는 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부.
- 순환 담당: 58차 IT/AX/CALC → **서류담당자(DOC), 변호사(LAW), 데이터담당자(DATA)**. 체크 **A1-DOC-006 / A1-LAW-007 / A1-DATA-006**, 전부 **[ ] 미완료**.
- 시작 전 최근 main 커밋과 PR, 위 보드·58차 영수증, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 관련 코드 및 기존 테스트 `tests/intake-workflow-domain.test.ts`, `tests/extraction-row-store.test.ts`, 기존 수정 PR #86 읽음.
- 실제 실행 범위: **GitHub main 원문 함수 본문을 가져와 TypeScript 타입 표지만 제거한 V8 함수 격리 실행**, 독립 합성 입력과 기대값 비교. 일부 법률 함수의 외부 의존성(기준 fingerprint)은 명시적 합성 stub. **Node 전체 테스트, 새 Node 회귀 실행, 타입 검사, CI, staging D1·R2·Cron, 실제 PDF OCR, 브라우저·법원서식·변호사 승인 미실행**.

## A1-DOC-006 [ ] — 월별 급여/사업장/계좌/채권자 복수문서

- 원본 `lib/document-fulfillment.ts` blob `d8434f2b81fdfe79be6254714d8428dccf272214`; 호출부 `lib/case-workflow-view.ts` blob `dc7f62f914e9496066ea7f8316229d8d123af4f5`; raw 다중행 저장 `lib/extraction-row-store.ts` blob `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`.
- `deriveRequirementStatus` 원본 함수 + 실제 월 범위 함수 V8(해시 fingerprint만 stub): 2개 문서가 2026-01~06/07~12이면 `complete`; 6개월만 있으면 `partial`; 두 번째 문서 원문 SHA 변경이면 `stale`; 동일기간 중복이면 `conflict`; 문서 없으면 `missing`; 주체 링크 미확정이면 `mapping_required`. 독립 기대 **6/6 일치**, 직원확인 전 `staffDisposition=unreviewed`. 월별 소득 실제 금액 완전성이나 85종 전체 인수는 아님.
- **신규 P2 방어후보**: `aggregateDocumentReception`는 입력 `input.pages`의 `documentId`를 검사하지 않고 페이지 번호만 `Map` 키로 사용. 입력 `document A` 요구 1쪽, 공급은 `document B`의 1쪽 한 장뿐인 합성 입력에서 **원본 `read_complete`**, 독립 기대 **`attention_required`/A 1쪽 미수집**. A 1쪽+B 2쪽을 A의 두 쪽으로 오확인하는 재현도 동일. 원본 함수 **5/7 기대 일치**. 실제 호출부는 `page.documentId===documentId`로 사전 필터함을 코드에서 확인했으므로 **실운영 문서 혼입 사고가 입증된 것은 아님**.
- 수정 **[Draft PR #143](https://github.com/firmengine/firmengine/pull/143)**: 문서ID 일치 페이지·필드만 집계하고 타 문서 혼입이면 필수 `document_scope_mismatch`를 발생시켜 확인 보류. 원본 함수 재읽기 V8 **7/7 기대 일치**. 브랜치 HEAD `1d9e8b4d7b529ef379c2fadcff893af819453623`, 수정 소스 blob `87e8764e2da6026e5160b9c2150d5dcd229f3bc8`, 신규 `tests/document-reception-scope-r59.test.ts` blob `0ec2945f17aeea2540d8618fa972929f647c24a1`. **Node 테스트는 작성만 하고 실행하지 않음**. Draft/미병합·프로젝트 통합 전 미인수.
- 실제 UI→API→D1/R2→OCR→모든 월별 급여·사업장/계좌·채권자 종류의 케이스별 경로는 미관찰.

## A1-LAW-007 [ ] — 처분·증여·특정인 지급 조사

- 원본 `lib/reference-intake-catalog.json` blob `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`: `event.asset_disposal` → `INTAKE-044` / `disposal_records`, `event.preferential_payment` → `INTAKE-045` / `selective_payment_records`; 두 상담 규칙은 `legalReviewRequired:true`. 권고서류/질문 경로이며 불법성 인정은 아님.
- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: `WF-40` 처분대금·대체재산·자금흐름, `WF-41` 가족/특정인 지급과 대가·채무상태를 별도 법률검토로 분기. `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`의 `EL-23`은 최근 처분 사실만으로 자동 부인/환가 확정 금지.
- `lib/disposal-applicability.ts` blob `f707de8b34e5e06ff56e87435389a4de8879304f`의 실제 `evaluateDisposalApplicability` 함수 V8 격리 (fingerprint 함수는 합성 current basis로 주입): 검토 없음→`unknown`, 일치하지만 미승인→`candidate`, 명시적 승인+검토자/시각→`confirmed`, factIds 누락→`stale`, 기준 판본 불일치→`stale`, 자산목록 완전성 미확정→`stale`. **6/6 기대 일치**. 여기서 `confirmed`는 *해당 내부 '비해당' 검토 영수증 상태*일 뿐 법률상 처분 부인권/법원 인가 승인 아님.
- `lib/transaction-review.ts` blob `5a16674a2bfb2694c4c0c440b44a1f87e6fe619c`의 고액 출금 업무기준은 `legalThreshold:false`, `automaticAdjudication:false`; 현금·처분·투자 설명 단서를 조사 항목으로 생성하는 코드 정적 확인.
- 실제 증여·명의변경·편파변제 원본/시점/수익자/채무현황, 한국 법원 판단, 독립 압류 사건 분기, 95법률 실행, 변호사 승인, 운영 D1/UI/E2E 미검증.

## A1-DATA-006 [ ] — 원문/Fact numeric/typed 숫자 비교

- 원본 `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `normalizeMoney`+`moneyValue` 실제 함수 V8: 명시 정상원화/만원/0/null/음수/소수 변환은 기대 일치. 그러나 **원문 `1원` + 별도 선언 단위 `만원`에서 `10000` 원으로 잘못 exact**, 원문 `1 KRW` + `천원`에서 1000원 exact, `0원` + `만원`에서 0원 exact로 단위 상충 누락. **6/9 독립 기대 일치**.
- `sourceFactMoneyValue` 실제 함수 본문 V8: 정상 숫자/객체 alias, 0, null, Fact value/rawValue/typed mismatch, sourceUnit mismatch 등 **8/9 기대 일치**. 같은 `1원`+ `만원` 충돌이 10,000원으로 승인 후보 값 반환. 원문 PDF 텍스트·BBox·typed 객체 저장과 결합한 전체 삼중검증 아님.
- **기존 동일 원인**: A1-DATA-010 31차에서 이미 신고되고 [Draft PR #86](https://github.com/firmengine/firmengine/pull/86)(미병합)이 존재함. **신규 결함 중복 집계/동일 `domain.ts` 중복 수정하지 않음**. 특히 0원도 정확한 0인지 원천 단위충돌에 따른 0인지 분리해야 함.
- `lib/field-observation.ts` blob `c96954c09fa426e0dba5db2e5f787e2f3b880f19` 원문 관찰 상태 구분 코드는 존재하나 실제 OCR·D1·18계산·95법률·서식 종단까지 금액 원천 동일성을 통과한 것은 아님.

## 이번 회차 결과/인계

- 신규 **P2 코드 방어후보 1건** (문서 A/B page ID 오인), 신규 **Draft PR #143** 1건/회귀 파일 1개 작성, main 실행코드 미변경; 기존 P1 단위 충돌 1개 **재확인**(기존 PR #86). 3개 체크 ID **부분 검증/미완료**, 제품 전체 인수 완료 0건.
- 실제 수행: GitHub 소스/카탈로그/스키마/기존 테스트·영수증 읽기, V8 직접 실행, Draft PR 작성·GitHub 재조회. **Node 전체 CI/staging/법원 인가/운영 배포 불가·미실행**.
- 다음 역할: IT·AX·계산사무장으로 순환; **A1-IT-005**(상담변경→요구서류/원문판본), **A1-AX-018**(활성/사본 프롬프트 분리), **A1-CALC-016**(계산 결과와 법원서식 원단위 일치). 고위험 변경·법률 인정 규칙은 실무자 리뷰/별도 Draft PR 필요.
- 민감정보/고객 문서·비공개 정답·인증값·원문 OCR 사실·키·.env는 기록하지 않았음. 운영 배포·D1 운영 마이그레이션·실제 전자제출·법원 인가 확정 미실행. 원문 미관찰/null/명시 0/비해당/상충/source-only/사람 승인 전은 별도 유지. 실제 Extra High 추론 모드 여부는 확인되지 않음.
