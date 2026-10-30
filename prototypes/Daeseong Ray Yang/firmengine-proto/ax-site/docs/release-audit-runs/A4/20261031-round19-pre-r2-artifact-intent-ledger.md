# FirmEngine A4 19차 — Export 요청별 생성물 계획을 R2 PUT 전에 영속 연결

- 날짜: 2026-10-31 KST. 전 회차: [18차](20261031-round18-hash-proof-duplicate-manifest.md).
- 범위: `firmengine/firmengine`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. **실제 운영 반영 아님.**
- 읽기 전 main HEAD: `05c6b948a4a7961b54659d100d9cb52138827a6a`; 중앙 보드 기존 blob: `56a3b1cb585c7169b05aca23b6968daf7ce02d44`. 최근 main 커밋은 A3 r19(05c6b948·32ecfee7), A2 r19(7a920118·462eb7d6), A1 r19(94ed1a56·e600290c), A4 r18(6270f97e·826f4eb2) 순으로 확인. 주요 PR #61은 작업 전 `988ff9cb4fa822981b8487a7939bf6116bd50d15` Open/Draft/미병합.
- 관련 읽기: `drizzle/0023_case_export_request_receipts.sql`, `db/schema.ts`, `lib/export-request-ledger.ts`(기존 blob `630acbcbaf5e08ad484e9b717a40065b5114eda4`), `lib/server-store.ts`(`1d4bd97802d892364db00013bbd9dc7939edadb4`), `app/api/cases/[id]/export/route.ts`(`4c19730a5db753661b0e2a72dfeb6dc5d6bb6dd7`), `lib/export-reconciliation.ts`, `tests/export-request-ledger.test.ts`(`fcec84d0716b5665747786579cd0b45ca1fb358a`), r17·r18 영수증. PR #61의 0023 migration은 **제안이며 D1 운영에 적용하지 않음**.

## 역할 순환·체크 ID

이번에는 데이터→계산사무장→IT→AX 역할에서 요청 영속성과 경쟁/복구를 우선. 실제 부분검증을 연결한 다섯 개 ID는 `A4-DATA-014`, `A4-CALC-016`, `A4-IT-005`, `A4-AX-003`, `X-047`. 사용자·서류담당자 `A4-DOC-011`(문안 편집/재생성 경쟁), 변호사 `A4-LAW-013`(Word 바이트/최종 승인)은 흐름 경계를 읽었으나 이 회차에 해당 사람 검수/Word E2E를 실행하지 않았으므로 **통과나 보드 완료로 승격하지 않음**. 여섯 역할 모두 독립 책임을 유지한다.

## 부정대조: 저장 증빙은 있는데 요청별 조회 실마리가 없다

- 기존 Draft #61은 `claimExportRequest()`에서 `artifact_ids_json=NULL`로 등록하고, `commitExportRequest()`에서만 artifact IDs를 쓴다. R2 PUT 또는 D1 artifact INSERT 실패 후 `markExportUncertain()`을 호출해도 원장에 저장된 ID가 **NULL 그대로**인 구조였다.
- 독립 SQLite에서 제안 SQL의 `claim→uncertain`을 실행한 관찰은 `('claimed', NULL, NULL)→('uncertain', NULL, NULL)`. 예상은 자동 정상 판정이 아니라 **요청에 귀속되는 예정 artifact ID가 있어야 이후 R2/SQL 증거를 조사할 수 있음**이다. 이는 **Draft 제안 코드의 장애복구 계약 공백**이며 실제 고객/운영 R2 고아 파일 발생 증명은 아니다.
- 장애로 응답이 유실되거나 상대 워커가 CAS에서 패배하면 artifact 자체는 보존되더라도 요청-생성물 연결이 없는 경우 운영자가 어느 객체를 살펴볼지 결정하기 어렵다. 미관찰, 파일 없음, 0, 과거 증빙, 현재 확정, 법적 승인 상태는 서로 다른 값이다.

## 범위 내 개선: 별도 Draft PR #61에만 코드 적용

- `lib/export-request-ledger.ts`: `reserveExportArtifacts()` SQL 추가. `claimed` 영수증의 `artifact_ids_json IS NULL`일 때만, 같은 사건/requestHash/requestId/claimToken/revision/sourceVersion/referenceSHA 및 최신 사건 storage token을 조건으로 **예정 ID 목록을 한 번 저장**. 빈/중복/잘못된 ID는 사전 거부. 이 값은 **의도 기록이지 R2 바이트 존재 증명 아님**.
- `app/api/cases/[id]/export/route.ts`: 기존 claim 성공 뒤 **첫 R2 PUT 전** 예약 실행. 예약의 응답 유실/조건부 실패는 새 R2 업로드를 진행하지 않고 보류, 바깥 catch에서 해당 claim만 `uncertain` 후보 처리. 성공 불확정 파일 자동삭제 및 구요청 자동 재실행 금지 유지.
- `lib/server-store.ts` 및 ledger COMMIT SQL: manifest CAS와 receipt COMMIT 양쪽에서 **예약된 JSON ID 배열과 실제 산출 ID 배열이 같아야** 저장 가능. 예약 계획 교체 금지. 예약 이후 `updated_at`이 이전 claim 시간으로 되돌아가지 않도록 COMMIT/uncertain 시각도 호출 시점으로 갱신.
- 기존 `tests/export-request-ledger.test.ts`는 선예약 계약에 맞게 조정했고 신규 합성 시나리오 다섯 개를 추가했다. **Node-native 테스트 코드는 작성했으나 이번 회차 실행 미실행**.
- PR 실제 코드 커밋: `02779bc9de9147bb4ff0d1c9eb66ebc43d7e6cf5`(4개 파일) + `e1a10be1e83516fa383d91f08dfdb62c7b530a5b`(2개 파일 시각 정정). PR #61은 Open/Draft/미병합을 유지. 바깥 경로 변경 없음.

