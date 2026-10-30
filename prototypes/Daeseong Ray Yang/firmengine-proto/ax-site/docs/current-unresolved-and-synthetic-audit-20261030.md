# FirmEngine AX — 최신 미해결 기능충돌 및 가상사건 검증

검토 기준: 2026-10-30 KST · `main`의 `fc731005`까지 확인. **코드 읽기 + 격리된 함수·SQLite 모의 입력 결과**다. 운영 D1/R2, 실제 모델, 전체 CI/빌드, 법원 실무 적합성 검증이 아니다.

## 유지보수 원칙
- 이미 코드에 반영된 개선은 **활성 미해결 목록에서 제외**한다. 기존 v35/v43/v44 문서·커밋·이슈는 역사/감사 증빙으로 보존하고 현재 작업 지시로 사용하지 않는다.
- 코드 반영, 단위 가상검사, 실제 DB/Cron 통합 실행, 법률전문가 승인, 운영 배포를 서로 다른 완료 상태로 기록한다.
- 변경 범위는 이 `ax-site` 폴더. 동시 수정 중인 계산·추출·법률 코드를 덮어쓰지 않는다.

## A. 코드 반영 확인: 활성 결함 목록에서 제거
| 기존 문제 | 최신 코드 근거 | 남은 검증만 |
|---|---|---|
| F02: 상담 활성 실행이 NULL일 때 상담 수정 무감지 | `drizzle/0019_consultation_revision_watch.sql`, 상담 판본 확인을 추가한 `case-legal-source-preflight.ts` | 운영 migration, 새 상담 자동재분석/채택 E2E |
| F03: 계산 Poll의 첫 사건 기아·실패 반복 | `drizzle/0020_calculation_poll_fairness.sql`, `case-data-recompute.ts` due-filter/사건별 lease·백오프·격리, 재시도 API | 실제 D1 동시 워커/장애 테스트 |
| F04: 미검증 증거로 95개 법률 AI 실행 | `case-legal-source-preflight.ts`와 `case-legal-automation.ts`의 증거·상담·정규화 head 검사 | 실제 OCR → D1 → AI 연쇄 E2E |
| F01: 순수 검토/산출물 수정이 source_version을 무조건 올림 | `case-mutation-classifier.ts`, `server-store.ts`, `case-commands.ts`, `drizzle/0021_workflow_only_source_watch.sql`의 변경구분+원천오염 차단 | **0021 적용 필수**, D1/R2 원자성·사람 검토→최종 문서 E2E; 전체 독립 판본 설계는 후속 |

## B. 아직 남은 충돌: 코드 확인 또는 가상입력에서 재현
| ID/우선 | 충돌 지점 | 현행 근거 및 위험 | 다음 인수 테스트 |
|---|---|---|---|
| C01 / P0 | LawGraph 문서 필드 생성 실패가 자동초안 허용 판단에 연결되지 않음 | `case-legal-automation.ts`는 `documentFieldProjectionError`를 결과에 저장하지만 `automatedDraftEligibility`의 `explicitFailures`에 전달하지 않는다. 가상 T15에서 **문서 필드 0개/투영 실패인데 eligible=true**. 최종 서류 게이트는 별도로 차단하므로 결함은 *자동 검토용 초안 후보와 진단 불일치*에 관한 것 | 투영 오류/0필드→초안 후보 차단, LawGraph 판정 저장 보존, 재생성 복구 |
| C02 / P0 | 자동 생성 초안과 직원 문서 검토 경로 분리 | `automatic-review-draft.ts`는 `case_automatic_document_runs`·`artifacts`에 기록. `case-workflow-server.ts`의 편집·검수 `artifacts`는 `data.exportManifest.files`에서 읽는다. 자동초안 목록은 `legalAutomation.outcome.drafts`에 별도 노출될 수 있지만 동일 편집/검수 원장으로는 이어지지 않음 | 초안→동일 파일ID/해시 검수큐→문안 수정→재생성→직원/변호사 검토 |
| C03 / P1 | 법원 A 사건이 법원 B의 법령변경 알림으로 막힘 | `case-legal-automation.ts`, `case-substitution-watch.ts`, `case-workflow-server.ts`에서 미확인 알림 **전역 COUNT**를 사용. 가상 DB10/11에서 관계없는 경보 1개가 전체 사건의 초안과 갈음평가에 전파 | 관할/시행일/법령/서식 단위 영향 정책으로 조건부 차단 |
| C04 / P1 | 서류 충족/갈음 판단이 실행 경로마다 다른 입력 사용 | 직원 화면은 `buildCaseWorkflowView(data,{catalogVersion,pendingCourtPolicyChange,activeIntakeRunId,pageTypes,...})`, 법률 자동판단과 **최종 export 경로**는 `buildCaseWorkflowView(data)`를 옵션 없이 호출. 선택 갈음·구 상담 차단이 자동/화면에서 달라질 수 있음 | 같은 가상 사건에서 양 경로 비교; 공통 사건별 판단 컨텍스트 강제 |
| C05 / P1 | OCR 출처 사전검증 통과 후 계산 `missing/provisional`인데도 95개 AI 배치 호출 가능 | `sourceReadiness`는 원본·상담·정규화 완료를 검사하지만 법률 AI 시작 전에 계산 산식별 준비상태를 전부 검사하지 않는다. `finalizeReview`의 수치 게이트는 호출 후 실행 | 계산 필수 출력/근거 사전 검사→불필요한 법률 AI 호출 0회 |
| C06 / P0 | LawGraph 95 위험 중 명시 피처 계약 미정의 88개 | `risk-catalog.json`의 기본 계약 갭; 승인 가능한 새 법률 증거 계약은 구현됐어도 88개 전문가 검토·승인은 별개. 자동 종결 차단을 유지해야 함 | 위험별 관할·시행일·source/계산·필수/OR 피처 전수 승인 |
| C07 / P1 | 상담 revision과 active_run_id를 동시에 바꾸면 비활성화 종류가 별도로 기록되지 않음 | `0019`의 변경 이벤트는 `consultation_changed` 하나만 생성. 가상 DB07은 이를 재현. version은 증가하므로 무감지는 해결됐으나, 이벤트 종류별 구독자가 있다면 검증 필요 | `requirements_deactivated` 수신 의존 모듈 확인/원자적 중복 없는 이벤트 의미 정의 |
| C08 / P0 | 공식 문서·결과의 종단 E2E 부족 | 18계산·91입력 / OCR 693 / 법률 95 / 85종 제출서류 / 실제 D1 마이그레이션 / 사람 검수 / 전자소송 원본 대조 아직 동일 버전·동일 사건으로 인수되지 않음 | 3개 이상 격리 사건의 정상/실패/동시 수정/재시도/최종 검수 E2E |
| C09 / P1 | n8n/Sheets/Drive/NAS 운영 이관은 설계 수준 | `n8n-reference`는 신규 95 판단 단계가 실행되는 배포 워크플로라는 증거가 아니다. 사이트 중심 모듈이 현재 기준 | stage API·idempotency·사건 격리·권한·Outbox·오류 복구 구현 후 검증 |

