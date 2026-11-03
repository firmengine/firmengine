# FirmEngine AX A1 — 93차 가족·집행절차·주체유형 교차 기능 감사 (2026-11-03 KST)

- **범위:** `firmengine/firmengine` main / `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 전 회차(92차 IT→AX→CALC)에서 이어 **사용자·서류담당자 → 변호사 → 데이터담당자** 순으로 3개 미검증 ID **A1-DOC-005 / A1-LAW-006 / A1-DATA-005**를 검증. 모두 **[ ] 유지**.
- **착수·쓰기 직전 main SHA:** `4a2a4b50f065c48f7627899e01887cc626247d00`. 최근 main 커밋 10건(A4/A3/A2 및 A1-r92 포함)과 최신 open PR 12건, 92차·57차 기존 영수증, 단일 중앙 보드 blob `2c1a130c4b880e80dfe4c2be90a9452915b29030`, 관련 코드·스키마·기존 테스트를 GitHub Connector로 읽음. 관련 Draft [#137](https://github.com/firmengine/firmengine/pull/137)은 **open/draft**, HEAD `2d03a617f7c796ea1216d03d2327edf626b2a174`.
- **실행 범위:** GitHub main에서 받은 **실제 `matchIntakeChecklist` 함수 본문**을 TypeScript 표기만 제거하고 Code Mode V8에서 15회 실행. 원문 catalog `reference-intake-catalog.json` 실파싱. 함수의 catalog validation/ID/date/list/record 등 **외부 검사 helper는 합성 stub**이므로 전체 엔진 입력검증 통과로 간주하지 않음. `validateProcedureEvent` 실제 함수 본문 V8 9회. `case-commands.ts` 원본 및 PR #137의 실제 `subject.link` 유형검사 경계와 `subjectLinkTargetKindAllowed` 원본문을 V8에서 합성 16회씩 실행. **첫 두 TypeScript 변환 컴파일 실패 시행은 무효·집계 제외**.
- **모든 테스트 데이터:** 가상 상담 인물, 가상 문서 ID·날짜·금액 및 합성 범주. 실제 고객정보/원본 OCR 사실값/키·.env·비공개 정답 없음.

## A1-DOC-005 [ ] — 가족관계·주소·혼인·부양 변경

**source:** `lib/intake-engine.ts` blob `82ddba689ea6d107ba587235205feef45e058527`; 기본 `lib/reference-intake-catalog.json` blob `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`; 추가 규칙 `lib/intake-court-coverage.ts` blob `f0c00dc5322aa74feb9d634842483d0b8553b1fa`; `lib/intake-types.ts` blob `24788d5edc77d7af97e105992d381d44064cf8e2`. `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`도 확인.

**독립 기대/입력/관찰:** 실 catalog와 원본 matcher에 `courtId=seoul`, `asOf=2026-11-03`, `basis=client_report`·합성 인용이 부착된 상담 claim을 투입. 8개 조건 **8/8 기대 일치**.
1. 가족 claim 미관찰: 기본 `family_relation` 존재, `dependent_evidence` 자동 생성 없음.
2. `household.dependents` present: `dependent_evidence:legal_review`; absent: 미생성; unknown: `qualification_needed`.
3. `household.spouse_assets` present: `spouse_asset_evidence:legal_review`.
4. `event.divorce` present: `divorce_records:legal_review`; 시점 uncertain: `qualification_needed`; 과거 present: 과거 관련 자료는 법률검토 대상으로 남음(현재 혼인 상태 확정 아님).

**남은 기능 공백:** 기본 49 feature에는 독립 주소변경·현재 혼인상태 변경·효력일·동거·부양인원 이력용 필드가 없음. 추가 INTAKE-066은 인적사항/관할 확인, INTAKE-070은 이혼 등 가구 변동 원천 확인 경로이며 **변경 시점·법률효력을 자동 확정하는 계약 아님**. 실제 주소변경/혼인변동 전후 상담기록 재분류→85종 요구서류 차이→D1 저장·UI·직원 승인 종단 미실행. 8/8은 특정 기존 기능 조건의 **격리 합성 실행** 결과이지 ID 인수 완료 아님.

## A1-LAW-006 [ ] — 소송·압류·전부명령 위험/원천 구분

**source:** 위 intake engine/catalog 외 `lib/field-applicability-contracts.json` blob `6076b26f782c4643a21a7b2f1a8f6261bb588b68`, `lib/case-procedure-events.ts` blob `7c61fdfb6e79becc415a8b1385a1580bd8aa6ab2`.

**독립 기대/입력/관찰:** `debt.disputed` present → `litigation_record:legal_review`; absent → 해당 요구 없음; uncertain temporal/past → `qualification_needed`. `procedure.court_order` 현재 present → `court_correction_order:legal_review`; 과거 present → `qualification_needed`이며 현재 명령의 확정 제출 요구로 승격하지 않음. 소송·집행 언급 미관찰에서는 `litigation_record` 생성 안 됨. 이 7개 matcher 시나리오 **7/7 기대 일치**.

동일 원문 JSON에서 `litigation_enforcement`(11 필드), `account_garnishment`(10 필드), `procedure_enforcement_garnishment`(13 필드)의 source-conditional 슬롯을 확인. 주문액·실제 압류액·해제액, 송달일·발령일·효력일, 채무자·채권자·계좌명의자는 구분되어야 함. 계약 존재는 **source-only**이고 해당 사건의 Fact 인식/법적 효력 승인 아님. 기본 상담 feature에는 독립 압류·전부명령 사실 트리거가 **없어**, `debt.disputed`가 없는 단독 집행에 의한 자동 요구서류·리스크 경고를 입증하지 못함.

실제 `validateProcedureEvent` 함수의 합성 9개 조건 **9/9** 기대 일치: 유효한 `correction_requested`, 법원 ref 누락/문서 누락/다른 사건 문서/미등록 상태/빈 actor/잘못된 일자 차단, 내부 `generated`의 미확정 출처 허용, **`approved`는 같은 사건 문서 ID·courtReference 존재만으로 데이터 모델에서 수용**. 마지막 조건은 **절차 이벤트 레코드의 유효성일 뿐 법원 승인/효력 증명 아님**. 인가 자동확정 판단·실제 서류·변호사 검토·법원 송달/압류/전부명령 법적 효력은 모두 미검증. 입력 출처·상태와 사람이 승인한 법적 결론의 분리가 중요.

## A1-DATA-005 [ ] — 주체·배우자·채권자·사업자·계좌 타입 혼합

**source:** main `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378` 및 `lib/party-identity.ts` blob `4c5df4399298fe314f6d978c4a68c4285914664a`. 관련 기존 `tests/intake-workflow-domain.test.ts` blob `49612662596b9ed845a5933f0fc6e67ad87e8cda` 읽음. 기존 [Draft PR #137](https://github.com/firmengine/firmengine/pull/137): `case-commands.ts` blob `d68fd13fa32c0f419a5e2e3764ac167321805fc1`; `party-identity.ts` blob `0094a388459ee48a92562504fda0f1f3999afa7b`; `tests/subject-link-kind-r57.test.ts` blob `ef3c6125e71c96d5b71b817ffbe67fd9946d349c`.

**독립 기대/입력/관찰:** 합성 `case`·`income`·`debt`·`asset` 항목 ID를 가진 같은 사건에서 상담 subject scope별 16개 조건. 같은 유형의 단일 목적지만 수용, income→debt/asset/case 및 debt→asset 등 교차유형·`household/event/procedure/expense`를 임의 다른 엔티티로 연결·두 유형이 같은 ID로 충돌·미존재 ID는 거절 기대. **main 5/16**, **Draft #137 16/16** 독립 기대 일치. 현재 main 원본 `subject.link` 경계는 현재 사건의 어느 목록이든 ID만 존재하면 수용(11개 반례). PR #137은 정확히 단일 `targetKind`+동일 `subjectScope`를 요구하여 이 테스트에서는 거절.

**여전한 안전/호환성 공백:** PR은 typed `case/income/debt/asset`만 허용하며 배우자·사람·계좌·사업자/가구·절차의 별도 타깃 crosswalk가 없음. 승인 담당자의 실제 ID 대조, 명의·실질 귀속, 동시 사건에서의 외부 ID 유일성, 철회·CAS·D1 persisted path, 브라우저/Node/CI 미검증. 무조건 병합하면 기존 household 등의 확인 작업이 중단될 수 있어 **Draft #137 미병합 유지** 및 IT·데이터담당자·변호사 통합 검토 필요. 기존 Draft로 같은 원인 수정 중이어서 제품 코드/신규 PR 중복 작성하지 않음.

## 결론·추가 인수

- 선정한 3개 ID 모두 **[ ] 유지**. 함수/명령 경계 합성 실행: DOC 8/8, LAW matcher 7/7 + procedure validator 9/9, DATA main 5/16 vs 기존 PR 16/16. **정적 카탈로그/field 조회는 실행 테스트 통과 수치에 포함하지 않음**.
- **코드조치:** 신규 제품 실행 코드 수정 없음, 신규 PR 없음. 감사 기록과 중앙 보드 해당 3 ID만 보존 병합한다. 기존 관측된 DOC/LAW 독립 트리거 공백과 DATA 교차유형 결함 후보은 구현완료·법률완결로 승격하지 않음.
- **추론/실행 모드:** Extra High 실제 설정 여부 확인 불가. V8 함수 격리 ≠ Node 프로젝트 회귀 ≠ TS/lint/build/전체 CI ≠ 브라우저·staging D1/R2/Cron ≠ 공식 양식·변호사 승인 ≠ 운영 배포. 현재 전체 A1 제품 종단 인수 0건.
- **다음 역할:** IT담당자 → AX담당자 → 계산사무장. 보드의 정확한 다음 ID **A1-IT-005**(상담 변경의 요구서류·원문 판본 전파), **A1-AX-005**(근거 없는 금액·날짜·결론 환각 차단), **A1-CALC-005**(12개월 11개월 누락 평균 부당확정 방지).
- 운영 배포·D1 운영 마이그레이션·실제 전자제출·법원 인가 확정 실행하지 않음. 개인식별정보·실제 원문/키 공개 Git 기록 없음.
