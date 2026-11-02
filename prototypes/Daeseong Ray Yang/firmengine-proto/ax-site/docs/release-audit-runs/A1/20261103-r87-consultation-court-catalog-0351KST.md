# FirmEngine A1 — 87차 코드 완결성·상호 기능충돌 감사 (2026-11-03 KST)

- 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 이전 86차 영수증 및 중앙 보드, 51차 동일 ID 영수증, 최신 main/커밋/열린 PR, 스키마, 실제 원본 소스와 기존 테스트를 읽고 수행.
- 시작/작성 직전 관찰 main HEAD: `5bf59a6231c7463293cc22d7bceccd0215510d85`. 해당 HEAD와 보드 blob `1efa11622948c34166ffdd7847e84db22f162924`는 기록 직전 재조회했다.
- 역할: **사용자·서류담당자 → 변호사 → 데이터담당자**. 확인 ID: **A1-DOC-002 / A1-LAW-003 / A1-DATA-002**. 세 ID 모두 `[ ]` 유지.
- 기존 Draft PR #128(미확정 관할) 확인: HEAD `1633c8d46135e55ac1c677deb8646033dff374cd`, 51차와 같은 문제 영역, **미병합**. 중복 패치·운영 반영 없음.

## A1-DOC-002 [ ] — 상담 → 요구서류 active run 연결 및 무결성

- 실제 읽은 소스/블롭: `app/api/cases/route.ts` `75beaa0f74abd4e23a3c5623efa1d526f2ff3290`, `app/api/cases/[id]/consultations/route.ts` `94d930eeb8c768626c05f3aa9b32654eb004cd2a`, `lib/intake-store.ts` `c0bdea9443a018a46c080a8e39a74a0daf62759f`, `lib/case-document-requirement-store.ts` `a670cb4e6a38aa6e782e898b5ed30aad80619c6d`, `components/consultation-checklist.tsx` `7748c02bf64c5162efe213939ce24cd20a74a923`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `tests/intake-store.test.ts` `6665cca7659ee4bfae5a474bfc1d2873b46c03a2`.
- 소스 경로 확인: 사건 POST → 상담 append/analyze POST → `analyzeConsultation` → `matchIntakeChecklist` → `prepareCaseDocumentRequirementWrites` → batch의 run complete/head CAS/requirements/field-plan → `listCaseDocumentRequirements`의 활성 run 결합. 상담 UI는 현재 run 결과와 자료함 링크를 표시한다.
- **실제 실행**: `listCaseDocumentRequirements`의 GitHub 원본 함수 몸체를 제한적으로 TS 주석·제네릭·타입 단언만 제거해 V8에서 실행. DB 조회 결과와 SHA 함수는 명시적인 **합성 대체**. 독립 기대/관찰 **10/10 일치**.
- 10조건: 정상 active run/field plan materialized, 이전 run도 없는 empty, active head 없는 과거 complete의 pendingReanalysis, 현재 complete run의 empty, plan 누락 legacy_unmaterialized, 원문 SHA 변조 차단, 원문 필드 상충 차단, plan subject 불일치 차단, plan SHA 변조 차단, plan JSON 문법 오류 차단. SQL text에서 head→run→requirements→plan 연결과 `WHERE head.case_id = ?` **5/5 구조 확인**.
- `tests/intake-store.test.ts`에는 requirement insert 실패시 run/head 트랜잭션 롤백, 상담 정정·기준정보 변동시 stale 테스트가 작성되어 있음을 읽었다. **이번 회차 해당 Node 테스트 파일을 실행하지 않았다.** 실제 SQLite/D1 SQL JOIN, UI 클릭, 상담 실모델, 85종 문서 행 저장·다시 읽기, 다른 사건 동시 실행, 전 과정 E2E는 미관찰. 소스 존재와 모의 DB 함수 통과만으로 인수하지 않음.

## A1-LAW-003 [ ] — 관할 미확정의 서울 자동확정 문제 재현

