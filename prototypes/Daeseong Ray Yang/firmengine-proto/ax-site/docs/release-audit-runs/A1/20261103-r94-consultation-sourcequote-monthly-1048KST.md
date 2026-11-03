# FirmEngine AX A1 — 94차 상담 판본·OCR 원문결속·월소득 관측기간 감사 (2026-11-03 KST)

- **허용범위:** `firmengine/firmengine` main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 이전 93차 사용자·서류→변호사→데이터에 이어 **IT담당자 → AX담당자 → 계산사무장** 순서. 중앙 보드 **A1-IT-005 / A1-AX-005 / A1-CALC-005** 3개, 전부 **[ ] 유지**.
- **감사 시작 main:** `873d30e456d0a8fc422000df3208c85dafacc2e2`; 영수증 생성 직전 main `873d30e456d0a8fc422000df3208c85dafacc2e2`. 93차 영수증과 74/70차, 최신 main 커밋·열린 PR, `db/schema.ts`, 상담/서류/법률 preflight, OCR·verification 및 계산 원본문·기존 테스트를 GitHub Connector로 읽음.
- **실행경계:** GitHub 원본 함수본문에서 TS 타입 표기만 필요한 부분 제거하여 Code Mode V8에서 합성 입력 실행. 외부 D1, 인증, 모델, 진짜 OCR, 전체 Node/빌드/CI 미실행. 검사 성공 수는 함수 단위로만 기재. 실제 고객 정보/원본 OCR/비공개 답안/키 사용하지 않음.

## A1-IT-005 [ ] — 상담 이력 수정과 요구서류·원천 판본

- **원본 SHA:** `lib/intake-store.ts` `c0bdea9443a018a46c080a8e39a74a0daf62759f`, `lib/intake-fingerprint.ts` `42891c7453bb9d7c2bfcc0d25c0cb63dd908ff8e`, `lib/case-document-requirement-store.ts` `a670cb4e6a38aa6e782e898b5ed30aad80619c6d`, `lib/case-legal-source-preflight.ts` `0a4bf038a97de015652d4957a56ecddd5c049bd8`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- **실행 #1 (실제 `activeConsultationNotes` 원본문, 6조건):** 합성 A만→[A]; A→정정 B→[B]; A→B→C 연속정정→[C]; A+B 병렬노트→[A,B]; A→B + 독립 C→[B,C]; 중복 A 정정지시 B/C(원본 이력 함수에 직접 투입, 실제 API에서 수용 여부는 별도)→[B,C]. **독립 기대 6/6 일치**. 이력 함수가 직접 모순 정정 이력을 거절하는 것은 아님.
- **실행 #2 (실제 `evaluateLegalSourceReadiness` 원본문, 8조건):** 합성 DOC:1, 증빙1/정규화1, OCR 완료·fallback 없음·상담 최신·workflow 일치→`ready`. 상담 미분석→`review_required/CONSULTATION_REANALYSIS_REQUIRED`; workflow 이전 run→`review_required/WORKFLOW_INTAKE_RUN_STALE`; OCR 미완료→`waiting_evidence`; 페이지 정규화 미관찰→`review_required`; 문서 0→`waiting_evidence`; legacy fallback→`review_required`; OCR+상담 동시 대기→`review_required`. **8/8 기대 일치**.
- **추가 정적 교차검사:** `appendConsultation`의 `consultation_heads.active_run_id=NULL`/consultation_revision CAS; `analyzeConsultation`의 case revision/storage_token+catalog SHA+head revision CAS; 요구서류 SQL은 오직 active run `status='complete'` 행을 조회하고 이전 run은 `pendingReanalysis`로 분리. D1 배치 rollback/실제 2-worker 경쟁/상담 재분석→85요구서류 UI 재조회→OCR·계산 run 최신화까지는 실행하지 않음. 특히 `recomputeCaseDataUpdate(...).catch(()=>{})` 실패 시 파생 정합이 자동 복구된다는 실측 영수증 없음.

## A1-AX-005 [ ] — 원문 인용 중간단어 수치로 거짓 일치 (이번 신규 P1 후보)

