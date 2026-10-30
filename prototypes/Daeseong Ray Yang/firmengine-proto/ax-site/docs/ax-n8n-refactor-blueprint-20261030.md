# FirmEngine AX 전체 실행감사 및 n8n·다중사건 운영 리팩토링 설계서
검토 기준: 2026-10-30 / GitHub main c0f244b7e1e5a0cf0e8d73cc69fb06f1df7f3f0b
문서 상태: **PROPOSED / 구현 지시서 및 인수기준**. 라이브 D1, R2, n8n 배포 인스턴스와 실제 법원 제출에 대한 통합 통과를 의미하지 않는다.
범위: ax-site의 상담·85종 문서 라우팅·OCR·정규화 피처·계산·법률 AI·LawGraph·서류작성·기준정보·검토 및 외부 연동. 기존 운영 소스는 변경하지 않음.

## A. 결론과 변경 불가 원칙

현재는 모듈들이 코드에서 연결되기 시작했지만 **다중사건의 독립적·완결적 실행 시스템은 아니다**. 단위 규칙과 UI가 존재한다는 사실이 성공한 비동기 사건 처리의 증거는 아니다. n8n 도입의 목적은 모델 추론을 늘리는 것이 아니라 **단계·책임·상태·예외·재시도·직원 개입·사건별 독립성의 가시화와 유지관리**다.

불변 조건:
- OCR 관측, 검증된 사실, 법적 인정, 계산값, AI 권고, 담당자/변호사 승인, 법원 절차는 서로 다른 상태로 보존한다.
- 신뢰 가능한 수치 계산은 기존 BigInt 백엔드 엔진만 수행한다. n8n Code 노드와 LLM이 법적 금액을 다시 산출하지 않는다.
- 원문→canonical field→typed case input→calculation ID/산식→form token→출력 artifact의 출처가 추적되어야 한다.
- 자료 부재/오인식/미관찰/명시적 해당 없음/상충/0은 서로 다른 데이터 값이다. 미확정값을 0으로 보정하지 않는다.
- AI는 법률상 인가·인가확률·재량 판단을 자동 확정하지 않는다. 검토용 초안과 최종제출본은 반드시 분리한다.
- 한 사건의 실행·자료·벡터 지식·문서·권한·로그가 다른 사건으로 섞이지 않는다.
- 사건 실행은 시작 시 고정된 법령·관할·시행일·서식·프롬프트·모델 정책의 버전 번들로만 진행한다. Git main 최신 파일을 실행 중 자동 교체하지 않는다.
- Google Sheets는 **사건 DB의 복제·운영 대시보드**이지 법적 계산의 원본 DB가 아니다. Drive/NAS는 파일 바이트 저장소이며 원본성의 기준은 사건 DB의 문서 레지스트리와 해시다.

## B. 현재 코드 기준 확정된 연결과 결함

현행 경로: DB SQL 트리거 → case_data_change_state → 10분 조용한 기간 → case_calculation_heads → case-agent-scheduler → reviewLegal(6개/회, 총95개) → analyses → persistCaseLawgraphReview → 자동 초안 후보 → automatic-review-draft → R2/artifacts → 별도 staff workflow UI.

규모: DB Drizzle 테이블 53개. 법률 risk 체크 95개 중 explicit required_features가 없는 항목 88개; 모델 자동 해소 허용 0개. OCR canonical 693개, 최신 감사 기록의 명시적 typed projection 47개, 나머지 646개는 원본 전용 또는 미연결. 문서 계약 85종. GitHub 테스트 파일 132개 있으나 CI workflow run 0건(2026-10-30 현재 조회). 실제 통합 테스트 통과는 확인되지 않음.