## 재현 입력 → 독립 기대 → 관찰 결과

- 합성 식별자: `case_id=synthetic`, `revision=3`, `storage_token=token-3`, `source_version=7`, 두 UUID `request-a/request-b`, 서로 다른 claim token, `artifact-a/artifact-b`. 개인정보, 실제 OCR 값, 진짜 법원 판단 없음.
- Python `sqlite3 :memory:`에서 **12/12 PASS**: 신규 예약 성공, 동일 요청 중복 차단, 다른 claim token 거부, 원천 data_version 변경 차단, 사건 storage token 변경 차단, 예약 ACK 유실 뒤 `uncertain`에서 ID 유지, SQL 생성물이 없는 COMMIT 차단, 올바른 예약/SQL/CAS COMMIT, 다른 artifact 목록 교체 차단, `uncertain`의 자동 committed 승격 금지, 두 요청 ID 워커의 CAS 승자 1/패자 1(+패자 ID 보존), 다중 artifact 부분 성공에서 COMMIT 차단 뒤 전체 SQL 확보 시 COMMIT.
- 기존 14차 독립 SQL 계약 스크립트 재실행 **10/10 PASS**(같은 UUID claim, 두 워커 CAS, 감사 이벤트 오류 롤백, ACK 유실 등). 스크립트 자체가 실제 PR 코드·Cloudflare D1 테스트는 아니다.
- GitHub 신규 소스/route/guard/receipt 시각/테스트 존재 및 순서 **정적 검사 10/10** 확인. 신규 TypeScript/Node 테스트 19개 중 신규 5개는 작성 상태, **전체 Node 실행 미실행**. TypeScript 전체 검사/Next 빌드/GitHub Actions CI도 이번 회차 미실행.
- 로컬 독립 시험 스크립트: `/mnt/data/firmengine-a4/round19_intent_reservation_contract.py` (SHA-256 `b6b73d15978f58e39e28f8b8c6c46c5bf9020ae091afa1a8f24f0872bdd89970`), 기존 `/mnt/data/firmengine-a4/sql_atomic_contract.py`. 이 스크립트들은 GitHub 공개 소스에 개인정보나 별도 정답으로 적재하지 않음.

## 위험·미실행·다음 검증

- **아직 미해결:** `claimed`에서 예약을 마치기 전에 응답이 유실되면 artifact IDs는 NULL일 수 있다. 이는 R2 작업을 시작하지 않았을 가능성이지 확정 실패/0개 파일이라는 증명은 아니다. R2 실제 바이트 해시·D1 SQL·현재 manifest·두 감사 이벤트·신규 생성물의 용도/최종 Word SHA를 read-only로 대조할 절차와 승인/복구 UI는 여전히 없음. 이 PR만으로 안전한 자동 복구/삭제/완료 승격이 가능하다는 결론 금지.
- **검증 경계:** 상담→85서류→OCR→10분 quiet 계산→95개 법률위험→Word 초안/재생성→직원/변호사 순차 승인→실제 법원 보정 이벤트에 대한 **E2E 미실행**. n8n은 설계 문서와 실제 운영 연결을 구분하며 이번 회차 실제 n8n workflow/Cloudflare staging D1·R2·Cron/HTTP 두 워커 장애주입/전자제출/법원 확정/운영 DB 마이그레이션/사이트 배포 **모두 미실행**.
- 다음 후보: `A4-DATA-014`·`A4-IT-005`·`X-047`에서 proposed 0023 migration staging 적용 전 안전성 점검, artifact plan 기반 `claimed/uncertain` read-only 진단(미예약/부분SQL/실제 R2 바이트/ACK 유실/서로 다른 ref/revision/원문변경), `A4-IT-003`·`X-046`에서 PR 실제 두 HTTP 워커 경쟁·패자 orphan 보존. 이어 `A4-DOC-011`·`A4-CALC-016`·`A4-LAW-013`에서 재계산·법률기준/관할 변경·Word 재생성/검수 무효화·법원 기한 null 방어를 평가.
- 모든 선택 ID **[ ] 유지**. **제품 최종 인수 PASS: 0건**, 실제 사람 승인/전자제출/인가 확정 없음.
