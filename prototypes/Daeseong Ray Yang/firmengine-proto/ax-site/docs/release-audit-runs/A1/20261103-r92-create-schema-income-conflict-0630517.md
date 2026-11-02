# FirmEngine AX A1 — 92차 사건 생성·모델 JSON·동일 Fact 소득결정 상충 감사 (2026-11-03 KST)

- **작업 범위:** `firmengine/firmengine`의 `main`에서 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 이전 91차 DOC→LAW→DATA 다음 순서인 **IT담당자 → AX담당자 → 계산사무장**로 순환.
- **감사 기준 main HEAD:** `063051763ce06f4be54dd28584db50f276716bcc` (감사 착수 및 영수증 작성 직전 재조회). 최근 main 8개 커밋과 open PR 목록, 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `ffcfa118193feb32b862e6883cb99f30c5ea6ee1`, 91차 영수증, 관련 실제 소스·테스트·`db/schema.ts`를 조회.
- **선정 ID:** **A1-IT-004 / A1-AX-004 / A1-CALC-004**. **모두 [ ] 유지**. 기존 PR 재사용; 새로운 제품 소스 변경이나 실무 승인 없음.
- **실행의 의미:** GitHub에서 반환한 **실제 함수 본문**을 import/TypeScript 표기 일부만 제거하여 V8 독립 실행. DB·OpenAI 응답·Fact helper 등 외부 의존성은 명시적으로 합성 stub. 실제 Node 테스트 파일 실행, 전체 TypeScript/lint/build/CI, staging D1/R2/Cron, 브라우저, 공식 법원 서식, 변호사 승인, 사이트 운영 배포는 수행하지 않음. 테스트의 이름·금액·Fact·응답은 전부 **합성**.

## A1-IT-004 [ ] — 신규 사건과 `case.created` 원자성·ACK 불명확성

