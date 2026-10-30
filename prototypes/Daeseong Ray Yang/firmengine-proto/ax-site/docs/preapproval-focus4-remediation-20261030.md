# FirmEngine P0-09 — 4번 잔여 문제 후속 구현 (2026-10-30)

**범위:** 신청 준비부터 인가결정 전까지. 기존 상담 85종·OCR 693 canonical ID·18계산/91입력 사용·법률 규칙 50개·95위험·46예외 및 기존 법률/사람 승인 게이트는 보존. 인가 후 절차를 이번 자동 검토 범위에 새로 넣지 않는다.

## R1. 저장된 계산과 실제 호출 결과 불일치

- **신규** `lib/preapproval-calculation-replay.ts`: 현재 사건의 `executeCaseNodes(data)` 결과와 `case_calculation_features`의 **모든 저장 행**을 `output_path`(JSON 포인터) 기준으로 재검증. 결과값(JSON 문자/수치/null), `value_won`, 허용 상태, 중복 물리 경로, 현행 Fact ID, 잘못된 JSON/경로를 검사한다.
- **실행 연결** `GET /api/cases/:id/approval-readiness`의 `storedCalculationReplay`. 5000개 저장행까지 조회하며 5000개가 정확히 존재해도 유효한 페이지로 인정; 5001행 이상은 잘림으로 간주하여 차단. `CALCULATION_ALL_STORED_ROWS_REPLAY_MISMATCH` 차단 진단이 추가됨.
- **계산 사용 경계:** 원본 `assessment.ts`, 계산식, 기존 계산 DB 쓰기는 변경하지 않음. `transactionReview`/처분/일정/서식은 계산 SQL 필드에 저장되지 않을 수 있어 별도 실행 소비처 검증이 계속 필요.
- **단위회귀:** `tests/preapproval-calculation-replay.test.ts` 5개를 격리 Node 22 환경에서 **5/5 실행 통과**. 기존 isolated P0-09 범위 총 **44/44** 통과. 이 수치는 전체 GitHub 프로젝트 회귀가 아니다.

## R2. 법률 규칙·예외의 심층 사례 공백

- **신규** `lib/preapproval-legal-coverage-audit.ts`: 등록 법률 규칙 **50개**와 예외 **46개** 각각의 원문 필요 피처 키, 실제 관측/검증/법률상 인정 여부, 근거 출처, 관할·신청일 및 판본 검토 여부, 역질문을 read-only로 반환한다.
- **추가 시험 계약:** 이전 42개 법령·실무준칙 재구성 사례에 포함되지 않은 **법률 규칙 19개 + 예외 20개**를 `tests/fixtures/preapproval-uncovered-legal-cases-20261030.json`에 **부족자료 기반 부정(negative) 검증 39개**로 별도 등록. `tests/preapproval-uncovered-legal-cases.test.ts`에서 현재 법률카탈로그를 읽고 해당 자료 없을 때 자동 법률충족 판정이 발생하지 않는지 점검한다.
- **현재 목표 수준:** 50/46 전체를 누락 없이 **등록·입력계약·미확인 안전성** 대상으로 만들었지만, 새 39개가 **공식 판례 사례의 독립 정답 판정**이나 모든 법리 예외의 실행 테스트라는 뜻은 아니다. 독립 사건 정답·실무준칙 시점·법원별 기준은 법률 담당자 검증이 필요.
- 인가 후 **KR-PR-050, EL-40, EL-46**은 목록에는 남기되 `postapproval_deferred`로 구분하고 현재 인가 준비도 업무로 자동 지시하지 않는다.
- API `legalCatalogCoverage`: 50개 규칙별 증거 미관측/미승인과 46개 예외의 trigger 미실행·사람 검토 필요 상태, 공통 피처 질문 우선순위.

## R3. 실제 법원 보정명령의 항목·기한·답변·접수증 연결

- **DB 확장** `drizzle/0022_preapproval_court_correction_items.sql` 및 `drizzle/meta/_journal.json`, `db/schema.ts`. 기존 사건/서류/OCR/검토 테이블 변경 없음. 신규 `case_court_correction_item_versions`(변경 전 버전 보존), `case_court_correction_item_heads`(현재 항목)만 추가.
- **신규** `lib/preapproval-correction-item-store.ts`: 실제 `correction_requested` 사건 이벤트와 *동일 사건의 활성 법원 원본 파일 SHA*, 페이지, 직원이 확인한 원문 문구, 항목번호, 필요한 canonical 필드/관리서류 목록, 필요기간, 근거를 함께 보존한다.
- 보정기한은 **그 법원 원본 PDF에 연결된 현재 `verified+accepted` Fact**를 명시적으로 지정할 때만 입력 허용. 입력 없는 기한은 미확정이며 임의 날짜를 생성하지 않는다.
- 보완답변·접수증은 동일 사건의 별도 `submitted/received/amended` 이벤트를 명시적으로 결합해야만 증거 **후보**로 인정한다. 원본/보정기한·첨부서류·응답 이벤트 삭제/변경/판본 불일치 시 이전 항목은 `stale_source_or_invalid_item`으로 다시 보류한다.
- **API**: `GET /api/cases/:id/correction-items`, `POST /api/cases/:id/correction-items` (`action=upsert_correction_item`, `draft.expectedCaseRevision`, `draft.expectedSourceDataVersion`, `draft.expectedHeadId`). POST는 인증된 `caseworker_review` 권한 필수, 활성 기준정보 서류 ID만 입력, 원본·계산·법적 인정은 수정하지 않음.
- **진단 연결:** `approval-readiness`의 `correctionItems`에 실제 법원 보정 이벤트 중 항목화되지 않은 목록과 오래된 항목/기한·답변 연결 여부 표시. 신규 DB 마이그레이션 미반영 시 `unavailable_fail_closed`; 과거 일반 법률 검토 경로는 유지.
- **사람/법원 경계:** 어느 상태에서도 `courtOrderSatisfied=true`를 자동 기록하지 않음. 첨부자료가 있다는 것과 법원이 해당 보정명령 이행을 인정한 것은 다름.
- **테스트 추가:** `tests/preapproval-correction-item-store.test.ts`에 Node `node:sqlite` in-memory D1 스타일 테스트(append-only, 버전 CAS, 출처해시, 날짜, 응답/접수증, stale, 비인간 actor 차단). **GitHub 전체 실행은 아직 미검증.**

## 직접 실행 / 인수

```bash
cd "prototypes/Daeseong Ray Yang/firmengine-proto/ax-site"
npm ci
node scripts/run-preapproval-regressions.mjs
node scripts/run-preapproval-regressions.mjs --full
```

**운영 배포 전 의무:** (1) 현재 main HEAD에서 전체 테스트·lint·build 통과, (2) 운영 적용 전 별도 staging D1에 0022 마이그레이션을 검증하고 백업·롤백 검토, (3) 실제 제출 법원 주문 PDF/응답·접수증의 원문·기한·항목 일치 검증, (4) 직원·변호사 권한 및 전자서식 검증. 실제 운영 D1/R2, 모델 호출, 배포 및 법원 인가 예측 정확도는 **이번 변경에서 검증하지 않았음**.

**회귀 안전성:** P0-09은 기존 계산·법령 기준정보·법률검토 최종 게이트를 수정하지 않는다. 신규 쟁점·가정값·피처 누락은 법원 인가/보정 완료나 자동 법적 인정으로 변환하지 않는다.
