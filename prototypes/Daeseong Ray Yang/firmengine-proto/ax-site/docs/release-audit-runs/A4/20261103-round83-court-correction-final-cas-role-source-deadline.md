# FirmEngine A4 83차 — 보정명령 항목 최종 CAS의 권한·원문 저장상태·기한 철회 경합 (독립 합성)

작성: 2026-11-03 KST. **한정 범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하, A4 실행 흐름·예외·동시성·복구. 모든 사건 ID·문서·Fact·SHA·시간은 **가상**이며 실제 고객 개인정보·OCR 원문·비밀키·확정 법률판정은 없다.

## 1. 확인한 원천과 이전 작업

- 처음 읽은 GitHub `main`: `a0364e1a3a1ba14044d65d72669a5ffbf0968648`. 영수증 작성 직전 다시 조회한 main HEAD: `e4505cb8e4c3b1f8674c4688daf2fdd2b9958dd3`.
- 단일 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 `A4-IT-003 / A4-DOC-007 / A4-LAW-008 / A4-DATA-012 / X-044` 미완료 항목을 선정. 직전 A4 82차 영수증 `20261102-round82-2245KST-grant-audit-ack-composition.md`를 읽어 Word 인계 권한 ABA와 감사 원자성 부분검증을 승계했다.
- 실제 `main` 코드/blob: `lib/preapproval-correction-item-store.ts` `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`; `app/api/cases/[id]/correction-items/route.ts` `baf7b7198adeac39e90673a54ab6248243c9fa3b`; `drizzle/0022_preapproval_court_correction_items.sql` `bec8b19780eaa951c4994530060c916f903a40fe`. 또한 `lib/app-roles.ts`, `lib/case-procedure-events.ts`, `lib/preapproval-correction-audit.ts`, `tests/preapproval-correction-item-store.test.ts`와 2차 보정명령 영수증을 읽었다.
- 관련 PR #19(동일 법원 사건번호의 복수 명령 답변 오연결), #170(Word 감사 원자화), #187(Word 최종 역할 검사)은 **Open/Draft/미병합**으로 확인했다. 이번 검사와 해당 PR의 경로·운영상 의미는 구분한다. `docs/ax-n8n-e2e-scenario-matrix-20261030.md`는 **향후 n8n 설계·시험 정의**이지 운영 실행 증빙이 아니다.

## 2. 핵심 소스 경로와 신규 조건부 위험

보정명령 항목 POST는 HTTP 시작 시 `requireAppRole("caseworker_review",caseId)`을 한 번 검사한다. 이후 intake catalog, CaseData, `documents.sha256`, correction head 및 사례의 `revision/dataVersion`을 조회하고, `upsertCourtCorrectionItem`이 append-only version INSERT + head INSERT/UPDATE를 D1 batch에 넣는다.

**실제 `main`의 최종 INSERT/UPDATE CAS는 `cases.revision`, `case_data_change_state.data_version`, 기존 보정항목 head ID를 검사하지만, 앞서 확인한 직원 역할의 저장시점 활성 여부/권한 `policy_revision`, 사건 `storage_token`, 원문 PDF의 최신 `documents.sha256`을 최종 문장 안에서 재확인하지 않는다.** 때문에 초기 검수 시점과 최종 commit 사이에 역할이 철회되거나, source 버전이 유지된 상태로 token/doc-hash가 변경되는 *특정 경합*에서는 구 요청이 저장될 수 있다는 조건부 P1 후보를 독립 재현했다. 일반적인 원본변경이 반드시 sourceVersion을 유지한다는 주장이나 실제 운영 악용의 증거는 아니다.

권한 철회→재부여 `v1→v2→v3` 시에는 단순 "최신 active" 검사만으로 과거 요청이 통과한다. **구 승인세대 차단 여부는 IT·서류·변호사의 정책 승인 전**이므로 이 테스트의 epoch fence는 별도 설계 대조이며 코드 변경/자동 승인이 아니다. PR #19의 동일 `courtReference` 두 법원명령 이슈 또한 실제 main에서는 여전히 미병합이다.

## 3. 입력·독립 기대·실제 합성 관찰

환경: Node.js 22.16.0, 파일 기반 SQLite WAL **별도 DB 연결 A/B**, 가상 사건 revision=3/sourceVersion=7/token-A, 가상 보정항목·PDF hash A, 직원 review role v1, 법원기한 `null` 또는 근거 Fact. 실제 코드의 2개 D1 SQL 명령의 핵심 WHERE/바인딩을 별도 프로그램에 전사했고, 비교용 **미승인 강화 CAS**를 독립 실행했다. **실제 TypeScript 모듈 호출·Cloudflare D1·HTTP 테스트가 아니다.**

