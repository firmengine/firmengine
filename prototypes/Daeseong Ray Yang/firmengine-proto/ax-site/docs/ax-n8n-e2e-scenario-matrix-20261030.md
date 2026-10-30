# FirmEngine AX 실행 시나리오·에이전트 핸드오프·예외·수용시험 매트릭스
작성: 2026-10-30 / 설계 기준: main c0f244b7 / 이 문서의 모든 시나리오는 **시험 정의**이며 실환경 실행 완료 증명이 아니다.
목적: 다음 주 n8n/백엔드/DB/직원 UI/Google Workspace 연동 이동에서 기존 기능 간 충돌과 재실행 오류를 발견한다. 개인정보를 포함하지 않는 합성 사건으로 시험한다.
상위 설계: docs/ax-n8n-refactor-blueprint-20261030.md

> 이 매트릭스는 **n8n으로 이동할 때의 장래 인수시험 정의**다. F01/F02/F03/F04의 사이트 내 코드 수정이 완료됐다고 해당 n8n 스테이지가 구현된 것은 아니다. 최신 미해결 목록은 [교차 감사](current-unresolved-and-synthetic-audit-20261030.md)를 참조한다.

## 1. 실행 이벤트 계약

모든 도메인 실행은 (tenant_id, case_id, case_source_revision, stage, approved_bundle_sha, idempotency_key) 단위로 격리한다.
- stage 시작: n8n WF00 → backend job.claim. 기존 완료 receipt가 있으면 기존 결과만 돌려주고 모델 재호출 금지.
- stage 종료: backend result 저장 → current source/version+lease 확인 → CAS active head 승격 → outbox event → n8n 다음 워크플로 signal.
- stage 실패: permanent/input-blocked/transient/superseded/needs-human으로 분류. transient만 exponential retry. 법률 승인이 필요한 예외는 재시도로 자동 해소되지 않는다.
- 장애 발생 후: n8n 실행 로그가 아니라 DB stage_run/result_hash/lease가 진실. n8n 재전달은 정상적인 at-least-once 이벤트로 취급한다.
- 모든 외부 connector: backend idempotency + outbox/inbox; Google Sheets는 도메인 원장이 아니다.
- 신뢰 불가 원문: OCR text, 상담, 반려사유, 이메일 및 외부 웹페이지는 모두 데이터이고, 그 안의 명령을 tool 호출로 승격하지 않는다.

## 2. 성공 E2E 시퀀스 정의

### N01 급여소득자 신규 사건
트리거: 직원이 사건 생성→상담 1건 입력→근로소득자 분류→급여명세/계좌/채권 증빙 업로드.
에이전트 호출: WF01 상담 AI→서류 요구/field plan→WF02 문서 분류→WF03 OCR/독립검증→WF04 원천대조/10분 quiet→WF05 BigInt 소득/채무/재산 계산→WF06 95개 중 적용되는 법률검토→WF07 D5100/D5103/D5106/D5110 등 실제 조건별 서식 초안→WF08 담당자.
시험 어설션: 월별 급여 원문 각각 별도 row; 출처 ID·금액 단위·period 일치. 한 달 aggregate가 아닌 현재 월평균 산식. 누락/상충은 수치가 아닌 blocker. 자동 법률 승인/접수 없음.

### N02 자영업자 실질 소득 계산
트리거: 사업자상담 + 월별 매출·매입·영업경비·부가세·종합소득자료.
핸드오프: 상담 AI→복수 서류 계획→OCR extractor / 소득 period normalization→법적 계산(매출/비용/순액 구분)→LawGraph 사업소득·생계비 검토→서식 준비.
어설션: 부가세 매출을 순소득으로 사용 금지. 12개월 aggregate를 '1개월 소득 행'으로 잘못 넣지 않음. 검증된 기간이 비면 BLOCKED_INPUT 및 보완요청.

