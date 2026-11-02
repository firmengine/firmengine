# FirmEngine A4 86차 — 법원 보정항목 HEAD 읽기와 SQL 원문 SHA/명령별 답변의 판본 결속 재감사

작성 기준: 2026-11-03 KST. **허용 범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래 A4 실행흐름/동시성/복구. **실제 의뢰인·PDF·OCR 원문·키·실제 법률결론 없음.** 모두 독립 합성 사건이며 SQL 직역/후보 비교는 제품 통합시험이 아니다.

## 1. 인수·소스 선행 확인

- 시작 확인 main HEAD `121d46797dc8e95d1206d595df4b5fb3eadedc00` (A3 r86), 이 영수증 작성 직전 HEAD `121d46797dc8e95d1206d595df4b5fb3eadedc00`; 최근 커밋은 A3 r86, A2 r86, A1 r85, A4 r85. 변경 중인 main을 단일 버전으로 가정하지 않음.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 85차 영수증 `docs/release-audit-runs/A4/20261103-round85-0142KST-correction-transactional-read-and-unobserved.md` blob `bbbe9d395ee1152bc6a0e3ea8f4eca8e3d59bb79` 읽고 이어감.
- `lib/preapproval-correction-item-store.ts` main blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`, Draft #196 같은 파일 blob `736c2cf958e072c425ebe514cd02e1dce5678f12`, Draft #19 같은 파일 blob `5dd412af36129c268eb81b5ed6250a9ca0345f3e`; `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, migration `0022_preapproval_court_correction_items.sql` blob `bec8b19780eaa951c4994530060c916f903a40fe`, 원본 tests blob `b78fa006c9c003b72b79fd79f74630e342b97238`, GET/POST route blob `baf7b7198adeac39e90673a54ab6248243c9fa3b` 확인.
- Draft #196은 **case revision/dataVersion + item HEAD**를 한 D1 `batch()` 스냅샷에서 읽으나 **현재 `documents` SQL의 SHA와 소유 사건**은 그 batch에서 읽지 않는다. `sourceCurrent` 비교는 스냅샷 밖에서 만들어진 `getCase().documents`에 의존. Draft #19은 별개로 동일 사건번호의 복수 명령에 대한 답변 자동 연결을 보류하는 후보. 두 PR 모두 미병합·출시 인증 아님.
- 체크 ID 5건: `A4-IT-012`, `A4-DOC-013`, `A4-LAW-008`, `A4-DATA-012`, `X-042`. 모두 `[ ]` 유지. 6역할 순환: **데이터 → AX → IT → 사용자·서류 → 계산사무장 → 변호사**. 실제 직원/사무장/변호사 승인은 **0건**.

## 2. 86차 신규 재현: HEAD+case 스냅샷만으로 원문 SQL SHA 최신성은 보증 불가

실제 main/#196 SQL 열 이름·JOIN·읽기 판단을 참조하여 **Node 22.16.0 `node:sqlite` WAL 독립 연결 A/B**에서 합성 판본을 재현. 가상 사건 `case-1`, revision=4, source dataVersion=7, HEAD=`head-A`, 문서 `order-pdf`, 원문 SHA=`a×64`; 변호사/법원 승인 항상 false. A의 `getCase`를 과거 SHA=A로 둔 뒤 B가 SQL `documents.sha256`을 B로 변경하되 사건 revision/dataVersion은 그대로 둠. 이는 **복구/비정상 SQL 직접 변경을 가정한 합성 조건**으로 정상 업로드 경로의 발생 빈도는 미관찰.

| 합성 입력 | 독립 기대값 | 관찰값/판정 |
|---|---|---|
| SHA A, HEAD A, 일치 정상 | 현재성 true, 법원승인 false | 기존 식 true, SQL 결속식 true, 승인 false |
| B가 `documents.sha256` A→B, revision4/version7 불변 | 과거 `getCase`만으론 최신 원문으로 확정 금지 | **#196 상당 HEAD+case 식은 true**, 같은 트랜잭션에 SQL 문서 SHA를 조회하는 비교용 가드는 false (부정대조) |
| B가 문서 `case_id`를 타 사건으로 변경 | 타 사건 원문을 현재 사건 증빙으로 승인 금지 | 기존 읽기식 true, 동일 스냅샷 SQL 사건소유자 확인식 false |
| SQL SHA NULL | 미관찰/불일치, 0 또는 승인 아님 | 기존 식 true, SQL 결속식 false |
| SHA A→B→A ABA | 현재 SHA만으로 중간 변경세대 증명 불가 | SQL 결속식 true; 변경세대/불변 ID 별도 필요 |
| 스냅샷 **후** B가 SHA 변경 | 당시 as-of 와 현재 상태 분리 | 당시 true, 현재 SQL B; **응답 시점 최신 보장은 없음** |
| 스냅샷 후 B가 HEAD A→B | 과거 A 인계·후행 승인의 최신성 재CAS 필요 | 당시 A, 최신 SQL B |
| source dataVersion 7→8 | 과거 head는 stale | 기존·SQL 결속식 false |
| 같은 courtReference의 명령 A/B, 답변은 B에만 | A의 답변 자동 연결 금지 | main/#196 상당 courtReference 단독 식 true, #19 명령유일성 가드 false |
| 명령 하나 + 답변 하나 / 다른 사건번호 | 동일 명령만 허용 / 타 사건번호는 거부 | #19 가드의 단일 명령 true, 다른 참조 false |

