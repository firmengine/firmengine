# FirmEngine A1 — 제125차 기능완결성·상호충돌 감사 영수증

- 일자: 2026-11-04 KST; 대상: GitHub `firmengine/firmengine` main, 허용 하위 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 시작 main SHA: `8b0507e3ec87762073fd7a4272d3dae00c1c3fcc`; 영수증 커밋 직전 확인 SHA: `8b0507e3ec87762073fd7a4272d3dae00c1c3fcc`. 최근 커밋은 A3 보드/감사와 A2 작업. 기존 124차 A1 영수증 및 단일 중앙 보드 원본을 읽음.
- 순환 역할: **사용자·서류담당자 → 변호사 → 데이터담당자**. 선택 ID: **A1-DOC-012 / A1-LAW-014 / A1-DATA-012**. 전부 **[ ] 미완료**.
- 실제 main 소스 blob: 갈음 `lib/document-substitution.ts` = `9fea9344b923c961fe333761df99ddde431ce1bc`; 법률 후보 `lib/preapproval-legal-coverage-audit.ts` = `3e4dcf275a22b1bbe6b52cff09dae748f3c62175`; 50 규칙 `lib/legal-catalog.json` = `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`; 46 예외 `lib/legal-exceptions.json` = `6e51197226bfd8320e1147d8df3f12c11e00927c`; 법률 AI 패킷 `lib/legal-review-packet.ts` = `38b46feff4bb196c89d3a48ff97346846c9a9da9`. 관련 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 기존 `tests/document-substitution.test.ts`, `tests/preapproval-legal-coverage-audit.test.ts`, `tests/legal-review-packet.test.ts` 읽음.
- 방법: **실제 main TypeScript 함수 본문을 V8 JS로 타입 문구만 축소한 격리 실행**. UI/DB/모델/법원 정책은 실제 실행하지 않음. DOC의 공식 갈음 허용 경로·Fact fingerprint 및 TypeScript 유틸리티는 합성 보조로 대체, DATA 피처 우선순위·매칭 helper는 원본문과 동등한 합성 JS 함수. 합성 사례는 실제 의뢰인의 사실 또는 원본 OCR 결과가 아님.

## A1-DOC-012 — 갈음 승인 후 원본 요청 복원

