# FirmEngine A1 27차 — 갈음서류 부분충족·법률 실행 지문 혼재·정정 이력

- 기준: 2026-10-31 KST. 감사 시작 `main` HEAD `356464407ea799fe28aa7d9c35ab83d333e68674`; 영수증 기록 직전 재확인 HEAD `356464407ea799fe28aa7d9c35ab83d333e68674`.
- 범위: `firmengine/firmengine` main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위, 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A1-DOC-011 / A1-LAW-016 / A1-DATA-011**. 직전 IT·AX·계산사무장 → 이번 **서류담당자·변호사·데이터담당자** 순환. 3개 모두 **[ ] 부분검증**, 제품 전체 인수 0.
- 먼저 확인: main SHA 및 최근 A4/A3/A2/A1 커밋, 미병합 Draft #57/#20/#12/#77, 전회차 `20261031-round26-export-ocr-row-identity-payment-terms-1356KST.md`, 중앙 보드, Drizzle `db/schema.ts`, 기존 테스트와 아래 실제 코드.
- 소스 blob: `lib/document-substitution.ts` `9fea9344b923c961fe333761df99ddde431ce1bc`; 비교 PR #57 수정 blob `69e28b8462a58f9b65cef20d744605d4c78619cd`. `lib/legal-review-identity.ts` `be300beef76f2ca130293763a28932d9046dcf59`, `tests/legal-review-identity.test.ts` `c2156ec147eaa8f1096716322be9f39470aa95af`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378`, `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 검증 수준: 원본 TypeScript **함수 본문 일부를 타입 제거해 V8에서 실제 합성 실행**; 인가된 갈음 정책과 원천 Fact SHA는 고정 합성 stub, 지문 계산의 `commandHash`는 결정적 JSON serializer stub, Fact 이력 테스트의 UUID/clone/money 도우미도 합성 stub. 이 결과는 **프로젝트 Node/CI, Cloudflare D1/R2, 브라우저, 공식 법원 서식, 변호사 승인 검증이 아니다**.

## A1-DOC-011 — A←B+C 부분충족과 행정·기존서식 페이지

독립 기대: 정책상 선택한 B+C 중 C가 없거나, C가 행정/기존서식 페이지일 때 원요청 A는 계속 활성. `reconcileDocumentSubstitution` 실제 main 함수와 Draft #57 동일 함수의 독립 비교:
- 6 기본조건: B+C 정상증빙→A 비활성, B만 제출→A 활성, C Fact 철회→A 활성, C 행정페이지이되 증빙 필드 누락→A 활성, C 기존서식이되 증빙 필드 누락→A 활성, C 문서 삭제→A 활성. **main 6/6**, PR #57 **6/6**.
- 핵심 반례 3조건: **B가 두 필수 사실 모두 제공**, C의 accepted match 자체는 있으나 C 페이지 역할만 `evidence` / `administrative` / `filed_form`으로 변경. 정상 evidence→둘 다 A 비활성. **main은 C administrative 및 filed_form 두 조건에서 A 비활성이라는 잘못된 결과**, PR #57은 A 복원(`SELECTED_ALTERNATIVE_NOT_MATCHED`). 이 3조건 main **1/3**, PR **3/3**.
- **합계 main 7/9, PR #57 9/9**; 기존 P1 결함 **재현**이지 신규 결함 중복 집계 아님. PR #57은 미병합 Draft, Node 회귀/법원 실제 갈음 규칙/85서류/주체·기간 UI E2E 미확인. 원문 판정·법적 갈음 허용으로 승격 금지.

## A1-LAW-016 — 오래된 승인과 이질적 근거의 동시 실행

