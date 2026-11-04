# FirmEngine A1 119차 — 갈음 B+C, 법률 증거계약, 합성 사건 격리
- 기준: 2026-11-04 KST, **main 시작** `9fc20b70436de52df43f55fbbae7c352d79f528f`, **영수증 쓰기 직전 HEAD** `9fc20b70436de52df43f55fbbae7c352d79f528f`. 대상은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 이전 118차 `A1-IT-018/A1-AX-018/A1-CALC-018`에서 이어서 서류담당자 → 변호사 → 데이터담당자 순환.
- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (읽은 blob `4e43078dcf37b248298935bd931b7f6ea850190b`)의 **A1-DOC-011 / A1-LAW-013 / A1-DATA-018** 모두 **[ ] 미완료**. 기존 107·83·118차 영수증, 최근 main 커밋, PR 메타데이터, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, `tests/document-substitution.test.ts` `0bb1478bac062f3daa844f10374440af6cbdceb2`, `tests/legal-review-packet.test.ts` `0bcdb16455019195bbf6be460a16aefd12de4c8d`를 읽었다.
- 연관 PR **#57, #46, #72, #118 모두 open/draft, 미병합**으로 재조회. 중복 코드 변경 및 타 에이전트 변경 덮어쓰기 방지. 이번엔 **제품 실행 코드 수정 0건**.
- 검증 등급: **실제 GitHub main 함수 본문**에서 TypeScript 타입 표기만 필요한 만큼 제거하여 Code Mode V8에서 격리 실행. 다음 가상 입력은 사람/법원의 실제 기록이 아니며 외부 정책·source 지문·DB·HTTP 의존성은 명시적 합성 stub. 초기 실행 하네스의 TypeScript 구문 문제 및 유효하지 않은 대체문서 타입 대문자 입력은 수정 후 **최종 성공적으로 실행한 검증만** 수치에 포함. 실제 프로젝트 Node/TS/CI/DB/브라우저/법원 승인과 동의어 아님.

## A1-DOC-011 [ ] — A←b+c 갈음 체크리스트
- 원본 `lib/document-substitution.ts` blob **`9fea9344b923c961fe333761df99ddde431ce1bc`**의 `reconcileDocumentSubstitution` 원본문 실행 **6/9 독립 기대 일치**.
- 합성 사건: 원요구 `original_a`, 선택된 대체 `b,c`, 필수증빙 f1/f2, 확인된 subject link, 사람이 검토한 합성 기록, `2026-01-01~2026-03-31` 기간, accepted match/현재 document SHA, b가 f1과 f2 모두 제공, c는 매칭만 있음. `substitutionFactFingerprint`는 합성 SHA, 법원 공시경로는 `sourceId=policy-synthetic` 응답 stub.
- 독립 기대 → 실제:
  - 양쪽 evidence 페이지: inactive_by_substitution → **inactive_by_substitution**, 통과.
  - c 페이지 `administrative` / `filed_form` / `unknown`: 각각 **restored/activeRequest=true** → **inactive_by_substitution/false**, **3건 불일치**(원요구 부당 숨김).
  - b 문서 삭제, c 문서 삭제, b의 f2 Fact 미승인, c 타입 오염, c match 미승인: 각각 **restored** → **restored**, 5건 일치.
- 실제 경로: `approvedMatches` 및 `selected.some`은 `observedType`과 accepted 여부만 확인하고 **page.role=evidence를 검사하지 않음**. `proofMatched`는 b evidence만으로 f1/f2가 채워지므로 c의 비증빙 페이지가 '선택 대체 충족'으로 남는다. **기존 Draft #57**과 동일 수리영역. 85종 서류 정책·공식 서식·실제 DB 연결은 미실행.

