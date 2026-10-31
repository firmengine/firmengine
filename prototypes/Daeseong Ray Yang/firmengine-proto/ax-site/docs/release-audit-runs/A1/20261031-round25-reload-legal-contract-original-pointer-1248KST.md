# FirmEngine A1 25차 — 저장 불확실성·법률 증거계약 누락·원본 저장 포인터

- 실행시각: 2026-10-31 12:48 KST 회차. 범위: `firmengine/firmengine` **main**, 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래.
- 최초 관찰 main HEAD: `36a72f485420fbf7ea4febde06fcfaa1ac6866af`; 영수증 작성 직전 재관찰: `36a72f485420fbf7ea4febde06fcfaa1ac6866af`. 동일 내용 소스 blob 재조회 후 검사(상세 SHA 아래).
- **역할 순환:** 이전 회차 IT/AX/계산 → 이번 **서류담당자 A1-DOC-018 / 변호사 A1-LAW-013 / 데이터담당자 A1-DATA-007**. 3개 모두 인수 `[ ]` 유지.
- 시작 자료: 단일 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, A1 24차 영수증, 최신 main SHA/최근 커밋/PR, `db/schema.ts`, 아래 실제 코드 및 테스트. 기존 Draft **PR #32**(명령 확인 UI, `bb82a8eaf6c1f1983c759a91362ef43bdf663748`), **PR #46**(법률 증거계약 배치, `db18c238c8680a710cda46de7a326d56adac4616`), **PR #66**(사건 원본 조회 접근권한)은 미병합. 해당 파일 직접 덮어쓰기 금지.

## A1-DOC-018 — 통신 실패·동일 명령 재시도·새로고침

