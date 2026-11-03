# FirmEngine AX A1 — 제112차 코드 완결성·상호 기능충돌 감사

- 시간: 2026-11-04 KST (자동화 회차). 작업 시작 및 파일 작성 직전 GitHub `main` HEAD: `d0a5dd35ae4043b3ad46c2167cea8efe88a00ee5`. 모든 대상은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 안이다.
- 단일 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (읽은 blob `5ec1ab4c0e257e9408ef804291154c461a3047d4`). 선행 111차 영수증 및 4·6·48·58·80차 기록 대조.
- 담당 순환: **IT (A1-IT-015) → AX (A1-AX-015) → 계산사무장 (A1-CALC-015)**, 세 항목 **[ ] 미완료**. 최근 GitHub 커밋/PR #32·#139·#17 및 관련 소스·테스트 검토.
- 실제 소스 blob: `components/case-workflow.tsx` `2ec797958726b99a4358ec46ef35f78f90bfd927`; `lib/case-command-store.ts` `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`; `app/api/cases/[id]/commands/route.ts` `44c267951751d280d0f1c27ac6b3362bd7f9b9d6`; `lib/automatic-draft-handoff-contract.ts` `43cd0e0245bb74d396879880161654cf80a2978e`; `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`; `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `lib/case-data-recompute.ts` `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 기존 테스트 원문 읽기: `tests/case-calculation-feature-store.test.ts` blob `844525d8633442d571ced2c48ed5bd00ba7bb5a0` (revision/dataVersion 경합 및 저장 계보). 전체 Node 테스트 실행은 **하지 않음**.
- **방법:** GitHub의 실제 TypeScript *함수 본문*에서 실행 불가능한 타입 표기만 제거한 JavaScript를 V8 `Function`으로 격리 실행. HTTP fetch/load 및 외부 상태는 합성 mock. 계산은 원본 `persistCaseCalculationFeatures` 내 head UPSERT SQL 문자열을 별도 Python `sqlite3` 메모리 DB에서 실행. 독립 기대는 각 시나리오 전에 선언. 운영 D1/R2나 브라우저 실행이 아님.

## A1-IT-015 — HTTP 응답과 UI 저장 결과·재시도 상태 충돌

원본 `case-workflow.tsx`의 `send` 클로저 본문을 직접 실행. 가상 사건 revision=3, 지문 H, 동일 command ID `test-cmd`; fetch의 status/JSON만 바꿈. 독립 기대: **정확히 `committed===true`만 커밋, 명시적 4xx는 rejected, 무확인 2xx/5xx/JSON 오류는 uncertain이며 기존 commandId를 유지.** 202+committed:true/pending:true는 명령 커밋(후속 평가 pending)으로 구분.

| 합성 HTTP 응답 | 기대 | main 관찰 | PR #32 `send` 관찰 |
|---|---|---|---|
| 200 + committed:true + receipt | committed | committed | committed |
| 200 + committed:false + receipt | uncertain | **committed** | uncertain |
| 200 + message만 | uncertain | **committed** | uncertain |
| 200 + receipt 문자열 | uncertain | **committed** | uncertain |
| 202 + committed:true,pending:true | committed | committed | committed |
| 202 + pending:true, receipt만 | uncertain | **committed** | uncertain |
| 409 + error | rejected | rejected | rejected |
| 503 + error | uncertain | uncertain | uncertain |
| 200 + JSON 파싱 실패 | uncertain | **committed** | uncertain |
| 200 + committed:"true" | uncertain | **committed** | uncertain |
| 200 + committed:1 | uncertain | **committed** | uncertain |

**main 4/11, 미병합 Draft PR #32 11/11** 기대일치. main의 실패 7건에서 `updatePending(null)` 및 성공 알림이 관찰됨. PR #32 실제 UI blob `28f2759f0cd08e183952dd92044bf6a2809874d3`, helper blob `5e4af86131ba5ed7f8d223c6a4b4c8c634c25121`. PR #32는 `committed===true`만 확인하고 후속 UI 소비처로 세 상태를 전달. 실제 HTTP/브라우저/직원 저장·법적 승인 **미실행**.

## A1-AX-015 — 자동초안 → 직원 문안 인계 경계

원본 `automaticDraftHandoffDecision` 본문을 V8에서 실행. 가상 사건 `case-syn`, revision 9, dataVersion 5, 계산 run C1, 법률 run L1, reference SHA `ref-a`; 생성물 1건(가상 ID/해시)과 이전 문서/편집 상태를 교차 변경.

| 합성 조건 | 독립 기대 | main 관찰 |
|---|---|---|
| 같은 판본 정상 인계 | eligible | eligible |
| 다른 사건 ID, 완료 전 run | 차단 ×2 | 차단 ×2 |
| 원천 dataVersion, 법률 run, 계산 revision 변경 | 차단 ×3 | 차단 ×3 |
| 기준정보 SHA 변경 | 차단 | 차단 |
| 생성물 비어 있음 | 차단 | 차단 |
| 이전 final 존재 | 차단 | 차단 |
| 미적용 직원 편집 존재 | 차단 | 차단 |
| 현재 문서 존재, 정상 링크 증명 없음 | 차단 | 차단 |
| 완전히 동일한 기존 draft origin+파일 지문 | 중복 연결로 반환 | alreadyLinked=true |
| 기존 링크 파일 해시 변조 | 차단 | 차단 |

