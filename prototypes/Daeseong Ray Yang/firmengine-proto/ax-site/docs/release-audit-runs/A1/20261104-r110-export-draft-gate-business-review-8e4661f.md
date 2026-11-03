# FirmEngine A1 — 110차 코드 완결성·기능충돌 독립 감사

- 기준: 2026-11-04 KST, `firmengine/firmengine` `main` 감사 시작 HEAD `8e4661f90df6288820dff1072cee9c38af34ac3a`. 본 영수증 쓰기 직전 재조회 HEAD `8e4661f90df6288820dff1072cee9c38af34ac3a`.
- 지정 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 순환 역할: **IT담당자 → AX담당자 → 계산사무장**. 보드: **A1-IT-014 / A1-AX-014 / A1-CALC-014**, 전부 **[ ] 유지**. 선행 109차 `20261104-r109-fact-approval-pagination-0150KST.md`·보드 기존 기록을 검토.
- 실제 원본과 해시: `lib/export-artifact-transaction.ts` **a114235e5b5de57b5ae58b41026f939ee8543174**, `lib/automatic-review-draft.ts` **5ee8860250303ac9ca513b0be22e886f98c8e904**, `lib/case-lawgraph-store.ts` **eea435bb78f804c79a213c464af54e8014a3c3a5**, `lib/business-net-reconciliation.ts` **60a4fc295943dce404a7f99efffe88f58dd2d4ff**. `db/schema.ts` **933f8686845ac14669312dd21bf85e02c62ed5e6**, `tests/export-artifact-transaction.test.ts` **a684612f61234a9fb0ac30261684733ba749eefc** 열람.
- 선행 관련 PR은 재조회 당시 **#24, #17, #202, #55, #85, #61 모두 open/draft, 미병합**. 타입 표기를 제거한 GitHub 실제 함수 본문을 JS V8에서 실행(보조 계약·저장소는 합성 stub), 별도 SQLite `:memory:`에서 main `automatic-review-draft.ts`의 SQL UPDATE 절을 그대로 실행. **Node 앱/전체 CI 및 실제 D1·R2·브라우저 사용 없음.**

## A1-IT-014 — 문서 생성 실패, 취소, 응답 소실: 원본 보존