**독립 신규 시험 11/11 기대 관찰 일치.** 전부 완성품 합격이 아닌 **결함 재현/부정대조와 가드 후보의 합성 기대 일치**. 기존 84·85차 테스트를 현재 로컬 파일에서 재실행해 **84~86차 38/38** 기대 관찰 일치. 86차 스크립트 SHA-256 `1567b939e9f16e2c228ae60422a2df46fe870a760ce04a1cc3d3cae89c7c757a`, 신규 결과 `27718661e027a225a088e431c7de3523648b52619321d8dcc2585f1dfaa4a6e8`, 84~86 회귀 결과 `89d25760619285ba006a6ac40316b7e15058b7a46263ade5ff091e6cff2c4bb1`. 동일 회차 대화 로컬 `/mnt/data/firmengine-a4/r86/`에 스크립트/결과 보존.

## 3. 위험·역할·기술적 수정 후보

- **데이터:** 두 조회를 한 배치로 묶더라도 원문 `documents` 행과 저장된 보정 version SHA가 동일 트랜잭션에 포함되지 않음. 실제 SQL 쓰기 경로가 revision/dataVersion을 항상 올린다면 발생 빈도는 달라짐; 운영 실측 없음.
- **AX:** 조회 current=true가 법률 승인이나 D1 영구 최신을 뜻하지 않음. 재시도/ACK/429·503·timeout 전체 워크플로 미실행.
- **IT:** `#196`을 병합 전, 같은 batch에서 해당 case의 원본 document SHA와 소유 사건을 **관찰**하여 저장 version SHA와 일치 비교하는 읽기 전용 가드를 추가하는 대안이 있음. 스냅샷 외 getCase 유효성/신규 HEAD 인계 CAS는 별도. 변경세대 ABA는 단순 재조회로 해결 불가.
- **서류담당:** 새 원문이 생긴 뒤 과거 보정항목/검수의 `current` 표시 및 재작업 안내를 별도 검증해야 함. 실제 화면에서 무효화/재생성 테스트 없음.
- **계산사무장:** 이번 보정항목 조회는 10분 quiet 계산이나 18개 계산식·법률 95개 risk 값을 재평가하지 않았음. old/new sourceVersion과 계산/Word 연결 E2E 미실행.
- **변호사:** `#196`의 일관 스냅샷만으로 같은 사건번호의 개별 명령/답변 정합을 보증하지 않음. `#19` 명령별 유일성 정책 후보와 **실제 법원 명령 ID·답변/접수증 원문·사람 승인** 별도.

고위험으로 **운영 로직을 main에서 변경하지 않음**: #196 및 #19와 동일 함수가 겹치고 SQL 문서 변경 경로/응답 의미를 제품 TS+staging으로 확정하지 못했음. 격리 검증된 기술적 결속식은 수정 제안/검토 주제로 남김. 정상 문서교체가 ID 불변인 경우가 실제 존재하는지부터 소스/DB로 확인할 필요 있음.

## 4. 각 체크 ID 판정 및 미실행

- `A4-IT-012` **[ ]**: as-of HEAD vs 최신 문서 SHA 및 HEAD 후행 변경, 최종 write CAS 미검증.
- `A4-DOC-013` **[ ]**: 새 증빙의 기존 문서 검수 무효화는 기술 위험만 합성; 실제 Word/UI 인계 미실행.
- `A4-LAW-008` **[ ]**: 동일 사건번호 답변 오연결 부정대조와 SQL 원문 SHA drift; 실제 PDF/페이지/법률 승인은 미실행.
- `A4-DATA-012` **[ ]**: 두 워커 순서, as-of vs 최신, ABA와 sourceVersion 비교; 실제 outbox/웹훅 미실행.
- `X-042` **[ ]**: 보정명령-답변 식별과 원본 SHA 기술 연결만; 기한·접수증·실제 보정 원문 검증 미실행.

**미실행/미관찰:** 실제 repo TS test·npm CI·Next build, staging D1/R2/Cron, D1 live batch 및 두 HTTP worker, R2 성공 후 D1 실패/ACK loss, 중복 webhook, 429/503/timeout 제품 장애주입, 상담→서류→OCR→10분 quiet calculation→95법률→Word→직원/변호사→법원보정 종단, 운영 n8n, 변호사 승인, 사이트 배포. 0건·NULL·미관찰·비해당·상충·source-only·사람 승인전은 구분했고 법원 인가·이행 확정으로 승격한 항목 0건.

**다음 체크 후보:** `A4-IT-003`, `A4-CALC-014`, `A4-AX-013`, `A4-LAW-008`, `X-042`. PR #196/#19의 단일 HEAD·원문 SHA·order identity 결합, 실제 source 변경 이벤트가 dataVersion을 증가시키는지, 수정 후 Word 재생성/기존 직원·변호사 승인의 무효화를 순서대로 검증. **이번 신규 최종 인수 0/5.**
