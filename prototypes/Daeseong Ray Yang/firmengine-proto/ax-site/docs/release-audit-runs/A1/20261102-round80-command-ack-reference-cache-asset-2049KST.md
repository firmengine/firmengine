# FirmEngine A1 — 80차 코드 완결성·상호 기능충돌 감사 (2026-11-02 20:49 KST)

- 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 79차 DOC/LAW/DATA 다음 **IT → AX → 계산사무장** 순환.
- 읽기 시작 GitHub main: `bf026791be6f29044477b68e901088ee37985617`. 감사 문서 작성 직전 재조회 main: `898db3adbb1a9bbf970d8c011764d3b8125fd153`. 최근 커밋/PR, 단일 중앙 보드, 79차 영수증, 명령 API/UI·OCR 캐시와 호출부·자산 타입/계산/해결 코드, 기존 Draft #32/#116과 44차 영수증을 읽음.
- 판정 원칙: **실제 GitHub TypeScript의 해당 함수 본문을 타입 표기만 제거해 V8에서 실행**. 외부 상태/HTTP/D1/브라우저/모델을 합성함. `assessment.ts`의 비검증 종속 함수(`nonnegative`, `monthIndex`, `shareBasisPoints`)는 합성 스텁을 사용하므로 **전체 계산 엔진 실측 아님**. 독립 기대는 실행 전 결정하고 관찰값 비교.
- 전체 Node 테스트/TypeScript/CI/브라우저/staging D1·R2·Cron/공식 서식/사람 승인/사이트 배포 **전부 미실행**. 개인정보·실제 원문/키/비공개 정답 사용 없음. 운영배포·DB 운영 migration·전자제출·법원 인가 확정 수행 안 함.

## A1-IT-015 [ ] — 명령 API/화면 성공·거절·미확정 상태 분기