- 원본 `reconcileDocumentSubstitution`에 A←B+C, 증빙 f1/f2, 수락된 대체 문서, 관할/카탈로그/기간, 관련 직원 승인정보를 합성 입력.
- **독립적으로 유효한 시나리오 15건 중 12건 기대 일치**. B/C 철회, B/C match 철회, 별도 C 증빙 역할 변경, 정책/카탈로그/관할 변경, Fact 미승인, C 원본 SHA 변경 → `restored`가 기대대로 관찰됨. 정상 B+C → `inactive_by_substitution` (법원 인정·인가가 아니라 체크리스트 파생상태).
- **3건 기존 P1 불일치**: B만으로 f1/f2를 모두 충족시킨 뒤 C의 matched 페이지를 `administrative`/`filed_form`/`unknown`으로 바꾸면 독립 기대 `activeRequest=true`, 실제 `false` + `status=inactive_by_substitution`, 사유 코드 없음. 증빙 Fact 확인과 별개로 마지막 `SELECTED_ALTERNATIVE_NOT_MATCHED` 분기에 페이지 `role=evidence`가 빠져 있음. 기존 미병합 Draft [#57](https://github.com/firmengine/firmengine/pull/57) 범위.
- 실험 중 요구기간을 축소하는 별도 조건은 **독립 기대가 법적/업무적으로 불명확**해 모수에서 제외(원본문 결과는 false). 따라서 최초 기계 시험 16개 중 **15개 유효 오라클만 채점**, 문제 후보를 과잉 확정하지 않음.
- 상담변경→active run 재생성→85서류/직원 UI/DB 전이와 published 법원 정책의 실제 적용은 **미검증**.

## A1-LAW-014 — 50 규칙·46 예외의 source 지원 경계

- 원본 `auditPreapprovalLegalCatalog` 본문과 실제 catalog JSON(50/46) 연결; 합성 사건 `courtId=seoul`, `applicationDate=2026-10-30`, applicant.address f1을 재검토/철회/상충/값 변경.
- **16조건 중 13조건 독립 기대 일치**: 50 규칙/46 예외, 미등록 ruleRef 0, 사후 `KR-PR-050`·`EL-40/EL-46` 구분, 법률 자동승인 0, 증빙 질문 227, 미승인 원천의 유보/승인 원천도 법률 적용은 사람 검토 요구. 명시 0은 누락으로 오분류되지 않음.
- **3조건 기존 취약 경계**: 상위 호출자가 `sourceValidatedAcceptedFactIds={f1}`에 철회(retracted/rejected), 논쟁(disputed), null값 Fact의 ID를 잘못 전달하면 helper가 `source_supported_needs_legal_application`으로 표시. 독립 기대는 `source_unverified_or_unaccepted`. 실제 상위 API가 인증된 ID 집합을 만드는 경로를 우회했다는 증거는 없음; helper 단독 신뢰 경계의 방어 필요.
- 작은 방어 패치+회귀 테스트를 **별도 Draft PR [#238](https://github.com/firmengine/firmengine/pull/238)**에 작성(브랜치 `audit/a1-r125-legal-source-defensive-20261104`, 후보 코드 blob `741a2b530c2a9a4659b7cd79ef89172fd0fb0573`, 테스트 blob `4f90ecb81bbc02c0b885e2d1be31d18ba647dccb`). Fact 자체의 verified/accepted/nonnull/nonblank/validation-error 상태 재검사; 명시적 0/false 유지, 법률 판단 자동승격 없음.
- 후보 함수의 V8 추가 합성 **17/17 독립 기대 부합**. **Node 테스트는 작성했지만 실행하지 않았으며** CI·staging·변호사/데이터관리자 검토 전 main 병합 금지. 실제 법률 규칙 적용·예외 법적 의미는 변경하지 않음.

## A1-DATA-012 — 모델 입력 전 출처 anchor 경계

- 실제 main `selectedFacts` 본문과 같은 피처 매칭/우선순위 helper로 synthetic 14조건 평가: **4/14 독립적인 모델 입력 안전 기대와 일치**.
- 명시적 0을 포함한 유효한 문서 refs, 유효 모양의 structured-test refs는 후보로 유지. 출처 없는 문자열·0·null·빈 structuredRefs·빈 문서 ID·존재 미확인 문서 ID·disputed/미인정 Fact·정상+출처없는 혼합·canonical OR 경로는 **10조건에서 pre-model 후보 또는 `provided` count로 잘못 포함**됨.
- 주의: `selectedFacts` 함수는 DB를 보지 않으므로 실존하지 않는 documentId의 실재 여부를 이 함수 하나만으로 판별할 수 없다. 반례는 **출처 검증 전처리와 AI 패킷 경계의 연결 부재 가능성**을 드러낸 것. 모델호출 후 `pipeline.reviewLegal`의 검증은 모델 요청 입력 오염을 되돌리지 못함. 실제 AI 호출·법률상 판단 오류/고객정보 유출 여부는 미검증. 기존 [Draft #75](https://github.com/firmengine/firmengine/pull/75)는 무원천 Fact 일부에 대한 1차 방어에 한정; DB 참조 검증과 `coverage` 연쇄 영향은 별도 통합 검토 필요.
- 신규 중복 코드 패치 없음: 기존 Draft #57/#75의 병합 검토 우선. 법률·사람 승인 판정 변경하지 않음.

## 합산·코드 조치·남은 인수

- **유효 독립 합성 조건 45개 중 29개 기대 일치, 16개 불일치**: DOC 12/15, LAW 13/16, DATA 4/14. 제품 품질 점수나 운영 장애 건수가 아님. 후보 PR #238의 17조건은 main 합산에서 제외.
- **main 제품 코드 수정 0건**, 별도 Draft PR #238에 구현 1파일·회귀 1파일, 아직 main 미병합. 중앙 보드는 해당 세 A1 ID만 이 영수증을 연결하며 **[ ] 유지**.
- 다음 역할 **IT담당자 → AX담당자 → 계산사무장**. 우선 **A1-IT-012**(0000–0022 migration 순서/호환), **A1-AX-012**(모델 retry·이중 호출), **A1-CALC-012**(36·48·60개월 및 날짜 공백) 선정.
- 테스트 계층 구분: 이 회차 실제 Node/TS 전체/CI/브라우저/사이트/staging D1·R2·Cron/85서류·18계산·95법률 종단/공식법원서식·변호사 승인 **미관찰**. 고객/키/.env/원본 OCR 사실값/비공개 정답 공개 Git 게시 없음. 운영 배포·운영 마이그레이션·전자제출·법원 인가 확정 **수행하지 않음**. Extra High 실제 모드 미확인.
