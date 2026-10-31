# FirmEngine AX A1 33차 — 법원 보정 기록 UI·접수증 시점·OCR/계산 대량 페이지 검증

- 일시: **2026-10-31 KST**. 직전 A1 32차 IT/AX/계산사무장 → 이번 **서류담당자·변호사·데이터담당자** 역할 순환.
- 감사 시작 GitHub `main`: `8e3e27abe5b31b3bdef434e3bc53ba52f4188bd3` (A4 r32 문서); 최근 main A4 r32/A3 r32/A2 r32/A1 r32 커밋 및 열려 있는 PR #32/#36/#49/#52/#68 등을 확인하고, 32차 A1 영수증 `5c376e33a4034a3612216b1a9f4c1bd447b19f20`, 단일 중앙 보드, 관련 스키마·코드·기존 테스트를 열람.
- 이번 체크: **`A1-DOC-017`, `A1-LAW-017`, `A1-DATA-013` 모두 [ ] 미완료**. 각 시험의 **관찰**과 독립 안전 **기대**를 분리함. 코드 존재·V8 함수 부분검증·Node/CI·실제 Cloudflare D1/R2/Cron·법원 원본·변호사 승인·배포는 다른 검증 단계임.
- 허용 경로는 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 실제 고객/개인식별자료/키/원본 OCR 사실값/비공개 정답 공개 기록 금지.

## 1. 소스 SHA·관련 경로

| main 실제 소스 | Git blob SHA |
| --- | --- |
| `components/case-workflow.tsx` | `2ec797958726b99a4358ec46ef35f78f90bfd927` |
| `lib/approval-readiness.ts` | `d3aecf05688d3146ecff94a3795bb3da8a215d35` |
| `lib/case-procedure-events.ts` | `7c61fdfb6e79becc415a8b1385a1580bd8aa6ab2` |
| `lib/preapproval-correction-item-store.ts` | `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0` |
| `lib/preapproval-correction-audit.ts` | `2cd18e22c9db4e5865f08b4d183f2d1751b0bf21` |
| `app/api/cases/[id]/correction-items/route.ts` | `baf7b7198adeac39e90673a54ab6248243c9fa3b` |
| `lib/extraction-row-store.ts` | `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125` |
| `lib/case-calculation-feature-store.ts` | `bb5f88b26e68f5ae2234741063ac9301a927e27a` |
| `lib/case-schema-services.ts` | `3e638f9e630e4c4fa9f6c17a205ca0c351248325` |
| `app/api/cases/[id]/data/route.ts` | `c851c4ca5961d42cdac5b957f6a9615734cdf741` |
| `db/schema.ts` | `933f8686845ac14669312dd21bf85e02c62ed5e6` |

기존 `tests/preapproval-correction-item-store.test.ts`, `tests/extraction-row-store.test.ts`, `tests/case-calculation-feature-store.test.ts`도 원문 열람. 기존 테스트 파일의 존재는 이번 실행 영수증이 아님.

## 2. A1-DOC-017 — 법원 기록과 내부 예상 보완요청의 UI 표시 구분

**독립 기대:** 담당자 수기로 기록한 `correction_requested`는 '기록'으로 표시하며, 내부 예상 보완요청은 법원 원문/법원 인정을 의미하지 않음. 원문·접수증·기한이 독립 확인되지 않으면 확정 표현 금지.

**main 관찰:** `approval-readiness.ts`는 `origin=internal_candidate`와 `origin=recorded_court_event`를 분리하지만 `components/case-workflow.tsx`는 절차 선택에서 `보정 요청`, 이벤트 목록에서는 `label(event.state)` 폴백을 사용하고 근거 검수 상태를 명시하지 않음. 화면/API/법원 원문 종단 검증 전인 **표시 혼동 가능성**이지, 실제 법원 확정/전자제출이 발생했다는 증거는 아님.