- `currentLegalDispositionOutcome` 원본 함수 V8: 승인 `C01/run-old/subject/dependency-A`, 같은 항목·주체의 `run-new/dependency-B`가 함께 있고 **두 결과가 모두 PASS**라면, 과거 승인 재사용 대신 `needs_review`가 독립 기대. 기존 main은 옛 run이 남아 있으면 실행 배열 정·역순 모두 `accepted` → **9조건 중 2건 불일치(main 7/9)**. 동일 dependency 중복 실행, 다른 주체, PASS/FAIL 상충, 명시적 거부/미승인은 기존 기대 준수.
- 재사용 함수의 보수적 수정: `accepted` 검토 중 같은 check/subject를 가진 실행에 **다른 dependencyFingerprint**가 있으면 `needs_review` 유지. 실제 수정 함수 V8 **9/9 기대 일치**.
- `legalReviewInputFingerprint` 함수 본문 합성 7조건: revision-only 유지; 새 문서 원천 SHA, 기준 rule release, plan months, Fact 값, reference SHA, execution contract 변경은 지문 변경 — **7/7 기대 일치**(실제 SHA256이 아닌 결정적 hash stub 사용).
- **신규 P2 후보/재사용 함수 경계 결함**, 실제 운영 노출·법률 판정 변경 확인 아님. 현재 `case-workflow-server.ts`와 `app/api/cases/[id]/export/route.ts`가 먼저 현재 의미 지문·dataVersion·reference 등을 필터링하므로 혼재 입력이 실제 종단 경로에 도달한다는 증거는 없다.
- 코드+Node 회귀 테스트(5 assertions)를 **[Draft PR #78](https://github.com/firmengine/firmengine/pull/78)**에 작성·커밋, 브랜치 `audit/a1-r27-mixed-legal-dependency-20261031`, HEAD `fc90fd5ea433d8706bebd9803faedb968059e1c8`. 수정 blob `lib/legal-review-identity.ts` `178452aa6bbf2a5f90914b230ba8910b5bd3157d`, 테스트 blob `4d1ef3e56685d0358c40229556257da3bd250157`. PR diff의 변경파일 2개는 모두 ax-site 내부. **Node 테스트 작성만, 미실행**; 전체 95검토/실제 D1·R2/변호사 검토 전 병합 금지. 기존 typed 인정 잔존 [PR #20](https://github.com/firmengine/firmengine/pull/20)과 분리.

## A1-DATA-011 — Fact 정정·철회와 이벤트 영수증

실제 `lib/domain.ts`의 `currentFacts` / `validSourceRef` / `touchCase` / `reviewFact` / `retractDocument` 함수 본문 V8 **6/6 독립 기대 일치**:
1. extracted v1 → verified v2: 과거 v1 불변, 현재 v2, typed factId 재매핑.
2. verified v2 → accepted v3: v1·v2 보존, 현재 v3만 인정.
3. 정정 → reported/unreviewed v4: v1–v3 유지, 문서 export `invalidated`, 변호사 export 검토 null, revision 증가. 원문과 신값은 명확히 구분.
4. 원본 문서 철회 → deleted, 새 retracted v4, `currentFacts` 0, inventory income/debt/asset `unknown`, 이전 사건 스냅샷 불변.
5. 이미 철회한 원본의 재철회 거절.
6. administrative 페이지 Fact를 verified로 승격 거절.
- 코드 연결 정적 확인: `case-commands.ts`의 fact.correct→`applyFactProjection`, 사실의 하향검토→`invalidateFactSupport`; `server-store.ts`의 `saveCase`가 D1 CAS batch로 `case_mutation_receipts`, `events`(`case.command_committed`), before/after R2 snapshot 포인터를 연동. `db/schema.ts`는 receipt 사건/명령 ID unique, `case_data_change_events` append-only table 정의. **실제 D1 batch 및 R2 바이트/재시도·동시사건 검증은 하지 않았다**. 이전 문서 철회 typed 인정 잔존 PR #20, review-only 과거이력 변조 PR #12 미병합; 부분검증만 완료.

## 코드 조치·최종 상태·다음

- main 제품 코드 **변경 없음**. A1-LAW-016 코드 및 회귀 작성은 변호사 검토가 필요한 **Draft PR #78** 별도 보관. PR #57/#20/#12 기존 수정과 중복 변경하지 않음.
- **고유 합성 입력 31건, 실제 V8 비교 실행 49건:** DOC9(main+PR #57 각 9회), LAW9(main+수정 후보 각 9회), 지문7(main), DATA6(main). main은 DOC 7/9 + LAW 7/9 + 지문 7/7 + DATA 6/6 = **27/31 독립 기대 일치**. 별도 후보 비교 18회는 DOC PR #57 9/9, LAW PR #78 9/9 기대 일치. Node 회귀 새 테스트는 작성만/미실행.
- 인수 상태 **A1-DOC-011 [ ] / A1-LAW-016 [ ] / A1-DATA-011 [ ]**, 제품 전체 인수 완료 0. source-only·V8 격리 / 전체 Node·CI / staging D1·R2·Cron / 공식 서식·변호사 승인 / 사이트 배포는 서로 구분한다.
- 다음 순환 **IT담당자·AX담당자·계산사무장**: `A1-IT-017` (Git main과 배포 source/schema/reference release 지문), `A1-AX-010` (모델/프롬프트/원문/reference 버전), `A1-CALC-013` (총 변제액·채권별 배분·현재가치·청산가치).
- 공개 Git에 고객자료·개인정보·원본 OCR 사실/키/.env/비공개 정답 미기록. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 미수행.
