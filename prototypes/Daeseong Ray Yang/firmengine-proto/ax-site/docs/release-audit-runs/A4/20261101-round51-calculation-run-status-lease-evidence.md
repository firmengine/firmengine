# FirmEngine A4 51차 — 계산 Poll 복구진단의 저장 Run 상태·lease 소유권 증빙

- 날짜: **2026-11-01 KST**. 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 시작 main: `b913e70639d17f5e1a0dbf2f07615bb08c68964b`; 이 감사 영수증 생성 직전 확인 main: `b913e70639d17f5e1a0dbf2f07615bb08c68964b`. GitHub는 병렬 작업이므로 이는 시간별 스냅샷이며 최종 운영 배포 SHA가 아니다.
- 단일 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`; 이전 50차 `docs/release-audit-runs/A4/20261101-round50-1445KST-calculation-head-run-input-sha-reconciliation.md`에서 이어서 수행.
- 6역할 순환: **서류 → 계산사무장 → 변호사 → 데이터 → AX → IT** (50차 IT 시작 순서와 교체). 직접 체크 4개: **A4-IT-005, A4-CALC-004, A4-DATA-023, X-046**. 간접 인계만 살핀 **A4-DOC-013, A4-LAW-006, A4-AX-001**은 직접 검증/완료로 표시하지 않는다. 전부 `[ ]` 유지.

## 1. 원본 코드·DB 계약 및 기존 영수증

- GitHub `main`: `lib/case-data-recompute.ts` (blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`), `lib/case-calculation-feature-store.ts` (blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`), `drizzle/0011_case_calculation_features.sql` (blob `0caa359d250dce45765d269d271ad63170ec3efa`), `db/schema.ts` (blob `933f8686845ac14669312dd21bf85e02c62ed5e6`). Run `status`의 저장 선언은 `computed/provisional/missing`로 산출될 수 있고, Poll `lease_token`은 nullable이다.
- 이전 PR #126의 `lib/case-calculation-poll-reconciliation.ts` (구 blob `2ffd97ce32f2974836da3cdf211744311c6cc5ba`) 및 `tests/case-calculation-poll-reconciliation-r49.test.mjs` (구 blob `20d4187d3c4e474d7238983e2b56b646945e787a`)를 읽었다. `main`에는 PR #126의 read-only helper가 **없으며**, 실제 API/Cron에도 연결되지 않았다.
- 관련 최근 Draft PR #120(계산 head ACK), #123(Poll 정리 ACK), #126(읽기전용 진단), 별도 PR #16(구판본 lease CAS)은 **미병합**. `docs/ax-n8n-refactor-blueprint-20261030.md`는 설계 문서이지 운영 n8n 실행 영수증이 아니다.

## 2. 실제 합성 반례와 독립 기대값

**합성 입력**: `caseId=synthetic`, 사건 revision=4, source dataVersion=7, run=`run-7`, reference SHA=`a×64`, head/run input SHA=`a×64`, Poll `running`, `lease_until=2026-11-01T04:00:00Z`, 관측 시각 `2026-11-01T04:45:00Z`. 실제 의뢰인·OCR 원문은 사용하지 않았다.

| 주입 | 독립 기대 | 변경 전 PR #126 실제 V8 | 변경 후 PR #126 실제 V8 |
|---|---|---|---|
| Run `computed` | 저장 Run 상태만 computed; 사람 승인 아님 | `storedRunStatus` 부재 | `computed` |
| Run `provisional` | 저장 Run 불완결 상태 별도 표기 | `storedRunStatus` 부재, headCurrent=true | `provisional`, headCurrent=true 유지 |
| Run `missing` | 누락을 계산 완료/0으로 승격 금지 | `storedRunStatus` 부재, headCurrent=true | `missing`, headCurrent=true 유지 |
| Run 상태 null/알 수 없는 값 | null=미관찰, 미지원 문자열=상충 | 상태 증빙 자체 미노출 | `unobserved` / `conflict` |
| Poll `running`, `lease_token=NULL` 또는 `''` | 소유권 미관찰, 단순 만료로 오인 금지 | `lease=expired` | `lease=unobserved` |
| 정상 token+만료/미만료 | 만료/유효 별도 표시 | `expired/live` | `expired/live` 유지 |
| Head/Run SHA 불일치, ref 변경, source v8 | current 확정 금지 | 기존 반례 가드 존재 | 해당 가드 보존 |

**중요한 의미 한계:** `headCurrent=true`는 동일 source/reference의 current head 식별 결과이지 계산 피처 전체 완결·법률 95개 통과·직원/변호사 승인·법원 인가가 아니다. 새 `storedRunStatus` 역시 DB에 저장된 선언 상태이며, 원본·산식·법적 인정의 독립 검증이 아니다. DB NOT NULL인 Run `status`의 null은 운영 발생 사실이 아니라 가상 응답결손에 대한 부정대조이다.

## 3. 실제 실행/코드 반영과 확인된 경계

- **기존 GitHub PR 함수 본문 V8 부정대조**: `missing/provisional`과 `running+NULL/'' token`이 복구 판단에서 구분되지 않음을 실제 실행해 확인.
- **GitHub PR #126 최신 함수 본문 재조회 후 V8**: **13/13 독립 기대 관찰 일치**. `approved=false`, `writePerformed=false`, SQL read 호출 1회, write 호출 0회를 매 사례 확인했다. 이는 GitHub 원문에서 TypeScript 구문만 제거한 격리 함수 시험이다.
- **독립 Node v22.16 SQLite WAL 두 연결 합성**: **10/10 PASS**, SELECT의 `r.status AS runStatus`·누락/임시계산/invalid/lease token null·빈값·기존 source v8/입력 SHA 불일치를 실 SQLite에서 재조회. 독립 파일 `round51_poll_status_lease_sqlite.test.mjs` (SHA256 `c94e335db6f18f175a3371f73e28cc3a3f52c4879882d8601b7425907549b088`). 이는 PR 전체 런타임/실제 D1 실행이 아니다.
- **Draft PR #126 코드 수정**: `lib/case-calculation-poll-reconciliation.ts`에 `runStatus` SELECT, `storedRunStatus`(computed/provisional/missing/unobserved/conflict) 반환, `running` 소유권 token 누락 시 `lease=unobserved` 유지. source commit `f63b9625fd6256d38e0963ec442bcc833d72c7f3`, blob `3f3f6ac62552ed97c8c31784c8e623c748f9888e`.
- **Draft PR #126 저장소 테스트 추가**: 기존 18개 선언 + 신규 6개 = **24개 선언**. test commit `34e1b9be3fd4fc9044cff6df66733a768f894f6b`, blob `8409f704677f1938c775d604a029f42e614bc251`. **저장소 Node-native 24개는 실행하지 않았으므로 24/24 PASS가 아니다.**
- **수정 범위**는 Draft PR #126에 국한, 코드·테스트 2개 모두 허용 `ax-site/` 내. `main`에는 이번 실행 코드 수정 없음. 기능 의미/법률 기준/계산 산식/DB migration/실제 데이터 변경 없음.

## 4. 미실행·복구 경계

- **전체 Node-native, TypeScript/Next build/CI, 실제 두 HTTP 워커, Cloudflare staging D1/R2/Cron, 운영 n8n, 실제 Word·95 법률 체크·직원/변호사 승인: 미실행.**
- 상담→서류→OCR→10분 quiet 계산→법률 95→Word 초안→독립 직원·변호사 검수→실제 보정명령 event의 승인 인계는 **종단 미실행**. 동일 사건 새 증빙, 갈음 철회, 관할/법령판본 변경, 실제 보정기한 미확정, 재생성 승인 무효화도 **미실행**.
- R2 성공 후 D1 실패·ACK 유실, 실제 중복 webhook, timeout/429/503, 실제 두 D1 HTTP 워커 경쟁은 **재현하지 않았다**. 이 회차는 특정 읽기전용 SQL 계약과 SQLite 두 연결 관찰만 검증했다.
- 처리 상태는 미관찰/null/0/비해당/상충/source-only/승인전 분리. 관찰이 없는 lease를 자동 정리하거나 이전 완료·승인으로 승격하지 않는다. 운영 배포·운영 D1 migration·법원 실제 제출·인가 확정 없음.

## 5. 다음 체크·병합 차단

1. **A4-IT-005 / A4-DATA-023:** PR #126 조회기와 실제 직원 UI/Health API 상태의 같은 caseId/runId/source SHA/lease 소유권 대조. 상태 0/NULL/미관찰/상충을 화면에서 독립 표시하고 staging 읽기전용 재조회 증빙 확보.
2. **A4-CALC-004 / X-046:** PR #16/#120/#123/#126 결합 후 계산 head COMMIT 성공→lease DELETE 0/503/ACK 유실→다음 Cron 후보 0→영속 조회→안전한 CAS 복구. 실제 HTTP 두 워커/Cloudflare staging 후 IT·계산사무장·데이터 담당자 승인.
3. **A4-DOC-013 / A4-LAW-006 / A4-AX-001:** 새 증빙·규칙판본 뒤 계산→법률→Word 재생성→기존 검수 무효화→실제 보정 event까지 종단 별도 확인. 운영 n8n은 설계문서와 구별.

**이번 A4 직접 체크 최종 완료 0/4. 제품 전체 인수 완료 0건(기존 보드 판정 유지).**
