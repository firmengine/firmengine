# FirmEngine AX A1 35차 — 원문 위치 UI · 서울 424호 관할·시행판본 · 기간/기준일 분리

- 일시: 2026-10-31 KST. 직전 A1 34차 IT/AX/계산사무장 → **35차 서류담당자/변호사/데이터담당자** 순환.
- GitHub 대상: `firmengine/firmengine`의 `main`, 변경 허용 경로는 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래.
- 감사 최초 **main HEAD**: `fae1d90abd352cf2d5ef6ed00ebc0084859354b4`; 34차 영수증 `docs/release-audit-runs/A1/20261031-round34-pdf-calculator-business-period-2154KST.md`와 단일 보드 blob `38647b6e1c8d886d2d2035e0367bba3d41f81f3d` 확인. 작성 직전 main HEAD: `fae1d90abd352cf2d5ef6ed00ebc0084859354b4`.
- 이번 체크: **A1-DOC-008 · A1-LAW-012 · A1-DATA-009**, 모두 **[ ] 미완료** 유지.
- 사용한 ID/이름/날짜/금액·문구는 합성; 고객 서류, 실제 OCR 사실, 개인정보, 비밀 정답, 키, .env는 사용·기록하지 않음.
- 검증 유형: 실제 GitHub 파일을 읽고 원본문에서 TypeScript 타입만 제거하여 V8 격리 실행, 독립 기대값과 비교. 원본 코드의 존재·V8·Node·CI·브라우저·D1/R2·공식서식·변호사 승인·배포를 혼동하지 않음.

## 1. A1-DOC-008 — OCR 원문 위치 대조 UI: 일부 경로만 확인

**원본 blob:** `components/workspace.tsx` `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`, `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/source-verification-identity.ts` `acdecd4e18970fe4faf6eb91dd4aefc97b83236b`, `app/api/cases/[id]/documents/[doc]/route.ts` `db20b9248e68d3ec412b5d3f4254254e0ffc8412`.

**입력·기대·실제:**
- 정적 UI 연결: Fact 상세의 `ref.quote`가 인용문으로 표시되고 해당 `ref.documentId/page`로 「원문 근거」 모달을 열어 `?kind=page&page=N` 페이지 이미지를 보여 주며 별도 `?kind=original` 다운로드 링크 제공. 이는 소스에 존재하는 동작, 브라우저 실행 결과 아님.
- 정확한 bbox 좌표 대조 기대: `SourceRef.bbox`가 검증된 경우 위치 강조 오버레이 또는 명시적 해당위치 안내. **main 모달은 `source.bbox`를 소비하지 않으며 `PageImage`도 bbox 입력을 받지 않음**. 페이지 수준 열람은 구현, OCR 숫자/문구의 **위치 강조는 연결 미구현/미관찰**. `PageImage`는 원본 PDF 자체의 렌더러가 아니라 저장된 페이지 이미지 응답을 사용함.
- 원본 `isValidSourceBBox` 실제 V8 7개 입력: 정상 두 bbox, 역전/1 초과/null/3요소/문자열 좌표 5개 → **7/7 독립 기대 일치**. 이는 검증기 순수함수 시험일 뿐 시각적 bbox 대조 PASS 아님.
- GET route의 case/document/page R2 키 조회·소스 연결 정적 확인. 실제 로그인 역할 전환, GET 요청, 저장된 bbox와 원본 PDF 픽셀 정합성, 브라우저 시각 검수 **미실행**.
- **조치:** 기존 `case-workflow.tsx`와 다수의 미병합 Draft PR이 UI에 영향을 줄 수 있어 새 UI 코드를 덮어쓰지 않음. bbox가 없는 경우 ‘원문 위치 미관찰’로, bbox가 있어도 검증/좌표계 일치·원본 동기화 뒤에만 강조하는 안전 설계 필요. **[ ] 유지**.

## 2. A1-LAW-012 — 서울 424호 관할 미확인 후보 오표시 P2 후보

