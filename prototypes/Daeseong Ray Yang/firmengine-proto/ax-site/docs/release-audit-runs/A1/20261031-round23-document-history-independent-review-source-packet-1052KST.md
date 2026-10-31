# FirmEngine A1 23차 — 문안 이력·2인 독립검수·법률 AI 출처 앵커

- **main 감사 기준:** `e1b8679a50e08f59a1f175f5a08dc86bf4e94e0f` (2026-10-31 KST, GitHub branches/main 조회). 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- **전 회차 이어받음:** A1 22차 IT/AX/CALC → 이번 서류담당자 `A1-DOC-015`, 변호사 `A1-LAW-015`, 데이터담당자 `A1-DATA-012`로 역할 교대. 최신 A1 22차 영수증, 중앙 보드, 기존 Draft PR #12/#28, 관련 domain/classifier/packet 원본문·스키마·테스트, 최근 커밋/PR을 조회.
- **실행 수준:** 실제 GitHub 함수본문에서 타입 표기를 제거해 V8 **격리 실행**. `structuredClone`은 합성 데이터에 한해 JSON 복제 polyfill 사용. 입력은 전부 인공 식별자/값. 실제 Node 원본 프로젝트 테스트, TypeScript, lint/build, 전체 CI, 브라우저, staging/운영 D1·R2, 법원 공식서식·변호사 승인/배포는 **미실행**. 작성된 Node 회귀가 통과했다고 주장하지 않음.
- **코드 변경:** main 실행 코드는 **변경하지 않음**. 신규 Draft PR #75에 출처 없는 법률 AI 근거 선택 보완 및 회귀 테스트 작성. 기존 동일 영역 PR #12/#28은 중복 변경하지 않고 격리 재검증.

## A1-DOC-015 — 문안 편집 및 기존 기록 불변성 ([ ] 부분검증)

