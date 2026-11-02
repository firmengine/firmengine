# FirmEngine A1 — 78차 코드 완결성·상호 기능충돌 감사 (2026-11-02 18:48 KST)

- **범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 직전 77차 DOC/LAW/DATA 다음 **IT → AX → 계산사무장** 순환.
- 시작 GitHub `main` **`3cdc2fe0e073a016bc68d12771a9d3ec6b801e47`**. 최근 77차 감사영수증, 보드, 최근 커밋/PR #24/#77/#112/#111 및 실제 소스·테스트·DB 스키마를 읽음. 이 SHA는 감사 시작 시점이며 동시 커밋으로 바뀔 수 있음.
- **실행 범위:** GitHub `main`과 명시된 Draft PR의 실제 함수 **본문**에서 TypeScript 타입 표기만 제거하여 V8 `Function` 격리 실행. 외부 D1/R2·AI 호출은 Map·배열·합성 Fact/검증 의존성으로 대체. Node 프로젝트 테스트, CI, 실제 모델/OCR, HTTP·DB·브라우저 종단테스트가 **아님**.
- 검토 파일 SHA: `lib/export-artifact-transaction.ts` **`a114235e5b5de57b5ae58b41026f939ee8543174`**; `lib/extraction.ts` **`75931aad3fc7871395e62276bb5533e24b15d1a5`**; `lib/income-resolution.ts` **`f370c4b14fd347089708c5c3241fa9c72522d4bf`**; `lib/assessment.ts` **`ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`**. API export `4f9384e840517455cdec25f0fa734b593d31e533`, 자동초안 `5ee8860250303ac9ca513b0be22e886f98c8e904`, DB schema `933f8686845ac14669312dd21bf85e02c62ed5e6` 및 기존 export/extraction/income 테스트 정적 열람.
- `main` 실행 코드 변경 **0건**. 세 A1 ID 모두 **[ ] 미완료**, 전체 제품 종단 인수 **0건**.

## A1-IT-014 — Export timeout·ACK 유실·재시도/취소 [ ]

