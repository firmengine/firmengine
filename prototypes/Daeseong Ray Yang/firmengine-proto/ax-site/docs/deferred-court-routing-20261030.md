# P1 · 관할법원별 기준 분기 — 보류 (2026-10-30)

**사용자 결정:** 현재 FirmEngine AX 검토와 서류요건 판단의 **1차 업무 기준은 서울회생법원**으로 유지한다. 법원별 감시/준칙/서식 필터 분리는 지금 수정하지 않는다. 기능별 오류 디버깅 우선순위에서 제외하고 향후 별도 인수 항목으로 재개한다.

## 현재 코드 확인
- `lib/domain.ts`의 `CaseContext.courtId`는 이미 사건 단위 관할 식별자이다.
- `lib/intake-types.ts`의 `IntakeRun.semanticContext.courtId`, `IntakeChecklistView.courtId`, `lib/intake-store.ts`의 상담 입력 fingerprint 및 stale check에도 사건 관할이 들어간다.
- 다만 `ConsultationNote` 및 SQL `consultation_notes`에는 상담 당시 **관할 선택·확인 상태·근거·변경 이력에 대한 독립적인 구조화 필드**가 없다. 따라서 기존 `courtId`가 있다고 상담 시작 시점부터 법원별 기준 판본을 독립적으로 재현하는 이력이 완성된 것은 아니다.
- `lib/case-legal-automation.ts`, `lib/case-substitution-watch.ts`, `lib/case-workflow-server.ts`의 전역 법령/법원 알림 COUNT 경로는 현재 보존한다. **타 법원 경보가 서울 사건까지 보류시키는 보수적 과차단 위험은 남지만**, 이를 임의로 완화해 무검토 통과시키지 않는다.

## 후속 수정 시에만 적용할 요구 계약 (현재 미구현)

1. **상담 최초 접수부터 관할 기록:** 사건 단위 `courtId`를 상담 시점/상담 revision과 연결한다. 예시 신규 기준정보/이력 원장(설계안): `consultation_court_history(case_id, consultation_revision, court_id, court_confirmation_state, source_note_id, checked_by, checked_at, effective_at, reference_release_sha)`. 실제 테이블명과 DDL은 후속 설계에서 결정하며 **지금 생성하지 않는다**.
2. **관할 상태 구분:** `confirmed / unknown / conflict / changed`. 관할을 상담 메모에서 LLM이 추측하거나 알 수 없는 사건을 서울 확정으로 승격하지 않는다. 서울 기준을 기본 업무 기준으로 적용하더라도 사건의 실제 관할 확인 여부를 별도로 표시한다.
3. **판본 결속:** `consultation_run`, 서류 85종 요구, 갈음 A←B+C, OCR field plan, 계산·LawGraph·서식 판본이 같은 `court_id + effective_date + approved_rule_release_sha`를 공유해야 한다.
4. **법원별 정책 선택:** 공식 법원 준칙, 제출서류, 갈음, 보정·기한, 서식, 변경 알림을 **해당 사건 관할에 적용되는 것만** 활성화. 공통 법률 기준은 중복 저장하지 않고 상위 공통 계층에서 재사용.
5. **관할 변경 시 재판단:** 변경의 전/후 이력, 출처, 승인자, 영향받는 문서·피처·법률검토·생성물 및 재분석 범위를 기록하고, 과거 결과는 보존하되 새 관할의 최신 승인으로 오인하지 않는다.
6. **인수시험:** 서울 사건 / 타 관할 사건 / 미확정 사건 / 상담 중 관할 변경 / 다른 법원 공고만 발생 / 관할·시행일이 겹치는 개정 / 같은 원문서류의 법원별 필수성 차이를 격리 사건으로 테스트.

## 이번 턴의 변경 범위
- **코드·DB 마이그레이션·법령 필터 변경 없음.**
- P1 관할 분기를 **보류**로 표시하고 구조만 후속 계약으로 남긴다.
- 현재 진행 중인 기능 디버깅은 **C01 (LawGraph→초안 차단)** 검증 → **C02 (자동초안→직원 편집/검수 원장)** → **C04 (갈음서류 공통 판단 입력)** 순서로 진행한다. C03 관할 알림 범위 분리는 이 후속 작업에 포함하지 않는다.

**주의:** 서울 기준은 현재 개발·시험의 우선 기준이지, 법원 관할을 확인하지 않은 사건의 서울회생법원 접수 가능성이나 실무 적합성을 자동 인정한다는 뜻이 아니다.
