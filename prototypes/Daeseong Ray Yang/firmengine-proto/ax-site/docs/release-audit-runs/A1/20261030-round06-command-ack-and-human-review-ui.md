# FirmEngine A1 — 6차 코드·기능충돌 부분 인수: API 명령 저장 결과와 사람 검수 UI

- 일시: 2026-10-30 17:50~ KST. 시작 main SHA: `bfc822c288832aabd9fd0dde3f6dfb408c6be344`; 기록 전 main SHA: `bfc822c288832aabd9fd0dde3f6dfb408c6be344`.
- 허용 수정 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 최신 기존 인수: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 A1 ID, A1 1~5차 영수증, 다른 에이전트의 최신 PR #29~#31 및 main 최근 20커밋. 기존 A1 PR #12/#17/#20/#24/#28과 변경 파일 겹침 없음.
- 담당 관점 순환: 이전 5차 **서류담당·변호사·데이터** → 이번 **IT( A1-IT-015 )·AX( A1-AX-011 )·계산사무장( A1-CALC-016 )**. 3개 모두 부분 확인이고 최종 제품 인수 **0개**.
- **P1 사용자 작업 무결성 문제 1건**: 확정적 서버 거절(HTTP 4xx)·응답유실/네트워크 불확실·서버 2xx이지만 명시적 commit receipt 미확인 상황에서 검수 화면의 성공/실패 의미가 섞이는 문제. **최종 법원 인가·실제 변호사 법률 승인 변조를 입증한 것은 아님**.

## A1-IT-015 — API/클라이언트 명령 결과 계약

관찰한 main 호출:
`app/api/cases/[id]/commands/route.ts`의 POST는 `executeCaseCommand()` 결과를 200 또는 202로 회신한다.
`lib/case-command-store.ts::commandResult`의 정상 응답은 `committed:true`; 평가 조회 미완료는 `committed:true,pending:true,code:EVALUATION_PENDING`이며 그 자체가 **명령 영수증의 커밋**이지 법률 검토/서류 생성의 완료는 아니다.
`lib/server-store.ts::errorResponse`는 CommandError를 4xx/5xx로 매핑한다.

**결함 경로**: `components/case-workflow.tsx::send`는 4xx 거절 시 부모 알림만 표시한 뒤 `undefined`를 반환했고, 5xx/네트워크 불확실과 다른 명령 대기에도 `undefined`. 2xx 응답에 `committed:true`가 없는 경우에도 정상으로 취급했다. 소비하는 자식에는 확정 거절·미확정·실제 커밋을 구별하는 계약이 없었다.

**독립 기대**: 합성 요청 R1=4xx 거절→`rejected`, R2=네트워크/500/미확인 2xx→`uncertain`(동일 commandId 보존), R3=200+`committed:true`→`committed`, R4=202+`committed:true,pending:true`→명령 커밋은 확인하되 파생 평가 미완료. 후속 승인/법원 확정은 별도.

