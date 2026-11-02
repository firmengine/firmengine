# FirmEngine A1 — 81차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-02 21:51 KST)

- **범위 고정:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만; 실제 운영시스템·고객데이터·원문 OCR·키·.env·비공개 정답 접근/변경 없음.
- **역할 순환:** 80차 IT→AX→계산사무장 이후 이번 **사용자·서류담당자(A1-DOC-017) → 변호사(A1-LAW-018) → 데이터담당자(A1-DATA-017)**.
- 최초 main **13579dd6eda3a7c66f609770f9032e18b0282e45**; 영수증 작성 직전 HEAD **13579dd6eda3a7c66f609770f9032e18b0282e45**. 중앙 보드 blob **dc7e1e32aaa25a27ebc99d24a900109dbbfafdc9**. 최신 커밋/PR 목록·80차 영수증·43/49차 관련 영수증·main workflow/사실타입/절차/DB schema·PR #20/#90 실제 코드 및 테스트를 재조회. PR #20 HEAD `1395c93fb305700332c1c6604a1bcf332f56b562`, PR #90 HEAD `e0083fed255d881c673a5830ec368a733716d334`, 모두 Draft·미병합.
- **검증 방식:** GitHub에서 가져온 실제 TS의 검증 함수·표시 함수·문서 철회 함수·typed invalidation helper 본문에서 타입 선언만 제거하여 V8에서 **즉시 실행**. 외부 의존성은 명시적으로 합성 대체. JSON 타입에 한해 `structuredClone`을 JSON 직렬화 복제로 대체; `invalidateExports` 부작용은 stub(따라서 export invalidation은 **미검증**). 이 결과는 독립 합성 단위 검증이며 전체 Node/React/API/D1/R2/Word/CI/브라우저/법원 문서/사람 승인이 아니다.

## A1-DOC-017 [ ] — 내부 보완 후보와 실제 법원 보정명령의 UI 표시

- main `components/case-workflow.tsx` blob `2ec797958726b99a4358ec46ef35f78f90bfd927`, `lib/approval-readiness.ts` blob `d3aecf05688d3146ecff94a3795bb3da8a215d35`. 기존 Draft PR #90 표시 함수 blob `e1f9bc1583b0ee503286374fd704ab5a54698263`, UI blob `3ae63b4e6ec41c66f9c7682a31aef4294a43a215`.
- **실제 PR #90 표시 함수 V8 4/4 독립 기대 일치:** `correction_requested`→`법원 보정 요청 기록(원문 검증 별도)`; `amended`→`보정 제출 기록(접수증 검증 별도)`; `approved` 및 `generated`→기존 fallback 보존.
- **원본 UI/PR UI 정적 연결검사 6/6 관찰값 일치:** main은 `["correction_requested","보정 요청"]` 표시·이벤트 `label(event.state)`만 사용, 법원 원문/접수증 경고 없음. PR #90은 `COURT_PROCEDURE_NOTICE`와 `procedureEventDisplayLabel` 사용·명시적 경고 존재; 양쪽 모두 절차 기록 명령 자체는 남는다. 이 여섯 건은 **정적 소스 조건**, 렌더링 실행이 아니다.
- **교차 경계(source-only):** readiness는 `internal_candidate`와 `recorded_court_event`를 분리하지만 기록된 `correction_requested`를 `isOfficialCourtCorrectionOrder:true`로 제시한다. 법원 원문 종류/진위의 실질 검사와 동일하지 않으며, 아래 LAW-018의 잘못된 문서종류 수용과 결합하면 UI 표기만 고쳐서 전체 오류가 해결되지 않는다. 종단 재현은 미실행.
- 기존 #90이 `case-workflow.tsx`를 수정하며 #32 등과 통합충돌 가능. 신규 중복 PR/코드 수정 없음.

## A1-LAW-018 [ ] — 자동 서식·직원 절차기록과 법원 제출/인가 구분

