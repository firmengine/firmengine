# FirmEngine A4 — 79차: D1 ACK 소실 후 지연된 직원 Word 감사 이벤트가 최신 변경보다 나중에 기록될 수 있음

작성일: 2026-11-02 KST. **A4 실행흐름·예외·동시성·복구만 감사**, 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. **전부 합성 사건**, 실제 고객/원본 OCR/비밀키/.env/개인정보 없음.

## 1. 실제 읽은 main / 코드 / 이력

- 시작 시 main **`2271508d00aba115238f55e97077948773a4cd9c`**. 직전 78차 보드 커밋 `52a3b74d5644b7c90ab08f6cc0e721d4c303a579` 대비 **6 커밋** 진행; A1/A2/A3 영수증과 보드 등 문서변경을 확인, A4 두 핵심 모듈 blob은 유지.
- 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `885c34f1da8059f8f64e0b669d60eebcb614a081`. 이전 78차 영수증 `20261102-round78-1844KST-ack-proof-historical-vs-current-link.md`, 77차 및 71차 원자적 이벤트 관련 영수증 열람.
- `lib/automatic-draft-handoff.ts` blob `a525e3c12672966c993f83021d5f169b170bebe9`의 `await saveCase(...)` 이후 **독립 `await event(...).catch(()=>{})`** 호출 확인. `alreadyLinked` 분기는 감사 이벤트 호출 이전 조기 반환.
- `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`: `saveCase`의 D1 batch(CAS+analyses), catch의 `row.token===token || !!proof`을 통한 ACK 유실 복구, `finishDerivedEvaluation` 예외 내부 삼킴, `recomputeCaseDataUpdate` 예외 삼킴 확인.
- `lib/automatic-draft-handoff-contract.ts` blob `43cd0e0245bb74d396879880161654cf80a2978e`, `lib/document-writer.ts` blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`, `db/schema.ts`의 `events(id,case_id,actor,type,detail,at)`, `drizzle/0012_case_lawgraph_reviews.sql`의 자동 Word Run 스키마, 기존 `tests/automatic-draft-handoff-contract.test.ts` blob `01724a1f0e214701fdc89458ef776c2606c0f1ee` 열람.
- 관련 GitHub Draft PR **#167** (승인세대 CAS), **#170** (인계 이벤트 동일 batch), **#174** (이미 연결 문서 SQL/R2 검증), stacked **#176** (derived evaluation 읽기전용), 모두 open/draft/미병합. 이번 소스변경·병합 없음.

## 2. 새로운 결함 후보: 실제 저장 시각/이벤트 시각 간극

직전 78차는 **historical COMMIT=true / current linked=false인데 `linked` 응답** 가능성을 격리 시험했다. 이번에는 별도 `event()`가 더 늦게 실행될 때 **A의 과거 직원 인계 이벤트가 후속 B의 원본·Manifest·법률 Head 변경 이벤트보다 늦게 남는 감사 순서 문제**를 추가 재현했다.

독립 기대: 과거 인계 완료 이력은 지우지 말되, 현재 문서 인계 효력/변호사 승인은 최신 판본과 별도 평가. 감사 event 시각으로 과거 Word가 현행이라고 추론 금지. **PR #170의 원자 event 저장은 이 합성의 지연-삽입 문제를 막을 후보이지, #167 승인세대 및 #174/#176 최신 증빙 결함까지 해결하지는 않는다.**

## 3. 실제 재현 — Node 22.16.0 / SQLite WAL 두 독립 연결

실행 파일: `staff_late_audit_after_ack_and_supersession.test.mjs` (로컬 합성 파일; SHA-256 **`f6c25d0721990b78ba6c202ce303bdfaa83e1aea7fdea531e8d89e73d0647a04`**). Node 직접 실행 출력 SHA-256 **`85b143cc868270da2a647bec2c17470b5cab95c5d40e0b55392497ea4bdbeef2`**.

합성 입력: `SYN-A4-R79`, revision 3, token-old, A Word `SYN-STAFF-DOC-A`, B `SYN-STAFF-DOC-B`, legal `SYN-LEGAL-A/B`, 새 evaluation UUID를 대리한 서로 다른 합성 ID, 승인전. **D1 ACK 유실·429/503/timeout은 코드가 제어한 실패창이며 실제 Cloudflare 네트워크 오류 주입이 아님.**

| 실제 실행 입력 | 독립 기대 | 관찰 |
|---|---|---|
| A COMMIT 후 바로 event INSERT | 최신 A/이벤트 1 | A 현재 / 이벤트 1 |
| A COMMIT → ACK 미응답 → B 원본 변경 → A 늦은 event | historical A true, current A false | **source_changed 다음 linked_to_staff_workbench** |
| A COMMIT → ACK 미응답 → B Manifest 교체 → A 늦은 event | 현행 B, A는 역사 | **manifest_changed 다음 linked_to_staff_workbench(A)** |
| A COMMIT → ACK 미응답 → B legal Head 교체 → A 늦은 event | 법률 Head 변경 후 A 승인전 | **legal_changed 다음 linked_to_staff_workbench(A)** |
| A event 429/503/timeout 후 재시도 조기 반환 | 이벤트 유실 상태 보존 | **event 0**, 이미 연결 분기 |
| B가 먼저 원본/토큰 변경 → A의 늦은 CAS | A 저장/평가 0 | UPDATE 0 / 분석 0 / A event 0 |
| PR #170 동등 원자 batch A→B | A 인계 event가 B보다 먼저 기록 | **linked_to_staff_workbench 다음 source_changed** |
| PR #170 동등 batch에서 event uniqueness 실패 | 전체 rollback | 사건 기존 토큰, 평가 0/event 0 |
| PR #170 동등 batch에서 다른 두 WAL 워커 경합 | 승자만 인계 event 1 | 1/0·최종 event 1 |
| 미관찰/NULL/0/승인전 | 상태 혼동 금지 | 각 상태 분리 |

**최초 테스트는 9/10**: 테스트가 각 시도에서 같은 evaluation ID/새 token을 재사용해 UNIQUE 충돌을 만든 **합성 fixture 오류**였음. 서로 다른 시도에 새로운 evaluation ID와 token을 넣도록 fixture를 수정하여 **신규 10/10 기대 관찰 일치**. 직전 r75~r78 및 신규 r79 재실행 **54/54 기대 관찰 일치** (일부는 기존 결함을 확인하는 부정대조). 통합 출력 SHA-256 **`7a1b5de117e77813cc78214796f1251a4f67004ca905e32af12faa1dfa6adec4`**.

## 4. 보드 5개 ID / 6역할 순환

역할 검토 순환: **AX → IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터**. 역할별 실제 승인이나 직원/변호사 인터뷰를 수행했다는 의미 아님.

- **`A4-IT-005`**: A COMMIT 영수증/ACK 복구와 최신 링크 상태의 관찰 차이, 동일 사건 별도 워커 경쟁.
- **`A4-DOC-011`**: B Word 교체 이후 A의 지연 인계 이벤트가 뒤늦게 들어오는 합성 반례.
- **`A4-LAW-013`**: 법률 Head 변경 뒤 A 이벤트는 현행 Word 바이트·변호사 승인 증거가 아님.
- **`A4-DATA-012`**: event 순서 뒤집힘, 429/503/timeout 뒤 누락 이벤트, 재시도 조기 반환을 합성 확인.
- **`X-047`**: R2 성공/D1 ACK 모호성 전체가 아닌 **D1 COMMIT 뒤 ACK 유실+후속 수정+event** 일부분만 실행.

사무장 `A4-CALC-016`, AX `A4-AX-013`은 계산 판본/원본 Writer 재사용의 연계 위험을 간접 검토. **이번 선정 5개는 전부 `[ ]` 유지**, 제품 최종 인수 완료 **0**.

## 5. 해결/미실행/후속

- 이번 해결: **과거 COMMIT과 현재 연결 유효성/감사 event 순서를 독립된 세 가지 주장으로 분리**하고, #170 후보의 원자 batch가 이벤트 순서/롤백/경합에 주는 영향을 WAL 합성으로 검증. 실제 앱/운영 코드 변경이나 새 PR 병합 없음. 실무 승인 전 결론/확정값 승격 없음.
- **미실행**: Next.js route/실 저장소 모듈 import, 전체 TypeScript·CI, staging D1·R2·Cron, 실제 HTTP 두 워커, 실제 n8n 운영 워크플로, 실제 Word DOCX/법원 서식, 직원·변호사 승인, 실제 보정명령, 10분 quiet 및 95법률 종단. n8n NODE_MAP은 설계자료로만 간주.
- 세부 상태: `UNOBSERVED`(응답/DB/R2 조회 실패), `NULL`(값 부재), `0`(CAS/INSERT 0행), `CONFLICT`(현재 Head/Manifest 상충), `source-only`(합성), `승인전`(인간 검토 전), `비해당`(운영제출/인가 수행하지 않음)로 구분. 값 0원을 NULL로 대체하지 않음.
- 다음 ID: `A4-IT-005`, `A4-DOC-011`, `A4-DATA-012`, `A4-AX-013`, `X-047`. 후속은 #167+#170+#174+#176 상호 간섭/동일 batch 통합, D1 receipt/현재 manifest/Run 상태/Writer source epoch 검사, R2 실제 바이트 검증, Word 재생성 후 직원·변호사 검수 무효화.
- **운영 배포, 운영 D1 마이그레이션, 실제 전자제출, 법원 인가 확정은 모두 미실행.**