| ID | 심각도 | 실제 모듈/위치 | 실패 형태 및 실행상의 영향 | 변경 계약 |
|---|---|---|---|---|
| F01 | P0 | drizzle/0010; server-store.saveCase; legal-review-identity | cases.revision 변경 모두 source data_version 증가. 담당자 작업/법률 의견/문서 업무 갱신만으로도 10분 재대기·95개 재검토 및 사람 승인 무효화 가능 | source_revision, workflow_revision, legal_disposition_revision, artifact_revision 분리; 법적 의존성 fingerprint만 검사 |
| F02 | P0 | intake-store.appendConsultation; case-data-watch | 상담 note 수정만 하고 active_run_id가 이미 null인 경우 consultation_heads의 revision만 바뀌어 원천 변경 감시 누락 가능. 상담 재분류는 Cron에서 자동 호출되지 않음 | consultation_change 이벤트와 intake_reanalysis_pending 별도 큐; 승인된 최신 상담 실행과 사건 workflow adoption 연결 |
| F03 | P0 | worker/index; case-agent-scheduler; case-data-recompute | Cron limit=1, 오래된 최초 행을 처리. 조용하지 않은/영구 실패 사건이 앞으로 정렬되면 다른 사건이 기아 상태에 빠질 수 있음 | due_at<=now 필터, per-case lease, bounded retries, fair scheduling, DLQ 및 사건별 concurrency |
| F04 | P0 | case-feature-snapshot; pipeline | 정규화 원천 head가 없는 legacy case도 warning만 남기고 계산 진행 가능. OCR 미완료/원천상충을 AI 시작 전에 일괄 차단하는 preflight가 없음 | source snapshot integrity and evidence readiness의 명시적 상태. 불완전하면 AI 재검토를 보류하고 증빙 작업 생성 |
| F05 | P0 | risk-catalog; legal-review-packet | 95개 중 88개는 required_features 선언이 빈 값. 상태 검토 95개 완료가 사건·피처별 실질적 법률 판단 증거가 아님 | 관할·시행일·피처·증빙·적용조건·법원양식별 risk contract 검증/승인 후 적용 |
| F06 | P0 | case-legal-automation.finalizeReview; case-lawgraph-store; document-writer | LawGraph에 checks는 기록하지만 documentFields는 공급하지 않음. 자동 작성기는 별도 derived_evaluation/formBindings에서 값을 가져옴. AI 법률 판단·반려피처가 실제 서식 필드까지 연결되지 않음 | LawGraph→document preflight blockers + reviewed proposals→exact form fields 양방향 계약; 금액은 계산 엔진 결과만 |
| F07 | P0 | automatic-review-draft; export/route; case-workflow-server | 자동 초안은 artifacts/R2에 저장되지만 기존 exportManifest 기반의 문서 검토·편집·승인 경로로 등록되지 않음 | automatic_draft artifact를 동일 reviewer workbench의 검토·승인 대기 큐로 노출; final 승인과 인가 구분 |
| F08 | P0 | tests/case-legal-automation-flow.test | 정상 자동초안 draft_ready → R2 파일 → 직원 검토 → 재수정→ 재생성 성공을 관통하는 실제 통합 테스트가 없음. 테스트에서 generateDraft는 차단 stub | 최소 2개 실제 문서/3개 독립 사건의 success-path E2E 필수 |
| F09 | P1 | case-legal-automation.finalizeReview | 법령 감시 알림을 관할·유효일/해당 서식 구분 없이 전체 COUNT로 판단하여 관련 없는 알림으로 모든 사건의 초안을 막을 수 있음 | policy_release applicability(case court/date/rule/form) 및 blocking severity 매칭 |
| F10 | P1 | case-legal-automation; case-calculation-feature-store | calc head가 현재라는 것만 보고 legal AI 처리. 계산 상태가 missing/provisional일 때도 전량 AI 비용을 쓸 수 있음 | 계산 결과 상태·필수 산식·원천근거를 법률 AI 전 preflight에서 gate |
| F11 | P1 | case-legal-automation; case-tasks; UI | missingDocuments/nextAction은 AI 결과에 존재하나 case_tasks 생성, 담당자 배정, 이메일/시트 업무 반영, SLA/중복 억제에 연결되지 않음 | review_task를 법률 finding fingerprint로 upsert, owner/due/ack/resolution 필수 |
| F12 | P1 | case-legal-automation; n8n-reference | 신규 95체크 AI는 현재 ax-site 직접 호출. n8n-reference/의 JSON은 이전 Python 프로토타입용 inactive 참고본이므로 복사·URL 교체만으로 실행 불가 | 신규 API 계약과 별도 n8n workflow JSON/CI 생성 |
| F13 | P1 | case-legal-automation; legal/reference | 기준정보 버전·프롬프트·모델 policy가 서로 독립적으로 바뀔 수 있고 per-run immutable bundle이 없음 | release_manifest에 Git SHA + legal SHA + schema SHA + prompt SHA + model policy SHA 동봉 |
| F14 | P1 | automatic-review-draft; export-artifact-transaction | 생성 중 lease 만료/네트워크 실패/부분 R2 성공 후 DB 실패 시 보상정리와 파일 재사용 무결성 확인이 미완성 | prepare/upload/verify/commit state, sha+provider id 검증, sweep/reconcile, idempotent finalization |
| F15 | P1 | case-workflow-view 호출 | 자동 판단 측에서는 catalogVersion/pageTypes/activeIntakeRunId를 주지 않고 buildCaseWorkflowView 사용. 갈음서류·서류 요건 상태가 실화면과 다르게 복원·보류될 수 있음 | 동일 컨텍스트를 제공하는 canonical requirement evaluator를 API 하나로 통합 |
| F16 | P1 | worker Cron / pipelines | 6개씩 95개 검토 → 최소 16번 호출. Cron 1분·한 사건/회면 단일 사건 최소 약 16분+10분 대기, 다중사건은 선형 지연 | 단계별 큐와 case_id별 독립 checkpoint, 여러 n8n workers/백엔드 rate-limit |
| F17 | P1 | legal-monitor-provider; worker scheduled | 법령/법원문서 정기 모니터가 현재 사건 재판단 Cron에서 자동 스케줄되는 연결 확인 안 됨 | 독립 daily compliance monitor + reviewer release approval + affected case invalidation |
| F18 | P1 | server-store requireSameOrigin; app roles | 기존 사이트는 owner-private 실행 경계. 직원·복수사건 운용의 per-case ACL/SSO, 서비스계정 최소권한, API 인증 및 감사가 부족 | staff roles + case assignment ABAC/RBAC, mTLS/OAuth scopes, row-level security, no service fallback for human actions |
| F19 | P1 | case-schema-services; source/typed contract | OCR 693개 중 646개가 직접 계산 변환 미설정; 18계산모듈 91선언 입력과 연결 점검 지속 중 | 시나리오별 accepted input contract + lineage coverage report와 blocker 분리 |
| F20 | P1 | all runtime & migrations | 0017/0018 및 Cron이 실제 D1/Workers에 반영됐는지 검증 안 됨; CI 0 runs | staging migrations, build, integration, chaos, UI smoke, deployment attestation 선행 |

