# FirmEngine A2 r46 — 사용자·서류담당자 / 미관찰 증빙 기준일의 D5103 완결 오판

- 작성: 2026-11-01 KST (직전 r45 IT → 이번 r46 사용자·서류 → 다음 r47 계산사무장).
- 전용 작업범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 중앙보드 A2-DOC-004/015/016 **3개만** 보완, 모두 **[ ] 부분검증/미인수**.
- 시작 main SHA: `e4b75210871bbaaafea3d9dae32e4c844d74970a` (감사 도중 다른 에이전트 커밋 가능; 최종 SHA는 재조회 기준).
- 감사 전 읽음: 단일 통합보드, r45 영수증, 최신 commit/PR, #106/#108/#113/#115 메타와 실제 코드, main `lib/form-mapping.ts`, `lib/domain.ts`, `lib/document-preflight.ts`, `lib/document-writer.ts`, `lib/reference-decision-tables.json`, `lib/template-token-catalog.json`, `public/templates/catalog.json`, `drizzle/0011_case_calculation_features.sql`, `lib/case-calculation-feature-store.ts`, 기존 41·44·45차 합성테스트 및 SQLite 재현.
- 읽은 주요 main blobs: `form-mapping.ts=514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; `0011=0caa359d250dce45765d269d271ad63170ec3efa`; `reference-decision-tables.json=6924e3977caf748ce8a3d617fae15aff7d2fe2ce`; `template-token-catalog.json=899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- 코드는 **Draft PR #117** (https://github.com/firmengine/firmengine/pull/117), 이전 #115→#113→#108에 누적되는 stacked Draft. 소스 1개+테스트 1개 변경. **main 제품코드 변경·독립 병합 없음.**

## 실제 합성 입력 / 독립 기대 / 관찰

GitHub #115 `lib/income-period-coverage.ts` 소스 blob `8d038ca99d33a129dd155417aeae9737195eb0f4`를 재조회하고 **TypeScript 주석/타입 선언을 제거한 실제 함수 본문**을 V8 격리 실행. 16개 합성 시나리오에서 **부모 13/16 → Draft #117 16/16** 독립기대 일치. **실제 Node 프로젝트 테스트·전체 CI 실행 아님**. 새 `tests/a2-r46-doc-unobserved-cutoff.test.ts`는 16개 테스트 소스를 GitHub에 커밋, 해당 새 테스트 러너는 **미실행**.

| 합성 원천/대표기간/컷오프 | 독립 기대 | #115 관찰 | #117 함수 V8 관찰 |
|---|---|---|---|
| D5103 2026-10 소득 2,400,000원, 선택 10-01~10-31, cutoff=`null` | review_required / cutoff 미관찰 | **complete** | review_required + `D5103_EVIDENCE_CUTOFF_UNOBSERVED` |
| 같은 월, cutoff=`undefined` | 검토 보류 | **complete** | review_required |
| 2026 12개월 급여 각 2,400,000원, cutoff=`null` | 12행 있더라도 시점 미관찰 | **complete** | review_required |
| 10월 cutoff=10-30 / 10-31 | 월중 보류 / 월말 완결 | 보류 / 완료 | 보류 / 완료 |
| 2028-02 윤년 cutoff=02-28 / 02-29 | 보류 / 완료 | 보류 / 완료 | 보류 / 완료 |
| 2026 1~12월 중 첫/마지막 달 누락 | 해당 월 공백 | 공백 검출 | 공백 검출 |
| 명시 소득 `"0"`, cutoff 월말 | 0원 유효 관측 | complete | complete |
| 소득이 숫자형 `0` 또는 `null` | 잘못된 타입/미관찰 | review_required | review_required |
| 선택 대표기간 11개월에 11개 월행 | **법정 12개월 강제 금지** | complete | complete |
| 선택기간 없고 월행도 없음 | 비해당 | not_applicable | not_applicable |

**독립 산술**: 2,400,000×12=28,800,000원, 2,400,000×11=26,400,000원, 차이=2,400,000원. 이는 입력 검증 산술이며 법률상 인정 월소득 추정이 아님. 소득원별 급여 12개월·사업 11개월이 하나의 월 집합으로 병합되어 누락을 가리는 반례는 **독립 기대 미달/미해결**. VAT 총매출과 사업 순이익·종소세 신고금액은 별도 성격이며 자동 합산·동일시하지 않음.

