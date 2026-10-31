# FirmEngine A2 r43 — 데이터담당자: 월별 소득원천 식별·cutoff·SQL 상태 대조 (부분검증)

- 감사일: **2026-11-01 KST**. 역할 순환: r42 변호사 → **r43 데이터담당자** → r44 AX담당자.
- 쓰기 직전 확인 main HEAD: `7595d0eaa9d605bb09809e1fcab577e06ae8be72`. 단일 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A2-DATA-006 / 007 / 012 / 024**를 기준으로 점검. 네 ID 전부 **[ ] 미완료**; 제품 인수 **0건**.
- 제한: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부에 감사 증거만 기록. 실제 고객/OCR/실명/키/.env/비공개 정답 사용 없음. 운영 D1/R2/Cron/배포/전자제출/법원 인가 없음.

## 1. 현재 코드·PR·기존 영수증 교차확인

- main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`: IncomeSource는 `payerIdentityId`, `kind`, `sourceCalculationRole`, `factIds`, `periodStart/End`, `aggregationTreatment`, `recognition`을 분리하고, CaseContext의 `asOf`, `filingPeriod`, `evidence_cutoff`, `incomePeriodReviewed`를 구별.
- main `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`: D5103 `rows.month`는 `{entity,period,revenue,expense,net_income}`만 출력. 계산행 원본 ID/factIds/payerId/원천 기간 말일·검토상태는 해당 월별 행에 **없다**. 따라서 **서식 행만을 입력받는 후단 검사에서 소득원별 기간 완전성·독립 지급자 검토·원천 확인상태를 복원할 수 없다**. 다만 상위 `calculateCase`/writer 게이트가 독립 차단할 가능성은 남음.
- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`의 `incomeGroups.observedMonths`/선택 기간 검토 및 `coverageIncomplete` 코드 존재. 이를 **미실행**하였으므로 helper 단독 불일치를 제품 최종발급 실패로 승격 금지.
- main `lib/context-validation.ts` blob `7ea7262cca177cc92a59f65fe917cc14573786db`: `filingPeriod`, `evidence_cutoff`, `asOf` 날짜별 스키마는 존재. cutoff와 asOf, 개별 소득원 `periodEnd`의 교차시점 검사 경로는 이 정적 확인에서 찾지 못함.
- Draft PR **#108** head `f1916651bb09ba5c26b1994060f7b3e4981ed6df` (Draft·미병합) `lib/income-period-coverage.ts` blob `d3cc44be8fc18b5760d280f1e8aee9076`를 실행. 이미 r42 변호사 영수증의 cutoff·복수원천 반례를 이어 검증함. Draft #106(D5103/D5110/D5111 통합 사전검사) 등은 main 병합 전.
- main migration `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`, main `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`: `value_json`, `value_won`, `status`, `source_fact_ids_json`를 독립 열에 저장. 상태 의미 검사는 DB CHECK로 강제되지 않음.
- 읽은 기존 증거: r42 `2026-11-01_r42_law-evidence-cutoff-and-source-stream.md`, r37 `2026-11-01_r37_0114KST_data-same-fact-review-and-form-gate.md`, main `tests/business-period-integrity.test.ts`, `tests/form-month-calculation-integrity.test.ts`, Draft #108 `tests/a2-r41-period-coverage.test.ts`. 기존 테스트 존재는 최신 main 실행을 의미하지 않음.

## 2. 실제 실행한 Draft #108 함수본문 V8 합성 12건

- 방법: PR #108의 GitHub 저장된 `checkSelectedIncomePeriodCoverage` **실제 함수본문**을 불러와 TypeScript **타입 주석/제네릭/nonnull 표기만 제거**한 뒤 V8에서 실행. 알고리즘 수정·외부 날짜 mock 없음. `selectedPeriod`, `monthRows=[{period,entity,net_income,sourceId?}]`, `evidenceCutoff` 합성 입력. 단 `sourceId`·검토상태는 실제 helper 선언 밖의 진단용 추가 필드로 **함수가 무시**한다.
- 독립 기대는 **데이터 완결성 검토보류 기준**으로서 법률상 월소득 인정/서식 최종 발급 기준이 아님. `complete`는 월 union coverage만 뜻하며 승인 상태 아님.

| # | 합성 입력 | 독립 기대 | 실제 PR #108 | 일치 |
|---|---|---|---|---|
| 1 | 급여 2026-01..12, cutoff 2027-01-01 | complete | complete | O |
| 2 | 급여 1월 누락 | review_required | review_required / COVERAGE_GAP | O |
| 3 | 급여 12월 누락 | review_required | review_required / COVERAGE_GAP | O |
| 4 | 급여 12개월 + 별도 사업소득 11개월(12월 누락) | 원천별 review_required | **complete** | X |
| 5 | 급여 12개월 + 별도 사업소득 1월 1건만 | 원천별 review_required | **complete** | X |
| 6 | 2026-10 관측 240만원, cutoff **2026-10-01** | 그달 전부 관측 확인 전 review_required | **complete** | X |
| 7 | 같은 관측, cutoff 2026-10-31 | complete | complete | O |
| 8 | 2026-11..12 행, **cutoff 미관찰** | 기준시점 확정 전 review_required | **complete** | X |
| 9 | 2026-11..12 행, cutoff 2026-10-31 | review_required | review_required / AFTER_EVIDENCE_CUTOFF | O |
| 10 | 2026-01 금액 **0** | complete(실제 0 관측) | complete | O |
| 11 | 2026-01 `[확인 필요]` | review_required | review_required / EVIDENCE_UNRESOLVED | O |
| 12 | 2026-01 240만원·추가 메타 `reviewState=source-only` | 사실확인/인정 전 review_required | **complete**(메타 무시) | X |

