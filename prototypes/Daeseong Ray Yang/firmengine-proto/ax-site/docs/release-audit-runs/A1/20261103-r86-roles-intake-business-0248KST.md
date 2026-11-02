# FirmEngine A1 — 86차 코드 완결성·상호 기능충돌 감사 (2026-11-03 KST)

- 작업 한정: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`; 축 A1만. 전회 85차 영수증/중앙 보드와 최근 커밋·PR을 먼저 조회했다. 금회 역할 순서 **IT담당자 → AX담당자 → 계산사무장**. 다음은 **사용자·서류담당자 → 변호사 → 데이터담당자**.
- 검증 시작 **main HEAD**: `5b722ac9c75d3456cd1ead5e853b3e0e2eaed1ec` (GitHub branches/main API 직접 확인). 최신 커밋은 A4 r86 보드 병합 `5b722ac`, A4 r86 영수증 `841ba438`, A3 r86 보드 `121d4679`; Draft #198 (A2), #197 (A1, 미병합), #196 (A4), 기존 #85/#55 (사업소득 독립 승인, 미병합) 확인.
- 실제 검토 소스·blob: `lib/app-roles.ts` `a716bc17109d9bff7ff88c89606a49949e75a1df`, `lib/case-command-store.ts` `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `lib/intake-classifier.ts` `3e07327750e0330baceee79dc5608758a862d3e2`, `lib/intake-classifier-response.ts` `1dd7a53412faae5207f97bf4409f21c504657e0a`, `lib/intake-engine.ts` `82ddba689ea6d107ba587235205feef45e058527`, `lib/business-monthly-workbench.ts` `0174f228473516e94664be445d8f46a33f833f80`, `lib/business-source-evidence.ts` `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`, `lib/business-net-reconciliation.ts` `60a4fc295943dce404a7f99efffe88f58dd2d4ff`.
- 기존 테스트 소스 읽기: `tests/app-roles.test.ts` `9d85dbe1c4d6fb222c263ac3f2f85cd5824f6ca1`, `tests/intake-classifier-response.test.ts` `9a3319e163b87d0f7588f8d52681d054075d987c`, `tests/business-monthly-workbench.test.ts` `f06c4b4dfd6694da07a9ac28dc558c6520ee2906`. 이번에 이 Node 테스트 파일을 직접 실행하지는 않았다.
- 실행 방식: GitHub 현재 main 파일을 재조회하여 해당 **실제 함수 본문**을 JavaScript V8 격리 환경에서 실행. 타입 선언·non-null assertion만 제한적으로 제거하고 입력 및 타 보조 함수/카탈로그는 합성으로 대체. **전체 TypeScript/Node/E2E/Cloudflare 환경 실행이 아니다.** 오류 수정 전 시험 결과는 무효 처리하고 수정 후 전체 재실행 수치만 사용.

## A1-IT-002 [ ] — 역할 범위/시효/철회 분리

- 독립 기대: 서로 다른 actor·role·case를 혼용하지 않음. 철회·장래 효력·만료는 불허하고, `scopeId="*"`로 명시 부여한 권한만 다른 사건에 적용한다. 법률 검수역을 role-admin으로 자동 승격하지 않는다.
- 실제 실행 입력: `roleGrantApplies` 원본의 활성 `staff-1 / caseworker_review / case-1` grant (`2026-10-01T00:00:00Z`, current `2026-11-03T00:00:00Z`); 14개 변형을 각각 투입했다.
- 기대/실제 일치 **14/14**: 동일사건 허용, 다른 사건/actor/role 거부, revoked/미래발효/만료시각 일치·경과 거부, 정확한 시작시각 허용, 명시 wildcard만 허용, 구체 grant의 wildcard 조회는 거부, reviewer→admin/owner→editor 무단 치환 거부.
- 교차 경로 정적 확인: `case-command-store`는 초기 `authorize`, 변경 직전 `rolesForActor`, `saveCase`에 조건부 `app_role_grants` SQL 권한 재검증을 전달. `db/schema.ts`는 actor/role/scope 복합 PK 선언. **실제 인증된 5역할 HTTP API, 세션·테넌트, D1 권한 철회 경쟁, 동일인 직원·변호사 독립 승인 전체는 미실행.** 따라서 인수 [ ] 유지.

## A1-AX-002 [ ] — 상담 분류의 출처·주체·미관찰 구분

