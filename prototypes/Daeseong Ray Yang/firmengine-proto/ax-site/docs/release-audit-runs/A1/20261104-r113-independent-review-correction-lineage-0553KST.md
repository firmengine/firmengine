# FirmEngine A1 — 113차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-04 05:53 KST)

## 범위·관찰
- 저장소: `firmengine/firmengine`; 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- 감사 직전 관찰 GitHub main SHA: `c160a9c44248c1739a2f916b1e4980a9e7292938` (동시 커밋으로 이동 가능). 직전 112차는 IT/AX/계산, 이번 순환은 **사용자·서류담당자 → 변호사 → 데이터담당자**.
- 단일 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`에서 미완료 **A1-DOC-016, A1-LAW-017, A1-DATA-015**를 확인했고 79차/77차 영수증, 소스, correction SQL 0022, Drizzle schema, 관련 기존 Draft PR #28/#36/#68/#100/#124/#184를 대조했다. PR 6개 모두 읽기 당시 open/draft/unmerged.
- 이번 실행은 GitHub main 원본 TypeScript의 **대상 함수 본문만** 읽어 타입·export를 최소 제거한 `Function`(V8 isolate) 합성 검증이다. `structuredClone`은 JSON 안전 합성 객체에 한해 JSON roundtrip으로 대체. DOC의 `requiredKindsForCase`, LAW의 `currentFacts`/`validSourceRef` 및 canonical Set, DATA의 form contract/필수종류/원본 Fact 검증 등 외부 의존성은 명시적 합성 stub. 법률 인정/변제 산식은 변경하지 않았다.
- **실제 고객자료·OCR 원본·인증키·비공개 정답 없음**; `structuredTest` 같은 실제 사건 저장은 수행하지 않았다. 법원 명령 날짜·문구와 금액은 모두 가상.

## A1-DOC-016 [ ] — 직원 검수와 독립 변호사 검수
- 소스: `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; 실제 함수 `manifestFingerprint`, `manifestIssues`, `currentExportReviews`, `reviewExport`, `archiveExport`.
- 합성 입력: 사건 revision 5, `final` manifest, 필수 `application`, 현재 파일 `art1` 해시 `H`, 같은 manifestFingerprint, 직원 `staff`, 변호사 `lawyer`. requiredKinds fixture는 []로 제한.
- 독립 기대 → 실제 관찰(10건): 직원만 검수/변호사 null **일치**; 직원 없이 변호사 거절 **일치**; 서로 다른 actor 두 검수 **일치**; **동일 actor 직원→변호사 거절 기대 / main ACCEPT**; **`staff`→` staff ` 동일인 거절 기대 / main ACCEPT**; **저장된 과거 동일 actor 두 서명에서 lawyer null 기대 / main LAWYER**; 산출파일 hash 변경 후 승인 무효 **일치**; 보관 후 승인 무효 **일치**; draft 검수 거절 **일치**; service actor 거절 **일치**.
- **7/10 독립 기대 일치**. 기존 P0 승인자 독립성 경계 재현. 기존 [Draft #28](https://github.com/firmengine/firmengine/pull/28) 미병합; 이번 회차 수정 PR 실제 실행/Node 검증은 미수행. 실제 사용자 인증·서명·Word/HTTP 저장 미검증.

## A1-LAW-017 [ ] — 보정명령·응답·접수증 시점 관계
- 소스: `lib/preapproval-correction-item-store.ts` blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`, 실제 `validateCorrectionItemDraft` 본문.
- 합성 입력: 사건 `caseX` revision 5, 명령 `ORDER` `2026-10-30`, 동일 법원 reference `courtX`, 원본문서 `ORDER-DOC` 활성 1쪽, 응답 `RESP`/응답문서 `RESPONSE-DOC`/접수증 `RECEIPT-DOC` 활성. 응답이 `2026-11-01`이면 허용 기대·허용 관찰.
- 독립 기대 → 실제 관찰(10건): 정상 사후응답 허용 **일치**; **응답일 `2026-10-20`은 거절 기대 / main ALLOW**; **응답일 `not-a-date`는 거절 기대 / main ALLOW**; 당일 응답 허용 **일치**; 다른 법원 reference 거절 **일치**; event에 접수증 누락 거절 **일치**; event 없는 접수증 거절 **일치**; 철회된 명령 원본 거절 **일치**; 미등록 응답문서 거절 **일치**; 원본문서에 없는 페이지 거절 **일치**.
- **8/10 독립 기대 일치**. 기존 시점검증 결함 재현. 기존 [Draft #68](https://github.com/firmengine/firmengine/pull/68) 미병합, GET 사건별 권한은 별도 [Draft #36](https://github.com/firmengine/firmengine/pull/36) 미병합. 실제 법원 원본·기한·서명·접수증·D1 조회 및 직원 권한 검증 없음. 법원 충족 판단은 절대 확정하지 않음.

## A1-DATA-015 [ ] — 계산값→서식 토큰 계보 일치
- 소스: `lib/lawgraph-document-field-projection.ts` blob `a017294aa814f4d33360c2531abf91d9eb79a6e0`, 원본문 `projectLawgraphDocumentFields`.
- 합성 입력: D5103 `month.net_income` 하나의 반복행, `SUB1` 당사자, `CALC1` (`incomeRows.monthlyWon`, rowOrdinal 0), 가상 `sourceFactIds=[F1]`. 실제 법원 서식·계산 실행이 아니라 stub된 단일 field binding이다.
- 독립 기대 → 실제 관찰(9건): `100`/`100` linked **일치**; `1,000`/`1000` linked **일치**; **표시 `1,00`/계산 100 → review_required 기대 / linked_calculation, manualReviewRequired=false**; **`1,,000`/1000 → review_required 기대 / linked**; **`1 00`/100 → review_required 기대 / linked**; **provisional 100/100 → review_required 기대 / linked, manualReviewRequired=false**; 서로 다른 명시적 subject `SUB2` → review_required **일치**; 명시적 `0`/`0` linked **일치**; 표시 null → missing_value **일치**.
- **5/9 독립 기대 일치**. 소스 `sourceNumeric`가 쉼표·공백을 무조건 제거하며 `computed`와 `provisional`을 둘 다 정확 연결함. 원화 숫자 자체의 산술 결함이나 공식 서식 인정 실패를 입증한 것은 아니고 **계보 수동검토 방어 결함**이다. 기존 [Draft #100](https://github.com/firmengine/firmengine/pull/100), [#124](https://github.com/firmengine/firmengine/pull/124), stacked [#184](https://github.com/firmengine/firmengine/pull/184)는 각각 다른 경계를 수정하며 통합 충돌/Node·Word 검증 미수행.

## 합산·조치
- **이번 실제 V8 합성 검증: 20/29 독립 기대 일치**(DOC 7/10 + LAW 8/10 + DATA 5/9). 서로 다른 함수의 선택된 조건 개수이지 시스템 정확도·CI 합격률은 아니다.
- 세 영역 모두 기존 Draft PR과 중복되므로 제품 코드 **수정 0**, PR 신규 생성/병합 **0**. 소스 SHA를 재확인했으며 법률 승인·원화 의미·계보 구조의 무검증 main 변경 금지. 보드 세 ID는 **[ ] 미완료** 유지.
- **다음 순환:** IT → AX → 계산사무장. 보드 우선 **A1-IT-016** (HEAD/타입·lint·빌드·회귀), **A1-AX-016** (n8n 참조물 vs 실제 실행), **A1-CALC-016** (저장 계산액과 서식 원단위 일치). 최신 보드에서 해당 ID가 여전히 미완료인지 재확인.
- **미실행:** Node 22 native 테스트/TypeScript/lint/CI, 브라우저/API 로그인, staging D1·R2·Cron, 실 85종 PDF OCR, 18계산·95법률 E2E, D5103/D5110 실제 Word, 법률·서식·변호사 승인, 사이트 배포. 제품 전체 종단 인수 **0건**. 운영 배포/D1 운영 migration/실제 전자제출/법원 인가 확정 **수행 안 함**. Extra High 실행 설정은 확인되지 않았음.