- 소스 `app/api/cases/route.ts` main blob `75beaa0f74abd4e23a3c5623efa1d526f2ff3290`; Draft PR #128의 동일 경로 blob `a3bb717e7bf9e39f1d0f23a08a9904587ec202a5`. UI `components/workspace.tsx` main `37bc60405f3017bf42b12d8a26a7f0aace78d0cc` / PR `679f042bcd9e26e62d9c55e76f5b10e4f43fe96c`.
- **실제 실행**: 각 판본의 원본 POST 본문에 TS의 `request:Request`와 import만 제거해 V8에서 실행; 합성 createCase/actor/DB INSERT/event/GET/Response adapter 사용. DB payload에 저장된 `context.courtId`와 HTTP 201을 직접 관찰. **10개 독립 조건에서 main 4/10, Draft #128 10/10**.
- 기대→main→Draft: 관할 누락 `unknown→seoul→unknown`; null `unknown→seoul→unknown`; 빈문자열 `unknown→""→unknown`; 공백 `unknown→"   "→unknown`; 개행 포함 공백 `unknown→" \\n "→unknown`; 명시 unknown/seoul/incheon/other는 각각 유지, `" seoul "`은 `seoul→" seoul "→seoul`. 모두 양쪽 HTTP 201. **이전 51차의 기존 P1 후보** 재현이며 신규 결함으로 중복 집계하지 않음.
- 최초 검사 도구가 비동기 handler 종료 전 합성 저장배열을 읽은 실행은 **무효 처리**했고, 각 handler를 `await`한 후 10개 전부 재실행한 결과만 위 수치로 기록. 이는 검사 도구 오류이며 제품 오류 아님.
- 기존 Draft #128은 법률·운영 기준 정책의 실무 승인, 기존 사건의 관할 provenance, 실제 UI/인증/D1·전체 테스트 이전까지 **미병합 유지**. 서울 우선 업무범위와 법원 관할 확정값은 동일하지 않음.

## A1-DATA-002 [ ] — 85서류 × 48 OCR 패밀리 × 693 필드 정합성

- 실제 GitHub 원본 JSON을 파싱하고 원문 타입별/패밀리별 ID를 전수 집합 검사:
  - `reference-intake-catalog.json` `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`
  - `document-agent-field-contracts.json` `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
  - `shared-document-field-contracts.json` `9decab974e0909ae24ad927bdfe241d75b71f3a9`
  - `ocr-field-supplements.json` `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
  - `intake-court-coverage.ts` `f0c00dc5322aa74feb9d634842483d0b8553b1fa`
- 관찰: 문서 **85/고유85**, 정의 **85/고유85**, OCR 패밀리 **48/고유48**, 실제 사용 패밀리 **48**, document×family route **141**, 그 route에서 fields 발생 건수 **1,808**, 서로 다른 `global_field_id` **693**, seed rule **54** + coverage rule **16**, 서류의 규칙 미참조 **0**, 정의·패밀리·허용 family·필드 중복·supplement 고아·ready인데 패밀리 없음 **0**, 비- `ready` 서류 **0**.
- 693개 고유 global ID와 1,808개 route별 사용은 *각각 다른 집계 단위*. `routingStatus=ready`는 추출 성공·직원 검수·법적 인정 상태가 아님.
- **미검증**: 실제 활성 D1의 직원 편집 catalog 판본, 실 PDF/48 OCR 추출 패밀리, 693 Fact 소비처 전수, 복수행/갈음 A←B+C/C01-C02-C04·보정명령 E2E, 공식 서식 또는 변호사 검토.

## 판정 및 다음

- 본 회차 **V8 소스격리 DOC 10/10; 관할 main 4/10 vs 기존 Draft 10/10; 카탈로그 구조 오류 0**. 신규 확정 제품 결함 **0**(기존 관할 결함 재확인); 이번 제품 코드 수정 **0**, 신규 PR **0**.
- **완전 인수 승인 ID 0개**. 원본 OCR 사실값, 실고객 사건, 비공개 정답, 키/.env/개인정보 사용 없음. 운영 배포·D1 운영 마이그레이션·실 전자제출·법원 인가 확정 미실행.
- 이번 실행은 **V8 원본 함수의 합성 DB 테스트와 원본 JSON 정적 구조 검증**만 수행. Node/TypeScript/lint/build/CI, 브라우저, staging D1/R2/Cron, 공식 법원 문서·변호사 승인, 85서류/18계산/95법률 전체 종단은 **미검증**. 실행 모델의 Extra High 설정 여부는 확인되지 않았다.
- 다음 역할: **IT담당자 → AX담당자 → 계산사무장**. 다음 ID: **A1-IT-001 / A1-AX-014 / A1-CALC-012**. 이전 이력과 열려 있는 Draft PR을 먼저 대조하고 동일 경계의 기존 수정과 중복 충돌시키지 말 것.