**12/12 실행, 독립 기대 7/12 일치·5/12 불일치.** #4/5는 상위 계산 group gate가 차단 가능하므로 전체 제품 결함으로 확정하지 않는다. #8은 cutoff 없는 경우 미래 여부를 원천만으로 확정할 수 없다는 설계 불확실성이다. #12는 helper 인터페이스 바깥 검토상태를 주입한 **경계 시험**이며 운영 전파 입증 아님. #6도 월초 지급 자료가 존재할 수 있으므로 자동으로 허위값 확정하지 말고 출처별 지급/귀속월·cutoff 검토가 필요하다.

**독립 정수 산술**: 월급여 2,400,000원 ×12=28,800,000원, ×11=26,400,000원(차 2,400,000원); 별도 사업소득 1,000,000원 ×11=11,000,000원. VAT 총매출/종소세 신고액과 이 수치의 등치 금지.

## 3. SQL 상태·원문 계보 합성 재독

- 기존 r37 제공 합성 스크립트 `a2_r37_data_sql_replay.py`를 이번 회차 **직접 재실행**: **9/9 기대와 일치** (인메모리 SQLite, migration 0011의 세 계산 테이블 DDL와 최소 cases stub).
- `"0"`/WON `"0"`/computed 와 JSON `null`/SQL `NULL`/missing를 독립 저장·재독. `source_fact_ids_json=["SYN-FACT"]`도 보존.
- 동시에 JSON `null`/WON `"0"`, JSON `"2400000"`/WON `NULL`, 금액 0/status blocked가 DB상 허용됨을 재확인. 이는 **DB 레벨 무결성 차단 실패 가능성을 관찰한 것**이지 SQL 무결성 9/9 인수 통과 아님. Draft #70 등 replay 방어와 통합해야 함.
- 실제 OCR raw/Fact/typed 직렬화 데이터, 전체 42개 산출행/실 D1/Word 파일은 **이번 회차 미재현**.

## 4. 정적 계산·서식 등록계약을 직접 파싱

- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18** 계산모듈, 입력 선언 **91**회(고유 **78**), 출력 **42**회(고유 **40**), resultPaths **42**개(고유 42).
- main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103/D5110/D5111 등록 토큰 **37/55/82**.
- main `public/templates/catalog.json` blob `9bae52fdf47fbc0935314bb5267503e4182080bd`: 공공 서식 매핑 **35/53/80**, 각각 초과 2개는 내부 `review_status`/`revision`이고 `approval_status=reviewer_pending`. **정적 계약만 확인**, 실제 공식 원본 DOCX 파리티/출력 검증 아님.

## 5. 법률·세무 공식 원문 / 법원·시행판 경계

- 국가법령정보센터 채무자 회생 및 파산에 관한 법률 **[2026-10-02 시행, 법률 제21490호]** [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) 원문 재조회. 36·48·60회 산술과 법원 인가요건 분리.
- **서울회생법원**, **2026-10-01 공식 공지** [실무준칙 제424호 제2조 제2항 제7호 신설](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187). **첨부 PDF/부칙/경과조치·개별 사건 적용일 미검증**; 공지일을 법률 시행일로 착각하거나 자동 적용 금지.
- 국세청 [VAT·종합소득세 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 6개월, 간이과세자 원칙 1년, 종소세 개인 귀속 1년 단위. VAT 공급대가/매입세액·종소세 금액·사업 순이익/법원 인정 월소득은 독립 증빙 피처이며 자동 환산 금지.

## 6. 체크 ID·수정·다음 단계

- **A2-DATA-006 [ ]**: 지급자 ID와 월귀속/지급 시점별 구분을 `IncomeSource`에서 확인했으나 D5103 `rows.month` 투영에는 식별자·기준일 정보가 없음. 실제 Fact/typed/SQL/Word 연결 검증 전 미완료.
- **A2-DATA-007 [ ]**: 별도 사업소득 원천의 11개월 결손이 급여 12개월의 월 union으로 숨겨진 helper 반례. VAT/현금입금/사업자 crosswalk 상위 계산은 미실행.
- **A2-DATA-012 [ ]**: cutoff 월초/미관찰·미래월·0/null·출처전용 상태의 분리 반례. 관할·기준일/지급일 연동 미확정.
- **A2-DATA-024 [ ]**: 실제 SQL 동일 DDL의 인메모리 9/9 재독; JSON/WON/status 상충 저장 허용 및 실 D1/42출력 미인증.

**제품 코드 변경 없음.** #108에 검증 반례와 안전한 데이터 계약 제안 댓글을 남긴다. PR의 의미 변경·분기 결합은 소득인정 실무 검토 전 병합 금지.

**r44 AX담당자 우선**: #108과 #106의 writer/preflight, #96/#97/#98/#102의 동일 Fact/합산 승인 결속을 **실제 Node**로 연결해 소득원별 누락·cutoff·source-only·0/null·검토 전이 D5103/5110/5111까지 어떻게 전달되는지 검증. 이후 `sourceId`, `payerIdentityId`, Fact IDs, `periodStart/End`, 지급/귀속월, review state를 월별 행 검사에 보존할 계약과 승인 경계를 설계. staging D1/R2/Cron·공식 서식 parity·변호사/세무회계 담당자 승인은 별개 미인증.

**코드 존재 ≠ 함수본문 V8 합성 ≠ Node 전체 CI ≠ staging D1/R2/Cron ≠ 실제 DOCX ≠ 공식 법원 서식 ≠ 법률·회계 실무 승인 ≠ 운영배포/법원 인가.**
