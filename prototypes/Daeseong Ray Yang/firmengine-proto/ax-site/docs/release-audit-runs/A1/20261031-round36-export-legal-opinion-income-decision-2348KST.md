# FirmEngine AX A1 제36차 — Export ACK 유실·법률 쟁점 분리·동일 소득원천 판정충돌

- 일시: 2026-10-31 KST. 직전 제35차 서류·변호사·데이터 → **제36차 IT·AX·계산사무장** 순환.
- 대상: `firmengine/firmengine`의 GitHub `main`과 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 최초 main HEAD: `45f185131421c03c0f1b3423b6707572392ddb63`; 감사 기록 작성 직전 main HEAD: `1dc2494d2d1419e954f3b4d112015f7db015cdb0`.
- 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A1-IT-008 / A1-AX-008 / A1-CALC-004**, 세 ID 모두 `[ ]` 유지.
- 선행 35차 영수증, 관련 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 기존 테스트·Open PR #24·#61·#96을 읽고 비병합 상태를 구분함. 고객 실제문서·개인정보·OCR 원문·키·.env·비공개 정답을 사용하거나 Git에 기록하지 않음.
- 검증 방식: **GitHub 실소스에서 TypeScript 타입만 제거한 함수 본문을 V8 격리 실행**, 합성 비식별 입력과 독립 기대 비교. 이 결과는 Node 저장소 원본 실행·CI·실제 D1/R2·브라우저·공식 법원서식·변호사 승인·운영 배포와 다름.

## A1-IT-008 — 생성 Export의 D1 COMMIT ACK 유실 (기존 P0 재현)