**수정 후보**: [Draft PR #32](https://github.com/firmengine/firmengine/pull/32), 별도 브랜치 `audit/a1-command-result-no-false-approval-20261030-r06`. `lib/command-submit-outcome.ts`의 `CommandSubmitOutcome`, `hasCommittedCommandReceipt`를 추가하고 `case-workflow::send`가 명시적 상태를 돌려주게 함. 4xx에서는 확정 거절로, 2xx 미확인·서버 장애에서는 불확실로, 실제 `committed===true`만 커밋으로 본다. 불확실 상태의 원래 재시도 명령 ID는 유지.

## A1-AX-011 — 사람 검수 UI는 서버가 저장을 거절해도 이유를 삭제하지 않아야 함

**확인한 함수 원본**: `components/document-review-finalization.tsx::approve`는 `void Promise.resolve(props.onCommand(...))` 뒤 **서버 저장 상태를 기다리지 않고 `setApprovalReason("")`** 실행. 부모가 거절 응답을 자체적으로 처리하므로 자식은 저장 거부를 성공처럼 편집 상태에 반영했다. `components/case-review-actions.tsx::saveEdit`도 부모 `send`가 `undefined`로 성공 반환하면 textarea를 초기화했다.

**실제 함수 격리 V8 재현**: GitHub main `document-review-finalization.tsx`의 `approve` 본문을 타입 주석만 제외하여 실제로 실행하고 `onCommand`에 결함 응답(거절)을 주입했다. 기대=사유 보존·오류 표시, 기존 실제=`reasonCleared=true`, `submitted=1`, `errorShown=false`; 별도 실제 브라우저·D1 테스트는 아님.

**수정 후보**: `approve`가 커밋 영수증을 기다리고 거절·불확실이면 검토 이유를 보존하고 정확한 메시지를 표시; 명시적 명령 커밋 후에만 해당 입력을 지운다. 문서 편집도 명령 커밋 전에 form.reset 하지 않고 법률처분 및 사업소득 제안/승인 결과를 별도로 안내. 변호사 권한 자체·실제 법률 확정 상태를 변경하지 않고 기존 문서/법률 원장은 보존.

## A1-CALC-016 — 계산↔서식 동등성, 이번에는 정적 연결 경로만 일부 확인

`lib/form-mapping.ts::buildFormBindings`에서 계산 `debtPrincipalWon`·`debtInterestWon`·`monthlyIncomeWon`·`disposableIncomeWon`·`monthlyPaymentWon`·`planTotalWon`를 서식 scalar로 전송, 채권자 개별 principal/interest/월 배분 반복행에 `calculation.debtRows`·ledger/reconciliation을 사용함을 코드에서 확인했다.
`lib/document-preflight.ts`의 `REPEAT_ROW_TOTAL_MISMATCH`/법적 산술 검토 가드는 정적 확인. 그러나 0/null/상충·원본 증빙·D5103/D5110 Word 실제 결과와 동일한 금액인지 전체 E2E는 **검증하지 않았다**. 타 스트림 Draft PR #21/#25/#29에서 동일 서식·원금/이자·날짜 관련 변경이 진행 중이므로 이번에 계산/법률 의미를 바꾸지 않았다. A1-CALC-016 [ ] 유지.

## 실제 실행 결과 — 합성 격리 검증만

| 검사 | 기대값 | 관찰값 | 인증 단계 |
| --- | --- | --- | --- |
| 원본 final-review approve의 거절반례 | 사유 보존·오류 | 사유 삭제·자식 오류 0 | **기존 결함 V8 재현** |
| PR #32 helper 원본 GitHub 본문 (null, {}, array, false, 문자열, 200, 202 등) | 명시적 `committed===true`만 true | **10/10 기대 일치** | **격리 V8 실행** |
| PR #32 final-review approve 실제 함수본문(거절/불확실/커밋) | 거절·불확실 사유 보존, 커밋 시만 삭제 | **3/3 기대 일치** | **격리 V8 실행** |
| 수정된 전체 UI 코드 계약 읽기(명시적 3상태, 기존 ID 보존, 문안·사업 승인 분기 등) | 수정 전 문제 경로 우회 없음 | **7/7 정적 조건 일치** | **정적 코드 검사** |
| 신규 `tests/command-submit-outcome.test.ts` 로컬 미러 Node 22.16 `node --experimental-strip-types --test` | 1 테스트/10개 단언 통과 | **1/1 테스트 통과** | **별도 작업 디렉터리에 2개 신규 파일만 동일 내용으로 복사해 실행** |

**주의**: 로컬 미러에서는 Node 22.16에 `--experimental-strip-types` 옵션이 필요했다. 옵션 없는 `node --test`는 `ERR_UNKNOWN_FILE_EXTENSION(.ts)`으로 실패했다. 앱 `package.json`의 기존 테스트도 `--experimental-strip-types` 사용. 위는 **앱 전체 Node 회귀 결과가 아니며**, 실제 GitHub 체크아웃에서 테스트·TypeScript·lint·build/브라우저/D1/R2/Word는 미실행.

## 수정 범위·남은 인수·다음

- 수정 제안은 main이 아닌 **Draft PR #32**, 시작 branch SHA `bfc822c288832aabd9fd0dde3f6dfb408c6be344`, 최신 branch SHA `bb82a8eaf6c1f1983c759a91362ef43bdf663748`.
- 변경 파일: `components/case-workflow.tsx`, `components/document-review-finalization.tsx`, `components/case-review-actions.tsx`, `components/business-monthly-review.tsx`, `lib/command-submit-outcome.ts`, `tests/command-submit-outcome.test.ts`. 경로 전부 ax-site 내부.
- **미검증**: 현재 main 전체 Node 테스트·TS·lint/build, 실제 UI 네트워크 실패/중복 POST/202 E2E, 임시 입력 보존/복구 시 사용자 동작, 실제 D1/R2/Cron, 공식 법원 양식, 변호사 독립검수, 배포. [ ] **3개 모두 유지**, 최종 합격 0.
- 다음 역할: **서류담당자/변호사/데이터담당자**. 후보 `A1-DOC-018`(새로고침·네트워크 재시도), `A1-LAW-017`(실제 법원 보정 상태 증빙), `A1-DATA-018`(재분류·기준정보 변경 소비처 재투영). 이 중 먼저 기존 PR #28 최종 검수자 분리, PR #32의 사용자 알림·기존 명령 영수증 분기를 통합 점검한다.
- 운영 배포/마이그레이션/법원 제출/실제 의뢰인 데이터 수정 **없음**.
