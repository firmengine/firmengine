# FirmEngine A1 — 88차 코드 완결성·상호 기능충돌 감사 (2026-11-03 KST)

- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 다른 에이전트의 파일은 덮어쓰지 않는다.
- **시작 main HEAD**: `c8c5e4c960997f28801d47f51e820987f7779500`; 신규 코드 PR 분기 전 확인된 main HEAD `8c7118f6dbf014eaadbf36e36dd1d3cc1b6ca681`. 이 영수증을 작성하기 전 87차 영수증, 중앙 보드, 최근 커밋/PR, 실제 소스, DB schema, 기존 Node 테스트와 Draft PR #17/#37을 읽었다. 모든 SHA는 검사 당시의 관찰값이다.
- 역할 순서: **IT담당자 → AX담당자 → 계산사무장**. 체크 ID: **A1-IT-001, A1-AX-014, A1-CALC-012**. 셋 모두 `[ ]` 미완료.
- 사용 자료는 **합성 사건 fixture**만. 실제 고객/원본 OCR 사실값/.env/키/비공개 정답은 조회·커밋하지 않았다.

## A1-IT-001 [ ] — UI·API 도달성, 중복·죽은 라우트

- 소스 `components/workspace.tsx` main blob `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`.
- **실행**: 실제 `routeFor` 함수에서 TS 매개변수 주석만 제거해 V8 평가. 합성 사건 ID `fixture-123`을 입력했고 7개 목적지와 독립 기대 URL을 대조: `overview`→`/cases/fixture-123`, `documents`→`/cases/fixture-123/documents`, `ledger`→`/cases/fixture-123/facts`, `review`→`/cases/fixture-123/review`, `exports`→`/cases/fixture-123/exports`, `benchmark`→`/evaluation`, `settings`→`/settings`; **7/7 일치**. 사건 미선택에서 사건전용 tab은 `/`, benchmark/settings는 해당 상위 라우트를 반환.
- **실제 파일 조회**: 각 라우트 page 및 별도 참조정보/데이터/상담/업무흐름/업무대시보드/역할 화면과 대표 API 3개 등 **17/17 경로의 현재 main 파일 존재**. 이는 HTTP 성공, React 렌더, 버튼 클릭, API 인증, D1, 죽은 버튼 전수 검증이 아니다.
- 관련 snapshot: `app/cases/[id]/page.tsx` `4657a13a`, `app/cases/[id]/facts/page.tsx` `9e69acda`, `app/api/cases/[id]/process/route.ts` `e153bdb4` (SHA는 짧은 표시이며 원본 조회 결과에 기반).

## A1-AX-014 [ ] — 미확정 계산상태의 자동 초안 게이트 및 CAS