## A1-LAW-013 [ ] — 승인된 근거계약을 법률 위험 배치로 전달
- 실제 `lib/pipeline.ts` blob **`79dce5f9822cf2debe1f886ab93ece4a256659e6`**의 `batch=catalog.filter(...).slice(...).map(...)` 원본문과 `lib/legal-review-packet.ts` blob **`38b46feff4bb196c89d3a48ff97346846c9a9da9`**의 `gateLegalReviewChecks` 원본문을 V8 격리 실행: **2/9 기대 일치**. `legalCheckCoverageComplete`는 전체 충족 반환, `featureMatchTier`는 해당 exact key 여부 반환의 **합성 stub**. AI 응답도 합성 `pass`.
- 가상 계약: `id=R-X, features=['income.net'], canonicalFieldGroups=[['income.net']], requiredCalculationOutputs=['netIncome'], evidenceContractStatus='approved_evidence_route', manual=false`; 승인된 `fact-1`, 유효 rule-1, calc=100. 원본문 batch 맵 결과 **canonicalFieldGroups / requiredCalculationOutputs / evidenceContractStatus 세 필드 모두 누락**.
- 독립 기대 → 실제 상태: 완비 계약 **pass→legal_review**, calc null **missing→legal_review**, calc unknown **missing→legal_review**, 명시적 calc 0 **pass→legal_review**, 인용 fact 누락 **missing→legal_review**, canonical 불일치 **missing→legal_review**, 근거 부적격 **missing→legal_review**: **7개 불일치**. 미승인 계약 및 manual 확인 두 조건은 `legal_review→legal_review`로 **2개 일치**.
- 결함은 **미승인 자동 PASS가 아니라 근거계약 유실로 `missing`과 `legal_review` 등의 원인 상태가 잘못 합쳐지는 것**. 실 95건 rule의 승인 여부/모델 호출·판결 효과는 검증하지 않았다. 기존 **Draft #46** 미병합.

## A1-DATA-018 [ ] — 합성 사건의 증빙·승인 처리 경계
- `app/api/cases/[id]/documents/route.ts` blob **`274f7a6e73988ca254607422d2ff2cddd1326ac0`**: 원본 `POST` 함수, 가상 Request/DB/오류응답/시간/UUID/사건 revision/save를 주입하여 **4/7** 독립 기대 일치.
- 가상 `sha256='a'×64`, 2쪽, 빈 documents/pages. 일반 사건은 기대·실제 **201, saveCase=1**; `structuredTest=true`는 **409, SQL=0, save=0**; `referenceTest=true`, `evaluationClone=true`, 두 플래그 혼합은 기대 **409/무쓰기**이나 각각 **201, SQL prepare 3회, db.batch 1회, saveCase 1회**로 **3건 불일치**. `structuredTest+evaluationClone`은 409, 모든 flag false는 정상 201.
- `lib/case-commands.ts` blob **`d18c555f04f65687c509a8e8d35aba4bb3597378`**의 `isSynthetic` 원본문을 별도 V8 실행 **5/6 기대 일치**: 일반/structured/reference/전체 true/명시적 false는 일치, **evaluationClone 단독이 false로 반환**(기대 true).
- `db/schema.ts`는 정적 열람만 함. 실제 D1 외부 격리·운영 데이터 혼입 발생은 미확인. 기존 **Draft #72**(문서 등록), **Draft #118**(승인 경계) 모두 미병합. 가상의 요청·SQL은 stub이고 실제 고객·OCR·키/원본 사실값 없음.

## 회차 판정·코드 조치·다음 ID
- **최종 실행된 합성 총 31조건 중 17조건 독립 기대 일치, 14조건 불일치** (DOC 6/9, LAW 2/9, DATA document POST 4/7 + synthetic predicate 5/6). 세 ID **[ ] 유지**; 실제 종단 인수 완료 **0건**. 기존 open Draft PR과 코드 충돌/법률 승인 경계가 있어 제품 코드 커밋/병합 없음, 기존 검증을 PR 인수로 승격하지 않음.
- 다음 역할: **IT담당자 → AX담당자 → 계산사무장**, 체크 **A1-IT-001**(화면/REST 라우트) / **A1-AX-001**(상담·OCR·법률 모델 라우팅) / **A1-CALC-001**(급여 12개월·성과급·공제 흐름). 해당 ID는 중앙 보드에서 모두 [ ].
- 전체 Node/TypeScript/lint/build/CI, 실제 browser·staging D1/R2/Cron, 85서류/18계산/95법률·공식 서식/실무자·변호사 승인·배포 미검증. 운영 배포·운영 마이그레이션·실제 전자제출·법원 인가 확정 실행하지 않음. Extra High 실제 설정 미확인.
