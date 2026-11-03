# FirmEngine A2 r93 — IT담당자 / 계산 run 소유 사건·판본과 서식 SQL readback 격리검증

- 날짜: **2026-11-03 KST**. 순환: r92 **AX담당자** → r93 **IT담당자** → r94 **사용자·서류담당자**.
- 허용 Git 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. **운영 배포/운영 D1 migration/전자제출/법원 인가 실행 안 함**.
- 최초 main HEAD `a5e42fbd1f59909a8aeca4b98a06d656fc65754f`; 이전 [r92](2026-11-03_r92_0817KST_ax-source-subject-fact-pr207.md) 후속.
- 기준 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A2-IT-003 / A2-IT-015 / A2-IT-019 / A2-IT-020**. **[ ] 4개 유지, 제품 최종 인수 0건**. 상태: 기술적 부분검증, 법률/세무/실제 법원서식 미인증.
- 원본 main blob: `lib/lawgraph-document-field-projection.ts` `a017294aa814f4d33360c2531abf91d9eb79a6e0`, `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`.
- 기존 `tests/lawgraph-document-field-projection.test.ts` blob `63e1b89a02c0235f0106fd7eec69d1f936da2ec5`, `tests/case-calculation-feature-store.test.ts` blob `844525d8633442d571ced2c48ed5bd00ba7bb5a0`, r92 synthetic test `1f682129dd3128bc02e749a781ef3e7ce8867d72` 재독. 선행 Draft [#100](https://github.com/firmengine/firmengine/pull/100), [#195](https://github.com/firmengine/firmengine/pull/195), [#198](https://github.com/firmengine/firmengine/pull/198), [#199](https://github.com/firmengine/firmengine/pull/199), [#205](https://github.com/firmengine/firmengine/pull/205), [#207](https://github.com/firmengine/firmengine/pull/207) 변경 파일/상태 조회.

## 1. 실제 재현: run_id 단독 조회는 case/revision/dataVersion 증명이 아님

현재 main `buildStoredLawgraphDocumentFields(database, {caseData,calculationRunId,...})`의 SQL은 `case_calculation_features WHERE run_id=?`만 조회한다. `case_calculation_runs`의 `case_id / case_revision / data_version`을 해당 함수에서 검증하지 않는다. 반면 **실제 호출자** `case-legal-automation.ts`는 `latest()` / `assertCurrent()`로 활성 계산 head를 선행 검증하고 있어 **직접적인 웹 API 취약성이나 운영 오염을 증명한 것이 아니다**. 호출경계의 defense-in-depth 부재라는 **P1 후보**.

- 합성 Raw/OCR: **미사용·미관찰**(실제 고객 자료 없음). 합성 Fact ID `FACT-SYN-A` 및 `FACT-SYN-B`는 SQL feature 근거 문자열이며 DB에 사실/승인 상태가 실제로 입증된 Fact가 아니다. `source-only`를 법원 인정 Fact로 승격하지 않음.
- 합성 typed 기대: `caseData.context.id="SYN-A"`, `revision=7`, live `dataVersion=3`, 계산 `runId="RUN-SYN-A"`. SQL `case_calculation_runs`의 해당 run 소유가 `SYN-A / 7 / 3`일 때만 서식 참조 readback 허용.
- 반례: `RUN-SYN-B`가 `SYN-B / 7 / 3`이고 `F-SYN-B` feature의 `value_json="\"0\""`, `value_won="0"`, `source_fact_ids_json=["FACT-SYN-B"]`라면 원래 SELECT는 **타 사건 feature 1행을 그대로 반환**. SQLite 0011 동형 DDL+FK ON 실제 Node `node:sqlite` 실행으로 관찰; FK 오류 0. 원단위 명시적 0원은 문자열 0으로 보존, `NULL`과 혼합하지 않음.
- 추가 경계: 같은 사건이지만 `caseRevision=6` 또는 `dataVersion=2`, run 누락, malformed int 모두 **검토 차단 기대**, 단순 정상/서식 값 일치만으로 통과 불가.

## 2. 독립 기대/관찰

| 6종 run 시나리오 | 독립 기술 기대 | main 추출 함수 V8 관찰 | #209 제안 함수 V8 관찰 |
|---|---|---|---|
| 같은 사건·revision·dataVersion | 1행 조회 | 1행 | 1행 |
| 타 사건 run | 차단 | 1행 반환 (불일치) | `DOCUMENT_CALCULATION_RUN_CONTEXT_MISMATCH` |
| 구 caseRevision | 차단 | 1행 반환 (불일치) | 위 오류 |
| 구 dataVersion | 차단 | 1행 반환 (불일치) | 위 오류 |
| run 미관찰/null | 차단 | 1행 반환 (불일치) | 위 오류 |
| malformed dataVersion 문자열 | 차단 | 1행 반환 (불일치) | 위 오류 |

- GitHub **실제 함수 본문**의 TypeScript 표기만 제거한 V8 Function 실행. `projectLawgraphDocumentFields`는 **합성 stub**이므로 **main 1/6 vs 제안 6/6 기술 기대 일치**는 저장 필드 projection 전체/서식/법률 인증이 아님.
- 로컬 Node **v22.16.0** `node --experimental-strip-types --test`: 36/48/60개월 × 정상·타사건·구revision·구dataVersion·미관찰/비정형의 15조건, 명시적 0/null 구별 1, 실제 0011 DDL 합성 SQL 재조회 1 = **17 PASS / 0 FAIL / 3 TODO**. 테스트는 PR에 작성한 것과 동일 계약을 가진 **로컬 복사**로 실행. 공식 저장소 의존성·전체 Node runner **미실행**.
- 단독 helper `tsc --noEmit --strict --target ES2022 --module ESNext` **PASS**. **프로젝트 전체 TypeScript/ESLint/CI는 미실행**, Actions status 수신 0개.
- 독립 BigInt 산술: 월 가용소득 900,000원 × 36/48/60개월 = **32,400,000 / 43,200,000 / 54,000,000원**; 0원×각 기간=0원. 이것은 **독립 기대값**이지 실제 18개 계산엔진 출력이나 법원 인정 변제금액이 아님.

## 3. 수정안/충돌/HOLD

- [**Draft PR #209**](https://github.com/firmengine/firmengine/pull/209), 브랜치 `audit/a2-r93-it-form-run-identity-20261103`, head **`c9ce3249beaac4e4d4dd8080529f0ea05bccb278`**. 변경 4개 파일 모두 지정된 ax-site 하위.
- `lib/calculation-form-run-identity.ts`: strict caseId/caseRevision/dataVersion 순수 검증. `lib/lawgraph-document-field-projection.ts`: 추가 SQL SELECT로 실제 run identity 조회 후 불일치/미관찰 차단. `lib/case-legal-automation.ts`: 이미 있는 `job.dataVersion`을 호출부에 전달. `tests/a2-r93-it-form-run-owner.test.mjs`: 합성 17조건+TODO3.
- **별도 Draft, main 제품 소스 수정 없음.** #207/#205/#195/#100/#198/#199와 법원서식 projection 파일의 변경 경계가 겹치므로 **무검증 병합 금지**. #209는 이전 PR에 존재하는 Fact 적격성·잘못된 Won 문자열·Fact ID 구조 검사를 대신하지 않는다.
- 정상 run identity라도 **활성 head / input SHA / reference SHA / Fact 소유 / OCR 인정 상태**는 여기서 별도 미검증. 변호사·서류담당자 승인 없이 `linked_calculation`/계산 `computed`를 법적 인정으로 승격하지 않음.
- 현재 main `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18모듈, 입력 선언91(고유78), 출력42(고유40), resultPaths42**. `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5110 **55**, D5111 **82** 등록 토큰. **정적 집계만**; 18모듈/91입력/42출력 계산·DB 저장·실제 DOCX ZIP/XML 생성·재독은 미실행.

## 4. 공식 법률·국세청 확인 (시행과 사건 적용 분리)

- **서울회생법원, 2026-10-01 공지**: [실무준칙 제424호 제2조 제2항 제7호 신설](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187). 공식 페이지 원문 확인. 첨부 **개정 PDF 부칙/경과조치 미확인** → 법원·신청일에 따른 적용 **미인증**, 자동규칙 미변경.
- **국가법령정보센터**: [법률 제21490호, 2026-10-02 시행 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://www.law.go.kr/LSW/lsLinkProc.do?joNo=061400&lsNm=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0&mode=11); 변제기간/청산가치·인가요건과 SQL technical pass를 혼동하지 않음. 과거 사건 소급·적용일은 별도 검토.
- **국세청**: [부가가치세 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574), 일반과세자 반기 6개월, 간이과세자 통상 연 1년. 신고 금액을 월 인정 순소득으로 자동 확정/이중 가산하지 않음. VAT/종소세·급여/사업 월별 실데이터 교차검증은 미실행.

## 5. 다음 r94 (사용자·서류담당자)

1. #209와 #207/#205/#195/#100/#198/#199의 **실제 변경코드 및 구형 테스트 기대값** 병합 충돌을 인수 검토. Node project runner/전체 TypeScript/CI 실제 실행 영수증 확보하기 전 합격 금지.
2. **원문→Fact→typed→0011 SQL case/run/source version→D5103/D5110/D5111 출력 및 실제 DOCX bytes** 동일 사건·동일 판본 대조. 0/null/미관찰·외부/철회 Fact·미래월·반복채권/소득월·VAT/종소세 중복별 테스트.
3. 서울 제424호 제7호 개정 **첨부 전문·부칙·사건별 적용** 및 공식 서식·변호사/계산사무장 최종 승인 별개 HOLD. 전체 CI, staging D1/R2/Cron, 운영 배포/전자제출/법원 인가는 **미실행**. 공개 Git에 실제 개인정보/OCR 원문/키/env/비공개 정답 저장 금지.