## C. 목표 컴포넌트 구조 및 데이터 흐름

                    직원용 웹 UI (인증·사건배정·오류·기준 CRUD 승인)
                                 |
                        Backend API/BFF (RBAC)
                                 |
          +----------------------+-----------------------+
          |                      |                       |
    Case Domain API         n8n Orchestrator       Read-side APIs
    (원본·업무 원장)       (상태전이·시그널·재시도)     (Sheets/UI)
          |                      |                       |
          |              n8n main + Redis + n8n workers  |
          |                      |                       |
          +-------------- Stage Executor API ------------+
                      |        |        |
                  OCR/검증   BigInt Calc  LawGraph AI + Document Writer
                      |        |        |
              Immutable Case DB (PostgreSQL, 향후 전환)
                      |
          +-----------+-------------+----------------+
          |                         |                |
     Artifact Registry        Event Outbox      Rule/Prompt Registry
          |                         |                |
    Google Shared Drive        Sheets Mirror       Git commit/approved bundle
         OR NAS S3 API         /Staff Tasks         /rejection risk index
          |
    sha256 + version + ACL + source page refs

도입 초기에는 현재 Cloudflare D1+R2를 기존 backend API 뒤에 그대로 남기는 **A단계 호환 어댑터**를 허용한다. 하지만 n8n이 D1 테이블에 직접 접근하거나 SQLite SQL을 Postgres에 그대로 복사하면 안 된다. 목표 B단계에서 별도 PostgreSQL case DB로 이전하며 실행 결과를 샘플별로 비교한다. n8n 자신의 workflow/execution DB와 사건 원장 DB는 서로 다른 DB/권한을 쓴다.

### 컴포넌트의 권한 경계
| 컴포넌트 | 할 수 있는 일 | 하면 안 되는 일 |
|---|---|---|
| n8n | 단계 재개, 작업 스케줄, API 호출, 상태조회, 오류 라우팅, 알림 | 사건 원천 필드 직접 수정, 법률 계산, 제출 승인, 원본 텍스트/비밀번호를 노드 데이터에 저장 |
| Backend Case API | CRUD, 원천/비원천 변경 구분, 버전·CAS·outbox, 작업 claim, 접근제어 | 재량적 법률상 인정 자동 부여 |
| OCR/Verifier | 분류/추출/원문 대조/근거표시, 누락·오인식·해당없음 구분 | 수치 법적 인정, 다른 사건 원본 참조 |
| Deterministic Calculator | 원 단위 BigInt 산식, 계산근거/입력 ID 및 버전 저장 | LLM의 산식 자유 보정, 미관측 0 처리 |
| LawGraph Agent | 근거·법령·사건조건·예외·반려 패턴 연결, 판단 제안·missing/attention | 법원 결정이나 사람 승인 위장 |
| Document Engine | 승인된 fact+calc binding으로 서식별 검토본 생성, diff/누락 차단 | 모델 임의 금액 입력, 무허가 제출 |
| Rule/Prompt Publisher | Git diff, 검증, 승인, immutable release 배포 | 승인되지 않은 main 프롬프트를 현행 사건에 자동 적용 |
| Sheets sync | 상태/작업 요약 투영, 허용된 변경 요청 수집 | 법적 판단/계산 원본 데이터 편집 |
| Drive/NAS adapter | 파일 버전·해시·권한·백업·복구 | case_id 검사 없는 임의 파일 조회 |

## D. n8n Workflow 분리와 각 실행 핸드오프

