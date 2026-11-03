# FirmEngine A1 — 108차: active-head 페이지네이션 / 증빙역질문 / 변제원장 무결성
- 작업시각: 2026-11-04 00:49 KST. 작업범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 역할: **IT담당자 → AX담당자 → 계산사무장**. 선택 ID **A1-IT-013 / A1-AX-013 / A1-CALC-013**. 전부 **[ ] 미완료**.
- 시작 main: `7694d2c13ee09c661a10f0024eb300cd8a14ec45`; 영수증 쓰기 직전 재확인 main: `7694d2c13ee09c661a10f0024eb300cd8a14ec45`. 최초 보드 blob: `63e250a084c2fa88da7feb493e5fd2e67e9d8294`. 107차 영수증 `20261103-r107-substitution-legal-source-2354KST.md`와 10/44/50/54/76차 보드 선행 기록 확인. 최근 main A3 r108, A2 r108 및 A1 r107 커밋 점검.
- 실제 읽은 main 소스 SHA: `lib/case-calculation-feature-store.ts` **bb5f88b26e68f5ae2234741063ac9301a927e27a**; `lib/case-lawgraph-store.ts` **eea435bb78f804c79a213c464af54e8014a3c3a5**; `lib/approval-issue-graph.ts` **53df46fa1fcf34e19d8e9a192da1a8f87bf897cd**; `lib/plan-reconciliation.ts` **1c895fd2fd8a133368315532ed2ab9984d64b2e3**; `db/schema.ts` **933f8686845ac14669312dd21bf85e02c62ed5e6**, `tests/case-lawgraph-store.test.ts` **017149328d2a64f3572ea302758abc9866111381**, `tests/approval-issue-graph.test.ts` **0fffa4548046c8efd67639446526b8f0d8dd9d4d**. `app/api/cases/[id]/approval-readiness/route.ts` **731f66a10d4af704b432dcd298061b452941fd13**의 `buildApprovalIssueGraph` 호출과 `judgmentGraph` 응답 경로 확인.
- 검증 방법: GitHub에 저장된 **실제 함수 본문**에서 TypeScript 타입 표기만 제거하여 JS V8에서 실행. D1 `prepare/bind/first/all`, `moneyValue`, 원천 판단/시간 상태는 **합성 객체 및 stub**. 이는 실제 Node/TypeScript/CI/SQLite/D1/R2/브라우저 시험이 아님. 참조 PR 소스도 같은 방법으로 격리 실행.

