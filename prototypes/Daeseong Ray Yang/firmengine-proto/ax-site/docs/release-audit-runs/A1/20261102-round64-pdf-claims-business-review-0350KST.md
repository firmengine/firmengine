# FirmEngine A1 64차 — PDF 등록 경계·상담 주장 근거·사업소득 승인 무효화

- 날짜: **2026-11-02 KST**. 직전 [63차](20261102-round63-bbox-tax-canonical-crossfact-0253KST.md) 이후 이어서 점검.
- 읽기 기준 GitHub **main** HEAD: `c3463feaf3e86c80df3784d49d27bf6cb9f52c1a`; 영수증 생성 직전 main HEAD `c3463feaf3e86c80df3784d49d27bf6cb9f52c1a`.
- 역할: **IT담당자 / AX담당자 / 계산사무장**. 체크: **A1-IT-007, A1-AX-002, A1-CALC-018**. 모두 **[ ] 미완료**.
- 전제: 저장소의 실제 함수 본문을 국소 TS 타입 제거 후 V8에서 실행했고 GitHub 소스 blob과 매칭했다. DB·R2·PDF 바이너리·모델·브라우저 등 외부 의존성은 명시적 synthetic stub. **프로젝트 Node/CI/실제 D1·R2/Cron·공식 서식/변호사 승인/운영 배포 수행하지 않음**.

## A1-IT-007 — 복수 문서유형·PDF 암호·손상/페이지수

- `app/api/cases/[id]/documents/route.ts` 원본 blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`; `app/api/cases/[id]/documents/[doc]/route.ts` blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`; `lib/sample-manifest.ts` blob `e9ce037608f990c9e50c1e5639d0d0437b3ee8c3`. 스키마 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- **원본 POST 본문** 실행(합성 `getCase/saveCase/db/pageJobs/event`, 7독립 기대): 정상 두 페이지 SHA → HTTP201·job2/문서1/이벤트1; 같은 SHA·페이지수 → 200 재사용·새 job0; 같은 SHA·페이지수 상충 → 409; 잘못된 SHA → 400; 페이지수 0 → 400; 601쪽 → 400; 아직 원본 파일 없는 임의의 **형식상 유효한** 64자리 SHA+1쪽 → HTTP201·metadata/job 등록. **7/7 기대 일치**.
- 마지막 201은 **메타데이터 임시 등록**이며 파일 검증 통과나 OCR 진행 성공이 아님. `samplePageRole`은 공개 소스에서 모든 페이지 `unknown`. 원본 PUT은 SHA·MIME·Content-Length를 검사하나 이 경로 자체에 PDF 구조/암호해제/손상 파싱은 확인되지 않음. 별도 클라이언트 PDF.js 관련 코드는 기존에 확인. 암호/손상 PDF, 85종 실물 분류, 단일 PDF 다중 유형/다수 PDF 동일 유형의 실제 R2·Cron 전이는 **미실행·미검증**. 앞선 34차의 부분 검증과 별도로 격리 함수만 재확인. 신규 확정 코딩 결함 아님.

## A1-AX-002 — 상담 주장·원문출처·불확실성·역질문

