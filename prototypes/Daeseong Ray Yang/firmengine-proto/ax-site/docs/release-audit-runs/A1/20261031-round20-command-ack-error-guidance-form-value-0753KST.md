# FirmEngine A1 — 20차 코드 완결성·상호 기능충돌 감사

- **범위:** `firmengine/firmengine` main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위에 한정. 19차 A1 감사 영수증 및 중앙 인수보드와 최근 커밋/열린 PR를 먼저 대조.
- **감사 시작 main SHA:** `4798d673e8d009d468b7d701d878d14c0db8fb61` (2026-10-31 KST).
- **역할 순환:** 직전 DOC/LAW/DATA 다음 IT 담당자 **A1-IT-015**, AX 담당자 **A1-AX-017**, 계산사무장 **A1-CALC-016**.
- **검증 범주:** GitHub main 실제 함수 소스에서 타입 문법만 제거한 V8 격리 실행·합성 입력과 소스 조건 정적 비교. 실제 Next.js 전체 테스트, 사이트 브라우저, CI, Cloudflare staging D1/R2/Cron, 공식 Word 서식·변호사 실무검증·배포는 **미수행**. 격리 통과≠전체 인수.
- 샘플은 모두 **가상 숫자·가상 영수증**. 고객정보·키·실제 OCR 문장·법원 사건번호·비공개 정답을 저장하지 않음.

## A1-IT-015 — 명령 200/202와 실제 저장영수증 분리

