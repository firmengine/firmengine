# FirmEngine A1 16차 — 사건 읽기 인가·공개 자료·자동초안 인계·계산 기준정보 CAS

- 기준: **2026-10-31 KST**. 이전 15차 서류담당·변호사·데이터 → 이번 **IT(A1-IT-018 / 관련 A1-IT-003), AX(A1-AX-015), 계산사무장(A1-CALC-015)**. 핵심 4 ID 모두 **[ ] 부분 검증 또는 결함 미해결**, 제품 전체 인수 0.
- 시작/main 수정 전 확인 HEAD: `8c942853f9a2e05165e33d3bd33a621739485b96`. 보드 원본 blob `1580d0a884d14b80abc06daef0bf5e0a06caecb4`. A1 15차/4차 영수증·최근 main 커밋·열린 PR·관련 SQL/Drizzle/schema·API/UI·계약 및 기존 tests 읽음.
- 주된 실제 main blob: `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `lib/app-roles.ts` `a716bc17109d9bff7ff88c89606a49949e75a1df`; `lib/case-workflow-server.ts` `7e1a96e79afcdc0ff81e950fe52556b2794ab465`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `lib/automatic-draft-handoff-contract.ts` `43cd0e0245bb74d396879880161654cf80a2978e`; `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`; `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/case-data-recompute.ts` `cd967ced1c8262b1e8c67d62c2a373e4d2e2be94`.
- 기존 테스트 `tests/automatic-draft-handoff-contract.test.ts` `01724a1f0e214701fdc89458ef776c2606c0f1ee`, `tests/case-data-recompute.test.ts` `be7a9a8049f6dbde6a70ecc0b007114c22b8ca7a`, `tests/app-roles.test.ts` `9d85dbe1c4d6fb222c263ac3f2f85cd5824f6ca1`를 읽음.

## A1-IT-003 — 신규 P1, 사건별 읽기 권한 없이 GET 진입

- 실제 main 코드 경로:
  1. `app/api/cases/[id]/workflow/route.ts` blob `5d4a0508513ca063e7f7d5486b73d7ed71066022` → `caseWorkflowResponse` → 사건·서류·법률 항목.
  2. `app/api/cases/[id]/requirements/route.ts` blob `64eb0d2c6a12dfdf7f6f2889eaecdfc1fb417b2e` → 동일한 사건 workflow.
  3. `app/api/cases/[id]/route.ts` blob `a8eedd2f6109ba9a9994ee8f7fd26e08219731d5` → `caseResponse` 또는 과거 증빙 복구 미리보기.
- `caseWorkflowResponse` 안의 `rolesForActor`는 UI 역할 목록 표시이지 접근 차단이 아님. `getCase`에는 per-case ACL 검사가 없음. 전체 사이트가 인증된 private Site라는 사실이 **사건별 권한의 동등한 증명은 아님**.
- **실제 원본 GET 함수 본문 V8 격리 재현**: 허가되지 않은 합성 사건 ID, 인증 거절 목을 주입했지만 원본 함수가 검사 자체를 호출하지 않음. workflow=200 / 요구서류=200 / 사건조회=200 (독립 기대 각 403). 최초 사건 GET 격리에서 URL 전역 누락으로 500을 관찰했으나 URL 대역을 제공하여 동일 원본문 **200 재확인**. 이는 **코드 결함의 격리 재현**이지 외부 익명 공격/실제 고객 유출 관찰이 아님.
- **수정 [Draft PR #64](https://github.com/firmengine/firmengine/pull/64)**: 별도 브랜치 `audit/a1-read-acl-case-workflow-20261031-r16`에 `lib/case-read-access.ts` human + scope 역할 가드 추가. `case_editor` 또는 `caseworker_review` 또는 `lawyer_review`에 한하여 GET 전 허용, role_admin 단독/서비스 계정은 불허. 위 3 GET 경로에서 사건 조회·부수 작업보다 앞서 가드 수행. 수정 파일 5개(회귀 테스트 포함) 모두 지정 subtree 내부.
- **수정 코드 후보 함수본문 격리 V8 실행**: 3개 GET 경로 각각 denied 403/다운스트림 호출 0건, allowed 200/다운스트림 호출 1건, **6/6 독립 기대 일치**. 대표 합성 역할 7조건도 **7/7 기대 일치**(실제 TypeScript 모듈 import가 아닌 동등 정책 JS). `tests/case-read-access.test.ts` 3개 test 블록 **작성**, 아직 해당 테스트의 원본 프로젝트 Node/CI 실행은 하지 않음. PR 브랜치 최종 commit `fb958528e9c2fab0eb0dab64d96c33bc00120098`, 새 테스트 blob `d05192cc7c8536c0c605e15444e74e2de971a5de`.
- **고위험/미완료**: 역할 부여 현황, Sites 실제 인증·서비스 프록시 호출, 전체 API 파일 조회·목록 조회 ACL, 실제 D1/Sites 통합 및 브라우저 E2E 미관찰. 권한 정책 도입이 기존 운영 호출에 영향을 줄 수 있어 **PR 미병합 Draft/IT·개인정보담당자 승인 필요**. A1-IT-003 [ ].

## A1-IT-018 — public 번들 민감정보 소스 한정 점검

- 공개 원본 `public/`에는 favicon 및 `public/templates/` 아래 비어 있는 형식의 양식·카탈로그/README가 있음; 합성 fixture/민감자료라고 추정하지 않음. `.gitignore` SHA `a5f4c151c0cb1a60a2ecb18f5fbb2b86b3066054`에서 `.env*`, `.dev.vars*`, `*.pem`, 실제 업로드/평가 경로 제외 확인. `scripts/prepare-static-assets.mjs` SHA `2057808fd5f37fcd17dad0669c20e41c39bcef3c`는 잠금 의존성의 pdf.worker만 public에 복사.
- `private/release-review/` 3개 파일, `scripts/sites-env.mjs`, `app/chatgpt-auth.ts`, `app/layout.tsx`, `scripts/export-reviewed-source.py` (총 7개 경로) **소스 문자열 검출 규칙으로만** 이메일·전형적인 API 토큰·PEM 키·한국형 주민등록번호·전화번호·주소 패턴 **각 0건**. 검사 결과는 비밀정보 부재의 증거가 아니라 **검사 대상/패턴에서 발견 없음**에 한정.
- 실제 `dist`/JS 번들 생성 및 브라우저 네트워크 자산·배포 소스·R2 접근 정책은 **미실행/미관찰**. 외부 노출 사고로 확정하거나 A1-IT-018 통과로 표시하지 않음. **[ ] 유지**.

## A1-AX-015 — 자동초안→직원수정→변호사 검수

- main `lib/automatic-draft-handoff-contract.ts` 원본 `automaticDraftHandoffDecision`의 **실제 함수 본문**에서 TS 지역변수 타입 표기 1개만 제거한 V8 격리: 같은 판본의 초안 1건 허용; 원본 데이터판본 변경, 법률 run 교체, 사건 revision 교체, reference SHA 교체, 이전 final 파일, 미적용 문서 편집은 각각 차단; 같은 artifact ID/hash로 재인계 시 idempotent `alreadyLinked=true`. **8/8 독립 기대 일치**.
- 직원 UI `components/case-workflow.tsx` (main blob `2ec797958726b99a4358ec46ef35f78f90bfd927`)가 `/automatic-draft-handoff` POST 호출함을 확인. 그 POST는 `case_editor`+ `caseworker_review` 별도 권한을 검증. `lib/automatic-draft-handoff.ts`는 R2 byte SHA+계산/법률 head/source CAS를 실제 코드 경로에 가짐. **코드 경로 존재** ≠ D1/R2 실제 파일 인계·직원 문안 수정·독립 변호사 승인 실행.
- 기존 Draft PR #17 자동초안 완료 CAS와 #24 ACK 유실 보존이 미병합이고, 실제 Word/브라우저/E2E 전수검증 미완료. **[ ] 유지**.

## A1-CALC-015 — 기존 P0 구 기준정보 calculation head 재승격 재현

- `lib/case-calculation-feature-store.ts` main 125행의 **실제 SQL 술어를 그대로** 독립 Python in-memory SQLite에 넣어 실행. `cases.revision=7`, `case_data_change_state.data_version=4`, 기존 head `new-reference-run`인데, 참조 SHA가 오래된 합성 run `old-reference-run`을 같은 revision/dataVersion으로 늦게 저장하면 **changes=1, head=old-reference-run**, 독립 기대 `new-reference-run` 보존과 **불일치 1건**. 사건 revision 8로 전진, 원본 dataVersion 5로 전진시키면 각각 changes=0, **두 차단 경계 기대 일치**. 과거 4차 반례를 현재 main에서 재확인.
- 계산 head에는 reference SHA 별도 CAS 열이 없고 run 참조에서만 확인. `recomputeCaseDataUpdate`의 비원자적 전후 검사만으로는 기준정보 변경 경쟁조건을 완전히 차단할 수 없음. 실제 법률판정·문서 출력 오류가 발생했다고 관찰한 것은 아님.
- 기준정보 활성 release/승인·시행일·다중 워커 원자 CAS 계약 변경은 계산·법률 의미 영향이 있어 **무검증 main hotfix 금지**, 실무/데이터 구조 승인 후 별도 수정 PR 필요. **P0 미해결, [ ] 유지**.

## 이번 회차 판정·보류

| 체크 ID | 결과 | 판정 |
|---|---|---|
| `A1-IT-003` | 읽기 권한 누락 3 GET 함수 격리 재현; Draft PR #64 코드후보 V8 6/6 | P1 결함 + 부분, [ ] |
| `A1-IT-018` | 공용 원본 목록·환경 제외 규칙/선정 7소스 패턴 스캔; 배포번들 미검사 | source-only 부분, [ ] |
| `A1-AX-015` | 실제 결정 함수본문 V8 8/8; UI/API/DB 코드 연결 확인 | E2E 미완료 부분, [ ] |
| `A1-CALC-015` | 구 reference run 덮어쓰기 SQLite P0 1 재현, version/revision 2 차단 | 기존 P0 미해결, [ ] |

- 신규 **P1 결함 1건, 수정 Draft PR 1개, 기존 P0 결함 재확인 1건, 운영 제품 전체 인수 0개**. 신규 외부 유출·법률 확정·자동 승인은 관찰하지 않음. Node 전체 테스트/타입/빌드/CI, staging D1/R2/Cron, 실 Word/법원서식·변호사 승인·배포 전부 **미실행**.
- 다른 에이전트 변경·타 브랜치 덮어쓰기 없음. 운영 배포, 운영 D1 마이그레이션, 전자제출, 법원 인가 처리 **미실행**. 실제 고객 데이터·키·원본 OCR 값 없음.
- **다음 회차 역할** 서류담당 `A1-DOC-013` (다중 문서·복수행/요구서류 동기화), 변호사 `A1-LAW-018` (법원 보정/인가 상태 분리), 데이터담당 `A1-DATA-016` (DB schema/migration 동등성). 추가로 `A1-IT-003`의 미점검 사건 파일·목록 GET 인가 범위를 별도 감사 대상으로 유지.
