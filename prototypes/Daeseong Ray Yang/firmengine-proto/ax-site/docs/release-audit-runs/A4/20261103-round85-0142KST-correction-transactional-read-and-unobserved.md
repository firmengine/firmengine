# FirmEngine AX A4 85차 — 보정명령 HEAD 조회의 트랜잭션 스냅샷 후보 및 미관찰/0행 분리

작성: 2026-11-03 01:42 KST. **범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하 A4 실행 흐름·예외·동시성·복구만. 입력과 문서 ID·내용·SHA는 모두 가상; 고객정보·실제 법원문서·OCR 사실값·키·비공개 정답 없음.

## 1. 매 회차 원천 확인 / 이전 진행 승계

- 시작 GitHub main HEAD: `d06bdd6f9e599a732754ea72fa1176624c021943`; 영수증 작성 전 main 재확인: `d06bdd6f9e599a732754ea72fa1176624c021943`. 최근 main 커밋: `d06bdd6`(A3 r85), `66167c1`(A3 r85), `d9c651a`(A2 r85), `5cc5bd8`(A4 r84). 이전 A4 영수증 `docs/release-audit-runs/A4/20261103-round84-0045KST-correction-head-read-snapshot-race.md`(blob `c654a37caa5ba8108fa1e6d576a79cc3978d802d`)에서 HEAD 교체/추가/삭제와 sourceCurrent 거짓 최신 표시를 승계.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 A4 미완료 ID 5개 선정: `A4-IT-005`, `A4-DOC-007`, `A4-LAW-008`, `A4-DATA-012`, `X-044`. 전부 **[ ] 미완료**. 6역할 검토 순환 **AX → IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터**. 이는 역할별 검토 관점으로 실제 직원·사무장·변호사 승인 0건.
- 실제 main `lib/preapproval-correction-item-store.ts` blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`; `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; `drizzle/0022_preapproval_court_correction_items.sql` blob `bec8b19780eaa951c4994530060c916f903a40fe`; 원본 테스트 `tests/preapproval-correction-item-store.test.ts` blob `b78fa006c9c003b72b79fd79f74630e342b97238`; GET/POST route `app/api/cases/[id]/correction-items/route.ts` blob `baf7b7198adeac39e90673a54ab6248243c9fa3b`.
- 기존 Draft PR #19(동일 법원 사건번호의 복수 보정명령 오연결), #170(Word 인계 감사 원자성), #187(Word 역할 철회 최종 CAS)을 확인. 전부 main에 병합된 제품 기능이 아님. **이번 신규 [Draft PR #196](https://github.com/firmengine/firmengine/pull/196)** 역시 미병합.

## 2. 재현 조건과 최소 수정 후보

현재 main `readCourtCorrectionItems`는 사건 revision/source dataVersion 조회 → HEAD/버전 SELECT → 사건 revision/source dataVersion 재조회를 **별도 D1 요청**으로 수행한다. 중간에 B 워커가 같은 사건 판본을 유지하며 HEAD를 교체/추가/삭제하면 A가 한 시점의 일관된 목록이 아닌 이력 조각을 조합할 수 있고, 구 초안을 `sourceCurrent:true`로 반환할 수 있다(84차 재현). 기존 write CAS나 법률상 승인 상태는 별개이다.

**Draft PR #196**: 읽기 SELECT 2개를 `database.batch([current case/source SELECT, heads+versions SELECT])`로 묶어 **한 트랜잭션의 as-of 스냅샷**을 구성한다. 쿼리 구조·출력 필드·법률 판단은 유지한다. Batch 결과가 누락·null·비배열이면 `CORRECTION_ITEM_READ_SNAPSHOT_UNOBSERVED` 오류로 분리하여 **미관찰을 0개 항목으로 취급하지 않는다**. 명시적으로 관찰된 빈 배열만 `count:0`이 가능하다. 신규 소스 TS 테스트 3건 작성했으나 **저장소에서 직접 실행하지 않음**.

중요: **스냅샷은 조회 시점의 판본 일관성일 뿐 HTTP 응답 시점의 무변경·영구 최신을 보증하지 않는다.** 외부 `getCase()` 읽기와 source 데이터·문서 SHA의 동일 스냅샷은 아직 결속되지 않았고, 읽기 후 다른 워커의 교체 및 A→B→A는 허용된다. 최종 직원/변호사 검수 및 저장에는 신규 HEAD/기준정보/권한 판본 CAS와 실무자 승인이 별도로 필요하다. 마이그레이션/실운영 변경 없음.

Cloudflare D1 문서상 `batch()`의 문장들은 트랜잭션으로 실행되어 실패 시 전체 rollback. 근거: https://developers.cloudflare.com/d1/worker-api/d1-database/ . Read replica/session bookmark 설정 및 staging D1 실제 동작은 별도 검증: https://developers.cloudflare.com/d1/best-practices/read-replication/ .

## 3. 실제 독립 실행 영수증 — 관찰과 독립 기대

