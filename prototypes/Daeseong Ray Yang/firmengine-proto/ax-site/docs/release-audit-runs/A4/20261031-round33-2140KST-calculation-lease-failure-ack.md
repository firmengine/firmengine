# FirmEngine A4 33차 — 계산 poll lease 소유권 상실 후 거짓 실패·재시도 영수증
2026-10-31 21:40 KST | GitHub main 기준 시작 SHA `6452aea97f7019fe0ecb14b162757d28cc39ea4f` | 허용 경로 ax-site 내부만 | 공개 합성 데이터만 사용 | 제품 최종 인수 0건

## 읽은 기준·역할·체크 ID
- 단일 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `27118cb7dbab96d43048add3332e786c6b31b2dd`. 실제 소스 `lib/case-data-recompute.ts` blob `cd967ced1c8262b1e8c67d62c2a373e4d2e2be94`, `lib/case-data-watch.ts`, `lib/case-calculation-feature-store.ts`, `lib/case-agent-scheduler.ts`, `db/schema.ts`, 기존 `tests/case-calculation-poll-fairness.test.ts`, 이전 A4 32차 영수증 및 PR #16/#61 상태 확인. main 최신 커밋·해시 별도 재조회 후 CAS 커밋한다.
- 역할 순환: **IT → 서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자**. 직접 검증: `A4-IT-003`, `A4-IT-007`, `A4-CALC-004`, `A4-DATA-004`, `X-046` (5개). 연관 인계 `A4-DOC-013`, `A4-LAW-006`, `A4-AX-006`은 코드·판본 경계만 검토, 통합 실행 없음. 전부 **[ ] 유지**.
- `PR #16`은 **Open·미병합**: 후보의 구 source poll lease 탈취 차단은 이번 main 보완과 분리한다. `PR #61`도 **Open·Draft·미병합**: Export 원장/CAS·staging은 현재 main 운영 기능이 아니다.

## 실제 독립 입력·기대·관찰
- 독립 SQLite **두 연결**로 `case-synthetic`, version=7/8, revision=3, 동일 reference SHA, 워커 A/B 별도 lease token을 구성. 메인 파일에서 추출한 claim UPSERT SQL을 그대로 사용한 로컬 재현 스크립트 `round33_calc_lease_sqlite.py`를 실행. 관찰 단언 **10/10 일치**, 단 이는 적합성 PASS 10건이 아니라 **결함을 포함한 실제 관찰의 재현**이다.
- 같은 버전·유효 lease: A claim=1, B claim=0. **정상**. lease 만료 후 B claim=1, 과거 A의 오류 상태 UPDATE는 SQL `changes=0`이므로 DB에는 A의 `retry_wait`가 기록되지 않는다. 그러나 기존 main `catch`는 갱신행수를 보지 않고 `status=retry_wait`를 반환. **독립 기대=소유권 상실/확정적 재시도 아님, 관찰=retry_wait(불일치)**.
- 심화 반례: 새 version=8을 B가 선점한 뒤, 과거 version=7을 선택하고 지연된 A가 기존 UPSERT를 제출하면 B의 유효 lease를 덮고 poll job version=7로 회귀. **독립 기대=stale claim 0·v8 보존, 관찰=stale claim 1·v7 회귀(2건 불일치)**. 기존 `PR #16`의 source CAS 위험과 동일 계열로 중복 PR 작성/임의 합병을 하지 않는다. 실제 Cloudflare 2 HTTP worker에서 노출되었다는 증거는 없다.
- **현재 GitHub 함수 본문을 추출해 V8 격리 실행**: DB UPDATE changes={0,1} × attempts={미관찰,1,5} 총 6조건. 수정 전 zero-change에서 `retry_wait/failed` 거짓 반환 3조건, 수정 후보는 `superseded`, 소유 lease가 살아 있는 3조건은 기존 `retry_wait/failed` 유지. **6/6 독립 기대 일치**.
- 같은 소스의 `caseDataQuietWindow` 실제 함수 본문 격리 평가: 마감 정확히 600000 ms, -1ms, +1ms, null, 잘못된 날짜 **5/5 기대 일치**. 원문 변경 후 타이머 전체 DB/Cron 검증은 아님.
- 보수적 수정: 오류를 저장하는 D1 UPDATE의 `meta.changes=0`이면 `superseded`를 보고하며, 다른 소유 워커의 retry/failed 상태를 허위로 보고하지 않는다. 기존 SQL·계산 산식·조용한 시간·승인/법률 결과는 변경하지 않는다. 회귀 테스트 3개를 추가했으며 **Node-native는 실행하지 못했다**. 실제 서식·법적 인정 변경 없음.

## 검증 수준·장애복구·후속
- **실행됨:** GitHub 본문 V8 격리 11/11, 독립 두 SQLite 연결 관찰 10/10(그중 규범상 결함 3조건). 이번 코드 수정은 poll 상태 응답에 한정, 제품 인수 체크는 모두 미완료.
- **미실행:** 신규 Node-native 3건, 최신 전체 CI/TypeScript/Next 빌드, staging D1/R2/Cron, HTTP 2워커 실제 오류 주입, n8n 운영 워크플로, 실제 상담→서류→OCR→10분 계산→95법률→Word→직원/변호사 승인→법원 보정 이벤트, 법원 서식/변호사 확인, 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가.
- 복구 경계: lease 소유를 잃은 워커는 결과를 `superseded`로 보고하고 기존 owner job을 보존한다. version 역전 claim은 여전히 **P1 미해결 / PR #16 검토 필요**이며 본 회차가 해결하지 않았다.
- 다음 직접 체크: `A4-IT-003` + `A4-DATA-004` + `X-046`의 현 SQL source version CAS 결합 및 실제 staging worker 경쟁, `A4-CALC-004`의 run head source/reference/current 보증, `A4-DOC-013` + `A4-LAW-006` 새 증빙·서식 승인 무효화 E2E.