### N03 채권자 다수·담보·이자
트리거: 채무증명 여러 건, 담보/양도·원리금 분리.
핸드오프: OCR→채권자/계약 ID matching→계산(원금,이자,담보별)→LawGraph 실무예외→채권자목록 반복행→Staff reviewer.
어설션: 동일 채권 중복·양도채권을 별개 합산 금지. 원금/이자/기준일과 채권자·담보 대상 동일. 보정명령 가능성은 인간 검토로 표시.

### N04 자산·보험·보증금·퇴직급여
핸드오프: OCR 자산 내역→ownership/법적 제외·담보 scope 조건→청산가치 BigInt→법령 요건/현재가치 대조→재산목록·변제계획 검토본.
어설션: 지분율/담보상환 범위·기준일·제외 근거 미확정이면 청산가치 확정 불가.

### N05 적합한 갈음서류
트리거: 원본 요청 문서 대신 승인된 대체증빙.
핸드오프: WF01 원본 요구 유지→WF02/03 대체서류 출처·기간·대상 확인→갈음 검토 후보→직원 승인 receipt→WF04 필수 field coverage 업데이트.
어설션: 원본 요청은 자동 삭제하지 않음. 현재 관할·서식 기준·증빙 hash/version 재검토 후에만 상태 전이.

### N06 추가 상담 후 새 서류
트리거: 직원이 새로운 사실을 상담노트에 추가, 기존 상담 분석 판본은 대기.
핸드오프: consultation change→상담 재분류→필요서류 추가→OCR 계획 갱신→downstream dependency invalidation.
어설션: 단순히 이전 법률 AI 95개 결과로 '서류 충분' 처리 금지. 활성 상담 판본과 case requirement ID 교차 매핑 검증.

### N07 큰 이상 없는 사건의 검토용 자동초안
트리거: SourceReady+Quiet+CalculatorCurrent+legal review completed+필수 자료 충족.
핸드오프: WF07 form preflight→writer→storage checksum→artifact index→WF08 사람 검토 task.
어설션: 동일 사건·출력판본에서 artifact 중복 0. R2/Drive/NAS 실제 바이트 SHA와 DB registry 일치. staff UI에서 링크 열기, 필드별 출처대조, 수정/반려/승인 이력이 가능. 결론은 DRAFT_READY, 법원 인가 아님.
현행 코드 위험: 자동 draft는 case exportManifest/ReviewActions 기존 연결 밖이며 성공 경로 통합 테스트가 없음.

### N08 직원 검토·수정 후 재생성
트리거: 변호사가 월변제액 산식근거 미확정 또는 서류 문안 누락을 지적.
핸드오프: reviewer→원천 fact/case command 변경 또는 오버레이(prose/layout 전용)→계산 영향 판정→필요 stage만 재실행→새 draft artifact.
어설션: 이전 바이트·영수증 보존, 이전 검토는 재적용 전 fingerprint 확인. AI가 금액을 문서 편집값으로 임의 변경 금지.

## 3. 오류/예외 주입 및 회복 매트릭스

