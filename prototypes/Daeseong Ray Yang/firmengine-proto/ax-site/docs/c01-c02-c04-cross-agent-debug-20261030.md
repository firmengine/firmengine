# FirmEngine AX · C01/C02/C04 기능 충돌 교차 디버깅 결과

작성: 2026-10-30 KST. 작업범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내. 다른 에이전트의 `main` 변경을 보존하는 가산적 보완. **운영 DB/D1·R2·실제 사이트 배포·법원 제출 적합성 시험 결과가 아니다.**

## 결론과 코드 인수상태

| 충돌 | 지금 소스에 반영한 조치 | 아직 완료로 표시할 수 없는 검증 |
|---|---|---|
| **C01 P0** LawGraph의 필드 투영 실패에도 자동초안 통과 | `case-legal-automation.ts`의 오류·빈 필드·필수 토큰/저장 데이터가 안 맞을 때 `explicitFailures` 및 재확인 게이트를 적용하는 코드 확인. 이전 `draft_pending`도 writer 전에 stored fields/token 검증. 회복은 현재 상담/근거·계산 버전만 사용하며 법률검토 이력 보존. | 실제 계산→95체크→잘못된/정상 투영→R2 작성/실패복구, 정확한 생성 바이트와 UI 검수 E2E |
| **C02 P0** 자동초안과 직원 문서 검수 원장 불일치 | 자동초안의 **원본 artifact ID/hash/R2 SHA**와 저장된 writer receipt·사건 버전·법률/계산 run을 검증한 뒤 직원이 명시적으로 `exportManifest` draft로 **링크**. 단일 기존 `document.edit` → `/export` 재생성 → `document.review` 직원·변호사 순서. 인계 UI, 최종 서류 재생성/사람 검수 UI 제공. R2 변경·다른 사건·기존 최종검토/미적용 편집은 차단. D1 `UPDATE cases`가 원천 version/calc/legal/reference CAS 조건을 **같은 배치**에서 검사. | 이중 워커·R2 중단·DB 응답 유실·수정/재생성/검수 승인과 법원 서식 실제 바이트를 통과하는 운영 격리 E2E, Node 전체 CI |
| **C04 P1** 화면/AI/최종서식/갈음 watcher의 서로 다른 판단 입력 | `lib/case-workflow-context.ts` 단일 조회기를 신설/적용해 상담 run·카탈로그 버전·OCR 페이지 문서종류·기준 변경 감시상태를 **직원 UI, 법률 AI, 최종 export, 갈음 watcher의 네 경로에서 공통으로 사용**. 과거 상담 run이면 이전 갈음의 '만족' 상태를 보존하지 않음. 갈음 watcher의 기존 잘못된 `policy(database)` 무인수 호출(컴파일 오류)과 전체 사건 재스캔 기아 SQL 수정. | staging D1에서 상담 A→B 변경/갈음 A←B+C 철회·법률 95/최종 서식의 같은 사건 상태를 네 경로에서 비교한 물리 통합 시험 |

## 기능 계약 / 반드시 보존

- 자동초안은 **REVIEW DRAFT ONLY**. 담당 직원이 명시적으로 검토 화면에 연결해도 법률 승인·법원 접수·인가가 아니다.
- `sourceDataVersion`, `caseRevision`, `calcRunId`, `legalReviewRunId`, `referenceSha256`, `artifactId/hash`가 다르면 **이전 판본 사용 차단**. 실제 원문/계산이 수정되면 기존 승인 기록을 재사용하지 않음.
- 일반 문서 제출/검수 원장을 새 자동초안으로 덮어쓰지 않으며, 기존 문안 편집·최종 검토본·과거 이력과 실제 파일 모두 보존.
- 문서 생성과 산식 입력은 기존 백엔드에서 수행. 새 에이전트가 숫자/법률 근거를 새로 만들어 덮지 않음.
- 누락·미관찰·오인식·해당없음·0·상충·사람 미승인을 구분한다.
- **C03 관할별 기준정보 전체 분리는 사용자 지시로 P1 보류.** 현재 개발·검토의 기본 업무 기준은 서울회생법원이다. 상담 이력 단계에서 관할 및 확인 근거를 별도 스키마로 적재하는 장기 확장은 [후속 설계](deferred-court-routing-20261030.md)로 남긴다. 다른 작업자가 반영한 **법원 출처가 확인된 알림의 사건별 과차단 축소**와 C03의 전체 법원별 정책/서식/상담 스키마 구축은 별개이며, 이를 '법원별 지원 완성'으로 표시하지 않는다.

## 실행한 격리 시나리오 (운영 인수와 분리)

| 영역 | 독립 검증 방식 | 검사 결과 |
|---|---|---|
| C01 서식투영 오류/빈필드/계산출처/정상 후보 | 실제 `automatedDraftEligibility` 함수 본문을 GitHub에서 추출하여 가상 입력 6개 실행 | **6/6** 예상 차단/허용 |
| C02 staff handoff 정합성 | 실제 `automaticDraftHandoffDecision` 함수 본문 + 가상 원본/검토/선행 승인 8개 | **8/8** 예상 차단/동일 draft idempotent |
| C02 원자적 D1 조건 | `saveCase.expectedHeads`에 추가된 SQL `EXISTS` 조건을 SQLite 메모리 DB로 실행, 정상 1 + 구판본 6 | **7/7** |
| C04 OCR 페이지 identity | 실제 `collectCaseWorkflowPageTypes` 브랜치, 충돌·중복·미확정 3건 | **3/3** |
| C04 watcher due/alert/version/catalog | 새 사건별 감시 SQL을 메모리 SQLite로 실행, 과거 사건 무한 재스캔/새 경보·원본·카탈로그 변경 등 7건 | **7/7** |
| 코드에 추가한 Node 재현 테스트 | `tests/automatic-draft-handoff-contract.test.ts`, `tests/case-workflow-context.test.ts`, `tests/case-substitution-watch.test.ts`의 회귀 조건을 추가·보완 | **테스트 파일 반영**. 현재 전체 Node 실행 결과 미확인 |

위 숫자는 **함수/SQL 격리 검사 관측값**이며 전체 애플리케이션 통과율, 실제 모델 평가 정확도, 법률판단/실무준칙 인증이 아니다. 이전 수정 전 T15, X02 등은 이력으로 보존한다.

## 코드 위험 재점검 및 인수차단 조건

1. **다중 작업자 경쟁:** `main`에 수시로 다른 커밋이 반영되므로, 변경 파일 SHA 재조회 후에만 Push. 원장/추출/계산 모듈의 동시 수정 이력은 덮지 않는다.
2. **프로덕션 인수 전 필수:** 적용 가능한 migration 0017–0021을 staging에서 검증하고 독립 사건 3건 이상: (A) 문서 정상, (B) 투영 누락, (C) 상담 변경+갈음+사용자 편집; Cron 재검토·R2 업로드·D1 CAS 경합·권한 거부·부분 실패를 처리.
3. **정상 폐루프:** 상담→OCR/증거 대조→18 계산→95 LawGraph 판단→서류 토큰 투영→자동 **검토용** 초안→직원 명시 인계→문안 수정→초안 재생성→변호사 법률검토→최종 검토본 작성→담당자 검수→변호사 검수. 최종 제출은 별도 사람/법원 절차.
4. **완료 표시 기준:** `npm ci`, `npm run lint`, `npm run build`, 전체 Node 테스트와 실제 D1/R2 E2E 영수증이 수집되기 전 '운영 완료'로 표기하지 않는다.
