# FirmEngine A4 61차 — 법률 scheduler·lease의 타 사건 계산 Run 소유권 누락 (2026-11-02 KST)

## 범위와 확인 기준
- GitHub 저장소 `firmengine/firmengine`, 정확한 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만 수정. 중앙 인수 원장 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 ID를 기준으로 함.
- 최초 확인 main `c05d45b9a09f2ee3cb7458def3730541c08fc0c3`; PR 신규 브랜치 기준/main 재확인 `26d668d2d61b04bcc4024aabe51497e745645462`. GitHub PR #150: branch `audit/a4-r61-legal-scheduler-run-owner-20261102`, HEAD `744a5f17e4189517e049419a871c9039597bc0ff`, **Open/Draft/미병합**. 본 영수증의 코드 변경은 main 미반영.
- 확인한 실제 main 코드 blob: `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`, `lib/case-legal-source-preflight.ts` `0a4bf038a97de015652d4957a56ecddd5c049bd8`, `lib/case-legal-calculation-preflight.ts` `c17892e63bf00d2981f292b0ef28e032d66a8dc7`, `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `tests/case-legal-automation-flow.test.ts` `f44fbbaf233ed64355e5c49a04c7722559399c27`, 60차 A4 영수증 `478da578c768d79960af113616f5d5b18994f31a`.
- 선행 Draft #110(동일 실행 파일 변경), #142(계산 preflight), #146(원본 preflight) 및 #120/#123/#126/#139 확인. 최신 PR 목록 #147/#148/#149도 확인. 위 PR들을 main에 병합됐다고 가정하지 않음.
- 이번 5개 체크 ID: **`A4-IT-012` / `A4-CALC-004` / `A4-LAW-006` / `A4-DATA-004` / `X-046`**. 모두 **[ ] 미완료**, 본문은 부분 검증. 서류 `A4-DOC-013`과 AX `A4-AX-016`은 간접 교차검토만, 인수 표시 없음.
- 역할 순환: **AX → IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터**. 실제 실무자 검수·승인 없음.

## 확인한 결함 후보 (P1, 운영 재현 아님)
- main의 `case-legal-automation.ts`는 `latest()`와 legal due 후보 SQL에서 `case_calculation_heads.run_id`로 Run을 조인할 때 `case_calculation_runs.case_id = cases.id`를 강제하지 않는다. 후보 SQL은 Run의 sourceDataVersion/caseRevision/input SHA 동일성도 체크하지 않음. 최종 lease claim EXISTS에는 Head의 run_id/input SHA만 있고 Run 소유권 검증은 없다. `case_calculation_heads.run_id` FK는 동일 사건 소유권의 복합 검증을 제공하지 않는다.
- 정상 운영에서 타 사건 Head→Run 참조가 발생했다는 증거는 없음. 그러나 비정상 참조가 있을 때 legal scheduler가 다른 사건 계산 Run으로 job을 만들고 lease를 받을 수 있는 **별도 진입 경로**가 된다. 앞서 #142/#146에서 발견한 독립 preflight 결함과 관련되지만, scheduler 진입·claim의 원자적 가드가 별개로 누락된 것이다.
- `processJob()`의 실제 95 법률 AI 모델 호출, Word 초안, 법률 결론·승인 우회는 **실행/재현하지 않음**. 기존 preflight 보호와 미병합 Draft 보호를 구분함.

## 실제 실행 — Node 22.16.0, 파일형 SQLite WAL 두 연결
- 독립 합성 스크립트: `/mnt/data/firmengine-a4/round61_legal_scheduler_foreign_run_claim_sqlite.test.mjs`. `node --test /mnt/data/firmengine-a4/round61_legal_scheduler_foreign_run_claim_sqlite.test.mjs` **8/8 기대 관찰 일치**. 기존 SQL은 main 위 blob의 `latest`, `candidate`, `claim`을 글자 그대로 전사한 격리 시험; 프로젝트 실제 모듈 실행/Cloudflare D1이 아님.
- 합성 입력: case-A/case-B 각각 sourceDataVersion 7, revision 3, 같은 `input-1`·`ref-A`. case-A Head가 case-B 소유 `run-B`를 가리키며, 해당 job은 `pending`. SQLite `PRAGMA foreign_keys=ON`, 두 연결/WAL.

| 입력/순서 | 독립 기대값 | 실제 main SQL 관찰 | 제한적 후보 SQL 대조 |
|---|---|---|---|
| case-A Head→case-B `run-B`, reference/input SHA 동일 | 타 사건 Run 후보 0 | **후보 1** (결함 부정대조) | 후보 **0** |
| 동일 사건 `latest(case-A)` | 타 사건 Run 현재판본으로 인정 불가 | **run-B 반환** | **null/미조회** |
| 타 사건 Run에 대한 lease claim | 변경 0 | **UPDATE 1·lease 지급** (결함 부정대조) | **UPDATE 0** |
| 정당한 case-A `run-A`로 교체 | 후보 존재 | 해당 경로 기회 보존 | **후보 1**, latest run-A |
| 정상 case-A 동일 job 두 워커 순차 CAS | 승자 1 / 패자 0 | 비교 대조 | **1 / 0**, 신규 lease 보존 |

- Node 로컬 추가 회귀 재실행: 58·59·60·61차 독립 합성 `node --test` **25/25 기대 관찰 일치**(그중 기존 결함 재현 부정대조 포함). 시험 하네스의 일부 모형 스키마는 실제 D1 전체 마이그레이션과 다름. 제품 기능 25건 합격/독립 법률 검증 아님.
- 후보 GitHub 새 코드 blob: `lib/case-legal-automation.ts` `6d50a98420cc48012c478734225f1ce914e8d298`. `latest()`에는 동일 사건 Run만 허용, 후보 SELECT에는 Run 사건·버전·revision·input SHA 검사, Claim 내부 EXISTS에 같은 검사를 넣어 검사/획득 간 경합을 줄이는 작은 수정.
- GitHub 회귀 테스트 변경 blob: `tests/case-legal-automation-flow.test.ts` `1f0276d71c846e1e55645ba520d072a2b180e37d`. 타 사건 Head→Run 참조가 모델과 작업권으로 전파되지 않는 것과 복구된 같은 사건 Run은 여전히 후보가 되는 것을 검사하는 **테스트 작성/커밋 완료, 저장소 Node-native 실제 실행 미실행**.
- PR #150의 수정 파일은 위 2개, 모두 ax-site 하위. GitHub combined commit status 결과 **보고된 status 0건**; 이를 전체 CI 통과로 해석 금지.

## 단계·실행 수준
- 검사 순서/판본: 상담→서류→OCR→10분 quiet 계산→법률 95→Word→직원/변호사 검수→실제 보정 이벤트의 통합 stage/CAS 시험 **미실행**.
- 이번에 실행한 것은 법률 scheduler 후보·Run 소유권·lease SQL의 **독립 합성 계약**뿐. 실제 프로젝트 테스트/TypeScript/Next 전체 CI, Cloudflare **staging D1/R2/Cron**, 실제 HTTP 두 워커, n8n 운영 워크플로는 **미실행**. n8n 설계는 운영 실행의 증빙이 아님.
- R2 저장 후 D1 오류/ACK 유실·중복웹훅·부분성공·timeout/429/503·원본 변경·갈음 철회·관할판본 변경·보정기한 미확정·Word 재생성과 직원/변호사 재승인은 이번 회차 **미실행**.
- 미관찰/null/0/비해당/상충/source-only/승인전은 독립 상태로 유지, 법원 인정·법률상 확정으로 승격 금지. 실제 개인 문서·원본 OCR·키·.env/비공개 정답 공개 Git 적재 없음.

## 복구 및 다음 체크
1. **#150를 Draft/미병합으로 유지.** PR #110과 동일 파일 충돌 검토, #142/#146 두 preflight 및 #120/#123/#126의 ACK·CAS 교차 검토. 가능하면 실제 프로젝트 `tests/case-legal-automation-flow.test.ts`와 전체 CI 및 staging 두 HTTP 워커/DB Claim을 수행하고 수정본 vs 운영 코드를 구별.
2. `A4-IT-012`, `A4-CALC-004`, `A4-DATA-004`, `X-046`: 기준 승인세대 A→B→A와 원본 버전 변경, Head 저장·legal lease·유료모델 직전 TOCTOU를 DB 원자 CAS로 통합 검증. 단순 선행 SELECT 보호만으로 모든 레이스 해결되지 않음.
3. `A4-LAW-006`, `A4-DOC-013`, `A4-AX-016`: 새 증빙/갈음 철회/관할 개정 후 95 법률 재검토, Word 최종 바이트·서식 판본, 기존 직원/변호사 승인 무효화, 실제 보정명령 이벤트의 독립 검수/마감기한 불확정 처리를 합성부터 단계별로 연결. 실무자 승인 필요.
4. 운영 배포/운영 D1 migration/실제 전자제출/법원 인가 확정 **수행하지 않음**.

**61차 선정 ID 최종 통과 0/5, 제품 전체 최종 인수 완료 0건.**