| ID | 입력 / 실패 주입 | 관련 에이전트 / 현재 위험 | 목표 처리 및 회복 결과 | 수용시험 |
|---|---|---|---|---|
| E01 | OCR 원문 흐림·가림 | Extractor→Verifier→Document Task | illegible/masked 분리, 추측값 계산 제외, 해당 페이지 재판독/사람 확인 | 원문 quote/bbox 필수, missing!=0 |
| E02 | 항목 누락·표 일부 미인식 | Extractor→Coverage | not_seen/blank/explicit_none 각각 저장, incomplete면 계산 출처 보류 | 85종 field contract 대비 누락 가시화 |
| E03 | 문서유형 family 상충 | Classifier→Extractor | 원문·분류 영수증 보존, 다른 family typed 매핑 금지 | 잘못된 부채→자산 피처 이동 0 |
| E04 | 계약 ID/채권자 동일성 불명 | Source Reconciler→Calculator | merge 보류, 중복 합산 보류, review task | 합산 보존 불변식 |
| E05 | 매출만 있고 영업 경비가 없음 | Income Calculator→LawGraph | net income missing; 매출=소득 치환 금지 | 결손이 '0' 또는 'computed' 아님 |
| E06 | 원본 서류 미제출/기간 불충분 | Intake plan→RequirementMonitor→LawGraph | 필요한 서류/대상/기간 요청 task, AI 전 preflight hold | 모든 관련 요구 누락 차단 |
| E07 | 갈음 확인 후 원본/법원 기준 변경 | Substitution→RequirementMonitor | 현재 증명 fingerprint 불일치 시 restored | 이전 approved substitute 자동인정 금지 |
| E08 | 10분 중 추가 OCR·상담 수정 | Watch→Scheduler | due_at 마지막 source event 기준 10분 재설정 | 마지막 599999ms 시점에 calc 미실행 |
| E09 | 직원 task 담당자만 변경 | Staff→DB→Watch | workflow 변경만으로 source quiet 재시작 없음 | 0021 및 변경분류 코드 반영됨; staging D1·R2·사람검수 통합시험 미인증 |
| E10 | 상담이 이미 미분석 상태에서 새 note 추가 | Intake→Source Watch | consultation_revision은 이벤트화, intake reanalysis pending | 0019 `consultation_changed` 구현 확인; 재분류 자동배치/운영 실행은 별도 |
| E11 | 계산 요청 중 원천 버전 변경 | Calc→DB CAS | 결과 이력 보존, active calc head 승격 금지, superseded | 새 source revision만 current |
| E12 | AI 검토 5/16 배치 중 원천 변경 | LawGraph→Orchestrator | 현재 체크 버리거나 이력화, 신규 bundle/원천으로 재시작 | 과거 판본의 check 현재 판단 사용 0 |
| E13 | AI가 동일 체크 ID 중복·누락 응답 | LawGraph response validator | exact ID coverage 차단, partial 보존 | 95 unique ID, 6/check batch |
| E14 | AI 429·503·65초 초과 | Model Connector→Job Engine | stage-level retry/backoff/jitter, 완료 batch 보존, DLQ | 모델 중복 과금/응답 오염 제한 |
| E15 | Worker 재시작·lease 만료 | n8n/Backend queue | heartbeat/fencing 기반 reclaim, 오래된 worker commit 차단 | 동일 stage active result 1개 |
| E16 | 두 worker 동시 claim | Job Engine/PG | unique key + atomic claim; 일단 최소 1개만 실행 | model calls per exact job <=1 정상시 |
| E17 | 50개 사건의 이벤트 동시 유입 | Dispatcher/Scheduler | per-case 독립 큐·fair scheduling. 한 failed case가 다른 사건을 굶기지 않음 | staging 50 case backlog starvation 0 |
| E18 | 계산값 null/blocked/provisional | Calculator→LawGraph→Writer | 초기 preflight에서 상태별 판단: null/blocked는 자동작성 차단, provisional은 담당자 검토 표시 | 필수 산식 수치 없는 초안 자동 생성 0 |
| E19 | 계산 head와 문서 derived_evaluation 서로 다른 판본 | Calc→Document Writer | source+calc_run_id+form binding sha 일치 전 render 금지 | typed 계산/서식 금액이 동일 |
| E20 | 법원 준칙 변경 알림: 다른 관할에만 해당 | Monitor→LawGraph | jurisdiction/effective/form scope 불일치 시 해당 사건 영향 없음 | 현행 글로벌 alert count blocker 개선 |
| E21 | 유효한 준칙/서식 실제 변경 | Monitor→Rule Publisher→Orchestrator | 공식 근거/효력일·인간 승인 후 새로운 release, 대상 사건만 영향 분석 | 검색 실패는 개정 없음 아님 |
| E22 | LawGraph 체크 'legal_review' 95개 | Legal Agent→Form Preflight | 담당자 판단을 요구하며 검토용 초안과 최종 인정 분리 | AI 승인/법원 인가 0 |
| E23 | LawGraph 위험 88개에 필수 피처 계약 없음 | Legal feature checker | '검토 수행'과 '법적 충분' 분리, unresolved contract 자동승격 금지 | 88개 risk contract gap 계측 |
| E24 | 양식 토큰과 OCR canonical ID 불일치 | Feature Lineage→Writer | origin/source formula/token 대조 오류, 해당 field blocked | 최초 피처와 최종 금액 trace 일치 |
| E25 | R2/Drive/NAS 파일 일부만 업로드됨 | Storage→Doc Engine | staged object cleanup+idempotent restore/reconcile; current head 미승격 | partial artifact DB/R2 leak 0 |
| E26 | 저장 완료 직후 API 응답 유실 | Document Generator | 같은 job_id로 GET receipt 후 기존 파일 재사용, 새 임의 UUID 재업로드 금지 | artifact 중복 0 |
| E27 | 생성 직후 원천 수정 | Writer→Staff UI | 문서 이전 판본 stale 표시/다운로드 접근 정책 재검토 | 최종 검토 화면 최신 draft 아님 |
| E28 | 사람이 문안을 승인 후 새 근거 입력 | ReviewGate→Recalc | 사람 receipt dependency 재확인; 불일치 시 승인 상태 자동 무효화·재검토 | 종전 승인 silently carryover 0 |
| E29 | Google Sheets API 429/latency | WF11→Sync outbox | bulk upsert, backoff, lag 표시; 법적 계산은 정상 | Sheet delay는 domain success와 분리 |
| E30 | Sheets 셀 직접 수기 변경 | Sync inbox→Backend | 승인된 필드만 proposed_change; 원본 fact 직접 덮기 금지 | case source hash 불변 |
| E31 | Google Workspace Drive 403/권한 철회 | Storage Adapter→Staff Ops | 권한 incident·regrant 요청, 파일 삭제로 오인 금지 | inaccessible ≠ absent |
| E32 | NAS VPN/네트워크 단절 | Storage Adapter→Worker | storage pending/retry, 큐 backlog, raw URL 노출 금지 | backend restore 후 checksum |
| E33 | 다른 사건 X의 fact를 사건 Y에서 조회 시도 | Auth/MCP→Database | tenant/case ABAC/RLS deny, 로그는 비식별 | cross-case source retrieval 0 |
| E34 | n8n webhook 중복 발송 | Dispatcher→Job | event_id/idempotency conflict 기존 receipt 반환 | source write, AI call, artifact 1회 |
| E35 | n8n 노드 성공, DB active head 저장은 실패 | Stage Executor→Orchestrator | success로 간주 금지; commit receipt 검증 후 다음 단계 | false completion 0 |
| E36 | 규칙 Git main 변경 중 사건 AI 실행 중 | Release Registry→LawGraph | 시작 시 approved SHA 고정; 새 commit은 다음 job만 | mixed prompt/rules release 0 |
| E37 | 직원이 법령 기준 CRUD 후보 수정 | Staff→Rule Publisher | candidate→diff/eval→professional approval→publish→impact | 미승인 rule 즉시 적용 0 |
| E38 | 오래된 normalized OCR head 없는 legacy case | Source Snapshot→Calc | fallback warning을 BLOCKED_LEGACY 또는 법률검토로 승격, 자동확정 금지 | legacy 자료의 암묵적 source verified 0 |
| E39 | D1→PostgreSQL SQL 의미 차이 | Migration Validator | 53 테이블 데이터·FK/트리거/NULL/정렬/계산 golden 비교, 차이 격리 | 차이 미승인 때 컷오버 금지 |
| E40 | 보정명령/반려 문서에 prompt injection 존재 | Feedback Extractor→Knowledge Registry | 문서를 데이터로 취급, tool 실행/시스템 지시 변경 금지 | 비정상 외부 명령 실행 0 |
| E41 | 잘못된 반려피처를 모델이 학습 제안 | Feedback Agent→Reviewer | candidate-only + 법률전문가 label + holdout + bundle 승인 | 미검증 피처 auto inject 0 |
| E42 | 원본·초안 파일 삭제/보존기간 만료 | Storage Governance | 권한·보존정책·사건 보존 단계 검토 후 감사 영수증, 백업 | 임의 삭제·증거 손실 0 |
| E43 | 공식 서식 버전이 바뀜 | Rule/Form Registry→Writer | 관할·시행일별 form SHA 확인, 이전 양식은 재작성 대상 | 전자양식 적합성 자동 인가 아님 |
| E44 | 30개 담당자 동시 로그인/사건 열람 | UI/BFF/Auth→Backend | read-side 캐시·rate·ACL, 모델 재실행 없음 | GET으로 API 토큰 비용 발생 0 |
| E45 | n8n 자체 DB 또는 Redis 장애 | n8n/Backend queue | domain outbox 미전송 이벤트 유지, 복구 후 재전송, 사건 상태 훼손 금지 | 이벤트 유실 0, 재발송 중복 0 |
| E46 | 테스트용 합성 원본의 실제 제출 시도 | Test Fixture Guard→Export | synthetic fixture는 final/filing 금지, staging 외 접근 격리 | 합성→실제 제출 변환 0 |

