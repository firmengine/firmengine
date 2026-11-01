# FirmEngine A1 51차 — 상담→서류 생성 / 미확정 관할 / 85서류×48 OCR 패밀리 (서류·변호사·데이터)

- 기준: 2026-11-01 KST, GitHub main 시작 HEAD `b4e761831fdbea58ddd4fd079b4f34571408c972`; 직전 50차 영수증 `20261101-round50-it-ax-calc-ci-questions-budget-1347KST.md`·단일 보드·최근 commits/PR·실제 소스/스키마/기존 테스트 선열람.
- 역할 순환: **50차 IT/AX/CALC → 51차 DOC/LAW/DATA**. 체크 ID **A1-DOC-002 / A1-LAW-003 / A1-DATA-002**, 모두 **[ ] 부분검증**; 제품 완전인수 0건.
- 범위: 반드시 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 실제 사건, 원문 OCR, 비공개 정답, 개인식별정보, 키/.env 미사용. 운영 D1/R2/배포/전자제출/법원 결정 미실행.
- 법원 정책: `docs/deferred-court-routing-20261030.md`는 서울 우선 1차 업무기준을 보류 의사결정으로 보존하되 **미확정 사건 관할을 서울 법원 확정으로 인정하지 말 것**을 요구. 관할별 전체 기준 분기·이력 설계는 이번에 만들지 않음.

## A1-DOC-002 — 신규 상담에서 서류목록으로 이어지는 UI/API/DB 경계 [ ]

**직접 읽은 main 원본(blob SHA)**: `components/workspace.tsx` `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`; `app/api/cases/route.ts` `75beaa0f74abd4e23a3c5623efa1d526f2ff3290`; `components/consultation-checklist.tsx`(신규 상담 UI) 및 `app/api/cases/[id]/consultations/route.ts` `94d930eeb8c768626c05f3aa9b32654eb004cd2a`; `lib/intake-store.ts` `c0bdea9443a018a46c080a8e39a74a0daf62759f`; `lib/intake-engine.ts` `82ddba689ea6d107ba587235205feef45e058527`; `lib/case-document-requirement-store.ts` `a670cb4e6a38aa6e782e898b5ed30aad80619c6d`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.

**정적 기능 연결**: 작업공간 신규 사건 폼 → `POST /api/cases`(사건 INSERT) → 상담 폼 `POST /api/cases/:id/consultations` `append`/ `analyze` → `analyzeConsultation`(상담 revision·분류 근거) → `matchIntakeChecklist`(요구서류/질문) → `prepareCaseDocumentRequirementWrites`(문서/서식 field plan; 보류→완료 상태 확인) → 같은 batch의 run/head/요구서류 변경 → `consultation-checklist.tsx` 표출 및 자료함 이동 링크. 스키마에 `cases`, `consultation_heads`, `consultation_notes`, `consultation_runs`, `shared_document_types`, `case_document_requirements`, `case_requirement_field_plans` 존재.

**실제 실행**: 별도 Node22.16 합성 route POST/D1 stub 테스트는 LAW-003과 중복되는 **신규 사건 생성 POST 9조건** 및 UI 소스 검증 1조건(아래)만 실행. 상담 AI `callLuna`, DB batch, 85개 실제 문서 요구의 활성 head 전환, 브라우저 클릭→서류 DB 재조회 **미실행**. 따라서 상담→요구서류의 종단 완료를 주장하지 않는다. 누락/승인전/갈음/법원개별명령은 별도 상태 유지.

## A1-LAW-003 — 관할 미확정의 서울 확정 오인 P1 후보 [ ]

