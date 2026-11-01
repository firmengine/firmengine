# FirmEngine A1 68차 — Export commit 경계 · 구조화 응답 nullable · 사업소득 월 원천

- 일시: 2026-11-02 KST. 역할 순환: 직전 67차 서류담당자/변호사/데이터담당자 → 이번 **IT담당자 / AX담당자 / 계산사무장**.
- 범위: `firmengine/firmengine` main, 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하. 시작 `main` **`d299ba60d2a3fa99d9708e52cf3da4463082df09`**. 최근 A3/A2 보드·영수증 커밋과 미병합 PR #24/#89/#159/#160 확인. 보드 최초 blob `ba70b4b0b1d549eb0482c6d3152c598c029cd364`; 쓰기 전 변경이 계속 일어나므로 현재 blob 재조회와 ID 보존 병합 필요.
- 원문 소스: `lib/export-artifact-transaction.ts` blob **`a114235e5b5de57b5ae58b41026f939ee8543174`**, `lib/luna.ts` **`e8ad1246888e42087cf94ef792c8285cae2541d1`**, `lib/business-monthly-workbench.ts` **`0174f228473516e94664be445d8f46a33f833f80`**, `lib/business-net-reconciliation.ts` **`60a4fc295943dce404a7f99efffe88f58dd2d4ff`**, `lib/business-income-policy.ts` **`dd50ed441b5569248b64b89d3d5a683de244262a`**, `db/schema.ts` **`933f8686845ac14669312dd21bf85e02c62ed5e6`**. 기존 32/42차 A1 영수증·테스트(`luna-boundary`, `business-monthly-workbench`, `structured-model-json`) 열람.
- **검증 층위**: GitHub에서 실제로 가져온 원본 함수의 *TypeScript 타입 선언 부분만 제거한 JavaScript*를 이 회차 V8에서 실행, 외부 fetch/R2/D1/입력 데이터는 모두 합성. 실제 프로젝트 Node/test/TypeScript/CI, Cloudflare D1·R2·Cron, HTTP/브라우저, OpenAI API, 실제 OCR·공식 양식·전문가 검수는 **미실행**. 출처만 본 코드와 격리 실행한 코드를 혼동하지 않음.

