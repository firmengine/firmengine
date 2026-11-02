# FirmEngine A1 71차 — 갈음 철회 복원 / 법률 95 증거계약 / 법률 AI 출처 후보

- 회차: 2026-11-02 KST 10:53 시작. GitHub `firmengine/firmengine`의 `main`만 기준, 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 감사 시작 `main` SHA: `a2cb994851e4b829ebdb5d36080d08cdd7e2fafc`; 영수증 쓰기 직전 `main` SHA: `a2cb994851e4b829ebdb5d36080d08cdd7e2fafc`.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `254454be8829b97b6bd9762867590dc5613db936`. 직전 70차 영수증 blob `a320c479924da046bdc5882cd00f6c0f57c9f0d4`, 69차 영수증 `1c68adef1c24eff731c525da3a61f82d9591fa04`. 최근 main 커밋 `a2cb994`, `ef826a6`, `37fed7e`, `dfea202`; 기존 Draft PR #57/#46/#75 오픈·미병합 확인.
- 역할 교대: **사용자·서류담당자 → 변호사 → 데이터담당자**. 이번 ID **A1-DOC-012 / A1-LAW-013 / A1-DATA-012**, 모두 `[ ]` 유지.
- 실제 읽은 스키마 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; 기존 테스트 `tests/document-substitution.test.ts` blob `0bb1478bac062f3daa844f10374440af6cbdceb2`, `tests/legal-review-packet.test.ts` blob `0bcdb16455019195bbf6be460a16aefd12de4c8d`. 기존 31차/23차/69차 감사 영수증 대조.
- 테스트 방식: **GitHub에서 읽은 실제 TypeScript 함수 본문**의 타입 선언만 필요한 범위에서 제거해 V8 함수로 **격리 실행**. 정책 경로·Fact fingerprint·coverage·feature 비교·source-allowlist는 명시한 조건의 **합성 stub**. 실제 Node 테스트/전체 TypeScript/CI 또는 원격 D1/R2/Cron 실행이 **아니다**.

## A1-DOC-012 — 갈음 A←B+C 승인 후 원본 철회·변경