**원본 SHA**
- `lib/case-command-store.ts`: `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`.
- `app/api/cases/[id]/commands/route.ts`: `44c267951751d280d0f1c27ac6b3362bd7f9b9d6`.
- `components/case-workflow.tsx`: `2ec797958726b99a4358ec46ef35f78f90bfd927`.
- 기존 수정 후보 [Draft PR #32](https://github.com/firmengine/firmengine/pull/32)의 `lib/command-submit-outcome.ts` blob `5e4af86131ba5ed7f8d223c6a4b4c8c634c25121` (main 미병합).

**실행:** 실제 `commandResult` 함수 본문을 V8에 격리하고 `caseResponse`만 성공/일시실패 대체. (1) 정상: `committed:true` + 사건 revision 반환, (2) 읽기 실패: `committed:true,pending:true,code:EVALUATION_PENDING` 반환. **2/2 독립 기대 일치**. 202 pending은 DB 명령 커밋의 후속 평가 미완료이며 법률 인정·문서 완성을 의미하지 않음. 저장이 불분명한 HTTP 200의 `committed` 누락을 성공으로 위장해서는 안 됨.

**실행:** PR #32의 실제 `hasCommittedCommandReceipt` 본문을 V8에서 입력 `null,{},{receipt},committed:false,committed:"true",pending:true,committed:true,committed:true+pending,[],{code:"OK"}` 10종에 적용. `committed:true` 두 조건에서만 true, 나머지 false: **10/10 기대 일치**. 그러나 현재 main UI는 HTTP `response.ok`만으로 pending을 해제하고 성공 메시지를 줄 수 있어 **기존 P1 수정안 미병합**. 메인 제품파일을 PR #32와 중복 수정하지 않음.

## A1-AX-017 — 오류 발생/영향/복구 안내

- 원본 UI SHA: `2ec797958726b99a4358ec46ef35f78f90bfd927`. 화면은 `lastError`가 있을 때만 원인 텍스트 표시. `failed` 또는 재투영 가능상태에서 `currentDataVersion`이 **숫자**일 때만 재시도 버튼 표시. 오류의 영향 범위/다음 책임자/복구 차단 사유에 대한 독립 구조화 안내는 이 컴포넌트에서 **미관찰**.
- 조건식 그대로 합성 입력 4건 계산: `failed,null→재시도 숨김`, `failed,0→표시`, `failed,5→표시`, `running,5→숨김`; **4/4 실제 조건과 독립 UI-표시 기대 일치**. 특히 `failed + lastError 없음 + currentDataVersion=null`일 때 단순 상태 문구 외 복구 안내가 충분한지는 **UI/운영 직원 확인 필요**. null은 0과 다르며 임의로 0으로 보정 금지.
- PR #32가 동일 `case-workflow.tsx` 파일을 변경하므로 UX 변경 코드를 중복으로 밀지 않음. 직원/AX 합의된 오류 분류·복구 행동 계약과 브라우저 E2E 필요. 해당 ID [ ] 유지.

## A1-CALC-016 — D5103/D5110 저장 숫자와 표시 숫자 동등성

**원본 SHA**
- `lib/legal-calculation-readiness.ts`: `9edab755df5adae5f143d15285c550feb0e0f6d5`.
- `lib/document-preflight.ts`: `dc771c0ff0497d24df19478b0366ebbb397bfbf2`.
- `lib/form-mapping.ts`: `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`.
- `lib/form-contracts.ts`: `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef`. DB 스키마 `db/schema.ts`: `933f8686845ac14669312dd21bf85e02c62ed5e6`.

**함수 실행:** main `reviewLegalPlanArithmetic` 실제 본문에서 TS 타입만 제거해 V8 격리 실행. 가상 D5110 수입 3,000,000/생계비 2,000,000/월 가용소득 1,000,000/월계획 600,000/36개월/총액 21,600,000/현재가치 10,000,000/청산가치 8,000,000을 기준으로 정상, 산식 불일치, 48개월, 61개월, 청산가치 역전, 월변제액 초과, 명시 0 및 비정상 구분기호를 시험. 정상·산식/기간/가치·명시 0 등 **7/8 기대 부합**, 비정상 수 `1,00`은 원단위 입력으로 무결하게 거부할 수 없음. 별도 `document-preflight.ts` 실제 `numeric` 함수 본문 V8 6건 실행에서 `1,000→1000`, `0→0`, `-10→-10`, 미확정표기→null은 기대 일치. `1,00→100`, `1,,000→1000` 두 건은 독립 기대 null과 **불일치 (4/6)**. 이는 이미 [Draft PR #53](https://github.com/firmengine/firmengine/pull/53) 및 [Draft PR #58](https://github.com/firmengine/firmengine/pull/58)에서 검토 중인 동일 표시금액 무결성 문제이므로 **신규 결함으로 중복 집계·코드 변경하지 않음**. 해당 PR들의 전체 프로젝트/실제 Word 테스트는 본 회차 미실행.

**렌더-계산 경로 별도 비교:** main `renderPublicForm`의 D5110 원본 테이블 토큰 치환 분기를 합성 `<w:tbl>` 7토큰으로 V8 실행. `approved_monthly_income→monthly_income`, `monthly_disposable_income→form_pre_fee_disposable`, `monthly_payment→form_available_after_trustee`, `total_repayment→form_total_available_after_trustee` 등 **7개 토큰 의도대로 치환** 관찰. 가상 계산값의 계획 월변제액 600,000/계획총액 21,600,000에 비해 출력 기본 가용소득 계산 표의 월액 850,000/36개월 총액 30,600,000이 될 수 있음. 저장 계획액과 **다른 의미의 관측 기본 가용소득**을 출력하는 명시적 설계이고 주석도 별도로 삽입됨; 따라서 오류·법률 부적합으로 자동 확정하지 않음. 다만 같은 `D5110`의 `monthly_payment/total_repayment` 표시가 검증 대상 저장 계획 숫자와 다를 수 있어 **서식 토큰별 표시값↔계산 원천↔산식/계산runId 추적/독립 실무검증 필수**. 위 검증은 합성 XML 분기이며 원본 DOCX 바이트 렌더 실행이 아님. 승인 전 [ ] 유지.

## 조치·잔여·다음 회차

| 체크 ID | 이번 관찰 | 코드 조치 | 인수 |
| --- | --- | --- | --- |
| A1-IT-015 | 실제 `commandResult` 2/2, PR #32 수정보조 함수 10/10 합성 기대 일치 | 기존 미병합 PR #32 중복 수정 금지 | [ ] |
| A1-AX-017 | 오류/재시도 노출 조건 4/4, null과 0 구별 확인. 원인/영향/복구 UX 계약 미관찰 | 동일 UI 파일 변경 PR #32와 충돌 방지, 설계/브라우저 검증 필요 | [ ] |
| A1-CALC-016 | 실제 산식 V8 7/8, 수표시 parser 4/6, D5110 합성 XML 7토큰 치환 관찰 | 기존 PR #53/#58 중복수정 금지, 렌더 의미변경은 법률·계산 실무 검토 별도 | [ ] |

- **신규 변경:** 이 감사 영수증 및 A1 세 ID에 한정된 중앙 보드 기록. 제품 실행 코드 **main 불변**, 추가 PR 0개, 기존 Draft PR #32/#53/#58 모두 미병합 상태.
- 미관찰·null·정상 0·비해당·상충·source-only·승인전 상태를 서로 다른 상태로 유지. 실제 문서·법률상 확정값으로 승격시키지 않음.
- **다음 역할 전환:** 서류담당자 `A1-DOC-017` (실제 법원 보정 vs 예측 질문 UI), 변호사 `A1-LAW-018` (법원 인가 이벤트와 일반 증빙 분리), 데이터담당자 `A1-DATA-018` (전체 API의 합성/실사건 격리). 기존 PR #32·#58 전용 Node/CI/D1/Word 병합 검토는 별도로 추적.
- 운영 배포, 운영 마이그레이션, 실제 전자제출, 법원 인가 확정 **미수행**.
