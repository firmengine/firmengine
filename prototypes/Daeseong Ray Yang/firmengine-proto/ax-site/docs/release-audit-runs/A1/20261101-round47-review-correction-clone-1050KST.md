# FirmEngine A1 47차 — 최종 검수 / 보정명령 출처 / 합성 사건 격리

- 일자: 2026-11-01 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하.
- 감사 시작 main: `25eea38428a567859d80be33d160e429b240fdb0`. 직전 46차 감사 영수증, 단일 중앙 인수 보드, 최근 커밋/오픈 PR, 관련 코드/테스트, Drizzle 스키마 검토. 보드 최초 blob `f4ee8701a34ce4d56a08a8fd922dc75ddb93377f`.
- 역할: 46차 IT/AX/CALC → 47차 DOC/LAW/DATA. 대상: **A1-DOC-016, A1-LAW-017, A1-DATA-018**. 세 항목 모두 [ ] 유지.
- 수행 방법: GitHub의 실제 main/PR 함수 내 JS 판정식을 추출하여 V8에서 합성 조건 실행. TypeScript 모듈 전체 구동은 아님. Node 신규 회귀/CI/실제 API·DB·브라우저·D1/R2/Cron/공식 법원 서식/실무 변호사 승인 없음. 실제 고객정보·키·원본 OCR 값을 사용하거나 공개하지 않음.

## A1-DOC-016 [ ] — 최종 문서 직원/변호사 이중 검수

- main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, 기존 Draft [#28](https://github.com/firmengine/firmengine/pull/28) HEAD `9d2f2d2ae326a7f63b21f41f82a5756e9472456c`.
- 실제 `currentExportReviews`의 lawyer current 판정식을 추출. 합성 manifest fingerprint='fp', caseRevision=1, caseworker.actor='staff-A'.
- 기대/관찰: lawyer.actor='staff-A' → 독립 승인 아님. **main은 current로 표시(불일치)**, #28 수정 식은 null (일치). lawyer.actor='lawyer-B' → main과 #28 모두 current (일치). main 1/2, #28 2/2.
- 이미 존재하는 Draft #28과 동일 결함이며 추가 수정 없음. 실제 문서 검수 UI/저장·역할 부여/승인 서명·배포/서식 인수 미실행.

## A1-LAW-017 [ ] — 법원 보정명령 원본·기한·접수증 연결

- main `lib/preapproval-correction-item-store.ts` blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`, 기존 Draft [#68](https://github.com/firmengine/firmengine/pull/68) HEAD `9ca26c047f51e43d28ec4ee47cb5f9626cc337ec`; #68 소스 blob `81268a54216b1b7b6f40acda8510d09edcfae44c`.
- 합성 법원 보정명령 발생일 2026-10-30, 같은 사건번호 `ref`의 응답 접수 이벤트 `r` 발생일 2026-10-20 / 2026-10-30 / 2026-11-05 / invalid. 원문/제출·접수 문서의 실제 법원 여부는 합성에서 가정하지 않음.
- **독립 기대**: 선행 응답·invalid 날짜는 원천 연결 불가, 당일 또는 이후는 단지 연결 후보. 실제 main 응답 판정식은 선행 2026-10-20을 **허용(결함 재현)**, 이후는 허용(일치). 기존 #68 응답 판정식은 선행/당일/이후/invalid **4/4 기대 일치**.
- 위 결과는 법원 원본 발급/송달일, 진짜 제출기한·접수증 진위, 사건별 GET 읽기 권한([Draft #36](https://github.com/firmengine/firmengine/pull/36)), 공식 접수·인정 여부를 검증하지 않음. 모든 상태 사람 검토·법원 미확정.

## A1-DATA-018 [ ] — evaluationClone 단독 사건의 승인 및 문서 등록 격리

- main `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`와 `app/api/cases/[id]/documents/route.ts` blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`.
- `assertMutableCase`는 평가용 복제 사건의 수정 자체는 허용하도록 설계된 반면, 같은 파일의 `isSynthetic`는 `structuredTest || referenceTest`만 검사하여 **evaluationClone 단독 marker는 false**. 실제 `fact.review`, `object.review`, `legalCheck.dispose`, `document.review`, `procedure.record` 등 승인·법원 상태 명령이 해당 가드를 사용함을 코드 경로에서 확인. 실제 명령 종단 실행은 미완료.
- V8 실제 main 함수식 합성: 일반 사건 false/expected false, structured only true/true, reference only true/true, **evaluationClone only false/expected true**, 복합 clone true/true, null 모두 false/false. main **5/6**. 문서 POST는 structuredTest만 검사하므로 clone-only에서 차단되지 않음(기존 P1 [#72](https://github.com/firmengine/firmengine/pull/72) 과제).
- 작은 수정 [Draft PR #118](https://github.com/firmengine/firmengine/pull/118): `isSynthetic`에 `evaluationClone` 추가. main source blob `d18c555f04f65687c509a8e8d35aba4bb3597378` → PR source blob `b286b1a9f6af018ee4cacc2b6c6966b926b9dbd4`. V8 실제 수정 함수식 **6/6 독립 기대 일치**. `tests/case-command-evaluation-clone-guard-r47.test.ts` 신규 테스트 3개 (사실 승인/객체 승인/법원 제출 상태) 작성만, 테스트 blob `8a1708016db964ac14b848d9d26cd9e00510e72b`, Node 실행하지 않음.
- 기존 #72의 문서등록 helper/route를 별도 읽고 helper 식으로 ordinary/structured/reference/clone 4조건 **4/4 일치**, #72 미병합. #118은 `case-commands.ts`+신규 테스트 파일, #72는 문서등록 경계로 작업 부위 분리; 통합 회귀·실제 저장 E2E 필요.
- **P1 후보 1건**: 합성 평가 복제 사건에서 사실/법률/법원 처리의 인증된 사람 승인도 원천적으로 금지해야 하는 안전 경계 누락. 이는 guard/branch 단계의 재현이지 실제 악성 사건이나 승인 기록이 저장됐다는 입증은 아님. 실무자 검토·종단 검증 전 Draft 유지.

## 합성 실행 범위·결론 / 다음 회차

- 실제 소스에서 추출한 판정식: DOC main 1/2, DOC #28 2/2; LAW main 1/2, LAW #68 4/4; DATA main 5/6(+document POST clone guard 독립 불일치), DATA 수정 #118 6/6, 기존 #72 helper 4/4.
- PR #118 HEAD `479a5cd16a5e520e2f8bee173c673cf3f3a49415`, 변경 파일 2개 모두 허용 경로 내부, Draft·미병합. 동시 PR과의 충돌/전체 CI 합격 의미 아님.
- 전체 A1 인수 완료 0. 신규 Node 회귀 실제 실행/HTTP·DB·R2/실제 변호사 승인/법원 원본 인증 없음. 운영 배포·D1 운영 migration·실제 전자제출/법원 인가 확정 금지, 모두 미실행. 실제 모델 Extra High 실행 모드는 확인되지 않음.
- 다음 역할 **IT/AX/CALC**로 순환. 보드에 존재하는 다음 ID: **A1-IT-015**(API 응답과 UI 상태·타입 일치), **A1-AX-011**(사람 승인이 필요한 객체의 자동 채택 우회 금지), **A1-CALC-010**(0원·미관찰·음수/과소수입 상태 분리). 실제 제목을 보드에서 재확인했으며 다음 회차에도 최신 미완료 상태를 다시 대조한다.
