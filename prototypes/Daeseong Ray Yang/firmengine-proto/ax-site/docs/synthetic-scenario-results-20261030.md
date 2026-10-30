# FirmEngine AX 가상 시나리오 검증 영수증 (2026-10-30)

**목적:** 여러 에이전트의 동시 수정으로 생길 수 있는 기능/판본/서식/법원별 충돌을 실제 사용자 정보 없이 재현. 46개 사례 각각에 대해 **예상한 코드 동작과 관측이 일치**했다. 안전한 동작뿐 아니라 **결함이 재현된 결과도 포함**되므로 통과율·법률 정확도 100%로 읽지 않는다.

**실행 방식:** GitHub main의 순수 함수 본문(`case-legal-source-preflight`, `final-lawgraph-readiness`, `case-lawgraph-store`, `case-mutation-classifier`, `case-workflow-view`의 특정 분기)을 읽고 TypeScript 타입만 제거한 뒤 V8에서 가상 객체로 실행. SQL은 원본 `0010/0018/0019/0021`의 관련 트리거·계산 Poll SELECT·법령알림 COUNT 조건을 SQLite 임시 메모리 DB에서 재현. 실 D1/R2/Cloudflare/API/LLM/Word 렌더/법원 제출/CI 전체 테스트는 실행하지 않았다.

## 1. OCR·상담 준비도 및 LawGraph 최종게이트 (T01–T13, 13건)
| ID | 가상 상황 | 실제 관측 | 판정 |
|---|---|---|---|
| T01 | 현행 증빙 페이지와 정규화 head, 상담 모두 일치 | `ready` | 기대 동작 |
| T02 | 증빙 OCR 미완료, 정규화 페이지 없음 | `waiting_evidence` + 페이지 처리/원문 head 차단 | 기대 동작 |
| T03 | OCR 완료했으나 특정 페이지 head 없음 | `review_required` + `CURRENT_EVIDENCE_PAGE_HEAD_MISSING` | 기대 동작 |
| T04 | 상담 수정 뒤 재분석 미완료 | `CONSULTATION_REANALYSIS_REQUIRED` | 기대 동작 |
| T05 | 상담 실행과 사건에 채택한 요건의 판본 상충 | `WORKFLOW_INTAKE_RUN_STALE` | 기대 동작 |
| T06 | 현재 증빙이 과거 fallback source로만 존재 | `NORMALIZED_SOURCE_FALLBACK_UNVERIFIED` | 기대 동작 |
| T07 | 활성 증빙 자체가 없음 | `waiting_evidence`; 원문·페이지 필수 표시 | 기대 동작 |
| T08 | 법률 2개 항목 완결, 필요한 변호사 승인과 계산 run 일치 | 최종 법률 게이트 차단 0건 | 기대 동작 |
| T09 | 직원 검토만으로 caseRevision이 바뀐 **옛 구조** | `LAWGRAPH_SOURCE_VERSION_STALE` | 이전 F01 결함 조건 설명; 0021 코드 가드 이후 운영 재검증 필요 |
| T10 | LawGraph 문서 필드 투영 0건 | `LAWGRAPH_FORM_FIELD_PROJECTION_MISSING` | 최종 검토본 게이트는 정상 차단 |
| T11 | 법률 필수 사람 승인 누락 | `LAWGRAPH_HUMAN_DECISION_REQUIRED`, `LAWGRAPH_CHECK_UNRESOLVED` | 기대 동작 |
| T12 | 최신 계산 run과 LawGraph가 불일치 | `LAWGRAPH_CALCULATION_RUN_MISMATCH` | 기대 동작 |
| T13 | 위험 계약이 미승인인데 검토 종료 시도 | `LAWGRAPH_HUMAN_DECISION_REQUIRED` | 기대 동작 |

## 2. 자동초안 자격과 구 상담 갈음 복원 (T14–T19, X01–X03, 9건)
| ID | 가상 상황 | 실제 관측 | 판정 |
|---|---|---|---|
| T14 | 필수 계산 출력 13개 존재, 필요한 1개 법률 체크는 사람 검토 대기 허용 | 자동 **검토용 초안 후보** `eligible=true` | 기대 동작 (법원 인가 아님) |
| **T15** | 계산 및 법률 체크 통과지만 LawGraph 서식투영 오류·필드 0건 | **`eligible=true`**; 후보 차단 입력에 투영 오류가 없음 | **C01 결함 재현**; 최종 LawGraph 게이트 T10과 불일치 |
| T16 | 동일 입력에 `explicitFailures: [FORM_PROJECTION_UNAVAILABLE]` 추가 | `eligible=false` / `EXPLICIT_FAILURE_PRESENT` | 차단 정책 자체는 존재; 호출부 연결 필요 |
| T17 | 필수 현재가치 계산 출력 빠짐 | `eligible=false` / `CALCULATION_VALUE_MISSING:presentValueWon` | 기대 동작 |
| T18 | 계산 head 오래됨 | `eligible=false` / `CALCULATION_HEAD_STALE` | 기대 동작 |
| T19 | 법률 상태 `missing` | `eligible=false` / `LEGAL_CONDITION_UNRESOLVED` | 기대 동작 |
| X01 | 상담 A에서 갈음 승인, 상담 B 활성화; 직원 화면의 전체 컨텍스트 | 옛 승인 **`restored`**, 원본 요청 활성 | 기대 동작 |
| **X02** | X01과 같은 사건, 자동법률/최종 export의 빈 `options` | `inactive_by_substitution` 상태가 보존되는 해당 분기 | **C04 경로별 불일치 재현** (특정 복원 분기만 격리) |
| X03 | 현재 상담과 채택 상담 동일, 전체 컨텍스트 | `inactive_by_substitution` 유지 | 기대 동작 |