| WF | 목적 | 진입 이벤트/조건 | 후속 에이전트 및 성공 산출물 | 실패·재시도 |
|---|---|---|---|---|
| WF00 Event Dispatcher | 사건별 dedupe/claim/다음 단계 결정 | PostgreSQL outbox 또는 signed webhook | stage_job 생성→WF01/02/04/06/09 | 재전달 중복은 idempotency 200; DLQ |
| WF01 Consultation Intake | 상담 원문 분류, 케이스·서류 요구조건 | consultation.changed | intake classifier→document planner→requirements+feature plan | AI 추출 불확실/사건 또는 상담판본 변경 시 보류 |
| WF02 Document Ingestion | 원본 저장/안전검사/문서유형 확인 | document.uploaded | storage adapter→classifier→page_jobs | 원본 해시, 용량·페이지, 분류 모호성 |
| WF03 OCR & Verification | 병렬 페이지 추출·상충/누락 복구 | page_job.pending | extractor→source verifier→canonical binding→source fact store | 페이지만 재시도, human correction 필요 시 HOLD |
| WF04 Source Reconcile & Quiet | 출처·대상·기간 검증, 10분 안정화 | source.changed; due_at | source reconciler→source_snapshot sealed | 추가 변경 시 due_at 이동, 미확정 page 확인 |
| WF05 Deterministic Calculation | 검증 입력만 계산 | source.snapshot.ready | calc engine→feature result store + trace | 미결 값은 BLOCKED_INPUT, AI 이전 분리 |
| WF06 LawGraph Review | 법령 적용, 95개 위험 중 해당 조건 검사 | calc.current + source.complete | legal ref search + evidence tool + risk-feature retriever → legal findings | 오류/미해결→담당자 task, AI 6개 배치 checkpoint |
| WF07 Document Draft | 서식 선택·필수 필드·생성/검증 | draft.gate.passed | form binder→writer→checksum/office preflight→artifact | 불일치·누락→HOLD/수정작업, 부분생성은 보상정리 |
| WF08 Human Review | 검토/반려/수정 승인 및 final review copy | review.requested | 직원 UI→변호사 검토→승인 영수증 | 변경 버전 확인, 사람 서명 없는 final 차단 |
| WF09 Legal & Form Monitor | 공식 법령/준칙/서식 변경 감시 | daily schedule | monitor→candidate change→human policy release | 검색 실패를 '변경 없음'으로 처리 금지 |
| WF10 Error/SLA/Ticket | 실패·보완·휴먼태스크 추적 | any stage failed/hold | task upsert→owner/SLA→notification→retry/resume | 중복 알림·타임아웃 회수, escalation |
| WF11 Workspace Sync | DB→Google Sheets, storage audit | outbox.created; periodic reconcile | Sheets batch upsert; Drive/NAS index reconciliation | 외부 429/403/네트워크는 별도 retry, 사건 실행 비차단 |
| WF12 Rejection Learning | 보정·기각·반려·이의 등 결과 구조화 | reviewed outcome.closed | feedback extractor→human labeling→cluster→offline evaluation→approved release | 미검증/개인식별 정보는 지식배포 금지 |

비고: n8n Execute Sub-workflow는 업무단계 재사용용이며, 내구성·CAS·lease의 진실은 항상 DB job 레코드가 갖는다. 하위 워크플로 실패가 상위 성공으로 오인되지 않도록 stage receipt를 확인한다. 재실행 요청은 원래 job idempotency key를 유지한다.

## E. 사건별 상태와 데이터 버전 분리

| 구분 | 증가시키는 이벤트 | 증가시키면 안 되는 이벤트 | 영향을 주는 downstream |
|---|---|---|---|
| source_revision | 문서 원본 변경, 확인된 상담 변경, 채택된 OCR/팩트 수정 | UI 열람, task 담당자 지정, 검토 코멘트 | 10m quiet→계산→법률·초안 |
| consultation_revision | 상담 노트 추가/정정 및 상담 조건 갱신 | 법률 AI 응답, 시트 보고용 상태 | WF01 및 필요한 사건 workflow adoption |
| workflow_revision | 서류 요구/담당자/마감·인수인계 | 원본 증빙 동일 저장 | requirement/status projection, task |
| legal_disposition_revision | 사람의 법률 판단/승인/반려 | 단순 재조회 | 관련 위험항목·서류 최종 게이트만 재검토 |
| rule_release_version | 승인된 법령/준칙/서식 판본 활성화 | 법령 뉴스 관측/미확인 검색실패 | 영향 사건의 적용버전 재계산 |
| prompt_release_version | 승인/평가 통과한 prompt/agent schema 배포 | Git main 단순 변경 | 신규 실행 또는 명시적 롤아웃 실행 |
| artifact_revision | render/verify/approve 결과 | 원천 정보 변경 없이 파일 검색 | artifact index/Staff reviewer; 원천 quiet 불변 |

source_fingerprint = sha256(정규화된 채택 원천팩트 + active 문서해시 + 상담채택버전 + 계산 의존 법령판본).
legal_dependency_fingerprint = sha256(source_fingerprint + 관할/신청일 + rule_bundle + applicable risk features).
job_key = sha256(tenant_id + case_id + stage_name + source_fingerprint + config_bundle_sha).
서버는 동일 case_id + stage_name + dependency_fingerprint에 고유 제약을 둔다. 모든 단계 결과는 immutable stage_run으로 기록하고 active_head는 조건부 갱신한다. 중간에 원천이 바뀌면 이전 작업은 superseded되며 최신 판본으로 새 job을 발급한다.

기본 상태 전이:
- RECEIVED→INTAKE_PENDING→DOCUMENT_REQUIRED→PAGE_PENDING→EXTRACTION_VERIFY→SOURCE_READY→QUIET_WAIT→CALC_PENDING→CALCULATED→LEGAL_PENDING→LEGAL_REVIEWED→DRAFT_PENDING→DRAFT_READY→HUMAN_REVIEW→FINAL_REVIEW_COPY
- 어느 단계든 REVIEW_REQUIRED / INPUT_BLOCKED / RETRY_WAIT / FAILED_D LQ / SUPERSEDED로 분기 가능. 최종 제출/인가 등 법원 절차는 별도 외부 사실 기록으로만 변경한다.
- n8n 실행 성공은 도메인 상태 COMPLETED가 아니다. DB의 검증된 stage result + dependency fingerprint가 동일해야 성공이다.

