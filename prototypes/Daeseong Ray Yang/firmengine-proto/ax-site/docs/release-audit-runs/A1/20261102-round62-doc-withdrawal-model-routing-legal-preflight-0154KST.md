# FirmEngine A1 62차 — 상하위 문서 철회 · AI 모델 라우팅 · 법률 조기 호출 차단

- 회차 시작 2026-11-02 KST (01:54), GitHub `main` 시작·코드 재확인 HEAD `1b847a0c4802f1fb12402936ce637dfc03ad4775`.
- 중앙 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 시작 blob `e0e66e74792a7f3ee96c4ef75097ead2af0a2962`. 바로 앞 A1 61차 영수증 blob `53e4daae7f8cd72956c385982fdefa6832ded4eb` 및 최근 커밋·미병합 PR·스키마·실제 코드를 확인했다.
- 역할: **IT담당자 / AX담당자 / 계산사무장**. 대상 **A1-IT-006, A1-AX-001, A1-CALC-017** (3개). 세 ID **[ ] 미인수 유지**.
- 엄격한 증빙 단계: 아래의 실험은 실제 GitHub 소스에서 추출한 **V8 격리 실행**, 해당 SQL의 **Python sqlite3 in-memory 재현**, 호출점 정적 확인이다. 전체 Node 테스트, GitHub CI, 실제 Next.js HTTP, staging D1·R2·Cron, AI API 호출, 브라우저·85종 전체 문서·공식 서식·변호사 검토·운영 배포가 아니다.

## A1-IT-006: 상위 문서 철회 후 하위 OCR 작업 잔존 — 기존 P1 재확인

**원본 SHA:** `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378`; `lib/case-command-store.ts` `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.

실제 reducer `retractDocument`는 parent→child→grandchild를 `deleted`로 전이하고 `reduceCaseCommand`는 `impact.withdrawPageJobs`에 전이된 ID 전체를 저장한다. 반면 **main SQL**의 `document.retract` guardedStatement는 `command.target.documentId` **단 한 ID**만 대상으로 `page_jobs.status='withdrawn'` 처리한다.

**합성 SQL 재현(직접 실행):** 메모리 SQLite의 `cases(case-a,revision=2,token-2)`, `page_jobs(parent,child,grandchild,unrelated)`, 네 작업 모두 `processing`, lease 유효로 초기화. main의 정확한 단일-ID 조건부 UPDATE를 실행했다. 독립 기대 `parent,child,grandchild=withdrawn; unrelated=processing`. 실제 `parent=withdrawn`, `child,grandchild,unrelated=processing`: **2/4 일치, 자식 2건 위배**. 같은 SQL에 reducer의 세 affected ID를 각각 적용한 비교 격리는 **4/4 일치**, 오래된 revision/token UPDATE는 무변경 **1/1**. 이는 D1 실제 batch 통과 증거가 아니다.

기존 [Draft PR #88](https://github.com/firmengine/firmengine/pull/88)는 **미병합**(HEAD `359d1ec9e6b888477952630879800aa3058d4787`). `lib/document-withdrawal-targets.ts`의 Git blob `de1b174ddd31af9195ce5fe33185d52912ce9246`에서 실제 함수 본문(TypeScript `Set<string>` 타입만 제거)을 실행한 합성 7조건(정상 3계층, 단일, 중복제거, 부모 누락, 빈 목록, null, 공백)은 **7/7 독립 기대 일치**. 실제 제품 코드 병합이나 CI 테스트는 실행하지 않았다. 기존 수정 PR 중복 작성 없음. **[ ]**.

## A1-AX-001: 상담·OCR·법률 모델 라우팅 — 코드 계약 부분 합격

**원본 SHA:** `lib/luna.ts` `e8ad1246888e42087cf94ef792c8285cae2541d1`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/intake-store.ts` `c0bdea9443a018a46c080a8e39a74a0daf62759f`; `lib/intake-classifier.ts` `3e07327750e0330baceee79dc5608758a862d3e2`; `lib/pipeline.ts` 현재 main 확인.

**실제 원본 모델 선택 표현식 V8 격리 6/6 일치:**
1. `consultation_classifier` → `gpt-6-luna`;
2. `legal_checklist_reviewer` → `gpt-6-luna`;
3. `document_classifier` + 명시 OCR → `gpt-6.1-terra`;
4. `source_verifier` + 명시 OCR → `gpt-6.1-terra`;
5. `legal_review` + 명시 terra를 전달해도 법률 prefix 우선 → `gpt-6-luna`;
6. `document_classifier` 기본값 → `gpt-6.1-terra`.

