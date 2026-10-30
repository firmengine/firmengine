# FirmEngine A1 — 19차 코드 완결성·상호 기능충돌 감사

- 범위: GitHub `firmengine/firmengine` **main**의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만. 감사 시작 main `6270f97e102a04c0119b7040a4e1d5f5385a8113` (2026-10-31 06:46 KST의 GitHub commit 표시 기준). 18차 A1 인수 영수증을 읽고 다음 회차로 인계한 세 ID를 이어서 확인.
- 이번 역할 순환: **사용자·서류담당자 A1-DOC-014 → 변호사 A1-LAW-017 → 데이터담당자 A1-DATA-015**. 이전 18차 IT/AX/CALC와 동일 역할을 반복하지 않음.
- 준비 확인: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, main 최근 커밋 7건, 개방 Draft PR 현황 및 관련 파일 변경 경로, `db/schema.ts`, 실제 라이브러리·API 코드, 관련 기존 Node 테스트·18차 영수증 조회. 실고객 사건/원본 OCR/키/비공개 정답은 사용·기록하지 않음.
- **검증 수준:** 기존 main의 실제 함수 본문을 V8에서 분리해 합성 데이터·대체 의존성으로 실행(적시 명시); 소스/스키마 정적 비교. GitHub에 추가한 Node 회귀 테스트는 **코드 작성 및 커밋만**, 실제 Node 프로젝트·CI·브라우저·Cloudflare staging D1/R2에서 실행하지 않음. 따라서 본 감사의 ID 셋 모두 **[ ] 미완료**.

## A1-DOC-014 — 직원 OCR 사실값 정정 단일값 계약 (신규 P2)

