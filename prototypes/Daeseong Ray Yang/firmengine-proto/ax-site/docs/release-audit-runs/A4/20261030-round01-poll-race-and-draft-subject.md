# A4 1회차 — 동시 계산 poll의 구판본 lease 탈취 및 법률 초안 반복행 혼합

**감사일**: 2026-10-30 KST · 시작시 main `f02d49b56b326ffb04564c7e7f6438b9f27418c8` · 코드 변경용 최신 main `a5e392571540608d18c4a63b5bba88755dbce76b` · 이 보고서 적재 직전 main `a5e392571540608d18c4a63b5bba88755dbce76b`.

**범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 원본 의뢰인/PII/실제 OCR/비밀키 없음. 6담당자 순환 중 첫 회차 IT→데이터→AX 세 관점을 선택. 이번 회차는 **A4-IT-003, A4-DATA-004, A4-AX-011**, 교차 **X-039·X-046**의 *부분 재현 및 수정 PR*을 수행했다. 체크박스는 아직 [ ] 유지(최신 저장소 전체 회귀/스테이징/법원 서식/변호사 승인 부족).

## 발견 1 — P0: 두 계산 poll 워커가 서로 다른 원본판본을 경쟁하면 최신 lease 탈취

- 역할/ID: **IT담당자 A4-IT-003**, **데이터담당자 A4-DATA-004(부분)**, **X-046**.
- 실제 코드: `lib/case-data-recompute.ts`의 `drainCaseDataUpdates` (~70~114행), 관련 SQLite migration `drizzle/0020_calculation_poll_fairness.sql`, 회귀 `tests/case-calculation-poll-fairness.test.ts`.
- 문제 상태: SELECT로 V1 후보 확보 → 다른 원본 수정으로 live V2 됨 → 다른 워커가 V2 `running` lease 보유 → V1 워커가 UPSERT. 기존 `WHERE case_calculation_poll_jobs.data_version<>excluded.data_version`은 버전이 *다르기만* 하면 충돌 UPDATE를 허용하여 V2 lease token을 V1로 바꾸는 역전이다.
- 격리 합성 입력: caseA revision=1; live source V2; case_calculation_poll_jobs 현재 (V2, lease_token=fresh-worker, status=running, lease_until=2099-01-01). **오래 전에 선정된 V1/lease_token=stale-worker** UPSERT 시도.
- 독립 기대: SQL changes=0, 기존 V2/fresh-worker 보존, V1은 `already_claimed`. 기존 SQLite 실제 관찰: **changes=1, (V1, stale-worker)로 덮임**. 인메모리 sqlite3에서 동일 UPSERT를 실제 실행해 반례 재현.
- 조치: **PR #16** https://github.com/firmengine/firmengine/pull/16 · branch `audit/a4-poll-stale-source-claim-20261030` · head `453936e15b804e0142801495327ecb3024d25da1`. INSERT VALUES를 원자적 `INSERT ... SELECT ... WHERE EXISTS(current cases.revision + case_data_change_state.data_version = candidate)`로 변경. 후보가 구판본이면 신규 삽입과 ON CONFLICT UPDATE 모두 실행되지 않음.
- 검증: 실제 SQLite 동일 질의로 **기존 stale-over-new 1건 재현**, 수정 후 **stale-over-new 0건, 새 최신 V3 claim 1건 정상, stale+job 없음 insert 0건, 최신+job 없음 insert 1건**. 실제 코드 회귀로 후보조회 직후 V2 변경/새 lease 삽입 경쟁 주입하는 1테스트 추가. **PR 브랜치 전체 Node/CI는 미실행**(GitHub 연결만 있어 저장소 자체 체크아웃·node_modules 접근 불가). D1/Cron 두 워커 운영 실증은 미인증.
- 잔여: 참조 릴리스 SHA만 동적으로 변경된 경우 lease 상호간섭과 계산 head의 reference hash 재확인, 활성 sourceVersion과 법률 인가 전 상태 영향 검토. 이 수정만으로 A4-DATA-004 전체 완료라 볼 수 없음.

## 발견 2 — P0: 채권자 반복행에서 서로 다른 subjectId를 섞어도 자동초안 자격 인정

