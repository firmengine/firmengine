# FirmEngine AX A1 — 90차 사건간 접근·OCR 독립검증·복수월/사업자 충돌 감사 (2026-11-03 KST)

- 프로젝트 `firmengine/firmengine`; **변경 허용:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 시작 기준 GitHub main 최신 검색 SHA `0e56923f7c3a6101f7001e70c2ee10106f40f807` (compare main = identical 확인). 최근 커밋/PR, 중앙 인수 보드, 89차 영수증, 소스/스키마/선행 테스트를 읽은 후 검증. 작성 후 GitHub 최종 HEAD 재조회는 중앙 보드 반영 단계에서 별도 수행한다.
- 역할 순환: **IT담당자 → AX담당자 → 계산사무장**. 확인 ID: **A1-IT-003 / A1-AX-003 / A1-CALC-003**. 세 ID 모두 제품 인수는 **[ ] 유지**.
- 실행 경계: GitHub에서 실제 소스 blob을 가져와 *함수/route GET 본문*을 V8 isolate에서 실행. TypeScript 타입 주석만 명시적으로 벗겨 내고 외부 D1/R2/사람 인증/AI provider 의존성을 합성 함수로 대체. 별도 함수 테스트의 기대값은 원천 코드와 독립 작성. 실제 고객문서·OCR 원문·개인정보·키/.env·비공개 정답 없음. **전체 Node/TypeScript/lint/build/CI, D1/R2/Cron, 브라우저, 법원 양식, 사람 승인은 실행하지 않음.**

## A1-IT-003 [ ] — 타 사건 ID read/byte 권한과 접근 전 원천 I/O

