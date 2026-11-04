# FirmEngine A1 120차 — 화면/API 선언·상담/OCR/법률 모델 라우팅·급여 관측 계산

- 기준일: 2026-11-04 KST (12:50 시작). **원본 검증 HEAD** `26ec611d3c9b2314a430a18e575f4511626c7554`. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 전회 119차 DOC/LAW/DATA 이후 **IT → AX → 계산사무장** 순환.
- 단일 인수 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, **A1-IT-001 / A1-AX-001 / A1-CALC-001** 모두 **[ ] 유지**. 119차 및 기존 62·66·88차 감사, 최근 main 커밋, 신규 Draft PR 목록, `db/schema.ts`, `tests/luna-boundary.test.ts`(`c3e73fc8`), `tests/calculation-audit.test.ts`(`7c0d177e`) 정적 열람.
- 검증 등급: GitHub main의 원본 TypeScript **선택 함수식**을 JS로 최소 치환한 V8 격리 실행 + 비식별 합성 입력 + **명시적 계산 helper stub**(원화 object → BigInt, `referenceFormula`, 최대 360개월) 및 일부 실제 기간/나눗셈 함수. Node 프로젝트 원본 테스트·실제 HTTP·브라우저·D1/R2·AI API/배포 실행 아님. 소스 SHA는 실행 직전 다시 확인. 실제 고객 데이터/비밀 키 포함 안 함.

## A1-IT-001 [ ] — 화면 링크·대표 API 선언 / 죽은 버튼은 아직 미검증
- `components/workspace.tsx` 원본 blob `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`. `routeFor(next)` 원문 ternary 식을 V8에 주입해 **3개 사건 상태 × 7개 Section = 21/21 기대 경로 일치**. case 없음: overview/documents/ledger/review/exports는 `/`, benchmark는 `/evaluation`, settings는 `/settings`; case `case-001`과 `c-UUID-2`: overview `/cases/:id`, documents `/cases/:id/documents`, ledger `/cases/:id/facts`, review `/cases/:id/review`, exports `/cases/:id/exports`, benchmark/settings는 공통 경로. 별도 `go(next)`는 case 없음일 때 작업화면 대신 사건 생성 modal을 여는 정적 조건 확인.
- 최신 HEAD의 Git tree 재귀 목록(1,889 entries, `truncated=false`)에서 대상 `app/` 페이지 **18개**, API route **36개** 파일 발견(참고용 `examples/d1` 하위 제외). nav 목적지 7개를 담당하는 page.tsx 파일은 경로별 정적 존재 확인. **실제 브라우저 클릭, 권한, 렌더링, Next 충돌 진단은 실행 안 함**.
- 대표 메서드 선언 정적 **9/9 존재**: workspace.GET, cases.POST, case.GET/PATCH, case.documents.POST, process.POST, export.POST, requirements.GET, workflow.GET. `app/api/cases/[id]/route.ts` blob `a8eedd2f`, process `e153bdb4`, documents `274f7a6e`; 파일·선언 존재는 성공 HTTP가 아님.
- 결과: **선택한 21개 라우팅식 전부 기대일치**, 전체 기능 버튼/REST 성공·실제 사이트·권한/DB·중복 동적 라우트/CI는 **미인증**.

## A1-AX-001 [ ] — 모델 선택 우선순위
- `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`: `OCR_MODEL=AI_MODEL="gpt-6.1-terra"`, `CONSULTATION_AI_MODEL="gpt-6-luna"`. `lib/luna.ts` blob `e8ad1246888e42087cf94ef792c8285cae2541d1`: 실제 `model=args.agent===...?` 우선순위 식을 V8 격리 **12/12 독립 기대 일치**.
- `consultation_classifier`(기본 또는 Terra 명시), `legal_review`, `legal_monitor_change_analysis`, `legal_checklist_reviewer`(Terra 명시 override 포함) → Luna. `document_classifier`, `document_classifier_recovery`, `evidence_extractor`, `source_verifier`, `targeted_rereader`, 알 수 없는 agent 기본값 → Terra. 명시 Luna override가 있는 임의 OCR agent는 Luna 유지(라우팅식 계약 그대로; 외부 호출자는 검토 별도).
- `lib/intake-store.ts` blob `c0bdea9443a018a46c080a8e39a74a0daf62759f`에서 consultation 전용 별칭 import 및 `callLuna(classifierRequest)` 경로 정적 확인. `lib/intake-classifier.ts`에서 상담 `reasoningEffort:"medium"`, `luna.ts` 기본값 `low` 확인. **모델 실 API 호출·환경 접근권한·사용량·Extra High 설정 미확인**. 설정 가능 effort 타입은 `low|medium`만 정의됨.
- 결과: **모델 선택식 12/12**, 실 서비스 호출 성공·OCR/법률 품질은 미인증.

