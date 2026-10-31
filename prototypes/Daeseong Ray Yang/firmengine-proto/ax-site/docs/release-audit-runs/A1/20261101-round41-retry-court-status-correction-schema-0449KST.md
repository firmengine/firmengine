# FirmEngine A1 41차 — 네트워크 명령 영수증·법원 상태·Drizzle SQL 보정항목 제약

- 역할 교대: **서류담당자 A1-DOC-018 / 변호사 A1-LAW-018 / 데이터담당자 A1-DATA-016**.
- 시작·변경 브랜치 생성 당시 GitHub **main HEAD**: `cae832cc65110fefea4b03c90c7e2b4a2efb640d`. 기존 [40차 영수증](20261101-round40-migration-legal-monitor-debt-component-0352KST.md), 중앙 보드, 최근 main 커밋 및 PR #32/#105/#106 등을 읽음.
- 범위: **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만**. 테스트 입력은 모두 가상; 원본 PDF·실제 개인정보·키·OCR 값 없음.
- 'main 소스 V8 실행', '격리 SQLite DDL 실행', 'V8에서 회귀 소스 실행'은 서로 다른 증빙이다. 새 Node runner/전체 CI/실제 D1/R2/브라우저/법원/변호사 승인 검증과 동의어 아님.

## A1-DOC-018 — 새로고침 후 pending 명령 ID 유실 [ ] 유지