- 함수: `commitExportArtifactTransaction`. 합성 R2 객체 `K1`, D1 artifact `R1`, manifest `R1` 세 계층을 각각 Set으로 모델링. 독립 기대 11조건 중 **main 9/11**, [기존 Draft #24](https://github.com/firmengine/firmengine/pull/24) 원본 수정 함수(blob **10dc79b9ec9dcf29ff74901af6a621a17d880573**) **10/11** 일치.
- `success`: 기대/관찰 R2=1,D1=1,manifest=1, 성공, main/PR 통과.
- `upload_before_write`, `upload_after_write`, `persist_before_write`, `persist_after_write`: 기대/관찰 R2=0,D1=0,manifest=0, 실패+호출 소유 staging 정리, main/PR 통과. 업로드 완료 뒤 오류/DB ACK 유실의 함수를 통한 **합성** 주입이며 실제 네트워크 장애 아님.
- `precommit_conflict`: 커밋되지 않았음이 명시적으로 알려진 합성 CAS 충돌, 기대 staging 정리(0/0/0). **main 0/0/0 통과; #24는 1/1/0 객체·행 고아 보존(미일치)**. PR은 충돌도 ACK 불확실로 간주하기 때문이며 실제 지연 커밋 위험이 있으므로 즉시 삭제 정책을 제안하지 않음.
- `ack_lost_after_commit`·`timeout_after_commit`: manifest 영속 커밋 뒤 응답만 예외 발생. 기대 R2=1,D1=1,manifest=1 + 재확인 대기. **main R2=0,D1=0,manifest=1(각 1건 실패)**. 기존 P0 재현. **#24는 1/1/1 보존 및 `onCommitUncertain` 1회**.
- `aftercommit_logger_error`: 기대/관찰 1/1/1 보존, 실패 전파. `cancel_after_upload`: 주입 Abort 오류 뒤 0/0/0, 실제 AbortSignal 검증 아님. `duplicate_targets`: 동일 object key는 쓰기 전 `EXPORT_ARTIFACT_TARGET_DUPLICATE` 거부. 모두 main/PR 기대 일치.
- 실제 중단/브라우저 취소·HTTP 재시도 멱등성·영속 recovery receipt·동시 manifest CAS·운영 D1/R2 장애는 **미검증**. **#24의 불확실 보존과 #61 영속 복구 논의를 함께 검토**. 코드 변경/머지는 수행하지 않음.

## A1-AX-014 — 미확정 계산/법률과 초안 승격 및 commit CAS

**A. 계산·법률 gate**: `automatedDraftEligibility` 실제 함수 본문(기본 RISK_CATALOG 대신 테스트의 명시적 예상 `C01/C02/C04`; checkCoverage는 같은 규칙의 합성 helper). 필수 `monthlyPaymentWon` 1개로 독립 기대 **26조건: main 19/26, [Draft #202](https://github.com/firmengine/firmengine/pull/202) blob `b358a73f64168004893bcbe40f2876ab81307d1e` 26/26**.

- 정상 computed `"42"`, 명시적 computed `"0"`: 둘 다 **초안 eligible**(최종 승인 아님); null / unknown / `""`은 둘 다 차단.
- **main 오허용 7건(독립 기대 false, 관찰 eligible=true)**: `value="0",status="not_applicable"`; status 미기재; `status="unreviewed"`; `NaN`; `Infinity`; `"12.5"`(원화 정수 표현 아님); 숫자 `100`(정형 문자열 계약 위반). #202 모두 차단. `value="0",status="missing"/"conflict"`는 main도 차단.
- 합법적인 draft-only 예외 경계 확인: `provisional` 숫자문자열과 `allowHumanReviewPendingForDraft=true`에서 `legal_review`는 예비 초안 허용. **두 코드 모두 `canFinalize=false`, `courtApprovalInferred=false` 고정**. 위반 7건을 법원 인가 오승격으로 해석하지 않음. stale 계산 head, 미완료 법률, fail/conflict, engine block, 중복 필수필드, 명시적 실패 모두 차단.

**B. 마지막 완료 원자성**: main `generateAutomaticReviewDraft`의 `UPDATE case_automatic_document_runs ... EXISTS(case_legal_review_heads JOIN case_calculation_heads)` SQL을 그대로 옮겨 SQLite 메모리의 `cases/case_data_change_state/case_calculation_heads/case_legal_review_heads/case_legal_automation_jobs/case_automatic_document_runs` 합성 테이블에 실행. `CASE-1` revision 1, dataVersion 7, calc `CALC-A`, legal `LEGAL-A`, worker `JOB-1`로 고정한 후 선행 assertCurrent와 commit UPDATE 사이 레이스를 주입. **12조건 중 main 5/12 기대 일치**.
- 정상 pending: 독립 기대 변경행1 / 실제1. 법률 head 변경·이미 complete·doc run dataVersion 불일치·법률 head dataVersion 변경은 기대0/실제0.
- **독립 기대 변경행0이나 실제1(7건)**: 사건 revision 변경, source `case_data_change_state.data_version` 변경, worker lease token 변경, worker lease 만료, worker status `failed`, 현재 계산 head `CALC-A→CALC-B` 교체, worker job 삭제. 현재 SQL은 해당 상태를 업데이트 술어에서 재확인하지 않음. 완료 바로 전 `assertCurrent` 존재는 확인했으나 **TOCTOU 경합 가능**.
- 기존 [Draft #17](https://github.com/firmengine/firmengine/pull/17) helper blob **ebb2de08c1371ed3c37d9946f37b3ce251a8b628**의 `receiptSql`(19 바인드/19 placeholder) 및 `finishSql`(16/16) 원본 함수를 실행하고 revision, dataVersion, calculation/legal head, reference sha, worker status/lease, pending 술어 존재를 비교. **SQL을 실제 SQLite에서 실행한 것은 main뿐**; #17은 JS helper 생성/술어/바인딩 검사이므로 통합 통과로 표기 금지.
- `automatic-review-draft.ts`는 배치 안에 실패 가능한 분석 receipt insert + 문서 run update를 함께 수행. 실제 D1 transaction 동작/동시 리스/문서 파일 영속성 미검증; 추가 승인과 브랜치 통합 전 미완료.

## A1-CALC-014 — 수정 소득의 제안자/승인자·source 및 계산 소비 분리

- `validBusinessNetReview` 원본 본문에 독립 actor 경계 12조건 입력, `exactReview`(Fact/소득재계산 근거 검사)는 합성 true 또는 false로 주입. **main 8/12, [Draft #55](https://github.com/firmengine/firmengine/pull/55) blob `7a5552d23ce2324b9238b328e8287c100b38f724` 12/12, #85 단독 8/12**. main은 과거 승인 `reviewer=proposer`, 공백동치, 비어 있는 proposer, 공백 proposer 총 4건을 승인으로 판정; #55는 모두 차단. 다른 reviewer·정상 reason/date·source current 조건은 정상.
- `adoptBusinessNet` 원본 본문에 12조건 입력, 소득 산식/Fact 검사 `exactReview`, month 날짜, 금액 정규화는 합성 stub(근거 정확도 측정 아님). **main 9/12, [Draft #85](https://github.com/firmengine/firmengine/pull/85) blob `98ebec78633b93980f08ed50c508e5b12fc331b4` 12/12, #55 단독 9/12**. main은 `proposer="staff",actor=" staff "`와 비어 있는 proposer `""`/`"  "`를 승인. 정확히 동일한 `staff→staff`, 빈 승인자, 짧은 사유, 무효 날짜, 구 소득 ID, stale source는 정상 거부.
- **#55와 #85는 같은 소스 파일을 고치지만 각각 다른 게이트**. 둘을 독립적으로 본 성공 수치를 통합 완료로 해석 금지. 동일인 actor 규칙/사람 권한/법률 판단·소득 계산 의미는 담당자 승인 필요.
- 테스트 실행 중 초기에 격리 harness 오류(`fnsNoop is not defined`)가 발생한 adopt 시도는 **전건 무효 처리**하고 수정 후 정확히 12조건을 재실행한 위 수치만 기록. 이 harness 오류를 제품 결함으로 계수하지 않음.

## 종합 및 인수 경계

- 실제 수행한 선택 조건은 **V8 IT 9/11 + AX 19/26 + CALC 17/24**, 별도 **SQLite main 5/12**. 전체 제품 점수·85서류·18계산·95법률 통과율이 아님.
- 이번 실행에서 **기존 P0/P1 위험을 재확인**했지만 후보 PR 모두 미병합, 서로 겹치거나 법률 승인·금액 출처 정책을 포함해 **main 제품 코드를 수정하지 않음**. 문서 1건과 중앙 보드의 세 A1 ID만 보존 병합할 예정.
- 최신 사실/승인 단계는 `unobserved / null / explicit 0 / not_applicable / conflict / source-only / provisional / approved`로 구분. 합성 Stub 결과는 사람 인정값·법원 확정값이 아님.
- 전체 Node/TypeScript/CI, 실제 브라우저, staging D1·R2·Cron, 공식 법원 서식, 변호사 승인, 상담→85요구서류→OCR→18계산→95법률→초안→보정명령 실제 종단 처리 **모두 미검증**. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 없음. 실제 Extra High 모드 설정 여부 미확인.
- 다음 순환 역할: **사용자·서류담당자 → 변호사 → 데이터담당자**, 보드의 **A1-DOC-015 / A1-LAW-016 / A1-DATA-014** 우선 검토. 이후 IT의 #24/#61, AX의 #17/#202, CALC의 #55/#85는 각각 충돌·통합·실무자 검토 후 재검증.
