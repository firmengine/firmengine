# FirmEngine A1 13차 — 갈음 B+C 증빙 역할·법률 예외 계약·OCR 복수행

- 기준: 2026-10-31 KST. 전 회차 IT/AX/CALC → 이번 **서류담당자 `A1-DOC-011` / 변호사 `A1-LAW-014` / 데이터담당자 `A1-DATA-004`**. 세 ID는 **[ ] 부분검증**, 제품 인수 완료 **0**.
- 원본 GitHub main 감사 시작 SHA: `4f6f66e830b987425ff9282d02cbfb4f7447fe33`. 최근 커밋·PR #56·#55·#54·#53·#52·#49·#46 및 12차 영수증을 확인했고, `db/schema.ts` 및 관련 실제 함수/기존 테스트를 읽음. 병렬 작업이 진행 중이므로 이후의 HEAD는 별도 확인.
- 전체 변경은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부로 제한. 외부 고객자료·실제 OCR·.env·키 사용 없음.

## A1-DOC-011 — A ← B+C 증빙 중 하나가 행정자료/기존서식으로 바뀐 경우

**코드/계약 SHA**: `lib/document-substitution.ts` `9fea9344b923c961fe333761df99ddde431ce1bc`, `lib/substitution-policy.ts` `18814e805226a2999496aa05a69a343ee5271d63`, `lib/substitution-policy.json` `cfb81e2f0c7ba0923d075f7612fa2b7a01bac68c`; 기존 `tests/document-substitution.test.ts` `0bb1478bac062f3daa844f10374440af6cbdceb2`.

**합성 재현:** 서울의 게시된 `salary_withholding ← salary_bank_statement (B) + salary_statement (C)` 경로, 2026-04-01~09-30, 사유·검수자·선택 두 문서/기간·승인 match·원본 fingerprint·소유자 링크 충족. B에 독립 proof Fact가 존재하지만 C는 문서 종류만 `salary_statement`로 분류되고 페이지 역할이 `administrative` 또는 `filed_form`으로 변경된 상황. 독립 기대: 두 구성 문서는 모두 활성 evidence여야 원서류 요청을 숨길 수 있으므로 **C가 non-evidence면 요청 유지**.

실제로 `reconcileDocumentSubstitution` 함수 본문과 `matchPublishedSubstitutionRoute`의 main 코드를 TypeScript 타입 구문만 제거한 뒤 **격리 V8 실행**. fingerprint와 정책 검증은 합성 스텁이며 실제 Node 모듈 import, DB, R2, 법률 서명은 실행하지 않음.

| 합성 조건 | 독립 기대 `activeRequest` | 기존 main 관찰 | 수정안 관찰 |
|---|---:|---:|---:|
| B+C가 모두 accepted evidence | false | false | false |
| B만 accepted, C proposed | true | true | true |
| B+C accepted, C만 administrative | **true** | **false (결함)** | true |
| B+C accepted, C만 filed_form | **true** | **false (결함)** | true |

기존 코드가 accepted match의 문서종류만 확인하고 원본 페이지의 `role`을 확인하지 않아 C를 유효한 대체증빙으로 인정하는 **P1 후보기능상충** 확인. 다른 경로의 Fact 출처 확인은 evidence-role이지만, 모든 선택 문서의 충족 여부에는 이 확인이 누락되어 있었음.

**조치:** `evidenceType(match,pageId)`가 현재 `EvidencePage`에 존재하고 `role==="evidence"`일 때만 선택 갈음 문서로 계산하도록 공통화. 기존 C 판별과 기간 계산에 적용. 격리 V8 재실행 **수정안 4/4 독립 기대 일치** (기존 2/4). Node 회귀 테스트 1개(정상+B-only+행정+기존서식 네 시나리오)를 `tests/document-substitution.test.ts`에 작성했으나 **프로젝트 Node 실행은 미실행**.

코드 수정과 회귀는 **Draft PR #57** [보기](https://github.com/firmengine/firmengine/pull/57), 별도 브랜치 `audit/a1-r13-substitution-evidence-page-20261031`, 코드 커밋 `3b6f06f2f68217f0cd6c7a569e340bc3fc99127f`, 회귀 추가 커밋 `6c2a6a354f7c050967657084f06bd386d603fab3`. PR 변경 파일 2개는 모두 허용 디렉터리 내부. 판정/법률 계약 적용을 바꾸므로 **서류실무자·변호사 인수 후 병합**, main 실행 코드에는 미반영.

