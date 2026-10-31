# FirmEngine A4 39차 — 법률 상태 CAS 성공 후 감사 INSERT ACK 유실을 성공으로 오판하는 결함
- 감사 시점: 2026-11-01 03:37 KST. 기준 main: `11e20659a2c3abb4104a3e2b1e6647a857665884`; 기준 `lib/case-legal-automation.ts` blob: `acf33d5c45a89a5f65b4d2c538b41d5f09998a01`, 중앙 보드 blob: `4f696db83cf0bcf682fbb861231cc683166de82d`.
- A4 단일 보드 직접 확인 ID 4건: `A4-IT-022`, `A4-DATA-014`, `A4-AX-005`, `X-048`. 6역할 순환: 사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자. 역할별 관계 ID: `A4-DOC-017`, `A4-CALC-004`, `A4-LAW-006` (직접 종단 테스트 없음).
- 관련 스키마: `drizzle/0017_legal_reanalysis_orchestration.sql`의 `case_legal_automation_jobs` 및 `case_legal_automation_events`. 최근 38차 영수증/소스·합성 회귀 확인. PR #16 open/unmerged, PR #61 open/draft/unmerged. main에서 38차 이후 7개 커밋은 A1/A2/A3 문서·중앙 보드 변경뿐, 법률 워커 원본 변경 없음.

## 재현 — 독립 입력/기대/실제
1. 실제 main에서 `note()/transition()` 본문만 TypeScript 매개변수 주석 제거 후 V8 AsyncFunction/Function으로 실행. 합성 DB: 상태 CAS `meta.changes=1` 다음 감사 INSERT `D1 503` 예외. 독립 기대: 상태 저장 여부와 감사 저장 여부 분리, **감사 ACK 미확정** 및 자동 retry/승인 금지. 수정 전 관찰: 예외를 `.catch(()=>{})`로 삼켜 **transition 성공 반환**.
2. 같은 UPDATE=1에서 감사 ACK `0`, `null`, `2`, 메타 누락도 수정 전 모두 성공 반환. 명시 0(감사 INSERT 미적용)과 미관찰(null/누락) 분리가 필요하다. UPDATE=0과 UPDATE=null은 기존대로 각각 superseded 및 전이 ACK 미확정.
3. 보수 수정: INSERT의 `meta.changes===1`만 관찰 성공. 0은 `LEGAL_AUTOMATION_AUDIT_INSERT_ZERO`; null/누락/2/실제 INSERT 예외는 `LEGAL_AUTOMATION_AUDIT_ACK_UNOBSERVED`. 상태 CAS 성공 후 감사 기록 불확정은 실패/재시도 UPDATE를 추가 호출하지 않고 상위 drain의 `unobserved`로 전파. 원본 오류의 개인 키·URL 노출 금지. 상태·증빙을 임의 삭제하거나 두 번째 모델 호출·재출력·사람 승인 수행하지 않음.
4. 수정된 실제 본문 기반 V8 격리 기대 **12/12 일치** (성공/503/0/null/2/누락/상태 CAS 0/null/2/direct note 0/null/1). `tests/case-legal-automation-audit-ack-r39.test.mjs`에 Node-native 13개(12 합성 + 1 오버라이트 방지 정적 단언) 작성. **Node-native 실행 미실행**, 전체 TS/Next/CI 미실행.
5. 이전 38차 독립 Python SQLite WAL 두 연결 장애 재현 스크립트 `round38_legal_transition_audit_partial_commit_sqlite.py` 재실행: **10/10 관찰 일치**. 상태 UPDATE COMMIT=1 이후 이벤트 INSERT 503이면 job.status=pending 이지만 이벤트 0건, 이전 lease UPDATE=0, 다른 사건 worker UPDATE=1. 이는 **원자성 합격이 아니라 부분성공 결함 재현**.

## 미해결/복구 경계
- 본 수정은 **오류를 숨기지 않도록 하는 가시성 패치**일 뿐 D1 트랜잭션 원자성·outbox/DLQ·이벤트 재적재·보정명령/승인 종단을 구현한 것이 아님. 상태 COMMIT 후 감사 실패한 job은 `pending` 등으로 남아 자동 재선택되지 않을 수 있다. 원장을 조회·대조하고 사건 관리자 승인 아래 수동 복구 설계 필요. 중복 이벤트 자동 생성 금지.
- 다른 2건 P1: 계산 구판본 lease 탈취(PR #16 미병합), 기준정보 SHA A/B 계산 head 역전 미해결. Export D1/R2 PR #61 미병합.
- `A4-DOC-017` OCR 페이지, `A4-CALC-004` 10분 quiet/계산 head, `A4-LAW-006` 승인 무효화는 정적 관계만 확인; 상담→서류→OCR→quiet→95법률→Word→직원/변호사→실제 보정 이벤트 전체 E2E **미실행**.
- n8n 설계는 운영 워크플로 아님. **staging D1/R2/Cron, HTTP 두 워커, 실제 모델 429/503/timeout, Node-native/CI, Word·사람 승인, 법원 전자제출 모두 미실행**. null/미관찰/0/비해당/상충/source-only/승인전 분리, 실무자가 승인하지 않은 값 확정값 승격 없음.
- 다음 ID: `A4-DATA-014`/ `A4-LAW-006` (상태+감사 원자성/outbox 계약·감사 미관찰 진단), `A4-IT-003`/`X-046` (원본·reference lease CAS), `A4-DATA-013`/`X-047` (R2 bytes-D1 receipt).
- 이 회차 직접 검증 ID 4건 **[ ] 유지**, 제품 최종 인수 **0건**. 운영 배포/운영 D1 migration/고객 문서 변경/전자제출/법원 인가 확정 없음.