- 원본: `lib/case-commands.ts` Git blob `d18c555f04f65687c509a8e8d35aba4bb3597378`, `lib/domain.ts` Git blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; 기존 `tests/case-commands.test.ts` blob `a388177e8120174ee57c683264292b86faf76f2b`.
- 경로: 명령 `fact.correct` → `patch.value` 타입 검사 → `reviewFact()` → 새 Fact 버전. 기존 검사는 객체를 차단하면서 배열·중첩 배열은 `!Array.isArray(patch.value)` 예외로 허용한다. 비금전 `person.name`에 배열을 전달한 `reviewFact()` 실제 함수 본문의 V8 격리 실행에서 새 Fact 값 `["B"]`를 관찰; 비금전값과 달리 금전 정정은 별도 검사로 막힐 수 있으므로 모든 OCR 필드에 일반화하지 않음.
- 독립 기대: 단일 원문값인 문자열·숫자·명시적 null은 계약에 따라 허용, undefined/객체/배열/중첩배열은 거절. null은 *미관찰*이나 *0*으로 자동 환산하지 않고 종전 검토 요구 유지.
- 실제 조건 테스트: 원본 조건 V8 **5/7 기대 일치**(배열·중첩배열 2건 오허용); 수정 조건 V8 **7/7 기대 일치**(텍스트/정수/null 허용, undefined/객체/배열/중첩배열 차단). 전체 command API/D1·직원 UI E2E는 미실행.
- 조치: 기존 타입 가드에서 배열 예외만 제거. 별도 브랜치 `audit/a1-r19-fact-correct-array-20261031`, [Draft PR #69](https://github.com/firmengine/firmengine/pull/69), 코드 커밋 `726e8c20ec9b47c66b92c068a85d235cd6fae440`, 테스트 최종 HEAD `72cd495915a0a647ce88370ed301995fcd10b04d`. `tests/case-commands.test.ts`에 실제 `reduceCaseCommand`를 쓰는 합성 비금전 Fact 회귀 블록 추가(배열·중첩배열·객체 차단, 원래 fact 유지, 문자열 정정은 새 미승인 fact). **해당 새 Node 테스트는 미실행.** 기존 PR #20과 두 파일이 중첩되므로 병합 전 충돌 및 재실행 확인 필요. OCR 원문값·과거 이력·사람 승인 자체를 수정/승격하지 않음. **[ ] 유지.**

## A1-LAW-017 — 보정명령 이전 답변·접수증 연결 (신규 P2)

- 원본: `lib/preapproval-correction-item-store.ts` Git blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`; 기존 `tests/preapproval-correction-item-store.test.ts` blob `b78fa006c9c003b72b79fd79f74630e342b97238`. 스키마 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; 기존 사건별 보정항목 GET 권한 문제는 이전 [Draft PR #36](https://github.com/firmengine/firmengine/pull/36) 미병합과 별개.
- 재현 합성 입력: 사건별 `correction_requested` 이벤트 `2026-10-30`(합성 법원 사건번호 `case-123`), 과거 `received` 이벤트 `2026-10-20`(같은 사건번호), 활성 합성 답변/접수증 문서. 실제 `validateCorrectionItemDraft` 본문을 V8에 격리 실행. 독립 기대: 보정명령보다 이전의 서류접수는 **해당 보정명령의 답변/접수증으로 연결 금지**. 관찰: 기존 main이 연결 허용. 동일일/이후일 응답, 다른 사건번호, 응답 이벤트 부재를 포함한 원본 격리 **4/5 기대 일치**.
- 조치: 저장시 응답 이벤트의 `occurredAt` 및 명령 `occurredAt`이 파싱 가능하고 응답 일시가 명령보다 빠르지 않은지 확인; 읽을 때에도 저장 응답의 시간 역전/비정상 날짜가 발견되면 해당 항목 `sourceCurrent=false`로 취급. 시간 비교는 증빙 연결의 필요조건일 뿐 공식 법원 접수/기간/법적 충족의 충분조건이 아님.
- 변경한 실제 `validateCorrectionItemDraft` V8 격리 **4/4**(이전/동일일/이후/무효일), 변경한 실제 `readCourtCorrectionItems` 함수 본문 V8 + 합성 D1 조회 대체 **4/4**(`sourceCurrent` 참/거짓 독립 기대 일치). 모든 경우 `courtOrderSatisfied=false`. 실제 D1 트랜잭션·문서 업로드·법원 원문은 미실행/미인증.
- 별도 브랜치 `audit/a1-r19-court-response-chronology-20261031`, [Draft PR #68](https://github.com/firmengine/firmengine/pull/68), 코드 커밋 `fc984790440c7cf82636360f7a136183358311a4`, 회귀 HEAD `9ca26c047f51e43d28ec4ee47cb5f9626cc337ec`. 실제 API-연결 함수들을 겨냥한 Node 회귀 3블록(과거응답 거절/동일일 후보 허용/이미 저장된 응답 시간 역전 시 stale) **작성 및 커밋만, Node 미실행**.
- 추가 blocker: 동일 사건번호 아래 복수 법원 보정명령이 존재하면 답변의 날짜만으로 어느 보정명령의 이행인지 식별 불가능; 공식 원본 문서·직원 기록·개별 법원 접수증·담당 변호사 검토 필요. 법원 인가 상태로 승격하지 않음. **[ ] 유지.**

## A1-DATA-015 — 최종 서식 token의 사실/산식/실행 ID 추적 (정적 구현 공백)

- 확인한 원본 SHA: `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `lib/form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`, `lib/form-contracts.ts` `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef`, `lib/export-provenance.ts` `ee467158d3fa7c19b2d0795a3e93f81c63b6285f`, `lib/office-writer.ts` `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`.
- 실제 DB 선언: 계산 피처에 `runId/sourceFactIdsJson/inputRefsJson/formula`, 생성 서식 필드에 `reviewRunId/token/sourceFactIdsJson/calculationFeatureRefsJson/citationJson`이 존재한다. **DB 컬럼 존재 ≠ 출력 문서의 모든 토큰 값에 대한 추적 영수증 존재.**
- 실제 렌더 경로: `buildFormBindings()`의 `FormBindings`는 `scalars/rows` **문자열 값만** 저장. `pick()`은 사실값 후보를 고르나 선별된 Fact ID는 바인딩과 함께 내보내지 않는다. 계산 `monthly_income` 등은 계산 결과 수치를 문자열로 바꾸지만 각 토큰 산식/run ID가 바인딩되지 않는다. `FormProvenance`는 템플릿 SHA·버전·미해결 토큰/승인대기 상태만 포함. `buildExportProvenance`는 문서/페이지 원장용으로 토큰 ID 연결이 없다. `office-writer`는 이 바인딩·메타데이터를 사용하여 문서에 표시한다.
- 실제 8개 정적 계약 점검: 바인딩 `scalars/rows` 있음, Fact ID+run ID 맵 없음, `FormProvenance` 토큰별 근거 맵 없음, 계산 월소득을 바인딩에 반영, `pick` 사실값 호출, 준비된 바인딩을 writer가 사용, form 수준 provenance 사용, 페이지 provenance 토큰 맵 없음. **정적 소스 관찰이며 동적 8/8 단위테스트 통과로 계산하지 않음.**
- 독립 기대: D5103/D5110 등 표준 서식 각 토큰/반복행의 출력 값 → 현재 `sourceFactId` 또는 계산 피처/산식/수행 `runId` → 판본·증빙 해시를 역추적할 수 있어야 한다. 현 구조에서는 표시값에서 메타데이터로의 토큰별 연결이 누락. 해당 부분을 **source-only/미구현·미인증**으로 기록; 원천 사실 추출·저장까지 모두 실패했다는 주장은 하지 않음.
- 후속 작업: 계산/문안 결정 구분, 반복행 ID, 원천 Fact/계산 피처/법률 인정의 각 상태 및 stale/상충, 출력값 지문, 문서 수정 시 이력 불변성까지 포함한 읽기 전용 계보 영수증 계약 설계 후 실제 저장·Word 매핑/검증 필요. 계산 의미/법률 판단 및 공식 양식과 관련되므로 임의 코드 변경·완료 표시 없음. **[ ] 유지.**

## 회차 결과와 다음 인계

| ID | 조치 | 관찰 수준 | 인수 |
| --- | --- | --- | --- |
| A1-DOC-014 | 새로운 P2 배열 입력 방어 Draft PR #69, Node 회귀 작성 | 원본 V8 5/7 → 수정 V8 7/7 | [ ] |
| A1-LAW-017 | 새로운 P2 보정 전 응답 링크 방어 Draft PR #68, Node 회귀 작성 | 원본 V8 4/5 → 수정 저장함수 4/4 + 조회함수 4/4 | [ ] |
| A1-DATA-015 | 토큰별 근거 체계의 출력 계약 공백 확인 | 실제 소스·DB 정의 8조건 정적 대조, E2E 미검증 | [ ] |

- 두 PR 각 2개 파일, 모두 정확히 지정한 `ax-site/` 하위. 둘 다 **Draft·미병합**, 제품 실행 코드 **main 미변경**.
- **전체 Node 회귀·TypeScript·lint·build·CI·staging D1/R2/Cron·실제 브라우저·공식 법원 서식 및 변호사 승인·운영 사이트 배포 전부 미관찰/미실행**. 합성 테스트 통과와 위 단계들을 동의어로 표현하지 않음.
- 저장 상태는 미관찰/null/정상 0/비해당/상충/source-only/승인전 별개로 유지. 이 회차에서 어떤 값도 법률상 확정값으로 승격하지 않음. 고객 문서·PII·키/.env 비기록. 운영 배포·운영 마이그레이션·전자제출·인가 확정 **미수행**.
- **20차 다음 역할**: IT담당자 `A1-IT-015`(오류 응답→UI 명시적 저장여부·재시도), AX담당자 `A1-AX-017`(오류/영향/복구 사용자 표시), 계산사무장 `A1-CALC-016`(최종 서식 D5103/D5110 숫자 및 저장 산식 소스 연결). 추가 기존 높은 우선순위: `A1-CALC-015` stale reference head 기존 P0 및 `A1-IT-003` 사건 읽기 ACL 미병합 PR #64/#66.
