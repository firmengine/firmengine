# FirmEngine AX A1 44차 — 계산 run 페이지 고정 · OCR 공동 anchor 경쟁 · 재산 분기

- 관찰일 2026-11-01 KST. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하. 역할은 직전 43차 DOC/LAW/DATA에서 **IT/AX/CALC**로 순환.
- 최초 main HEAD `e29b47c037b01c6b7380d8d4d05120ce832f9dcd` (최근 A4 r43 기록 이후). 기존 통합 인수 보드 + 43차 A1 영수증 + 이전 10차/26차 영수증, PR #49/#77, 최신 코드/스키마/테스트 정의 확인. 보드의 실제 A1-IT-013은 **페이지네이션**, A1-AX-009는 **OCR 복수행**, A1-CALC-008은 **재산 종류/면제**다. 직전 43차의 다음 회차 괄호 설명 중 동시사건/95법률/보증채무는 이 세 ID의 정의와 상이하므로 이번 회차는 **ID 본문 우선**.
- **검증방법:** GitHub에서 읽은 해당 실제 TS 함수 본문을 타입 표기/비null 단언만 제거해 V8 격리 실행. 계산 피처는 합성 D1 adapter, OCR은 합성 JSON 및 JSON 왕복 clone, 재산은 합성 exact KRW money adapter 사용. 일부 OCR helper는 원본과 동일한 의미로 JS 주입. 테스트 점수는 합성 조건 기대일치 수이며 앱 전체 통과율이 아님. 실제 HTTP·D1/R2·OCR·고객파일·법원양식·사람승인 없음.