## 4. 단계별 API 경계 및 후속 에이전트 대기 조건

| Stage | 필요한 정확한 입력 | 단계 결과 | 다음 단계 허용 조건 |
|---|---|---|---|
| INTAKE | consultation_rev,rule+catalog sha,case_id | claims+source spans,requirement plans | 분류 근거와 사건·상담판본 유효 |
| CLASSIFY | artifact_id/content sha,page role,doc catalog | document_type candidate,confidence | 확정/검토로 분기; 불확실 family를 typed 금지 |
| OCR_EXTRACT | artifact id,page,OCR schema sha | row+cell+value/unit/quote/bbox/source_state | source checksum+scope/shape pass |
| VERIFY | independent read/verifier receipt | observed/verified/missing/conflicting | 각 중요 항목 원문 신뢰 상태 부여 |
| SOURCE_RECONCILE | accepted facts,subject IDs,time periods | immutable source_snapshot,dependency hash | case data version stable, no unresolved P0 |
| DEBOUNCE | source event timestamp + source_rev | due_at,eligible bool | source idle>=10min AND no active incomplete OCR |
| CALCULATE | source_snapshot, legal bundle sha, calculator version | amounts,formulas,inputs,trace,issues | exact deterministic outputs+recorded source heads |
| LAWGRAPH | calc_run, facts ids, court/effective, 95-contract applicable list, approved rejection pack | checks, evidence, rule_ids,missing,next_action | all expected checks completed, no invented rule |
| DOCUMENT_PREFLIGHT | form_sha,calc_run,legal_findings,required fields | per-token blockers,status | no critical missing & output mode review |
| RENDER | exact form payload + output bundle | DOCX/PDF/HTML, sha,artifact id | checksum+R2/Drive/NAS registry commit |
| HUMAN_REVIEW | artifact id/version,reviewer id,case assignment | accepted/rejected/new-source-required | explicit human receipt & unchanged dependency |
| FILE_PROCEDURE | externally confirmed court case number,filing receipt | legal procedure event | AI cannot initiate or infer |
| SHEETS_SYNC | outbox event+last cursor | upsert receipt+row map | doesn't change source or legal approval |
| FEEDBACK | court order hash,verified label,feature IDs | candidate rejection group+evidence | release approval before retrieval injected |

