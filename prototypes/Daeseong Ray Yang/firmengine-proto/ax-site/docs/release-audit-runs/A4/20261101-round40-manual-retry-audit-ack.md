# FirmEngine A4 40차 — 법률 수동 재시도 감사 ACK 누락 재현 및 보수 수정

- 기준일: **2026-11-01 KST**. 감사 출발 `main` SHA: `3b6a41f56ff8c309e8a933e664a15766c69fe161`. 40차 코드 변경 직전 `lib/case-legal-automation.ts` blob `6328eb4abbd7fc054c2d1a71f8686fb740441a3a`; 수정 후 `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`.
- 고정 영역: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. A4 실행 흐름·예외·동시성·복구 이외 변경 금지.
- 단일 보드 A4/X 체크 7역할 대응: **IT `A4-IT-022`, 서류 `A4-DOC-017`, 사무장 `A4-CALC-004`, 변호사 `A4-LAW-006`, 데이터 `A4-DATA-014`, AX `A4-AX-005`, 교차 `X-048`**. 직접 검증·보드 부분 기록은 IT/DATA/AX/X 4개; 다른 3개는 종단 관련 정적 인계만 검토. **전부 [ ] 유지**.
- 역할 순환: **계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자**. 이전 39차 서류 선행과 순환 시작 역할을 변경.
- 실제 확인: `drizzle/0017_legal_reanalysis_orchestration.sql` (jobs 20열/events 7열 계약), `lib/case-legal-automation.ts`의 `retryFailedCaseLegalAutomation/transition/note/processJob/drain`, `lib/case-agent-scheduler.ts`, `tests/case-legal-automation-flow.test.ts`, 38/39차 영수증 및 39차 회귀, main 최근 10커밋. PR #16 **open·unmerged**, PR #61 **open·draft·unmerged** (조회 기준 2026-11-01).

## 실제 재현: 저장은 진행됐지만 감사 이벤트가 없음

1. **수정 전 메인 함수 원본 V8 실행**: `failed` 법률 job, 입력 `{caseId:"synthetic",expectedDataVersion:1}`, current.dataVersion=1/current.caseRevision=1, `UPDATE ... status='retry_wait'` ACK=1 이후 `manual_retry_requested` INSERT ACK=0/null/2/미관찰 모두 `retry_wait`을 성공 반환. **독립 기대**: 감사 0은 명시적 미적용, null/2/누락은 미관찰이며 성공 영수증 아님. D1 INSERT 503 예외는 원시 오류 문자열을 포함한 예외로 전파될 수 있었음. 이는 **감사 기록 부재를 숨기는 P1 후보**이며 고객 자료의 실제 손실이 확인됐다는 주장은 아님.
2. **작은 보수 수정**: 수동 재시도 감사 INSERT의 `meta.changes`를 정확히 1로 확인. 0은 `LEGAL_AUTOMATION_AUDIT_INSERT_ZERO`, null/누락/2 및 503 예외는 `LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED`. 원시 503 문자열을 호출자에게 직접 전달하지 않음. 상태 CAS ACK 0/1/null/2 기존 판정, 기존 95개 법률조건·인적 승인·계산 산식 유지. **UPDATE와 INSERT는 여전히 별도 SQL**로, 원자성·재실행 차단 구현은 아님.
3. **수정 코드 원본과 신규/기존 테스트 파일 재조회 후 V8 재실행**: 신규 40차 14/14, 기존 39차 13/13 기대/관찰 일치. 신규 14건: 정상 승인 전 수동 재시도, 감사 0/null/누락/2/503, 상태 CAS 0/null/2, projection-repair 허용/차단, stale source dataVersion, invalid input, SQL 비원자성 정적 부정대조. `test.mjs`의 실제 본문을 Node 모듈 import/readFileSync만 합성 대체해 실행. **Node-native 전체 테스트 실행 아님**. 수정 전 수동 재시도 6조건 중 5건은 감사 누락/미확정에도 성공 반환하거나 원시 503을 던지는 반례로 관찰됨.
4. **독립 Python SQLite WAL 2연결 재현**: 새 `round40_manual_retry_audit_partial_commit_sqlite.py` **7/7 관찰 일치**. 정확히 1행 `retry_wait` COMMIT 뒤 감사 503 주입 시, 다른 연결에서 `retry_wait`·attempts 0·즉시 due·이벤트 0건 확인. 이전 `round38_legal_transition_audit_partial_commit_sqlite.py` 재실행 **10/10 관찰 일치**: `pending` COMMIT 후 이벤트 누락. 모두 **부분성공 결함 재현**이며 데이터 무결성 합격이 아님.