- 실제 `commitExportArtifactTransaction` + `assertUniqueInvocationTargets` + `attachCleanupErrors` 본문 V8 실행. 합성 artifact `r1/r2`, R2 객체 `o1/o2`, SQL rows 및 D1 manifest, throw 지점별 독립 기대 정의.
- 8개 시나리오: 정상(2 객체·2 rows·manifest 2), 두 번째 업로드 중 쓰기 뒤 실패(0/0/0), SQL rows 저장 뒤 실패(0/0/0), manifest **커밋 전** 실패(정리·무성공), manifest **커밋 후 ACK만 유실**(기대 기존 SQL/R2 보존), afterCommit 로그 실패(오류 반환이나 객체/rows/manifest 보존), 중복 objectKey(작업 전 거절), 정상 저장에서 cleanup 장애 플래그 비사용(정상 결과 확인). **main 7/8** 안전 기대 일치. 이전과 동일한 **P0 ACK 유실**만 실패: manifest=[r1,r2]인데 SQL rows/R2 objects 모두 삭제.
- 기존 [Draft #24](https://github.com/firmengine/firmengine/pull/24) source blob `10dc79b9ec9dcf29ff74901af6a621a17d880573` 같은 8조건 실행. ACK 유실 시 SQL/R2/manifest 2/2/2 보존, `onCommitUncertain` 1회. **주의:** 확정된 commit 전 충돌 `manifest_fail`도 미확정으로 취급하여 SQL/R2를 그대로 보존(고아 자원 정리·영속 영수증 미해결). 따라서 #24 단독으로 자동 재시도·정리·운영 안정성을 인수하지 않음.
- `app/api/cases/[id]/export/route.ts`가 helper를 호출하고 뒤에 audit event를 기록하며, `lib/automatic-review-draft.ts`도 해당 helper 사용함을 정적 확인. 실제 abort signal, HTTP client timeout, durable idempotency ledger, D1/R2 취소 후 재시도 E2E **미실행**. 기존 #24/#61 등 변경과 충돌·원자성 검토가 필요하며 중복 패치하지 않음.

## A1-AX-009 — OCR 같은 원문 복수 거래행의 재판독 오병합 [ ]

- 실제 `preserveAgreedFieldsAfterOmission` 본문을 main, [Draft #77](https://github.com/firmengine/firmengine/pull/77) blob `1a7c52f179442ad739526567854f86dbd0fbb605`, [Draft #112](https://github.com/firmengine/firmengine/pull/112) blob `8fa59a8e7eab45131de2a8bf2d5d4d207ea544b1`에서 추출, 보조 `checksFor/validAgreement/recordCategoryStatus/canonicalKey`는 해당 main 로직과 동일한 합성 함수로 주입. 원문 값 100/200/999, 계좌·거래번호·날짜(모두 **합성**) 사용.
- 8조건의 독립 기대: (1) 단일 무식별 재판독에서 이전 100원 이식 금지, (2) 같은 계좌를 가진 과거 2행→재판독 1행에서 금액 이식 금지, (3) 고유 거래번호 식별된 100원 복원, (4) 계좌+날짜로 고유 행 선택, (5) 같은 날짜·계좌의 서로 다른 거래번호는 무번호 재판독에 이식 금지, (6) 기존 999원 상충 시 원본 100원 덮어쓰기 금지, (7) wrong_category 차단, (8) 동일 거래번호를 가진 재판독 후보 2개는 판정 보류.
- 관찰 **main 5/8, #77 6/8, #112 7/8** 독립 기대 일치. #77은 무식별 단일행을 차단하지만 계좌를 공유하는 2행에서 오이식, #112는 복수 baseline 모호성을 차단하지만 무식별 단일행 복사를 다시 허용. **두 PR의 개별 성공률을 합산하거나 통합 수정 완료로 표시 금지.** 실제 두 브랜치의 Git 결합·Node·OCR 원본·D1/서식 **미실행**.
- 복수 거래행의 동일 계좌·동일 날짜는 동일 거래의 확정 식별자가 아님. 값은 `unknown/conflicting` 보류, source-only는 승인값이 아니며 원문 재확인 필수. 기존 P1/P2 재검증으로 새 결함 수량 중복 집계하지 않음.

## A1-CALC-007 — 같은 현행 순소득 Fact의 여러 소득행 소비 [ ]

- 실제 `resolveIncomeRows` main 원본문과 [Draft #111](https://github.com/firmengine/firmengine/pull/111) blob `bd0bab366acd16c7a47212ff1dda133991f0a79b` 격리 실행. `currentFacts`는 합성 active Fact 목록, `sourceIdentity/sourceObservationSignature`는 `null` stub, `observationCore`는 합성 동등 지문으로 구성하여 **동일 Fact ID 경로만** 분리. 실제 출처 영수증/계산 엔진 전체가 아님.
- 합성 9조건: (1) 현행 `income.net` F1을 지급자 A/B가 각각 소비(2행 유지+중복사용 경고 기대), (2) 동일 내용·ID exact 중복(1행), (3) 서로 다른 F1/F2(2행·중복사용 경고 없음), (4) 공유 gross-only Fact(중복 net 경고 없음), (5) 한 소득행 net `null`(net 중복 경고 없음), (6) `sourceCalculationRole=gross_turnover_only`(net 중복 경고 없음), (7) 한 행 내부 동일 F1 두 번(경고 없음), (8) 철회된 F1(현행 net 경고 없음; **상위 원천무결성 검증 별도 필요**), (9) 현행 `income.monthly_net`을 A/B가 공유(2행+경고).
- 관찰 **main 7/9, Draft #111 9/9** 독립 기대 일치. 기존 P1 두 shared-net 조건을 main은 `issues=[]`로 지나침. #111의 중복 net Fact 탐지 함수만 실행했으며, `assessment.ts`의 월소득 `null` 보류는 **정적 경로 확인**, 실제 계산 전체 실행 아님. #97/#96과 같은 파일 수정 충돌·법률상 의미 검토·D1/서식 미검증이므로 병합하지 않음.
- 채무·자산 간 **교차 원장** 동일 Fact 재사용은 이번 격리 9조건에 포함하지 않음. `resolveDebtRows` / `resolveAssetRows` 코드만 정적 확인. 범위 미충족을 완료로 표시하지 않음.

## 인수·인계

- 3개 ID 모두 **[ ]**. 기존 P0 1축 및 기존 OCR·소득 중복사용 2축 반례 재현; **신규 확정 결함 0건, 신규 코드 PR 0개**, 문서/보드만 변경.
- 다음 역할 순환: **사용자·서류담당자 A1-DOC-016 → 변호사 A1-LAW-017 → 데이터담당자 A1-DATA-016**. 실제 ID 제목·미검증 상태는 다음 회차에 보드 HEAD에서 다시 확인할 것.
- **미실행:** 전체 프로젝트 Node 테스트·TypeScript·빌드·CI·staging D1/R2/Cron·실제 PDF/OCR 및 85서류·18계산/95법률 종단, 브라우저, 공식 법원서식, 직원·변호사 승인 및 사이트 배포. 운영 배포, D1 운영 마이그레이션, 전자제출, 법원 인가 확정 **수행 안 함**. Extra High 추론 모드 실제 설정 **확인 불가**.