## F. 필수 backend API 계약 (모든 write는 signed service identity + CAS)

| Endpoint | 내용 | 응답과 검사 |
|---|---|---|
| POST /v1/events/ingest | source/document/consultation/policy change | event_id,case_id,hash 검증, 중복은 기존 receipt |
| GET /v1/cases/:id/snapshots/current | 사건 스냅샷 메타 | source_rev,case_rev,as_of,eligible_stage,expiry,hash |
| POST /v1/jobs/claim | case_id,stage,dependency_key,actor | lease_token,lease_until,job_id,current_version |
| POST /v1/jobs/:id/heartbeat | lease token+fencing number | 연장 여부; 오래된 lease 차단 |
| POST /v1/jobs/:id/stages/:stage/run | stage-specific versioned schema input | 202+job_ref 또는 완료 영수증; raw case payload 불허 |
| GET /v1/jobs/:id/status | 현재 stage 및 오류와 완료증명 | state, attempts,next_retry_at,blockers,trace_ids |
| POST /v1/jobs/:id/commit | exact output hash+lease+expected source | 원자적 active head 갱신 또는 409 SUPERSEDED |
| GET /v1/releases/:sha/manifest | approved config bundle | sha,signature,schema versions,models,rule/source effective |
| POST /v1/reviews/:checkId/decision | 사용자 RBAC, 근거, expected version | 독립 HUMAN_RECEIPT; AI 자동 승인 불가 |
| POST /v1/artifacts/stage; /commit | file bytes via storage adapter | SHA,provider_id,object_ver,case ACL,doc contract |
| GET /v1/ops/events?cursor= | 상태/통계/outbox 안정화 읽기 | event_id cursor, next_cursor |
| POST /v1/ops/sheets/import-proposal | 허용된 Sheet 편집 후보 | 검증·감사 후 human approval, 직접 fact 수정 불가 |

비식별 예시 이벤트: {tenant_id,case_id,event_id,event_type,source_revision,source_sha256,occurred_at,origin,correlation_id}. 단계 job: {job_id,case_id,source_revision,calculation_run_id,legal_rule_sha256,prompt_sha256,form_sha256,ocr_contract_sha256,model_policy_sha256,idempotency_key,lease_fencing}. 사용자 주민번호/상담 원문/PDF 바이트는 메시지/로그에 넣지 않는다.

## G. 에이전트 도구/MCP/권한 경계

| 에이전트/서브시스템 | 필수 도구 (Read/Write) | 권장 인터페이스 | 다른 단계와 접합부 |
|---|---|---|---|
| Intake Classifier | consultation.read, field_catalog.read, rules.read, requirements.propose | backend REST read + scoped model request | WF01 → requirements/field_plan |
| Document Classifier | artifact.read_secure, document_type_catalog, page_locator | REST + storage signed access | WF02 → WF03 |
| OCR Extractor | document image, exact source schema, page region crop | backend stage HTTP; AI 없음/있음 버전 명시 | WF03 → normalized fields |
| Independent Verifier | read original+candidate, confidence/coverage, re-read requests | backend REST, bounded model | wrong_field/masked/blank/not_seen 구분 |
| Source Reconciler | verified_fact.query, identity_match, amount_date_unit_validate | deterministic backend only | WF03→WF05, 사람 확인 task |
| Calculator | calculator.calculate_case, trace, validation | existing BigInt core through backend REST or narrowly scoped MCP | immutable run_id + feature refs |
| LawGraph Reviewer | risk catalog, evidence read by IDs, rule search, graph neighborhood, rejection-pattern query | read-only MCP/REST with schema & citation budget; no direct SQL | calc→legal findings→tasks/form preflight |
| Form Binder / Writer | exact form schema, calc result read by run_id, token source evidence, render/verify | backend deterministic REST, artifact write behind ACL | legal blockers+calc binding→draft |
| Legal Monitor | official source search/compare, effective date and jurisdiction analyzer | constrained web tool / MCP read; release propose via API | propose candidate, human publish required |
| Staff Task Agent | finding upsert, assignment/SLA, notify, resolve after human decision | backend writes, Gmail/Chat/Sheets connector outbound | all failures and approvals |
| Feedback Agent | closed correction order, human reason tags, clustering/retrieval, eval | redacted case scoped read-only retrieval; human labels | offline approved feature pack, no silent model drift |
| Operations Agent | queue depth, lease, DLQ, S3/NAS/Drive/Sheets health, traces | monitoring read only, operator retry API | SLA and incident handling |

**MCP 추가 원칙:** 자연어 에이전트에 필요한 검색·도구 발견/증거 조회에는 MCP를 쓸 수 있지만, 금액 계산은 기존 동일 엔진, 파일 commit/사람 검토/DB 수정은 제한된 REST로 강제한다. MCP 도구마다 tenant_id/case_id 범위, 최소 권한, 요청 크기·시간·rate, 응답 JSON Schema, audit provenance를 명세한다. agent가 다른 사건의 facts를 조회하지 못하도록 서버측 권한이 필수다. n8n에 직접 DB full-access credential이나 GitHub PAT을 두지 않는다.

