# FirmEngine A1 — 21차: 법원 보정 표기·인가 근거 경계·합성 증빙 업로드

- **감사 시작 / 소스 기준 main:** `45f291d8e0c79d5203f67bdc70fb7317a6919248`. 이번 영수증 작성 직전 확인한 main: `45f291d8e0c79d5203f67bdc70fb7317a6919248`.
- **역할 순환:** 20차 IT/AX/CALC 다음 서류담당자 **A1-DOC-017**, 변호사 **A1-LAW-018**, 데이터담당자 **A1-DATA-018**.
- 범위: 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 20차 A1 영수증·통합보드·main 최근 커밋·열린 PR·관련 Drizzle 스키마·원본 코드/테스트 비교 후 판정.
- 데이터: 모든 사건 ID/서류/문구/날짜는 **합성**. 공개 저장소에 개인정보/원본 OCR/키/실제 승인값 없음.
- 검증 유형: 실제 GitHub 원본 함수/POST handler 본문을 **TypeScript 표기만 제거해 V8에서 격리 실행**, 외부 D1·HTTP·파일 저장소는 합성 stub. 이 실행은 프로젝트 Node suite / 전체 CI / 실 D1·R2 / Word·법원서식 / 변호사 승인 / 배포가 아니다.

## A1-DOC-017 — 법원 실제 보정명령 vs 예상 보완요청 (부분, [ ] 유지)

관련 blob:
- `lib/preapproval-correction-audit.ts`: `2cd18e22c9db4e5865f08b4d183f2d1751b0bf21`.
- `lib/approval-readiness.ts`: `d3aecf05688d3146ecff94a3795bb3da8a215d35`.
- `components/case-workflow.tsx`: `2ec797958726b99a4358ec46ef35f78f90bfd927`.

**실제 auditPreapprovalCourtCorrections 원본 함수 격리 5/5 독립 기대 일치.**
1. 내부 예측만 있고 `correction_requested` 이벤트 없음: `courtOrderCount=0`, `hasUnresolvedOrders=false`.
2. 법원 절차 이벤트+원문 문서+요구항목은 있지만 사실 미관찰: `courtOrderCount=1`, `source_not_observed`, 해결 안 됨.
3. 원문 Fact가 담당자 인정 상태: `verified_evidence_candidate`이나 `courtOrderSatisfied=false`, 해결 안 됨.
4. 법원 원문 문서가 사라짐: `missingCourtDocuments=1`, 해결 안 됨.
5. 독립 `amended` 이벤트만: `unboundAmendmentCount=1`, 법원 보정명령 건수 0.

`approval-readiness.ts`는 내부 task `origin=internal_candidate`와 법원 이벤트 `origin=recorded_court_event`를 구분. 그러나 `case-workflow.tsx`의 절차 기록 드롭다운은 `correction_requested`를 단지 **"보정 요청"**, 실제 법원 근거 문서 종류를 별도 UI 제약 없이 표시. `isOfficialCourtCorrectionOrder` 표시는 법원 원문 검증 통과 증거가 아님. **UI 코드 정적 확인**뿐이며 브라우저 실행·직원 문안 검수 미실행. 법원 명령과 예측 보완요청의 운영 문구 혼동 여지; 새로운 인가 기능을 임의 구현하지 않음.

## A1-LAW-018 — 생성/제출/인가 분리·법원 원본 검증 (기존 P0, [ ] 유지)

`lib/case-procedure-events.ts` blob `7c61fdfb6e79becc415a8b1385a1580bd8aa6ab2`의 `validateProcedureEvent` 실제 본문을 V8 격리하여 가상 사건의 knownDocuments로 은행거래내역, 법원 원본, 접수증을 사용:
- `generated` 무법원번호 승인: 기대/관찰 수락.
- `correction_requested` + 법원 원본: 기대/관찰 수락.
- **`correction_requested` + 은행거래내역 + 가상 법원번호: 독립 기대 거절, 실제 수락.**
- **`approved` + 은행거래내역 + 가상 법원번호: 독립 기대 거절, 실제 수락.**
- `approved` 법원번호 누락: 기대/관찰 거절.
- `approved` 사건에 없는 문서: 기대/관찰 거절.
- `received` + 접수증 근거: 기대/관찰 수락.