- 소스: `lib/export-artifact-transaction.ts` main blob **`a114235e5b5de57b5ae58b41026f939ee8543174`**, [Draft PR #24](https://github.com/firmengine/firmengine/pull/24) 동일 파일 후보 blob **`10dc79b9ec9dcf29ff74901af6a621a17d880573`**; 기존 `tests/export-artifact-transaction.test.ts` blob `a684612f61234a9fb0ac30261684733ba749eefc`.
- 합성 조건 6개: R2 업로드 실패 / SQL artifact persist 실패 / manifest 명시 거절 / manifest 성공 후 ACK 유실 / 정상 commit / post-commit 이벤트 실패. 독립 기대: ACK 유실 후 manifest에 참조된 SQL/R2 증거는 보존, 확실한 선행 실패는 정리, manifest 거절의 **커밋 여부가 확인되지 않을 때는 보존/대조 경로**도 허용, 후처리 실패는 증거 삭제 금지.
- **main 5/6 기대 일치**. 반례 ACK 유실에서 `manifest=1, SQL rows=0, R2 objects=0`, 증거가 사라짐. PR #24 후보는 6/6: ACK 유실 뒤 `manifest=1, SQL rows=1, R2 objects=1` 및 `onCommitUncertain` 호출. 커밋 없이 실패한 manifest 호출도 후보는 row/object를 보존하므로 고아 객체 정리 절차 필요.
- 동일 결함의 수정 PR #24 및 통합 [Draft PR #61](https://github.com/firmengine/firmengine/pull/61)이 이미 열려 있어 재수정·중복 집계하지 않음. 원본 R2 PUT↔D1 실제 비동기 ACK, 2-worker CAS, 영속 reconciliation·retention·Node/CI는 미검증. **인수 미완**.

## A1-AX-008 — 법률 의견·반론·미해결 쟁점 분리 (부분 미구현/계약 공백)

- 소스: `lib/approval-issue-graph.ts` blob **`53df46fa1fcf34e19d8e9a192da1a8f87bf897cd`**, 기존 `tests/approval-issue-graph.test.ts` `0fffa4548046c8efd67639446526b8f0d8dd9d4d`, `db/schema.ts` 법률 조건 행과 `lib/case-lawgraph-store.ts`의 status/reason/nextAction.
- 합성 입력: 위험 R 1건, 원문 유효 Fact 1건, 계산 출력 100(합성), 현재 법률 check status=`conflict`, 사유=`synthetic objection remains unresolved`, 다음 동작=`human review required`. 독립 기대: AI 법률 판단과 사람의 법률 의견·반론·미해결 질문이 **서로 다른 상태로 추적 가능**, 반론 미해결을 PASS/법원확정으로 승격하지 않음.
- **실제 V8 관찰:** `legalCheck.status=conflict`, `reason`과 `nextAction` 보존, `courtApprovalInferred=false`는 정상. 그러나 증거·계산 입력이 충족된 경우 `questions=[]`, `legalOpinion=null`. 법률 반론/별도 검토의견의 식별자·주체·버전·해소상태가 이 그래프의 구조화된 결과에 나타나지 않음. `legalCurrent=false` 시 `legalCheck.status=not_currently_reviewed` 정상.
- **판정:** 전체 제품에 의견/반론 UI가 전혀 없다고 단정하지 않음. 해당 이슈 그래프는 법률 check 메타데이터를 전달하지만 인간 독립의견·반론 미해결의 독립 저장/소비 계약은 검증되지 않았음. 법률 의견/승인 의미 설계는 변호사 검토 필요하므로 임의 자동 생성·법률 의미 코드 변경 없음. **[ ]**.

## A1-CALC-004 — 동일 월 소득원천의 상충된 승인 판정 묵살 (신규 P1 후보)

- 실제 main `lib/income-resolution.ts` blob **`f370c4b14fd347089708c5c3241fa9c72522d4bf`**, 기존 테스트 `tests/income-resolution.test.ts` `396bc23785130e82eb62af5fe626fe31e4e43582`.
- **합성 입력:** 동일 Fact ID+금액+기간을 참조한 소득 객체 두 행의 `recognition`을 accepted/rejected 또는 accepted/unreviewed로 상충시키거나, `aggregationTreatment`을 independent_source/duplicate, `sourceCalculationRole`을 기간소득/gross-only로 다르게 표기. 다른 Fact ID의 동일월 두 행과 동일 승인 완전중복도 별도로 대조.
- 독립 기대: 같은 원천의 승인·집계·계산 역할이 다르면 **판정 충돌 표시 및 두 행 보존**, 동일 원천·동일 판정이면 안전하게 중복 제거, 다른 Fact ID는 독립 관측으로 유지.
- **main 함수 V8 7조건 중 2/7 기대 일치**. 나머지 5개는 `observationCore`가 검토 상태를 포함하지 않아 후행 행을 `duplicates`로 삭제하고 충돌 이슈를 누락; 순서를 뒤집어도 먼저 등장한 승인 분류가 남는 order-dependent 결과.
- **수정 코드:** [Draft PR #97](https://github.com/firmengine/firmengine/pull/97) `audit/a1-r36-income-decision-conflict-20261031`, HEAD **`4729ea55e43144f04e85e5585c5301c984a61b46`**, 수정 파일 blob **`d340e7c0b051ce0fede8f897b05854e2904953db`**, 신규 테스트 blob **`83bd6dd67ffdc2b1d222d7efcf1a331b14ebbbde`**. 실제 PR 소스 재독 후 V8 7/7 기대 일치. 정확 중복 키에 검토 결정 fingerprint를 추가하고 같은 증거·다른 결정을 `INCOME_SAME_FACT_REVIEW_CONFLICT`로 남김.
- Node 회귀 7개를 작성/커밋했지만 **Node 명령 미실행**. 전체 `calculateCase`/대표기간/인정소득/서식과의 의미 검증은 미완료. A2 [Draft PR #96](https://github.com/firmengine/firmengine/pull/96)이 `lib/assessment.ts`를 변경하므로 PR #97과의 **집계 연결 회귀를 병합 전 수행**하고 계산사무장·데이터담당자·변호사 승인 전까지 Draft/미병합 유지.

## 회차 결론과 다음

- 신규 P1 후보 **1건**(동일 원천 검토상태 충돌 묵살), 신규 Draft PR **1건**(#97), 기존 P0 재현 1건(#24/#61 이미 관리), AX 구조화 법률 의견 분리 검증 공백 1건.
- 실행 결과: IT main **5/6**·PR #24 **6/6** 합성, AX 현재 충돌 상태/질문 분리 2경계 관찰, 계산 main **2/7**·PR #97 **7/7** V8 합성. 각각 다른 검증의 숫자이며 제품 정확도/전체 통과율로 합산하지 않음.
- 모든 ID **[ ]** 유지, 제품 전체 인수 **0건**. 실 Cloudflare D1/R2, 실제 API/브라우저, 전체 CI/Node/빌드, 공식 법원 원문·서식, 사람 승인, 운영 배포·마이그레이션·전자제출·인가확정 모두 **미실행**.
- 다음 역할: **서류담당자·변호사·데이터담당자**; 우선 **A1-DOC-010**(발급일·원문기간·신청일), **A1-LAW-010**(가구원·추가생계비 법원 재량), **A1-DATA-015**(서식 token의 source/formula/runId 연결).
- 실제 실행 모델 Extra High 설정 여부 확인 불가. 코드 검증 강도 목표와 런타임 모델 모드를 동일시하지 않음.