- 소스 main `lib/document-substitution.ts` blob `9fea9344b923c961fe333761df99ddde431ce1bc`; 기존 [Draft PR #57](https://github.com/firmengine/firmengine/pull/57) 후보 blob `69e28b8462a58f9b65cef20d744605d4c78619cd`.
- 합성 사건: 원서류 A, 증빙서류 B+C, 2026-01-01~03-31, 서류별 승인 match 및 active SHA, 서로 다른 proof 2개, 인가 아닌 직원 가상 검토, 법원 정책 허용·fingerprint 일치 stub.
- main 원본 `reconcileDocumentSubstitution` **15/15 독립 기대 일치**: B 철회/C 철회/C match stale/C evidence 페이지 행정 전환/C 문서유형 변경/Fact 미승인/Fact 지문 변경/관할 변경/카탈로그 판본 변경/정책변경 알림/승인 이후 최신 정책 알림/기간 공백/주체 미확정 각각 원요청 `restored`. 정상 B+C 및 무관 텍스트 변경은 비활성 유지. 이는 **한정 합성 오라클**로 85서류/공식 갈음규정 인수 아님.
- **별도 기존 P1 반례 재현 (main 1/3, PR #57 3/3)**: B 하나가 필수 2개 proof를 모두 제공하고 B·C 모두 승인 match로 남은 합성 상태에서 C 페이지 `evidence` → 원요청 비활성 (main·#57 모두 기대일치). 동일 C 페이지가 `administrative` 또는 `filed_form`이면 원요청 **복원 기대**이나 main은 `activeRequest=false/reasons=[]`로 오비활성; #57은 두 경우 `activeRequest=true/SELECTED_ALTERNATIVE_NOT_MATCHED`. 기존 P1로 분류, 중복 패치 없음.
- 실제 요구서류 화면, 명령·D1 저장, 상담 변경 후 API 재요청, 법원 갈음 정책·변호사 승인 **미검증**. `[ ]`.

## A1-LAW-013 — 95개 법률 위험의 증거계약 전달 및 판단 단계 보존

- main `lib/pipeline.ts` blob `79dce5f9822cf2debe1f886ab93ece4a256659e6`, gate `lib/legal-review-packet.ts` blob `38b46feff4bb196c89d3a48ff97346846c9a9da9`; 기존 [Draft PR #46](https://github.com/firmengine/firmengine/pull/46) helper `lib/legal-review-risk-batch.ts` blob `3e9c48eb9a39723da0ff3fa0e1914840634224d6` 및 PR pipeline blob `5e06449d0bc859550b58c45bdb462da191b58c11`.
- 실제 main `catalog.filter(...).slice(...).map(...)`와 PR helper를 같은 합성 위험항목에 각각 실행 후 실제 `gateLegalReviewChecks` 본문으로 상태 검사. 테스트용 계약 `approved_evidence_route`, canonical income.net, 필수 계산 netIncome, Fact 인정, mock `legalCheckCoverageComplete=true` / feature 직접일치. **미래 승인계약을 가정한 가상 반례이며 실제 seed 정책의 승인 확인이 아니다**.
- 10개 합성 상태의 독립 기대 vs 관찰: **main 4/10, PR #46 10/10**.
  - 계약·필수계산·근거 완비: 기대 `pass`, main `legal_review`, #46 `pass`.
  - 계산값 누락/null, canonical 필수근거 누락, Fact 승인 전: 기대 `missing`, main `legal_review`, #46 `missing`.
  - 필수 계산값 명시적 숫자 0: 기대 해당 게이트 `pass`, main `legal_review`, #46 `pass` (0은 미관찰이 아님).
  - 계약 미승인, manual=true, AI conflict, AI missing: 양쪽 독립 기대 일치.
- main에서 `canonicalFieldGroups`, `requiredCalculationOutputs`, `evidenceContractStatus`가 batch 맵에서 유실됨을 실제 코드와 실행으로 재확인. **현행 법률 95항목의 자동 pass 발생을 증명하지 않았으며 seed가 수동 검토 유지하는 경로는 fail-closed**. 수정은 기존 Draft #46이 처리 중. 실무자 공식 법적 승인·실제 95개 risk E2E/모델 호출 **미검증**. `[ ]`.

## A1-DATA-012 — 출처 없는 Fact의 법률 AI 입력 오염

- main `lib/legal-review-packet.ts` blob `38b46feff4bb196c89d3a48ff97346846c9a9da9`; 기존 [Draft PR #75](https://github.com/firmengine/firmengine/pull/75) 같은 파일 blob `1afd5539fe773788986cff69857013daa6132a1a`.
- 실제 `selectedFacts` 및 해당 `featureMatchTier`/우선순위 본문을 V8 격리 실행. 단일 income.net 위험과 synthetic Fact. 출처 비결속 문자열/명시 0/null/disputed, 문서 참조, 구조화 참조, 빈 배열, canonical 그룹, 혼합 케이스, 무관 축, 미승인 유효참조 포함 **12조건**.
- **main 5/12, #75 후보 12/12 독립 기대 일치**. main은 근거가 없는 문자열·0·null·disputed·빈 structuredRefs를 법률 패킷 후보 및 coverage로 잘못 계수하고, canonical 그룹에서도 출처 없는 Fact를 선택함. #75는 앵커 없는 행의 후보 선별을 막음. 원화 `0`과 `null`을 동일시하지 않으며, 둘 다 **출처가 없는 경우에만** 해당 근거후보 제외.
- 중요한 **남은 경계**: `refs` 배열만 존재하고 실제 문서 ID가 오래되거나 실체가 없는 synthetic 행도 main/#75 양쪽 `selectedFacts`에는 후보로 들어간다(12조건 중 1개, 후보선별의 명시적 한계). 소스 유효성은 downstream `validSourceRef`/lineage gate의 별도 문제. 현재 `pipeline.reviewLegal`은 packet 생성·AI 호출 **이후** Fact 유효성 필터를 수행하므로, 실제 AI 입력 이전 원천 유효성 보장은 추가 통합 경로 검증 필요. **이번에는 원격 모델을 호출하지 않았으며 법률 결과 false pass를 확인하지 않았다**. 이미 Draft #75가 선별 일부를 수정하므로 중복 PR 미작성. `[ ]`.

## 코드 조치·병렬 충돌·다음

- 새 제품 코드/테스트/PR **0건**: 확인된 P1 결함들은 기존 Draft #57/#46/#75와 동일 영역. 해당 브랜치를 덮어쓰거나 main에 법률 의미 변경을 직접 병합하지 않음.
- 격리 실행 실적: DOC **15+3** 조건(main; 3조건 PR #57 병행), LAW **10** 조건(main/#46), DATA **12** 조건(main/#75). 부분 통과는 전체 인수로 승격하지 않음.
- 외부/내부 출처 건강상태는 source-only, 미관찰, null, 명시적 0, 비해당, 상충, 승인전과 구분. 고객 실데이터·원본 OCR 사실값·개인정보·키/.env·비공개 정답은 읽거나 공개 Git에 기록하지 않음.
- 전체 Node/TypeScript/CI·브라우저·staging D1/R2/Cron·85종·복수행·C01/C02/C04·18산식/95법률 E2E·공식 법원 양식·실무자 법률승인·사이트 배포 **미실행**. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 없음. 실제 실행기의 Extra High 추론 설정 여부 확인되지 않음.
- **다음 역할 IT/AX/계산사무장**: 중앙 보드의 `A1-IT-011`(구판본 JSON/null 역호환), `A1-AX-006`(공식 출처 검색 실패 시 보류), `A1-CALC-004`(동월 다중 소득·입금 중복)를 우선 확인. 새로 통과표시할 때 실제 입력·독립 기대·관찰값 및 HEAD/blob를 다시 재현할 것.
