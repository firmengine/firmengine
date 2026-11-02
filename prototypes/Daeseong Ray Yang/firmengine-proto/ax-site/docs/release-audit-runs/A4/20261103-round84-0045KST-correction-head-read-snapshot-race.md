# FirmEngine A4 84차 — 법원 보정항목 읽기 중 HEAD 교체·응답 유실 후 구판본 'current' 노출 (독립 SQL 합성)
작성: 2026-11-03 00:45 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하의 A4 실행 흐름·예외·동시성·복구. 모든 사건·문서·기한·해시는 가상이며 실제 고객/법원 원문/OCR/키/확정 법률판정이 아니다.

## 1. 원천/직전 회차/진행중 PR
- 시작 기준 GitHub main: `680abde7fba6bd6018bb87c714ca443c7d195935`. 이번에 읽은 최근 main 커밋: `680abde7`(A3 r84), `e877e416`(A4 r83), `5748909a`(A4 r83 영수증) 등. 커밋 순서는 각각의 재조회 시점 기준이며 이후 동시 변경될 수 있다.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`를 직접 읽고 **`A4-IT-005`, `A4-DOC-007`, `A4-LAW-008`, `A4-DATA-012`, `X-044`** 총 5개를 이번 부분 검증 ID로 선정. 모든 ID **[ ] 미완료**. 6역할은 **데이터 → AX → IT → 사용자·서류 → 계산사무장 → 변호사** 관점으로 순환했으며 사람 승인 0건.
- 직전 `docs/release-audit-runs/A4/20261103-round83-court-correction-final-cas-role-source-deadline.md` (blob `8428d2f32a6f4f58fd2848fffb022343b9de9d1f`): 쓰기 시 역할·문서 SHA·storage token 최종 CAS 불일치 및 기한 Fact 철회 경합; 이번에는 **읽기 시 HEAD 원자적 스냅샷**의 별도 공백으로 확장.
- 소스 blob: `lib/preapproval-correction-item-store.ts` `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`; `app/api/cases/[id]/correction-items/route.ts` `baf7b7198adeac39e90673a54ab6248243c9fa3b`; `drizzle/0022_preapproval_court_correction_items.sql` `bec8b19780eaa951c4994530060c916f903a40fe`; `tests/preapproval-correction-item-store.test.ts` `b78fa006c9c003b72b79fd79f74630e342b97238`.
- Draft PR #19(동일 courtReference 복수 명령의 응답 오연결), #170(Word 인계 감사 원자화), #187(Word 최종 권한검사) 소스/상태를 구분. **PR #19의 read predicate 수정에는 본 HEAD 교체 read-window CAS가 없음.** 모두 PR 병합/실서비스 완료 증빙이 아니다.

## 2. 실제 main 흐름과 독립 기대
실제 `readCourtCorrectionItems`는 A) `currentVersion` (case revision/source dataVersion) → B) `SELECT ... FROM case_court_correction_item_heads JOIN versions` → C) `currentVersion` 재조회 → D) 메모리 `data.documents`·procedureEvents·법원기한 Fact와 **B에서 읽은 행**을 비교해 `sourceCurrent`를 산정한다.

**관찰된 조건부 읽기 경합(P1 후보):** A 워커가 B단계에서 item HEAD=A를 읽은 직후 B 워커가 동일 사건 revision=3/sourceDataVersion=7을 유지하면서 해당 head를 B로 변경한다. A 워커의 C단계는 **같은 3/7**이어서 통과하고, A의 결과는 구 HEAD=A를 `sourceCurrent:true`로 응답한다. 실제 최신 DB HEAD는 B다. 이전 승인·법원기한·문서 버전의 법률적 확정/법원 충족 여부는 여전히 **false**지만, 직원 UI가 구 초안을 최신 문안으로 다룰 수 있다. **실제 운영 사고를 확인한 것이 아니며, 두 SELECT와 source guard의 SQL 수준 경합 시뮬레이션**이다.

단순 HEAD 재조회 대조는 B 변경을 발견하지만 검증 뒤 응답 직전 경쟁과 A→B→A를 원자적으로 배제하지 못하므로 **완전한 해결/통과로 간주 금지**. 트랜잭션 일관된 스냅샷·head generation(단조 증가)·클라이언트 재검증 및 source/data 판본/승인 인계 의미를 포함한 설계·실무자 승인 후 별도 Draft PR에서 구현해야 한다.

## 3. 실행 입력, 독립 기대값, 관찰
환경: Node.js **22.16.0**, `node:sqlite` 파일 기반 WAL **독립 연결 A/B**. fixture: 가상 case revision **3**, sourceDataVersion **7**, correction order id `court-order-1`, head version `correction-aaaa…`, 문서 SHA **a×64**, 법원기한 **null**, 법원 수락은 상수 false. B 워커 SQL head UPDATE는 별도 IMMEDIATE commit. **main SQL을 독립 전사해 실행**했으며 실제 TypeScript import/HTTP/D1이 아니다.

| 시나리오 | 독립 기대 / 보호 목표 | 원본 main 상당 관찰 |
|---|---|---|
| 변경 없는 GET | A current, court accepted=false | A `sourceCurrent=true`, court=false |
| A rows SELECT 뒤 B가 A→B HEAD 교체 | 구 A 현재본 금지 / 재시도 또는 보류 | **A `sourceCurrent=true`, 최신 DB는 B** (반례) |
| B가 case revision 3→4 | 구 A 응답 차단 | 재조회 오류로 차단 (기존 보호) |
| B가 sourceDataVersion 7→8 | 구 A 응답 차단 | 재조회 오류로 차단 (기존 보호) |
| B가 동일 사건의 다른 보정항목 head 추가 | 기존 페이지 목록의 부재를 최신 미항목화로 표시 금지 | A는 `unitemizedCourtEventIds`에 해당 명령 표기, DB에는 새 HEAD 존재 |
| B가 HEAD 삭제, versions 보존 | 현행 HEAD 없는 구 A 초안 금지 | A가 여전히 `sourceCurrent=true`, 역사 버전은 보존 |
| B가 documents SQL SHA만 바꿈(3/7 유지) | 구 PDF 해시 기준 상태 재검증 | 메모리 data 기반 A current true, SQL DB SHA는 변경 |
| 마지막에 head identity 재조회 | 위 B 교체/추가 발견 | 대조 false, **단일 재조회는 원자적 안전 증거 아님** |
| A→B→A ABA | 단일 ID 일치로 무변경 확정 금지 | 단순 head ID 비교 true(중간 변경 미검출) |
| 법원기한 `null` | 임의 0/날짜/법원 수락으로 승격 금지 | null 보존, 법원 충족 false |

**실행 결과:** 신규 `court_correction_read_head_snapshot_race.test.mjs` **15/15 기대관찰 일치** (실패 경로를 의도적으로 통과시키는 부정대조 포함). SHA-256 `ad0135e0aa8adc65d2853d99c39afe0d51ec5bac3a6c0d070cf50f111581536f`, 출력 `6d429e1f08b631799e2e04de2eef6e9f2b01026fd7e5db0fa510af59b25a924b`.
전체 75~84차 가용 합성 Node 테스트 **130/130 기대관찰 일치**, 통합 출력 SHA-256 `406e7eb8b7fdb93e20c047d3fa29a00510bedbb986bfc791f229c4692d20164e`. 초기 로컬 회귀 105/107은 81·82차 외부 helper 파일이 재생 환경에 없어서 2개 파일 import 실패했기 때문이며, **PR #187 실제 blob `600cf9683c8cb879337eb45c8cbb9f3f89d10de6`을 조회·Git hash-object 재검증 후** 두 로컬 파일명으로 복구해 전체를 재실행했다. 실제 앱 결함의 수정이나 원본 테스트의 변경이 아니다.
로컬 합성 코드/결과는 대화 작업 산출물 경로 `firmengine-a4/r84/`로 보관. 이 영수증은 테스트를 실행한 기록과 재현에 필요한 입력·SQL 메커니즘을 기록하되 GitHub에서 테스트 코드를 자동 실행한 CI는 아니다.

## 4. 상태 분리 / 금지 동작
- `sourceCurrent:true`는 **선행 읽기 기준의 코드상 평가**일 뿐 최종 직원/변호사 승인, 법원 보정이행/인가, 현행 head 불변 보증 아님. `null` 기한/미관찰/0건 CAS/무효·철회/source-only/approval_pending을 별도 상태로 유지.
- **미실행**: 저장소 실제 TypeScript/Next 전체 CI, staging D1/R2/Cron, 실제 HTTP 두 워커, R2 PUT 성공·D1 503/ACK 소실, 중복 webhook, 모델 429/timeout, 원본 법원 PDF 및 Word 바이트, 직원·변호사 실승인, 전체 상담→서류→OCR→600000ms quiet 계산→95 법률→Word→보정 E2E, 운영 n8n, 실제 배포.
- 이번 회차 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 **0건**. 실제 고객·비공개 OCR·키·env 기록 없음. 실행 코드 수정 **0건**: read 스냅샷의 원자성·응답 계약을 결정하지 않은 채 단순 HEAD 재조회를 병합하면 허위 안정성을 만들 수 있어 실무자 승인 전 보류.

## 5. 체크 상태·다음
- `A4-IT-005` [ ]: D1 commit ACK 유실 후 과거 영수증과 **현재** HEAD 판본 분리 필요. 이번 실제 ACK 손실은 재현 안 함.
- `A4-DOC-007` [ ]: 법원기한 null 유지 및 직원 목록 조회 중 과거/현재 구분. 실제 내부 기한 vs 법원 원문 대조 미실행.
- `A4-LAW-008` [ ]: 구 head가 현재 source로 보이는 반례 + PR #19 복수 명령 identity와 별개. 원문 페이지/보정 법률 승인 미실행.
- `A4-DATA-012` [ ]: 두 워커 out-of-order read/write 및 head 추가·삭제 반례 재현; 실제 D1 이벤트 경로 미실행.
- `X-044` [ ]: 기한 철회 후 판본 유지/무효화 조건을 보존; 직접 Fact 철회 본문 시험은 83차 근거, 이번 null/HEAD 변경 재현만 수행.
- 다음: 한 트랜잭션 판본(read snapshot)과 단조 head epoch의 설계 비교, 실제 module-level Node 테스트, PR #19와 동일 사건번호 복수명령/동일 답변, 읽기–직원 Word/변호사 승인 교차, staging D1 2워커·R2 부분성공/429/503/timeout·실 보정 이벤트.
- **신규 최종 인수 완료 0/5. 6역할 모두 관점 검토, 사람이 실제 서명한 승인 0건.**