`domain.ts`의 `OCR_MODEL=gpt-6.1-terra`, `CONSULTATION_AI_MODEL=gpt-6-luna`를 원본으로 확인. `intake-store.ts`는 **`CONSULTATION_AI_MODEL as AI_MODEL`로 별칭 import**하므로 상담 결과·semantic fingerprint가 OCR 모델을 잘못 기록하는 문제는 **없음**(별칭 원문 재확인). `pipeline.ts`의 분류/추출/재검증에 명시 `OCR_MODEL`, 법률 `agent:legal_checklist_reviewer`, `intake-store.ts`의 `callLuna(classifierRequest)`를 정적 연결 검사했다. 계산 노드는 `case-agent.ts`의 in-process deterministic `calculate_case` 도구이며 LLM 산술 승인과 다르다.

`luna.ts`는 Responses 요청 `reasoning.effort=args.reasoningEffort??'low'`, `intake-classifier.ts` 요청은 `medium`으로 선언. 실제 모델 접근권, provider 실행, 응답·비용·Extra High 적용은 **관찰하지 않았다**. 공식적 실행환경 추론 모드 Extra High 설정 주장 금지. 정적·V8 계약만 일치했으므로 **[ ]**.

## A1-CALC-017: 법률 AI 선행 계산·원천 게이트 — 기존 P1 두 영역 재확인

**원본 SHA:** `lib/case-legal-calculation-preflight.ts` `c17892e63bf00d2981f292b0ef28e032d66a8dc7`; `app/api/cases/[id]/process/route.ts` `e153bdb44ec7614de4cd9a9adfaf76e5e7fc4b64`; `lib/case-legal-source-preflight.ts` `0a4bf038a97de015652d4957a56ecddd5c049bd8`; 계산 저장 스키마 `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.

**계산 타입 방어 실험:** `evaluateLegalCalculationPreflight` 실제 본문(TypeScript 함수 입력 타입·`Set<string>` 제거) V8 실행, `current=true`, 필수 `monthlyIncomeWon`의 단일 `computed` row. 독립 기대는 integer KRW 숫자/정수 문자열만 준비됨; `null`, unknown, 소수, boolean, array, object, unsafe number는 차단. main **13조건 중 6/13 기대 일치**, 나머지 7개 비정상 값이 `ready=true`. 기존 [Draft PR #41](https://github.com/firmengine/firmengine/pull/41) (HEAD `3e6a673789e06e984bdffd9d8e4180ad351f4626`, 변경 본문 blob `14895627ae1664b337aed8cfff7d4a841c634469`)의 **실제 저장된 함수** V8 합성 **12/12 기대 일치**(원화 필수값). 전체 프로젝트 Node 회귀 미실행.

**수동 법률 AI 게이트 실험:** 현재 main의 실제 `POST` 함수 선언을 V8 실행 가능한 형태로 변환하고 `getCase`/모델/DB를 합성 함수로 격리. `action=legal`: (a) 원천 미완료, (b) 계산 미완료, (c) 양쪽 ready. 독립 기대 HTTP `409,409,200`, 모델 진입 `0,0,1`. **main은 `200,200,200`, 세 경우 모두 `reviewLegal` 호출 1회**, source/calc preflight 호출 0회: **1/3 독립 기대 일치**. 기존 [Draft PR #73](https://github.com/firmengine/firmengine/pull/73) (HEAD `a548c5edc8f2bc106d4fd7dfc8e50b07fdfa0460`, 수정 라우트 blob `960aa6ce353d8ab7633abc424d16df4c01d9f41b`)의 실제 POST 함수 V8 재실행: 원천 누락 `409, source=1,calc=0,legal=0`; 계산 누락 `409, source=1,calc=1,legal=0`; 둘 다 ready `200, source=1,calc=1,legal=1`. **3/3 기대 일치**. 실제 HTTP/D1/법률 API·문서생성 종단 테스트는 없음. 수동 예비 법률자문 정책은 변호사 검토 필요. **[ ]**.

## 결론·코드 조치·다음 ID

- 신규 코드결함 추가 확정 **0건**; 기존 P1 두 영역(문서 하위작업 철회, 원화 계산값·수동 법률게이트) 현재 main 재확인. 신규 브랜치·PR·제품 실행 코드 수정 **없음**: 이미 동일 문제에 대한 #88/#41/#73 Draft PR이 있어 충돌·중복 수정 회피. 세 Draft는 합성 통과일 뿐 병합·운영 배포 아님.
- 3 ID 모두 **[ ]**: 85종 문서×갈음·철회/재등록 상태, 실제 OCR 693 필드·복수행, 18계산→95법률→C01/C02/C04→직원 편집·변호사 검수→보정명령의 화면/API/D1/R2 종단 흐름은 이번 회차 미실행.
- 다음 순환 역할 **서류담당자·변호사·데이터담당자**: **A1-DOC-008**(OCR 문구·bbox 원문 UI), **A1-LAW-009**(소득금액증명 vs 실제 소득), **A1-DATA-008**(동일 Fact의 소득·채무·재산 이중 소비). 기존 P0/P1 PR 통합/QA·실무자 확인 후 인수 판단.
- 실제 고객정보·원문 OCR·키·.env·비공개 정답 없음. 운영 배포·운영 migration·전자제출·인가 확정 없음.