**13/13 합성 조건 기대일치**. 호출경로 `readAutomaticDraftHandoff` → `adoptAutomaticDraftForReview`에서 DB artifact 및 R2 해시 재검증, writer receipt 비교, `saveCase` expectedHeads 호출이 정적으로 연결됨. R2 실물·Word/직원 편집·변호사 검수 종단 검증은 **미실행**. PR #17 자동초안 완료 CAS 및 #24 export ACK 미병합으로 최종 인수 **보류**.

## A1-CALC-015 — 계산 참조 릴리스 변경 뒤 구 Run이 활성 Head 재승격

원본 `case-calculation-feature-store.ts`의 `INSERT INTO case_calculation_heads ... ON CONFLICT DO UPDATE` SQL을 Python `sqlite3` 메모리 DB로 실행. `cases`, `case_data_change_state`, `case_calculation_runs`(합성 reference SHA), `case_calculation_heads`를 생성. 기존 head는 `run-new`(ref=B), 뒤늦은 쓰기는 `run-old`(ref=A). 독립 기대: 동일 사건 revision/dataVersion이어도 활성 기준정보가 B인 상태에서 A가 덮으면 안 됨. DB 활성 release 판본을 원자적으로 확인하는 상위 제약은 이 SQL에 없음.

| 합성 실행 | 기대 write | SQLite changes | 최종 head | 판정 |
|---|---:|---:|---|---|
| revision=7/version=4 동률, 활성 B → 늦은 A | 0 | **1** | **run-old(A)** | 불일치 |
| 같은 ref B로 동일 판본 replay | 1 | 1 | run-old(B) | 기대일치(참조만 기준) |
| 현재 revision=8, incoming=7 | 0 | 0 | run-new(B) | 일치 |
| 현재 dataVersion=5, incoming=4 | 0 | 0 | run-new(B) | 일치 |
| 현재 revision=8/version=5, incoming 7/4 | 0 | 0 | run-new(B) | 일치 |
| 최초 head 부재, 최신 계산 쓰기 | 1 | 1 | run-old(A) | 일치 |
| 존재하지 않는 incoming dataVersion=5 | 0 | 0 | run-new(B) | 일치 |

**SQL 합성 6/7 기대일치; 기존 P0 후보 1건 재현**. 현재 `listCaseCalculationFeatures`의 `headStale` 표시는 revision/dataVersion만 비교하므로 reference 불일치도 놓침. 조회 표시만 보강하는 [Draft PR #139](https://github.com/firmengine/firmengine/pull/139)은 이 **쓰기 CAS** 결함을 해결하지 않음. `recomputeCaseDataUpdate`는 계산 전후 사건/데이터 버전을 재검사하지만 기준정보 active SHA는 SQL commit과 원자 묶음 아님. 법률·회계 의미 및 릴리스 활성화 정책이 얽혀 있으므로 main 즉시 수정 대신 **승인된 reference release epoch/active-head CAS 설계 및 별도 PR** 필요. 실제 D1 병렬 worker/staging 실증 **미실행**.

## 실행계층·결론·다음

- **이번 격리 검증:** main `send` **4/11**, Draft #32 `send` **11/11**, main 자동초안 인계 **13/13**, Python SQLite head UPSERT **6/7**. 합산 main 선택 조건 **23/31**; 실패 8개(명령 ACK 7·참조 CAS 1) 모두 기존 보드 등록 결함 범주. 이는 제품 정확도·전체 CI 합격률이 아니다.
- 코드 변경 **없음**. 기존 미병합 PR #32, #17/#24, #139를 덮지 않음. P0 계산의 코드·법률 의미를 임의 변경하지 않음. 특정 통과 조건만 부분검증, 세 ID 모두 **[ ]**.
- 본 문서의 입력값은 모두 합성(가짜 사건·원 단위·가짜 SHA). 실제 고객/원본 OCR 내용/개인정보/키/.env/비공개 정답 미기록. 미관찰/null/0/비해당/상충/source-only/승인 전을 구분하고 최종 확정으로 승격하지 않음.
- 종단 상담→85서류/OCR→정규화→18계산→95법률(C01·C02·C04)→자동초안→직원 편집→변호사 검수→법원 보정, 브라우저/API/DB 전체, 전체 Node/TS/lint/build/CI, staging D1/R2/Cron, Word·공식 서식, 변호사 승인 전부 **미실행**. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 **없음**. Extra High 모드 활성 확인 **불가**.
- **다음 역할:** 서류담당자 → 변호사 → 데이터담당자. 우선 보드 `A1-DOC-016` (직원 검수/변호사 이중서명), `A1-LAW-017` (보정명령 원본/기한/접수증), `A1-DATA-015` (서식 token별 Fact/계산 계보). 기존 #28/#36/#68/#100/#124 충돌·승인 상태 재확인.
