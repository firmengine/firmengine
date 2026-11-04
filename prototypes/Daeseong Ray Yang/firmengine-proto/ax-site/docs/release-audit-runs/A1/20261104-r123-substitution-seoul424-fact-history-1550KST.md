# FirmEngine A1 — r123 독립 코드 완결성·상호 충돌 감사 (2026-11-04 15:50 KST)

- 범위 **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만**. 이번 순환: **사용자·서류담당자 → 변호사 → 데이터담당자**. 직전 r122: IT → AX → 계산사무장. 인수 보드에 등록된 **A1-DOC-011 / A1-LAW-012 / A1-DATA-011**만 이번 회차 대상.
- 소스 비교 기준 시작 main `15e6b2a7b496476a6034533881ffcdf54ce800d0`; 이전 A1 r122 최종 `09ce521ade340cdf810a7e96978fe2b7ef47378e` 대비 최신 main에는 A2/A3 4개 문서 변경 커밋만 추가(커밋/PR 메타데이터 및 compare 실제 조회). 대상 본문 SHA는 아래와 같고, 기존 보드·r122 영수증·`db/schema.ts` SHA `933f8686845ac14669312dd21bf85e02c62ed5e6` 및 `tests/document-substitution.test.ts` SHA `0bb1478bac062f3daa844f10374440af6cbdceb2`와 `tests/domain.test.ts` SHA `2a029bf0b6d37fc3e582a79003a8b3db311877fd`·선행 감사 영수증을 열람함. 기존 Draft #57, #94, #12는 **open/draft/unmerged** 확인.
- **실제 실행 한계:** GitHub에서 읽은 원본 TypeScript 대상 함수의 **함수 몸체만 타입 구문을 제거하여 Code Mode V8에서 직접 호출**. DOC 정책 허용·지문 조회·일부 helper는 명시적 합성 adapter; LAW 법원기준 reference 및 임금요건 helper 합성; DATA crypto UUID, clone, export 무효화 및 출처 유효성 helper 합성. 이는 **국소 실행**이며 Node 프로젝트 테스트·D1/R2/Cron·HTTP/브라우저·법률승인·공식 서식과 동의어가 아니다. 모두 비실명 가상 B/C/D·f1/f2 케이스, 외부 서비스 호출 0.

## A1-DOC-011 [ ] — A←B+C 갈음 불완전 충족 (source `lib/document-substitution.ts` blob `9fea9344b923c961fe333761df99ddde431ce1bc`)

