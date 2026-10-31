# FirmEngine A4 23차 — 두 DB 연결 경쟁 및 SQL→R2 objectKey 교차별칭 읽기 전용 복구 감사

2026-10-31 KST · 축 A4(실행 흐름/예외/동시성/복구) · **전부 합성 사례** · 제품 최종 인수 **0건**

## 범위·출처·기준 버전
- 시작 시 확인한 GitHub `main` HEAD: `60585de15954d1fb40ac829535b69f4905ddee8f` (A3 r23 보드 갱신). 최신 A2/A3/A1 커밋·Open PR 목록과 A4 Draft [PR #61](https://github.com/firmengine/firmengine/pull/61) (head `e1a10be1e83516fa383d91f08dfdb62c7b530a5b`, Open/Draft/미병합) 확인.
- 인수 원장 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 22차 영수증, `lib/export-recovery-evidence.mjs` 원본 blob `ddb960593ffb4bd2cd50c869f77c5dae450a47fe`, 테스트 20·21·22차, PR #61의 `drizzle/0023_case_export_request_receipts.sql`, `lib/export-request-ledger.ts`, `app/api/cases/[id]/export/route.ts`, `lib/server-store.ts`, `tests/export-request-ledger.test.ts` 확인. SQL 계약의 출처는 **미병합 PR**이며 실제 `main` HTTP Export 경로라고 주장하지 않는다.
- 역할 검토 순서 **AX→IT→서류담당자→계산사무장→변호사→데이터담당자**(이전 회차 데이터 중심에서 순환). 실증 추가 ID 5개: `A4-IT-003`, `A4-IT-004`, `A4-DATA-014`, `A4-AX-003`, `X-046`. 교차 경계 검토만 한 `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`과 다음 타깃 `A4-DATA-013`, `X-047`은 합격 아님.

## 독립 기대와 실제 관찰 — 읽기 전용 진단의 P1급 거짓 일치 후보
- 합성 입력: `synthetic-case`, 요청 `request-aaaaaaaa`, 원장 `uncertain`, revision 3, sourceVersion 7, SHA=`a`×64, 계획 artifact `artifact-aaaaaaaa`, 해당 R2 key 및 SQL·manifest·감사 이벤트 2건 일치. R2 SHA는 **검증되었다고 가정한 합성 입력**, 실제 R2 다운로드 결과가 아님.
- 독립 기대: **다른 artifact ID/다른 사건/오래된 revision의 SQL 행이 현재 계획 R2 objectKey를 중복 참조하면 conflict**, 정상 단독 SQL 행은 `evidence_consistent_review_required`; 무관한 objectKey는 현재 사건과 독립; 자동 재실행·삭제·완료·승인 불허.
- 수정 전 실제 원본 함수(V8 격리): (1) 외부 사건+다른 artifact ID, (2) 동일 사건+다른 ID, (3) 구 revision+다른 ID가 같은 key를 가리켜도 세 경우 모두 `evidence_consistent_review_required`로 **거짓 일치**. 현재 planned artifact ID 중복은 기존 `SQL_ROW_DUPLICATE`로 별도 감지.
- 수정: `lib/export-recovery-evidence.mjs`의 관찰된 SQL 목록에서 **현재 계획된 R2 key에 대한 비동일 소유자·버전·artifact ID의 별칭**을 `SQL_OBJECT_KEY_ALIAS_CONFLICT`로 격리. 삭제·복구·승인 기능 추가 없음. 코드 commit `1ab3e82277e09295ad0df3dc495b24b7056b17ae`, 새 blob `65e2e6af10a722532c3ebef65fa830d7b60b196e`.
- 신규 회귀 파일 `tests/export-recovery-object-key-alias-r23.test.mjs` commit `a599cdd04e8a069abcde4bb15929587b9c46f51a`: 정상·교차 사건·동일 사건 별칭·구판본 별칭·무관 객체·중복 planned ID·미관찰 SQL·R2 503·원본판본 변경 등 총 **12 테스트**.

## 실제 실행 영수증
| 실행 환경/입력 | 독립 기대 | 관찰 |
|---|---|---|
| GitHub 원본 함수와 수정본 V8 대조, SQL objectKey 중복 3종 | 기존 거짓 일치 재현, 수정 conflict | **3종 거짓 일치 재현 → 수정 후 `SQL_OBJECT_KEY_ALIAS_CONFLICT`** |
| **실제 GitHub에 기록된** read-only 함수+4개 기존/신규 `node:test` 소스를 V8 shim에서 실행 | 각 독립 단정 통과, 권한 4종 항상 false | **54/54 PASS** (20차 22, 21차 8, 22차 12, 신규 12), Node-native 실행은 **미실행** |
| 두 개 독립 파일 기반 SQLite 연결(WAL)에서 같은 UUID 동시 claim | 단 한 워커만 1행 claim | **[1,0]**, 1행 영수증 |
| 같은 사건·서로 다른 UUID 두 SQLite 연결 동시 claim→각 artifact SQL→동시 CAS | claim **[1,1]**, CAS **[1,0]**, 패자 현재 manifest 승격 금지 | **예상 일치**, 패자 artifact SQL은 잔존하고 요청은 `claimed→uncertain` 분리 (자동 삭제/회복 없음) |
| 데이터 판본 7→8 이후 구판본 commit | CAS 0, 증빙 보존 | **CAS 0, uncertain** |
- 실제 SQLite 실행 파일(공개 Git 미적재): `/mnt/data/firmengine-a4/round23_two_connection_export_race.py`, **3/3 PASS**. 이 SQL은 PR #61 계약의 **복제된 합성 모델**이고 직접 PR의 HTTP/Cloudflare D1 실행이 아니다.
- GitHub V8 단위 시험에서 54/54 확인했지만, 독립 Node-native runner, 저장소 전체 TypeScript/CI/Next 빌드, staging D1·R2·Cron, 실제 HTTP 두 워커, 운영 n8n과 Word 바이트 생성은 모두 **미실행**.

## 복구 한계·사람 승인 경계
- 서로 다른 UUID 두 워커의 `claim`이 둘 다 성공하는 것은 여전히 PR #61 설계 내에서 관찰된다. 현재 최종 manifest의 CAS는 한쪽만 허용하지만 패자의 SQL/R2 orphan 보존·보상 및 DLQ 업무는 미완료다. 두 UUID를 사건 단위 직렬화하는 변경은 운영 동시성·회복 의미를 바꾸므로 별도 검토 전 직접 적용하지 않는다.
- `상담→서류→OCR→10분 quiet calculation→95법률→Word 초안→직원/변호사 검수→실제 보정 이벤트`를 관통하는 산출물 판본·CAS·승인 인계의 **실행 증빙 없음**. 운영 n8n 실행과 설계 문서는 분리하며 실제 법원기한 미확정/갈음철회/관할판본 변경의 E2E도 미실행.
- `null` 미관찰, `[]` 관찰된 0건, `conflict` 상충, `stale` 구판본, `inconclusive` 증빙불충분 및 사람 승인 전을 섞지 않는다. 현재 `evidence_consistent_review_required`도 사람 승인/법률 확정이 아니다. 실제 고객/원본 OCR/개인정보/키/비공개 정답은 사용하지 않음.
- **보드 체크 ID 전부 `[ ]` 유지**. 최종 인수 0건. 배포·운영 마이그레이션·전자제출·실제 인가 확정 없음.

## 다음 회차
1. `A4-DATA-013` + `X-047`: R2 저장→D1 ACK 소실·부분 성공의 **실제 영수증 읽기 어댑터**와 D1/R2 staging 허용 여부 확인, 불가하면 미실행 명기.
2. `A4-IT-003` + `X-046`: PR #61의 서로 다른 UUID 두 요청이 동시에 성공 claim 하는 경계와 orphan/DLQ 상태를 SQL 저장증빙으로 추적(현재는 파일형 SQLite 합성만).
3. `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`: 문안/원본 변경→quiet 재계산→법률 95개 재검토→재생성 후 검수·승인 무효화 종단 재현. 공식 서식·변호사 승인/사이트배포는 별도 인수.