- `lib/intake-classifier.ts` blob `3e07327750e0330baceee79dc5608758a862d3e2`, `lib/intake-classifier-response.ts` blob `1dd7a53412faae5207f97bf4409f21c504657e0a`, `lib/intake-types.ts` blob `24788d5edc77d7af97e105992d381d44064cf8e2`, `lib/intake-engine.ts` blob `82ddba689ea6d107ba587235205feef45e058527`. 기존 회귀 `tests/intake-classifier-response.test.ts` blob `9a3319e163b87d0f7588f8d52681d054075d987c` 읽음.
- **실제 `buildIntakeClassifierRequest` 본문** V8 실행; 검증 완료한 합성 카탈로그·원문구간과 진단용 스텁. 독립 기대 7건: strict 루트 subjects 2scope; asset/debt feature 별도 allowlist; 원문구간 2개 때 검토확인 배열 bounds=2; 활성 상담 0건 차단; feature 0건 차단; `sourceSpanId` 참조 필수 및 상태 enum 5종; 요청 목적 `consultation_claim_classification_only`·`noEvidenceAcceptance=true`, 법률승인 필드 없음. **7/7 기대 일치**.
- `intake-classifier-response.ts` 정적 확인: 검토 span ID의 중복/미등록 거절, subject scope·feature·ref 검사, 근거 없는 claim 거절. 역질문은 LLM 응답의 직접 필드가 아니라 `matchIntakeChecklist`의 미확인/상충/법률검토 상태로부터 결정론적 생성됨. **분류 fact는 `client_report`**이지 원문 OCR 증명·법률 인정이 아님. **응답 adapter/질문 생성기의 이 회차 직접 실행 없음**, 모델 API·실제 원문 span 검증·실무자 평가 미인증. 구조화 요청이 `reasoningEffort:medium`으로 생성됨; Extra High 설정 확인되지 않음.

## A1-CALC-018 — 사업소득 변호사 승인 이후 구 승인 무효화

- `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`; `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/business-net-reconciliation.ts` blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`; 기존 `tests/business-net-review-lifecycle.test.ts` blob `dc089bd14f4c07f204cde7ca4038fe49ca08410c` 확인.
- **실제 `touchCase` 및 `resetReviews` 함수 본문** V8 격리. `invalidateExports` 의존성만 결정적 mock. 독립 기대 10개: revision 8→9; 5개의 검토 Boolean false; referenceReviewSha 삭제; shortenedTermReview 삭제; paymentSchedule.reviewed false; proposed decision stale·adopted history 보존; 이전 값 impact 기록; 이전 사건 불변; export artifact/current 승인 무효(이 항목은 **stub 실행만**); `business.net.adopt` 분기의 `data.incomes.push(approved.income);resetReviews(data,impact)` 소스 연결. **10/10 기대 일치**. 상세 impact keys `ruleApplicationReviewed,referenceReviewSha256,incomePeriodReviewed,presentValueReviewed,assetValuationBasisReviewed,allocationBasisReviewed,shortenedTermReview,paymentSchedule.reviewed`.
- 검증 중 코드가 보존한 과거 `adopted` 의사결정은 **과거 이력**이지 최신 법률 인정이 아님. `business.net.adopt`의 실제 권한·Fact 입력, D1 재계산 queue, 18 계산·95 법률·서식·UI 연결, 동시 사건 실행은 **미실행**. 동일인 승인 결함 관련 기존 [Draft PR #55](https://github.com/firmengine/firmengine/pull/55)·[Draft PR #85](https://github.com/firmengine/firmengine/pull/85) 둘 다 **open/draft/미병합**; 위험 해소로 볼 수 없음.

## 회차 판정 및 인계

- 원본문 V8 합성 **24/24 기대 일치**(IT 7, AX 7, CALC 10). 이는 선택된 국소 조건에만 해당하며 구현 완료·전체 Node/CI/staging D1·R2·Cron/공식 서식·변호사 승인/사이트 배포 **동의어 아님**.
- **신규 확정 결함 0, 신규 제품 패치/PR 0, 인수 완료 ID 0**. 미관찰/null/관측 0/비해당/상충/source-only/법률 승인 전은 독립 상태로 유지. 실제 의뢰인 기록/원문 OCR 사실값/키/.env/비공개 정답을 사용하지 않음. 운영 배포·D1 운영 migration·법원 전자제출·인가 확정 미실행.
- 이번 A1 검증과 중앙 보드에는 3개 ID만 기록. **다음 역할: 사용자·서류담당자 / 변호사 / 데이터담당자**; `A1-DOC-009`(문서 재분류·하위 무효화), `A1-LAW-010`(가구원·생계비 승인), `A1-DATA-009`(기간/기준일/발급일). 다른 감사 병렬 변경은 보존 병합.