**7개 중 5개 독립 기대 일치 / 부정 2개 거짓 수락.** 동일 결함은 A1 5·17차/기존 이슈 #11에 등록됨. 신규 중복 P0로 집계하지 않음. 담당자 역할/같은 사건 활성문서 검사 존재. 실제 법원 승인 발생·익명 접근 입증 아님. 법적 요건 변경은 별도 실무자 승인까지 보류.

## A1-DATA-018 — referenceTest 자료와 실사건 증빙 등록 경계 (신규 P1, [ ] 유지)

**실제 신규 결함:** `app/api/cases/[id]/documents/route.ts` POST 원본 blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`는 `structuredTest`만 검사하므로 `referenceTest` 및 `evaluationClone`만 있는 사건이 문서·page_jobs 등록으로 진행. `lib/intake-store.ts` (`c0bdea9443a018a46c080a8e39a74a0daf62759f`)는 reference test를 읽기 전용으로 보호하고 `process/route.ts` (`e153bdb44ec7614de4cd9a9adfaf76e5e7fc4b64`)도 처리 요청을 차단해 기능 경계가 서로 충돌한다. `db/schema.ts` 확인 blob `933f8686845ac14669312dd21bf85e02c62ed5e6`. 기존 `preapproval-correction-item-store.ts` (`6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`)의 3 marker 검사는 다른 **보정항목 경로**일 뿐 문서 POST를 보호하지 못한다.

| 합성 입력 | 독립 기대 POST | 원본 실제 POST | 후보 실제 POST | 원본 DB/저장 stub | 후보 DB/저장 stub |
|---|---:|---:|---:|---|---|
| ordinary | 201 | 201 | 201 | SQL 2, save 1 | SQL 2, save 1 |
| structuredTest-only | 409 | 409 | 409 | SQL 0, save 0 | SQL 0, save 0 |
| referenceTest-only | 409 | **201 (P1)** | 409 | SQL 2, save 1 | SQL 0, save 0 |
| evaluationClone-only | 409 | **201 (P1)** | 409 | SQL 2, save 1 | SQL 0, save 0 |
| referenceTest+clone | 409 | **201 (P1)** | 409 | SQL 2, save 1 | SQL 0, save 0 |

**원본 실제 POST 함수 V8 2/5**, 후보 POST 함수+새 helper V8 **5/5** 독립 기대 일치. 요청 바디는 가상 SHA, 페이지 1개. 모든 SQL/저장은 메모리 stub 카운트이며 **실제 DB 쓰기 없음**. 정상 평가 복제는 원본 `structuredTest` 표시를 보존하는 경로도 있으므로 본 반례는 marker가 독립적으로 존재하는 상태의 방어 공백이며, 운영에서 해당 단독 marker가 실제 생성되는지 미검증.

**조치:** Draft PR [#72](https://github.com/firmengine/firmengine/pull/72), branch `audit/a1-r21-reference-document-register-20261031-0853`, HEAD `ff8fc0d702991e9b684dcfab16003676c8ef49cc`. `lib/evidence-registration-boundary.ts` 추가 / `app/api/cases/[id]/documents/route.ts` 수정 / `tests/evidence-registration-boundary.test.ts` 합성 회귀 추가. 기존 문서/API/계산 의미 변경 없음. **회귀 테스트 파일 작성 및 Git 커밋, 전체 Node·CI는 미실행**. PR 미병합·현행 main 실행 코드는 그대로. 데이터·서류담당자 검토 후에만 병합. 운영 반영 없이 소스 기반 격리 결함 확인만 완료.

## 인수 상태와 다음 체크

- `A1-DOC-017`, `A1-LAW-018`, `A1-DATA-018` 모두 **[ ] 미완료**. 새로운 실제 고객/법원 판정 전무.
- 기존 `A1-LAW-018` 법원 인가 근거 검증 누락 P0(#11)와 새로운 문서 등록 marker 누락 P1(#72)은 **독립 결함**.
- 시작 main `45f291d8e0c79d5203f67bdc70fb7317a6919248`; 제품 실행 코드 main 미변경. 중앙 보드 3 ID만 보존 병합.
- **다음 역할:** IT `A1-IT-016`(실행 가능한 전체 CI·타입 테스트), AX `A1-AX-018`(프롬프트 사본/활성 경로), 계산 `A1-CALC-017`(계산 실패→법률/초안 차단).
- 실제 사이트 배포, 운영 D1 마이그레이션, 법원 전자제출, 법원 인가 확정 **수행하지 않음**. `null`/`0`/미관찰/비해당/상충/source-only/승인전 상태는 구별.
