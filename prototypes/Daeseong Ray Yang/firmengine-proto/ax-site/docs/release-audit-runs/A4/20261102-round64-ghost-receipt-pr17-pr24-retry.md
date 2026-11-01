# FirmEngine A4 64차 — 자동 Word 영수증 잔재와 R2 보존 정책 교차 재시도 (2026-11-02 KST)

## 범위 / 진실 상태
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 합성 사건만 사용하고 개인정보·원본 OCR·비공개 정답·키·.env·실제 고객 사건을 저장하지 않음.
- 조회 직전 `main` HEAD: `3945975dde7445fa859d6c4033fe53cc50ef9f3d`; 중앙 보드 원본 blob: `784285987f009d147bed1bfb88e8ee278c5dc48d`. 최신 main 및 blob은 실제 갱신 직전에 다시 확인한다.
- 최근 main 커밋: `3945975` (A3 r64 보드 영수증 경로), `fc0acff`, `4d3648a` (A3), `a3cd40a`, `84d9cad` (A2), `4fbe73a` (A1). 다른 축 변경은 수정하지 않음.
- 읽은 main 소스 blob: `lib/automatic-review-draft.ts` `5ee8860250303ac9ca513b0be22e886f98c8e904`; `lib/export-artifact-transaction.ts` `a114235e5b5de57b5ae58b41026f939ee8543174`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 비교 Draft PR: #17 HEAD `0ce1292a241d8baf98d5b9e230071cca980eb2fa` 및 SQL helper blob `ebb2de08c1371ed3c37d9946f37b3ce251a8b628`; #24 HEAD `dc5d93d45e944466ba126d2b998345d6c2f38843`; #150 Head `744a5f17e4189517e049419a871c9039597bc0ff`. **셋 모두 Draft/Open/미병합.**
- 선행 영수증: `20261102-round63-0342KST-auto-draft-manifest-lease-source-head-epoch.md`, 실제 PR #17/#24 소스와 관련 테스트 직접 조회.
- 이번 역할 검토 순환: **계산사무장 → 변호사 → 데이터 → AX → IT → 사용자·서류**. 사람이 실제로 승인했다는 의미 아님.
- 선정 [ ] 미완료: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-046`. `A4-CALC-016`, `A4-AX-013`은 인접 조건 간접점검만 진행.

## 코드에서 확인한 경계
1. main `commitManifest`는 고정 ID `auto-draft-receipt:auto-draft:<legalReviewRunId>`로 `analyses` writer receipt를 **무조건 INSERT**, 그 다음 `case_automatic_document_runs`에 조건부 UPDATE한다. 선행 63차에서 receipt 1 / manifest 0의 부분성공 반례가 있었다.
2. Draft #17의 `buildAutomaticDraftManifestCas`는 receipt를 `INSERT ... SELECT ... WHERE pending AND currentHeads`로 개선하되, 같은 ID가 이미 `analyses`에 존재하는지 확인·분류/재사용하지 않는다. 기존 잔재가 있으면 PRIMARY KEY 충돌로 finish UPDATE까지 도달하지 못한다.
3. Draft #24의 `commitExportArtifactTransaction`은 `manifestCommitAttempted` 이후 오류에서 SQL artifact/R2 bytes를 삭제하지 않는다. 이는 소실된 D1 ACK에 대한 보수적 안전정책이다. #17의 실패가 영속적으로 반복되면 별도 재조정 없이 매 실행의 새 UUID artifact가 보존될 여지가 있다. **#17 + #24가 실제로 통합/배포되었다는 주장은 아님.**

## 실제 수행 — 독립 Node 22.16 SQLite WAL 두 연결
- 로컬 코드: `/mnt/data/firmengine-a4/round64_pr17_pr24_ghost_receipt_retry.test.mjs`. PR #17 SQL 문자열 전사, PR #24 오류 시 보존 제어흐름만 별도로 합성 모사. SQL은 파일형 WAL 두 연결에서 실행했고 가상 R2는 in-memory Map으로 대체했다. 두 연결의 인터리빙은 의도적으로 **순차 주입**했으며 실 HTTP/Cloudflare concurrency는 아니다.
- 입력: 사건 `case-S`, revision 3, dataVersion 7, run `run-S`, legal `legal-S`, 기준SHA `ref-A`, job `running`, 유효 lease `lease-B`, 자동 Word manifest `pending`. 선행 main 부분성공으로 고정 ID의 `analyses` 영수증 1개 존재, manifest 미완료.
- 기대: (정상) 영수증 1/manifest 1; (동일 증빙 재시도) 이전 영수증을 무조건 삭제·덮지 않고 검증 뒤 재사용 또는 보류; (증빙 충돌) 보류와 정확한 오류 구분; (반복 오류) 무제한 새 R2/SQL 객체 생성 방지.
- 관찰: 정상 대조 **1/1**. 유효 lease 재시도의 #17 receipt INSERT는 `SQLITE_CONSTRAINT`이고 manifest는 계속 **pending**. 기존 영수증 payload가 같은 값이든 다른 값이든 동일 PK 오류. lease `B→C` 교체 후에도 같은 오류.
- #24 보존 제어흐름을 결합한 별도 합성에서 3회 재시도 모두 SQL receipt 충돌, 매번 임의의 새 file UUID가 보존돼 **SQL artifact 3행 + 모사 R2 Map 3객체**, manifest 여전히 `pending`. 이 수치는 실제 R2 객체/고객 문서가 아닌 합성 객체.
- 신규 독립 Node TAP **8/8 통과**(위험 재현/정상 대조 포함). 로컬에 존재하는 54~64차 스크립트 일괄 재실행 **103/103 관찰 일치**(부정대조 포함). 실제 저장소 Node-native/TypeScript·Next·CI **미실행**.

## 실제 조치 / 병합 판단
- 고위험 데이터 복구 의미가 포함되어 **실행 코드 변경·자동 영수증 재사용·삭제·브랜치 병합·배포를 하지 않음**.
- 독립 재현과 병합 보류 조건을 PR #17 [댓글](https://github.com/firmengine/firmengine/pull/17#issuecomment-6562937977), PR #24 [댓글](https://github.com/firmengine/firmengine/pull/24#issuecomment-6562938976)에 각각 기록. 현재 PR을 덮어쓰지 않음.
- 검토할 계약: 완전한 case/review/source/reference/영수증 payload 증거 일치와 active lease를 **읽기전용 재조회**해 확실한 동일 증빙만 명시적 idempotent 재개; 상충/null/미관찰은 별도 보류. `INSERT OR IGNORE`로 상충 영수증을 은폐하거나 현행 live R2 파일을 지우지 말 것.
- 기존 기준정보 A→B→A 승인세대 CAS 및 타 사건 Run 소유권/입력 SHA 문제도 별도 미해결. 실제 법률·회계 인정·문서 승인 의미 변경은 실무자 검토 필요.

## stage / 미실행 경계 및 다음
- 상담→필요서류→OCR→10분 quiet 계산→법률 95개→Word 초안→직원/변호사 검수→실제 보정 이벤트의 종단 stage, 승인 인계, 갈음 철회, 관할 판본, 마감기한, 재생성 **이번 회차 미실행**. 이번에 검증한 것은 자동 Word D1 manifest 경계와 재시도 합성뿐.
- 중복 웹훅·timeout/429/503·실제 R2 PUT 성공 후 D1 실패/ACK 유실·실 staging D1/R2/Cron·운영 n8n/설계 n8n 동등성·실 HTTP 두 워커·실제 Word 바이트 **미실행**. `NULL`/미관찰/0/비해당/상충/source-only/승인전 분리 유지.
- 다음 ID: `A4-IT-005`, `A4-DATA-013`, `A4-DOC-011`, `A4-LAW-013`, `X-046`. 정상 증빙 재생과 ghost receipt 충돌을 별도 정책으로 분리, #17/#24 겹치는 `automatic-review-draft.ts` 충돌 조정, 진짜 D1/R2 429/503/ACK 유실 장애주입 및 법률 95→Word→기존 승인 무효화 E2E가 필요.
- 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 **전부 하지 않음**. **선정 5개 최종 인수 0/5, 제품 전체 최종 인수 0건.**