- main `lib/case-lawgraph-store.ts` blob `eea435bb78f804c79a213c464af54e8014a3c3a5`, 실제 `automatedDraftEligibility` 함수 V8 실행. `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`의 저장 status union 및 `lib/case-legal-automation.ts` blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`의 SQL `calculationFields` 전달 경로를 교차 확인.
- 합성 조건: 완성된 단일 `R1` legal check, 최신 계산 헤드, 엔진 draft gate true, 필수 `monthlyIncomeWon` 하나. 독립 기대: 명시적 정수 문자열 `"0"`과 `provisional`은 **내부 검토초안에 한해** 허용; `not_applicable`, 알 수 없는/누락 상태, `blocked/missing/conflict`, `null`, 비수치·비유한 값은 초안 후보 차단; `legal_review` 초안의 `canFinalize=false` 유지.
- **실제 V8 15조건**: main **8/15** 기대 일치. 불일치 7조건은 `not_applicable` 값 `"0"`, 알 수 없는/누락 status, 숫자 `NaN`/`Infinity`/`0`, 비수치 문자열 `"abc"`를 `eligible=true`로 허용한 경우다. 계산 store의 JSON 직렬화 과정에서 비유한 숫자가 `null`이 될 수 있으므로 해당 사례는 **직접 게이트 함수 입력 경계** 검증으로 제한하며 운영 DB 재현을 주장하지 않는다.
- 수정안: 필수 status를 `computed|provisional`로 제한, `*Won` 필수값은 정수 문자열 형식을 검사하며 `not_met` 경고, 0, 음수, 초안용 `legal_review`, 최종 인가 불가 의미 보존. [Draft PR #202](https://github.com/firmengine/firmengine/pull/202) 새 별도 브랜치 `audit/a1-r88-draft-calculation-status-20261103`, PR HEAD `f3418933456580cf3789f43067571ea2c5dccdf1`; 수정 blob `b358a73f64168004893bcbe40f2876ab81307d1e`, 신규 합성 Node 회귀 테스트 blob `5f967b14f31bb1682ae21f0b29dd71a35a944626`.
- **커밋된 PR 소스를 GitHub에서 다시 읽어 V8 15/15 독립 기대 일치**; `legal_review`은 draft eligible여도 `canFinalize=false`·`courtApprovalInferred=false`, stale head 및 사람 검토 허용 해제 차단 3조건 추가 확인. **PR 내 Node 테스트 파일은 작성만 했고 실제 Node test/tsc/lint/build/CI는 실행하지 않았다.**
- 다른 축: `lib/automatic-review-draft.ts` main blob `5ee8860250303ac9ca513b0be22e886f98c8e904`에서 마지막 manifest UPDATE가 현재 case/source/job lease를 직접 재검증하지 않는 기존 P1 경계 확인. 기존 [Draft PR #17](https://github.com/firmengine/firmengine/pull/17) 미병합; CAS 대응은 새 #202와 **별도**이며 이번 회차 SQL SQLite/D1을 재실행하지 않았다. 두 PR을 독립 통합 검증하기 전 전체 A1-AX-014 인수 금지.

## A1-CALC-012 [ ] — 36/48/60개월·납부일·0/null 분리

- main `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`; `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`.
- **실행**: 실제 두 소스 함수에서 TS 타입만 제한적으로 제거해 V8 호출. 합성 채권 1개/회생위원 보수 0원/월 원금 1원/월 예산 1원/사건 revision 1. 날짜 시작 `2026-01-31` vs 미관찰 `null`, reviewed true/false, 36/48/60개월, 명시 0원 케이스 **8조건 실행**.
- 날짜가 존재하는 36·48·60개월은 원금행+보수행 각각 **72/96/120행**, 첫 `2026-01-31`, 마지막 각각 `2028-12-31`/`2029-12-31`/`2030-12-31`, main `complete/reconciled` 관찰(기대 일치). **reviewed=true인데 모든 회차 납부일 null인 36·48·60개월**에서도 main은 `complete/reconciled` (각각 독립 기대 `blocked`와 불일치). `reviewed=false` + null은 원장 `provisional`로 구별되지만 정합 함수 `reconciled`는 산술 결과만 뜻한다. 날짜 있는 0원은 0과 미관찰을 구분.
- 기존 [Draft PR #37](https://github.com/firmengine/firmengine/pull/37) `lib/plan-reconciliation.ts` blob `153aa741124344ffecc6d5db38130415aada9bfb`를 GitHub에서 직접 가져와 **6조건(36/48/60개월×날짜 있음/없음) V8 6/6**. reviewed+null은 `REVIEWED_PAYMENT_DATE_MISSING:n`으로 `blocked`, 날짜 있는 경우 `reconciled` 유지. PR 미병합이고 공인 법원 양식/납입기일 승인 아님. 별도 코드 중복 수정 없음.
- 실제 특례 회차, 18+18 분할과 관할별 납부일·D5110 출력, 저장 DB/공식 서식까지의 종단 검증은 하지 않았다.

## 최종 판정·인수 보류

- **새 P1 검토 후보**: 자동초안 필수 계산 필드 status/`Won` 형식 검증 누락 — Draft PR #202 생성, **main에는 제품 코드 미반영**. 기존 **P1**: 자동초안 완료 CAS (#17), 승인된 계획 납부일 누락 (#37)은 여전히 열린 미병합 경계.
- 통합 시점에 미관찰/null/명시적 0/비해당/상충/source-only/검토 전 상태를 구분한다. synthetic 격리/정적 파일 존재/별도 PR 함수통과와 전체 Node CI·staging D1/R2/Cron·공식서식·변호사 승인·사이트 배포는 서로 동등하지 않다.
- **이번 회차 인수 완료 ID 0건**, 세 ID 모두 `[ ]`. 실 고객정보/키/원본 OCR 비공개값 없이 수행. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 없음. Extra High 추론 모드 실제 설정 여부는 확인되지 않음.
- **다음 역할/ID**: 사용자·서류담당자 → 변호사 → 데이터담당자, **A1-DOC-003 / A1-LAW-004 / A1-DATA-003**. 추가 상담 시 요구서류 재산출, 담보·우선권 채권 분기, OCR 원본 값의 0/null/미관찰·상충 보존을 기존 영수증과 연속 검증.