## H. Postgres 사건 DB와 기존 53테이블의 그룹별 이동

- Case core: cases, events, case_mutation_receipts → cases, case_revisions, audit_events, command_receipts. 워크플로 독립 상태 분리.
- Intake: consultation_heads, consultation_notes, consultation_runs, intake_catalog_* → consultations, consultation_versions, intake_runs, intake_catalog_releases.
- Requirement & substitution: case_document_requirements, case_requirement_field_plans, case_document_work_events, case_substitution_* → requirement_plans, requirement_evidence, substitution_reviews, document_tasks, change_events.
- Source/OCR: documents, page_jobs, page_derivatives, document_instances, extraction_schema_*, extraction_runs/records/features/coverage, case_extraction_heads → immutable document_versions, page_runs, canonical_observations, source_head, evidence_lineage.
- Calculation: case_calculation_runs/features/heads, case_recompute_jobs, case_data_change_events/state → source_revision, calc_runs, calc_features, stage_jobs, outbox; prohibit full-case updates from quiet timer.
- Legal & forms: case_legal_review_*, case_legal_conditions, case_document_field_values, case_legal_automation_*, case_automatic_document_runs, artifacts, analyses → legal_review_runs, condition_reviews, form_field_bindings, doc_runs, artifact_registry, human_approvals.
- Law/reference: legal_reference_*, legal_monitor_* → rule_releases, legal_observations, legal_change_proposals, release_approvals, impact_analysis.
- Staff & roles: case_tasks, app_role_grants → staff_users, assignments, task_events, review_receipts, immutable role audit.
- 신규: orgs/tenants, stage_runs, idempotency_keys, leases, outbox/inbox, sync_sheet_cursor, storage_objects, feedback_outcomes, rejection_features, prompt_bundle_releases, retrieval_acl, quality_evaluations.

DB 이식 시 SQLite json_extract, strftime, INSERT OR IGNORE, SQLite triggers/D1 batch, R2 bindings, Cloudflare env가 Postgres/worker API와 그대로 호환되지 않는다. 트랜잭션·검증 함수를 포트별로 바꾸고 source/version goldens를 비교한다. n8n 내부 Postgres DB와 사건 원장은 반드시 분리한다.

## I. Google Sheets 동기화 규약

원장: PostgreSQL (또는 이전 초기 D1 facade). Sheets는 운영 보조 투영.
- Case_Status: case_id, pseudonymous_label, owner_id, case_stage, source_version, calculation_status, legal_attention_count, draft_status, next_action_due, last_event_id, last_synced_at.
- Case_Tasks: task_id, case_id, status, severity, assigned_to, due_at, finding_id, review_url, source_version.
- Legal_Alerts: case_id, rule_id, applicability, blocking, state, owner_id, action_url.
- Release_Change_Proposals: proposal_id, rule/prompt/court/form type, pending_approval, candidate_git_sha, effect_scope.
- Execution_Health: job_id, case_id, stage, queue_age, retries, lease_expiry, failure_class.
- Rejection_Features: aggregate only; label/group and counts, avoid exact personally identifying strings.

DB transaction에서 domain row와 outbox row를 동시에 commit → Sheets writer가 event_id 순서로 bulk upsert → sync checkpoint 및 row id-map 기록. Sheets 429/403/offline은 exponential backoff+DLQ, 사건 실행은 완료값 그대로 유지하고 SYNC_DELAYED로 표기한다. 매일 diff reconcile(누락/중복/수기 변경 감지). 직원이 Sheets에서 고친 셀은 **proposed_change inbox** 로만 유입하고 권한·형식·expected_revision 검증 후 담당자가 승인해야 원장에 반영한다. 수치·법률판정은 Sheets로부터 직접 overwrite 금지. 개인정보 최소화·편집권한 제한.

## J. Google Shared Drive / NAS 스토리지 규약

동일 backend StorageAdapter로 provider를 교체할 수 있게 한다: putImmutable, getByVersion, verifySha256, stage, commit, list, revoke, deleteWithRetentionReview.
- document_manifest:{tenant_id,case_id,doc_id,doc_version,provider,provider_object_id,content_sha256,mime,size,classification,uploaded_by,uploaded_at,source_role,retention_policy,acl_scope,scan_status,original_or_generated}.
- 이름·파일경로로 사람을 검색하지 않고 uuid/sha로 조회. 저장은 원본(immutable)·OCR 파생본·생성 초안·사람 검토본을 각각 분리한다.
- 우선 후보 A: Google Workspace Shared Drive (조직 소유, 앱 OAuth/service 계정용 전용 공간, 사건별 ACL). 큰 문서는 resumable upload와 교차 provider file ID 점검 사용.
- 후보 B: NAS + HTTPS S3-compatible gateway/중계 서비스 (사내망/VPN). 인터넷에 SMB 공유를 직접 공개하지 않는다. NAS는 단일 디스크가 아닌 별도 오프사이트 백업/복구 리허설 필수.
- Cloudflare R2 legacy 자료는 마이그레이션 기간 동안 read-only bridge를 유지. Google Drive/NAS에 파일 올린 뒤 다운로드 hash가 일치하고 registry에 stable provider ID가 기록돼야 current head 전환.
- n8n queue mode에서 파일 시스템 binary mode를 공유 데이터 원장으로 사용하지 않는다. 큰 파일은 backend signed reference만 주고받는다. n8n 자체 외부 binary S3 storage는 요금제/배포 정책 확인 대상.