**연결 관찰 경계**: #115 `document-writer.ts`에서 `data.context.evidence_cutoff??null`을 helper로 전달하며 `coverage.status=review_required`이면 final blocker, draft warning으로 분기하는 코드를 정적 재독. #106의 D5103/D5110/D5111 preflight는 별도 Draft. 따라서 실제 통합 `prepareDocumentWrite()` final/draft, Word 바이트/행, 법원서식 동등성은 **미실행**. #117은 정식 DOCX 발행 결함의 제품 E2E 입증이 아니라 불완전 증빙을 검토완료로 간주하는 **검증 helper 자체의 결함 수정 후보**.

## 원천→Fact→typed→SQL→서식 상태와 계약

- main `domain.ts`의 `IncomeSource`: `payerIdentityId`, `aggregationTreatment`, `aggregationReviewed`, `periodStart/periodEnd`, `amountBasis`, `factIds`, `recognition` 분리. D5103 월행 변환은 `entity,period,revenue,expense,net_income`만 투영, 소득원 ID/Fact ID/원천 검토상태 소실 위험 유지.
- SQL 0011: `case_calculation_features`는 `value_json`, `value_won`, `status`, `source_fact_ids_json` 개별 저장. 기존 r37 합성 SQLite 스크립트를 **현재 컨테이너에서 재실행 9/9** (명시0/NULL/source-only/FK, 상충 금액 허용). **실제 D1 SQL 왕복 미실행**. 구조상 JSON `null`/WON `"0"` 상충이 저장 가능하며 현재 수정 범위 밖.
- main 등록정보 직접 JSON 파싱 **18 계산모듈, 91 입력선언(고유78), 42 출력선언(고유40), 42 resultPaths**. 서식 등록토큰 D5103 37 / D5110 55 / D5111 82, public mapped_tokens 35/53/80, 전부 `reviewer_pending`. 정적 개수 일치 ≠ 산식 42개 값 E2E ≠ 실제 Word 출력 ≠ 공식 법원서식 승인.

## 공식 원문 (2026-11-01 재조회)

- 채무자회생법 [시행 2026-10-02, 법률 제21490호] 제611조: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777
- 동법 제614조: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759
- 서울회생법원 2026-10-01 실무준칙 제424호 제2조 제2항 제7호 신설 공지: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187
- 국세청 일반 6개월/간이 통상 12개월 VAT 과세기간: https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486

- 제611조·제614조 법령은 **2026-10-02 시행판**. 서울회생법원 제424호 7호는 **2026-10-01 공지**를 확인한 것일 뿐, 첨부 PDF 부칙·경과조치/개별 사건 관할·적용일은 **미관찰**. 자동 법률 인정·기간 단축 규칙 추가 없음. 최종 변호사/계산사무장 검수 전 **법률·회계 적합성 미인증**.

## ID와 다음

- **A2-DOC-004 [ ]**: D5103 관측월/선택기간: #115 실제 helper V8 합성 16건 독립기대 13/16, #117 수정후 16/16; cutoff=null·undefined 3건 false-complete 재현. 12·11개월 산술 및 소득원별 union 미해결. 제품 Node/DOCX 미실행.
- **A2-DOC-015 [ ]**: 미관찰 evidence_cutoff를 최종본 완결로 승격하던 게이트 후보를 stacked Draft #117로 보완; #115 writer final blocker/draft warning 분기 정적 재독. #106 합본 writer/CI/Word 미검증.
- **A2-DOC-016 [ ]**: null·undefined cutoff는 status=review_required, 명시 0원 문자열은 보존, 숫자0·금액 null은 unresolved. 0011 SQLite 합성 9/9 재실행, 실제 D1/서식 바이트 미실행.

- **다음 r47 계산사무장**: (1) #117/#115/#106 통합 writer→preflight Node 실제 테스트 (2) 복수 소득원별 12+11개월 결손을 fact/payer/기간별로 검사하고 source-only/중복 확정 금지 (3) #96/#97/#98/#102 승인금액 충돌과 D5110/11 월변제 배분 검증 (4) D1 값 JSON/WON/status 상충 및 구판본 head CAS 실측 (5) 제424호 개정전문 경과·관할·사건별 시행일 전문가 확인.
- **제품 인수 0건**. 실제 고객문서/개인정보/원본 OCR/키/.env/비공개 정답 사용·공개 Git 기록 없음. 운영 배포, D1 운영 migration, 전자제출, 법원 인가 확정 수행 없음.