- main `app/api/cases/route.ts` blob **`75beaa0f74abd4e23a3c5623efa1d526f2ff3290`**, `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` 확인. 별도 `cases`/ `events` 테이블과 `event()`의 개별 INSERT가 존재.
- 기존 [Draft PR #140](https://github.com/firmengine/firmengine/pull/140) `app/api/cases/route.ts` blob **`e37c7a48f8835f98996687dc2ee7fc5196b56e5e`**: `db().batch([INSERT cases, INSERT events])`로 묶고 각 `meta.changes===1` 확인. PR Node 테스트 `tests/case-create-event-atomic-r58.test.mjs` blob `772876156866afda3b05a0048b2ebc607d25f0db` **읽었으나 실행하지 않음**.
- 합성 입력: 서로 다른 ID를 발급하는 `createCase`, 이름 `합성 사건`, `actor=actor-fixture`, 정상 응답·이벤트 INSERT 실패·원자 배치 성공 뒤 receipt 1개만 반환(응답 불명확)을 각각 실행. DB 모형은 **정상 batch는 모두 commit, 예외 batch는 모두 rollback**이라는 가정을 사용.
- **실제 관찰:**
  1. 정상: main **201/사건1/이벤트1**, PR #140 **201/사건1/이벤트1**.
  2. 이벤트 실패: main **500/사건1/이벤트0**, 재요청 뒤 **500/사건2/이벤트0**(사건 잔존 및 중복). PR #140 **500/사건0/이벤트0**, 재요청 뒤에도 **사건0/이벤트0**(합성 atomic batch).
  3. 배치가 실제 commit했지만 **결과 배열이 1개뿐인 모의 불명확 receipt**: PR #140 **500/사건1/이벤트1**, 재요청 뒤 **500/사건2/이벤트2**. 이는 D1에서 그런 응답이 관찰되었다는 뜻이 아니라 **ACK 불명확 상태에서 요청 멱등키가 없는 코드 경계의 반례**. main의 동일 합성 모드에서는 batch를 사용하지 않으므로 201 응답으로 두 사건 생성.
- **독립 기대:** 생성·감사 이벤트는 하나의 원자 단위, 불확실한 ACK 뒤 재요청에서도 중복 사건 생성 금지. PR #140은 첫 조건을 합성 환경에서 해결하지만 **전송 실패/불명확 commit·멱등 수신증빙, 수정/삭제/복원 및 감사 로그 E2E는 미인증**.
- 동시 사용자, 실제 D1 트랜잭션 동작, 쿠키/인증/API 권한, 실제 삭제/복원, 강제 권한 철회는 이번에 실행하지 않음. 민감·고위험 데이터 의미 변경이므로 기존 #140과 별도 추후 멱등 설계 검토 대상으로 유지.

## A1-AX-004 [ ] — 구조화 응답 Schema·nullable·실패 상태

- main `lib/luna.ts` blob **`e8ad1246888e42087cf94ef792c8285cae2541d1`**: 완료 여부·JSON.parse 뒤 요청 Schema와의 필드/타입 대조가 없음. 기존 [Draft PR #89](https://github.com/firmengine/firmengine/pull/89) `luna.ts` blob **`391d2a4bb358726d5dd76fb91f130448a7d5af0d`**, `structured-model-json.ts` blob `86db6088697274866262ef4291d0f10c5701306f`. 위에 쌓인 [Draft PR #162](https://github.com/firmengine/firmengine/pull/162)는 검증 helper를 blob **`813a6bc9970dd13404126248a8109ba54636820a`**로 변경.
- 실제 `callLuna` 원본문 및 각 PR의 `structuredModelJsonMatchesSchema` 원본문을 V8 실행. 합성 `fetch`가 completed JSON output을 반환. 계약은 `{answer:string}` 필수·추가속성 금지 또는 `items:array|null`, `part:object|null` 허용. **독립 기대 11개**(정상, 잘못된 key, 최상위 배열/null/빈객체, 추가속성, 타입 오류, nullable 정상 null/실제 객체, nullable 배열 원소·객체 키 오류).
- **관찰:** main **3/11**, #89 **10/11**(정상 nullable null 오거절), stacked #162 **11/11** 기대일치. 잘못된 객체·배열·null·빈 객체·추가키·잘못된 타입을 main이 **완료된 응답 값으로 수용**함. #162는 nullable null 정상 조건도 통과.
- 최초 테스트 harness에서 `AbortSignal` 미제공으로 모든 실행이 `AbortSignal is not defined`였던 회차는 **무효 폐기**. 합성 `AbortSignal.timeout/any`를 제공해 실제 코드 전체 조건을 **다시 실행한 11개 결과만 집계**. 실제 API 호출·비용 없음. HTTP 429/502, timeout·재시도·tool-call failure, 실제 Agent Schema 전체와 연결된 데이터 저장은 **미검증**.
- #162는 #89 위의 stacked Draft로 두 변경이 함께 검토되어야 함. 구조 검증을 증빙·법률상 사실 승인으로 해석하지 않음.

## A1-CALC-004 [ ] — 동일 월·동일 Fact 다중 소득행의 승인·집계결정 충돌

- main `lib/income-resolution.ts` blob **`f370c4b14fd347089708c5c3241fa9c72522d4bf`**, 기존 [Draft PR #97](https://github.com/firmengine/firmengine/pull/97) blob **`d340e7c0b051ce0fede8f897b05854e2904953db`**의 실제 `resolveIncomeRows` 함수와 관련 helper를 V8 실행. `db/schema.ts`와 `tests/income-resolution.test.ts` blob `396bc23785130e82eb62af5fe626fe31e4e43582`; PR 회귀 `tests/a1-income-review-decision-conflict-r36.test.ts` blob `83bd6dd67ffdc2b1d222d7efcf1a331b14ebbbde`도 읽었으나 Node 실행은 하지 않음.
- 합성 입력: 2026-01 한 달, 같은 `income.net` Fact `f1`, 월값 `1,000,000 KRW`와 동일 `factIds`를 두 소득행에 연결. **독립 기대 15개**: 완전 동일행 중복 제거, recognition/aggregationTreatment/aggregationReviewed/sourceCalculationRole/aggregationReviewReason 충돌 5개와 rejected·역순 반례, 다른 Fact·월·금액·명칭·비어 있는 Fact·동일 승인 등.
- **관찰: main 8/15, PR #97 15/15.** main은 승인 상태나 집계결정이 서로 달라도 **후행 행을 duplicate로 제거**, 충돌 경고를 생성하지 않음(7개의 반례). PR #97은 동일 Fact의 **결정 충돌을 2행 유지 + `INCOME_SAME_FACT_REVIEW_CONFLICT`**로 노출하고 동일한 결정은 중복제거 유지.
- `currentFacts`를 합성 `data.facts`로 제공하고 증빙 유효성·structured row helper는 격리 대체. 그러므로 **인식된 합성 원천값의 실제 OCR/Fact 유효성, 월 집계·복수 사업자, 법률상 소득 인정, PR #96 집계 코드와의 결합, 전체 18 계산·D1 저장·법원 서류는 미검증**.
- #97과 [Draft #96](https://github.com/firmengine/firmengine/pull/96)의 합계 원칙 및 사람 승인 계약 병합 검토 필요. 원문 0·null·미관찰·비해당·상충·source-only는 다른 상태이며 독립 승인 없는 잠정 수치를 확정 소득으로 승격하지 않음.

## 회차 최종 판정 및 다음 인수

- **현재 main에서 기존 결함 경계 3개를 합성 재현.** PR #140 원자 경계 개선, #89+#162 Schema/nullable 개선, #97 동일 Fact 승인충돌 보존을 각각 **그 격리 조건에서만** 확인. **신규 확정 운영 장애 0 / 신규 코드 변경 0 / 신규 PR 0**. 기존 Draft들과 중복 수정·병합·운영 배포 수행하지 않음.
- **세 ID 모두 [ ]**, 함수 단위 검증 ≠ 전체 Node 회귀 ≠ 전체 CI ≠ staging D1/R2/Cron ≠ 공식 서식·변호사 검토 ≠ 사이트 배포.
- **다음 역할:** 사용자·서류담당자 → 변호사 → 데이터담당자. **다음 ID: A1-DOC-005**(가족관계·주소·혼인·부양대상 변경 서류 연결), **A1-LAW-006**(소송·압류·전부명령의 절차위험 원천), **A1-DATA-005**(신청인·배우자·채권자·사업자·계좌 ID 타입 격리). 다음 회차 시작 때 반드시 현행 단일 보드의 정확한 ID 문구·상태를 재조회하고 조정.
- 본 실행은 **개인정보/원본 OCR 사실값/키/.env/비공개 정답을 Git에 기록하지 않았고**, 운영 D1 마이그레이션·전자제출·법원 인가 확정도 실행하지 않음. Extra High 모드 실제 설정 확인 없음.
