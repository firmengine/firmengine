# FirmEngine A1 45차 — 갈음 증빙 역할 · 법률 근거계약 · 대량 원문/계산 페이지

- 회차 날짜: 2026-11-01 KST. 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만.
- 시작 main HEAD: `32ef1084644608d819098b185f091181b333b3fc`. 44차 영수증, 중앙 보드 `c0b1a8adec0c6c051c56c0745a738fc8f8673749`, 최근 main 커밋/오픈 PR, 대상 함수·기존 테스트를 조회했다. 직전 IT/AX/CALC에서 DOC/LAW/DATA로 순환.
- 아래 숫자는 **GitHub에서 직접 읽은 TypeScript 실제 함수의 제한적 타입 문법만 제거하고 V8에서 실행**한 합성 조건의 독립 기대 일치 횟수다. 실제 Node 테스트 명령, 브라우저/HTTP, Cloudflare staging/운영 D1/R2, 공식 법원 양식, 변호사 승인을 실행한 결과가 아니다.
- 개인정보, 고객 파일, 원본 OCR, 키, 운영 DB 값은 읽거나 공개 Git에 적재하지 않았다. 모든 원단위 수치와 문서/사건/팩트 ID는 합성이다.

## A1-DOC-011 [ ] — 갈음 A←B+C의 일부 증빙/잘못된 페이지 역할

**main** `lib/document-substitution.ts` blob `9fea9344b923c961fe333761df99ddde431ce1bc`. **Draft #57** blob `69e28b8462a58f9b65cef20d744605d4c78619cd` (미병합).

합성: 원래 A, 갈음 B·C 둘 다 선정; B는 필드 f의 실제 원천인 증빙(evidence), C는 선정된 다른 대체 문서다. 인정 Fact 하나(f1, 100 합성단위, verified/accepted), 문서별 원천 SHA와 review proof snapshot은 유효하게 설정했다. 정책 출처 조회와 지문 함수는 **합성 반환값 stub**으로 대체했으므로 실제 법원 갈음 허용이나 SHA 암호검증 통과로 해석 금지.

| 조건 | 독립 기대: 원요청 active | 실제 main | 실제 Draft #57 |
|---|---:|---:|---:|
| B,C 둘 다 evidence | false | false | false |
| B만 접수(C 없음) | true | true | true |
| B evidence, C administrative | true | **false** | true |
| B evidence, C filed_form | true | **false** | true |
| B administrative | true | true | true |
| C가 선언되지 않은 문서유형 | true | true | true |
| 요구 관측기간 부분누락 | true | true | true |

**main 5/7, Draft #57 7/7**. main은 C의 역할이 행정/기존서식이어도 accepted match 자체로 갈음의 C 존재를 충족시켰다. #57은 evidence 페이지만 해당 대체 유형으로 인정한다. 기존 P1 재현이고 새 코드는 작성하지 않았다. 85서류 전체/원본 PDF/공식 교체정책은 인수 미완료.

## A1-LAW-013 [ ] — 95 법률 체크 배치에 근거계약이 전달되는지

**main** `lib/pipeline.ts` blob `79dce5f9822cf2debe1f886ab93ece4a256659e6`; **공통 gate** `lib/legal-review-packet.ts` blob `38b46feff4bb196c89d3a48ff97346846c9a9da9`; **Draft #46 helper** `lib/legal-review-risk-batch.ts` blob `3e9c48eb9a39723da0ff3fa0e1914840634224d6` (미병합).

실제 main `const batch=catalog.filter(...).slice(...).map(...)` 표현식, #46의 `selectLegalReviewRiskBatch` 본문, 실제 `gateLegalReviewChecks` 본문을 각각 V8 함수로 실행했다. 합성 C01, 수동 정책이 아닌 `manual:false`, 합성 승인 증거계약 `approved_evidence_route`, 필수 canonical `CANON_X`, 필수 계산 `monthly_amount`, 검증·인정 Fact f, AI 응답 `pass`를 입력했다. 원문 coverage helper/피처 비교는 합성 stub이며 실 95개 체크 승인정책을 바꾸지 않았다.

| 합성 시나리오 | 독립 기대 | main | Draft #46 |
|---|---|---|---|
| 승인계약 + 필수 Fact·계산 존재 | pass | **legal_review** | pass |
| 승인계약 + 계산 누락 | missing | **legal_review** | missing |
| 승인계약 + canonical Fact 누락 | missing | **legal_review** | missing |
| 계약 미승인 | legal_review | legal_review | legal_review |
| manual=true | legal_review | legal_review | legal_review |
| AI 응답 자체 missing | missing | missing | missing |
| 필수 계산 null | missing | **legal_review** | missing |

