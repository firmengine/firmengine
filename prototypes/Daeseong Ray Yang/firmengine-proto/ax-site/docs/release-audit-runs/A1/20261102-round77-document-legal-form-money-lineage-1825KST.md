# FirmEngine A1 — 77차 코드 완결성·상호 기능충돌 독립감사 (2026-11-02 KST)

- 범위: **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만**. 이전 76차 IT/AX/계산사무장 → 이번 **사용자·서류담당자 A1-DOC-015 → 변호사 A1-LAW-016 → 데이터담당자 A1-DATA-015**. 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 세 ID 모두 **[ ] 미완료**.
- 감사 시작 관찰 GitHub main **`4bbfbf233ce8767b36841e9c08ff0c9a824410d6`**, PR 쓰기 전 재조회 main **`a7626fb697781cf7b295f43ad3e9118cb3de5a22`**. 최근 main 커밋·open PR #12/#78/#100/#124 및 직전 76차·43차·49차 영수증 확인. 최신 main SHA는 병렬 에이전트 커밋으로 변경될 수 있다.
- 원천 및 기존 테스트 확인: `lib/case-mutation-classifier.ts` main blob `2d151e8d0f6accbf980cda5a62626a0278d704bf`, `lib/legal-review-identity.ts` `be300beef76f2ca130293763a28932d9046dcf59`, `lib/lawgraph-document-field-projection.ts` `a017294aa814f4d33360c2531abf91d9eb79a6e0`; `lib/case-workflow-state.ts` `e43ffe37a4f832d6f486633a6c7ae9054bb4e8d1`; `lib/form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`, 기존 `tests/workflow-only-source-watch.test.ts` `3d7d3ac8b4939dc5ba46a0073ec2878b3c31e9fe`, `tests/legal-review-identity.test.ts` `c2156ec147eaa8f1096716322be9f39470aa95af` 및 #124 회귀 `170df7b81c3222fd82f2c39383fedaff9a337af0` 읽음. 다른 축이나 운영 리소스는 변경하지 않음.
- 실제 실행: 위 GitHub에 저장된 **함수 본문**에서 TypeScript 타입·import/export 구문만 일부 제거해 V8 `Function` 격리 실행. DOC에서는 이 환경의 `structuredClone` 미지원 때문에 **합성 JSON 객체에 한해 JSON round-trip clone**을 대체했다. DATA는 `FORM_CONTRACTS`, `BASIC_FORM_CODES`, `currentFacts`, `requiredKindsForCase`, `factSourceLineageIssues`를 D5103 단일 반복행의 **합성 의존성**으로 대체했다. 이는 실제 Node 프로젝트 테스트나 D1/Word 종단검증이 아니다.

## A1-DOC-015 — 문안 편집·법률처분 이력의 append-only 검증 [ ]

