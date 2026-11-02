# FirmEngine A1 — 83차 코드 완결성·상호 기능충돌 감사 (2026-11-03 00:00 KST)

**수정 허용범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 대상 A1-DOC-018 / A1-LAW-001 / A1-DATA-018. 역할 순환: 사용자·서류담당자 → 변호사 → 데이터담당자. 이전 A1 82차의 다음 ID를 이어받음.

## 기준 판본과 방법

- 조회 시작 `main`: `a0364e1a3a1ba14044d65d72669a5ffbf0968648`; 영수증 작성 직전 `main`: `a0364e1a3a1ba14044d65d72669a5ffbf0968648` (변경 시 반드시 검토). 기존 82차 인수 기록 및 중앙 보드 972행, 최근 main 커밋과 미병합 PR #32/#72/#118/#191, 코드, JSON 법률규칙, API와 DB 명령 영수증 경로 확인.
- 실제 GitHub `main` TypeScript/TSX 함수 **본문을 V8에서 타입 표기만 제거해 실행**. HTTP/DB/시간/UUID 및 재마운트는 합성 스텁. 정적 확인 항목은 실행과 구분. 실제 고객 정보·OCR·키·정답 사용 없음.
- 검증 원본 SHA: `components/case-workflow.tsx` `2ec797958726b99a4358ec46ef35f78f90bfd927`; `app/api/cases/[id]/commands/route.ts` `44c267951751d280d0f1c27ac6b3362bd7f9b9d6`; `lib/case-command-store.ts` `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`; `app/api/cases/[id]/documents/route.ts` `274f7a6e73988ca254607422d2ff2cddd1326ac0`; `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378`; `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `lib/legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`; `lib/risk-catalog.json` `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`.

## A1-DOC-018 [ ] — 명령 네트워크/새로고침/ACK

실제 `CaseWorkflow::send` V8 합성 입력 6개, **main 3/6 독립 기대 일치**:

| 입력 | 독립 기대 | 관찰 main | 판정 |
|---|---|---|---|
| POST 네트워크 유실 후 같은 마운트 재시도 | 동일 commandId | `synthetic-cmd-0001` 두 번, pending 유지 | 일치 |
| 불확정 POST 직후 새 마운트/같은 명령 | 구 명령 영수증 우선 복구, 새 ID 발급 보류 | `synthetic-cmd-0001` → `synthetic-cmd-0002`, GET 영수증 0회 | **불일치** |
| HTTP 200, `{}` | 미확정·pending 보존 | pending=null + success 안내 | **불일치** |
| HTTP 200, `{committed:false}` | 미확정·pending 보존 | pending=null + success 안내 | **불일치** |
| HTTP 409 거절 | pending 해제·오류 표시 | 오류 표시, pending=null | 일치 |
| HTTP 202, `{committed:true,pending:true,receipt:{status:'committed'}}` | 저장 ACK만 인정, 계산/법률 승인 아님 | success 안내, pending=null | 저장 ACK 경계 일치 |

정적: pending은 React `useState/useRef` 메모리에만 존재하고 해당 화면에 session/local storage, receipt GET 복구 호출이 없음. 서버 `GET /api/cases/[id]/commands?commandId=` 및 같은 actor/hash idempotent receipt 확인 경로는 **코드 존재**만 확인. **실제 이중 저장·새로고침 브라우저 행동은 미실행**.
기존 [Draft PR #32](https://github.com/firmengine/firmengine/pull/32)의 `lib/command-submit-outcome.ts` SHA `5e4af86131ba5ed7f8d223c6a4b4c8c634c25121` 원본문 `hasCommittedCommandReceipt` V8 **8/8** (`{}`, false, 문자열 true, true, true+pending, null, array, 공문자열). #32는 HTTP 성공 오인과 직원 이유 소실 대응이며 **새 마운트 원 명령 ID 복구는 별도 미구현**. 같은 UI 파일 중복 덮어쓰기 방지. [ ] 유지.

## A1-LAW-001 [ ] — §579 신청인 자격·지속수입의 근거 경계

- `lib/legal-catalog.json`의 `KR-PR-003` 요구 피처 **4개**: `applicant.isNaturalPerson`, `insolvency.currentOrExpected`, `insolvency.evidence`, `income.continuityReview`. `implementation_scope=legal_review`, 결측·상충은 unknown; 법률조문 출처 ID `law-579`의 버전/적용 검토 요구. 이것은 코드 카탈로그 확인이지 실제 법률 전문가 인정이 아님.
- 실제 `assessCase`의 자격 tri-state 조건문 V8 **8/8 독립 기대 일치**: 자연인 unknown→review_required, no→fail, yes→해당 분기 경고 없음; 지급불능 unknown→review_required, no→fail; 과거절차 unknown/no→review_required; 전체 eligibility 미관찰→3건 review_required. 모두 **해당 분기만 실행**, 다른 조건을 통과했다는 뜻 아님.
- 실제 `assessCase` 소득원 분기 V8 **6/6 독립 기대 일치**: 지속성 null/no→recurrence_review; 지속성 yes·recognition unreviewed/rejected→income_recognition_review; yes·accepted→분기 경고 없음; yes·accepted·source factIds=[]도 해당 분기 경고 없음. 마지막은 **근거 검증 미실행 공백을 드러내는 격리 관찰**이며 전체 계산/전처리 source gate가 허용한다는 주장 아님.
- `risk-catalog.json`의 `DOC-05` 소득 지속 증빙 요구는 manual_review, `may_auto_clear=false`, `deterministic_runtime_implemented=false`, `required_features=[]`. 서류 85종과 이어지는 원천 피처·증빙기간·관할을 실제 사례로 확인해야 함. `case-legal-automation-policy`는 draft와 법원 인가를 분리하는 코드지만 이 회차에는 실제 함수로 실행하지 않음.
- **변호사 검토 필요**: source Fact로 자연인/지급불능/지속소득 각 조건을 입증한 579 요건 판정, 변경된 시행일/관할 적용, 급여/영업 소득의 계속성. 미관찰/null은 0·비해당·법률상 승인으로 승격 금지. [ ] 유지.

## A1-DATA-018 [ ] — 평가·기준시험 사건과 일반 사건의 격리

- 실제 문서 등록 `POST` handler 원본문 V8 합성 **main 2/5**, 기존 [Draft #72](https://github.com/firmengine/firmengine/pull/72) handler **5/5** 기대 일치. 독립 기대는 일반 사건 HTTP201·SQL prepare 2·batch 1·save 1, 모든 synthetic markers는 409·SQL/save 0. 관찰: 일반 사건 201/SQL2/save1, structuredTest 409/SQL0, 그러나 referenceTest-only, evaluationClone-only, referenceTest+clone은 **main 201/SQL2/save1**. #72 세 경우 모두 409/SQL0/save0.
- 실제 `case-commands.ts::isSynthetic` predicate 원본문 V8 **main 5/6**, 기존 [Draft #118](https://github.com/firmengine/firmengine/pull/118) **6/6** 독립 기대 일치. normal=false, structuredTest/referenceTest=true, 중첩 marker=true; **evaluationClone 단독 main=false / 수정안 true**. 실제 `fact.review`, `object.review`, `legalCheck.dispose`, `procedure.record`에서 이 guard를 참조하는 정적 경로 확인; reducer/인증/실 D1 법률 상태 실제 저장은 미실행.
- #72는 문서 POST, #118은 별도 승인 reducer 경계를 고침. **둘 다 Draft/미병합**, 서로 동의어 아니며 결합 E2E 미인증. 자동초안 핸드오프에는 clone 별도 차단 코드 존재(통합 실행 미실행). 새로운 중복 패치 없음. 실 데이터와 합성 데이터가 운영 DB에 실제 혼합됐다는 증거는 없음. [ ] 유지.

## 결과·변경·다음

- 이 회차 **신규 확정 결함 0**, 기존 미병합 결함 3축 재현. 제품 코드 직접 변경 0, 신규 PR 0; 기존 PR #32/#72/#118을 독립 V8 평가. 보드 3 ID 모두 부분 결과만 추가·[ ] 유지.
- 전체 Node 회귀/TS/lint/build/CI, 브라우저 새로고침, staging D1/R2/Cron, 실제 85서류·18계산·95법률 종단 처리, 법원 제출/인가, 변호사 승인 **미실행**. 실제 고객자료/원본 OCR/키/.env 저장 없음. Extra High 추론 설정 실제 확인 없음.
- 다음 역할 **IT → AX → 계산사무장**, ID `A1-IT-017`, `A1-AX-012`, `A1-CALC-010`. 제품 전체 종단 인수 완료 0건. 운영 배포·운영 D1 마이그레이션·전자제출·인가 확정 수행하지 않음.
