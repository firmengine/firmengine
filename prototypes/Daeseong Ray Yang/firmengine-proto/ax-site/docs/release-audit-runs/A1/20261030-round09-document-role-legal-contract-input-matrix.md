# FirmEngine A1 9차 — 문서 재분류/법률 근거계약/18계산 91입력 교차 인수

**감사일:** 2026-10-30 KST. 시작 main `8b15aec62a80006d74b71fca395f359ba2729f30`, 영수증 기록 직전 main `8b15aec62a80006d74b71fca395f359ba2729f30`.
**허용 경로:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` (본 감사의 코드수정은 별도 Draft PR에만 반영).
**역할 순환:** 8차 IT·AX·계산사무장 → **9차 사용자·서류담당자(A1-DOC-009), 변호사(A1-LAW-013), 데이터담당자(A1-DATA-014)**.
**현재 판정:** 3개 모두 **부분 검증, 체크박스 [ ] 유지**. 실제 법적/운영 인수 완료 0개.

## 먼저 대조한 자료
- GitHub main HEAD, ax-site 최근 25 commits, 열린 PR #12~#45, A1 8차 및 3차 감사 영수증, 중앙 인수 보드 3개 ID.
- 코드: `lib/case-commands.ts`, `lib/case-command-store.ts`, `lib/domain.ts`, `lib/fact-object-projection.ts`, `lib/pipeline.ts`, `lib/legal-evidence-criteria.ts`, `lib/legal-review-packet.ts`, `lib/case-legal-automation.ts`, `lib/canonical-field-binding.ts`, `lib/calculation-input-audit.ts`, `lib/execution-catalog.ts`; `db/schema.ts`; 관련 `tests/case-commands.test.ts`, `tests/legal-evidence-criteria.test.ts`, `tests/calculation-input-audit.test.ts`.
- 입력 정의: `lib/risk-catalog.json`, `lib/reference-decision-tables.json`, `lib/canonical-field-id-index.json`, `lib/document-agent-field-contracts.json`, `lib/shared-document-field-contracts.json`, `lib/ocr-field-supplements.json`.
- 관련 선행 PR: 문서 철회 및 객체승인 무효화 **Draft PR #20**, 법률 모델 usage 이벤트 실패 **Draft PR #42**, 소스 CAS **Draft PR #40**. 새 수정은 이 PR들 위에 무리하게 병합하지 않음.

## A1-DOC-009 — 문서 재분류 후 하위 typed 채무 인정·계산 무효화

### 저장형식 격리 합성 입력
```json
{
  "pages":[{"documentId":"doc-syn","page":1,"role":"evidence"}],
  "facts":[{"id":"fact-v1","logicalId":"ledger-1","version":1,"state":"verified","recognition":"accepted","refs":[{"documentId":"doc-syn","page":1}]}],
  "debts":[{"id":"debt-syn","factIds":["fact-v1"],"recognition":"accepted","legalReview":"accepted"}],
  "workflowState":{"documentMatches":[{"documentId":"doc-syn","state":"accepted","version":1}]}
}
```
해당 데이터를 **실제 main `case-commands.ts` 148행의 `document.role` 코드 분기 본문**으로 실행했다. 외부 DB/API는 stub이고 페이지를 `administrative`로 변경했다.

| 검증 | 독립 기댓값 | 실제 V8 관찰 | 판정 |
| --- | --- | --- | --- |
| 페이지 역할 | administrative | administrative | 부분 합격 |
| 철회 후 현재 증빙 | 0행 | 0행 | 부분 합격 |
| 문서 매칭 | stale | stale | 부분 합격 |
| 연결 채무 `legalReview` | unreviewed | **accepted** | **기존 P0 결함 잔존** |
| 연결 채무 old `factIds` | 사용 대상에서 제거 | **fact-v1 유지** | **기존 P0 결함 잔존** |

이는 **3차 감사에서 발견된 동일 원천 승인 무효화 문제**이며 신규 이슈로 중복 집계하지 않는다. [Draft PR #20](https://github.com/firmengine/firmengine/pull/20)에서 이미 수정 제안 중이어서 본 회차에서 `case-commands.ts`를 재수정하지 않았다. 현재 main의 원본 코드 분기에서 결함이 재현된 것과 실제 SQL 계산/서식/법률 전반 영향을 운영에서 입증한 것은 구분한다.

## A1-LAW-013 — 승인된 법률 위험 근거계약이 95검토 배치에서 소실 (새 P1)

### 원본 코드 결함과 재현
`lib/pipeline.ts::reviewLegal` 550~554행은 `legalEvidenceCriterion(checkId,courtId,applicationDate)`에서 **approved 법률 원문 피처군/필수 계산 출력/승인상태** 세 속성을 구축한다. 그러나 557행 `batch.map`이 해당 3속성을 버리고, `buildLegalReviewPacket`과 `gateLegalReviewChecks`에 전달하지 않는다. 실제 main의 선택 분기 본문을 V8 격리 실행한 합성 `DOC-01` 승인 계약에서 세 속성 모두 소실됨을 확인.

**영향:** 이미 승인된 근거계약도 패킷에는 미연결·미확정처럼 전달되고, 해당 근거의 OCR/계산 필수 존재 검증이 누락된다. `gateLegalReviewChecks`는 미승인 상태를 `legal_review`로 **fail-closed** 처리하므로, 이것이 곧 법률 자동통과 또는 실제 제출을 허용했다고 보지는 않는다. 현재 95/95 위험이 `may_auto_clear=false`, seed 정책 `checks:[]`, 95 중 88건 `required_features` 미정의인 상태도 별도 독립 확인. 새 기준을 임의로 활성화하지 않았다.

### 수정·회귀 제안
**[Draft PR #46](https://github.com/firmengine/firmengine/pull/46)**, branch `audit/a1-r09-preserve-approved-evidence-routing-20261030`, 코드 commit `db18c238c8680a710cda46de7a326d56adac4616`.
- `lib/legal-review-risk-batch.ts` 추가: 변형 없이 완료 check/순서/상한을 유지하면서 피처군, 계산필수, evidence contract status를 패킷에 전달. 원본 배열 및 법률승인 자체는 변경하지 않음.
- `lib/pipeline.ts` 한 개 선택 표현식을 helper 호출로 교체.
- `tests/legal-review-risk-batch.test.ts` 5건 작성 (원본 프로젝트 Node 실행 **미실행**).
- **실제 V8 본문 테스트:** 변경된 GitHub helper 코드 5/5 기대 일치, 파이프라인 import·호출·catalog 속성 연결 1/1 일치, 실제 `gateLegalReviewChecks` 본문(유일한 TS `as` 캐스트 제거) 4/4 기대 일치. 승인된 근거 피처/필수 계산이 없으면 `missing`, unmapped/out-of-scope는 `legal_review`. **합계 10개 격리 경계 조건 합격**. 공식 법률판본·변호사 검수·CI 인증이 아님.
- 위험 변경이므로 **PR은 draft/missing CI** 유지. 기존 [PR #42](https://github.com/firmengine/firmengine/pull/42)도 `pipeline.ts` 변경 중이라 최신 main으로 재기반하고 양쪽 수정·테스트를 합쳐 검토 후 병합 필요.

## A1-DATA-014 — 18계산×91입력과 OCR/typed 선언 소스 매핑

GitHub 현재 JSON/TS 선언을 독립 JavaScript로 읽고 결합한 **정적 계약실행** 결과:

| 점검 | 실제 계산/관찰 |
| --- | --- |
| 계산 카탈로그 모듈 | **18** |
| 선언 입력 슬롯/중복 제거 고유 path | **91 / 78** |
| canonical OCR ID | **693개 전부 고유** |
| 기본 family | **48**, 기본 524필드, 서류별 확장 150필드, 공식 보강 19필드 |
| source→typed 명시적 바인딩 경로 | **47** (중복 없는 대상 typed path 32개) |
| 바인딩 원문 계약 누락 | **0** (기본 + 서류 확장 + `ocr-field-supplements.json` 같이 조인했을 때) |
| 입력 카테고리 | 직접 **21**, 유도·사람검토 **4**, 사건설정·검토 **33**, 객체 typed 미직접 연결 **18**, 법적 Fact 전용 **3**, 도구·의사결정 **12** = 91 |

처음 기본 패밀리 정의만 비교하면 `salary_statement::gross_total`, `salary_statement::total_deductions`, `debt_certificate::creditor_address`, `debt_certificate::claim_cause` 4개가 누락처럼 보인다. 모두 **`ocr-field-supplements.json`에 공식 등록**되어 있어 오탐을 제거했다. `income.payerIdentityId`, `debt.classification`, `asset.securedPayoffScope` 등의 미직접 바인딩은 **현행 표준 OCR 미직접 매핑**이지 근거 없이 0원으로 계산해도 된다는 의미가 아니다.

본 검사는 `db/schema.ts`가 존재함을 확인했으나, 실제 D1 insert → typed case read → 18개 엔진 계산 → 최종 D5103/D5110 반복행의 **종단 E2E는 미실행**. 따라서 [ ] 유지.

## 인증 층 및 후속 인수

- **실행:** 원본 `document.role` V8 실제 분기 5대조(3 기대 일치, 2 결함), 원본 `batch.map` V8 실제 결함 재현(3 속성 소실), 수정 함수·실제 법률 gate V8 **10/10**, 18×91 정적 source-catalog 조인 0 누락.
- **코드 적용:** main 운영 기능코드 변경 **없음**. 소규모 개선 3파일 Draft PR #46만 등록. 기존 Draft PR #20/#42와 중복 변경 방지.
- **미검증:** 최신 전체 Node 프로젝트 unit/tsc/lint/build/CI, staging Cloudflare D1/R2/Cron, 실제 85종 서류 분류·복수행·A←B+C 법률대체, 18산식 실제 입력 replay, LawGraph 95 전항 실행, 최종 Word/PDF 및 공식 양식·변호사 독립검수. 이 회차를 제품 RELEASE_READY라고 표시하지 않는다.
- **다음 역할:** IT/AX/계산사무장 순환. 후보 `A1-IT-013` (대량 원문·법률/계산 페이지네이션), `A1-AX-010` (모델·기준정보·원본 버전 고정), `A1-CALC-010` (0원/누락·음수 구분). 최신 main·열린 PR/본 영수증 확인 후 시작.
- **운영변경 없음:** 사이트 배포/운영 DB migration/실제 사건 변경/법원 제출/법적 인가·확정 수행하지 않음.
