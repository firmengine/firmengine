# FirmEngine A1 57차 — 가족·주소 서류 / 집행명령 근거 / 주체 유형 오연결

- 일시: 2026-11-01 KST, 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **하위만**.
- 시작 `main` 확인: `af922ef1e9b8436044b3a0db5495c8b405c21783`; Draft PR 작성 직전 `main` `ce6cb4644a101925d4a7d3123c94caf499b384c9`; 영수증 쓰기 직전 HEAD `ce6cb4644a101925d4a7d3123c94caf499b384c9`.
- 순환: 56차 IT/AX/CALC → **서류담당자 / 변호사 / 데이터담당자**. 중앙 보드 `A1-DOC-005`, `A1-LAW-006`, `A1-DATA-005`만 점검하고 **전부 [ ] 미완료**.
- 시작 시 중앙 보드·56차 영수증·main 최근 커밋/오픈 PR·`db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 관련 실제 코드·테스트·상담/서류 카탈로그와 OCR field-applicability를 조회. 개인정보/고객자료/키/원문 OCR 정답은 사용·저장하지 않음.
- 검증 수준: GitHub의 **실제 main 소스 JSON 파싱 및 정적 연결 검사**, `case-commands.ts`의 실제 ID-허용 원문 단락과 `confirmSubjectLink` 실제 함수 본문을 추출·변환하여 **합성 의존성으로 V8에서 격리 실행**. Draft에 커밋한 helper를 다시 받아 V8 실행. 실제 API/브라우저/D1/R2/Node 프로젝트 회귀/TypeScript/전체 CI는 **미실행**.

## A1-DOC-005 [ ] — 가족·주소·혼인·부양 변경

- 원본 `lib/reference-intake-catalog.json` blob `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`, `lib/intake-court-coverage.ts` blob `f0c00dc5322aa74feb9d634842483d0b8553b1fa`, `lib/intake-engine.ts` blob `82ddba689ea6d107ba587235205feef45e058527`.
- JSON 실파싱: 기본 **85 서류/49 feature/54 rule/23 source**; 16개 추가 규칙(55~70)과 `asset.cash_on_hand` 추가 코드 확인(실제 조합 `matchIntakeChecklist` 전체 **미실행**).
- 사전 독립 기대/관찰(기본 catalog의 6개 정적 토폴로지 검사): (1) 기본 신청인 주소·가족 `INTAKE-001` → `resident_registration` + `family_relation` **일치**; (2) `household.dependents` → `dependent_evidence` + 법률검토 **일치**; (3) `household.spouse_assets` → `spouse_asset_evidence` + 법률검토 **일치**; (4) `event.divorce` → `divorce_records` **일치**; (5) 독립 주소변경 feature **없음**; (6) 독립 혼인상태 변경 feature **없음**. **4/6 기대 부합**. 추가 16-rule에 `INTAKE-66` 인적사항·관할 검수용 `application_form_input`, `INTAKE-70` 이혼·상속·폐업에 의한 `income_household_change_evidence`는 존재(정적), 하지만 신청인 주소변경/혼인변경만의 독립 typed 상태전이와 운영 재분류는 입증되지 않음.
- **코드 완결성 공백 후보**: 가족관계·이혼 원문에 기초한 권장서류 경로는 있으나 주소/혼인/동거·부양 변경 **이력과 effective date를 가진 명시적 트리거**는 현 catalog feature에서 직접 확인되지 않음. 기존 case 공통 서류가 있다는 사실을 변경 사건 E2E 통과로 승격하지 않음.

## A1-LAW-006 [ ] — 소송/압류/전부명령 위험·원천 구별

- 동일 catalog + `lib/field-applicability-contracts.json` blob `6076b26f782c4643a21a7b2f1a8f6261bb588b68`; 법원 원문 확인·효력·승인 테스트는 **없음**.
- 사전 독립 기대/관찰(기본 catalog/field contracts 5개 정적·JSON 검사): (1) `debt.disputed` → `litigation_record` + `legalReviewRequired` **일치**; (2) `litigation_record` OCR family에 `procedure_enforcement_garnishment` **존재**; (3) 동 family는 `case_number/creditor/claimed_amount/attached_amount/released_amount/service_date/status` 7개 역할·시점 분리 슬롯 **존재**; (4) 독립 압류/전부명령 사건 feature **미등록**; (5) `procedure.court_order` 담당 법률검토 **존재**. **4/5 기대 부합**.
- `debt.disputed`가 없는 단독 압류·집행 사건에서 자동 자료요청/법률 위험 태그가 생성된다는 실제 경로는 **입증되지 않음**; `litigation_enforcement/account_garnishment/procedure_enforcement_garnishment` 필드 존재는 원천 보존·source-only이지 법적 효력 또는 압류/전부명령 승인 판정이 아님.
- 채권자·채무자·계좌명의자·송달일·명령일·효력일 및 청구액/실집행액은 반드시 별도 출처로 판단. 법원·변호사 검토 전 확정 금지.

## A1-DATA-005 [ ] — 신청인/배우자/채권자/사업자/계좌 혼합

- main `lib/party-identity.ts` blob `4c5df4399298fe314f6d978c4a68c4285914664a`, `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`, `components/case-workflow.tsx` blob `2ec797958726b99a4358ec46ef35f78f90bfd927`, 테스트 `tests/intake-workflow-domain.test.ts` blob `49612662596b9ed845a5933f0fc6e67ad87e8cda`.
- 실제 원본 `subject.link` command는 같은 사건에 **존재하는 ID**만 확인하며 `candidate.subjectScope`와 상대 `case/income/debt/asset` 타입을 대조하지 않음. UI도 기존에는 전 항목을 비필터 제공. `confirmSubjectLink`는 human reviewer와 evidenceRefs 유무/판본은 검사하지만 **타입은 검사하지 않음**.
- 합성 `case-1/income-1/debt-1/asset-1` + 검토자 `synthetic-staff`, 근거 `synthetic-fact-1`, candidate 상태. 독립 기대 9조건: 정상 income→income, debt→debt, asset→asset, case→case 허용; income→debt, debt→asset, asset→income, case→debt, household→debt 거절. main ID gate + 원본 확인 함수 **4/9 기대 일치**, 나머지 5조건은 거절되지 않음. **모의 함수격리 결과이며 실제 운영 오연결 사례/실제 API 실행의 입증은 아님**.
- 새 **[Draft PR #137](https://github.com/firmengine/firmengine/pull/137)**: `subjectLinkTargetKindAllowed`(같은 유형·정확히 1개 대상), 명령 서버 게이트, UI 유형 필터, `tests/subject-link-kind-r57.test.ts` 14 합성 조건. 브랜치 저장 소스를 다시 읽어 **V8 helper 14/14 독립 기대 일치**, server 및 UI 연결은 **정적 확인**.
- PR HEAD `2d03a617f7c796ea1216d03d2327edf626b2a174`, blobs: `case-commands.ts` `d68fd13fa32c0f419a5e2e3764ac167321805fc1`; `party-identity.ts` `0094a388459ee48a92562504fda0f1f3999afa7b`; `case-workflow.tsx` `e8ec5f3cd3405048f09a85ade473f82fa4604341`; 새 테스트 `ef3c6125e71c96d5b71b817ffbe67fd9946d349c`.
- **반드시 Draft 유지**: `household/procedure/event/expense` 등의 별도 typed identity 모델이 아직 없으므로 PR의 fail-closed는 그 대상의 기존 확인 흐름을 막을 수 있음. 인적 주체·계좌·사업자 crosswalk, 직원/데이터담당자/변호사 설계·통합 검수 선행. ID 유형검사만으로 실제 배우자/신청인/채권자 동일성 증명 아님. 현 `main` 실행 코드는 변경하지 않음.

## 종합 경계 및 다음 회차

- 57차 점검 **3 ID**, 신규 **P1 후보 1개**(A1-DATA-005), **Draft PR 1개**, 증거 문서/중앙 보드 외 main 실행코드 **0건 변경**. 기능 인수·법원 승인·운영배포 **0건**.
- 실제로 하지 않은 것: 새 프로젝트 Node 회귀·TypeScript·lint/build/전체 CI, staging D1/R2/Cron, 브라우저/사이트, 공식 서식, OCR 모델 실원문 인식, 18계산/95법률 종단, 직원/변호사 승인 모두 **미검증**. `null`/미관찰/0/비해당/상충/source-only/승인전은 변환·승격하지 않음. 운영 D1 migration/배포/전자제출/법원 인가 확정 실행하지 않음. Extra High 실제 모드 설정 확인되지 않음.
- 58차는 **IT담당자 / AX담당자 / 계산사무장** 순환. 우선 `A1-IT-004` 사건 생성·수정·삭제/복원/감사로그, `A1-AX-017` 오류 원인·영향·복구 안내, `A1-CALC-015` sourceVersion/referenceSHA stale CAS, 그리고 #137 사람/유형 통합 설계 영향 검증.