## A1-LAW-014 — 50 법률규칙/46 예외 적용 후보/보류

**코드/계약 SHA**: `lib/preapproval-legal-coverage-audit.ts` `3e4dcf275a22b1bbe6b52cff09dae748f3c62175`; `lib/legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`; `lib/legal-exceptions.json` `6e51197226bfd8320e1147d8df3f12c11e00927c`.

실제 `auditPreapprovalLegalCatalog` 함수의 TypeScript 제거 V8 합성 실행(사건 `synthetic-case`, 서울, 2026-10-30): **50 규칙/46 예외**, 각각 ID 유일 50/46, 예외의 미등록 규칙 참조 **0**. 증빙 없는 상태에선 법률 결론 `legalFinding=null`, `allLegalOutcomesRequireHumanReview=true`, 예외 `automaticallySatisfied=false`. 같은 `applicant.address` Fact의 원천 검증 전에는 `source_unverified_or_unaccepted`, 원천 검증 ID가 추가된 후에도 `source_supported_needs_legal_application`이며 다른 필수 피처 누락으로 규칙은 `evidence_or_mapping_review_required`. `EL-40`·`EL-46`은 `postapproval_deferred`로 표시. **이것은 카탈로그/감사 함수의 상태검증**이며 50개 조건 및 46개 예외 평가기 전체 실행, 관할 법규/시행일 검증 또는 변호사 승인과 다름. 별도 코드 수정 없음.

## A1-DATA-004 — 동일 canonical OCR ID 복수 행 보존

**소스 SHA**: `lib/extraction.ts` `75931aad3fc7871395e62276bb5533e24b15d1a5`; 기존 SQLite 테스트 파일 `tests/extraction-row-store.test.ts` `adbb896c5bc69716e34ee82c5bfedc5555f677a2`; 실제 DB 선언 `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`에서 `extraction_records`는 (run, ordinal), `extracted_features`는 (record, ordinal) 유일 제약을 확인.

실제 `projectPage` 본문의 타입 주석만 제거하고 OCR 의존 helper는 합성 스텁으로 격리 V8 실행. 문서 1, 페이지 1, 같은 `canonicalFieldId="same-id"`에 다른 원문값 10,20:
- 서로 다른 `other` 행 2개 → Fact 2개 (`doc-1:p1:other:0:f0`, `doc-1:p1:other:1:f0`) 값 10/20 보존. 독립 기대 2, 관찰 2.
- 같은 행의 충돌하는 값 10/20 → 상이한 후보 Fact 2개 (`doc-1:p1:other:0:f0`, `doc-1:p1:other:0:f1`) 원문값 보존, typed 채무/소득 자동 생성 0. 독립 기대 2, 관찰 2.

**2/2 격리 조건 기대 일치**. 다만 실제 canonical family 계약/DB upsert/18계산·95법률·서식의 last-wins, 다중 사건/대량 2000행은 실행하지 않았음. 테스트 파일의 존재는 Node/SQLite 실실행과 다름. 코드 수정 없음.

## 범위·최종 상태·다음 회차

- 격리 V8 조건: 갈음 수정안 4/4, 법률 50+46 구조/상태 3조건, 복수행 2/2 기대 일치. 제품 합격 처리 **0**, 세 ID 모두 **[ ]**.
- 여전히 미인증: 원본 전체 Node 단위/통합 테스트, TypeScript·lint·빌드·Actions CI, staging D1/R2/Cron, 실제 OCR/서식, 독립 서류·계산·변호사 검수, 운영 배포. **운영 배포·D1 운영 migration·전자제출·법원 인가 확인 미실행**.
- 다음 A1 역할 순환: IT `A1-IT-017`(배포 판본 SHA 일치), AX `A1-AX-014`(미확정 시 writer 차단), 계산사무장 `A1-CALC-018`(사업소득 승인 후 법률 재평가). 기존 열린 PR #17/#55와 상충하지 않도록 최신 main과 blob SHA 확인.
