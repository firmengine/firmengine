# FirmEngine A1 — 82차 코드 완결성·상호 기능충돌 감사 (2026-11-02 23:16 KST)

- **범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 주 역할 순환 **IT (A1-IT-016) → AX (A1-AX-011) → 계산사무장 (A1-CALC-009)**. 기존 81차 DOC/LAW/DATA 이후 계속.
- **읽기 순서/판본:** 최초 main `7f18bd9c2e7dae46076eec88742c3f5d56be4d12`; 영수증 작성 직전 main `7f18bd9c2e7dae46076eec88742c3f5d56be4d12`. 중앙 보드 원본 blob `753a88a4ecea33ec0693af546f2fc67b9377e49c`(변경 직전 재확인 별도). 최근 GitHub commit/PR 검색, 81차 영수증, `db/schema.ts` blob `933f8686`, 실제 계산·승인 코드 및 관련 테스트를 조회. PR #55/#85는 각각 Draft·미병합.
- **방식:** 실제 main/PR TypeScript 함수 본문을 조회, type-only 문법을 필요한 만큼 제거하고 V8 격리 실행(의존성 중 법률/원천 preflight는 특정 경계 확인을 위해 명시적으로 대체). 계산 산식은 실제 `assessment.ts`의 생활비/예산 fragment를 그대로 실행. 이 환경의 GitHub DNS는 `git ls-remote`에서 실패. 실제 고객 원문·OCR/키/정답은 사용하지 않음. 모든 수치는 합성, 법적 인정값이 아님.

## A1-IT-016 [ ] — 최신 HEAD의 TS/lint/build/회귀

