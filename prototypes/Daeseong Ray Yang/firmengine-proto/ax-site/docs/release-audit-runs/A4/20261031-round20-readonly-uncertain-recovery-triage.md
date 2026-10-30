# FirmEngine A4 20차 — 영속 Export claimed/uncertain 증빙의 읽기 전용 복구 분류

- 범위: GitHub `firmengine/firmengine` `main`, 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 작성 기준 main HEAD `ebe5ad127ecc9ecdce88e9f6f22c76b9c2f83f36`. 앞선 [19차](20261031-round19-pre-r2-artifact-intent-ledger.md) 예약 원장 개선 후속.
- 관련 Draft [PR #61](https://github.com/firmengine/firmengine/pull/61): `e1a10be1e83516fa383d91f08dfdb62c7b530a5b`; `open/draft/미병합`. 0023 migration은 **제안만** 존재, 운영 DB에 적용하지 않음.
- 확인한 이전 근거: A4 19차 영수증, 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 체크 ID, `drizzle/0023_case_export_request_receipts.sql`, PR #61 `lib/export-request-ledger.ts`·`app/api/cases/[id]/export/route.ts`·원장 테스트, main `lib/export-reconciliation.ts`, `lib/domain.ts::touchCase`·`lib/document-writer.ts`·`lib/document-workflow-gate.ts`; main 최근 8개 커밋과 PR #61 메타데이터 읽음.

## 회차 역할과 보드 ID

- 이번 주역: **서류담당자→변호사→IT→데이터→AX**, 이전 19차 데이터·계산·IT·AX 집중과 순환. 법률 인정은 인간 전권.
- 선정: **IT `A4-IT-005`**, **서류 `A4-DOC-011`**, **사무장 `A4-CALC-016`**, **변호사 `A4-LAW-013`**, **데이터 `A4-DATA-014`**, **AX `A4-AX-003`**, 교차 **`X-047`**. 실제 진단 실행에 연결된 활성 부분 검증 4개는 `A4-IT-005`, `A4-DATA-014`, `A4-AX-003`, `X-047`; 나머지 세 역할은 stage/승인 경계만 읽었고 Word·재계산·법률 승인은 **미실행**.
- 모든 ID **[ ] 유지**, release/법률 승인 아님. 사람 승인 없이 계산·법률/최종서식 결과를 확정하지 않음.

## 관찰한 공백과 코드 수정

- PR #61의 `reserveExportArtifacts`는 R2 PUT **전에** 영속 요청 원장의 `artifact_ids_json`에 예정 ID를 기록한다. 이것은 R2 객체 또는 D1 SQL의 실제 존재 증명이 아니다. `claimed`·`uncertain` 상태에서 자동 재시도·삭제·`committed` 승격은 여전히 금지.
- 기존 main `reconcileExportEvidence`는 현재 파일의 SQL/R2 증빙 위주로 확인하고 요청 `artifact_ids_json = NULL`과 `[]`, 실제 R2 성공 후 SQL 미관찰/0건, 역사 문서 A→B, 감사 이벤트의 다른 요청 ID 섞임을 요청 단위로 완결해 판단하는 모듈은 없었다. 이것은 **진단 범위의 공백**이며 실제 운영 유실 사건을 발견했다는 주장이 아니다.
- 신규 독립 읽기 전용 `lib/export-recovery-evidence.mjs`(blob `62221fe813d8608bcb4d523a723fef8dd193a7c6`) 및 `tests/export-recovery-evidence.test.mjs`(blob `7c394cea6ef987f704bc206f5560f3bdf7b5ffd6`)를 **main**에 추가. 어떠한 API·자동 복구·승인 경로에도 연결하지 않음. 모든 판정에서 `canDelete/canReplay/canMarkCommitted/canApprove=false`를 강제.
- 개발 중 실제 V8 부정대조에서 SQL 해시가 `null`일 때 `toLowerCase()` 오류가 발생할 수 있는 예외 경로와, SQL 입력 자체가 `null`인 경우에도 `R2_WITHOUT_SQL_ROW`(SQL 부재 확인)로 잘못 표시되는 구분 오류를 확인, 수정 후 각각 회귀 시나리오 반영. 감사 이벤트는 단순 `type` 일치가 아닌 **caseId·requestId·revision 동일성**을 요구해 다른 요청의 유사 이벤트를 합치지 않음.

## 실제 수행: 합성 입력 → 독립 기대 → 관찰

합성 전용: `caseId=synthetic-case`, `requestId=request-aaaaaaaa`, `caseRevision=3`, `sourceDataVersion=7`, `artifactId=artifact-aaaaaaaa`, `SHA=a×64`. 고객자료·실제 OCR·개인정보 없음.

| 합성 사건/입력 | 독립 기대 | 실제 V8 함수 관찰 |
|---|---|---|
| `artifactIdsJson=null` | 예약 계획 미관찰, 0개 확정 아님 | `unplanned / PLAN_NOT_OBSERVED` |
| `artifactIdsJson="[]"` | 실제 관찰된 빈 배열은 무효 | `conflict / PLAN_OBSERVED_EMPTY` |
| R2 바이트 성공, `artifactRows=[]` | D1 SQL 0행 확인, 객체 보존 | `inconclusive / R2_WITHOUT_SQL_ROW` |
| R2 바이트 성공, `artifactRows=null` | SQL 자체 미관찰, 고아 확정 금지 | `inconclusive / SQL_ROWS_NOT_OBSERVED`; **orphan 코드 없음** |
| R2 요청 timeout/429/503에 해당하는 `objectProofs=null` 합성 | 성공/실패/객체없음 단정 불가 | `inconclusive / R2_PROOFS_NOT_OBSERVED` |
| R2 probe 상충, 또는 실제 바이트 SHA 불일치 | 경합·충돌 경고 | `conflict` |
| D1 응답 소실 후보: `uncertain`+SQL/R2 byte+manifest+동일 요청 두 감사 event | 읽기 전용 일치, 확정/자동 재개 금지 | `evidence_consistent_review_required`, 모든 권한 false |
| 오래된 A의 receipt, 현재 manifest B | 구판본 재사용 금지 | `historical / HISTORICAL_OR_OTHER_MANIFEST` |
| OCR sourceVersion 7→8, 판본 지연 | stale current 승격 금지 | `stale / SOURCE_OR_REFERENCE_STALE` |
| 타 사건 SQL row·타 요청/사건 audit event | 외래 증빙으로 성공 판정 금지 | 각각 `conflict` / `inconclusive` |
| SQL 해시 `null` | 진단 크래시가 아닌 거부 | `conflict / SQL_IDENTITY_OR_HASH_CONFLICT` |

- **실제 GitHub 반영 소스+테스트 함수 본문을 V8 격리 실행: 22/22 PASS**. Node-native `node --test`는 **작성만, 미실행**; V8 결과를 Node 테스트 통과로 표현하지 않음.
- 19차 로컬 Python sqlite3 합성 계약을 **이번 회차 다시 실행**: artifact 예약·2요청 동시 CAS·ACK 소실·부분성공 12/12 PASS, 기존 audit/commit 원자계약 10/10 PASS. 두 스크립트는 실제 GitHub PR TypeScript 실행이 아닌 **독립 SQLite SQL 합성**.
- 현재 생성물 재사용이나 인간/법원 승인을 이 결과로 증명하지 않는다. `evidence_consistent_review_required`도 조사 순서를 돕는 분류일 뿐 자동 상태 전이 금지.

## stage/인계·잔여 위험·다음 ID

- 상담→서류→OCR→10분 quiet calculation→95개 법률 검토→Word 초안→직원 선검수→변호사 독립 승인→실제 보정 이벤트의 source/calculation/reference/manifest 버전 인계는 **종단 실험 미실행**. `touchCase`의 Export 무효화·`document-writer`의 평가 판본 검사는 정적 코드 확인만. 직원 승인/법률 승인/실제 보정기한을 D1 영수증으로 대신하거나 `null` 기한을 임의 채우지 않음.
- n8n 설계 문서 ≠ 운영 워크플로 연결. 실제 Cloudflare **staging D1/R2/Cron, 실제 HTTP 두 워커, timeout/429/503 네트워크 주입, 전체 Node/TypeScript/CI/Next 빌드, 공식 서식/Word 실제 바이트·직원/변호사 검수, 배포 모두 미실행**. 법원 전자제출/인가 결정, 운영 마이그레이션, 고객자료 변경 없음.
- 진단 모듈은 **엔드포인트 미연결**, 계획·SQL·R2 증빙을 조합하는 도구일 뿐 영속 상태 변경 기능 없음. 특히 `claimed` reservation ACK 유실의 결과, R2 bucket inventory 불완전성, 이벤트 원장 출처 신뢰, 다중 파일 일부 실패, 법원 기준판본/갈음 철회/기한 미확정/재생성 인계는 추가 실행 필요.
- 다음 체크: `A4-IT-003`+`X-046` (실제 두 HTTP 워커 claim/CAS), `A4-DATA-013`+`X-047` (R2 성공 뒤 D1 ACK 유실과 2-worker orphan 증빙 read-back), 이후 `A4-DOC-011`+`A4-CALC-016`+`A4-LAW-013` (원본문서·기준정보 변경 후 계산/법률/Word 검수 무효화). 실무/법률 의미 변경은 별도 PR+승인으로 처리.
- **제품 최종 인수: 0건.**