## C. 가상입력 실행 결과

[**46개 전 사례의 입력·실제 관측·판정 상세 영수증**](synthetic-scenario-results-20261030.md)
- **46개 시나리오 관찰이 예상 동작과 일치**했다. 이는 합격 43건을 의미하지 않는다. 문제가 발생하는 입력에서 **오류를 실제로 관측한 사례도 포함**한다.
- **함수 본문 추출 실행 22개**: 원본 증거 준비도 T01–T07(7), 최종 LawGraph의 현행성/승인 T08–T13(6), 자동초안 허용 T14–T19(6), 갈음 상담 실행판본의 조건부 복원 분기 X01–X03(3). TypeScript 타입 선언만 제거하고 현재 `main` 함수 본문을 가상 입력으로 호출함.
- **실제 함수의 비원천 변경 검증 8개**: M01–M08. 법률 의견/문안/manifest만 변경하는 것은 허용, 금액/원본이나 revision 혼입은 명시적으로 차단됨.
- **격리 SQLite 16개**: DB01–DB12는 이전 트리거, 상담 변경, 계산 Poll, 전역 법령 경보의 동작을 확인; DB13–DB16은 신규 `0021`에 의한 비원천 변경 제외와 실제 원천 변경 감지 보존을 확인.
- **발견**: T15는 `documentFieldProjectionError` 미전달에 따른 미차단을 실제 순수 함수에서 관측. DB10/DB11은 관할 불일치 전역 알림을 실제 SQL 조건으로 재현. DB07은 상담 비활성화 이벤트 분기 불일치를 재현. X01–X03에서는 **동일하게 오래된 갈음 승인**이 화면에서는 원본요청 복원, 자동판단·최종 export의 옵션 생략 시 복원 조건 미실행으로 갈릴 수 있음을 해당 코드 분기에서 관측.
- **수정 상태**: 위 세 충돌은 **아직 코드 수정/운영 인증하지 않았다**. 미확정 값을 0/법적 충족으로 바꾸지 않는다.

## D. 다음 작업 시 검증 순서
1. 0021 포함 D1 staging migration과 기존 사건/검토/출력 변경 분리 확인.
2. C01·C02·C04를 같은 가상 사건으로 반복 테스트하고 가장 좁은 계약부터 수정.
3. C03 전역 알림을 관할·적용일별로 분리한 뒤 갈음 watcher와 AI·직원 화면을 함께 대조.
4. C05 AI 과금 전 계산 입력의 `blocked/missing/provisional` 차단을 검증.
5. 85종×693×18/91×95는 법률/원문/서식 소비처에 필요한 것만 전수 E2E, 나머지는 source-only를 유지. AI/법률 검토와 운영 승인 구분.

**중요**: 이 문서는 활성 작업 목록이다. 과거 버전의 '수정 전 결함' 설명을 새로운 미해결 항목으로 중복 등록하지 않는다. 운영 배포, 법원 제출, 실제 인가 성공을 증명하는 문서는 아니다.