- main 실코드 `components/case-workflow.tsx` blob **`2ec797958726b99a4358ec46ef35f78f90bfd927`** (`send` 함수). 영수증 GET API `app/api/cases/[id]/commands/route.ts` blob **`44c267951751d280d0f1c27ac6b3362bd7f9b9d6`**. 관련 테스트 `tests/case-command-storage.test.ts` blob **`aa7265288e2ab2ba9d7ca3fab1493cd52408a04e`**.
- **재현 방식:** GitHub main에서 `send`의 실제 함수 본문 추출, TypeScript `draft` 타입/응답 단언만 제거하여 JS V8에서 호출. 인위 fetch 응답, UUID 순서 및 상태 함수를 합성 주입. 사건/Fact는 오로지 `case-synth`/`fact-synth`; 고객 데이터 사용 없음.
- **기대 / 관찰 (6/6 예측 일치):**
  1. POST 네트워크 예외: `pendingRef.current.commandId = cmd-00000001` 보존 **관찰 일치**.
  2. 같은 mount의 retry: 동일 `cmd-00000001` 재전송 **관찰 일치**.
  3. 컴포넌트 새 mount 뒤 같은 명령 제출: **독립 기대: 기존 불확실 명령을 확인하고 동일 ID 복구**, 관찰은 새 `cmd-00000002` 생성 **기대 불일치 결함 재현**. 새 컴포넌트의 `pendingRef`는 초기 null.
  4. 새 mount의 재시도 경로: 명령 영수증 GET이 발생해야 하나 POST만 발생 **기대 불일치 결함 재현**.
  5. 서버 HTTP 200 빈 `{}` 응답: 독립 기대는 commit 미확인 처리, 실제 `success` notice **기대 불일치**(기존 Draft #32에서 수정 제안).
  6. HTTP 400 명시 거절: pending clear **관찰 일치**.
- 위 **6/6은 관찰값을 도출한 테스트의 실행 성공**을 뜻하며 정상 제품 동작 6/6을 뜻하지 않는다. 안전 기대 기준으로는 **3/6** 일치(1,2,6). 실제 D1에 명령이 이중 커밋됐다는 사실을 증명하지 않음. 이중발급 **가능성 및 재방문 복구 공백**이며 서버 영수증 저장 자체는 별도 존재. PR #32의 main 충돌 및 사용자 입력정보의 브라우저 영속저장 개인정보 위험 때문에 직접 수정하지 않음. 우선 **opaque command ID만 저장/조회하는 복구 정책** 검토; 원문 명령 payload를 session/localStorage에 저장하지 않을 것.

## A1-LAW-013 — 승인 근거계약의 배치 전달

- main `lib/pipeline.ts` blob **`79dce5f9822cf2debe1f886ab93ece4a256659e6`**; `lib/legal-review-packet.ts` blob **`38b46feff4bb196c89d3a48ff97346846c9a9da9`**; `lib/legal-evidence-criteria.ts` blob **`6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`**. 기존 테스트 `tests/legal-review-packet.test.ts` blob `0bcdb16455019195bbf6be460a16aefd12de4c8d`, `tests/legal-evidence-criteria.test.ts` blob `15c8d484cca1ba9e4d2d02d4a6ccc239d09703b1`.
- main의 `reviewLegal` 내부 원본 배치 `.filter().slice().map()` 표현식을 실제 평가하고, 동일 `gateLegalReviewChecks` 함수 본문을 TypeScript 표지만 제거하여 V8 격리 실행. 인위 승인된 **가상** 위험 1건(`LR-synth`), 수락·검증 Fact 1건(`fact-synth`), 필요 canonical `income.v1` 및 계산 출력 `amountOne`을 넣었다. **실제 95개 법률 정책에는 승인된 seed 계약이 없으므로 해당 합성 승인조건은 운영 증거가 아님**.
- **독립 기대 / 관찰:** (a) main 배치에서 `canonicalFieldGroups`, `requiredCalculationOutputs`, `evidenceContractStatus` 셋 모두 **없음**; (b) 가상 승인정책의 계산 누락도 main 배치에서는 `legal_review`로 귀착(인수계약에 따르는 `missing` 근거는 전달되지 않음); (c) 세 필드를 복원하면 계산 누락→`missing`, 정상 계산+필드→`pass`, canonical 불일치→`missing`, 정책 미승인→`legal_review` 확인. **각 관찰 6/6 실행**.
- 기존 9차 결함 재현이며 신규로 중복 집계하지 않는다. **미승인 계약이 실제 자동 법률 PASS로 승격했다는 증거는 없다**: 현 main의 `gateLegalReviewChecks`는 누락 정책을 `legal_review`로 fail-closed 처리한다. 그러나 승인 계약의 필수 결손 분류·근거 전달은 불완전.
- 기존 **Draft PR #46**은 main의 손실성 `batch.map`을 별도 `selectLegalReviewRiskBatch` 함수로 대체하고 메타데이터를 복사한다. PR 파일 `lib/legal-review-risk-batch.ts` blob `3e9c48eb9a39723da0ff3fa0e1914840634224d6` 확인. 법률 기준의 전제·최종 승인 의미가 중요하므로 변호사 검토/Node CI/D1 E2E 전 병합 없음.

## A1-DATA-007 — 원본 SHA256와 D1 문서 포인터·R2 저장 일치

- main `app/api/cases/[id]/documents/[doc]/route.ts` blob **`db20b9248e68d3ec412b5d3f4254254e0ffc8412`**, 등록 `app/api/cases/[id]/documents/route.ts` blob **`274f7a6e73988ca254607422d2ff2cddd1326ac0`**, `db/schema.ts` blob **`933f8686845ac14669312dd21bf85e02c62ed5e6`**.
- 등록 POST 201은 `documents.ready=0`/page `awaiting_upload` 이후 반환하며, **실제 R2 업로드 완료 ACK 아님**. 원본 PUT은 스트림에서 최대 100MB 크기 및 SHA256 일치를 검사한 뒤 D1 조건부 `UPDATE documents SET original_key = ?,ready = 1 WHERE id = ? AND case_id = ? AND ready = 0 AND sha256 = ?`로 원본 포인터 CAS. CAS 실패 시 이미 같은 해시·ready인 기존 포인터를 idempotent로 인정하고 신규 키는 비참조 정리 경로로 보낸다.
- **실행한 독립 SQLite 합성(5/5 기대 일치):** `documents(id,case_id,sha256,original_key,ready)` 최소 열만 생성. `b'synthetic-original-only-no-pii'` SHA256 **`68ac1cdac532032e3fbc7fd93811bdab9ee753a4cb3a83e80bbd8b59ee64c740`**. main **실제 위 조건부 UPDATE SQL**을 사용하여 타사건 ID→0행, 잘못된 hash→0행, 첫 정상 업로드→1행, 늦은 경합 업로드→0행, 동일 재시도→0행; 최종 key는 첫 정상 `r2-key-verified`, ready=1.
- **검증 한계:** SQL CAS만 로컬 SQLite에 실행. 실제 R2 바이트 조회/해시 재검증, 실패 cleanup, 다중 사건 동시성, D1 배포 마이그레이션/원격 스토리지는 **미실행**. 특히 GET 반환시 원본 R2 바이트의 SHA256 독립 재검증은 정적 소스에서 확인하지 못했고, 원본 조회 권한 변경은 미병합 PR #66에 별도 있어 접근권한 전체 인수 불가. 따라서 원본 bytes==해시==포인터의 종단 일치는 아직 증명하지 못했다.

## 조치·상태·후속

- **신규 실행 코드 변경 0건**. A1-DOC-018와 A1-LAW-013의 재현된 결함은 기존 Draft PR #32/#46 작업과 중복; 덮어쓰기 및 무승인 법률정책 변경 방지. 후속 통합에서 #32의 저장결과 확인뿐 아니라 새로고침 뒤 불확실 command ID 조회 복구를 별도로 검증할 것. A1-DATA-007은 원본 CAS 합성 통과 수준만 입증.
- **보드 3개 ID만 갱신, 세 ID `[ ]` 유지.** 신규 회차 영수증 외 자료 반영 없음.
- 순수 격리 실행: UI 관찰 시나리오 6, 법률 batch+gate 관찰 6, SQL 5; **실행 17조건**, 단 제품 요구 기대와 불일치 3(UI) + 법률 계약 메타데이터 소실 1계열. `6/6`/ `5/5` 숫자는 관찰 재현 횟수이지 승인율이 아님.
- **미관찰 / null / 관측 0 / 비해당 / 상충 / source-only / 승인 전** 분리. 실제 개인 자료/원문 OCR/키/비공개 정답을 공개 Git에 적재하지 않음. 전체 Node·typecheck·CI·브라우저·staging D1/R2/Cron·공식 법원 서식·변호사 승인·운영 배포·운영 D1 migration·전자제출·법원 인가 확정 **실행하지 않음**.
- 다음 담당 **IT/AX/계산사무장**, 우선 **A1-IT-014**(Export 응답유실/취소 후 artifact), **A1-AX-009**(OCR 복수행 프롬프트 충돌), **A1-CALC-012**(36/48/60개월 회차·예외).
