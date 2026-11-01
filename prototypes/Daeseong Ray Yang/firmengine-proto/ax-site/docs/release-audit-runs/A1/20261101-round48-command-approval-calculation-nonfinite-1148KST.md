# FirmEngine A1 — 48차 코드 완결성·상호 기능충돌 감사

- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부의 **A1만**. 2026-11-01 KST.
- 이전 47차 DOC/LAW/DATA → 이번 **IT(A1-IT-015) / AX(A1-AX-011) / 계산사무장(A1-CALC-010)**. 중앙 보드 해당 3 ID는 모두 미완료 `[ ]`.
- 시작 main 최신 조회: `471b40530c42a2cf94a3734ec0b940a5d7dff361`; 수정 브랜치 작성 직전 main `b433264e8ffc23364f7b5a591734c3dce116175a` (동시 에이전트 기록 갱신). 최근 커밋/PR, 47차 영수증, 코드/기존 계산 회귀, `package.json`, 명령 POST/GET, source/schema 경계를 열람.
- 공개 Git에 실제 고객/개인정보/실제 OCR 원문/정답/키 또는 비공개 데이터 저장 없음. 아래 모든 입력은 합성.

## A1-IT-015 [ ] — 명령 API 응답/화면 성공 인지

- main `components/case-workflow.tsx` blob `2ec797958726b99a4358ec46ef35f78f90bfd927`, `app/api/cases/[id]/commands/route.ts` blob `44c267951751d280d0f1c27ac6b3362bd7f9b9d6`, `lib/case-command-store.ts` blob `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`, `lib/case-command-contract.ts` blob `4bcae36d910c50db4181f015a952a3060e4189ed` 확인.
- 서버는 `committed:true`+상태 영수증을 반환할 수 있고 파생 평가가 미완료면 HTTP 202+`pending:true`일 수 있음. 현재 UI `send`는 `response.ok`만 통과하면 **명시적 committed 플래그가 없어도 `updatePending(null)` 및 성공 안내**를 실행하는 코드 경로가 남아 있음. 이는 정적 제어흐름 관찰이며 실제 HTTP 화면 재현이 아님.
- 기존 [Draft PR #32](https://github.com/firmengine/firmengine/pull/32) 실제 helper blob `5e4af86131ba5ed7f8d223c6a4b4c8c634c25121`의 `hasCommittedCommandReceipt`를 함수 추출하여 V8에서 실행. 합성 null, {}, 영수증만 있는 객체, pending만 있는 객체, 문자 "true", 실제 bool true, bool true+pending, []의 **8/8**이 독립 기대 일치. **명령 커밋**과 평가·문서·법적 승인 완료는 구별. PR #32 미병합, 브라우저/실제 DB 검증 없음.

## A1-AX-011 [ ] — 사람의 제안/승인 독립

- main `lib/business-net-reconciliation.ts` blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`의 실제 `validBusinessNetReview` 함수본문을 추출, `exactReview`는 true로 고정한 합성 격리 실행(원천·사업장·법령 대조를 검증하는 테스트는 아님).
- 7입력: 독립 제안자와 승인자(기대 true); 동일 actor, 공백 동치 동일인, 제안자 누락, 승인자 누락, proposed, 승인 이유 누락(각 기대 false).
- **main 4/7 기대 일치**: 동일인·공백 동치·제안자 누락도 승인 유효성 helper가 true로 판정. 기존 [Draft PR #55](https://github.com/firmengine/firmengine/pull/55) blob `7a5552d23ce2324b9238b328e8287c100b38f724` 동일 테스트 **7/7** 일치. 실제 사업소득 승인 명령의 `adoptBusinessNet`은 별도의 [Draft PR #85](https://github.com/firmengine/firmengine/pull/85) 미병합이며 충돌/통합 회귀 필요. 법적 사람 승인 확정 없음.

## A1-CALC-010 [ ] — 0 / 미관찰 / 음수 / 비유한 값의 저장 상태

- main `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`. 실제 `statusOf` 함수본문 추출 후 V8 합성 **16조건** 실행.
- 독립 기대/실제 main 일치: 숫자 0, 문자열 "0", 음수 -12, 양수 100 → computed(부호·값 자체 유지); null/undefined/unknown → missing; blocked null → blocked; not_applicable null → not_applicable; SOURCE_CONFLICT 0 → conflict; 음수 provisional → provisional. 이들 **11/11**은 일치.
- **신규 P2 후보 5/16 불일치**: 값 `NaN`, `+Infinity`, `-Infinity`에서 engineStatus=`calculated`인데 **computed** 반환(독립 기대 blocked), 빈 문자열 `""`, `"  "`도 **computed** 반환(기대 missing). JS `JSON.stringify(NaN/Infinity) === "null"`임을 실제 실행하여 computed 값과 저장 JSON 간 의미 불일치 위험 확인. 현재 실제 결정론 엔진에서 비유한 값이 발생했다는 입증은 아님.
- 작은 방어 제안 [Draft PR #121](https://github.com/firmengine/firmengine/pull/121): 동일 함수에서 유한하지 않은 숫자는 `blocked`, 빈 문자열은 `missing`/기존 blocked로 구분. 기존 0·음수·null·not_applicable·conflict 처리를 유지. **main 11/16 → 후보 16/16** 실제 저장 branch blob `aa9a1f53519831c5bc571cdaa9cd3a53267bcea6` V8 격리 확인. 별도 **Node 22.16.0 소스함수 미러 17/17** 단위 테스트 통과(`/tmp/a1_r48_status_isolated.test.mjs`, 프로젝트 checkout 자체 아님).
- 새 회귀 `tests/case-calculation-feature-scalar-state-r48.test.ts` blob `8e91f437b303f438cad6eaa92446058bbb8b2b69` 작성/커밋만, **Node 프로젝트 테스트 미실행**. 새 PR HEAD `b7c63a9614f0cd4363c01ba058b92afd37612003`, 초기 base `b433264e8ffc23364f7b5a591734c3dce116175a`. 변경 2파일은 지정 범위 내부. 기존 [Draft #49](https://github.com/firmengine/firmengine/pull/49)와 같은 파일이므로 병합 전 통합검증 필수. 산식/법적 인정값/원본값 자체 수정 없음.

## 인수·다음 검증

- **이번 회차 체크 3/3 모두 부분 검증·`[ ]` 유지**, 신규 P2 후보 1건, 새 Draft PR 1개. 기존 P1 2경로는 기존 Draft PR에서 다루므로 중복 기능 수정 없음.
- 주의: 원본 함수 추출 V8 검증/소스함수 미러 Node 단위검증은 **제품 전체 Node/TS/lint/CI·실제 D1/R2/Cron·브라우저/법원 원본/Word/변호사 승인/배포 인수와 다르다**. 해당 종단 검증 모두 미실행. 전체 제품 최종 인수 완료 0건.
- 운영 배포, 운영 D1 마이그레이션, 실제 법원 전자제출, 법원 인가 확정 미실행. 사람 승인 없는 법률 확정 금지. 실제 Extra High 모델 추론 모드 여부 미확인.
- 다음 역할 **서류담당자 / 변호사 / 데이터담당자**, 후보 **A1-DOC-017**(법원 내부 보완·실제 보정 구분), **A1-LAW-014**(법률 50규칙·46예외 미확정), **A1-DATA-015**(서식 토큰/원천/산식/runId 보존). 먼저 해당 최신 ID와 기존 PR을 다시 조회할 것.
