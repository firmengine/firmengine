# FirmEngine A1 — 제76차 독립 기능·충돌 감사 (2026-11-02 KST)

- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 시작 `main` HEAD `768847c59f4ac2268cc0c03b699ba640dd714783`; 영수증 작성 직전 HEAD `768847c59f4ac2268cc0c03b699ba640dd714783`. 단일 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A1-IT-013 / A1-AX-008 / A1-CALC-006**을 선택. 75차 영수증, 최근 main 커밋·열린 PR, 실제 코드/스키마/테스트를 확인. 6역할 교대 중 이번 회차 **IT → AX → 계산사무장**, 다음 회차 **서류 → 변호사 → 데이터**.
- 근거 수준: GitHub에서 읽은 실제 함수의 TypeScript 선언만 필요한 범위에서 제거한 **V8 격리 실행**이며, DB는 비식별 합성 D1 prepared-statement 어댑터다. 이 결과는 Node 저장소 전체 테스트, 최신 CI, 실제 SQLite/D1·R2·Cron, 브라우저 E2E, 공식 서식, 변호사 승인, 사이트 배포와 다르다. 모든 입력은 합성. 고객정보·OCR 원문 실값·키·env·비공개 정답 없음.
- 실행 결과 합계: IT main **9/11**, 패치 제안 함수 **12/12**, GitHub PR branch 재조회 코드 **6/6**; AX main **10/12**(법률 의견 구조/미해결 반론 계약 2조건 공백); CALC main **10/12**, [Draft #105](https://github.com/firmengine/firmengine/pull/105) **12/12**. 모든 ID **[ ] 미완료**.

## A1-IT-013 — 법률 검토 페이지 도중 활성 run 변경 (신규 P1 후보)

- 직접 조회: `lib/case-lawgraph-store.ts` main blob **`eea435bb78f804c79a213c464af54e8014a3c3a5`**, `lib/case-schema-services.ts` main **`3e638f9e630e4c4fa9f6c17a205ca0c351248325`**, `app/api/cases/[id]/data/route.ts` main **`c851c4ca5961d42cdac5b957f6a9615734cdf741`**. 기존 Node 테스트 `tests/case-lawgraph-store.test.ts` blob **`017149328d2a64f3572ea302758abc9866111381`**. 동류 계산/OCR 경합은 기존 Draft #49/#52에서 별도 처리 중.
- **합성 입력·독립 기대·관찰:** 1,203개 법률 서식 필드 / 500행 페이지 조회 → 500 + 500 + 203개, 마지막 `nextOffset=null` 기대: 정상. 명시 `"0"`과 `null` 보존: 정상. 잘못된 limit=501, 음수 offset, 기대 dataVersion 차이, 조회 중 revision/dataVersion 변경 → 차단: 정상. **법률 head run A→B가 필드 조회 직후 바뀌어도 revision/dataVersion·계산 head가 같으면** 독립 기대 `LEGAL_REVIEW_VERSION_MISMATCH`, main 관찰 `runId=A, headStale=false` **오수락**. 다음 요청의 offset 페이지가 B에서 반환돼도 A/B 혼합을 감지할 expected legal run 인수가 없는 **별도 오수락**. **main 9/11**.
- 원인: 조회의 전후 스냅샷 대조가 case/source/calculation만 확인하고 **`case_legal_review_heads.review_run_id`는 확인하지 않음**. 법률 검토 내용 판본을 섞을 수 있는 조회 문제이며, 실제 문서가 법원 제출되거나 법률상 승인되었다는 사실을 입증하지 않음.
- **Draft PR [#180](https://github.com/firmengine/firmengine/pull/180)** (미병합): `audit/a1-r76-legal-review-head-pagination-20261102-1552` HEAD **`1e0831f2308fa4d34145f9790442ee43da9d3b2f`**. 현재 legal head를 마지막에 재조회하고 기존 head와 다르면 409 사유로 차단; 선택적 `expectedReviewRunId=legal-review-<64hex>`를 data API → schema service → store로 전달, 다른 run이면 409 응답. 기존 token 없는 호출 호환 유지하나 **페이지 간 무결성을 확보하려면 클라이언트에서 최초 runId를 다음 페이지에 전달해야 함**. 4개 변경 파일 모두 지정 경로 내부. 브랜치 소스 blob: store **`f33e78bf58324676c7868099c7b374a2b12c86bc`**, schema **`a53152d9ec1c0a16119b03f7206c995fc3bf8968`**, HTTP route **`7fed487f50de90bdb4520be52714c085e667287a`**, 신규 회귀 테스트 **`044a24e2a53a8e434fb322e73b52e8ec2f6a3267`**.
- **실제 테스트:** 변경 함수 후보 V8 **12/12**, PR branch에 커밋된 소스 재조회 후 V8 **6/6** 독립 기대 일치. 회귀 `tests/a1-r76-lawgraph-head-pagination.test.ts`의 Node 테스트 4개 블록을 작성·커밋했으나 **실제 Node/TS/CI 실행은 하지 않음**. 실제 D1 경합·Cloudflare HTTP 409·브라우저 토큰 전달·동시 법률 run 승격 회귀는 미검증. 다른 에이전트 병합/배포 금지. **[ ] 유지**.

## A1-AX-008 — 반론·법률 근거·미해결 쟁점의 독립 상태 분리

- `lib/approval-issue-graph.ts` main blob **`53df46fa1fcf34e19d8e9a192da1a8f87bf897cd`**, `tests/approval-issue-graph.test.ts` **`0fffa4548046c8efd67639446526b8f0d8dd9d4d`**, `db/schema.ts` **`933f8686845ac14669312dd21bf85e02c62ed5e6`** 조회.
- 합성 `R1`: 승인된 증거계약, 출처 수용 Fact A/B, 계산 `totalWon="100"`, 최신 `legalCheck.status=conflict`, `reason="objection pending"`, `nextAction="lawyer review"`. **실제 함수 V8 12조건 중 10 기대 일치**: conflict/reason/nextAction 보존, 법원 인가 추론 `false`, source 미수용·계산 누락 질문 생성, stale 법률 검토 폐기, 미승인 증거계약의 필수 요건 비승격, 중복 rule 정리 등 정상.
- **기준 계약 공백 2개:** 증거/계산이 충족됐지만 법률 반론 `conflict`인 경우 `questions=[]`; `legalOpinion=null` 고정으로 **사람 독립의견·반론 근거·해소상태의 별도 구조화 필드 미관찰**. 별도 법률 검토 UI/DB가 제품 전체에 없다는 주장이 아니며, 현재 검토 그래프만의 공백. 법률 의미·서명과 사람 책임 변경 필요 → **신규 코드/PR 작성 보류, 변호사 실무 확인 전 [ ]**.
- 특히 `legalCheck.status=conflict`를 pass 또는 법원 인가로 승격하지 않음. 사람 승인값 미생성.

## A1-CALC-006 — 동일 채무의 비용·총액 미해결 슬롯 중복제거

- `lib/debt-resolution.ts` main blob **`1e5cf8aa0e903896205010e415d71f76ec39ba2a`** vs 기존 [Draft #105](https://github.com/firmengine/firmengine/pull/105) 코드 blob **`26c8054fb1e0b9d73e3df402b52e5bbc72f8af04`**. 관련 `lib/debt-source-integrity.ts` **`40b7c227d3e73ae141a79a71a9165603ad321c24`**, `lib/domain.ts` **`39ab41856f6d7a379aca7217d24b28f7f5f7616a`**, 기존 `tests/debt-resolution.test.ts` **`98e9d53a335afaf022263f8c9a6bc6ba1a4086cb`**.
- 합성 채무 2행: 동일 발행기관 `ISSUER-1001`, 전체 계약번호 `LOAN-1001`, 원금 100·이자 20, 서로 다른 합성 출처 Fact ID/문구, 기준일 동일. 독립 기대는 `sourceComponentIssues`에 `legal_costs` 또는 `total`이 한 행에만 있을 때 **두 행 보존 + `DEBT_CONTRACT_CONFLICT`**, 임의 비용/총액 합산 금지.
- **main 12조건 10/12**: 두 미해결 슬롯 상충 시 `rows=1, duplicates=["loan-1"], issues=[]`의 기존 P1 재현. **Draft #105 12/12**: 두 행 보존 및 conflict. 동일 issue 집합 순서차·중복태그·발행기관 다름·마스킹 계약번호·원본 참조 부족·담보/보증/기준일 차이는 기대대로 구별. 기존 PR이 있으므로 중복 패치 없음.
- 미검증: 실제 원금·이자·비용·담보·양도·보증 모든 조합의 typed 행→18계산→채권자목록/Word→법률 인정, 실 D1/Node/실무자 판정. **[ ] 유지**.

## 다음 회차·인수 판정

- 다음 역할: **서류담당자 A1-DOC-015 → 변호사 A1-LAW-016 → 데이터담당자 A1-DATA-015** (중앙 보드의 미완료 ID).
- 신규 P1 후보는 법률 검토 조회 페이지의 활성 run 경합 **1개**. 기존 채무 중복결함 1개 재현, 법률 의견 계약 공백 1개. Draft PR #180 신규 1개. 제품 코드의 `main` 수정 없음. 중앙 보드 세 ID는 인수 완료로 승격하지 말 것.
- **전체 Node 테스트, TypeScript, 전체 CI, staging/운영 D1·R2·Cron, 85서류·18계산·95법률 종단, 공식 서식/변호사 승인, 배포 모두 미검증**. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 수행하지 않음. 실제 추론 설정 Extra High 여부는 확인되지 않음.