- 실제 main blob: `app/api/cases/[id]/workflow/route.ts` `5d4a0508513ca063e7f7d5486b73d7ed71066022`; `requirements/route.ts` `64eb0d2c6a12dfdf7f6f2889eaecdfc1fb417b2e`; `app/api/cases/[id]/route.ts` `a8eedd2f6109ba9a9994ee8f7fd26e08219731d5`; `documents/[doc]/route.ts` `db20b9248e68d3ec412b5d3f4254254e0ffc8412`; `app/api/workspace/route.ts` `58c8d7ba27a68f5914c07f34e2e9bb81f63b9e5f`.
- 권한 계약 확인: `lib/app-roles.ts` `a716bc17109d9bff7ff88c89606a49949e75a1df`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `drizzle/0007_case_commands.sql` `dc927161abbfbd065700f3e265189f4d6104561c`. 기존 PR 회귀 `tests/case-read-access.test.ts` blob `d05192cc7c8536c0c605e15444e74e2de971a5de`와 `tests/a1-case-read-boundaries.test.ts` blob `debc36d9c8b5a20077f5671d72a5be28b1f07c1e`은 **읽기만** 함.
- 합성 주체 `synthetic-actor`가 타 사건 `synthetic-case-B`/문서 `doc-Y`의 권한이 **없다/있다** 2조건 × **workflow GET / requirements GET / case GET / document original GET / document page GET** 5경로 = 10조건. 독립 기대: 무권한이면 HTTP 403, 역할검증 1회, 사건·DB·R2 조회 0; 허용이면 검증 1회 후 HTTP 200과 필요한 조회 1회.
- **main 실제 route 함수 0/10 독립 기대 일치**: 무권한 5경로 모두 200, 역할 확인 0; case/workflow/requirements 쪽 synthetic case read가 일어남. 문서 original/page는 mock R2 get 각각 **1회**(expected 0). 허용 5경로는 응답 200이나 사건별 역할 검증 0으로 계약 미충족. 실제 로그인이나 실제 비공개 R2 바이트 노출을 관찰한 것은 아님.
- 기존 [Draft PR #64](https://github.com/firmengine/firmengine/pull/64) `fb958528e9c2fab0eb0dab64d96c33bc00120098`는 세 case/workflow/requirements GET **6/6**, 기존 [Draft PR #66](https://github.com/firmengine/firmengine/pull/66) `533440c88cde71deb22dbe4fceadaa76d1d814d0`는 원본/페이지 GET **4/4** 동일 독립 기대 일치. #64의 `case-read-access.ts` blob `5dc1ff45ee12630861f54c576fb336573827fbd0`; #66의 문서 수정 blob `8af324a14f58562e2bf8104ae2be811cbbca45e5`.
- `workspace/route.ts` main의 무조건 `SELECT ... FROM cases`/전체 COUNT와 PR #66의 actor-scoped EXISTS/COUNT는 **정적 SQL 검사만** 수행. 실제 SQLite/D1 저장소, 토큰·그랜트 변경, HTTP 서버 검사는 이번 회차 **미실행**.
- 기존 P1 읽기 경계 **미해결**. 중복 코딩 대신 두 미병합 PR의 합동 rebase/브라우저·D1/R2 통합 검증 필요.

## A1-AX-003 [ ] — OCR 독립검증 결과와 원문 quote/value/unit/bbox 결속

- main `lib/extraction.ts` blob `75931aad3fc7871395e62276bb5533e24b15d1a5`, Draft [PR #158](https://github.com/firmengine/firmengine/pull/158) 수정 blob `f56b958022b8c76f7fcfae02f7c27844bcf322c3`, PR helper `lib/source-verification-identity.ts` blob `acdecd4e18970fe4faf6eb91dd4aefc97b83236b`; 기본 `tests/extraction.test.ts` blob `3ad778aaf64933e0c730d1b37d78df853d298e7e` 읽음.
- 실제 `applyFirstVerification` 및 호출하는 `getRepairTargets`, `validAgreement`, `verifierDisposition`, bbox 함수를 source slice 그대로 추출하고 타입 주석 제거 후 실행. `structuredClone`만 JSON 기반 합성 깊은복사로 대체; 시험 입력은 단일 페이지·단일 record·한 field, source bbox [0.1,0.1,0.4,0.4], verifier 인용·값·단위·bbox 변형.
- 독립 기대 10조건: 동일 quote/value/unit/bbox supported·target0; 서로 다른 quote/amount/unit은 unclear·target1; 검증 누락 missing_check·target1; wrong_category wrong_field·target1; bbox 불일치 및 원천 bbox 누락 conflicting·target1; bbox 있는 명시적 null 주장 supported·target0; 근거 없는 null은 unverified·target0.
- **main 7/10**: `식비 100`이라는 서로 다른 quote라도 `supported/target0`, 숫자 200 또는 USD 단위가 원본과 달라도 `supported/target1` 중간 표시가 됨(최종 receipt 발행이 확인된 것은 아님). **PR #158 10/10** 기대 일치. 원본 `validAgreement` helper 별도 10조건에서도 **main 8/10, PR #158 10/10** 기대 일치.
- 기존 P2 verifier 경계 재현. quote overlap은 문자/공백 정규화된 문자열의 포함 여부이며, 동일 문서의 다른 숫자와 최종 OCR source receipt는 *별도 확인 필요*. 실제 LLM·원본 페이지·full OCR·693 필드·사람 승인 미검증.

## A1-CALC-003 [ ] — 같은 사업자 여러 월·서로 다른 사업자 원천과 보수 미리보기

- main `lib/business-monthly-workbench.ts` blob `0174f228473516e94664be445d8f46a33f833f80`; 기존 [Draft PR #92](https://github.com/firmengine/firmengine/pull/92) blob `000992db45124f2a0a43791c249638d705bbed71`. 실제 `assembleBusinessMonthEvidence`와 `selectedMonths`, `fullMonth`, `sumMoney` 함수를 함께 V8 격리 실행. 원천 행 계약 `lib/business-source-evidence.ts` blob `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`; 기존 `tests/business-monthly-workbench.test.ts` blob `f06c4b4dfd6694da07a9ac28dc558c6520ee2906` 확인.
- 기간 2026-01-01~2026-02-28, 매출 300만원/비용 100만원, 같은 sourceRecordId의 월산술 미리보기 200만원을 기준으로 14조건. 정규 inside/명시적 0원/2개월 복수행/서로 다른 sourceRecordId/월복수 매출/환입/음수 비용/미관찰 null/기간밖/동일 레코드 비용 중복/매출·비용 각각 overlap unknown·partly_outside(4개)를 독립 평가.
- **main 10/14, PR #92 14/14 기대 일치**. 미확정 overlap 4조건에서 main은 경고 `BUSINESS_PERIOD_PARTIAL_OR_UNKNOWN`을 추가하면서도 **200만원** 산술 미리보기를 출력, PR #92는 null 보류. `legalNetApproved=false`는 모든 경우 유지하여 법정 순소득으로 승격된 증거는 없음.
- **실행 무효 로그 제외:** 최초 시험 변환기가 TypeScript non-null assertion 제거 시 `row.amountWon!==null`을 `row.amountWon==null`로 변형했음. 잘못된 실행 14조건의 통계는 폐기. 두 번째 변환기는 `!(?!=)`만 치환하고 원본 `!==` 보존을 검증한 뒤 전체 14조건을 **다시 실행**. 이 문서의 10/14·14/14만 유효.
- 실제 여러 사업자 신원 crosswalk, 12개월/60개월 완전성, D5103·D5110 공식 세무/법원 인정, typed IncomeSource/18계산/95법률·DB 저장은 검증하지 않음.

## 코드 조치/인수·다음 ID

- 새 확정 결함 없음. 재현한 것은 **main에 이미 보고된 접근 제어 P1 / verifier P2 / 기간 미확정 산술 P2**. 네 개 기존 Draft PR(#64,#66,#158,#92)은 모두 미병합으로 확인. 서로 다른 권한 경계·데이터 의미가 있으므로 *다른 에이전트 변경을 덮거나 기존 수정을 복제하지 않았음*. 제품 코드/테스트 파일 수정 및 신규 PR 없음.
- **현재 인수 완료 0/3**. 전체 CI, 실제 사이트, staging D1/R2/Cron, 85서류·OCR 693·18계산·95법률 E2E, 공식 서식, 서류담당자/계산사무장/변호사 승인 미확인. 코드 존재≠합성 단위≠CI≠staging≠법원 승인≠배포. 미관찰/null/명시적 0/비해당/상충/source-only/승인 전 상태 분리.
- **다음 회차 역할:** 사용자·서류담당자 → 변호사 → 데이터담당자. 체크 ID **A1-DOC-004** (근로/사업/겸업/무직/휴직 요구서류), **A1-LAW-005** (보증/채권양도/채권자목록), **A1-DATA-004** (OCR 복수행·단수합계 last-wins 방지).
- 운영 배포·운영 D1 마이그레이션·법원 전자제출·인가 확정 **수행하지 않음**. Extra High 실행 모드 설정 미확인.