| 입력 / B 변경 | 독립 기대(미승인 보호 대조) | 기존 main 상당 SQL 결과 | 비교 CAS 결과 |
| --- | --- | --- | --- |
| 정상 원문·권한·head | 보정항목 version/head 1, 법원 충족 0 | 1 / 1 | 1 / 1 |
| A 사전인증 후 B 검수권한 철회 | A 보류 | **head 1** | **head 0**, version 0 |
| B 권한 유효기간 만료 | A 보류 | **1** | **0** |
| B 사건 storage token 변경, revision/sourceVersion 불변 | 구 요청 보류 | **1** | **0** |
| B 원문 PDF SQL SHA 변경, sourceVersion 불변 | 구 원문 증빙 보류 | **1** | **0** |
| B 권한+원문 SHA 동시 변경 | 보류 | **1** | **0** |
| B sourceVersion 7→8 / case revision 3→4 | 기존 CAS로 차단 | **0 / 0** | **0 / 0** |
| B 역할 revoke v2→regrant v3, 오래된 A 요청 | 정책 미승인·조건부 보류 | 현재 active 조건만으로 **1** | 동일 `policy_revision` 비교 0 |
| v3 이후 신규 A 요청 | 현재 유효 권한이면 가능 | — | epoch 3 기준 **1** |
| A/B 보정항목 head CAS 경쟁 | 승자 1, 늦은 구 head 0 | **1 / 0** | 동일 조건 |
| D1 COMMIT 후 ACK 유실(가정)·재시도 | 과거 저장 성공을 idempotent 확인하되 법원 승인 금지 | 기존 immutable version 1 / 현재 head 1 | 새 head 생성 없음 |
| ACK 유실 후 B가 새로운 항목 head 저장 | 과거 version 보존, current는 B | historical version 2행 / 최신 head B | 동일 |
| 기한 accepted verified Fact 철회 | 이전 보정항목을 삭제하지 않고 `stale` | 별도 **읽기 판단식 전사**에서 deadline supported `true→false` | 법원 인가/충족 추정 없음 |
| 기한 자체 미관찰(`null`) | 임의 내부/법원 마감일 생성 금지 | `null` 보존, 항목화는 가능 | `0원`·허위 날짜로 승격 없음 |

**중요한 실행 경계:** 마지막 4개 기한 검증은 `readCourtCorrectionItems`의 `dateStillSupported`·`linkedFact` 판단식을 **독립 전사해 호출**한 합성시험이지 실제 원본 모듈·법원 PDF/페이지 OCR 검증이 아니다. 또 기존 법원명령의 원문 인용 `orderQuote`와 실제 페이지 span 일치 및 복수명령 개별 identity는 여전히 미검증/미해결이다.

## 4. 실행 영수증과 독립판정

- 신규 `correction_item_commit_guard_race.test.mjs`: **19/19 기대 관찰 일치**, SHA-256 `579d80c978cff1250457ef649a3cc4442d50b9eab4a2ba875f98f821f9393ccc`.
- 기존 A4 75~82차 합성시험 + 이번 83차: **115/115 기대 관찰 일치**, 출력 SHA-256 `6d824e474c96157d8cec8029153e835f1025fc3519ed697b6e72028c7ce93377`. 이전 81·82차 업로드에서 PR #187 helper의 로컬 import 파일이 빠져 최초 86/88이었으나, 실제 PR 파일 blob `600cf9683c8cb879337eb45c8cbb9f3f89d10de6`를 같은 SHA로 복원한 후 115/115 재실행했다. 이는 로컬 시험 준비 오류이지 제품 소스 오류가 아니다.
- 테스트에는 main 경합 결함을 의도적으로 통과시키는 **부정대조**가 있으므로 `115/115`는 **제품 안전성·전체 CI·공식 서식 통과가 아니다**.
- **미실행:** 저장소 실제 테스트/TS·Next 전체 CI, Cloudflare staging D1/R2/Cron, 실제 HTTP 두 워커, R2 PUT 성공 후 D1 실패, 웹훅 중복, 실제 429/503/timeout, 법원 PDF 원문 span 확인, 상담→서류→OCR→600000ms quiet calculation→95개 법률→Word→직원/변호사 승인→실제 보정 사건의 종단 실행, 운영 n8n·사이트 배포.
- `UNOBSERVED`(원격 장애/미조회), `null`(기한/증거 미관찰), `0행`(명시적인 CAS 결과), `not_applicable`, `source-only`, `conflict`, `approval_pending`을 별도 의미로 유지한다.

## 5. 체크 ID·역할 회전·복구·다음

**6역할 순서:** 변호사 → 데이터 → AX → IT → 사용자·서류 → 계산사무장. 관점 감사이며 실제 사무장/변호사 승인 0건.

- `A4-LAW-008` **[ ]**: 법원 보정항목 원본 identity/response 매핑의 기존 PR #19 미병합과 최종 doc SHA 경합 재확인. 원문 페이지 좌표·판본 승인 미실행.
- `A4-DOC-007` **[ ]**: 기한 `null` 보존, `accepted` sourceFact 철회 시 date freshness 차단의 별도 합성. 내부 업무기한·법원기한 실제 알림 미실행.
- `A4-IT-003` **[ ]**: 직원 권한·case token·문서 SHA가 최종 batch CAS에서 누락된 경합, 두 WAL 연결 재현. 실 D1 두 HTTP 워커 미실행.
- `A4-DATA-012` **[ ]**: 늦은 A 요청, B role/document 변경, head 재생성·ACK 유실 후 이전 version 보존 합성. 실제 이벤트 webhook/outbox 미실행.
- `X-044` **[ ]**: 법원기한 Fact 유효→철회 후 read 판단식 `true→false` 전사시험; 실제 DB read/서류 UI/법률 승인 미실행.

**이번 자동 수정:** 실행 코드 0건, 법률/권한 의미를 임의로 확정하지 않았다. **신규 최종 인수 0/5**. 복구는 구 버전 자동삭제 없이 read-only 재조회로 `historical_commit`과 `current_source`를 분리하도록 요구. 다음 점검은 **`A4-IT-003`, `A4-DOC-007`, `A4-LAW-008`, `A4-DATA-012`, `X-044`**: 사람 승인 후 역할·scope·epoch·storage-token·문서 SHA 동시 SQL CAS 브랜치 후보, 원본 `tests/preapproval-correction-item-store.test.ts` CI, staging D1 ACK 유실·2워커, 동일 사건번호 복수 법원명령/개별 reply, 실제 근거·기한 철회 및 Word 재승인. 운영 배포·D1 운영 migration·전자제출·인가 확정 **없음**.