**원본 blob:** `lib/seoul424-candidate.ts` `fb4f7f09e37e957481996304fbe4916764c8d7da`; 기준정보 `lib/reference-parameters.json` `e57a9d7c99efe052d4581d780ed478d876eb3330`; 호출 래퍼 `lib/legal-proposals.ts` `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`; 기존 테스트 `tests/legal-proposals.test.ts` `4cd74960411f11652c4e1746d05bfb555bd87540`.
- 기준정보는 서울회생법원 관할 `seoul`, 효력 시작 `2026-10-01`을 **inherited**로 보유한다. 이를 공식 법원 개정사항 검증 완료라고 선언하지 않음.
- 독립 기대: 확정된 서울 관할 + 2026-10-27 최초 접수 + 요건 충족→`candidate_for_human_review`(인가 아님), 타 관할→`not_applicable`, 접수일 불명→`unknown`, 이전 판본→`unsupported_version`. **관할 미확인(null/빈문자열/공백)은 요건이 모두 충족해도 `unknown`/route=null**이어야 함.
- 실제 main 함수·기준정보를 V8에서 합성 12조건 실행: **7/12 독립 기대 일치**, 불일치 5조건은 관할 null인데 제1~6호·제7호 후보로 승격하거나 빈/공백 관할을 `not_applicable`로 오표시한 경우. 실제 HTTP·D1·법원 승인 재현 아님.
- **조치:** [Draft PR #94](https://github.com/firmengine/firmengine/pull/94) `audit/a1-r35-seoul424-court-confirmation-20261031`, HEAD `264dd618a25fa5bc31bd65d86f1753016155d0cd`. 수정 source blob `f25c71d3b01f105944098b798d60517e41086c76`, 회귀 test blob `c8681da7c6a864d3e74aeb1f233907c8d8ff72f5`. 관할 null/빈/공백에서 사전 보류, 타 관할 미적용, 유효 서울 후보는 그대로 사람검토 상태. 수정 후보 V8 **12/12**, PR 브랜치 본문 재독 V8 추가 **10/10** 독립 기대 일치. Node 회귀 테스트 작성·커밋만, 실행하지 않음.
- 추가 정적 위험: `evaluateSeoul424.firstFilingDate`는 `buildLegalProposals`에서 `data.context.applicationDate`를 전달한다. 실제 최초 접수일과 신청 기준일이 다를 때 적법한 판본 선택을 보장하려면 별도 dateBasis/증빙·변호사 확인 계약이 필요. 이 문제는 임의 법률 의미 수정 없이 열린 검토사항으로 보존.
- 공식 제424호 원문·경과규정·법원 실무 검증, CI·실 D1·실 사건·변호사 승인 **미완료**, PR 미병합 Draft. **[ ] 유지**.

## 3. A1-DATA-009 — 기간과 기준일 동시 존재시 출력 손실 P2 후보

**원본 blob:** `lib/observed-source-details.ts` `b77563cd9d1c283de153bc705f3387d3093ef6bd`; `lib/domain.ts` Fact 스키마 `39ab41856f6d7a379aca7217d24b28f7f5f7616a`.
- `Fact`는 `periodStart`, `periodEnd`, `asOf`를 별도로 보관함. 반면 `observedSourceDetails` 출력 열은 기간이 하나라도 있으면 `asOf`를 숨김. 합성 Fact `periodStart=2026-01-01`, `periodEnd=2026-01-31`, `asOf=2026-02-10`에서 독립 기대는 기간+기준일 병기, 기존 실제 관찰은 기간만 표시.
- 실제 함수 본문 V8 격리 + 합성 Fact·출처 stub로 5조건(기간+기준일, 기간만, 기준일만, 전부 미관찰, 부분기간+기준일): **main 3/5**, 후보 **5/5** 기대 일치.
- **조치:** [Draft PR #95](https://github.com/firmengine/firmengine/pull/95) `audit/a1-r35-period-asof-observation-20261031`, HEAD `ec7b8ef47c1fdc8004cf45f7f123a87cc5147d80`. 수정 source blob `df4e4fa58e6855ee03e1c914112f0a91a3420b9a`, 신규 test blob `6b1f2f552faeeef9f43d9c7dae619030897fb506`. `observedPeriodAndAsOf`로 기간과 기준일이 동시에 있으면 모두 표시, 기존 단독·미관찰 처리는 유지. PR 실제 source 재독 후 순수 helper V8 7조건 **7/7** 기대 일치. Node 회귀 작성·커밋, 실행하지 않음.
- `EvidenceDocument.uploadedAt`는 업로드 시각이고, `Fact`/Document의 **독립 발급일 전용 typed 필드는 이 소스에서 확인되지 않음**. 원문 내 발급일을 업로드일·asOf·발생기간으로 자동 추정하지 않음. 발급일 별도 계약, UI/DB/서식 경유, 원·월·연 단위 정합성·D1/Word 검증은 잔여 항목. **[ ] 유지**.

## 4. 종합·다음

- 수정 코드 변경은 main에 넣지 않고 **Draft PR #94·#95**(각 2파일, 총 4파일 모두 허용 경로)로 분리. 어느 PR도 법률 인정·계산·법원 결론 자동 승격시키지 않음. 감사 문서·보드만 main 반영 대상.
- A1-DOC-008 소스 연결/7개 bbox 순수검증; A1-LAW-012 원본 7/12·후보 12/12·커밋후 10/10; A1-DATA-009 원본 3/5·후보 5/5·커밋후 7/7. 서로 다른 격리 테스트를 전체 정확도/문서 인수율로 환산하지 않음.
- PR #94/#95 GitHub Actions 워크플로 실행 **0건 조회**. 신규 Node 테스트는 실행하지 않음. 전체 CI·빌드, 실제 D1/R2/Cron, 브라우저, 85서류, 18계산/95법률 종단, 서울 424호 공식서식/변호사 확인, 운영 배포 모두 **미검증**. 운영 마이그레이션·전자제출·인가확정 미수행. 인수 완료 **0건**.
- 다음 역할 **IT담당자·AX담당자·계산사무장**, 우선 ID **A1-IT-008**(R2→D1 실패 복구·기존 PR #24), **A1-AX-008**(법률 의견/반론/미해결), **A1-CALC-004**(동일월 복수 소득원 중복).
- 실행기 실제 Extra High 추론 수준 설정은 확인되지 않았으므로 활성화됐다고 표시하지 않음.
