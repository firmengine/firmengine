# FirmEngine A1 67차 — 발급일·기간, 청산가치 법률 표시, 원화 단위 및 쉼표 검증

- 일자: **2026-11-02 KST**. 직전 66차 IT/AX/계산사무장 → 이번 **서류담당자 / 변호사 / 데이터담당자** 순환.
- 범위: GitHub `firmengine/firmengine`의 `main`, 변경 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만. 착수 시 `main` **`fe111fa26140b715b913f9a24bd5069a3918eb58`**; 영수증 작성 전 `main` **`fe111fa26140b715b913f9a24bd5069a3918eb58`**.
- 보드 ID **A1-DOC-010 / A1-LAW-011 / A1-DATA-010**만. 선행 66차 감사 영수증, 이전 29/37/31차 관찰, 최근 main 커밋/PR, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 실제 코드, 기존 Draft 테스트를 읽음.
- 테스트는 GitHub에서 가져온 **실제 소스 표현식/함수의 타입 표시만 제거한 V8 격리 실행**이다. 의존 DB와 일부 함수는 명시적 비식별 합성 stub. Node 프로젝트 테스트, TypeScript, CI, HTTP/브라우저, staging D1/R2/Cron, OCR 모델, Word·공식 법원서식·변호사 검수·운영 배포를 실행했다고 주장하지 않는다.

## A1-DOC-010 — 발급일/발생기간/신청일은 서류 유형 일치와 다름

- `lib/case-requirement-monitor.ts` **blob `5dfacd3a7738358fb27b95016d0e63bd93c8bb1b`**에서 `requirements.map` 실제 블록을 V8 격리 실행. `lib/case-document-requirement-store.ts` **`a670cb4e6a38aa6e782e898b5ed30aad80619c6d`**는 요구기간을 문자열로 보존; `lib/domain.ts` **`39ab41856f6d7a379aca7217d24b28f7f5f7616a`**의 `EvidenceDocument`는 id/hash/pages/status/uploadedAt를 가지나 typed 발급일·내용기준일 없음.
- 독립 기대는 **분류/OCR 후보와 제출서류 사실관계 인정 분리**, 즉 매 조건 `subjectAndPeriodVerified=false`, `requirementFulfilledInferred=false`이다.
- 합성 입력 8개: 미분류 → `no_classified_candidate`; 분류만 → `document_type_candidate`; 같은 유형 OCR head → `ocr_committed_candidate`; 주체 불일치·신청일 이후 발급·대상기간 불일치라도 유형/OCR 후보만 표기; 동일 페이지 문서유형 충돌 → 미분류 후보; 비활성 문서 제외. **8/8 조건 예상한 후보단계·승격금지와 일치**.
- 발급일·실제 발생기간·신청일 대조는 *입력 컬럼과 판정 정책이 이 블록에 존재하지 않아 실행 자체가 불가*. 이상 날짜를 합성 메타데이터로 넣어도 이 블록은 **소비하지 않는다**. 따라서 **날짜 적법/유효성 검사는 미구현 또는 별도 경로 미관찰**이며 통과 아님. 특정 관할의 허용일수 임의 하드코딩 금지. **[ ] 유지**.

## A1-LAW-011 — 숫자 비교와 법률 finding/사람검토 분리