- `package.json` blob `8129160e33af3ae250c757a6a8195a29674ad031`, Node `>=22.13.0`, lint/build/check:source/intake/legal test 스크립트 정적 확인. `scripts/run-preapproval-regressions.mjs` blob `c4bbeca539457d55b42d4029a416d6586cb06f86`: --full이면 tests/*.test.ts 탐색 후 Node test, lint, build로 이어짐.
- GitHub contents 실제 목록: tests 디렉터리 **209개 항목 중 183개 `.test.ts`**, scripts 33개. GitHub main Actions runs API 응답 **total_count=0**, `.github/workflows` 경로 404. CI 성공을 의미하지 않음.
- 로컬 Node `v22.16.0`, git 설치 확인. `git ls-remote https://github.com/firmengine/firmengine.git HEAD` → `Could not resolve host: github.com`; 전체 원본 저장소 체크아웃·npm ci·전체 TS/lint/build/183 테스트 실행 불가. 본 회차의 **격리된 하위 모듈 9개 Node 테스트**는 아래 CALC 후보의 일부이며 `main` 제품 CI와 구분.
- **[ ] 유지.** 미관찰: 온전한 main의 `npm ci`, TypeScript, lint, build, 183 테스트, authenticated API, staging D1/R2/Cron.

## A1-AX-011 [ ] — 사람 제안·승인 분리의 실제 함수 반례

- `lib/business-net-reconciliation.ts` main blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`. `adoptBusinessNet` 실제 함수 V8 합성 **6/10 독립 기대일치**. 같은 actor 정확 일치 차단, 별도 actor 허용, 짧은 승인 이유·시간 이상·stale basis·동일 income ID 차단은 일치. **제안자 `user-A`, 승인자 ` user-A `; 제안자 ` user-A `, 승인자 `user-A`; 제안자 빈 문자열 또는 공백만인데 별도 reviewer**의 4건은 승인 객체를 허용해 독립 기대와 불일치.
- 기존 **[Draft PR #85](https://github.com/firmengine/firmengine/pull/85)** 수정 blob `98ebec78633b93980f08ed50c508e5b12fc331b4` `adoptBusinessNet` 실제 본문 동일 격리 10/10 일치.
- `validBusinessNetReview` 실제 본문 V8 합성 main **6/9**, 기존 **[Draft PR #55](https://github.com/firmengine/firmengine/pull/55)** blob `7a5552d23ce2324b9238b328e8287c100b38f724` **9/9** 기대일치. main은 과거 동일인 승인·공백 동치 승인·제안자 공란이 `exactReview=true`일 때 현재 승인으로 유지됨. 이 테스트에서 `exactReview`는 actor 경계 분리를 위해 **stub=true**(stale 조건에서는 false), 실제 원천·정책 검증·인증된 사용자 ID·법률 승인·API/D1 통합을 증명하지 않음.
- **두 PR은 서로 다른 함수 경계를 고치므로 둘 다 필요**; 미병합·법률 인정 의미 변경이므로 새로운 중복 패치 없음. 실무자/전체 회귀 후에만 병합 검토. [ ] 유지.

## A1-CALC-009 [ ] — 가구원·부양 근거/인정 없을 때 숫자만으로 확정 취급 금지

- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`: 실제 `baseLiving`~`disposable`/`ordinary_budget` trace 부분을 V8로 추출해 외부 `income`·lineage를 명시적 합성으로 대체. 합성 `income=3,000,000`, `living=1,500,000`, 비용 0, 인정 상태 `accepted`, 가구원 수 **null** 시 숫자 `ordinaryBudget=1,500,000`과 trace `calculated` 출력(독립 기대: **최소 provisional**, 가구원 인정 확인 필요). 정상 accepted+3명, unreviewed, rejected, 금액 null, lineage invalid는 기대한 상태. reported 3/recognized 1 차이는 법률상 가능하므로 **무조건 오류 판정에서 제외**, 원문·승인 근거 별도 요구. 이는 **함수 일부 격리 반례**이며 전체 `calculateCase` 재현 아님.
- main `lib/calculation-adapter.ts` blob `556ef86b887d1d729af2c56d071211c74b4d5e46`: 실제 함수 V8 **7/11** 독립 기대일치. 숫자/trace가 기계적으로 `calculated`이면 household `unreviewed`, `rejected`, accepted+recognizedMembers `null`/0인 4개 합성 조건 모두 `ready`로 반환. 생계비 0은 결측이 아닌 명시적 값으로 유지, stale/null/no-plan 구분은 정상.
- `lib/living-cost-proposal.ts` blob `e74e7362ad25c234da87fa726aae755507902720`: 실제 제안 함수 V8 **7/7**(가구원 null/0·타 관할·지원하지 않는 연도 차단; 유효 1명은 `draft_proposal_only`; 추가비용 잘못된 숫자는 null; 0은 `"0"` 보존). 하지만 제안과 계산 adapter는 다른 경로.
- **신규 P1 후보/방어 수정:** **[Draft PR #191](https://github.com/firmengine/firmengine/pull/191)** branch `audit/a1-r82-household-review-20261102-2316kst` HEAD `a21cee4ce47db28e477e9fa4931dfb989a87763a`, 수정 adapter blob `8ea9720ec4e2a3a5d665e6623f3757968ea6eb66`, 회귀 test blob `6ea3dbefae127cdc7864e6a227bb904477b3466c`. 수치/인정 count 자체는 **변경하지 않고**, 독립 `recognition!=="accepted"` 또는 인정 인원수 null/0이면 contract `provisional` warning으로 노출. 신고3/인정1 차이 **자체만으로 차단하지 않음**, `not_applicable` 및 숫자 0 유지.
- PR 실제 수정 함수 V8 합성 **11/11** 독립 기대일치, main **7/11**. 로컬 Node `v22.16.0`의 **격리된 복사본**으로 신규 test 파일 `node --experimental-strip-types --test tests/a1-r82-household-review-adapter.test.ts` **9/9 PASS**; 실행한 lib/test 두 파일의 Git blob SHA가 PR 실제 커밋 blob과 각각 일치. **전체 프로젝트 Node, TS/lint/build, 계산 18모듈, 95 법률검토, staging D1/R2, 최종 Word는 미실행**.
- main `context-validation.ts` blob `7ea7262c`: 정적 `HOUSEHOLD_SCHEMA`는 recognizedMembers nullable과 recognition accepted를 동시에 허용. `case-commands.ts`는 accepted 변경에서 human review 권한을 요구하지만 recognizedMembers non-null을 직접 요구하지 않는 경계(정적). `case-execution.ts` blob `752049c0` 및 `office-writer.ts` blob `78c351a0`는 adapter warning/blocked를 최종 생성 gate에 전달(정적, 실제 end-to-end 미실행).
- **법률·계산 의미 고위험 검토 전용 Draft**. 사람 승인·원문/대상 가구원 검증 없이 승인 확정으로 승격하지 말 것. 본 adapter 수정만으로 `assessment.ts` trace 자체 문제나 법률 의미가 해결되는 것은 아님. [ ] 유지.

## 정리/다음

- 신규 Draft PR 1개(#191) **main 미병합**, main 실행 코드 변경 없음. 실제 소스에서 검증한 경계만 설명; 자료의 미관찰/null/0/비해당/상충/source-only/승인전 상태 분리. 기존 PR #55/#85와 동시 merge 검수 필요.
- 역할 순환 다음 **서류담당자 → 변호사 → 데이터담당자**. 우선 미검증 `A1-DOC-018`, `A1-LAW-019`, `A1-DATA-018`의 최신 중앙 보드 ID 존재 여부부터 확인하고 선정.
- 운영 배포·D1 운영 migration·전자제출·법원 인가 확정 **미실행**. Extra High 추론 모드 실제 설정 여부 **미확인**. 전체 종단 인수 완료 **0건**.