**대조**: `lib/domain.ts` `createCase()` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a` 기본 `courtId=seoul`; 서버 신규 사건 POST blob `75beaa0f`는 `courtId` 누락/null → `seoul`; 신규 UI `workspace.tsx`는 서울을 기본 선택. 반면 `matchIntakeChecklist`는 `unknown`/미확인에 대해 법원 전용 규칙을 `qualification_needed`로 보류. 이 위층의 자동 서울 채택이 실제 입력과 모순.

**독립 기대와 실행**: GitHub 원본 POST 함수 본문에서 import/TS 서명만 제거, `createCase`·actor·D1 INSERT·event·getCase·caseResponse는 명시적 **합성 adapter**(DB 저장 JSON 관찰)로 연결한 V8 7조건(누락/null/공백/서울/인천/unknown/other).
- 기대: 누락/null/공백 → `unknown`; 사용자가 명시한 서울/인천/unknown/other는 유지.
- 관찰(main): **4/7 일치**; 누락/null은 **서울**, 공백은 **공백 그대로** HTTP201·synthetic SQL INSERT 1회.
- 후보: **7/7 일치**.
- 추가 **Node22.16 `node --test` 소스구속 격리 10/10 실제 통과**: 9 POST 시나리오(명시적 0/빈칸/공백/관할 구분) + JSX selector 정적 assertion 1건. Node가 로드한 route blob SHA `a3bb717e7bf9e39f1d0f23a08a9904587ec202a5`, 테스트 blob `11b06fb3824512f1d1c6aebaf845b091dd51a2a2`는 저장된 Draft 브랜치의 blob과 동일(`git hash-object` 비교). Node UI assertion은 **로컬 JSX 최소 mock**으로 실행한 정적 검사이며 PR 실제 JSX는 GitHub 저장 blob `679f042bcd9e26e62d9c55e76f5b10e4f43fe96c` 원문 정적 3개 selector/표시 문자열 조건으로 **별도 확인**. 브라우저/실 DB/법률 인가 시험 아님.

**코드 조치**: 위험한 법률·기존 데이터 의미 변경은 main 미반영. **[Draft PR #128](https://github.com/firmengine/firmengine/pull/128)** 별도 브랜치 `audit/a1-r51-unconfirmed-court-20261101`, 변경 경로 3개 모두 허용 prefix 내부.
1. 신규 사건 POST: 누락/null/공백 → `unknown`; 선택한 값 보존.
2. 신규/기존 사건 court selector에 `관할 미확인(확인 전)` 추가, 신규 폼 기본값 unknown, 사건 헤더의 미확인 표시.
3. 합성 Node 회귀 `tests/case-create-court-unknown-r51.test.mjs`.
기존 사건 `courtId=seoul` 자동 수정, `domain.createCase` 기본값 변경, 관할별 전체 법률규칙·DDL 변경 **없음**. 변호사/서류담당자 정책 승인, 기존 서울 우선 원칙과의 영향·구사건 provenance, 전체 UI/API/D1/CI 확인 전 PR Draft 유지. 실제 법원 관할 확정값 승격 없음.

## A1-DATA-002 — 서류 ID / OCR 패밀리 ID 고유성·허용 매핑 [ ]

**원본 JSON/blob SHA**:
- `lib/reference-intake-catalog.json` `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`.
- `lib/document-agent-field-contracts.json` `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`.
- `lib/shared-document-field-contracts.json` `9decab974e0909ae24ad927bdfe241d75b71f3a9`.
- `lib/ocr-field-supplements.json` `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`.
- `lib/intake-court-coverage.ts` `f0c00dc5322aa74feb9d634842483d0b8553b1fa`; `lib/shared-document-catalog.ts` `4cd07ebcc11d2d9d803a117ae98424292e1c5cba`.

**실제 코드/JSON 파싱 검사 결과**: 원본 문서 **85/고유85**, OCR 패밀리 **48/고유48**, 문서 계약 정의 **85/고유85**. 85 문서의 family 참조는 모두 정의되고 각 문서 `allowedFamilyIds`에 허용됨; **허용되지 않은 family 0**, 참조누락 0, 동일 문서+패밀리의 base/추가 global field ID 중복 **0**, orphan supplements **0**. 모든 48 패밀리가 적어도 하나의 문서에서 사용됨. 원본 규칙 54 + `INTAKE-55`~`70`의 추가 16 = 총 70 규칙; 현재 seed+coverage 규칙상 85개 문서 전부 rule primary/alternative에 도달(정적 조인 누락 0). `routingStatus=ready` 문서 85. **이 수치는 seed 기반 정적 구조 검증**이며 운영 중 직원 수정 catalog 판본/개별 문서 OCR 성공률/원본 PDF 추출, 실제 모델 커버리지의 인증이 아니다.

## 실행/미실행 경계와 다음

- **A1-DOC-002 / A1-LAW-003 / A1-DATA-002 모두 [ ]**. 법률상 확정/인가/법원명령 상태 변경 없음. 신규 P1 **후보 1**, 신규 Draft PR **#128 1건**, 소스 기반 V8 main 4/7 vs 후보 7/7, Node source-bound 10/10 (실 D1 아님). 정적 85/48 ID 구조 불일치 0. 코드 존재/합성 실행/CI/법원 승인 절대 동의어 아님.
- **미실행**: 원본 전체 TypeScript/lint/build/CI, 상담 AI 실모델, 실제 D1/R2/Cron, 브라우저 E2E, 85개 서류 실제 원본·OCR 48패밀리 실행, 18계산·95법률 종단, 공식 서식/변호사 실무 인정, 사이트 배포·전자제출.
- **다음 역할**: IT담당자 / AX담당자 / 계산사무장. 권장 다음 ID: `A1-IT-001` 전체 UI/API 도달성, `A1-AX-014` 미확정 계산/법률 자동초안 차단(기존 PR #17), `A1-CALC-012` 36/48/60개월 회차·납부일 null 검증(기존 PR #37).
