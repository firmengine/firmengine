# 상담에서 사건별 서류·추출 계획까지 연결

기준: 2026-10-30 GitHub 코드. **운영 D1 마이그레이션과 실제 배포 검증은 별개**입니다.

## 업무 흐름

1. 사건을 만들면 내부 사건 ID(`cases.id`)가 부여됩니다. **법원 사건번호와 동일하지 않습니다.**
2. 상담 이력을 저장하고 분석하면 필요한 서류가 `case_document_requirements`에 사건 ID·상담 실행 ID별로 기록됩니다.
3. 같은 DB 배치에서 `case_requirement_field_plans`에 서류별 원문 확인 항목과 OCR 후보 피처를 저장합니다. 동일 분석을 재시도해도 같은 행을 중복 생성하지 않습니다.
4. OCR 처리와 파일 접수 상태는 `case_document_work_events`에 추가 기록합니다. 기존 소득·채무·재산 계산 감시의 조용한 기간을 이 상태 갱신으로 초기화하지 않습니다.
5. 사건 업무 화면에서 상담 결과를 **명시적으로 연결**하면 대상·기간·서류 필드 매핑과 담당자 검토를 진행합니다. 상담 분석 저장 자체는 서류 제출 적합성 승인으로 간주하지 않습니다.

## 조회 주소

사건의 내부 ID가 `{id}`일 때:

- `GET /api/cases/{id}/data?view=requirements` — 현재 상담 분석의 필요 서류와 `fieldPlan`; 과거 행은 `legacy_unmaterialized`.
- `GET /api/cases/{id}/data?view=requirement_monitor` — 서류 종류 후보, 접수/추출 관측 상태, 처리 작업 수 및 사건별 변경 커서.
- `GET /api/cases/{id}/data?view=requirement_events&afterEventId=0&limit=50` — 단조 증가 이벤트 ID로 증분 조회.
- `GET /api/cases/{id}/data?view=updates&afterEventId=0` — 기존 사건 원천 데이터 변경 이벤트.

## 유의할 구분

- `requiredSourceFields`는 상담 기준에서 **확인해야 할 항목 원문**입니다.
- `ocrCandidates`는 그 서류에서 읽을 수 있는 **후보 필드 목록**이며, 해당 필드가 법적으로 필수라는 승인이나 실제 값 추출 성공을 의미하지 않습니다.
- 사람·기간·원문 근거가 확인되지 않으면 서류 종류가 같아도 충족 처리하지 않습니다.
- OCR 후보가 없어도 상담 필요 서류를 지우지 않고 `review_required`로 보존합니다.
- 상담 이력이 변경되면 이전 분석·필드 계획은 이력으로 남고 새 분석이 활성화되기 전에는 현재 목록으로 사용하지 않습니다. 조회에는 `pendingReanalysis` 및 `previousCompletedRunId`를 표시해 빈 목록을 '필요 서류 없음'으로 오해하지 않게 합니다.
- **갈음서류 관계 연결·갈음에 따른 비활성화·복원 로직은 이번 변경에서 수정하지 않았습니다.**

## 적용 및 검증

새 코드에 필요한 SQL 파일은 `drizzle/0013_case_requirement_field_plans.sql` 및 `drizzle/0015_case_document_work_events.sql`입니다. **운영 DB에 먼저 적용하고** 앱을 배포해야 새 조회·저장 경로가 작동합니다.

추가한 테스트는 상담 저장 원자성·롤백, 등록된 85종 서류의 항목 계획 보존, 상태 이벤트의 계산 감시 분리를 확인하도록 작성했습니다. 테스트 실행 및 실제 운영 D1 점검 결과는 별도로 기록해야 합니다.
