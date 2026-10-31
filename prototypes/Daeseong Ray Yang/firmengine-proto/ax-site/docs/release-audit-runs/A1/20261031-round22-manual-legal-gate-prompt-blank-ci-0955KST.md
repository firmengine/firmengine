# FirmEngine A1 22차 — 수동 법률 AI 사전게이트·활성 프롬프트·회귀 실행 증빙

- **검증 기준 main HEAD:** `7afb00376eb72594f821131db3c5e4ad8f3fa644` (작성 직전 `7afb00376eb72594f821131db3c5e4ad8f3fa644` 확인).
- **역할:** IT담당자 `A1-IT-016` / AX담당자 `A1-AX-018` / 계산사무장 `A1-CALC-017`. 이전 21차 서류/변호사/데이터에서 순환.
- **영향 범위:** 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내 코드·테스트·감사 문서. 공개 Git에 실제 상담/OCR/고객 기록·신원·키/.env 없음. 전부 synthetic case / stub.
- 사전 확인: 최신 main/최근 커밋/열린 Draft PR, 이 중앙 보드, A1 21차 및 8차 영수증, `db/schema.ts` (blob `933f8686845ac14669312dd21bf85e02c62ed5e6`), `package.json`, `scripts/run-preapproval-regressions.mjs`, `case-agent-scheduler.ts`, `case-legal-automation.ts`, `case-legal-calculation-preflight.ts`, `pipeline.ts`, `reference-prompts.ts`, 관련 기존 테스트를 조회. GitHub main Action 최근 실행 0건.
- **증빙 수준:** GitHub 원본 TS 함수/POST 본문을 TypeScript 표기만 제거한 V8 **격리 실제 실행**, 모델/DB는 stub. 정책 JSON 전수 정적 파싱. PR 회귀 테스트 **작성 및 커밋**, 프로젝트 전체 Node 테스트/TypeScript/lint/build/CI/staging·실제 D1/R2/Cron/Word/브라우저/변호사 승인 모두 **미실행**. V8 결과는 그 어느 것도 대체하지 않는다.

## A1-IT-016 — 전체 CI·빌드·회귀 진입점 (부분검증, [ ] 유지)

- `package.json` blob `8129160e33af3ae250c757a6a8195a29674ad031`: Node>=22.13.0, `check:source`/`lint`/`build`/`check:product`/`test:legal-auto` 스크립트 확인. `scripts/run-preapproval-regressions.mjs` blob `c4bbeca539457d55b42d4029a416d6586cb06f86`: `--full`에서 등록 `tests/*.test.ts` 전체 + lint + build를 실행하도록 작성됨.
- 현재 컨테이너에서 `node v22.16.0`, `npm 10.9.2` 확인. `git ls-remote https://github.com/firmengine/firmengine.git`은 DNS `Could not resolve host: github.com`로 실패; GitHub connector로 소스 읽기/PR 작성 수행.
- GitHub Actions `GET /repos/firmengine/firmengine/actions/runs?branch=main` 조회 `total_count=0`. CI 부재/미실행은 **통과가 아님**.
- 이번 회차 두 수정 제안의 실제 main/후보 함수 격리 결과만 검증함. 신규 테스트 파일 `tests/manual-legal-preflight-route.test.ts`, `tests/reference-prompt-blank-guard.test.ts`는 커밋되었으나 실제 원본 Node runner 실행은 불가. **[ ] 유지**.

## A1-CALC-017 — 신규 P1: 수동 POST legal의 원천·계산 전제조건 우회

