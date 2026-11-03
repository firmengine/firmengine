# FirmEngine A1 115차 — 법원 보정 UI·절차 근거·DB 사건 경계 (2026-11-04 07:50 KST)

## 기준·증거등급
- 지정 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만 읽고 쓰며, 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 [ ] `A1-DOC-017`, `A1-LAW-018`, `A1-DATA-016`을 선별. 114차 다음 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**.
- 감사 시작 GitHub main `54ae79912caf2b815766acdc2bd088621d575e86` (해당 시점 최신 main). 직전 114차 영수증 `20261104-r114-ci-n8n-form-amount-0651KST.md`, 기존 21·41·81차 인수 기록 및 기존 Draft PR #90, #107(둘 다 2026-11-04 확인 시 open/draft) 대조.
- 원본문 및 blob: `components/case-workflow.tsx` `2ec797958726b99a4358ec46ef35f78f90bfd927`; `lib/case-procedure-events.ts` `7c61fdfb6e79becc415a8b1385a1580bd8aa6ab2`; `lib/preapproval-correction-audit.ts` `2cd18e22c9db4e5865f08b4d183f2d1751b0bf21`; `lib/preapproval-correction-item-store.ts` `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`; `lib/approval-readiness.ts` `d3aecf05688d3146ecff94a3795bb3da8a215d35`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `drizzle/0022_preapproval_court_correction_items.sql` `bec8b19780eaa951c4994530060c916f903a40fe`; `drizzle/meta/_journal.json` `45ec213999a1cf35bc65bdaf79f63a053e7d9796`.
- 실행: connector에서 받은 **실제 TypeScript 함수 본문**의 선언 타입만 제거, `new Function`으로 V8 격리 호출. 외부 의존성은 가상 객체로 구성. SQLite는 원본 0022 DDL을 주석/Drizzle breakpoint 제외하여 그대로 메모리 DB에 실행하고 합성 `cases(id)`, `documents(id,case_id)` 부모 테이블을 구성, `PRAGMA foreign_keys=ON`. 모두 가상 사건·문서·Fact이며 실제 의뢰인·법원 자료를 사용하지 않음.
- 범위 한계: V8 함수 단위·SQLite 메모리 인수 ≠ Node/TypeScript 전체 CI ≠ 인증된 HTTP UI ≠ staging D1/R2/Cron ≠ 실제 법원 원본/변호사 인가 ≠ 운영 배포. 본 감사에서 직접 출처 문서 검증·전자제출/인가/DB 운영 마이그레이션 수행 안 함.

## A1-DOC-017 — 기록된 법원 이벤트와 내부 자료요청의 UI 구별 [ ] 유지
- 실제 `auditPreapprovalCourtCorrections` 원본문 7개 합성 상태: (1) 이벤트 없음 → 0건; (2) 활성 법원문서+인정 Fact → `verified_evidence_candidate`, `lawyer_review_and_filing_receipt_required`, 만족 `false`; (3) **은행자료 bank-1만 연결된 `correction_requested` 이벤트** → 법원 원문 아님에도 `courtOrderCount=1`, `verified_evidence_candidate` (**독립 기대: 법원 원본 미확인으로 공식 명령 계수·표시 금지, 불일치 1**); (4) 원본 철회 → `court_order_source_or_itemization_missing`; (5) 미인정 Fact → `unreviewed_or_conflicting_evidence`; (6) 미관찰 항목 → `source_not_observed`; (7) `amended` 이벤트는 관계 확정 없이 별도 `unboundAmendmentCount=1`.
- 독립 기대와 관찰 **6/7**. 모든 경우 `courtOrderSatisfied=false`이며 `deadlineAssignedToThisOrder=false` — 법률 승인은 발생하지 않음. main `approval-readiness.ts`는 해당 이벤트를 `origin=recorded_court_event`, `isOfficialCourtCorrectionOrder=true`로 표시하는 코드 경로가 있어, **실제 법원 원본인지 확인하지 않은 기록을 공식성 있는 표기로 노출할 위험**을 정적으로 교차 확인.
- `case-workflow.tsx`는 `correction_requested` 선택지를 단순 '보정 요청', `approved`를 '인가'로 표시하며 문서 ID 입력만 요구하고 발령기관·공식문서 인증 UI를 확인할 수 없음. 이는 **UI 코드 정적 관찰**이지 브라우저 테스트가 아니다. 기존 Draft #90 (해당 UI 파일 수정), #32 (동일 UI 명령 ACK)와 충돌할 수 있어 직접 변경 보류.

