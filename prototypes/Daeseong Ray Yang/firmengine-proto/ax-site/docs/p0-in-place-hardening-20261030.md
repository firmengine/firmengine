# AX 현재 구조 P0 단계별 보완 및 인수 체크 (2026-10-30)

> 아래는 당시 수정·검증 이력이다. 추가 반영된 F01/0021과 남은 충돌은 [현재 활성 인수표](current-unresolved-and-synthetic-audit-20261030.md)를 우선한다.
원본: GitHub firmengine/firmengine main `ax-site`. **별도 브랜치 없음. 운영 D1/R2/Cron 배포 또는 전체 E2E 합격을 의미하지 않음.**

## 1. 지금 반영한 격리된 세 가지 결함

| 영역 | 기존 실패 경로 | 현재 수정 | 검사와 잔여 |
|---|---|---|---|
| P0-F02 상담 변경 무감지 | 활성 상담 실행이 없으면 consultation_heads.active_run_id=NULL인 상태에서 상담 revision만 증가해 기존 SQL trigger가 동작하지 않음 | 0019 SQL에서 consultation_heads.revision 변화 시 `consultation_changed` 이벤트 생성; 활성/비활성 이벤트 분리 및 중복 버전 증가 방지 | 합성 SQLite 변경/활성화/롤백 검사. 상담 AI 자동 재분류는 아직 별도 작업/인간 실행 경계에 있음 |
| P0-F03 다중사건 대기열 기아 | limit=1 Cron에서 아직 10분이 안 지난 이른 사건 또는 계속 실패하는 사건이 뒤 사건의 계산을 가로막음 | 0020 SQL + `case-data-recompute`: 마감 시각 이전 행 DB 검색 단계 제외, 사건별 180s lease·원천버전/법령판본 key·최대5회 백오프/실패 격리, 같은 버전 중복 claim 차단 | SQLite 원자적 claim·cooldown·새 source version 재시작 검사. 원격 Cron/D1 실제 동시성 시험 필요 |
| P0-F04 미완료 증거로 법률 AI 과금/오판 | 계산 head만 있으면 진행 중인 OCR, 누락된 정규화 source head, 구 상담 run이어도 95항목 법률 AI가 시작될 수 있음 | `case-legal-source-preflight` + `case-legal-automation`: 현재 상담 완료 판본·업무 적용run, 증거 페이지 완료·정규화 head·legacy fallback 검증. OCR 미완료는 `waiting_evidence`로 120s 후 재검토, 근거 신뢰 불가면 `review_required`와 구체적 blocker. 모델 호출/서류작성 금지 | 507개 source-based pure 판단 조합 검사 및 자동화 회복 회귀테스트 작성. 실제 85종 OCR/DB 테스트 미실행 |

보완 운영 API: `GET /api/cases/:id/calculation-poll/retry`(현황), `POST .../retry`(`expectedDataVersion`, `reason`). 사건 담당자 역할 필수, 같은 source version에서 failed 상태만 재시도; 원본과 quiet window는 변경하지 않음.

## 2. 의존성과 실행 단위

```
상담 메모 (consultation_heads.revision) ─┐
원본/문서/OCR/필드 정규화 ──────────────┤
                                        ▼
                case_data_change_state (version + changed_at)
                                        │
                    <=600초: 실행대상 쿼리에서 제외
                                        │
                 case_calculation_poll_jobs (원천버전별 lease)
                                        │
                       BigInt calculator / source snapshot
                                        │
                   current case_calculation_heads
                                        │
           sourceReadiness (상담/OCR/현재 head/legacy 확인)
                  ├─ 대기: waiting_evidence (재확인)
                  ├─ 차단: review_required (직원에게 원인)
                  └─ 통과
                        │
              LawGraph 95 checks × 6-item batch
                        │
              evidence/rule/field/calculation gates
                        │
              검토용 초안 → 직원/변호사 최종 검토
```

중요: `case_calculation_poll_jobs`는 기존 `case_recompute_jobs`(derived evaluation)와 역할이 다르다. 둘을 통합하거나 기존 업무판본 기반 계산을 새 테이블이 승인하도록 해석하지 않는다.

## 3. 다른 실행 중인 P0 영역과 충돌 방지

