# A1 기능·충돌 감사 — 2026-10-30 13:09 KST (회차 1)

> **소스 기준**: GitHub `firmengine/firmengine` main `5c0c5332bc2091547a95d106c4170639ed743690`. 다른 에이전트 커밋은 시작 시 `main` 최신 HEAD, 최근 15건과 open PR(0건)을 확인. 변경 파일은 `ax-site/` 안에서만. 실제 의뢰인 정보·원문·시크릿 사용 안 함.

## 이 회차 체크 ID와 결과(3개 담당자 관점)

| 체크 ID | 담당 관점 | 관찰 상태 | 검증 근거·후속 |
| --- | --- | --- | --- |
| `A1-LAW-015` | 변호사 | **DEFECT_REPRODUCED / PR_PENDING** | 오래된 `legalDispositions` 한 행을 위조하고 새 승인행 하나를 추가해도 기존 `assertNonSourceCaseChange(...,"review_only","legalCheck.dispose")`가 **허용**하는 반례 확인. append-only 불변식 강화 PR #12. 법률 전문가 승인·실제 REST exploit 여부는 미검증. |
| `A1-DOC-015` | 사용자·서류담당자 | **DEFECT_REPRODUCED / PR_PENDING** | 오래된 `documentEdits` 행을 변조하고 새 행 하나 추가해도 review-only guard가 **허용**하는 반례 확인. 새 guard는 기존 편집 이력 보존 + 한 행 append만 허용. 직원 UI/Word 재생성 E2E는 미검증. |
| `A1-DATA-011` | 데이터담당자 | **CODE_REVIEWED / SYNTHETIC_GUARD_PASS / PR_PENDING** | 과거 검토·문안 이력 불변성 계약을 점검. 현재 reducer는 append 기반이지만 별도 저장 게이트는 배열 전체를 투영에서 제외해 위변조를 구분하지 못했다. 수정 후 합성 반례 차단. 실제 D1 trigger/transaction 인증 미검증. |

## 사용한 실제 코드·DB 경계

- `lib/case-mutation-classifier.ts` main blob `2d151e8d0f6accbf980cda5a62626a0278d704bf`: `projected()`에서 `legalDispositions`·`documentEdits` 배열 **전부** 비교를 생략한다. 다만 `business.net.propose`는 독립 append-only 검사가 이미 존재했다.
- `lib/case-commands.ts` `legalCheck.dispose`는 서버 확인된 법률 run/현재 사실/역할을 검증한 후 한 처분 행을 append한다. `document.edit`는 server-loaded `baseValueHash`를 확인하고 문서 수정행을 append하며 현행 생성물과 사람 검수 상태를 무효화한다. 따라서 본 결함은 **현재 클라이언트가 직접 위조할 수 있다고 입증된 취약점이 아니라, 저장층 불변식의 방어 심도 부족**이다.
- `lib/case-command-store.ts`는 서버에서 actor·role·현재 legal run을 조회하고 `expectedRevision/expectedStateFingerprint`를 확인한 뒤, `server-store.ts`의 DB `storage_token` CAS로 저장한다. 해당 경계는 소스 정적으로 확인했으며 실제 브라우저 2개·D1 경쟁 테스트는 실행하지 않았다.
- `tests/workflow-only-source-watch.test.ts` main blob `3d7d3ac8b4939dc5ba46a0073ec2878b3c31e9fe`: 기존 사업소득 제안 append-only 테스트는 있지만 법률 검토/문안 편집 **기존 행 변조** 반례는 부재했다.

## 합성 재현 입력·독립 기대값·실제 관찰

원본 고객 자료 아닌 합성 JSON: `caseId=synthetic`, `revision=3`, `facts=[{id:fact,value:"10"}]`, 기존 `legalDispositions=[{checkId:"old",status:"accepted",actor:"actor-old"}]` 및 `documentEdits=[{id:"old-edit",value:"text-old"}]`, 검토기록 `workflowState.version=1` 구성.

1. **기존 소스**를 GitHub connector로 읽고 순수 TypeScript 주석·타입 표현만 제거한 동일 함수 본문을 V8 JavaScript로 실행했다. 기존 법률 승인 actor를 `forged`로 변경 후 새 승인행 append: 기대 거부 / **실제 ACCEPTED**. 기존 문안 편집 값을 `tampered`로 변경 후 신규 편집행 append: 기대 거부 / **실제 ACCEPTED**.
2. **수정 후보 함수**에 append-only 계약을 넣은 후 같은 방법으로 6개 합성 조건 직접 실행: 정상 법률 append **허용**, 기존 법률행 변조 **거부**, 법률 이전행 삭제 **거부**, 정상 문안 추가·산출물 invalidation **허용**, 과거 문안 내용 변조 **거부**, 원본 fact 위조 **거부**. 결과 **6/6 기대 일치**. 이는 **V8 변환 함수 단위 실험**으로, Node 전체·프로젝트 타입체크나 실제 D1/R2 통합 실행으로 간주하지 않는다.

## 능동적 수정과 실제 Git 상태

- 수정 브랜치: `audit/a1-append-only-guard-20261030-1309` (main `5c0c533...` 기준).
- `lib/case-mutation-classifier.ts`: 법률 승인/문안 편집에 기존 배열 보존 + 신규 한 행 append 불변식, 허용하지 않은 변경은 각각 `NON_SOURCE_LEGAL_DISPOSITION_NOT_APPEND_ONLY`, `NON_SOURCE_DOCUMENT_EDIT_NOT_APPEND_ONLY`.
- `tests/workflow-only-source-watch.test.ts`: 정상 append, 과거 행 변조/삭제/두 행 추가(법률/문안 각각)에 대한 회귀 단언을 추가.
- 브랜치 커밋: `a4d26d1bebf08bff38529b53b31c3dd67b6f0d25` (코드), `205ea41b4d3622b9beff97fc98d3f36501357114` (테스트). **초안 PR #12**: https://github.com/firmengine/firmengine/pull/12. 미병합; main의 현재 구현은 아직 옛 guard다.
- 전수 Node 프로젝트 시험/CI/빌드, Cloudflare staging D1/R2, 사이트 배포, 실제 법원 폼·변호사 승인 **미실행**. 전용 저장소 clone이 이 작업 환경에서 인터넷 호스트 해석 실패로 불가능. PR은 검증 전 병합하지 않는다.

## 다음 회차 핸드오프

1. **A1-IT-010**: 실제 D1 `storage_token`·같은 사건 두 브라우저 충돌 재현 및 같은 head 분기.
2. **A1-AX-014**: 빈/누락 법률·서식 projection에서 writer가 실제로 호출되지 않는지 통합 확인.
3. **A1-CALC-018**: 변호사 채택 사업소득 후 이전 소득기간·청산가치·변제계획 승인 동시 무효화.
4. PR #12의 `npm ci`, `node --test`, `npm run lint`, `npm run build`, E2E 성공 후에만 병합 후보. 다음 검토에서도 현재 main 커밋을 재조회하고 최근 작업을 덮어쓰지 않는다.

**상태 요약:** 3개 체크 ID 코드 심층 리뷰(전부 최종 미완료), 검증 가능한 저장층 불변식 결함 2종을 **합성 재현**, 수정 테스트 포함 draft PR 1개, 운영/법률 인수 합격 0건.
