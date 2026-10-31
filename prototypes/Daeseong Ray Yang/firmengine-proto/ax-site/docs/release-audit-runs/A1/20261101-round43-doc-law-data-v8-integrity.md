# FirmEngine AX A1 43차 — 문서 편집 불변성 · 법률 의존지문 · 증빙 철회 전파
작성일: 2026-11-01 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 회차 순환: **서류담당자 A1-DOC-015 / 변호사 A1-LAW-016 / 데이터담당자 A1-DATA-017** (직전 42차 IT/AX/CALC).

## 공통 사전확인 / 판정
- 최초·쓰기 직전 관찰 main 최신 SHA: `58899e4147d470c410fcf5d433177bb7767c36d0`; 직전 42차 감사 최종 main은 `17ff58b887dc8103d518e9b9c8b53e2b4de16965`. 중앙 단일보드 읽기 blob `8249c02c460158eb38e51ba60015c66879504125`. main 최근 커밋 및 PR #12/#20/#78의 **Draft·미병합** 상태를 읽음.
- 실제 schema: `lib/case-workflow-state.ts` blob `e43ffe37a4f832d6f486633a6c7ae9054bb4e8d1`의 documentEdits/legalDispositions/reviewHistory/projectionBlockers; `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`의 Fact/typed/ExportManifest 분리; `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`의 명령 분기 확인.
- 기존 테스트 원문 확인: main `tests/workflow-only-source-watch.test.ts` blob `3d7d3ac8b4939dc5ba46a0073ec2878b3c31e9fe` 5개 test 정의, PR #12 동일 파일 blob `2ac558ba77aad2f3bf3063bb007062d7c54bc9e1` 7개 정의; main `tests/legal-review-identity.test.ts` blob `c2156ec147eaa8f1096716322be9f39470aa95af` 4개, PR #78 blob `4d1ef3e56685d0358c40229556257da3bd250157` 5개; PR #20 `tests/document-evidence-cascade.test.ts` blob `de192c4560c03d14a77caac0616c30e00a7554ef` 5개.
- **이번에 실행**: GitHub가 반환한 함수 원본문에서 TypeScript **타입·import/export 문법만** 제거한 후 자바스크립트 V8 격리 실행. 사용한 테스트 입력은 모두 아래 합성 JSON객체. 이 실행기는 `structuredClone`을 제공하지 않아 JSON round-trip clone을 동일 JSON 합성 인수에만 사용. Mock D1/HTTP/브라우저 없음. 신규 Node suite, CI, Word 생성, SQL/D1/R2/Cron, 공식법원 인정·변호사승인·운영 배포 **실행하지 않음**.

## A1-DOC-015 — 문서 편집·검수 기록 append-only [ ] 유지
- main `lib/case-mutation-classifier.ts` **blob `2d151e8d0f6accbf980cda5a62626a0278d704bf`**에서 `projected()`가 `document.edit`·`legalCheck.dispose` 이력 배열 전체를 비교에서 제외하는 기존 결함 재확인. 별도의 서버 명령 reducer는 1행씩 append하므로 **실제 클라이언트가 직접 위조할 수 있다고 입증한 것은 아니며**, 저장 경계의 불변식 결손에 대한 격리 반례.
- PR #12 `audit/a1-append-only-guard-20261030-1309` 코드 blob `54ad07fe24ec380ac87f44aedf2d08768a1267ab`; PR HEAD `205ea41b4d3622b9beff97fc98d3f36501357114`.
- 합성 이전 상태: `context={id:'synthetic-43',revision:4}`; workflow `documentEdits=[{id:'e0',value:'original'}]`, `legalDispositions=[{id:'l0',actor:'prior'}]`; manifest `files=[{id:'doc0',hash:'hash0',status:'current'}]`; 후속 workflow.version +1.
- 독립 기대/실제 [8조건]:
  1. 새 편집 1건 append 및 파일 invalidated → 허용 / main 허용 / PR 허용.
  2. 과거 편집 값 forged 후 append → 거절 / **main 허용** / PR `NON_SOURCE_DOCUMENT_EDIT_NOT_APPEND_ONLY`.
  3. 과거 편집 삭제 후 append → 거절 / **main 허용** / PR 거절.
  4. 동일 명령에서 편집 2건 append → 거절 / **main 허용** / PR 거절.
  5. 새 법률처분 1건 append → 허용 / main 허용 / PR 허용.
  6. 과거 처분 actor forged 후 append → 거절 / **main 허용** / PR `NON_SOURCE_LEGAL_DISPOSITION_NOT_APPEND_ONLY`.
  7. 과거 처분 삭제 후 append → 거절 / **main 허용** / PR 거절.
  8. 문안 edit와 무관한 evidence 필드 변경 → 거절 / main `NON_SOURCE_MUTATION_CHANGED_EVIDENCE` / PR 동일 거절.
- **main 3/8, PR #12 8/8 독립 안전 기대 일치.** 미관찰: Word 문안 실제 재생성·직원/변호사 클릭 검수·D1 저장 이력 무결성.

