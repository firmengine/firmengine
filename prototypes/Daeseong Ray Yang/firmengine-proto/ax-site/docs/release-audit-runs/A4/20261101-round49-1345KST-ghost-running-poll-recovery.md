# FirmEngine A4 제49차 — 계산 head COMMIT 뒤 poll 유령 running·복구 읽기전용 판정

- 시간: 2026-11-01 13:45 KST 전후. **허용 경로:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 실제 고객자료, 원문 OCR 사실값, 비공개 정답, 키 사용 없음.
- 시작 `main` SHA: `e91e5288174392e5b3a7e0af4fc9759f3a595197` (2026-11-01 04:32Z A3 문서 갱신); 48차 직후 `0decfe07c5c004b0d1d0131689fe0075fbf56300`에서 다른 병렬 감사가 진행됨을 확인.
- 단일 보드 시작 blob: `344f1db9d7314117f6f136848522cffeaf8a7108`. 48차 영수증 blob: `d03a01617cea212b3e3fbd152e53b83851c1bea0`.
- main 읽은 핵심 blob: `lib/case-data-recompute.ts` `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`; `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `tests/case-calculation-poll-fairness.test.ts` `105e769cb6dd82bd38f4222ef427c67e76077a37`. 관련 GET API `app/api/cases/[id]/calculation-poll/retry/route.ts`에서 health 반환 경로 소스 확인.
- 검토 PR: #16 계산 poll source CAS (Open), #110 법률 retry/transition (Draft), #114 법률 failure (Draft), #120 calc-head ACK (Draft), #123 계산 poll cleanup (Draft). 모두 운영 인수 미증명.
- 역할 순환: **AX → IT → 서류 → 계산사무장 → 변호사 → 데이터** (48차 시작 데이터와 다른 역할부터; 6역할 순회). 직접 체크 **A4-IT-005, A4-CALC-004, A4-DATA-023, X-046** (4건 모두 `[ ]` 유지). 인계 정적·미검증: `A4-AX-001`, `A4-DOC-013`, `A4-LAW-006` 모두 `[ ]`.

## 1. 새 반례 — 결과 head는 최신이나 cleanup 실패로 poll이 영구 running처럼 보임

실제 main 소스의 `drainCaseDataUpdates`는 계산 완료 후 poll 삭제를 시도하고(48차 확인한 ACK 오판), 후보 SELECT는 **계산 head가 최신이면** 그 사건을 후보에서 제외한다. 별도의 `caseCalculationPollHealth()`는 원본/기준 판본만 비교하고 `p.status=running`을 그대로 반환하며 head/run 저장과 교차 대조하지 않는다. 즉 삭제가 미적용되거나 응답이 불확실한 경우 **계산 head가 최신인 동시에 만료된 poll running 행이 남아도 다음 계산 Cron에서 자동 회수되지 않는 흐름**이 가능하다.

**완전 합성 입력:** 사건 revision=4/sourceDataVersion=7; active reference SHA `aaaa...64`; 계산 `run-7` 및 head(v7/rev4/ref-A)는 영속 저장됨; poll `status=running`, `lease_token=worker-A`, `lease_until=04:05Z`, 검사시각 04:45Z; DELETE가 503으로 실패/COMMIT ACK 유실 또는 실행 전 실패한 상태. 독립 기대: 만료된 poll 기록을 계산 실행 중 또는 사람 검수 완료로 단정하지 말고, 영속 증거를 비교해 **cleanup 미확정**으로 보류·진단.

**실제로 로컬 SQLite 두 WAL 연결에서 관찰:** main의 후보 SELECT와 동등한 조건으로 query=**0건**, 원본 head가 최신이고 poll에는 **running/expired lease가 그대로 존재**. 제안한 순수 read-only SQL classifier가 `poll_running_with_current_head`를 반환하되 `approved=false`, `writePerformed=false`를 유지. 이 시험에서 실제 `caseCalculationPollHealth()` 본문이나 HTTP/Cron을 구동한 것은 아님. 해당 함수의 `running` 반환 가능성은 소스 정적판독이다. 따라서 실제 운영에 동일 상태가 발생했다고 주장하지 않는다.

## 2. 입력·독립 기대값·관찰 결과

| 합성 입력 | 독립 기대 | 실제 로컬 관찰 |
|---|---|---|
| current head v7 + running poll lease expired | 후보 0, poll 삭제 성공·완료 여부는 **미확정** | 후보 0, read-only `poll_running_with_current_head` |
| 별도 WAL B에서 같은 영속 상태 조회 | 두 연결에서 진단 동일, lease 보존 | 일치 |
| source v7→v8·head v7 | 구 head current 승격 금지, 새 후보 | 후보 1, `head_not_current` |
| reference ref-A→ref-B·head ref-A | 구 head current 승격 금지 | 후보 1, `head_not_current` |
| poll DELETE 성공·응답 유실 가정 | poll 부재는 ACK 확인과 다름 | `poll_absent_head_current`, approved=false |
| head 부재 / run 참조 행 부재 | 증거 부족 | `head_unobserved`, head-null 명시 |
| poll.ref 변경 / poll failed + head current | 증거 상충·상태 혼합 | `poll_source_conflict`, `poll_failed_with_current_head` |
| source dataVersion=0 / active SHA null | 미관찰·비정상, 0을 current로 단정 금지 | `source_unobserved` / `active_reference_unobserved` |
| lease timestamp 오류 | 만료 추정 금지 | `lease=unobserved` |
| 다른 caseId / SELECT 503 | 사건 격리 / 오류를 성공·부재로 승격 금지 | 타 사건 증빙 미노출 / 503 예외 전파 |

- **실행**: Node **v22.16.0**, `node --experimental-strip-types --test`; 파일 SQLite WAL **두 연결**; 신규 독립 14/14 기대 관찰 일치. 기존 r41(9), r42(10), r43(12), r44(9), r46(8), r48(10)과 새 r49(14)를 한 번에 로컬 재실행한 결과 **72/72**, 실패 0. **구 결함을 확인하는 부정대조가 포함되어 제품 안전 72건 합격이 아니다.**
- GitHub Draft PR **#126**: `lib/case-calculation-poll-reconciliation.ts` 및 `tests/case-calculation-poll-reconciliation-r49.test.mjs` **2개 신규 파일만**. 브랜치 `audit/a4-r49-ghost-poll-recovery-inspector-20261101`, HEAD `02d93cf5778064ef7e9404f55d8b0c94cdeabe87`, Open/Draft/미병합. GitHub helper blob `730305e4bfb20c51ac58e11c1d4a534f1c8b5f88`. 저장소 테스트와 로컬 실행본은 주석만 다르고 코드 본문 동일(FNV-1a after comment stripping `31700ed5`). 로컬 test 실행으로 GitHub Actions CI나 staging을 인증하지 않음.
- Draft helper는 DB **SELECT만 수행**하고 `evidence=read_only_point_in_time`, `approved=false`, `writePerformed=false`를 기록한다. 현재 main API/Cron에 연결되지 않았으므로 **운영 복구 구현/완료 아님**. 인수·승인·사건 사실 확정을 수행하지 않는다.

## 3. 인계 및 별도 단계

- `A4-IT-005`: 계산 저장 후 DELETE ACK 불확정의 *read-only* 영속 재조회 계약 합성만 검증. 실제 COMMIT 응답유실·D1 staging 재조회는 미실행.
- `A4-CALC-004`: 구 source/ref의 계산 head를 현재 계산으로 승격하지 않는 synthetic 진단 구분. 실제 계산 엔진 재실행/산식 비교는 미실행.
- `A4-DATA-023`: poll `running`과 계산 head `current`의 상태 불일치를 합성 SQL로 관찰. 실제 직원 UI/DB 동등성 E2E는 미실행.
- `X-046`: 두 WAL 연결과 source/ref 변경 경쟁만 합성 실행. D1 두 HTTP 워커 및 실제 DB concurrency는 미실행.
- `A4-AX-001`: `docs/ax-n8n-refactor-blueprint-20261030.md`에서 ax-site 95법률의 직접 호출과 n8n 참고안의 차이를 확인. **운영 n8n workflow 조회/동등성 미실행**. `A4-DOC-013` 새 문서 후 승인 무효화 및 `A4-LAW-006` 변호사 재승인 인계는 소스 수준 미검증.
- 상담→서류→OCR→10분 quiet calculation→95 법률→Word 초안→직원·변호사 검수→실제 보정 이벤트의 **전 구간 종단 미실행**. staging D1/R2/Cron, R2 PUT 뒤 D1 503/ACK 유실, 실제 webhook 중복, timeout/429, 원문 변경·갈음 철회·관할판본 변경·보정기한 null·Word 재생성 전부 **미실행**. 운영 배포/운영 마이그레이션/전자제출/법원 인가는 실행하지 않음.

## 4. 다음 체크와 복구 원칙

1. **A4-IT-005 / A4-DATA-023**: GET health의 DB point-in-time 상태와 current head/run/reference의 증빙 정합성을 staging에서 읽기전용 확인; malformed/null/0/응답유실을 분리하고 실제 직원 표시 검수. PR #126의 helper는 아직 연결 안 됨.
2. **A4-CALC-004 / X-046**: Draft PR #16/#120/#123과 조합하여 동일 version/ref의 두 워커, head COMMIT 뒤 lease cleanup=0/503/ACK 유실, 다음 Cron의 후보선택/재선점, 사고 복구 원장을 검증; 자동 재계산 및 원장 삭제 금지.
3. **A4-DOC-013 / A4-LAW-006 / A4-AX-001**: source/ref 변경 시 법률 95→Word 재생성→기존 직원·변호사 승인 무효화와 새 검수 분리; n8n 설계와 운영 배포를 동일시하지 않음.

**제49차 신규 최종 인수 0건 / 전체 인수 0건.** 모든 직접 체크 `[ ]`, Draft PR 미병합. 어떠한 고객 데이터·승인·실제 법원 처리·운영 D1/R2/Cron 변경도 하지 않음.