- 독립 기대: AI가 없는 상담 내용을 사실로 생성하거나 원문이 없는 증언을 채택하지 않음. 실제 출처 span/주체/feature를 구조화하여 검증하고, 빈 모델 주장으로 임의 `absent`를 생성하지 않음. 역질문은 별도 결정적 `matchIntakeChecklist` 경로, 상담만으로 법률 인정 불가.
- 실제 실행: 원본 `adaptIntakeClassifierResponse` 함수 본문, 합성 `span:1/span:2`, 3-feature 경량 카탈로그. 검증 도우미는 원본 계약과 같은 정확 키/리스트/주체 정규식 정책을 사용한 대체.
- **14/14 기대 일치**: 출처가 있는 정상 claim 허용; claim 없는 응답/주체도 기록하지만 사실로 승격하지 않음; source span 누락·중복·외부 span 거부; 다른 주체 scope의 feature, 미등록 feature, 중복 주체, 참조 없는 claim, 사건 전체 주체의 임의 label, 잘못된 주체 ID, 허용되지 않은 root 필드 전부 거부. 반환한 sourceSpanCoverage 및 unreferencedSubjectIds 구조를 관찰.
- 교차 정적 확인: `intake-classifier.ts`는 exact span 목록/feature별 enum 출력 계약을 생성하며 `intake-engine.ts`는 상담 quote 대조 및 질문 도출을 별도 처리. **실제 모델 응답, 음성 전사, OCR 원본, 발화자/시간/신원 검증, 85서류 요구·재질문 E2E는 미실행.** 법률 판단 확정 0, 인수 [ ] 유지.

## A1-CALC-002 [ ] — 사업자 매출·원가·VAT·입금·승인소득 분리

- 독립 기대: 매출 총액/비용 행/비용합계/VAT/실입금/환입은 서로 다른 원천 피처. 동일 source record에서 검증된 수치로만 산술 미리보기를 허용하고, 모든 결과의 `legalNetApproved`는 false. `null`과 명시적 `0`을 분리, 범위 외 또는 원문 미검증 금액이 승인 소득으로 승격하지 않아야 한다.
- 원본 `assembleBusinessMonthEvidence` V8 격리 실행 **16/16 기대 일치**. 합성 2026-01 한 달: ① 빈 월 null, ② 매출 3,000,000원/독립 비용 1,000,000원은 미리보기 null, ③ 동일 source record는 산술 미리보기 2,000,000원(법적 순소득 아님), ④ VAT/입금만 있으면 매출 null, ⑤ 환입 존재시 산술보류, ⑥ 비용 2행의 sourceRecord 중복시 비용 합계 null, ⑦ 매출·비용 명시적 0은 미리보기 `"0"`, ⑧ 미인정 매출은 null, ⑨ 복수 매출 총액 null, ⑩ `1,000` 비정형 입력 null, ⑪ 입력 null, ⑫ 음수 raw 금액 null, ⑬ 기간 밖, ⑭ 월 미확인, ⑮ 비용 누락, ⑯ JS safe integer 초과 금액의 BigInt 정확 계산 (`9007199254740993 - 10 = 9007199254740983`). 모두 `legalNetApproved=false`.
- **검증 도구 교정 영수증:** 최초 TS→JS 축소 변환이 `!==`을 훼손해 11/14를 표시한 실행은 **도구 오류로 무효 처리**. `row.amountWon!(?!=)`에만 적용하도록 non-null assertion 제거 정규식을 고친 후 전체 16조건을 처음부터 다시 실행해 16/16 확인. 원본 상품 코드 버그로 기록하지 않음.
- 교차 정적 확인: `business-source-evidence`는 VAT·공급가·입금 등을 서로 다른 role로 저장하며 `business-net-reconciliation`은 source Fact/사업자 식별자/기간/정책 SHA 및 별도 제안·변호사 승인 객체 경로를 제공. **실제 월별 OCR→D1→소득 재산정, VAT/세무/법원 비용 인정, 승인 API와 공식 D5103/D5110 서식, 18개 계산 E2E 미실행.** 기존 제안·승인 동일인 검증 Draft #85/#55는 미병합. 인수 [ ] 유지.

## 결과와 다음 검증

- 독립 함수 V8 최종 실행 **총 44/44개 기대 일치** (IT 14, AX 14, CALC 16); 신규 확정 결함 **0건**. 기존 위험 경계는 불변, 제품 인수 통과로 승격한 ID **0개**. 새 코드 수정 **0**, 신규 PR **0**; 이번 main에 반영하는 것은 A1 영수증과 중앙 보드의 지정 ID 3개뿐이다.
- 상태값은 미관찰/null/0/비해당/상충/source-only/검토·승인전/법률 확정을 혼동하지 않는다. 고객 정보, 키, .env, 실제 OCR 원문이나 비공개 정답 사용 없음.
- 전체 Node 테스트, 타입체크·lint·build·CI, 브라우저, staging D1/R2/Cron, 실제 인증·동시사건, 85서류/갈음 A←B+C/C01-C02-C04/보정명령/18계산/95법률 종단, 변호사 승인/법원 공식 서식 검증 **미관찰**. 운영 배포·D1 운영 마이그레이션·전자제출·인가확정 **미실행**. Extra High 추론 모드 실제 설정 여부 **미확인**.
- 다음 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**. 다음 ID **A1-DOC-002 / A1-LAW-003 / A1-DATA-002** (모두 보드 [ ], 이전 51차 부분 이력 확인).