## A1-LAW-016 — 변경된 원문·계산·기준 지문과 기존 승인 [ ] 유지
- main `lib/legal-review-identity.ts` blob `be300beef76f2ca130293763a28932d9046dcf59`; PR #78 `audit/a1-r27-mixed-legal-dependency-20261031` blob `178452aa6bbf2a5f90914b230ba8910b5bd3157d`, PR HEAD `fc90fd5ea433d8706bebd9803faedb968059e1c8`.
- 합성 과거 사람 승인: `{checkId:'C01',runId:'r-old',subjectFingerprint:'S-1',dependencyFingerprint:'D-old',status:'accepted'}`; 원래 AI 실행은 동일 C01/S-1/D-old status `pass`, 재계산 실행은 ID `r-new`/dependency `D-new`, status `pass`. AI pass는 사람의 accepted와 별개.
- 실제 원본 함수 본문 V8 **11조건**: 현재 단일승인, 실행없음, 변경 지문 실행만 존재, 구/신 동일 pass 혼재, 혼재 순서 역전, AI pass/fail 충돌, 다른 check, 다른 subject, 동일 지문 추가 run, 과거 rejection 차단 유지, 주체 변경.
- 독립 기대와 **main 9/11** 일치. 구/신 **서로 다른 dependencyFingerprint에 동일 status=pass가 혼재한 2건**은 `accepted` 오유지. PR #78의 실제 브랜치 본문은 **11/11** 기대 일치.
- 중요한 인과 한계: `case-workflow-server.ts` blob `7e1a96e79afcdc0ff81e950fe52556b2794ab465` / 최종 `app/api/cases/[id]/export/route.ts` blob `4f9384e840517455cdec25f0fa734b593d31e533`는 현재 semantic fingerprint·source version·reference hash를 선필터함. 따라서 이번 격리 허용으로 운영상 구판본 승인이 실제 final export에서 통과했다고 **주장하지 않음**. 95 체크·서식·변호사 재승인 E2E 미검증. PR #78 미병합 / 법률적 의미 변경 검토 필요.

## A1-DATA-017 — 서류 철회·페이지 재분류 이후 typed 소비처 [ ] 유지
- main `case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`의 실제 `document.retract` 및 `document.role` 분기에서 원문 Fact 철회와 documentMatches stale·review reset은 확인, **철회된 factId를 참조하는 typed 행의 구 `factIds` 및 `recognition/legalReview` 무효화 호출은 부재**. 기존 P0 후보이며 신규 중복 집계하지 않음.
- PR #20 `audit/a1-document-evidence-cascade-20261030-1452` HEAD `1395c93fb305700332c1c6604a1bcf332f56b562`, 추가 helper `lib/document-evidence-cascade.ts` blob `711927af2aee618e6abbef4dec03703513923948`.
- 합성 이전 typed 원장: 소득 i1 F1+F2 `accepted` 금액 500000, 채무 d1 F1+F3 `legalReview=accepted` 원금300000, 독립 채무 d2 F8 `accepted` 원금800000, 자산 a1 F4 `accepted`, 거래 t1 F5, 가구 F6 `accepted`, inventory income/debt/asset=yes. 실제 PR #20 helper 원본문 V8 실행 **8/8 독립 기대 일치**:
  1. F1 철회 → 소득/채무 승인 해제·F2/F3 및 금액 유지·무관 d2 보존, 대상 2개.
  2. F3만 철회 → d1만 재검토/원금 보존.
  3. F4 철회 → 자산 인정 해제/금액 보존.
  4. F5 철회 → 거래 factIds 제거, 거래금액 보존.
  5. F6 철회 → 가구 인정 해제/가구 factIds 공백.
  6. 미연결 F9 철회 → 대상 0, inventory 3종 unknown(보수적).
  7. F1 중복철회 목록 → affected 2개로 중복 표기 방지.
  8. 빈 목록 → 대상 0, 원장 변화 없음.
- main에는 helper가 없으므로 **PR의 helper만 단위 실행**한 결과이다. PR의 `reduceCaseCommand` 연동, `document.role` 변경 API→D1 영속화→18계산/95법률/서식 재투영, 85문서·복수행·갈음 A←B+C·다른 동시 사건 보존은 미검증. 실무자 승인 없이 typed 인정 자동승격 금지.

## 조치 / 종료·다음 인수
- 이미 동일 결함을 대상으로 하는 **Draft PR #12/#78/#20이 각각 존재·미병합**이므로 다른 에이전트 파일을 덮거나 충돌 PR을 중복 생성하지 않음. 이 회차 제품 코드 변경 **0건**, 신규 PR **0건**. 모든 위 수치는 재현에 사용한 **V8 격리 조건**이지 Node/CI/staging/운영 영수증이 아님.
- **A1-DOC-015 / A1-LAW-016 / A1-DATA-017 모두 [ ]**. 현재 각 수정 후보가 합성 반례를 차단한 사실과 전체 제품 인수는 구별.
- 다음 회차 역할 **IT/AX/CALC**: 우선 **A1-IT-013**(동시 직원 수정·다중 사건 격리), **A1-AX-009**(95개 법률 Agent의 빈값/오류 강등), **A1-CALC-008**(담보/보증 중복 합산). 반드시 최신 중앙 보드 ID·직전 PR/영수증·소스 SHA를 재확인하고 실제 미검증 항목만 선택.
- 운영 배포·D1 운영 마이그레이션·실제 전자제출·법원 인가 확정 **수행 안 함**. 전체 제품 인수 완료 **0건**. 현재 런타임의 Extra High 추론모드 실제 설정 여부 확인 불가능.
