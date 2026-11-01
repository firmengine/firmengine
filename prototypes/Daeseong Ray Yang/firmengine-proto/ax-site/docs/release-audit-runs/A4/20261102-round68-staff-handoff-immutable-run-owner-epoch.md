# FirmEngine A4 — 68차: 직원 Word 초안 인계 immutable Run 사건·판본 검증

대상: `firmengine/firmengine` / `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 2026-11-02 KST. **실고객 자료·OCR 원문·키·env·승인정보 미사용**.

## 판본 확인 및 이어받은 사항
- 회차 시작 GitHub main SHA: `7a2fea277221e3ded9540e2237c97736aff0bbc7`; 감사기록 작성 직전 확인 SHA: `7a2fea277221e3ded9540e2237c97736aff0bbc7`. 최신 커밋/열린 PR 조회; 주요 관련 Draft PR #17 (manifest CAS), #24 (R2 불확정 보존), #161 (자동생성 조회판본), 미병합.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (시작 blob `6772e097386c478e9e4b7ea82f7fae6bdff27ac6`) 및 67차 영수증 `20261102-round67-0745KST-auto-draft-current-head-version-binding.md` 확인. 67차: 생성기 assertCurrent의 구 Head 위험; 이번 68차는 **별도 직원 인계** 경로.
- main 실제 원문: `lib/automatic-draft-handoff.ts` blob `a525e3c12672966c993f83021d5f169b170bebe9`, `lib/automatic-draft-handoff-contract.ts` `43cd0e0245bb74d396879880161654cf80a2978e`, `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`, `drizzle/0012_case_lawgraph_reviews.sql` `313375977527c76be5c87668b91bbbb24a0fef8a`, `drizzle/0017_legal_reanalysis_orchestration.sql` `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`, `tests/automatic-draft-handoff-contract.test.ts` `01724a1f0e214701fdc89458ef776c2606c0f1ee`.
- `docs/ax-n8n-e2e-scenario-matrix-20261030.md` blob `3eb51044ee906704fb1deaa9e9760f05e1b9fbe2`는 **향후 n8n 설계/시험 정의**로 확인; 운영 n8n workflow로 간주하지 않음.

## 결함 후보 (재현 범위 명확화)
`adoptAutomaticDraftForReview()`의 `head()` 조회는 `case_calculation_runs`를 `r.id=c.run_id`만으로 연결하고, immutable 법률 Run 자체는 JOIN하지 않음. 기존 DB FK는 **Run이 같은 사건·현재 버전·입력 SHA인지** 보증하지 않음. 잘못 연결된 사건 A의 Head가 사건 B Run을 참조하거나, 법률 Run/Head 판본·입력 SHA가 달라도 해당 **head() SELECT 한 단계가 유효 행을 반환**하는 P1 후보이다. `automaticDraftHandoffDecision`은 전달된 Head/문서 run 등 좁은 동일성만 판단. 이 결과가 곧 전체 `adoptAutomaticDraftForReview` 완료, 고객 문서 오링크, 승인 우회가 재현되었다는 의미는 아니다.

### 실제 독립 실행
- Node **v22.16.0** / `node --experimental-strip-types --test` / `node:sqlite` WAL **두 DB 연결**, FK ON. fixture: **합성** case-A/B, sourceVersion=7, revision=3, calc-A/B, legal-A/B, 입력·기준 identity. 실제 0011/0012의 관련 열을 최소형으로 구성, 운영 D1 스키마 전체 마이그레이션 아님.
- 15개 검증: 정상 동일성 **guard 반환**(1); foreign calc Run 소유권 / foreign calc Head / calc Run sourceVersion·revision / input SHA / foreign legal Run owner·ID / legal Run version·revision / legal Run→calc linkage / legal input SHA / 법률 Head revision 총 **12개 기존 SQL이 비정상 행을 반환**, guard는 반환 0행; 원본 sourceVersion 7→8은 기존/수정 모두 0행(1); WAL 워커 A 정상 조회→워커 B legal Run 소유권 변경 COMMIT→워커 A 다음 조회 0행(1). **15/15 독립 기대 관찰 일치**, 이상 12개는 결함 부정대조임.
- 기존 64·65·66·67차 격리 스크립트와 본 테스트 로컬 재실행 **64/64 독립 기대 관찰 일치**(안전성 64건 인수 아님).
- 동시성 측면: `read → mutate → re-read`만 실행했으며 R2 read→`saveCase` 실제 commit CAS 원자성은 **미실행**. `0행`은 조회 관찰이지 금액 `0원`이 아님.

### 조치
- `Draft PR #164` https://github.com/firmengine/firmengine/pull/164 (브랜치 `audit/a4-r68-handoff-run-identity-20261102`, base `7a2fea2`, HEAD `02cedc9ad9884e434f186a6df9bba6d8cc0c9eda`). `ax-site/` 내부 3개 파일만: `lib/automatic-draft-handoff-head.ts` 신규 pure SQL, `lib/automatic-draft-handoff.ts`의 read gate 전환, `tests/automatic-draft-handoff-head-identity.test.mjs` 신규 15케이스. GitHub PR 실제 변경 파일 3건 모두 scope 통과. **Draft/미병합**.
- 수정 조회조건: calculation Run / legal Run 모두 현재 사건, dataVersion, revision, 계산 Run linkage 및 Head/Run inputSHA 일치. 기존 정상 합성 케이스 재조회 성공. **법률 판단/계산 의미/approval state/운영 데이터 변경 없음.**
- GitHub 저장소 자체 테스트 실행·TypeScript/Next/CI 결과 **미관찰/미실행**; 로컬 동형 시험 15/15만 확인. staging D1/R2/Cron, HTTP 2워커, 실제 Word 파일/직원·변호사 전자서명, 법원 서식, 실제 보정명령 단계 모두 **미실행**.

