# FirmEngine A1 31차 — 갈음철회·50/46 법률카탈로그·금액 단위 상충

- 회차: 2026-10-31 KST. **서류담당자 → 변호사 → 데이터담당자** 관점; 이전 30차 IT/AX/계산사무장에서 순환.
- 감사 시작 및 영수증 작성 직전 GitHub `main` HEAD: `91bfd0d537409fd548c370c21293b71687c08553`.
- 인수 ID: `A1-DOC-012`, `A1-LAW-014`, `A1-DATA-010`. **세 ID 모두 [ ] 미완료**. 코드·합성함수 통과 ≠ 전체 Node/CI ≠ staging D1/R2 ≠ 법률 적용/사이트 배포.
- 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 실제 고객·원문 OCR·키/.env·비공개 정답은 사용하거나 기록하지 않음.

## 선행 확인과 소스 추적

- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `1ab14ac8a7b2ff1048031c6b639549bc7dba538d`, 전회 A1 30차 영수증 blob `6144e1401f3bb9a4bf46f376f8b63c1e7ae61a12` 확인. 최근 `main` 커밋과 관련 Draft PR #57(갈음)·#62(정책 감시)·#60(금액 오인식) 및 PR #86의 미병합 상태 대조.
- 실제 코드: `lib/document-substitution.ts` blob `9fea9344b923c961fe333761df99ddde431ce1bc`; `lib/preapproval-legal-coverage-audit.ts` blob `3e4dcf275a22b1bbe6b52cff09dae748f3c62175`; `lib/domain.ts` main blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`.
- 법률 목록: `lib/legal-catalog.json` blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`, `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`. schema `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 기존 테스트 읽기: `tests/document-substitution.test.ts` blob `0bb1478bac062f3daa844f10374440af6cbdceb2`; `tests/preapproval-legal-coverage-audit.test.ts` blob `6cf4c7acca98dd3db7d57a1f8b6c73360533f2a2`; `tests/fact-review-units.test.ts` blob `e197a840e2288cb87ba72fdced010587bf8d0c04`; `tests/ocr-calculation-db-contract.test.ts` blob `34a1d2349da9f2f28fd4d3266c3782410b2a2783`.

## A1-DOC-012 — A←B+C 갈음 승인 이후 철회와 복원

실제 `reconcileDocumentSubstitution` 함수 및 호출 helper를 GitHub 원본문에서 타입 선언만 제거해 V8 격리 실행. 합성 자료: 서류 A 필요, 대체 B+C 승인, 서로 다른 증빙 필드 2개, 검토자·문서/기간/주체·지문 스냅샷. **정책 경로 조회 및 Fact fingerprint는 결정적 합성 stub**. 공식 법원 갈음 인정 판정 아님.

| 합성 입력 | 독립 기대 | 실제 main | 일치 |
|---|---|---|---|
| B+C의 유효 증빙 유지 | A 요청 비활성 | 비활성 | 예 |
| B 원본 철회 | A 요청 복원 | 복원 | 예 |
| C 원본 철회 | A 요청 복원 | 복원 | 예 |
| C 페이지 행정용으로 변경 | A 요청 복원 | 복원 | 예 |
| C 원본 SHA 교체 | A 요청 복원 | 복원 | 예 |
| 카탈로그 버전 변경 | A 요청 복원 | 복원 | 예 |
| 정책 변경 알림 미처리 | A 요청 복원 | 복원 | 예 |

**7/7 합성 기대 일치**, 그러나 법원 정책 stub, 85종 전수·동시사건·HTTP/UI·D1/R2 종단 미검증. 기존 Draft PR #57의 B+C 관리/기존서식 페이지의 별도 결함은 여전히 미병합. **[ ] 유지**.

## A1-LAW-014 — 법률규칙 50개, 예외 46개의 미적용·상충 구분

실제 `auditPreapprovalLegalCatalog` 함수와 main의 실재 JSON 배열을 V8 격리 실행. 합성 입력은 원문 Fact가 0개인 사건:
- 법률규칙 50/50·ID 고유 50, 예외 46/46·ID 고유 46, 예외의 미등록 규칙 참조 0.
- 규칙: `evidence_or_mapping_review_required` 49, `postapproval_deferred` 1. 예외: 사전 후보 44, 인가 후 보류 2; 자동 충족 0/46, 법원 승인 추정 false.
- 미충족 근거 질문 227개. **이는 후보·누락 원장 통계이며 50규칙+46예외의 실제 법률조건 개별 판정·검수 통과가 아님.**
- 추가 개별 합성 4조건: 미관찰→누락, 미수락→원천 미승인, 원천 인정→여전히 법률 적용 검토 3건 기대일치. 외부 호출자가 철회 Fact ID를 잘못 'sourceValidatedAccepted' 집합에 넣은 비정상 입력 1건에서는 audit 단독으로 `source_supported_needs_legal_application`가 반환됨(보수적 기대는 원천 미승인). 실제 `app/api/cases/[id]/approval-readiness/route.ts`는 `currentFacts` 및 `state=verified`/`recognition=accepted`/`factSourceLineageIssues=0`를 먼저 적용해 집합을 생성하므로, **현행 HTTP 경로에서 재현된 법률 자동승인 결함이 아님**. 다른 호출자 경계 검토 필요.
- 법률 rule/exception source 및 법원 시행일의 실제 사람 승인·전체 워크플로는 미검증. 법률 의미 변경 없음. **[ ] 유지**.

## A1-DATA-010 — 원/천원/만원 단위 충돌의 오환산 P1 후보

main `lib/domain.ts`의 실제 `normalizeMoney` 함수 본문 V8 격리 재현:
- `normalizeMoney("250원","천원")` → **main `exact,250000`**; 독립 기대 `invalid,null`. 원문 '원'을 단위 '천원'으로 1,000배 오환산.
- `normalizeMoney("250 KRW","만원")` → **main `exact,2500000`**; 독립 기대 `invalid,null`. 원화 명시 금액을 만원으로 10,000배 오환산.
- `normalizeMoney("0원","천원")` → main `exact,0`; 독립 기대 `invalid,null` (명시된 0도 상충 단위임).
- 정상 무접미 원문 `"250"+천원`, `"2.5"+만원`, `"0"+천원`, 명시적 원화 1배, 소수 1원 보류, 외화 보류, null, 미지원 단위 등 대조. 원본 **10/13**, 안전 수정 후보 **13/13** 독립 기대 일치.
- 제안된 최소 수정: 원문 문자열 끝에 숫자+원/KRW 접미가 **명시**된 경우 선언 단위의 scale이 1이 아니면 `invalid`. 환율·VAT·세무상 인정·금액 산식 변경 없음.
- 수정 브랜치 `audit/a1-r31-source-won-unit-conflict-20261031-1856`, [Draft PR #86](https://github.com/firmengine/firmengine/pull/86) **미병합**. 소스 수정 blob `4847da1410d09191558b40e6e4c5d9d7d8db5e4e`, Node 회귀 파일 `tests/a1-r31-source-money-unit-conflict.test.ts` blob `a25f6a9a23ea80ec25fa503ff3ae4e043dae5096`, PR HEAD `9349ad44eb459b3c3bf2d2d457060753c417090a`.
- 수정 브랜치에 다시 저장된 **실제 소스 함수**를 재취득하여 V8 격리 10/10 기대 일치. Node 테스트는 **작성·커밋만 했고 실행하지 않음**. PR #60은 `ocr-calculation-input.ts`를 수정하므로 금번 `domain.ts`와 파일 자체 충돌은 없으나, 후속 통합 회귀 필수.
- 실문서 OCR의 원문 단위↔원금액 매칭·실제 영수증/DB·VAT 포함 여부·법률상 정정은 미검증. 회계 담당자 및 데이터 담당자 확인 후 병합 검토. **[ ] 유지**.

## 회차 조치/제한/다음

- 제품 실행 코드 변경은 Draft PR #86에만 존재. `main` 제품 코드는 그대로 두고 본 고유 영수증과 중앙 보드의 **세 체크 ID만** 기록한다.
- 실제 실행은 DOC 7조건, LAW 카탈로그 50/46 일괄 상태 투영 및 별도 4조건, DATA 13조건(main)·13조건(수정 후보)·10조건(브랜치 재확인)의 **V8 격리 테스트**. 테스트 원문과 기능 전체 CI/staging 인수는 구별한다. 운영 배포·운영 DB 마이그레이션·전자제출·법원 인가 확정은 하지 않음.
- 다음 역할: IT담당자·AX담당자·계산사무장. 우선 `A1-IT-006`(85문서 업로드·철회), `A1-AX-004`(JSON/schema 실패 복구), `A1-CALC-002`(사업자 원천매출/VAT/경비·독립 승인) 확인.