- 역할/ID: **AX담당자 A4-AX-011(필드 투영 구조 부분)**, **X-039**. 0개 projection 차단은 기존 코드에 존재하며 이번 결함은 **반복행의 잘못된 대상자 혼합** 문제이다.
- 실제 코드: `lib/automatic-draft-projection-gate.ts`의 `assessAutomaticDraftProjection` (~19~74행), 호출자 `lib/case-legal-automation.ts`의 `processDraft` (~189~216행), `lib/lawgraph-document-field-projection.ts` (~44~93행), `tests/automatic-draft-projection-gate.test.ts`.
- 격리 합성 입력: D5106 creditor rowOrdinal=0의 `creditor.number`, `creditor.entity`는 `subjectId=debt-A`, `creditor.principal`은 `subjectId=debt-B`. 모든 token/valueKind/ordinal은 유효. 별도 시나리오에서 같은 principal의 subjectId=null.
- 독립 기대: 서로 다른 채권자의 이름/원금을 하나의 반복행에 병합하지 않으므로 `eligible=false`; 법률 승인 및 전자제출 인가는 기존과 마찬가지로 false. 기존 코드 실제 관찰: **`eligible=true`로 통과**, 원인은 반복행 group key가 formCode + repeatGroup + ordinal이고 subjectId 일치를 확인하지 않았기 때문.
- 조치: **PR #15** https://github.com/firmengine/firmengine/pull/15 · branch `audit/a4-projection-subject-integrity-20261030` · head `d63eda4ed4c30c4e58adca4c7e4ee05a2772de4e`. 같은 반복행의 subjectId를 통일 확인하고 불일치 시 `DOCUMENT_FIELD_PROJECTION_REPEAT_SUBJECT_MISMATCH`로 draft writer 게이트 차단. 새 원천 사실을 생성하거나 기존 서식/금액을 수정하지 않음.
- 로컬 테스트: GitHub에서 검토한 원본 함수의 독립 TS 복제로 `node --experimental-strip-types --test` 실행. 수정 전 3개 합성검사 중 정상 1 PASS/대상자 혼합 2 FAIL → 수정 후 기존 원본 모듈 회귀 5개 + 새 동등/다른 row/잘못된 대상 4개 **9/9 PASS**. 저장소 테스트 파일에 실제 신규 회귀 3개를 PR로 추가. 복제 실행은 **GitHub 브랜치 CI 통과를 의미하지 않음**.
- 영향·한계: 검토용 초안의 구조적 무결성 위험이며 실제 법원 제출 또는 실사건 오염 증거는 없음. 원본 데이터·법원서식 바이트/E2E·실제 변호사 재승인까지는 아직 미검증. 타 관할에서도 본 행 결합 금지를 동일한 안전 불변식으로 유지하되 템플릿별 행 주체가 다르면 별도 검토 필요.

## 병렬 작업·실행/인증 경계

- 감사 시작 시 main 변경 확인: `f02d49b56b326ffb04564c7e7f6438b9f27418c8` → 검토 후 `a5e392571540608d18c4a63b5bba88755dbce76b`. PR #12(A1, review-only), #13(A2, 금액 원문 불일치), #14(A3, canonical 출처 표시)가 동시에 열린 상태임을 확인. A4 두 PR은 서로 다른 파일만 변경, 해당 담당자 변경을 덮어쓰지 않음.
- **실제 수행**: GitHub 원본/테스트/스키마 읽기, PR #15·#16 브랜치 코드·회귀 추가, 격리 Node TS 함수 시험 9/9, SQLite 실제 UPSERT 원본 및 개선 반례 5단계 실행. **미실행**: main 또는 PR의 저장소 전체 `npm ci / npm run check:product / npm run lint / npm run build`, Node 원본 통합 테스트 전체, staging D1/R2/Cron, n8n 배포 검증, 공식 법원서식 Word/PDF, 변호사 승인, 실제 운영 배포.
- 리뷰 준비: 두 PR 모두 **미병합**이며 main에는 코드 변경 없음. 합성 사례의 인물/사업자/계좌 이름은 단지 `debt-A/debt-B/caseA` 같은 가상 ID.

## 다음 회차 우선 ID 및 실행 순서

1. **A4-DOC-007, A4-LAW-008** — 법원 실제 기한 확인/보정명령 원문, 책임자 인계, 유효증거 철회의 stale, 검토 중 실제 답변/접수증이 없는 상태를 fail closed.
2. **A4-CALC-004, A4-DATA-012** — 계산 지연·이전 결과 stale 및 이벤트 역순/중복 전달. 단순 sourceVersion뿐 아니라 reference SHA와 job lease까지 확인.
3. **A4-IT-006 / X-047** — R2 업로드 성공 후 D1 실패 및 API 응답 유실·중복 재시도. staging 접근 없으면 격리 SQLite·API stub을 사용하고 운영 E2E는 미인증.
4. PR #15/#16 CI/코드 리뷰 및 최신 HEAD 충돌 확인; 통과 영수증 이전에는 이 세 ID의 체크박스 [ ] 유지.