- `lib/assessment.ts` **main blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`**의 `liquidationComparison`/trace 생성 원본문과 `add("liquidation")` 판정 블록을 V8 실행. 별도 기존 [Draft PR #82](https://github.com/firmengine/firmengine/pull/82) **blob `e6dd3ae3427d184bc59dec051caa4ed8b88a3ae7`**와 대조.
- 11개 독립 기대: 현재가치 **120원**, 청산가치 **100원**이고 PV/자산평가 검토완료 → 숫자 `met`, trace `calculated`, finding `pass`; PV 미검토/자산기준 미검토/두 검토 모두 미완료/개별 자산 trace `provisional`이면 숫자만 `met`, finding `review_required`가 독립 기대. `80<100` 검토완료 `fail`, PV 미검토 시 미승인 `review_required`; null 값/자산 기준일 상충은 `unknown`, 명시 0/0도 숫자 비교로만 판단.
- **main 6/11** 독립 기대 일치. 5조건에서 사전검토 미완료임에도 `pass`/ `fail` finding 표시. **PR #82 수정안 11/11**. 기존 P2 재현이며 신규 집계하지 않음. `calculation.ordinaryRepaymentBudgetWon`과 `disposableIncomeWon`은 별도 산식·개념; 산식 존재만으로 수행가능성·가용소득 전액·법원 인가 승인 입증 안 됨. 실제 `assessCase` 전체·법원 정책/인정·서식은 미검증. **[ ] 유지**.

## A1-DATA-010 — 단위 오류 및 신규 P2 쉼표 그룹 정규화

- `lib/domain.ts` main blob **`39ab41856f6d7a379aca7217d24b28f7f5f7616a`**의 `normalizeMoney`/ `moneyValue` 실제 본문을 V8 실행. 18개 독립 원화/천원/만원·null/0/외화·숫자구분자 합성 조건 **main 12/18** 일치.
- 기존 [Draft PR #86](https://github.com/firmengine/firmengine/pull/86) **`4847da1410d09191558b40e6e4c5d9d7d8db5e4e`**는 `250원`+천원, `250 KRW`+만원, `0원`+천원 원문·단위 불일치 3조건만 해결해 같은 18조건 **15/18**. 재검증 중 **신규 P2 후보**: `1,00`→정확한 100원, `1,,000`→정확한 1,000원, `12,34,567`→정확한 1,234,567원으로 잘못 승격. 기존 [Draft #60](https://github.com/firmengine/firmengine/pull/60)은 OCR source gate, [#53](https://github.com/firmengine/firmengine/pull/53)은 최종 preflight를 보호하나 **공통 정규화 함수 자체의 모든 호출을 고치지는 않음**.
- 보수적인 공통 parser 수정과 합성 회귀 테스트는 신규 **[Draft PR #159](https://github.com/firmengine/firmengine/pull/159)**에만 저장. 브랜치 `audit/a1-r67-normalize-grouping-20261102-0647`, HEAD **`5e6612ede582b863d171a6174f10c335432c00fa`**. 수정 `lib/domain.ts` blob **`cf3474f5d8e1567e8597d23015dbd7272e9e4319`**, 추가 `tests/a1-r67-money-grouping-normalize.test.ts` blob **`d2f31ce921d7500f833b4b0b098eb1454eba1ebd`**. 유효 쉼표 그룹·BigInt 원화·fractional scaled·null·0·외화 정책은 그대로 두고 잘못된 원문 그룹만 `invalid`.
- 수정 전 후보 함수 V8 **21/21** 독립 기대 일치. 저장된 PR #159 소스 재조회 후 공통 18조건 **15/18**; 남은 3개는 PR #86의 명시 단위 충돌. PR #86 단독도 **15/18**. 두 수정 가드를 **메모리에서만 합친** 결합 실험 **18/18**(커밋/병합 테스트 아님). 기존 Node 회귀 3블록은 **작성·커밋, Node 미실행**. 같은 공유 함수 충돌/과거 데이터 재계산 변화가 가능하므로 회계·데이터 담당자 리뷰 및 통합 CI/스테이징 전 **Draft·미병합**, main 실행코드 불변. 부가세/외화 자동환산·법적 인정은 전혀 하지 않음. **[ ] 유지**.

## 상태 및 다음 회차

- A1-DOC-010, A1-LAW-011, A1-DATA-010 **3개 전부 [ ] 미완료**. 신규 **P2 후보 1건 / Draft PR #159 1건**. 기존 P2 청산가치 및 기존 P1 단위 충돌 재확인, 중복 집계 없음.
- 종단 상담→85서류→OCR→Fact→18계산→95법률→초안/직원/변호사→법원 보정, 실제 API/DB/역할 전환, C01/C02/C04, 갈음 A←B+C, 동시 사건은 이번 회차 **미실행·미인수**. 전체 제품 인수 완료 **0건**.
- 다음 순환은 **IT / AX / 계산사무장**, 다음 미완료 ID **A1-IT-009**(D1 성공/R2 실패 응답), **A1-AX-004**(JSON Schema·빈 결과·툴 실패), **A1-CALC-002**(사업매출/VAT/경비/입금/승인 순소득).
- 실제 Extra High 추론 모드는 제어/확인 불가. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 **일절 수행하지 않음**. 공개 Git에 실제 고객문서/개인정보/원본 OCR/비공개 정답/.env·키 없음.