## K. Git/프롬프트/법령/서식 릴리스 및 운영 변경관리

Git main은 코드·계약의 개발 원본. 실제 실행은 release bundle SHA로 고정한다:
bundle={source_commit_sha,ocr_schema_sha,calculator_contract_sha,legal_rule_sha,court_form_sha,prompt_pack_sha,rejection_feature_pack_sha,model_policy_version,approved_by,effective_at,signature}.
- PR→CI contracts/fixtures→법률/업무 승인→manifest 서명→backend registry 업로드→n8n은 bundle ID만 받고 backend에서 유효한 지시문과 JSON Schema 주입.
- Git HTTP raw main을 매 AI 호출마다 읽는 것은 금지: 실행 도중 버전 뒤바뀜, 사설 repo 권한, rate/캐시, 추적성 문제. 최초 고정 번들은 검증된 sha로만 캐시.
- 기준정보 CRUD UI는 candidate draft, test preview, impact scope, human approval, deploy, rollback로 구분한다. DB hot edit가 기존 실행에 즉시 반영되지 않아야 한다.
- 공식 법령 변경 알림은 자동 개정 승인 불가. 관할·신청일·시행/경과규칙·form version을 검사한 affected case 목록에만 신규 재검토 job 등록.
- 프롬프트에는 raw secret와 고객 원문 전체를 넣지 말고 필요 사실/출처 ID만 선별. 법령 근거 없는 AI 문구는 승인된 기준으로 승격 불가.

## L. 반려·보정사유 개선 폐루프

데이터 구분: 제출 형식 반려 / 서류 보완명령 / 개시신청 기각 / 변제계획 불인가 / 채권자 이의 / 법원 보정 요구 / 내부 담당자 검토 반려는 서로 다른 outcome_type.
- feedback_outcome: case_id, stage, court_id, as_of, reason_raw_document_hash, outcome_type, cited_rule_id, missing_or_conflicting_field_ids, form_code/token, human_reviewed, reviewer, verified_at, disposition.
- rejection_feature: feature_group_id, trigger_cond, affected_procedures, evidence_requirements, adverse_outcome_type, related_rule_release, severity, samples_approved_count, sample_scope, provenance, excluded_confounds.
- 질적 평가: 법원 작성 문서·내용의 원문 추출 → 사용자/법률전문가 검수 → canonical 반려피처 매핑 → 군집 → holdout 케이스 성능 평가 → 승인된 feature_pack SHA 발행.
- 실행시 LawGraph에 전량 일괄 주입하지 않고 *사건 관할/시점/문서유형/조건과 일치하는 최소 묶음* 만 검색해 주입한다. 서류작성 엔진에는 검토 위험/원문 근거·필수 토큰 후보로 전달하되 미인정 값을 자동 확정하거나 변제액 계산을 변경하지 않는다.
- 사람 검토 전에 자동 학습/규칙 갱신 금지; 실증 결과가 없으면 feature는 candidate 상태. 누락 탐지율, 오탐률, 생성시간, 인간 수정량, 반려 유형별 재발률을 이전 bundle과 비교하고 정책 변경 회귀테스트 필수.
- case_id/tenant_id 격리된 벡터 ACL과 개인식별 제거. 다른 의뢰인 사건 원문을 그대로 모델에 재전달하지 않는다.

## M. 관측성·운영·보안

필수 trace key: trace_id,tenant_id,case_id,source_revision,stage_run_id,attempt_id,idempotency_key,rule_release_sha,prompt_sha,model,token_usage,calculation_run_id,legal_review_run_id,artifact_id,storage_provider_id,task_id. 원문·식별번호·API 키·채무 상세금액은 일반 로그에 기록하지 않는다.
운영 보드: 사건 단계/마지막 변경/10분 due_at, per-stage queue depth, 가장 오래 대기한 사건, stuck lease, 원본 누락, 법률 risk 미해결, 피처 mapping 누락, OCR/추출 비용, draft preflight blocker, Sheets lag, Drive/NAS 파일해시 검증, rule-change review backlog, SLA 초과.
보안: 고객 식별정보 별도 암호화 및 역할 제한, 직원 SSO/OIDC, case-level assignment/roles, tenant isolation, signed short-lived artifact links, 서비스 토큰 scope, 감사 이력, 원본 삭제·보존정책 승인은 별도. n8n execution data에 원문 PDF/민감 필드 저장 금지, 실패 node도 같은 원칙. 전체 스토리지·DB 백업과 복구·접근권한 침해 훈련 필수.
특히 n8n Error Trigger의 알림만 보고 완료 상태를 추정하지 않는다. 도메인 DB stage status와 artifact hash를 기준으로 reconciliation한다.

## N. 2026-11-02 주 테스트 이관과 배포 단계