**main 3/7, Draft #46 7/7**. main 배치 맵에서 `canonicalFieldGroups`, `requiredCalculationOutputs`, `evidenceContractStatus`가 전부 소실됨. 구체적 위험은 결여된 입력을 `missing`이 아니라 포괄 `legal_review`로 강등하여 결함 원인 추적을 잃는 것이며, `manual:true` 및 미승인 정책의 현 상태에서 자동 법률 확정이 발생했다고 주장하지 않는다. #46과 pipeline 인접 수정 중인 #42 등 통합 회귀 필요. C01/C02/C04와 전체 95건의 실제 심사, 공식 법률 출처 검증, 실무자 승인은 미실행.

## A1-DATA-013 [ ] — OCR 2,000행 및 계산 5,000행 조회와 head 경합

**main OCR** `lib/extraction-row-store.ts` blob `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`, **Draft #52 OCR** blob `d97d78b885c00507c3e17faa768371ba8d1fa702`. **main 계산** `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, **Draft #49 계산** blob `429295821f171de76a4a1133df73fd2cf384c23c`. #52와 #49 미병합.

실제 `listCaseExtractionRows` 및 `listCaseCalculationFeatures` 함수에 합성 D1 쿼리 adapter를 연결했다(실 SQL engine/SQLite 아님).
- OCR 합성: 40페이지 × 50 원문행 = **2,000행**. offset 0…1950, limit 50, 40회 호출. 결과 총 **2,000행/고유 2,000/각 1개 source-only 필드**, 모든 페이지 totalRecords=2000, 마지막 nextOffset=null, 첫 페이지 nextOffset=50. **기대 일치**.
- 계산 합성: 10페이지 × 500 피처 = **5,000행**. offset 0…4500, limit 500, 10회 호출. 결과 **5,000행/고유 5,000**, 누락 없음. **기대 일치**.
- OCR read 도중 해당 페이지 head A→B 변경(사건 revision=1 불변): 안전 기대 `CASE_REVISION_MISMATCH`; **main은 A의 행을 OK**, #52는 기대 오류 반환.
- OCR 사건 revision 1→2 변경: #52가 기대 오류 반환. limit=51(최대 50) 입력: #52가 기대 입력 오류 반환. 정상 첫 페이지: main OK.
- 계산 read 중 head A→B 변경(사건 revision/dataVersion 불변): 안전 기대 `CALCULATION_VERSION_MISMATCH`; **main은 A를 OK**, #49는 기대 오류 반환. 안정된 A 조회는 main OK.
- 초기 합성 SQL mock은 두 종류의 COUNT 쿼리를 혼동해 OCR totalRecords=0으로 잘못 반환했다. 이 첫 시도는 **무효 처리**하고 쿼리 패턴을 수정해 전체 40페이지 및 head 경합을 **재실행**했으며, 위 2,000행/totalRecords=2000 결과만 유효하다.

대량 목록의 수량·정렬 및 head 경합에 대한 **함수 격리 재현**이다. 하나의 다중페이지 조회 전체를 동일 OCR head snapshot으로 잠그는 API 토큰, 원격 D1 일관성, 동시 사건/실제 OCR 원본/브라우저는 미인증. 기존 #49/#52가 있으므로 중복 수정·병합은 하지 않았다.

## 이번 회차 조치와 다음 인수

- 검토: A1-DOC-011, A1-LAW-013, A1-DATA-013 **모두 [ ] 유지**. 기성 수정 후보 #57/#46/#52/#49는 모두 Draft·미병합 재확인. 신규 코드 결함 별도 미발견 / 신규 PR·제품 코드 커밋 없음. 다른 에이전트 변경 덮어쓰기 금지.
- 문서만 본 고유 영수증 및 중앙 보드 해당 **3개 ID** 기록. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 조치 **없음**. 정식 인수 0.
- 다음 역할 **IT / AX / 계산사무장**. 본문 기준 ID **A1-IT-014**(문서 생성 취소·재시도), **A1-AX-010**(모델/프롬프트/기준정보·원문 해시), **A1-CALC-009**(가구원 상충과 생계비 확정 보류).
- 실제 모델 Extra High 설정 여부를 확인하지 못했으며 추론 모드 설정 완료라고 주장하지 않는다.
