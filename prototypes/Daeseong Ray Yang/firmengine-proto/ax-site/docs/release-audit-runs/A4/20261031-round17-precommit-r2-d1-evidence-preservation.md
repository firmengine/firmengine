# FirmEngine A4 17차 — Export 사전 COMMIT ACK 불확실성의 증빙 보존
작성: 2026-10-31 KST. 이전 회차: [16차](20261031-round16-precommit-claimed-to-uncertain.md).

## 범위·소스 계약
- 저장소 `firmengine/firmengine`; 읽기 당시 main HEAD `307ce9a5f0306d75a8c7b6ef2dc9fffa5383a108`. 모든 변경은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부.
- 단일 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 A4 ID에 연결. 운영 Export 코드는 main에서 수정하지 않고 기존 **Open Draft [PR #61](https://github.com/firmengine/firmengine/pull/61)**만 고침.
- 이번 역할 회전: 데이터담당자(기록·보존), 사용자/서류담당자(재생성/누락), IT담당자(R2/D1), AX담당자(idempotency), 계산사무장(재계산 결과 인계 **미실행**), 변호사(Word 최종 검수·승인 **미실행**). 선택 ID: `A4-DATA-014`, `A4-DOC-011`, `A4-IT-006`, `A4-AX-003`, `A4-CALC-014`, `A4-LAW-013`, `X-047`. 모두 `[ ]` 유지.

## 소스 재확인
- PR #61 head(작업 시작) `1ee097b6c1c86b31117aee0f61ee6a4c31908fe6` / 브랜치 `audit/a4-r14-export-atomic-integration-20261031`; 최신 main/최근 커밋·PR·중앙 보드·16차 영수증 읽음.
- 변경 전 실제 helper `lib/export-artifact-transaction.ts` blob `10dc79b9ec9dcf29ff74901af6a621a17d880573`; 변경 전 route blob `a9ebf663507c672dfee6bf9f179581e3cd2ea099`. 영속 receipt migration 0023 blob `d9808d92020d6fd2f3da796c54f57d7dca0d24d6`. 기존 `tests/export-artifact-transaction.test.ts`에는 사전 manifest 실패 시 삭제를 기대하는 테스트가 존재해 기본 동작 변경은 피함.
- **기존 코드 결함 후보:** `commitExportArtifactTransaction`은 R2 PUT 또는 artifact D1 batch 호출 실패가 manifest 전 단계에서 발생하면, ACK 불명확 여부와 무관하게 시도된 R2 objectKey와 SQL row의 `deleteObject/deleteRecords`를 호출한다. R2 PUT이 성공 후 timeout을 반환하거나 D1 batch가 저장 후 응답을 유실한 경우에도 동일 경로다. 기존 16차 수정은 `claimed→uncertain` 기록만 추가했으므로 증거 삭제 가능성은 남아 있었음. **실제 운영에서 데이터 삭제가 발생했다고 주장하지 않는다.**

## 입력·독립 기대·관찰 (실제 Node 격리 합성)
- 실행환경: 로컬 Node **22.16.0** `node --experimental-strip-types --test`; GitHub 실제 helper 원본을 바이트 단위로 복제하여 시작 blob SHA **10dc79b9... 일치 확인** 후 제안 수정. 합성 R2=`Map`, 합성 SQL=`Set`이며 실제 Cloudflare 없음.
- 입력 `case=synthetic-r17`, `artifact=a`, `objectKey=cases/synthetic-r17/artifacts/a`, bytes=`[1,2,3]`; 실고객/원문/OCR/키/비공개 정답 없음.
- 독립 기대: `upload` 성공 뒤 ACK 유실, `persistRecords` 행 적재 뒤 ACK 유실 시 **현재 확정 문서로 재사용/자동 삭제 금지**. 증빙 보존·별도 uncertain receipt·관리자 대조 필요. 정상 COMMIT은 보존, 기존 일반 호출은 기본 scoped cleanup 유지. 통지 callback 실패가 삭제 권한으로 승격되지 않음.
- 관찰: 수정 전/기본 정책에서는 동일한 `persist` 실패로 R2+SQL 행이 삭제됨(부정대조). opt-in 정책에서는 `upload` 실패(실제 bytes write 뒤 throw)와 `persist` 실패(실제 Set write 뒤 throw) 모두 **삭제 호출 0, 남은 R2 객체 1**, persist 실패에서 SQL 행 1. 응답유실 manifest 단계도 R2+SQL 보존. 정상 성공·callback 오류도 기대 일치.
- **6/6 Node 실제 함수 합성 테스트 PASS**, `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck lib/export-artifact-transaction.ts` 실행 오류 0건. 별도 이전 14차의 SQLite SQL 계약 스크립트 재실행 **10/10 PASS**(복제 SQL 계약; 실제 D1 아님). 원격 PR source와 route 연결의 정적 7/7 확인.
- 새 테스트 `tests/export-precommit-evidence-preservation-r17.test.ts` 로컬 Git blob `2c220ae2ce50095cf5ad02b9f6f092d0a0ef4fc0`, PR blob 동일. 수정된 helper blob `646c925c9a8ed7494203d384279e4c9e85e1b101`, PR blob 동일. route blob `4c19730a5db753661b0e2a72dfeb6dc5d6bb6dd7`.
- PR 수정 커밋: 신규 테스트 `5f54c0da486590a2976460946af28d290949e878`; helper `0c1b9f407da30320ab0163b747693f99829525e2`; route `988ff9cb4fa822981b8487a7939bf6116bd50d15`.
- **제안 로직:** helper에 opt-in `preservePreCommitFailureEvidence` 및 실패 보고 callback `onPreCommitUncertain` 추가. PR #61 실제 HTTP route가 opt-in 사용하고 기존 외부 catch의 `claimed-only markExportUncertain` 유지. 일반 호출은 예전 삭제 정책 유지해 다른 흐름 동작을 무조건 바꾸지 않음.

## 검증 및 실행 경계
- 6개 역할의 인수 체크는 **전부 부분 또는 미실행 `[ ]`**. `A4-CALC-014`: 실제 10분 quiet 계산·변제계획/청산가치 재산정 미실행. `A4-LAW-013`: 실제 Word byte 검수·직원/변호사 순차 승인·재생성 승인 무효화 미실행.
- 단계별 상담→서류→OCR→quiet 10분→95 법률→Word→직원/변호사 승인→실제 법원 보정 전 구간의 동일 sourceVersion/ref/revision/CAS 검증 **E2E 미실행**. `미관찰/null/0/비해당/상충/source-only/승인전`을 법적 확정으로 승격하지 않음.
- 신규 테스트는 로컬 Node 실행을 확인했지만 **최신 main 전체 Node/TS/Next CI, staging D1/R2/Cron, HTTP 두 워커, 실제 R2 timeout/429/503, n8n 운영 연결 및 법원 공식서식 비교는 미실행**. 단순 정적 연결/합성 PASS는 운영 인수·배포 성공이 아님. 운영 migration 0023, 배포, 실제 제출, 법원 인가 확정 및 고객 문서 변경은 실행하지 않음.
- opt-in은 현재 `uncertain` receipt에 생성물 ID를 영속 저장하지 않으므로, R2 후보 검색/SQL 증거 수집과 `attempted` 기록을 별도 안전 계약으로 설계해야 한다. 과거 A/현재 B, 타사건 키/보존기간/법원 승인과 무관하게 자동 삭제/재승격 허용 없음.

## 다음 A4 선택 체크
1. `A4-DATA-014`, `A4-IT-005`, `X-047`: `claimed/uncertain/committed` receipt별 D1 manifest+audit+artifact+R2 GET SHA 및 원본/reference/계산 판본의 **읽기 전용** 증거표 작성. incomplete/null/0 구분. 사용자 승인 없이는 재발행/삭제 금지.
2. `A4-IT-003`, `X-046`: 서로 다른 UUID의 합성 worker 2개를 **실제 Export HTTP**로 경쟁시키고 winner 1명, loser 보존, 두 사건 격리 검증 (staging 자원 없으면 미실행).
3. `A4-DOC-012`, `A4-CALC-014`, `A4-LAW-013`: 원본/갈음/관할 기준변경 후 재계산→95 법률→Word 재생성→검수/승인 무효화; 법원 기한 null은 허위 날짜 금지.

**이번 회차 제품 최종 인수 PASS=0.** Draft PR #61 미병합 유지; main에는 문서 영수증/보드 기록만 추가.