- **main** `lib/case-mutation-classifier.ts` blob `2d151e8d0f6accbf980cda5a62626a0278d704bf`; **Draft PR #12** 동일 파일 blob `54ad07fe24ec380ac87f44aedf2d08768a1267ab` (미병합). 기존 테스트 `tests/workflow-only-source-watch.test.ts` blob `3d7d3ac8b4939dc5ba46a0073ec2878b3c31e9fe`.
- 합성 `context.revision=1`, 기존 `documentEdits=[{id:d-old,value:old}]`, workflow version을 1 증가시킴. **독립 기대:** 정상 편집 1건 append만 허용; 기존 편집의 내용 위변조·삭제, 출처 Fact 수정은 차단.
- **실제 원본문 7조건 전체 결과(main 3/7, PR #12 7/7)** 중 문서 편집 관련 4조건: main 정상 append ALLOW(일치), 과거 편집 위변조 ALLOW(**불일치**), 과거 편집 삭제 ALLOW(**불일치**), 원천 Fact 변조 BLOCK(일치). PR #12 네 조건 모두 독립 기대일치. 기존 P1 결함을 재확인한 것이며 신규로 중복 계산하지 않음.
- **경계:** `assertNonSourceCaseChange`의 저장 전 불변성 검증. 실제 직원 UI 편집→문서 재생성→D1 기록 재조회·Word 검수는 **미관찰**. PR #12 미병합·[ ] 유지.

## A1-LAW-015 — 담당자 제안자와 독립 변호사 서명 분리 ([ ] 부분검증)

- **main** `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; **Draft PR #28** 해당 함수 변경본 부분 blob `2c71536f0a89ab2e97158ca90cde99b761caf415` (미병합).
- 실제 `manifestFingerprint` / `manifestIssues` / `currentExportReviews` / `reviewExport` 함수 본문을 타입구문만 제거해 합성 `final` manifest에 실행. **독립 기대:** 동일 actor의 직원→변호사 연속 승인 금지, 같은 actor로 남은 과거 승인도 현재 변호사 승인으로 표시 금지; 서로 다른 actor의 적정 승인만 허용.
- **실측 main 5/7**, 후보 PR #28 **7/7**. main은 동일 actor 신규 이중승인과 과거 동일 actor 승인 재표시 **2건 잘못 수락**. 서로 다른 actor 승인, 직원 선행승인 부재, 만료된 fingerprint, 사건 revision 변경, draft 모드의 5조건은 기대일치.
- **경계:** 실제 인증 신원·다중 역할 권한·법률 서명·변호사 현업 검토·브라우저 사용성 미관찰. PR #28 병합 전, 과거 기록 삭제·법률상 확정 승격 금지.

## A1-DATA-012 — 앵커 없는 Fact의 법률 AI 입력 오염 (신규 P1 후보, [ ] 유지)

- **main** `lib/legal-review-packet.ts` blob `38b46feff4bb196c89d3a48ff97346846c9a9da9`. `pipeline.ts::reviewLegal`은 `currentFacts`를 `buildLegalReviewPacket`에 전달하고, `selectedFacts`는 원문 참조 유무 확인 없이 위험 feature key로 후보를 고름. 사후 `gateLegalReviewChecks`의 citation allowlist는 존재하나 **LLM에 전달되는 원문값 선별과 별개**.
- **합성 입력:** `income.net` 위험 feature 1건. `refs=[]` 및 `structuredRefs` 미설정인 문자열 `250000`, 실제 숫자 `0`, `null` 각각 1행. 문서 ref 1개 또는 구조화 record ref 1개인 행 각각 1개. 관계없는 key 1개. **독립 기대:** 앵커 없는 3행은 법률 AI `providedFacts` 미선정·coverage total=0, 앵커 있는 2행은 후보로 유지, 무관 필드는 미선정.
- **main 실제 `selectedFacts` 원본문 V8 3/6 기대일치:** 앵커 없는 문자열/0/null을 모두 제공된 근거로 계수(`featureCounts.total=1, provided=1`). 실제 모델 호출은 하지 않았고 법률 `pass` 인정이 일어났다고 주장하지 않음.
- **수정 Draft PR #75** https://github.com/firmengine/firmengine/pull/75 : `selectedFacts`에서 `refs` 및 `structuredRefs` 모두 비어 있는 행을 선별 전에 제거. 변경 코드 blob `1afd5539fe773788986cff69857013daa6132a1a`, 추가 테스트 blob `326271e9a6c53bb5a325db29cc17220bf44a29cb`, PR HEAD `92f5627850bf63a320d3a01918ce15742958edea`.
- **V8 실제 후보 실행:** 기본 6/6 기대 일치. PR branch 코드 재조회 후 `canonicalFieldGroups` 무참조/혼합 입력까지 확장한 **8/8 기대일치**. Node 원본 회귀 테스트는 **작성·커밋했지만 실행하지 않았음**. 법률 판단 및 미증빙 진술의 사전 검토 UX에 영향 가능하므로 **Draft·실무 승인 필요**.
- **잔여 한계:** 단순 참조 존재가 참조 유효성 증명은 아님. 허위 문서 ID·구판본·다른 사건 참조, `inventory/findings/transactionReview` 등 별도 모델 입력의 원천계보, 실제 계산 18종·법률95 체크·최종 서식의 전체 종단 추적은 미검증. `null`, 관찰 원화 `0`, 미관찰, 상충, 비해당, source-only, 승인전은 분리 유지.

## 판정 및 다음 순서

- **A1-DOC-015, A1-LAW-015, A1-DATA-012 모두 [ ] 미완료**. 코드를 읽은 것, 격리 함수 pass, 전체 CI, staging D1/R2, 공식 법원 서식 및 변호사 승인은 별개다.
- **기존 미병합 위험:** #12 문안/법률 이력 불변성, #28 동일 actor 승인. 신규 #75는 법률 AI 입력의 source-less 경계만 보강; 세 PR 모두 main 실행 코드 미적용.
- **다음 역할 순환:** IT `A1-IT-009`(D1 저장 후 R2 실패시 성공 위장), AX `A1-AX-006`(공식 출처 미조회시 검토보류), 계산사무장 `A1-CALC-011`(보수·우선/재단 비용 누락 계산 차단). 3 ID씩 실제 함수/합성 역조건/신규 회귀를 독립 검증.
- 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가확정 **수행하지 않음**.
