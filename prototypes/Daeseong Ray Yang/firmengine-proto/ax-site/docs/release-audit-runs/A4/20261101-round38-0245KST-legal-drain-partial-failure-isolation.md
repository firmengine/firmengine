# FirmEngine A4 제38차 — 법률 batch 부분실패 격리 및 불확정 ACK 증빙

- 감사 시점: 2026-11-01 02:45 KST. 시작 `main` SHA `b54906713ddec9a1e36ca0f302a51ef44f0204ee`; 작업 대상은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 코드 blob (시작): `11870f5e7496b915955213257914289c2735b9c4`; 중앙 보드 blob (시작): `cb74c595217d60963aff72f301a748e713c34764`. 단일 보드의 기존 체크 ID 기록을 변경하지 않고 해당 ID 4개 끝에 독립 결과를 추가.
- 역할 순환: **IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자**. 이전 37차 AX 선행에서 순서를 이동함.
- 직접 검증 4개: `A4-IT-022`, `A4-DATA-014`, `A4-AX-005`, `X-048` 모두 **[ ] 유지**. 관계만 확인: `A4-DOC-017` 페이지 부분 성공, `A4-CALC-004` 이전 계산 head, `A4-LAW-006` 승인 무효화 — 종단 검증 미실행.
- 정적 열람: `lib/case-legal-automation.ts`의 `processJob/transition/drain`; `lib/case-agent-scheduler.ts` 호출, `db/schema.ts`, `drizzle/0017_legal_reanalysis_orchestration.sql`, `tests/case-legal-automation-flow.test.ts`, r35/r37 회귀·r37 영수증. PR #16 open/unmerged, PR #61 open/draft/unmerged 조회.

## 1. 독립 기대→실제 관찰

**P1 후보:** main `drainCaseLegalAutomation`에 `for(const c of candidates) results.push(await processJob(...))`가 있어, 후보 A의 `LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED`·D1 감사 INSERT 503 예외 하나가 처리 loop를 중단하고 후보 B는 실행되지 않았다.

- 격리 전 실제 GitHub 원문 조각 AsyncFunction 실행: `[A throws transition ACK unknown, B can review]` → 전체 throw, **B 미처리** (기대: A는 성공/실패 미확정으로 보고, B는 처리).
- 보수 수정: `drainCaseLegalAutomation`의 각 후보에서만 `processJob` 예외를 포착. `{caseId,status:"unobserved",errorCode:safeCode(error),persistence:"unobserved",needsReconciliation:true}` 반환. DB 재쓰기·job 자동재시작·모델 재호출·서식 승인/법원 인가 확정 없음. 다른 후보는 한 번씩 계속 처리. `unobserved` 집계를 별도 반환하여 기존 `failed`·`review_required`과 혼동 방지. 안전한 식별자 오류 코드만 반환, 원시 429/503/URL·키 등 메시지 미노출.
- 수정 조각 V8 본문 합성 **12/12 기대 일치** (transition/claim/failure/retry D1 ACK 유실; 감사 INSERT 503, 모델 429/timeout, 다중 실패, 정상 혼합/0건/단일성공, 비법률 예외 메시지 비노출). 독립 예상 결과는 첫 실패도 확정 실패가 아닌 `unobserved`, 다음 사건 `reviewing` 또는 `draft_ready` 등 별도 관찰.
- 새 `tests/case-legal-automation-drain-isolation-r38.test.mjs` Node-native 회귀 **12개 작성**; 저장소 전체 원본 Node/CI 환경에 접근하지 못하여 **미실행**. V8 합성만 성공으로 표기.

## 2. 상태 성공 후 감사 이벤트 실패 — 저장원장 공백

독립 Python SQLite WAL 2연결에서 main의 legal transition UPDATE SQL 조건과 별도 event INSERT 순서를 합성:
1. 사건 A lease 유효, UPDATE rowcount=1 COMMIT.
2. 감사 INSERT 직전 503 오류 주입. 별도 연결 B에서 상태 `pending`, lease null, 감사 이벤트 수 0건 관찰.
3. A 예전 lease를 사용한 UPDATE rowcount=0, 사건 B의 별도 유효 transition rowcount=1 및 감사 이벤트 1건.
4. **10/10 관찰값 일치.** 단, 상태/감사 원자성 성공이 아니라 **부분성공 결함 재현**. 외부 공개 고객 자료 없음.

남은 구조 위험: `transition()`이 상태 UPDATE 후 `note().catch(()=>{})`로 감사 실패를 조용히 무시하고, 실패 catch 경로/수동 retry도 이벤트가 별도 INSERT. 원자적 batch/outbox 및 읽기 영수증 대조가 없으므로 **P1 미해결**. 본 회차의 안전한 drain 수정은 상태 변경 성공/실패 자체를 재분류하지 않으며, 사건당 세부 상태 정합성을 확정하지 않는다.

## 3. 교차 경계·인수 상태

상담→서류→OCR→10분 quiet 계산→95 법률→Word 초안→직원/변호사 검수→실제 보정 이벤트 단계는 정적 소스/계약 수준만 확인. sourceVersion/referenceSHA/calculationRun/legalRun/artifact/approval 해시 CAS 전체 E2E **미실행**. 계산 구판본 lease 탈취와 reference SHA split-brain은 PR #16 미병합, 별도 검토 필요. n8n 설계는 운영 워크플로가 아님. Cloudflare **staging D1/R2/Cron 미실행**, 두 HTTP 워커·실제 429/503/timeout·원문 변경·갈음 철회·관할판본·기한·재생성 실환경 미실행. 사람이 승인하지 않은 값은 법률상 확정값으로 승격하지 않음. null·미관찰·0·비해당·상충·source-only·승인전 분리.

## 4. 다음 체크

- `A4-DATA-014` / `A4-LAW-006`: legal state UPDATE 성공 후 audit INSERT timeout/503를 영속 원장·재조회/중복 이벤트 방지 및 승인 전면 표시와 결합. 고위험 원자성 개선은 별도 PR/실무자 승인.
- `A4-IT-003` / `X-046`: 계산 poll 두 HTTP 워커 CAS와 reference 기준정보 epoch, 이전 계산 head 승격 차단(기존 PR #16 미병합).
- `A4-DATA-013` / `X-047`: staging R2 GET 실제 바이트 SHA 및 D1 durable receipt, 응답 유실 후 조회·중복 방지.
- `A4-DOC-013` / `A4-CALC-004` / `A4-AX-006`: 신규 증빙·갈음 철회·관할판본 변경에 따른 재계산·서식 재생성 및 기존 사람 승인 무효화 E2E.

**실제 인수 체크 완료 0건, 제품 최종 인수 0건.** 운영 배포·D1 운영 migration·고객 자료 변경·실제 전자제출·법원 인가 확정 없음.