## A1-IT-009 — D1/R2 부분 실패의 성공 오표시 방지
- 실제 `commitExportArtifactTransaction` 및 `assertUniqueInvocationTargets`/정리 블록 V8 실행. 합성 artifact 두 개(a,b), SQL record, R2 object, manifest를 각각 가상 Set으로 모사. 독립 기대: R2 첫/둘째 실패 또는 SQL/manifest precommit 실패 시 성공 반환 없음·SQL/R2/manifest 0; 정상 시 각각 잔존; commit **성공 후 ACK만 유실**한 경우 이미 참조된 SQL/R2는 보존; 사후 감사 실패는 산출물을 삭제해서는 안 됨; 중복 object key는 저장 전 차단.
- **8경로 중 7/8 기대일치.** 정상·R2 1/2 실패·SQL 실패·manifest precommit 실패·사후 감사 실패·동일 key 거절은 기대일치. **기존 P0 재현:** manifest가 1건 커밋된 뒤 `commitManifest`가 ACK-loss 오류를 반환하면 `manifest=1`이지만 SQL/R2 객체는 모두 0으로 삭제됐다(독립 기대 manifest=1, SQL/R2=1). 기존 [Draft #24](https://github.com/firmengine/firmengine/pull/24)·[#61](https://github.com/firmengine/firmengine/pull/61) 미병합. 새로운 확정 오류로 중복 집계하지 않음.
- 추가 관찰: `afterCommit` 예외는 삭제 없이 오류로 전파(응답/재시도 UX는 별도 검증 대상). 실제 D1/R2 동시 성공/응답 유실 장애 주입·운영 데이터 없음. **[ ] 유지**.

## A1-AX-004 — JSON 문법 통과 / Schema 위반 / 명시적 null
- 현재 main `callLuna` 원본문을 V8 합성 fetch로 실행. 엄격한 object 스키마(required `ok:boolean`, 추가 키 금지), 정상/필드 누락/배열/명시적 null/빈 객체/invalid JSON/incomplete/refusal/tool-call only/429/500 **11경로 중 7/11** 독립 기대일치. **기존 P1 재현:** `{wrong:"value"}`, `[]`, `null`, `{}`를 JSON.parse만 통과시켜 반환(차단 기대 502). 실제 API 호출 0회, 합성 fetch 호출만 각 1회.
- 기존 [Draft #89](https://github.com/firmengine/firmengine/pull/89)에는 요청 스키마와 파싱 응답을 대조하는 검증기가 추가돼 있음. 해당 브랜치 `lib/structured-model-json.ts` blob **`86db6088697274866262ef4291d0f10c5701306f`**의 실제 함수를 격리 실행한 결과, **신규 P2 통합 후보:** 명시적 `type:["object","null"]`+properties/required인 정상 null, `type:["array","null"]`+items인 정상 null을 잘못 거절. 14 합성 시나리오에서 기존 Draft **12/14** 기대일치. 이 결함은 아직 **main에 미병합된 PR #89 후보 코드**에서 발견된 것으로 현재 main의 새 결함으로 집계하지 않음.
- 다른 에이전트 PR #89 파일은 직접 변경하지 않고, 그 정확한 HEAD **`a3dac3178d92f278ef827e9d330de141cee87dfe`**에서 분리한 **[stacked Draft PR #162](https://github.com/firmengine/firmengine/pull/162)** (base=#89 branch, head=`audit/a1-r68-nullable-json-guard-20261102-0748`)를 생성. `lib/structured-model-json.ts` 후보 blob **`813a6bc9970dd13404126248a8109ba54636820a`**, 새 합성 회귀 `tests/a1-r68-nullable-schema-guard.test.ts` blob **`584a94f6a5dd598b3f2794a948de08736433e49d`**. null 타입이 **명시된 경우에만** 객체·배열 전용 키워드를 skip, 그 외 fail-closed 유지. 수정 원문 V8 **14/14**, 추가 독립 12/12. Node 테스트 파일 **작성·커밋만**, Node 실제 실행/CI 미인증. 두 변경 경로 모두 지정한 `ax-site/` 내부; #89 및 #162 **둘 다 Draft·미병합**. **[ ] 유지**.

## A1-CALC-002 — 매출·VAT·원가·현금입금·승인 순소득은 다르다
- 실제 `assembleBusinessMonthEvidence`와 fullMonth/selectedMonths/sumMoney 원본문 V8 합성 9조건 **9/9 기대일치**:
  1) 다른 sourceRecordId의 매출 3,000,000원/비용 1,500,000원 → gross/cost 원문 진단값만; 산술미리보기=null.
  2) 같은 원천 recordId 두 금액 → 산술미리보기 1,500,000원, `legalNetApproved=false`.
  3) 별도 VAT 300,000원 → receipt/tax facts에만 보존, 법적 순소득 자동 산입 안 함.
  4) 비용 미검증/null → cost 및 미리보기 null, 0원 대체 금지.
  5) 매출 환입 → 미리보기 보류.
  6) 현금입금·원천징수만 있으면 gross/cost는 null.
  7) 동일월 복수 매출총액 → gross null.
  8) 비용 합계와 비용행 혼용 → cost null.
  9) 잘못된 문자열 `1,00` → gross null; 다만 `BUSINESS_SOURCE_VALUE_UNVERIFIED` 진단 gap이 자동 추가되지는 않음. 실제 upstream `auditBusinessSourceEvidence`에서 이 형식이 그대로 생성 가능한지 확인되지 않아 **진단 보완 후보·도달가능성 미검증**, 새 확정 결함으로 집계하지 않음.
- `business-net-reconciliation.ts`의 staff 제안→정책 사전검사→변호사 승인·세부 Fact 원천 연결은 **소스 정적 확인**, 승인 함수·실제 기준정보를 이번 회차 실행한 것은 아님. 빈 정책 rules=[] 기본 OFF, 독립 변호사 승인 필요. 기존 승인 충돌 [Draft #55](https://github.com/firmengine/firmengine/pull/55)·[#85](https://github.com/firmengine/firmengine/pull/85) 미병합. VAT 세무·재판상 비용 인정, D5103/D5110 생성물 일치 및 12개월 OCR 실자료는 미검증. **[ ] 유지**.

## 판정 / 다음
- **A1-IT-009 / A1-AX-004 / A1-CALC-002 모두 [ ] 미완료**. main 기존 P0/P1 재현 2영역; PR #89의 신규 nullable false-reject 회귀 후보 1건, 이를 고친 **stacked Draft PR #162** 생성. 전체 A1 제품 인수 완료 0건.
- 본 회차 직접 실행: A1-IT 원본 V8 8조건(7/8), AX main V8 11조건(7/11), #89 후보 대비 #162 V8 14조건(12/14→14/14) 및 추가 12/12, CALC main V8 9조건(9/9). 실행하지 않은 CI/원격 D1/R2/API/공식서식은 PASS 아님.
- 다음 순환 **서류담당자 / 변호사 / 데이터담당자**: **A1-DOC-011** 갈음 A←B+C의 C 누락·역할 상충, **A1-LAW-012** 서울 424호 시행일·관할 판본, **A1-DATA-011** Fact 정정·철회 이벤트/최신값.
- 상담→85문서→OCR→정규화→18계산→95법률→자동초안/직원 문안검수→법원 보정, C01/C02/C04·동시 사건·운영 배포·실제 법원 확정은 이번 회차 **미실행**. 합성 입력만 사용, 공개 Git에 실고객 정보/키/.env/OCR 사실값 없음. Extra High 실제 실행 모드 설정 여부 확인되지 않음.