- main `components/case-workflow.tsx` blob `2ec797958726b99a4358ec46ef35f78f90bfd927`, `app/api/cases/[id]/commands/route.ts` blob `44c267951751d280d0f1c27ac6b3362bd7f9b9d6`, `lib/case-command-store.ts` blob `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`.
- [기존 Draft #32](https://github.com/firmengine/firmengine/pull/32) UI blob `28f2759f0cd08e183952dd92044bf6a2809874d3`, helper blob `5e4af86131ba5ed7f8d223c6a4b4c8c634c25121` (열린 Draft·미병합).
- **실행 방식:** 실제 `CaseWorkflow.send` arrow 함수 본문만 V8 컴파일. fetch 응답·useState setter·`pendingRef`·`load`를 합성으로 치환하여 마지막 알림·보존 명령 ID·pending 상태 관찰. API route의 응답 200/202 분기 및 `commandResult`의 `committed:true` 계약은 별도 소스 정적 대조. 실제 브라우저 렌더·DB 저장 미관찰.
- 독립 기대: 명시적 boolean `committed===true`에만 성공; 400/409은 확정 거절로 pending 해제; 500/네트워크 오류/2xx 불명확 응답은 미확정으로 동일 명령 ID 보존. 202 + `committed:true,pending:true`는 저장됨·평가 미완료로 분리.
- **11조건 관찰: main 6/11, Draft #32 11/11 기대 일치.** main에서는 200 + committed 플래그 누락, `false`, 문자열 `"true"`, 빈 본문, JSON 파싱 실패를 모두 **성공으로 표시하고 명령 pending 해제**. 정상 200/202 true 2건, HTTP 400/409, 500 및 네트워크 오류 등 6건 일치. 기존 P1 결함 재확인, 중복 수정하지 않음.
- **상태 한계:** 단위/격리 성공과 인증·실제 API·D1 저장 영수증은 다름. 후속 UI가 `"committed"`/pending을 소비하는 연결과 서버 202 재조회는 전체 회귀 미실행.

## A1-AX-010 [ ] — 모델/프롬프트/기준정보/원문 SHA로 OCR 캐시 분리

- main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, main `lib/pipeline.ts` blob `79dce5f9822cf2debe1f886ab93ece4a256659e6`; request-scoped reference SHA는 main cache-key 7요소에 포함되지 않음.
- [기존 Draft #116](https://github.com/firmengine/firmengine/pull/116) `lib/domain.ts` blob `7c0baf061e22d1bf1a62a9cfa6f0522fb5c4b86f` (열린 Draft·미병합).
- **실행:** 실제 `extractionCacheKey` 함수 본문 main / #116를 각각 V8 실행; 원본 ID/해시, 페이지 배열 순서·번호, mapping, prompt, model, 정적 ruleset, 운영 reference snapshot SHA에 대한 합성 10쌍 대조.
- 독립 기대: 페이지 순서만 바뀔 때 동일 키. 원본·페이지 구성·모델·프롬프트·mapping·ruleset·reference SHA 중 하나라도 바뀌면 다른 키.
- **main 9/10, Draft #116 10/10 기대 일치.** main에서는 `ref-001`→`ref-002` 변경만으로는 캐시 키가 동일. 나머지 9조건 기대대로 동작. 기존 P2 후보 재확인. #116의 호출부/전체 worker 재실행 및 기존 job 교체가 실제 안전한지는 미검증.
- 서로 다른 원천/모델/사람의 승인 상태가 키가 같다는 이유로 합쳐져서는 안 됨. 이번 테스트는 OCR 캐시 식별자만 검증했으며 임의 AI 출력 사용 없음.

## A1-CALC-008 [ ] — 재산 종별·지분·면제·담보·0/null 분기

- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `lib/domain.ts` Asset blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/asset-resolution.ts` blob `ffda6d7684a8d34f228a568d090602bfcdd89cbf`; `lib/reference-parameters.ts` blob `a1bcd220362b850833b38dc815f5255f4be4ca42`.
- **실행:** 실제 `liquidationContribution` 함수 본문을 V8에서 타입 표기와 비영향 non-null assertion만 제거하고 실행. `NumericInput.amountWon`의 비음수 정수 파싱, 날짜 문법, 합성 기준 지분 10,000bp, 양수 BigInt 올림 보조함수는 스텁. **16/16개 최종 재실행 기대 일치**.
- 합성 입력·독립 기대/관찰: 보증금 1,000−담보300−비용100=600; 보험 500−면제200=300; 퇴직금1,000−면제500=500; 현금 명시적 0→0; 면제 미관찰 null→null+`ASSET_COMPONENTS_MISSING`; 음수 면제→null+MISSING; 소유지분 100% 초과→null+`ASSET_OWNERSHIP_MISSING`; 지분 3333/10000의 1,000원→334원(올림); 공유 담보 귀속범위 unknown→null+`ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_UNRESOLVED`; 공유 담보 범위는 있으나 원천 미연결→null+`ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_SOURCE_REQUIRED`; 연결됐으나 검토전→400+`ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_REVIEW_REQUIRED`; 원천·검토 확인→400; 담보 1,500>총평가 1,000→0+`COLLATERAL_SHORTFALL_REQUIRES_CLASSIFICATION`; 기준일 누락·문법 오류→null; 평가근거 공백→null.
- **검증 도구 자체 재검수:** 첫 V8 변환에서 정규식이 TypeScript `!` 제거 중 JS의 `!==`까지 변경해 14/16 결과가 나왔으나 이는 **검사기 오류**. `!(?!=)`로 수정하여 원본 비교연산자를 보존하고 **16/16 전체 재실행**. 첫 결과는 제품 검증 결과로 집계하지 않음.
- 추가 **정적 소비 경계**: `calculateCase`의 asset trace에서 `COLLATERAL_SHORTFALL_REQUIRES_CLASSIFICATION` 이유는 직접 `provisional` 조건에 포함되지 않으므로, 나머지 조건/Fact가 인정된 경우 `0`과 `calculated`가 함께 표시될 가능성 있음. 44차 영수증의 기존 source-only 후보이고 이번에 전체 계산 함수나 서식 출력을 재현한 것은 아님. 법률·계산 의미를 바꾸는 수정은 전문가/별도 PR 없이 하지 않음.
- `asset.kind`는 이 함수의 직접 분기가 아님(표준 numeric 동일 산식). 종류별 실재 원천 연결/면제 법적 승인/공식 청산가치 서식·D1 E2E를 검증했다고 표시하지 않음.

## 후속/인수 경계

- 세 ID `A1-IT-015`, `A1-AX-010`, `A1-CALC-008`는 모두 **[ ] 미완료**. 실제 신규 확정 결함 0, 기존 결함 2개 영역 반복 재현, 신규 Draft PR/제품 코드 수정 0.
- 각 Draft #32·#116은 **개별 함수의 합성 실행만 개선**했고, 여러 PR과 병합·CI·권한과 DB 기반 API 종단검증은 필요. 85서류, 갈음 A←B+C, C01/C02/C04, 동시 사건 전구간 등 이번 회차 전부 미실행.
- **다음 역할:** 서류담당자 → 변호사 → 데이터담당자. 다음 ID: `A1-DOC-017` (법원 실제 보정/내부 보완요청 UI 분리), `A1-LAW-018` (자동서식과 법원 제출·인가 상태 분리), `A1-DATA-017` (서류 재분류/기준변경 후 하위 소비처 재투영).
- **제품 전체 E2E 완료 0건**. `null`/0/미관찰/비해당/source-only/승인전/상충 분리. 실행 환경 Extra High 추론모드 여부는 확인되지 않음.