- main `lib/case-procedure-events.ts` blob `7c61fdfb6e79becc415a8b1385a1580bd8aa6ab2`; main `case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`.
- 독립 기대(실행 전): draft/generated/human-reviewed는 법원 승인 아님; court 관련 상태는 활성 동일사건 문서·사건번호 외에도 **법원 문서 종류/증명 근거**를 별도로 요구해야 한다. `validateProcedureEvent`에 **가상** 문서목록 `["bank-doc","court-order","receipt-doc"]`와 `knownArtifacts=["draft"]`를 전달한 **12개 원본문 V8 테스트: 10/12 독립 기대 일치**.
- 관찰: `generated`, `human_reviewed`, `sent` 입력(법원 자료 없음)은 일반 내부 절차 기록으로 허용; `submitted`+접수자료/사건번호, `correction_requested`+court-order/사건번호도 허용. 문서/사건번호 누락, 미등록 ID, 잘못된 날짜, 알 수 없는 산출물 ID는 거부.
- **기존 P0 반례 2건 재현:** `{state:"correction_requested",sourceDocumentIds:["bank-doc"],courtReference:"court-2026-test"}`와 `{state:"approved",sourceDocumentIds:["bank-doc"],courtReference:"court-2026-test"}` → 독립 기대 `reject`, 실제 **둘 다 allow**. `validateProcedureEvent`는 문서 ID가 존재하는지만 확인하고 발령·인가 원문 종류는 식별하지 못함. `case-commands.ts`의 상위 reducer가 활성 문서/권한을 확인하는 소스는 별도로 존재하며, 실제 HTTP 경유 승인 우회·법원 인가가 발생했다는 의미 **아님**.
- 독립 법률 검토·법원 원문 진위·공식 제출기한·접수증/인가 원본 인증 규칙은 변호사/정책 담당자 검토 필요. 기존 이슈 #11에 기록된 같은 경계이므로 중복 결함 집계·법률 의미 임의 변경 없음.

## A1-DATA-017 [ ] — 서류 철회·재분류 뒤 typed/법률 상태 전파

- main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, main `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`. 기존 Draft PR #20 `lib/document-evidence-cascade.ts` blob `711927af2aee618e6abbef4dec03703513923948`, `case-commands.ts` blob `5802c894ebbfafedaf61b4dfaeeb1739b509e331`.
- 합성 사건 A: 문서 `DOC-OLD`, 파생 문서 `DOC-CHILD`, 무관 문서 `DOC-B`; Fact `FACT-A`(원문 123) / `FACT-CHILD` / 무관 `FACT-B`(456). `FACT-A`에 연결된 debt-a `legalReview=accepted`, income-a `recognition=accepted`, household `recognition=accepted`; debt-b/asset-b는 무관 Fact에 연결. 대체 검증 숫자는 모두 **가상**이며 법적 인정값이 아니다.
- 실제 main `touchCase`+`currentFacts`+`retractDocument` 함수 V8: **8개 조건 중 5개 독립 기대 일치.** 원본/자손 문서 삭제, 해당 현재 Fact 철회, 무관 Fact 유지, 원본 사건 스냅샷 불변은 기대와 일치. **typed debt·income·household가 기존 accepted를 유지하는 3건 불일치**. `document.role` reducer도 관련 fact 철회·match stale은 있으나 같은 typed 무효화 호출이 없다는 것은 별도 **정적 확인**.
- PR #20의 실제 `invalidateWithdrawnDocumentEvidence` 함수 본문을 철회된 합성 결과에 적용: **12/12 독립 기대 일치**. 영향 대상 3개(income/debt/household) review 해제, 철회 factId 제거, 무관 debt-b/asset-b 그대로 유지, 금액 123 보존, inventory 3종 unknown, 두 번째 호출 대상 0·동일 상태, 원본 입력 사건 불변.
- **주의:** main의 `retractDocument` 본문만 실동작 확인; export invalidation 함수는 stub이고, PR의 `reduceCaseCommand`/queue/SQL 커밋·원문 재분류·동시 2사건·기준정보 변경→전체 18계산/95법률/서식 재투영은 수행하지 않음. PR #20은 helper 및 연결 코드 수준의 수정 후보이고 종단 인수 완료가 아니다.

## 코드 조치·인수 경계

- 기존 미병합 #90/#20, 고위험 이슈 #11이 동일 원인을 다루므로 중복 코드 패치·새 PR 생성 없음. 모든 감사 결과는 **[ ] 미완료**로 보존. 신규 확정 결함 0건(기존 P0·UI 경계 재확인).
- **실제로 실행한 것:** GitHub 함수 본문 V8 검증: 표시 4/4, 절차 검증 10/12, main 문서 철회 5/8, PR helper 12/12; 정적 UI 소스 6조건. 독립 기대와 일치 수치는 법적 정확도·실서비스 통과율이 아니다.
- **미관찰:** 전체 Node/TypeScript/CI/빌드, React UI/브라우저, authenticated HTTP, staging D1·R2·Cron, 실OCR/85서류/18계산/95법률, 공식 C01/C02/C04·법원 서식, 변호사 승인 및 법원 제출/인가. `null`·0·미관찰·source-only·비해당·상충·승인전 구분을 보존; 법률 확정 승격 없음.
- 다음 역할 **IT담당자 → AX담당자 → 계산사무장**; 다음 ID `A1-IT-016` (최신 HEAD 테스트 실행 영수증), `A1-AX-011` (승인전 객체 자동 채택 금지), `A1-CALC-009` (가구원/부양증빙 상충 시 생계비 보류).
- 운영 배포/D1 운영 migration/실제 전자제출/법원 인가 확정 미수행. 실제 Extra High 추론 모드 여부 미확인. 제품 전체 종단 인수 **0건**.