| 일정 제안 | 인도물 | 통과 조건 / 중단 조건 |
|---|---|---|
| 11/02 월: Freeze & Golden | 현재 main commit 고정, 실제 운영과 분리된 staging DB+스토리지, 시나리오·샘플 계약, 0017/0018 SQL migration/CI | 현재 132개 테스트 실행+에러 보고, DB FK/trigger/checksum, 현행 baseline 확보 |
| 11/03 화: Backend Boundary | 기존 D1+R2를 기존 서버 뒤에서 보존하며 stage API/identity/outbox/lease façade 추가 | 같은 원문→기존·신규 경로 계산/서식 결과 SHA 차이 설명 가능 |
| 11/04 수: n8n Control Plane | 별도 n8n Main/Postgres/Redis/workers, WF00/02/04/05/06 및 WF10 skeleton 연결 | 최소 독립 3사건 병렬, 재시도·실패 격리·직원 알림 |
| 11/05 목: Doc/Workspace | WF07/08/11, 자동 검토본과 사람 검토연결, Sheets read-model, Drive/NAS staging adapter | 파일 byte hash, 접근권한, 시트 누락/지연 복구, 데이터 변경 시 초안 무효화 |
| 11/06 금: Fault Injection | 시나리오 전수, AI 429/timeout, storage partial, 법령 변경, 50건 병렬 부하, replay/rollback | P0 0건, P1 blocker 0건, 중복 산출/교차사건 유출 0, 법률 자동승인 0 |
| 이후 별도 컷오버 | PostgreSQL case source-of-truth + 실사용 운영확대 | 기존 D1↔PG 검증합격, 정책판본·콘텐츠/권한 매핑, 롤백 및 사람 승인 |

위 일정은 이관 계획이지 이번 대화에서 n8n·운영 DB를 배포한 것이 아니다. D1→PostgreSQL 53개 테이블 완전 전환과 NAS 운영 보안승인을 한 주에 억지로 완료하지 말고, 먼저 API 호환층으로 단일 업무 경로를 검증한 다음 DB 컷오버를 분리한다.

## O. 필수 최종 수용기준

- source change 뒤 10분 내 추가 변경은 작업을 새 버전으로 밀고, 10분 경과 후에만 계산. 업무 메모/담당자 변경은 이 타이머에 영향 없어야 한다.
- 두 개 이상 독립 사건을 병렬 처리해도 원문·출처·모델 컨텍스트·storage path·task·Sheet row 교차 0건.
- 85종 모든 서류 라우팅/693 canonical 계약의 타입·관할·대상·기간 일치 검증; 646 source-only 피처는 '미연결'로 명시하고 계산에 추측 주입 금지.
- 95 법률항목의 필수 피처/적용조건이 현재 불명확한 88건은 법적 적합 자동 완료 처리 금지. 전문가 승인 전 누락상태를 남긴다.
- 같은 case/revision+release에서 중복 모델 호출·파일 중복 생성 방지, worker 장애 이후 재개 가능. 오래된 failed case가 뒤 사건을 무기한 막지 않아야 한다.
- 실제 자동 검토용 초안의 R2/Drive/NAS 해시 검증→담당자 화면→서식 field-level diff→사람 승인 영수증까지 end-to-end 통과. 전자소송 공식 화면 동일성은 별도 인증 대상.
- Google Sheets 동기화 장애는 사건 처리를 멈추지 않고 lag/error 표시; Sheet에서 직접 법률 승인·계산 변경 불가.
- 법령/프롬프트/반려피처 릴리스 교체 시 영향 사건만 재평가하고 모든 과거 실행은 원래 SHA로 재현 가능.
- CI의 실제 실행 로그, DB migration 영수증, storage verification, Model API 응답 기반 staging E2E, UI smoke/권한 테스트가 남아야 '운영 준비 완료'로 선언할 수 있다.

## P. 검증에 사용한 주요 원본

GitHub: ax-site/lib/case-legal-automation.ts, case-agent-scheduler.ts, case-data-recompute.ts, case-feature-snapshot.ts, pipeline.ts, case-lawgraph-store.ts, automatic-review-draft.ts, document-writer.ts, intake-store.ts, case-requirement-monitor.ts, case-workflow-view.ts, worker/index.ts, drizzle/0010/0017/0018, db/schema.ts, n8n-reference/NODE_MAP.md, tests/case-legal-automation-flow.test.ts, docs/feature-lineage-audit-v45.md.
n8n 공식: https://docs.n8n.io/hosting/scaling/queue-mode/ ; https://docs.n8n.io/hosting/scaling/concurrency-control/ ; https://docs.n8n.io/hosting/scaling/external-storage/ ; https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/ ; https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googledrive/ ; https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executeworkflow/
Google 공식: https://developers.google.com/workspace/sheets/api/limits ; https://developers.google.com/workspace/drive/api/guides/about-shareddrives ; https://developers.google.com/workspace/drive/api/guides/manage-uploads

검증 주의: n8n queue mode + fs binary storage 비지원; n8n 외부 S3 binary storage는 self-hosted Business/Enterprise 요건이 있으며, 이를 사건 문서 보관에 필수로 삼지 말고 backend storage adapter로 우회한다.