환경: Node.js **22.16.0**, `node:sqlite` WAL **독립 연결 A/B**, 가상 사건 revision=3/sourceDataVersion=7, 법원기한 `null`, 법원 충족 상수 `false`, 보정명령 HEAD A 및 B/가상 SHA. **main SQL의 SELECT와 D1 batch 대응 트랜잭션을 독립 전사**하여 구 방식/후보를 비교. 실제 TS 모듈 import/HTTP/Cloudflare D1 호출이 아님.

| 합성 입력 (B 워커) | 독립 기대 | 실행 관찰 |
|---|---|---|
| 변경 없음 | as-of HEAD A, 법원 인가 false | A, false |
| 구 방식 A 첫 조회 뒤 B 교체 | 분리 SELECT가 서로 다른 시점 결과를 읽음 | HEAD B를 후행 SELECT에서 관찰(부정대조) |
| 새 batch A 첫 SELECT 뒤 B A→B commit | batch 시점에 HEAD A 일관 스냅샷, 현재 DB는 B | 스냅샷 A / DB B (후행 저장 CAS 필수) |
| B가 먼저 A→B 변경 | 새 batch HEAD B | B |
| B가 새 항목 추가 / 기존 HEAD 삭제 | batch 내부에 새로운 HEAD 혼입 금지 | 이전 스냅샷 유지 / 최신 DB 별도 |
| B가 원문 SQL SHA 변경 | 원문 as-of와 최신 SQL SHA 구분 | 구 SHA/신 SHA 분리 |
| A→B→A ABA | 조회만으로 사이 변경 입증 불가 | HEAD A지만 버전 이력 2건 |
| D1 결과 null·비배열 | `UNOBSERVED`로 fail closed, 0 목록 금지 | 명시 오류 대조 |
| 실제 빈 조회 배열 | 정상 0개, unitemized 명령 별도 표시 | 빈 배열을 0으로 구분 |
| 중간 합성 503/SQL 오류 | rollback, 기존 HEAD 보존 | rollback 및 B 후속 쓰기 가능 |
| 기한 null·sourceDataVersion 7→8 | null/구버전 미확정, 승인 승격 없음 | null·sourceCurrentAtSnapshot false |

신규 85차 독립 SQLite 합성 **12/12 기대 관찰 일치** (부정대조 포함); 로컬 스크립트 SHA-256 `8df222d586c14188f3484f05088ec7f0afed269ee0de4749a8693f2070f64132`; 출력 SHA-256 `b83bcabf7512d8edea2e9d95dc8da9695f91506f7bc85b966ce5ed038cae836c`.
84차+85차 실제 재실행 합성 회귀 **27/27 기대 관찰 일치**; 결과 SHA-256 `58f1fa376354f287de32552a4252ba0625b6f60ad4e3412dd3054a9892a304c1`. **결함 재현의 기대관찰도 통과에 포함되어 제품 안전성 27건 합격이 아니다.** 대화 산출물 `firmengine-a4/r85/20261103-round85-correction-read-transaction-snapshot.test.mjs`, `node-snapshot-results.txt`, `regression-r84-r85.txt` 보관.

## 4. 인수·복구 및 다음

- `A4-IT-005` **[ ]**: 재조회/ACK 유실과 `UNOBSERVED`/0개 분리; 실제 D1 COMMIT ACK 유실 미실행.
- `A4-DOC-007` **[ ]**: 미확정 법원기한 `null` 유지 및 항목 0개·미관찰 구분. 실제 직원 화면은 미실행.
- `A4-LAW-008` **[ ]**: 동일 사건번호 복수 명령 답변 오연결은 Draft #19 미병합, 실제 법원 문구와 실무 검수 미실행.
- `A4-DATA-012` **[ ]**: B 변경 시 거래 스냅샷 일관성 vs 조회 후 supersession/ABA, 독립 SQLite 실행만.
- `X-044` **[ ]**: 기한 Fact 철회 경로 83차와 분리. 이번엔 기한 null/판본 변동만 확인했으며 실제 철회 이벤트 재현·법원 승인 미실행.

**미실행:** 원본 TypeScript 함수의 제품 Node 테스트, 전체 CI/build, staging D1/R2/Cron 및 두 실제 HTTP 워커, R2 PUT+ D1 failure/ACK loss, 중복 webhook·429·503·timeout의 전체 계통, 상담→서류→OCR→10분 quiet calc→95법률→Word→직원/변호사 승인→실제 법원 보정 E2E, 공식 서식·서명, 운영 n8n 및 사이트 배포. 이 회차 운영 D1 migration·운영배포·전자제출·인가 확정 0건.

**다음 점검:** `A4-IT-003`, `A4-DATA-009`, `A4-LAW-008`, `A4-AX-013`, `X-044`: PR #196 실제 TS 실행 및 D1 batch 반환/부하, PR #19 identity 계약 결합, 응답 후 신 HEAD 생성→직원 Word 재생성→기존 법률 승인 무효화, 권한 epoch·문서 SHA·source CAS, staging/2-worker 테스트. 신규 인수 완료 **0/5**.