- 실제 입력: 사건 `s77` revision 5, 기존 documentEdits `d0`, legalDispositions `l0`, 기존 exportManifest 및 합성 Fact `F1`. 허용 명령 `document.edit`, `legalCheck.dispose`를 각각 적용.
- 독립 기대/관찰 **8조건**: (1) 새 편집 1건 append·파일 invalidated 허용(main 허용), (2) 이전 편집 본문 forged 후 append 차단(**main 허용**), (3) 이전 편집 replace 차단(**main 허용**), (4) 편집 2건 동시 append 차단(**main 허용**), (5) 법률처분 1건 append 허용(main 허용), (6) 이전 처분 accepted→rejected forged 후 append 차단(**main 허용**), (7) 법률처분 2건 append 차단(**main 허용**), (8) Fact 원천값 변경 차단(main `NON_SOURCE_MUTATION_CHANGED_EVIDENCE`로 차단).
- **main 3/8, 기존 [Draft PR #12](https://github.com/firmengine/firmengine/pull/12) 코드 blob `54ad07fe24ec380ac87f44aedf2d08768a1267ab` 8/8** 독립 기대 일치. 기존 P1 결함 **중복 집계하지 않음**. 실제 인증된 명령 reducer·Word 재생성/편집 화면·D1 영속이력·실무자 검수는 미검증. PR #12 미병합.

## A1-LAW-016 — 새 근거 지문과 과거 사람 승인 혼재 [ ]

- 실제 입력: `{checkId:C01,runId:R-old,subjectFingerprint:S,dependencyFingerprint:D0,status:accepted}`; 법률 AI 결과 `R-old/D0/pass`, 새 실행 `R-new/D1/pass`, 충돌 fail, 다른 check, 동일 dependency 복수 run 등 **6조건**.
- 독립 기대/관찰: 과거 실행만 있으면 accepted, 새 실행만 있으면 needs_review, **구+신 의존지문이 같은 pass로 섞인 경우도 needs_review**여야 하지만 main은 accepted, pass/fail 충돌 needs_review, 다른 check needs_review, 동일 의존지문 추가 실행 accepted. **main 5/6**, 기존 [Draft #78](https://github.com/firmengine/firmengine/pull/78) blob `178452aa6bbf2a5f90914b230ba8910b5bd3157d` **6/6**.
- 기존 P2 이력 문제 재검증. 실제 상위 API와 최종 export의 current semantic hash 필터가 있기 때문에 이 격리 반례만으로 법률 인가·최종 승인 우회를 주장하지 않음. **법률 AI pass는 변호사 accepted가 아님**. 95체크·신규 원문·D1 저장·공식서식·실변호사 독립승인 E2E 미검증; PR #78 미병합.

## A1-DATA-015 — 서식 토큰과 계산값의 잘못된 원화 숫자 동치 [ ] (신규 P2 후보)

- 실제 main 원인: `sourceNumeric=(x)=>x.replace(/[,\\s₩원]/g,"")`에 의한 무조건 구분자 제거, `sameValue`가 계산 token provenance의 정확값 일치에 재사용됨. 합성 D5103 `month.net_income`에서 표시 `"1,00"` vs 계산 `"100"`, `"1,,000"` vs `"1000"`, `"1 00"` vs `"100"`을 **main이 `linked_calculation`으로 잘못 연결**한다. 계산금액 자체·Word 서식 원문·법원 효력 변경을 입증한 것은 아니며 **계보 검증 상태의 오연결 위험**이다.
- 9조건의 교차 재현(정상값/invalid comma·공백/null subject/provisional/철회원천): **main 3/9, 기존 PR #100 5/9, 기존 PR #124 4/9** 독립 안전 기대 일치. 서로 해결하는 축이 다르므로 단일 수정안이 모든 영역을 해결했다고 보지 않음.
- 기존 [Draft #124](https://github.com/firmengine/firmengine/pull/124)의 HEAD `c607406a68368cfe4774c88cb5336f44ac44d2d5`, 정확한 소스 blob `86efb1a328516cecbf17ad2824ea9594c86cc227`에서 별도 **stacked Draft [PR #184](https://github.com/firmengine/firmengine/pull/184)** (HEAD `d97015ee71f552835073eb6c4fccded624b95933`) 생성. 코드 blob `85231d444dfed645d5dbc9b564242fd062f65975`; 신규 Node 회귀 테스트 `tests/a1-r77-form-token-won-lineage.test.ts` blob `b382163b1966e8e6be1e285905b8a460a0439ddb` (3 test 블록 **작성·커밋했지만 실행하지 않음**).
- 수정은 **계산→서식 원화 토큰 동치**에만 표준 정수/천단위 쉼표 검사(`exactWonLineageMatch`)를 도입, 기존 text-source matching/원천 Fact/계산 산식·금액·승인을 변경하지 않음. 동일 합성 14조건에서 PR #124 원본 **8/14**, #184 수정 후보 **14/14** 기대 일치. 정상 `1,000`, `₩1,000원`, 명시적 `0`, 음수 `-100`은 링크 보존; 잘못된 쉼표·공백·양측 malformed·다른 subject는 링크 차단. GitHub에 커밋된 #184 원본 코드 blob 재조회 확인.
- **중요한 통합 미완료**: #184는 #124의 subject 격리 기능을 기반으로 하고 **#100의 provisional/철회원천 수동검토 방어는 포함하지 않는다**. #184 실제 단독 7조건 5/7(잠정·비승인 Fact 누락), #100+#124+#184 **메모리상 함수 결합** 7/7; 실제 Git merge/Node·전체 CI/D1/Word 결과가 아니다. #100/#124 동일 파일 충돌과 렌더링 허용 포맷·공식서식·사람검토를 해결하기 전 main에 병합하지 말 것.

## 조치·다음 작업

- 제품 실행 소스의 **main 변경 0건**. 코드 수정은 Draft PR #184에만 있고, #12/#78/#100/#124와 통합되지 않음. 모든 A1 인수 ID **[ ]**, 제품 전체 종단 인수 **0건**.
- 다음 순환은 **IT담당자 → AX담당자 → 계산사무장**, 우선 `A1-IT-014` (export artifact 실패/취소), `A1-AX-009` (OCR 복수행 오병합), `A1-CALC-007` (하나의 Fact ID 다중 원장 소비).
- **미실행/미관찰:** 전체 Native Node 회귀, TypeScript, CI, 빌드, 실제 브라우저·D1/R2/Cron, OCR 85서류, 18계산 및 95법률 전체, Word/공식 법원 서식, 변호사 승인, 사이트 배포. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 **수행 안 함**. 현재 환경 Extra High 추론 모드 설정 **확인 불가**.