- **원본 소스 blob:** `app/api/cases/[id]/process/route.ts` `e153bdb44ec7614de4cd9a9adfaf76e5e7fc4b64`; `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`; `lib/case-legal-calculation-preflight.ts` `c17892e63bf00d2981f292b0ef28e032d66a8dc7`; `lib/pipeline.ts` `79dce5f9822cf2debe1f886ab93ece4a256659e6`.
- 자동 Cron 경로는 `inspectLegalAutomationSourceReadiness` 다음 `inspectLegalAutomationCalculationReadiness`를 통과해야 `reviewLegal`에 진입. 반면 사건별 `POST /api/cases/{id}/process` `action=legal`은 동일 검사를 호출하지 않고 `reviewLegal`을 바로 호출함. 여기서 `reviewLegal`은 원본 계산 노드를 거쳐 `callLuna`에 연결됨.
- **독립 기대:** 원문 미완료/정규화 누락/필수 계산 `monthlyIncomeWon` 미확정·오류/계산 head 없음에서는 비용 유발 법률 AI 진입 0회. 양쪽 준비 완료만 1회.
- **실행:** main의 실제 POST 함수 본문을 V8에 넣고 합성 `caseId=synthetic-case`, `action=legal` 사용. 인증/origin 검사·D1·caseExtras·모델은 stub으로 경계만 재현. `sourceReady=false`, `sourceReady=true/calcReady=false`, `bothReady=true`, `missingHead` 4조건.
- **관찰 main:** 각 조건에서 `sourceInspection=0`, `calcInspection=0`, `reviewLegal=1`, HTTP 200; **4중 1조건 기대 일치**. 실제 모델 호출이나 과금이 발생했다고 주장하지 않는다.
- **조치:** [Draft PR #73](https://github.com/firmengine/firmengine/pull/73), head `a548c5edc8f2bc106d4fd7dfc8e50b07fdfa0460`. 수동 진입점에 기존 2개 gate를 호출, 미준비면 `HTTP 409 LEGAL_REVIEW_PREFLIGHT_BLOCKED:<codes>`로 조기 차단. V8 실제 후보 POST는 **4/4 기대 일치**, 준비 완료일 때 기존 수동 검토 유지. 테스트 소스 신규 등록. **main 실행 코드 미변경**, PR 미병합.
- **고위험 검토:** 사람이 의도적으로 미완료 사건의 예비 법률 자문을 실행하는 기존 업무를 차단할 수 있음. IT/계산사무장/변호사가 수동 예비자문 예외 정책과 UI 409 표시를 검수하기 전 병합 금지.
- **기존 P1 별개:** 필수 `*Won` computed 잘못된 JSON 타입은 현행 main에서 false ready. 실제 `evaluateLegalCalculationPreflight` 함수 V8 11조건(정상 0, 무효값 7종, 원천 오류 코드 2형, 오래된 head 1)을 실행하여 **3/11 독립 기대 일치**. 정상 0/상세 suffix 오류/없어진 head는 차단·허용을 올바르게 구분했으나 잘못된 7개 타입은 ready=true. suffix 없는 단독 `CALC_INPUT_AMOUNT_INVALID`도 ready=true였으나 현재 생산측은 일반적으로 `CODE:field:fact`이므로 추가 계약확인 대상으로만 기록. 기존 [Draft PR #41](https://github.com/firmengine/firmengine/pull/41) 미병합; 중복 수정 안 함. 이와 별개로 수동 호출 우회는 PR #41을 병합해도 해소되지 않는다.

## A1-AX-018 — 활성 프롬프트 통합·공백 override (부분, 신규 P2)

- **원본 blob:** `lib/reference-prompts.ts` `5311133cb3d35f00b599fcbbe3786c533f8b76b0`; `lib/reference-prompt-policies.json` `9a347833b96e6a67081cd6aa2968ddbc6806584b`; `lib/reference-runtime.ts` `9993469a164740e8a9128874b299a967b420e230`. `n8n-reference/manifest.json` `4fe5204d0fc3399e7b8add9333ecdea4296e4128`은 스스로 `not a live n8n export`라고 명시, 활성 프롬프트의 두 번째 출처로 간주하지 않음.
- **전수 정적 확인:** 84개 프롬프트 ID 모두 고유, 중복 템플릿 0, placeholder와 선언 불일치 0, 초기 seed 공백 0, 83개 안전 invariant 잠김, 법률 검토 지침 1개 인간 리뷰 변경 가능. 검토/실제 배포 레퍼런스 스냅샷 검증과는 별도.
- **독립 기대:** 승인된 legal-review instruction 값이 빈 문자열이나 공백이면 업무용 지침이 사라지므로 거절, 비공백 승인 지침과 compiled seed는 허용, 잠긴 프롬프트 override 거절.
- **실행:** 실제 `renderPromptPolicy` 함수 본문 V8 6조건. main **4/6 기대 일치**, 빈 값·공백은 실제 `""`/공백을 그대로 통과. 새 [Draft PR #74](https://github.com/firmengine/firmengine/pull/74) 후보 **6/6 기대 일치**. `REFERENCE_PROMPT_TEMPLATE_BLANK`으로 실패 종결, 정상 reviewed override·seed·locked invariant 보존. 신규 합성 회귀 테스트 커밋, Node 원본 테스트 미실행.
- **PR #74 HEAD:** `3266ea41b9a20a50409a94a8d38991008707e39c`. 본 후보는 법적 판단을 바꾸지 않고 공백 지침 실행을 거절하지만, 운영에서 승인된 비어있는 지침이 존재하는지는 **미관찰**. AX/변호사 리뷰 필요. legacy 복사본 제거는 다른 디렉터리 변경 금지 때문에 **수행하지 않음**, 실제 충돌 여부는 배포 조회 미검증.
- 모든 PR 두 건의 변경 파일은 허용된 `ax-site/` 내부이며 **Draft·미병합**. 두 PR 상호 변경 파일 겹침 없음.

## 구분·인수·다음 ID

- 완료된 것: main 소스/스키마/기존 테스트/영수증 조회; V8 함수·POST 본문 격리 실행; 프롬프트 JSON 구조 검사; 2개 Draft PR 및 회귀 테스트 소스 등록.
- 미관찰/미완료: 서버 인증·실제 HTTP, D1/R2/Cron, npm 전체 의존성 설치, TypeScript·lint·빌드·전체 테스트, 정식 서식·변호사 승인, 배포 SHA. `null`/원화 `0`/비해당/상충/source-only/승인전은 판정상 혼합하지 않음.
- **A1-IT-016, A1-CALC-017, A1-AX-018 모두 [ ]**. 코드 존재·격리 pass≠전체 CI≠staging≠법원 인정.
- **다음 역할:** 사용자·서류담당자 `A1-DOC-015`(문안 편집/재생성·직원검수), 변호사 `A1-LAW-015`(제안자/독립 승인자 서명), 데이터담당자 `A1-DATA-012`(출처 없는 계산·법률 사실 소비 차단). PR #12/#20 등 기존 중첩 변경을 보존하고, 이번 #73/#74는 승인 전 병합 금지.
- 운영 배포·D1 운영 마이그레이션·법원 전자제출·인가 확정 모두 **수행하지 않음**.
