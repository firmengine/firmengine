# FirmEngine A1 — 7차 코드·기능 충돌 감사: 법원 보정항목 조회권한 및 저장확인 복구

- **시점**: 2026-10-30 18:55 KST 이후, 기준 main SHA `289e0e7998baa80c52633f365e8e48b45367ca29`.
- **수정 허용**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 운영 DB, 배포, 실제 법원 제출·인가, 실제 고객 데이터에 대한 조작 없음.
- **이전 A1 6차**: IT/AX/계산사무장, UI 명령 저장 상태 P1 [Draft PR #32](https://github.com/firmengine/firmengine/pull/32), 회귀 검사와 통합 환경 미인증. 이번 역할은 **서류담당자(A1-DOC-018) / 변호사(A1-LAW-017) / 데이터담당자(A1-DATA-018)**.
- **사전 확인**: GitHub main 최신 SHA·최근 15커밋·open Draft PR #12/#17/#20/#24/#28/#32 및 A2/A3/A4 최신 PR #33/#34/#35, 통합 보드·A1 5~6차 영수증·현재 API·스토어 코드·테스트·권한 스키마를 먼저 조회함. 이번 PR의 두 파일은 앞선 PR #32 등의 수정 파일과 분리함.
- **제품 인수 완료 0개**: 아래 각 ID는 근거 있는 **부분 검증**이며 [ ] 유지.

## A1-DOC-018 — 네트워크 단절/새로고침 뒤 동일 명령 영수증·중복 제출

현재 main `components/case-workflow.tsx` SHA `2ec797958726b99a4358ec46ef35f78f90bfd927`의 실제 `send` 첫 구간을 타입 표시만 제거해 격리 V8에서 실행했다. `pendingRef = useRef(null)`, `pendingCommand = useState(null)`는 페이지 메모리에만 있고, POST 전 새 명령에 `crypto.randomUUID()`를 배정한다.

**합성 시나리오**: 동일 사건 revision 7 / 동일 작성 중 요구서류 조정·동일 reason을 첫 페이지에서 전송했으나 결과 ACK를 받지 못한 상황을 설정. 새로고침(새 React 컴포넌트 마운트)을 모의해 동일 요청을 다시 전송함.
- 기대: 원래 `commandId`의 receipt를 먼저 조회하거나, 확인 전 새 식별자 제출을 경고/보류한다. 동일 작업에 새 commandId 자동 배정 금지.
- 실제: 첫 `synthetic-cmd-1` → 마운트 후 `synthetic-cmd-2` 생성, **동일 ID 유지 실패**(실제 함수의 명령 ID 생성 구간 2회 실행). 별도로 서버 `app/api/cases/[id]/commands/route.ts::GET`에서 기존 commandId 영수증 조회 기능은 확인됨.
- 범위 한계: 실제 브라우저/네트워크·D1 경쟁·이중 DB 커밋까지 발생시켰다는 의미는 아니다. revision/CAS로 일부 요청이 충돌 차단될 수 있어 '무조건 중복 저장'으로 주장하지 않는다.
- 조치: `components/case-workflow.tsx`는 이미 Draft PR #32가 변경 중이므로 중복·덮어쓰기 수정하지 않음. 후속은 **원문/검수 사유를 브라우저 Storage에 저장하지 않는 방식으로** commandId만 안전하게 보존→재방문시 GET receipt로 확인→확인 불가 시 사람 재검토·원문 재입력의 별도 UX/회귀 검증이 필요하다.

## A1-LAW-017 — 법원 보정명령 항목 조회에 사건별 사람 권한 검사가 빠짐 (P1)

**원본 경로** `app/api/cases/[id]/correction-items/route.ts` SHA `baf7b7198adeac39e90673a54ab6248243c9fa3b`의 GET은 `requireSameOrigin`만 수행하고 바로 `getCase(id)`→`readCourtCorrectionItems`를 실행했다. `lib/server-store.ts::getCase`는 해당 id로 저장 자료를 읽지만 `rolesForActor`와 사건별 권한을 검사하지 않는다. 반면 동일 라우트 POST는 `requireAppRole("caseworker_review",id)`를 요구한다.

**재현**: 실제 GET 본문을 타입/모듈 임포트만 대체해 V8 실행하고, 사건별 보정항목은 `{count:1,courtApprovalInferred:false}`라는 합성 반환으로 모의.
- **기존 소스 무권한 사용자**: GET 200, 사건 조회 1회, 보정항목 조회 1회로 진입(기대 403, 조회 0). 민감 법원 보정항목의 **같은 Site 내부 사건별 권한 경계 공백**.
- **수정 후보**: [Draft PR #36](https://github.com/firmengine/firmengine/pull/36), 별도 branch `audit/a1-court-correction-read-access-20261030-r07`. 읽기 전에 `requireHumanActor()`와 `rolesForActor(actor,caseId)`를 검증하고 `case_editor`, `caseworker_review`, `lawyer_review` 중 하나도 없는 경우 403을 반환. 범위 바깥의 POST 승인/법적 인정·DB 스키마·자동 제출은 변경 없음.
- **실행한 수정본 GET 본문 격리 V8 7/7**: 무권한 403·DB조회 0, 서비스 신원 403·DB조회 0, case_editor 200, caseworker_review 200, lawyer_review 200, role_admin 단독 403, 잘못된 Origin 403·DB조회 0. 기존 본문에서 무권한 200도 재현.
- **새 테스트**: `tests/court-correction-read-authorization.test.ts`에 실제 route를 TypeScript transpile한 뒤 스텁을 주입하는 회귀 6개의 소스를 추가했음. **원본 Node 테스트, 전체 타입/lint/build, staging D1/R2, 브라우저 실제 권한 검증은 아직 실행하지 않음.** 따라서 PR은 미병합·제품 인수 미완.
- **위험 경계**: 외부 익명 사용자의 인터넷 접근이 성립한다고 증명한 것은 아니다. 기존 사이트는 owner-private 경계이며, 이 결과는 **역할/사건 단위 최소권한 검증의 누락**을 입증한다. PR 검토 시 lawyer_review·caseworker_review 읽기 정당성 및 주변 read API의 동일 정책을 점검해야 한다.

## A1-DATA-018 — 합성 자료가 실제 보정항목 저장으로 섞이는지

`lib/preapproval-correction-item-store.ts` SHA `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`의 실제 `validateCorrectionItemDraft` 첫 분리 가드를 V8에서 추출·실행.
- `structuredTest` 존재 → `CORRECTION_SYNTHETIC_CASE_WRITE_FORBIDDEN`;
- `referenceTest` 존재 → 동일 코드 차단;
- `evaluationClone` 존재 → 동일 코드 차단;
- 일반형 사건 → 이후의 검증으로 진행.
**4/4** 조건이 가드의 의도대로 수행됨. 이는 **보정항목 한 저장 경로의 함수 가드 부분 검증**이다. 실제 합성 사건 업로드·DB write·다른 출력을 통한 우회/원본 보존은 미실행, 사례별 데이터 완전격리 인수로 간주하지 않는다. 원본 SHA 및 경로 보존·미실행 상태를 중앙 보드에 기록.

## 코드/검증/후속

| 구분 | 결과 |
| --- | --- |
| 원본 GET 무권한 반례 | V8 **200/DB read 1** (기대 403/read 0) |
| PR #36 수정 GET 합성권한 7조건 | V8 **7/7 기대 일치** |
| 새 repo 회귀 테스트 | **6개 작성, Node 미실행** |
| UI 새 마운트·commandId 시험 | V8 실제 `send` 초기 구간, 첫/다음 ID 달라짐 |
| 합성 데이터 보정항목 쓰기 guard | V8 4/4 의도대로 차단/계속 |
| 전체 Node/typecheck/lint/build/browser/D1/R2/Cron | **미실행 / 미인증** |
| 법원 서식·보정명령 공식성·변호사 법률 승인/운영 배포 | **미실행 / 미인증** |

**다음 A1 회차**: 역할 순환 **IT/AX/계산사무장**. 후보 `A1-IT-016`(최신 CI/빌드 실행 근거), `A1-AX-012`(모델 재시도·이중 과금), `A1-CALC-017`(계산 실패 시 법률·문서 조기 실행 차단). PR #32 UI 재시도 변경과 PR #36 권한 패치를 직접 병합하지 말고 테스트·리뷰 증거를 추가한다.