## 5. 에이전트 간 데이터 계약 위반의 대표 사례

### 계산 입력의 의미를 바꿔버리는 피처 이름
서류 OCR이 money 값 net_pay=2,000,000(KRW)를 기록했더라도 해당 항목이 어느 채무자의, 어느 월, 어떤 지급처에 대한 값인지 식별되지 않으면 income.net으로 확정하면 안 된다. OCR의 sourceState=present와 법률 계산의 recognized flag는 서로 다르다. 출처 ID, 금액 단위, subject identity, temporal coverage, 계약변환 sha를 검사해 산식 입력으로 전달한다.

### 변제계획 서식 합계와 법률 판단의 혼합
계산 엔진 산식 trace가 존재해야 D5110의 월변제금/기간/명목합계를 기재한다. LawGraph AI의 자연어 '충분할 것'이라는 판단으로 수치를 수정하지 않는다. 본문 표현·서류 누락 경고만 별도 proposed edit 상태로 주고 서식 필드 계약이 확인된 뒤 사람 검토를 받는다.

### 반려사유 검색 결과가 현재 법령으로 승격되는 문제
이전 사건의 반려사유는 참고 precedent/rejection feature이며 **법령 자체가 아니다**. 적용 법원·발생일·사실관계·증빙 유형·신청일을 동시 필터링하고 관련성 및 법률 전문가 확인이 없으면 법률상 요건으로 표시하지 않는다.