## A1-CALC-001 [ ] — 급여 12개월/상여 관측/공제 분리
- `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`: 원본 `monthIndex`, `monthSpan`, `floorDivide`, `monthlyIncome` 실함수 본문 + 계산 의존성 합성 stub으로 **17/17 독립 기대 일치**.
- 합성 입력/기대→관찰: 월 순소득 2,000,000→2,000,000; 2025년 12개월 총 순소득 36,000,000/12→3,000,000; **이미 관측 순소득에 상여가 포함됐다는 가정** 총 39,000,000/12→3,250,000; 12개월 명시 분모 생략·날짜로 유추→3,000,000; gross 48,000,000-공제/비용 6,000,000 /12→3,500,000; 월 2,500,000-400,000→2,100,000; gross/net 상충→null+`INCOME_NET_GROSS_EXPENSE_CONFLICT`; 명시 0→0; 미관찰 항목→null+`INCOME_AMOUNT_OR_EXPENSES_MISSING`; 음수 월소득→null+`INCOME_NET_NEGATIVE_REQUIRES_REVIEW`; 기간 12개월 vs 분모11→null+`INCOME_PERIOD_DENOMINATOR_CONFLICT`; 1~15일 부분월→null+`INCOME_PERIOD_NOT_COMPLETE_CALENDAR_MONTHS`; 2월30일 잘못된 날짜→null+기간 미완료; 분모 미관찰/0/361→null+`INCOME_PERIOD_DENOMINATOR_MISSING` (각 1건); VAT 매출 source-only 역할이 net값을 갖더라도→null+`INCOME_VAT_TURNOVER_NOT_NET_INCOME`.
- 주의: 금액 파싱은 테스트 범위를 한정하려고 명시적인 synthetic `{amountWon:"..." }`만 stub으로 허용함. 실제 `domain.moneyValue` 전체 계약, 상여의 별도 Fact 자동 합산, 원천징수/4대보험 공제의 법적 인정, 12개월 급여 PDF→OCR→typed→18계산→95법률→공식 서식 E2E **검증하지 않음**.
- 결과: **선택 17개 계산 분기 모두 기대일치**, 공식/법률상 확정값 승인 아님.

## 회차 결론·코드 조치·다음
- 격리 V8 **IT 21/21, AX 12/12, CALC 17/17**. 대표 API 선언 **9/9 정적 존재**, 18 UI pages/36 API route 파일 개수 확인. 이 숫자는 **서로 다른 검증 단위를 섞어 제품 통과율로 표시하지 않음**.
- 세 ID는 모두 **[ ] 인수 미완료**. 선택 범위에서는 신규 코드 결함이 재현되지 않았으며, 다른 에이전트가 변경하는 제품 코드·열린 Draft PR을 덮어쓰지 않아 **제품 소스 수정 없음**. 문서 영수증과 중앙 보드 해당 세 ID만 보존 병합.
- 다음 역할: **사용자·서류담당자 → 변호사 → 데이터담당자**. 다음 제안 ID: **A1-DOC-010 / A1-LAW-011 / A1-DATA-010** (실제 다음 회차 시작 시 최신 보드 재확인).
- 전체 Node/TypeScript/lint/build/CI·브라우저·staging D1/R2/Cron·85서류/18계산/95법률 종단 실행·공식 서식/실무자·변호사 승인·현재 사이트 배포 **0건 인증**. 운영 배포·운영 D1 마이그레이션·법원 전자제출·인가 확정 실행하지 않음. Extra High 실제 설정 여부 확인 불가.