- 원본문 `reconcileDocumentSubstitution` 실제 V8 호출. 가상 A의 필수 proof f1/f2를 승인된 B의 두 Fact가 모두 제공하고 C도 선정된 상황. 동일 기간/주체/문서 SHA/승인 match/지문/가상 정책 경로로 준비하고 C의 **증빙/행정/서식/미확인** 역할을 달리 함. 독립 기대는 모든 선정된 문서에 유효 증빙 역할이 있어야 A 요청 비활성, 그렇지 않으면 재요청 활성.
- **15개 조건 중 12개 기대 일치**. 관찰: B+C evidence → inactive(기대 동일); B만 accepted/C 미제출 → restored(동일); **C administrative → inactive(기대 restored), C filed_form → inactive(기대 restored), C unknown → inactive(기대 restored)**. B administrative, B/C type 변경, B hash 변경, C 삭제, 한 Fact unreviewed, 정책변경 대기, 관할 변경, 주체 링크 미확정, 기간 누락은 모두 **restored(기대 동일)**.
- 반례 코드: `approvedMatches=accepted.filter(...selected.includes(observedType(...)))` 및 마지막 `selected.some(...accepted.some(...))`에서 **C 페이지 role=evidence 조건 없이** 선정 C를 인정. 반면 proof 참조 확인에서는 page.role===evidence를 요구해 두 검사 경계가 불일치. 기존 Draft [#57](https://github.com/firmengine/firmengine/pull/57)과 중복: 후보 PR 함수 자체는 이번 회차 **미실행**. 법원 갈음 허용여부는 사람 승인전.

## A1-LAW-012 [ ] — 서울 424 관할·최초접수일 판본 (source `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`)

- 원본문 `evaluateSeoul424` 실제 V8 호출. 합성 reference 설정 `court_id=seoul`, `effective_from=2026-10-01`, 총채무 기준 `50,000,000원`, 임금기간 2년 등으로 고정하되 **공식 법원 원문 검증·기준 배포 판본 인증은 수행하지 않음**. 승인된 합성 제1~6호·제7호 후보, 날짜/관할 오류를 독립 기대와 비교. 후보는 **사람 검토용**이며 법률상 요건 충족/인가 확정이 아님.
- **13개 조건 중 8개 기대 일치**. 관찰: 명시적 seoul/제1~6호/시행일 → candidate(기대 동일); busan → not_applicable(동일); 접수일 null/잘못된 2026-02-30 → unknown(동일); 시행 전 2026-09-30 → unsupported_version(동일); 시행일 정확·제7호 승인 후보 → candidate(동일); 제7호 임금 이력 누락 → unknown(동일).
- **불일치 5건:** courtId **null** + 제1~6호 또는 제7호 모두 충족 → 실제 `candidate_for_human_review`, 독립 기대 `unknown`(2건). courtId **"" / "  " / "seoul "** + 제1~6호 충족 → 실제 `not_applicable`, 독립 기대 `unknown`(3건). 미관찰·미정형 관할을 **타관할 확정값** 또는 **서울 심사 후보**로 승격하면 안 됨. 기존 Draft [#94](https://github.com/firmengine/firmengine/pull/94) open/unmerged, PR 후보 본문 미실행. `applicationDate` vs `firstFilingDate` 전체 API 매핑/공식 경과규정/변호사 승인 미검증.

## A1-DATA-011 [ ] — Fact 정정·철회/현재값·이력 (source `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`)

- 원본문 `currentFacts`, `touchCase`, `reviewFact`, `retractDocument` V8 호출. 가상 사건 문서 B→자식 C 및 독립 D, 초깃값 `fB=100/fC=0/fD=200`, 인정된 Fact. B 같은 값 검토→새 판본 검수→ B값 **명시적 0**으로 변경→B 원본·자식 C 철회와 현재값/과거 이력 추적. 재철회·오래된 Fact ID 편집·공백 검토자·두 동일 version 후보·별도 사건 불변도 테스트.
- **26개 조건 모두 기대 일치**. 실제 B 재검토 신규 version2, typed `factIds`가 새 버전으로 이동, 수정 후 version3 `value=0 / state=reported / recognition=unreviewed`, 이전 2판본 보존. B 철회시 B·C deleted, B/C의 최신 Fact는 retracted head로 이력 보존되고 `currentFacts` 제외, D와 원본 스냅샷 불변, inventoryComplete 3개 unknown. 오래된 ID 검토/중복 철회 거절, 동 버전 복수후보는 둘 다 노출.
- **기능충돌 주의:** 값 정정 시 typed `incomes[].factIds`가 구 version2를 그대로 참조함(관찰; `reviewFact` 의도상 remap은 `!changed`에서만 발생). 이는 곧바로 승인이나 소비처 유효성을 증명하지 않으며, 선행 **A1-DATA-017**의 검토대기/참조 잔존 위험과 종단 재투영 검증 필요. `sourceRef`/UUID/clone/export helper는 합성으로 대체, **D1 append-only 이벤트·R2 원문·사건 중복/실 API 미실행**. 기존 Draft [#12](https://github.com/firmengine/firmengine/pull/12) 미병합.

## 합산, 코드조치, 다음

- 이번 회차 **원본문 격리 실행 46/54 독립 기대 일치**, 기대 불일치 8개(DOC 3, LAW 5, DATA 0). **신규 운영 사고 8건 아님**. 소스가 있는 기존 열린 PR 결함을 중복 수정하지 않았고, 법률 기준 의미변경을 main에 바로 적용하지 않음. 제품 코드 변경 **0건**, 실제 Node/CI/브라우저/원격 DB/실법원 인수 **0건**. A1 세 ID는 모두 **[ ] 미완료**.
- 다음 역할 순환 **IT담당자 → AX담당자 → 계산사무장**. 다음 보드 ID **A1-IT-011** (구판본 null 구조), **A1-AX-011** (사람 검수 자동채택 경계), **A1-CALC-011** (월 변제가능액 필수비용).
- 85문서/복수행/C01·C02·C04/18계산·95법률/자동초안→직원·변호사 독립검수→법원 보정 및 동시 사건 종단 미검증. 사용자 자료/키/OCR 원본/비공개 정답 저장 금지 준수. 법률상 확정값/인가/운영 배포·운영 DB 마이그레이션·실제 전자제출 **실행 0건**. Extra High 설정 여부 **미관찰**.