**조치:** [Draft PR #90](https://github.com/firmengine/firmengine/pull/90) 신규, branch `audit/a1-r33-court-procedure-display-20261031`, HEAD `e0083fed255d881c673a5830ec368a733716d334`. UI 경고와 보수적 라벨, 표시 전용 함수 및 4개 Node 회귀 블록. 세 파일 모두 허용 경로: `components/case-workflow.tsx` blob `3ae63b4e6ec41c66f9c7682a31aef4294a43a215`, `lib/procedure-event-display.ts` blob `e1f9bc1583b0ee503286374fd704ab5a54698263`, `tests/procedure-event-display.test.mjs` blob `c212cccb24add7338cd049d6ad94b76d1c5e6bfa`. 법률 승인/저장/명령 계약 변경 없음. **PR #32와 UI 파일이 겹치므로 통합 선행**, 직접 병합 없음.

**실행:** PR HEAD의 실제 blob을 다시 읽고 TS 순수 표시 함수 본문을 V8에서 실행. `correction_requested`, `amended`, unknown fallback, UI import·경고 문구·라벨·기존 `procedure.record` 호출 유지를 포함한 체크 **11/11 독립 기대 일치**. **Node 회귀 4블록 작성·커밋했지만 Node/브라우저/CI 미실행**. [ ] 유지.

## 3. A1-LAW-017 — 법원 원본·기한·접수증 사건 연결

`validateCorrectionItemDraft`의 **main 실제 함수 본문에서 TS 선언부만 제거하고 합성 D1 외 의존(currentFacts, linkedFact 등)을 대체한 V8 격리 실행**: **7조건 중 6/7 안전 기대 일치**.

| 합성 입력 | 독립 기대 | 실제 관찰 |
| --- | --- | --- |
| C01 보정명령 2026-10-30, A01 접수 2026-11-05, 동일 사건·활성 문서 | 원천 연결 후보 허용, 법원 충족 아님 | 원천 후보 수용 |
| A01 접수 2026-10-20로 변경(보정명령보다 과거) | `CORRECTION_RESPONSE_EVENT_UNBOUND` | **원천 후보 수용, 기존 P2 결함 재현** |
| A01 다른 법원 사건번호 | 거절 | `CORRECTION_RESPONSE_EVENT_UNBOUND` |
| 접수증 문서 철회 | 거절 | `CORRECTION_RESPONSE_DOCUMENT_UNKNOWN` |
| 응답 이벤트 없이 접수증만 | 거절 | `CORRECTION_RESPONSE_EVENT_REQUIRED` |
| 원본 보정명령 문서 철회 | 거절 | `CORRECTION_COURT_ORDER_SOURCE_UNVERIFIED` |
| 의미를 확인하지 않은 임의 `orderQuote` | 법원 인정으로 자동 승격 금지 | 원천 입력 후보로는 수용; 자동 승인 아님 |

과거 접수 이벤트 시간 재연결은 이미 **[Draft PR #68](https://github.com/firmengine/firmengine/pull/68)**이 해결 대상으로 하는 기존 결함. 보정항목 GET 사건별 인가 부족은 **[Draft PR #36](https://github.com/firmengine/firmengine/pull/36)** 미병합, 변경 중복 방지. 두 PR 모두 이번 조회에서 열려 있는 Draft임. 입력 자체가 실제 법원 원문 근거인지, `orderQuote`가 법원 페이지에 있는지/법원의 실제 발령·기한·접수증 인가 여부는 미검증.

또 다른 실제 main 함수 `auditPreapprovalCourtCorrections`의 TS 제거 V8 합성 **4/4 독립 기대 일치**: 법원 이벤트 없음은 0건; 보정 이벤트 있으나 Fact 없음은 미해결; Fact 수락도 `courtOrderSatisfied=false`; 원본 문서 철회 시 증빙 결손을 별도 차단. 실제 변호사 법률 승인·법원 인가는 수행하지 않음. [ ] 유지.

## 4. A1-DATA-013 — 원문행 2,000·계산행 5,000 페이지 검증

**실행 방식:** `listCaseExtractionRows`와 `listCaseCalculationFeatures` **GitHub main 실제 함수 본문**에서 TS 타입만 제거해 V8에서 실행. D1 `prepare/bind/first/all`은 합성 준비 명령 어댑터로 대체. 값/기록 ID는 모두 합성, 실제 SQLite·Cloudflare DB/HTTP/브라우저 시험은 아님.

| 시나리오 | 독립 기대 | main V8 관찰 |
| --- | --- | --- |
| OCR 원문행 2,000개 × 필드 1, `limit=50` | 40페이지, 원문행 2,000 고유, 셀 누락 없음 | **40페이지/2,000고유/2,000필드** |
| OCR 50행 × 200 필드 = 10,000 셀 | 500셀 배치 20회, 모두 반환 | **10,000 필드/20배치** |
| OCR 50행 × 201 필드 = 10,050 셀 | 무음 잘림 대신 명시적 오류 | **`EXTRACTION_ROW_TOO_MANY_FIELDS_REDUCE_LIMIT`** |
| 계산 5,000행, `limit=500` | 10페이지, 고유 5,000 | **10페이지/5,000고유** |
| 계산 5,000행, `limit=50` | 100페이지, 고유 5,000 | **100페이지/5,000고유** |
| 계산 실행 중 head `run-A→run-B` 변경, revision=7/dataVersion=4 고정 | 판본 불일치로 거절 | **구 run-A·headStale=false 반환**(기존 P1 결함) |

원문 3/3, 계산 2/3 안전 기대 일치. 외부 사건 데이터 HTTP API는 `limit≤50`이며 Node/D1 실제 페이지네이션은 미실행. 계산 read-run 판본 혼합은 기존 [Draft PR #49](https://github.com/firmengine/firmengine/pull/49), OCR 같은 revision의 head 교체는 기존 [Draft PR #52](https://github.com/firmengine/firmengine/pull/52)에서 제안되고 **모두 미병합**. 이번 실행에서 #52의 OCR head-race를 재시험한 것은 아님. 대량 검증 통과를 실제 D1 성능·전량 출처검증으로 승격 금지. [ ] 유지.

## 5. 회차 종합·미실행·다음 인수

- 총 **V8 합성/정적 연결 체크 28조건 중 26조건 안전 기대 일치**(DOC 새 PR 브랜치 11/11 + LAW 메인 6/7 + 법원 audit 메인 4/4 + DATA OCR 메인 3/3 + 계산 메인 2/3). 실패 2개는 **기존** #68 접수 시점·#49 계산 판본 교체로 신규 오류 이중집계 금지. 테스트 유형과 코드 판본이 서로 다르므로 제품 성능률 아님.
- 신규 조치 **UI 표시 전용 Draft PR #90**, main 제품 로직 변경 금지. Node 신규 회귀 4개는 **작성·커밋**, 실제 Node 실행 기록 없음. 기존 PR #32/#36/#49/#52/#68과 겹치는 법률·승인·데이터 의미 변경 보류.
- **제품 전체 인수 완료 0개**. 전체 Node/CI/빌드, staging D1/R2/Cron, 실제 UI 브라우저, 85종/18계산/95법률 종단, 공식 법원 명령·접수증·서식, 실무자 승인·사이트 배포 **미실행/미인증**. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 **미수행**.
- 다음 역할 순환 **IT담당자·AX담당자·계산사무장**. 우선 ID `A1-IT-007`(한 PDF 다중 유형·다PDF/암호·손상), `A1-AX-007`(모델 대신 결정론 계산 결과), `A1-CALC-003`(같은 사업자 복수 월·다사업자 복수행).
- 실제 실행기의 모델/추론수준 **Extra High 여부는 확인되지 않음**. 프롬프트 지침을 설정 변경으로 오인하지 않음.