## 3. source/review/artifact 변경 분리 (M01–M08, 8건)
| ID | 가상 조작 | 실제 관측 | 판정 |
|---|---|---|---|
| M01 | 법률검토 승인만 추가 | 비원천 변경 허용 | 0021 대응 코드 기대 동작 |
| M02 | 법률 승인과 동시에 금액 source fact 교체 | `NON_SOURCE_MUTATION_CHANGED_EVIDENCE` | 무단 원천변경 차단 |
| M03 | 문서 검수 이력만 추가 | 비원천 변경 허용 | 기대 동작 |
| M04 | 문안 편집과 해당 생성본 무효화 | 비원천 변경 허용 | 기대 동작 |
| M05 | 산출물 manifest만 새 파일로 변경 | `artifact_only` 허용 | 기대 동작 |
| M06 | 산출물 변경이라 주장하며 source fact 삭제/변조 | `NON_SOURCE_MUTATION_CHANGED_EVIDENCE` | 기대 동작 |
| M07 | 일반 사실 정정을 `review_only`로 위장 | `NON_SOURCE_MUTATION_COMMAND_NOT_ALLOWED` | 기대 동작 |
| M08 | 법률 검토라 주장하면서 source revision 증가 | `NON_SOURCE_CASE_REVISION_CHANGED` | 기대 동작 |

## 4. SQLite 이벤트·큐·법원 알림·신규 0021 (DB01–DB16, 16건)
| ID | 가상 SQL 입력 | 실제 관측 | 판정 |
|---|---|---|---|
| DB01 | synthetic 사건 최초 저장 | `data_version=1` | 원천 이벤트 기준 |
| DB02 | **기존 0010/0018** 아래에서 직원 검토로 revision만 증가 | `data_version=2` | 과거 F01 원인 재현 |
| DB03 | **기존 트리거** 아래에서 revision 같고 payload/token만 변경 | `data_version=3` | 과거 F01 원인 재현 |
| DB04 | **기존 트리거** 아래에서 두 번째 리뷰 저장 | `data_version=4` | 과거 승인 고리 문제 재현 |
| DB05 | active_run=NULL인 상태에서 상담 revision 변경 | `consultation_changed` 이벤트 | 0019 개선 관측 |
| DB06 | 완료 상담 활성 run 전환, 상담 revision 불변 | `requirements_activated` 이벤트 | 기대 동작 |
| **DB07** | 상담 revision과 활성 run 해제를 **동일 UPDATE**로 수행 | `consultation_changed`만 생성; `requirements_deactivated` 없음 | **C07 이벤트 종류 확인 필요** |
| DB08 | 사건 A는 quiet 2분, B는 12분, C는 22분 | due 목록 `[C,B]` | 계산 Poll 기아 방지 관측 |
| DB09 | 가장 오래된 C가 terminal failed, B는 due | due 목록 `[B]` | 사건별 실패 격리 |
| **DB10** | 법원 B의 미확인 경보 하나, 법원 A 사건 조회 | 전역 알림 `COUNT=1` | **C03 불필요한 전역 차단 경로** |
| **DB11** | 동일 경보로 갈음 watcher 조회 | `pending=true` | **C03 법원 범위 미분리** |
| DB12 | 법원 B 경보 승인 처리 | 전역 경보 `COUNT=0` | 범위와 무관하게 변경 |
| DB13 | **신규 0021** 적용 뒤 review_only 저장 + marker 초기화 | source version 증가 **0회** | F01 코드 경계 개선 |
| DB14 | **신규 0021** 적용 뒤 artifact_only 저장 + marker 초기화 | source version 증가 **0회** | F01 코드 경계 개선 |
| DB15 | **신규 0021** 적용 뒤 진짜 원천 payload 수정 | source version 증가 **1회** | 진짜 source 감시 보존 |
| DB16 | **신규 0021** 적용 뒤 진짜 원천 revision 수정 | 추가 source version 증가 **1회** | 진짜 source 감시 보존 |

## 해석 및 미검증
- 구체적인 결함 경로는 **C01, C03, C04**, 그리고 추가 이벤트 의미 검증 **C07**이다. **C02(자동초안↔검수 원장 분리)**와 **C05(계산 preflight 전에 법률 AI 과금 가능)**는 소스 경로 비교로 확인했지만 이 46건의 독립 통합 실행 대상은 아니다.
- 격리 테스트는 실제 `npm test`, Cloudflare D1의 DDL·트랜잭션·Worker concurrency, R2 손실 복구, 사람 로그인/권한, n8n, 95개 실제 API 모델 호출을 대체하지 않는다.
- 실제 운영 사례·개인정보·비공개 정답·비밀키를 사용하지 않았다. 법원 제출 가능, 법률 판단 정확도 99%, 인가 승인 등으로 승격하지 않는다.