## A1-IT-013 — 동일 사건/판본의 run 교체와 페이지 혼합
- **main 6/8 독립 기대 일치**: 계산 피처 2쪽 순차 조회(A/C1, offset 0/2), 법률 문서필드 2쪽 순차 조회(L1, offset 0/2), 각 경로 명시적 데이터판본 충돌, 501개 limit 거부는 정상. 모두 `expectedDataVersion=7` 합성.
- **main 반례 2/2 재현**: page 1 읽고 같은 `revision=1,data_version=7`에서 calculation active head C1→C2, legal active head L1→L2 교체. 독립 기대: 기존 페이지 run에 바인딩/불일치 반환. 관찰: 다음 페이지가 새 `runId=C2/L2,headStale=false`로 성공하여 run 혼합 가능. 앞선 10/44/76차와 동일 결함 범주.
- [Draft #49](https://github.com/firmengine/firmengine/pull/49) code blob **429295821f171de76a4a1133df73fd2cf384c23c** 및 [Draft #180](https://github.com/firmengine/firmengine/pull/180) **f33e78bf58324676c7868099c7b374a2b12c86bc**의 실제 함수 격리: 각각 정상 1, 요청 전 head 교체(명시적 expectedRunId/expectedReviewRunId), **조회 중** head 교체 1씩, 총 **6/6** 독립 기대 일치. 오류 `CALCULATION_VERSION_MISMATCH` / `LEGAL_REVIEW_VERSION_MISMATCH`. PR 둘 다 open/draft, main 미병합.
- 한계: 500/5001 대량 실제 적재, 합성 DB의 SQL 연산, HTTP 409, 클라이언트가 기대 run ID를 **항상** 전송하는지 및 동시성 경계 전체 미실행.

## A1-AX-013 — 증빙 부족 질문과 직원 요청의 상태 전환
- `buildApprovalIssueGraph` **main 6/7 독립 기대 일치** (합성 위험 R1, 승인 증거계약 `income.net`, calculation `monthlyIncomeWon`). 미관찰+null → `source_feature` 및 `calculation_input` 질문 2개; 관측·미인정+명시 0 → 원문 수용 질문 1개; 사람 인정 Fact+명시 0 → 질문 0개; 인정 Fact+null 계산 → 계산질문 1개; 미승인 증거계약 → 법률상 필수 질문 자동 생성 금지; 오래된 법률 결과 → `not_currently_reviewed` 정상.
- **추가 경계 후보 1/7 불일치**: 인정 Fact와 계산값 0은 충족됐지만 현행 법률검토 `conflict`/반론이 남아도 `legalCheck.status=conflict`는 보존되면서 `questions=[]`. 독립 기대는 변호사 반론 해소를 위한 별도 `legal_objection` 또는 사람 후속 질문. 다만 그래프 설계상 `questions`를 증빙·계산에만 한정했을 수 있어 **법률적 결함 확정 아님, 별도 의견 채널 계약 검토 필요**. 본문 코드를 정책변경 없이 유지.
- 실제 API는 `GET approval-readiness`의 `judgmentGraph` 응답에 연결되어 있음(source-only). 그 질문이 상담 작성/요구서류 발행/DB 영수증/직원 확인/고객 전송으로 이어지는 **쓰기 경로 종단은 실행/확인하지 않음**. 코드 질문 존재 ≠ 직원 업무 생성.

## A1-CALC-013 — 변제원장 합계/채권·기금 출처
- main `reconcilePlanLedger` **3/7 독립 기대 일치**. 합성 사건: 채권 D1 원금100 이자0, 1개월 예산100, 지급100, trustee_fee 명시 0, priority/estate 명시 0. 정상 원장 → `reconciled`; 원금110 초과 → `blocked`(예산·원채권 초과); 2개월 계획에 2회차 누락 → `blocked` 정상.
- **재현된 결함 4/7**: 채권 ID `D_NOT_EXISTS` → main `reconciled`; ordinary 행 `fundingSourceId=estate` → main `reconciled`; 같은 회차 `trustee_fee` 명시 0원 2행 → main `reconciled`; priority 채권에 **명시적 승인 정책이 없는 상태**에서도 `priorityCoverage[D1].status=covered` 및 원장 `reconciled` (독립 기대: 승인 정책 불명 → unknown/hold; A2 담당 실무 검토 필요).
- 기존 [Draft #80](https://github.com/firmengine/firmengine/pull/80), 소스 blob **e0f39b09a33733c4f4300347e22485f6de9002f1**, **6/6** 합성 기대 일치: 정상·없는 채권·잘못된 funding·0원 보수 중복·초과 예산·누락 회차; 현재 main 대비 기존 3문제 차단. 단 **기준 승인 없는 priority coverage**는 이 회차의 #80 별도 비교 항목에 미포함. 법률상 확정 가능한 priority 정책은 실무자 승인까지 보류.
- 원장 합계·현재가치·청산가치까지 산출하는 실제 18계산/서식 연결 및 이자 일별 누적, 36/48/60개월, 우선/재단 법률정책 미관찰.

## 결론·조치·다음
- 실제 실행 집계: **main IT 6/8 + AX 6/7 + CALC 3/7 = 15/22** 기대 일치; 비교 **PR #49/#180 6/6**, **PR #80 6/6**. 집계는 서로 다른 함수의 합성 조건으로 **제품 점수 아님**.
- 제품 소스 신규 수정 **0건**. 동일 코드의 기존 Draft #49/#180/#80가 open이며 법률 질문/priority 승인 의미는 전문가 판단 필요. 충돌 병합 없이 보드·고유 영수증만 갱신. 3 ID 전부 **[ ]** 유지.
- 실 고객자료/개인정보/키/.env/원본 OCR·비공개 정답 미사용. 미관찰/null/0/비해당/상충/source-only/승인전 상태를 구분하고, 자동 법률 확정·법원 인가 추론 없음.
- Node/TypeScript/전체 CI/실 D1·R2·Cron/브라우저/85문서·18계산·95법률/공식 서식/변호사 승인/운영 배포·운영 마이그레이션·전자제출 **모두 미실행**. Extra High 모드 설정 미확인.
- 다음 순환 **사용자·서류담당자 → 변호사 → 데이터담당자**. 보드 최신 미검증 **A1-DOC-014, A1-LAW-015, A1-DATA-013** 우선 확인(정확한 범위는 다음 회차 보드 재조회).
