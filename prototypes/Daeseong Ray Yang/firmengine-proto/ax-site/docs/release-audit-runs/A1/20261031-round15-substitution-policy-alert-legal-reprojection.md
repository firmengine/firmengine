# FirmEngine A1 15차 — 갈음 복원·법률 승인 최신성·데이터 재투영 / 정책 알림 경합

- 기준: **2026-10-31 KST**. 이전 14차 IT·AX·계산사무장 → 이번 **서류담당자 A1-DOC-012 / 변호사 A1-LAW-016 / 데이터담당자 A1-DATA-017** 순환. **3개 모두 [ ] 부분검증, 제품 전체 인수 완료 0건**.
- 최초 읽은 main HEAD: `e5d580e4d0ee0dc2fafb6749a20fb940d0be70be`; 수정 브랜치 작성 기준 main HEAD: `0bac01cb4ef13c2ad9a22b9d328668b718453def`; 영수증 직전 확인한 main HEAD: `0bac01cb4ef13c2ad9a22b9d328668b718453def`. 동시 에이전트 최신 커밋·열린 PR·A1 14차 영수증·중앙 인수 보드·관련 실제 스키마·코드·기존 테스트 검토.
- 읽은 main 소스 blob: `lib/document-substitution.ts` `9fea9344b923c961fe333761df99ddde431ce1bc`, `lib/case-substitution-watch.ts` `2b79695adc1a855aa70b6aad27deac758982b29e`, `lib/legal-review-identity.ts` `be300beef76f2ca130293763a28932d9046dcf59`, `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, migration `0014_case_substitution_watch.sql` `f259406cb67066dcd8427c6cbd1651a719584092`. `tests/document-substitution.test.ts` `0bb1478bac062f3daa844f10374440af6cbdceb2`, `tests/case-substitution-watch.test.ts` `990983389177386ebbf7e4ce4ea0af8b09e5e644`.
- 주요 미병합 Draft: 법률 인정/typed 원천 무효화 [#20](https://github.com/firmengine/firmengine/pull/20), 갈음 대체 증빙 페이지 역할 [#57](https://github.com/firmengine/firmengine/pull/57), 자동초안 완료 판본 CAS [#17](https://github.com/firmengine/firmengine/pull/17). main에 제품 실행 코드 수정 없음.

## A1-DOC-012 — B+C 갈음 승인 이후 자료 철회·상담 조건 변경

**재현 소스:** main `reconcileDocumentSubstitution`의 실제 함수 본문과 내부 helper를 V8 격리 실행. 정책 경로 조회와 Fact 지문만 고정된 합성 승인 스텁으로 대체했으며, 이는 실제 법원 승인·서식 유효성 검증이 **아님**.

**합성 입력:** 원요구 서류 A, 대체 B(은행자료) + C(급여명세), 서로 다른 필수 필드 2개, 검토자·원천 지문·기간·사건 주체·관할·카탈로그 버전 3이 서로 일치하는 시작 상태.

| 시나리오 | 독립 기대(activeRequest) | 원본 main 함수 관찰 |
| --- | --- | --- |
| B+C 근거 모두 현재 유효 | false (원요청 일시 비활성) | false / inactive_by_substitution |
| C 철회 | true (복원) | true / restored |
| B 철회 | true (복원) | true / restored |
| C 페이지 administrative 재분류 | true (복원) | true / restored |
| 카탈로그 3→4 변경 | true (복원) | true / restored |
| 관할 seoul→busan 변경 | true (복원) | true / restored |
| 요구 대상기간 확대 | true (복원) | true / restored |

**V8 7/7 독립 기대 일치.** 실제 DB → 상담 재분석 → UI 원요청 재표시 및 Word·법원 인가는 미검증. B/C의 역할과 본문을 실제 증빙으로 잘못 인정하는 선행 [PR #57]은 main 미병합이므로 원본 정책 검증 합격 선언 금지. **[ ] 유지.**

## A1-LAW-016 — 새 원문/계산/기준정보 이후 기존 승인 최신성

**main 함수 본문** `currentLegalDispositionOutcome` V8 격리 테스트: 기존 승인 C01/run-1/subject-v1/dependency-A → 원본·계산 또는 기준정보의 dependency 변경 시 needs_review, 주체 지문·run 교체/실행 없음·상충 AI 결과 시 needs_review. 현재 완전히 동일한 입력의 승인만 accepted, 종전 명시적 rejected는 rejected 차단으로 유지. **7/7 독립 기대 일치**.

중요: AI 실행 결과 status `pass/fail`은 변호사의 `accepted/rejected`와 의미가 다르므로 서로 직접 동일시하지 않음. 실제 95법률 체크 전체, D1 법률 원장과 최종서식/변호사 승인 통합 실행은 하지 않음. 문서 철회 시 typed 법률 인정이 잔존하는 기존 문제는 아래 별도 [PR #20] 상태로 남음. **[ ] 유지.**

## A1-DATA-017 — 원문 철회·정규화 연결·재투영

main `case-commands.ts`는 `document.role` 및 `document.retract`에서 구 Fact 철회/매칭 stale·보편 검수 초기화는 수행하나, 해당 원천을 참조한 typed 객체의 `factIds` 및 `legalReview/recognition` 해제 호출은 아직 main에 없음. 기존 3차 P0 결함의 재발 방지 미병합 [Draft PR #20]을 검토, 해당 PR 브랜치 `lib/document-evidence-cascade.ts` blob `711927af2aee618e6abbef4dec03703513923948`에서 실제 helper 본문만 V8 격리 실행. 소득·채무 승인 초기화, 나머지 근거 보존, 타 채권자 비변경, 금액 이력 보존, inventory unknown, 변경 타깃 2개 확인 **7/7**. 실제 `reduceCaseCommand` 전 경로·D1·18계산·95법률·C01/C02/C04·전자서식 E2E 및 PR Node 회귀는 이번 회차 미실행. **P0 해결로 표시하지 않음. [ ] 유지.**

## 신규 P1 — 정책 변경 알림이 watcher scan 도중 생기면 복원 재검토 지연

**경로:** `lib/case-substitution-watch.ts`의 `scanCaseSubstitutions` → `currentCaseWorkflowContext` 정책 알림 읽기 → 오래된 상태로 projection 계산 → scan 종료 시 `scanned_at=now` 저장. `drainCaseSubstitutionWatch`는 `legal_monitor_alerts.created_at > w.scanned_at` 여부로 다음 재스캔을 선택한다. **알림이 정책 읽기 이후이되 종료 timestamp 이전에 발생하면 다음 drain에서 감지되지 않음**. 사건 revision/dataVersion·카탈로그 판본이 그대로인 상황에서는 정상적인 즉시 재스캔 경로가 없고, 10분 기준 정기 스캔 조건까지 지연될 수 있다(실제 Cron 실행 보장은 별도 미관찰).

**독립 재현:** 실제 drain 조회 SQL 술어와 동일한 SELECT를 인메모리 Python sqlite3로 실행. 합성 단일 사건 `revision=1,dataVersion=1,catalogVersion=3`, source와 schema 일치. 정책 읽기 watermark `00:00:00.100Z`, 알림 `00:00:00.200Z`, 종료 watermark `00:00:00.300Z` 입력:
- 기존 `scanned_at=.300Z`에서 **다음 scan 후보 0건** (독립 기대 1건과 불일치).
- 수정 `scanned_at=.100Z`에서 **다음 scan 후보 1건** (기대 일치).
- 알림이 최초 정책 읽기 전 `.050Z` → 0건(이미 처리한 알림 재반복 없음); 알림 없음 → 0건. predicate 합성 **4/4 기대 일치**. 실제 Cloudflare D1·다중 워커나 운영 Cron을 검증한 것은 아님.

**수정 [Draft PR #62](https://github.com/firmengine/firmengine/pull/62):**
- `lib/case-substitution-watch.ts`: policy/source 읽기 직전 `scanStartedAt=iso()`를 캡처하고 watcher head의 `scanned_at`에 저장, 이벤트 발생 시간과 개별 재평가 시간은 기존 `now` 유지. 기존 스키마·법률 인정의 의미 변경 없음.
- `tests/case-substitution-watch.test.ts`: 실제 watcher에 대해 정책 읽기 후 알림을 합성 주입하고 다음 drain 재스캔 후보 1건을 요구하는 회귀 테스트 **작성**.
- PR 브랜치 최종 커밋 `c612076d6bf1a078da01a657bc8b0fb6e444b054`; 수정 소스 blob `276394e5acecb3a3b5318660302127e1c3c66a2e`, 테스트 blob `76c6293ec54d95fa737a48e642d28443176ddf2a`. diff 2개 파일 전부 허용 경로. **원본 프로젝트 Node 회귀 실행·전체 CI·빌드·staging D1/R2/Cron은 하지 않았으며 PR 미병합 Draft**. 타 에이전트 변경 덮어쓰기 없음.

## 판정·범위·다음

- A1-DOC-012 **PARTIAL**: 격리 7/7, 원요청 UI/법원 규칙 실제 판정 미완료.
- A1-LAW-016 **PARTIAL**: 격리 7/7, 95검토 통합 승인 미완료.
- A1-DATA-017 **DEFECT_OPEN + PARTIAL**: 기존 P0 main 잔존/PR #20 미병합, helper 7/7; 추가 정책 watcher P1 PR #62.
- **이 회차 신규 P1 결함 1건 / 신규 수정 Draft PR 1건 / 3개 ID 모두 [ ] / 제품 인수 완료 0건**. 격리 함수·SQLite 조건 통과를 전체 Node/CI·실제 D1/R2/Cron·공식 서식·변호사 승인·사이트 배포와 동일시하지 않음.
- 실 고객 문서·개인정보·OCR 원문 사실·.env·키·비공개 정답 없음. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 처리는 **미실행**.
- **다음 16차 역할** IT A1-IT-018(공개 번들 민감자료), AX A1-AX-015(초안→직원수정→법률검수), 계산 A1-CALC-015(기준정보 SHA 변경/구계산 run CAS).