## A1-LAW-018 — 법원 절차 이벤트의 근거 문서 종류 검증 [ ] 유지
- 실제 `validateProcedureEvent` 원본문 V8, 입력은 `state/actor/reason/occurredAt/courtReference/sourceDocumentIds/artifactIds`를 갖춘 합성 이벤트.
- 10개 독립 기대/관찰: generated 문서 없음 허용(일치); 보정명령 court-1 ID 허용(형식 한정 일치); **은행잔고증명 bank-1 ID만으로 correction_requested 허용(기대 거부, 불일치)**; **은행잔고증명 bank-1 ID만으로 approved 허용(기대 거부, 불일치)**; 법원 번호 공백·근거 문서 ID 없음·다른 사건 문서 ID·날짜 오류·존재하지 않는 artifact ID·미등록 state는 모두 거부(6/6 일치). **8/10**.
- 본 함수는 `knownDocuments:string[]`만 검사하며 문서 `documentType`/발행기관/진위/접수증명을 입력받지 않음. 따라서 **같은 사건 활성 문서라는 조건과 법원 원본 사실확인은 별개**. 기존 이슈 #11 및 Draft #90 확인; 법률상 승인 정책을 요구하는 변경이므로 이번 main 무단 수정 없음.
- `preapproval-correction-item-store.ts`는 동일 사건 ID·원본 SHA·활성 페이지·response 이벤트·기한 Fact 등 추가 확인 경로를 별도 구현, `courtOrderSatisfied:false` 유지. 이를 전체 법원 절차 이벤트 검증으로 확대 해석하지 말 것.

## A1-DATA-016 — schema/migration 경계와 교차사건 참조 [ ] 유지
- 최신 journal `0000..0022` 23 entries ↔ 실제 SQL 파일 23개 **23/23**, 누락/미등록 0. SQL 0022 두 테이블의 필드명 ↔ Drizzle 이름 **11/11 + 7/7**, 누락/초과 필드 0. SQL의 `item_no CHECK(1..500)`과 달리 main Drizzle `itemNo`에는 CHECK 미선언(기존 Draft #107과 같은 갭). 이는 **정적 계약 검증**.
- 실제 SQLite `PRAGMA foreign_keys=ON` 9가지 합성 삽입:
  1. 정상 version A+doc A 수용(일치).
  2. **version.case_id=A인데 order_document_id=doc B(문서 소유 B)** 수용(**독립 기대 DB 거부, 불일치**).
  3–4. `item_no=0/501`는 CHECK 차단(일치×2).
  5. 존재하지 않는 문서는 FK 차단(일치).
  6. 정상 head A→version A 수용(일치).
  7. **head.case_id=B인데 version_id=version A** 수용(**독립 기대 DB 거부, 불일치**).
  8. 중복 head PK는 차단(일치).
  9. 없는 version FK는 차단(일치).
- SQLite **7/9 독립 기대 일치**. 두 실패는 **DB 단독 소유권 정합성 제약 공백**이지 현재 API에서 실제 타 사건 데이터 접근이 입증됐다는 의미가 아니다. 실제 쓰기 함수는 `actualOrder.caseId===caseId` 및 case revision/dataVersion 검사를 수행하고, 읽기 함수는 sourceCurrent 재확인. 그러나 read JOIN `h.version_id=v.id`만 사용하고 `h.case_id=v.case_id`를 JOIN에 추가하지 않아 DB 비정상행에 대한 이중 방어는 불충분한 것으로 정적 확인.
- 교차사건 FK 보완은 기존 마이그레이션과 호환성·데이터 수정 정책 및 사건 분리 보안 영향이 있으므로 **추가 migration/실무 설계·독립 회귀·PR 승인 전 main 변경 금지**. 실제 D1 이전/롤백·전체 Drizzle generator/Node/CI는 미실행.

## 코드 조치·다음
- 이번 제품 코드 수정 **0**. 기존 동일 파일 Draft PR #90/#107이 존재하며, 법원 원본 인증·DB 소유권 무결성은 고위험 정책/마이그레이션 변경. 충돌 없이 기존 수정 검토/별도 설계 우선. 중앙 보드·고유 영수증만 반영, 다른 A축 기록 보존.
- A1 결함은 기존 ISSUE #11/기존 UI 갭과 DB 독립 제약 추가 관찰이며 운영 악용·법원 승인 사고를 입증한 것은 아님. 선택 함수 합성: DOC **6/7**, LAW **8/10**, SQLite **7/9**. 모든 A1 ID **[ ] 유지**. 제품 종단 인수 **0건**.
- 다음 역할 **IT → AX → 계산사무장**, 우선 `A1-IT-017` (현재 배포 소스 판본 불일치), `A1-AX-017` (직원 오류 원인·영향·복구 표기), `A1-CALC-017` (계산 오류 상태에서 초안/법률 AI 시작 차단). 신규 PR/실무 검토시 변경 범위 `ax-site/`만 허용.