- **P0-02~08** 작업은 `docs/production-p0-plan-20261030.md`와 GitHub #3~#9에서 추적 중. 이미 다르게 수정 중인 `assessment.ts`, `extraction.ts`, `feature-lineage-audit.ts`, `lawgraph-document-field-projection.ts`는 이 변경에서 덮어쓰지 않았다.
- **P0 교차 차단 #10 (F01) — 후속 코드 반영**: `case-mutation-classifier.ts`·`server-store.ts`·`case-commands.ts`와 **0021** SQL이 승인·문안·산출물 전용 변경을 원천 변경에서 구분한다. 이 항목을 미구현으로 계속 기록하지 않는다. **잔여 인수**는 0021 staging 적용, 진짜 원문 변경은 반드시 감시되고 직원/변호사 검토만으로 계산·LawGraph head가 무효화되지 않는 실제 E2E다.
- **F07 자동초안/직원 검토 연결**: 자동 초안 artifact는 별도 derived 테이블에 있고 기존 exportManifest/CaseReviewActions와 완전한 편집·승인 계약이 달라 추가 연결 필요. 법률/문서 작업자와 공통 계약 확정 전 메인 writer를 중복 구현하지 않는다.
- 상담 AI 자체의 **자동 재분류 작업자**는 이번 SQL 감시와 별개. 저장된 새 상담이 분석/요건 편입 전이면 법률 재판단 사전검증에서 차단된다.
- 갈음서류 watcher 자체의 실패 횟수/공정성은 별도 검증 필요; 계산 큐 개선이 곧 갈음 watcher 개선은 아니다.

## 4. 현재 추가된 검사 / 실행 증빙 범위

- `tests/consultation-revision-watch.test.ts`: null 활성run 상담 수정, run 전환, deactivation, rollback.
- `tests/case-calculation-poll-fairness.test.ts`: not-due skip, 실패 case 공정 스케줄, 최대5회, 새 source version 재개, 2개 worker 동시 claim, 역할별 재시도.
- `tests/case-legal-source-preflight.test.ts`: legacy/누락 페이지/처리중/상담 구버전/정상 진입.
- `tests/case-legal-automation-flow.test.ts`: 처리중 증거로 모델 호출 0회, 완료 후 재개, 신뢰불가 원천으로 영구 차단.
- 이 대화에서 별도 Python SQLite로 SQL trigger / queue lease, CAS, 실패후 재시도 규칙을 실행하여 성공 조건을 확인했고, 현재 저장소에서 추출한 source-preflight 함수 본문으로 정상/예외 507조합을 확인했다.
- **미실행**: 저장소 `npm ci`, 전체 TypeScript 빌드, 모든 Node 테스트, 실제 D1 migration, 실제 모델 API·R2/Drive·n8n, UI/법원서식 자동작성 E2E. 실행환경 제약 때문에 성공으로 주장하지 않는다.

## 5. 운영 반영 전 필수 순서

1. `drizzle/0017`, `0018` 기존, 그리고 신규 `0019_consultation_revision_watch.sql` → `0020_calculation_poll_fairness.sql` → `0021_workflow_only_source_watch.sql` 순으로 **staging** D1에 적용. 운영은 해당 스키마 대응 코드와 배포가 원자적으로 진행될 때만.
2. `npm ci` → `npm run check:source` → lint/build → `node --experimental-strip-types --test tests/consultation-revision-watch.test.ts tests/case-calculation-poll-fairness.test.ts tests/case-legal-source-preflight.test.ts tests/case-legal-automation-flow.test.ts`.
3. 합성 사건 최소 3건: (A) 자료 완결, (B) OCR 처리중, (C) 원본/상담 수정 경합. Cron 1분/quiet 10분/AI 6개 batch/에러 복구/서류 human gate를 통합 확인.
4. 실패·중복·리트라이·권한을 포함한 실제 D1/R2 Cron 테스트 결과와 전후 migration 데이터 검증 영수증을 확보한다.
5. P0 #10의 0021 **운영 적용과 동시 승인/문서검수 E2E**를 수행한다. 코드 반영과 운영 승인을 구별한다.

이 문서는 기능 구현 완료와 **운영 품질 인증**을 구분하기 위한 작업 인계 기록이다.