- **main 소스:** `lib/source-verification-identity.ts` blob `acdecd4e18970fe4faf6eb91dd4aefc97b83236b`; `lib/source-verification.ts` `af5999723f6ceab99d70ba66acf9e9c465189571`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; 형식 전용 `lib/ocr-calculation-input.ts` `8f7f51bf41f7c944b76419d7cc894e49ac771473`.
- **원인:** `sourceQuotesOverlap`가 단순 `includes`로 유니코드·공백정규화된 quote 조각을 비교함. 실제 verification의 `matchingAgreement`, proof corroboration 및 Fact receipt lineage가 이 helper를 호출함. 전체 신뢰증명에는 **같은 value/unit, 검증 status, bbox·원문 hash, 판본 등 추가 가드가 존재**하므로 이번 실행만으로 법률상 사실 거짓 승격·완성 영수증 위조는 입증하지 않음.
- **합성 18조건 실행 (원본/PR 커밋본문 재조회):** 독립 기대 **main 13/18, 수정본 18/18**. 주된 5개 불일치: `"100" ↔ "1100"`, `"가처분소득 100" ↔ "소득 100"`, `"금액 1,000원" ↔ "1,000"`, `"소득 100" ↔ "소득 1000"`, `"입금 0" ↔ "입금 00"`은 기대 false이나 main true. 정합 13개에는 정확일치·원문 앞부분의 온전한 숫자/문구 조각·서로 다른 날짜·공란·공백 normalization·명시 0 포함.
- **수정 조치:** 고위험 OCR quote 문맥 의미 변경은 **별도 [Draft PR #214](https://github.com/firmengine/firmengine/pull/214)**로만 작성, main 코드 무변경. PR HEAD `c4367a0cf84629b8b4781d29669bfd641bf50a17`; 수정 blob `0b7d442982a3f733aeec001dc4fc11c6e467ea70`; 신규 Node 회귀 테스트 blob `ed81e64bae9f7227a1d4ccd1d67973a45cca0243`. 실제 커밋 소스 재조회 후 V8 18/18, **Node 테스트 파일은 작성만, Node 실행 안 함**. OCR 문구의 합법적인 부분인용을 과도 차단할 호환성 위험으로 AX·데이터·변호사 검토 및 실제 OCR/영수증 통합 테스트 후에만 병합 가능.
- **판정:** 새로운 **부분검증/수정후보**이지 실제 PDF/LLM 원문 없는 수치·날짜·법원 결론의 전구간 차단 합격 아님. 숫자 '0', null, unknown, not_applicable, conflicting, source-only, 승인전 상태를 서로 승격하지 않음.

## A1-CALC-005 [ ] — 월별 관측 선언수와 달력 span 상충

- **원본 SHA:** main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; 기존 미병합 [Draft PR #101](https://github.com/firmengine/firmengine/pull/101) 동파일 blob `654b9e0fc98cf3c945fe77a9bc08c970e34fcc5c`.
- **실행:** GitHub 원본에서 `monthIndex`, `monthSpan`, `monthlyIncome`를 추출하고 TS 타입 표기만 제거하여 V8 실행. `moneyValue/nonnegative/referenceFormula/maximumCalculationMonths/floorDivide`는 **명시적 합성 대체**; 실제 계산/법적 승인 아님. **15조건: main 10/15, #101 15/15 독립 기대일치**.
- **5개 핵심 불일치 (main은 모두 금액 또는 0 반환/reasons=[], 독립 기대는 null+기간불일치):**
  1. `monthly/periodMonths=1/2025-01-01~12-31/net=1,000,000` → main 1,000,000; #101 null+`INCOME_PERIOD_DENOMINATOR_CONFLICT`.
  2. `monthly/1/2025-01-01~02-28/1,000,000` → main 1,000,000; #101 null+충돌.
  3. `monthly/1/2025-01-01~12-31/명시 0` → main 0; #101 null+충돌. **명시 0 ≠ 누락**.
  4. `monthly/0/2025-01-01~12-31/1,000,000` → main 1,000,000; #101 null+충돌.
  5. `monthly/3/2025-01-01~02-28/1,000,000` → main 1,000,000; #101 null+충돌.
- **일치 10조건:** span=12월/periodMonths=12 월액 유지, periodMonths null(기간 입증 아님), 동일 1월 월액, `period_total` 1↔12월 분모 충돌 차단, 기간합계 12개월 12,000,000→월 1,000,000, 부분월 `period_total` 차단, 기간 없는 월액(source-only), 금액 미관찰 차단, 2개월 정상, 명시 0원 정상 1개월. 기존 PR #101과 겹치는 `assessment.ts` 타 에이전트 PR(#67/#79/#96 등) 통합·CI·사무장 승인 보류. 실제 12개월 coverage/누락11개월 D1·변제계획 E2E 미실행.

## 94차 인수·다음 순환

- **수행:** IT 원본함수 6/6 + 별도 preflight 8/8; AX main 13/18 vs Draft #214 18/18; CALC main 10/15 vs 기존 Draft #101 15/15. 서로 다른 테스트 모수/계층을 합산하여 제품 정확도로 부르지 않음. 각 ID **[ ] 미완료**, 전체 A1 종단 제품 인수 **0건**.
- **main 코드조치:** 실행 코드 수정 없음. 이번 신규 Draft PR #214는 다른 브랜치에 코드+회귀테스트 2개 파일(허용경로 내부), 미병합. `main`에는 이 감사 영수증과 중앙 보드 **3개 ID에 대한 추가 기록만** 반영 예정.
- **다음 6역할 순환:** 사용자·서류담당자 **A1-DOC-006**(동일 월 여러 문서·계좌·채권자), 변호사 **A1-LAW-007**(증여·은닉·편파변제), 데이터담당자 **A1-DATA-006**(원문→Fact numeric→typed numeric 삼중 대조).
- **미검증/금지:** 실제 Node·TypeScript·lint·build·전체 CI·브라우저·staging D1/R2/Cron·85서류·복수행·갈음 A←B+C·C01/C02/C04·18계산/95법률 종단·공식 서식·실무자/변호사 승인·사이트 배포 미실행. 운영 배포/운영 마이그레이션/전자제출/법원 인가 확정 하지 않음. Extra High 실제 모델/추론 설정 확인 불가.