### 정정 후 조용한 기간이 끝나지 않는 문제
자료 업로드/서류 검증/사건 사실 갱신은 source_revision을 바꾸지만 단순 담당자 배정/모니터 읽기/법률 AI 분석 결과 저장/시트 동기화는 바꾸지 않는다. 현재 cases.revision으로 모든 것을 감지하는 구조는 이 경계가 없으므로 최우선 수정 대상이다.

## 6. 실험별 장부/오라클 (합성 사례로만 수행)

- expected_facts.json: 사건별 원문 fact, canonical IDs, source hashes, period, subject, recognition status; 개인식별값 가상.
- expected_calculation.json: 금액의 BigInt string, 산식, trace inputs, missing blockers, 양식 배분.
- expected_legal.json: 적용 관할/시점/rule IDs, expected candidate statuses, 인간판단 잔여항목.
- expected_documents.json: form tokens, lineages, 반복행, null/zero 정책, output artifact checksum.
- expected_operations.json: event count, stage status sequence, retry counts, per-case isolation, task/SLA, Sheets/Drive sync lag.
- 버전 고정: source_sha, rule_sha, prompt_sha, model policy, schema_sha, test bundle SHA를 테스트 시작 전 manifest에 남긴다.
- 범위: 인과적 정상 8개, 예외·운영 46개. 최소 3 사건 병렬과 50 사건 스트레스(단순 load가 아닌 케이스별 결과 격리 비교), 1회 Cron/worker kill, 1회 Google Sheets/Drive/NAS API fault injection, 1회 데이터 변경 중 승인 race.
- 실행 이력: TestRun ID → Case ID → StageRun ID → 예상과 실제 diff → 실패한 field/form/agent → 수정 commit → 재시험 trace를 남긴다.
- 재시험 정책: 기준·스키마·프롬프트 변경 시 예상값을 몰래 수정하지 않고 독립 검토한 신규 golden revision으로만 승격한다.

## 7. 배포 게이트 및 우선 순위

P0 (기본 실행):
source/workflow/legal decision version 분리, consultation event 누락 수정, due-case fairness, lease/at-least-once, source preflight, calc/AI/form exact binding, 직원 검토 자동초안 연결, 케이스 ACL.

P1 (다음주 staging 운영):
Google Sheets outbox, Shared Drive/NAS adapter, 실패 task+SLA, case-level metrics, 법령 모니터 scope, config release pinning, parallel 50 cases, retry and DLQ.

P2 (검증 후 지식개선):
반려 피처 taxonomy, human labeled pack, 지식그래프 retrieval, cross-validation, A/B and rollback, court/provider 관할별 버전 영향 분석, full official form parity 확인.

합격 선언 금지 조건: GitHub code push만 된 상태, tests 파일만 존재한 상태, 사이트 UI에서 '완료'만 뜨는 상태, Google Sheets row만 업데이트된 상태, AI가 '법적 문제 없음'이라고 답한 상태는 이 E2E 시험의 합격 근거가 아니다. 최소 3개 실제 스테이징 합성 사건에서 DB receipt+파일 SHA+사람 검토 대기까지 이어졌다는 관측 로그가 있어야 한다.