## 6역할 회전 / ID 이력 (5개만 이번 직접 기록)
역할 순서 **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**; 전회차 AX 시작과 다르게 순환.
- `A4-IT-012` [ ]: 동시성·판본 동일성 12개 반례의 **조회계약 부분** 확인. commit CAS/배포 미실행.
- `A4-DOC-011` [ ]: 직원 인계 초안 Head의 사건/원천 오연결 가능성 **부분** 확인. 실제 문안 편집→재생성 경쟁 미실행.
- `A4-LAW-013` [ ]: 법률 Run·Head 일치 조회 조건 부분 재현. 공식 최종 Word 바이트와 변호사 승인 미검증.
- `A4-DATA-004` [ ]: 타 사건 immutable Run FK가 주어진 사건 Head에 잘못 연결되는 가상 사례 SQL에서 재현. 운영 데이터 오염 미관찰.
- `X-046` [ ]: 두 WAL 연결 A 조회/B 소유권 갱신/재조회로 read-time guard 검증, **실 분산 워커/완료 CAS 아님**.
- 간접 인계: `A4-CALC-004` 구 계산 Run의 sourceVersion·SHA, `A4-AX-013` 새 초안→사람 검수. **직접 통과/완료로 기록하지 않음**.

## 단계/복구 분리 및 차기
상담→서류→OCR→10분 quiet calculation→95법률→Word 검토초안→직원 인계→변호사 검수→보정 이벤트의 나머지 단계는 이번 시험 범위 **미실행**. `미관찰`/SQL NULL/명시 0/비해당/상충/source-only/승인 전을 별도 기록; source-only와 초안 `complete`를 확정 승인으로 취급하지 않음. n8n 설계와 운영 실행 구분; staging·운영 D1/R2/Cron 접근·운영 배포·마이그레이션·전자제출·인가 **미수행**.

다음 확인 체크 ID: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-046`. #17/#24/#161/#164 충돌·복구 계약 교차 검증, 직원 인계 `alreadyLinked` 빠른 반환의 R2 증빙·인증, 사전 영수증 PK 재시도/ACK 유실/503, 완료 CAS 직전 판본 A→B→A, 이전 승인 무효화. **68차 신규 인수 완료 0/5, 전체 최종 인수 0**.