- main `components/case-workflow.tsx` blob `2ec797958726b99a4358ec46ef35f78f90bfd927`, API `app/api/cases/[id]/commands/route.ts` blob `44c267951751d280d0f1c27ac6b3362bd7f9b9d6`, `lib/case-command-store.ts` blob `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01` 직접 조회.
- **실제 main `send` 본문**의 TS 타입 표기만 제거해 V8 합성 fetch/UI 상태 어댑터로 실행:
  1. POST HTTP 200 + 빈 `{}`: 독립 기대는 미확정/기존 명령 보존, **관찰 success notice + pendingCommand=null** (결함 재현). 기존 [Draft PR #32](https://github.com/firmengine/firmengine/pull/32)이 이 확인 오류를 별도로 수정하므로 재수정하지 않음.
  2. 네트워크 예외: pending ID `synthetic-cmd-2` 보존 (기대 일치).
  3. 같은 컴포넌트 생존 상태에서 retry: POST ID `synthetic-cmd-2` 재사용 (기대 일치).
  4. 네트워크 예외 후 새 mount 모사: 이전 `synthetic-cmd-3`이 아닌 **신규 `synthetic-cmd-4`** 발급. GET 명령 영수증 조회 0회. 새 mount pendingRef/useState는 메모리에만 있으므로 잃음.
- 실제 서버 이중 커밋 또는 브라우저 reload는 **미실행**. 빈 성공 본문은 합성 API 응답이며 실제 정상 서버는 `committed:true`를 응답함. 새로고침 후 안전한 복구에는 commandId만으로 영수증 조회·미확정 차단 설계가 필요; 개인정보를 무단으로 sessionStorage에 저장하는 방식은 채택하지 않음. PR #32와 UI 파일 충돌 예방.

## A1-LAW-018 — 법원 상태와 근거 문서 종류의 증빙계약 [ ] 유지

- `lib/case-procedure-events.ts` blob `7c61fdfb6e79becc415a8b1385a1580bd8aa6ab2`의 **실제 `validateProcedureEvent` 본문 V8 8합성 조건 실행, 독립 안전 기대 6/8 일치**.
- [정상] `generated` 무근거 허용, 근거 없는 approved 거절, 등록되지 않은 문서 거절, 범위 밖 상태 거절 등 6건 기대 일치.
- [기존 P0 후보 재현] 같은 사건의 활성 일반 통장 문서 `D-BANK`만 지정해 `approved` 및 `correction_requested`에 임의 `courtReference`를 입력하면 **둘 다 허용** (독립 기대는 법원 원본 유형·접수 증빙 확인 전 차단).
- `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`, `procedure.record` 분기는 activeDocs(상태만)와 `caseworker_review`를 확인해 위 함수에 전달. 실제 HTTP·저장 DB·위조 법원 문서 생성은 **미실행**.
- 이는 이전 #11 이슈 및 5·17·21차와 같은 근거유형 계약 결함, **신규 결함으로 중복 계수하지 않음**. 직원 기록·서식 생성·법원 접수·인가/면책/보정명령은 서로 다른 상태. 법원 문서 분류·역할/서명 정책 및 실제 변호사 검토 없이 법률 상태 로직 변경/승격 금지.

## A1-DATA-016 — SQL 0022 보정항목 범위 제약의 Drizzle 누락 신규 P2 후보 [ ] 유지

- main `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, `drizzle/0022_preapproval_court_correction_items.sql` blob `bec8b19780eaa951c4994530060c916f903a40fe`. SQL 0000~0022 전체 소스·column lists 재조회, Drizzle 56개 테이블 선언 목록 조회. 주요 생성/추가 컬럼은 대응; **전체 제약/트리거 자동비교, 실제 23개 일괄 적용은 미실행**.
- 정확한 차이: Drizzle `caseCourtCorrectionItemVersions.itemNo`는 `integer("item_no").notNull()`만 선언; SQL 0022에는 `item_no INTEGER NOT NULL CHECK(item_no>=1 AND item_no<=500)`. 런타임 DB에는 보호가 있지만 **Drizzle-대-DDL 제약 모델 불일치**. 코드 저장 함수 `lib/preapproval-correction-item-store.ts` blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`는 동일 범위를 사전검사하므로 현재 우회/운영 사고라고 판단하지 않음.
- 격리 SQLite 메모리 DB에 GitHub SQL 0022 DDL을 적용해 부모 테이블/가상 rows 구성, 실제 SQL INSERT **6조건 6/6 기대 일치**: itemNo=0/501 거절, 1/500 수용, 없는 case/doc FK 거절. Cloudflare D1 시험이 아니다.
- 수정: **[Draft PR #107](https://github.com/firmengine/firmengine/pull/107)** (`audit/a1-r41-correction-schema-check-20261101-0449`), schema CHECK를 SQL 0022와 일치시키고 `tests/correction-item-schema-parity.test.ts` 추가. PR HEAD `fd7756135803604c4f4f0083b122ad8681413a41`, 수정 schema blob `53972a70d8a27dffaf9acb5d20632c0aec72acfe`, 테스트 blob `e0a38d07b97a98fa0acbd5337baa164f9743b5de`.
- PR의 **실제 테스트 본문 GitHub 재조회 후 V8 격리 2/2 통과**(범위 CHECK 동치, case/doc FK 일치). **Node 테스트 runner/Drizzle generation/TS·CI·빌드/실 D1은 미실행**. 실행 코드나 SQL migration을 바꾸지 않았으며 PR Draft·미병합 유지; DB 담당자/실무자 리뷰 필요.

## 인수 상태 / 다음 교대

- **세 ID 모두 [ ] 미완료**: DOC에는 reload 후 영수증 복구와 브라우저·HTTP+DB, LAW에는 법원 원본 유형/접수증·변호사 검토, DATA에는 전체 Drizzle/SQL 제약/트리거·실 D1 검증이 남음.
- 다음 역할 교대: **IT A1-IT-009**(D1 성공/R2 실패), **AX A1-AX-012**(모델 재시도 비용·사건 오염), **계산사무장 A1-CALC-007**(동일 Fact 다중 산입 차단).
- 85서류·18계산·95법률·전 화면/API/DB/역할 종단, 전체 Node·CI, D1/R2/Cron, 공식 서식, 변호사 승인, 사이트 배포 **미인증**. 제품 전체 인수 완료 0. 운영 배포·운영 마이그레이션·실제 전자제출·법원 인가 확정 실행하지 않음.
- 실행기의 실제 Extra High 모델/추론강도 설정 여부 미확인.