## 미해결 위험 및 승인 경계

- **P1 미해결**: 수동 재시도 요청의 UPDATE가 이미 COMMIT된 뒤 audit INSERT가 실패해도 `retry_wait`은 자동 스케줄러에 노출될 수 있다. 응답 오류만으로 재시도가 실제 실행되지 않았다고 보장할 수 없고, 재요청은 이미 변경된 상태 때문에 0행 충돌이 된다. `transition`과 수동 재시도의 UPDATE/event INSERT에 원자적 D1 batch/outbox 또는 영속 idempotency receipt·재조회·운영자 보류를 적용하는 것은 고위험 동작 변경이므로 **별도 브랜치·PR 및 IT/법률 실무 검토**가 필요하다. 이번 main 수정으로 자동복구, 중복제거 또는 법적 승인 완료를 주장하지 않는다.
- `A4-DOC-017` OCR 페이지별 실패와 재분류, `A4-CALC-004` 10분 quiet calculation과 구 기준정보 head 경합, `A4-LAW-006` 이전 사람 승인 무효화는 정적 연관만 확인. **상담→서류→OCR→quiet 10분→95 법률→Word 초안→직원·변호사→실제 보정 이벤트 E2E 미실행**.
- 기존 **계산 구판본 v7→v8 lease 탈취 / 기준정보 SHA A/B head 역전** 미해결(PR #16 open); R2 성공→D1 ACK 유실·지속 원장 Export(PR #61 draft) 미병합. n8n blueprint와 실제 운영 워크플로 구분. **staging D1/R2/Cron, 실제 두 HTTP 워커, Node-native CI/TS 빌드, 실제 모델 429/503/timeout, 실제 Word·사람 검수·법원 보정/전자제출 미실행**. 결과값 `미관찰/null/0/비해당/상충/source-only/승인전`을 분리하며 승인 전 결과를 확정으로 승격하지 않는다.
- 고객 문서·개인정보·OCR 원문값·비밀 키·환경변수는 Git에 기록하지 않았고 운영 배포/운영 마이그레이션/전자제출/인가 확정 없음.

## 회차 변경 및 다음 ID

- 코드: `lib/case-legal-automation.ts` (manual retry 감사 ACK 판정만), [커밋 576f7764](https://github.com/firmengine/firmengine/commit/576f7764ea042491d1fb0d7fd778a09094954ce2).
- 테스트: `tests/case-legal-automation-manual-retry-audit-r40.test.mjs`, [커밋 6101d236](https://github.com/firmengine/firmengine/commit/6101d2366a24899a1ab97f7a730e6e2b1ca74e4b).
- 다음 우선 **`A4-DATA-014`/`A4-LAW-006`/`X-048`**: 현재 state+audit 이벤트 쌍 영속 원자성/수동 재시도 멱등성/사람 승인 상태 보류 PR. 그다음 **`A4-IT-003`/`X-046`** source/reference CAS, **`A4-DATA-013`/`X-047`** R2 GET 바이트↔D1 영수증.
- 직접 체크 4개는 실행 단위 부분만 관찰해 **[ ] 유지**. **신규 최종 인수 0건 / 제품 전체 인수 완료 0건**.