## A1-IT-013 [ ] — 계산 결과 페이지 경계
- main `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; [기존 Draft PR #49](https://github.com/firmengine/firmengine/pull/49) branch blob `429295821f171de76a4a1133df73fd2cf384c23c`. 근거 스키마는 이전 10차 영수증에 기록된 `case_calculation_heads` / `case_calculation_features` / `case_data_change_state`.
- 합성 사건 `synthetic-001`, revision 3 / dataVersion 8 / initial head A. 독립 기대/원본 main/PR #49 실제 함수 격리 결과:
  1. 안정된 run A → OK:A / OK:A / OK:A.
  2. feature rows 읽는 중 A→B head 전환(사건 revision/dataVersion 불변) → VERSION_MISMATCH / **main OK:A** / PR 오류.
  3. expectedRunId=A token인데 current B → VERSION_MISMATCH / **main OK:B** / PR 오류.
  4. source expectedDataVersion 7 vs current 8 → 오류 / 오류 / 오류.
  5. 다른 사건 synthetic-002 조회 → CASE_NOT_FOUND / 오류 / 오류.
- **main 3/5, Draft #49 5/5**. 구 run 혼합 가능성 재현·기존 후보 재확인, 신규 PR 없음. OCR 2,200행·계산 5,001행 실제 페이지 API/Node/D1/브라우저는 미실행.

## A1-AX-009 [ ] — 복수행 OCR anchor 양방향 유일성
- main `lib/extraction.ts` blob `75931aad3fc7871395e62276bb5533e24b15d1a5`. 기존 [Draft #77](https://github.com/firmengine/firmengine/pull/77) blob `1a7c52f179442ad739526567854f86dbd0fbb605`.
- **신규 P1 후보:** 기준 거래 A/B가 각 `account_id=SHARED`, 확인된 금액은 각각 100/200. 재판독에는 동일 계좌의 거래 1행만 있고 amount/date가 누락된 합성 상황. 기존 main 및 PR #77은 `complete=false`라는 경고는 남기지만 **A의 금액 100을 원천을 특정할 수 없는 새 행에 삽입**한다. 날짜가 서로 다른 A/B에서 재판독 날짜를 없앤 경우도 동일. 두 금액은 synthetic-only이며 원본 OCR 사실값이 아님.
- 독립 6조건: (1) 공동계좌 2→1행, (2) 공동계좌 날짜 빠짐, (3) 공동계좌 고유 날짜 각각 일치, (4) 서로 다른 계좌 순서 뒤집힘, (5) 단독 고유계좌, (6) anchor 없는 단일행. 기대는 (1)(2)(6) 후보 금액 복원 금지/partial, (3)(4)(5) 고유행 금액 원위치 복원.
- **main 3/6, 기존 #77 4/6, 신규 Draft PR #112 단독 5/6, #77 후보+신규 guard 합성 결합 6/6**. #112 HEAD `b1ccee915308ac8df05122891d342c833d12dca3`, 수정 `lib/extraction.ts` blob `8fa59a8e7eab45131de2a8bf2d5d4d207ea544b1`, 신규 합성 회귀 `tests/ocr-omission-competing-anchor.test.ts` blob `6a664c8d4c46bd917b2d26dba2e304fda1102b84`.
- 조치: match된 reread 행이 **다른 baseline 행과 동등 이상 verified anchor 점수로도 연결되는 경우** 이전 값 이식을 거절. 이후 당사자 수기 원문대조가 필요하므로 `complete=false`. #77이 기존 무식별 단일행의 별도 결함을 고치는 중이므로 중복 패치하지 않고 별도 Draft로 격리. 관련 동일 인접 코드 병합 충돌은 사람 통합 검토 대상으로 둔다.
- 실제 저장된 PR #112 함수 재조회/V8 재실행 **5/6**, 작성된 4개 Node 회귀 테스트는 **미실행**. CI / 대량 원본 / 운영 OCR 재판독 E2E 미검증, 별도 Fact 자동승인 없음.

## A1-CALC-008 [ ] — 재산 분기·계산 위험
- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `lib/asset-resolution.ts` blob `ffda6d7684a8d34f228a568d090602bfcdd89cbf`; `lib/domain.ts` Asset 스키마 blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`.
- 실제 `liquidationContribution` 함수 본문에서 9개 합성 조건 V8 구동: 임차보증금 평가1000-담보300-비용100 → 600; 보험 해약500-면제200 →300; 퇴직1000-면제500→500; 면제 `null` → blocked/missing; 공유지분 담보귀속 불명→null; 공유지분 담보 source 미연결→null; 근거는 연결됐지만 승인 전→300/REVIEW_REQUIRED; 담보1500>평가1000 →0/SHORTFALL_REQUIRES_CLASSIFICATION; 기준일 없음→null. **9/9 관측 일치**. 숫자는 기능 검증용 synthetic 금액이며 법원 인정/면제 승인값이 아니다. 0과 null과 provisional은 각각 구별해야 한다.
- **추가 source-only 검토 후보:** `assessment.ts`의 자산 trace status 문은 `COLLATERAL_SHORTFALL_REQUIRES_CLASSIFICATION`을 명시적 provisional 이유에 포함하지 않는다. 기초 asset 인식이 accepted이고 다른 lineage/기간 차단이 없으면 산술 `0`과 `calculated`가 함께 표시될 가능성이 있다. 이는 전체 사건 계산/최종 서식에서 재현된 문제가 아니며, 담보초과가 법률상 어떤 처리·승인조건인지 실무판정 전 산식/상태 의미를 임의로 수정하지 않음.
- 재산 종류/면제 독립 구조의 실제 UI·D1·공식 D5101/변호사 검증 미실행. **계산 결과·법률 인정값 동일시 금지**.

## 정리/후속 인수
- 새 코드 조치 **Draft #112 (2파일 모두 ax-site 내부)**; 신규 실운영 코드 main 반영 **0**. main은 영수증/보드만 갱신.
- 세 체크 모두 **[ ] 미완료**, 제품 전구간(상담→85서류→OCR→정규화→18계산→95법률→문안→보정) E2E **0건**. 85서류/갈음 A←B+C/C01-C02-C04/동시 사건은 이번 회차 미관찰.
- 다음 역할 **서류담당자/변호사/데이터담당자**. 추천 미검증 축 ID **A1-DOC-011**(갈음서류 A←B+C), **A1-LAW-013**(95법률 근거계약 전파), **A1-DATA-013**(대량 OCR/계산 조회 경계). 시작할 때 최신 보드 ID와 이전 영수증/PR 다시 대조.
- 실제 Extra High 설정 불명. 전체 Node/CI/빌드·staging D1/R2/Cron·공식서식/변호사 승인/사이트 배포 **인수하지 않음**. 운영 배포/DB운영마이그레이션/실제 전자제출/법원인가 **수행 안 함**. 비공개 OCR 정답·고객정보·키/.env 공개 Git 적재 없음.
