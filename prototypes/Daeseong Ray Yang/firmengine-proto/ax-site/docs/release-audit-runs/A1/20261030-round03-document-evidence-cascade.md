# FirmEngine A1 제품 기능·충돌 감사 — 2026-10-30 14:52 KST (3차)

> 원본 기준 GitHub main: `3cdcb6cbf3cb66e3c8dae5d7f8b8afb2166a32c4`. 문서 작성 직전 HEAD: `3cdcb6cbf3cb66e3c8dae5d7f8b8afb2166a32c4`. 수정 대상은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 검증 자료는 가상 구조/숫자만 사용. 이 영수증은 **전체 프로젝트/운영/법률 합격증이 아니다**.

## 사전 인수 확인

- 전 회차 영수증: `2026-10-30_1309_KST_review-only-append-guard.md` 및 `20261030-round02-draft-commit-cas.md`. A1 PR #12(기존 법률·문안 이력 append-only)와 #17(자동초안 완료 D1 CAS)은 모두 draft·미병합이므로 이번 작업에서 main 코드를 중복 손대지 않음.
- 최근 main: `3cdcb6c` A4 2차 기록, `8fef575` A3 2차, `af4334b` A2 2차. 열린 교차 PR #13–#19를 확인하고 메인 기능 모듈은 새 분리 브랜치에서만 변경.
- 6담당자 순환: 이전 회차 IT/AX/계산사무장에 이어 **사용자·서류담당자, 변호사, 데이터담당자** 3개 관점 선택. 대상 `A1-DOC-015`, `A1-LAW-016`, `A1-DATA-017`. 모든 체크박스는 미완료 `[ ]`를 유지.

## 검토 ID와 실제 판단

| ID | 역할·코드 | 독립 기대 | 실제 관찰 | 판정 |
| --- | --- | --- | --- | --- |
| `A1-DOC-015` | 서류담당자, `case-mutation-classifier.ts`·`document-edits.ts`·`case-commands.ts`, 기존 PR #12 | 이전 편집이력 불변·동일 문안 신규 한 행 append만 허용 | main의 `projected()`가 `document.edit`시 전체 이전 `documentEdits`를 삭제해 비교. 지난 회차 원본 가드 반례 있었고 수정 PR #12는 **여전히 미병합**. 이번 회차 Word/Node/E2E 미실행. | `CODE_REVIEWED / PR_PENDING / RELEASE_UNVERIFIED` |
| `A1-LAW-016` | 변호사, `business.net.adopt`·`resetReviews`·`touchCase`·`legal-check-dispositions` | 원천 변경 시 이전 계산/법률/서식 승인 분리 무효화 | business.net.adopt는 typed 소득 채택 후 이전 `incomePeriodReviewed/presentValueReviewed/allocationBasisReviewed` 및 서식 승인 등을 초기화하는 분기 확인. `legalDispositions`는 감사 이력으로 보존되고 현재 실행은 dependency fingerprint 검증이 필요. 실제 D1/AI/95항목·Word 전체 경로 미실행, 법률 승인 완료 아님. | `CODE_REVIEWED / E2E_UNVERIFIED` |
| `A1-DATA-017` | 데이터담당자, `document.role`·`document.retract`·`domain.currentFacts`·typed object | 출처 증빙이 유효하지 않으면 기존 typed 금액은 검토용 보존, `factIds` 연결 및 법률상 인정 상태는 강등 | **새 P0 원천-typed 결함 재현**: page `evidence→administrative`로 바꾼 경우 retracted Fact는 현재목록에서 사라지고 문서매칭은 stale이지만 채권 typed `legalReview='accepted'`와 구 `factIds` 유지. 수정 PR #20에서는 범용 인스턴스별 원문 링크 제거/인정 강등/재검토 큐 연결. 격리 V8 수정 helper 6/6 기대일치, 원본 Node/DB는 미실행. | `DEFECT_REPRODUCED / ISOLATED_V8_PASS / DRAFT_PR_PENDING` |

## 이번 회차 핵심 재현 — 원본 최신 main 코드 분기

- 실제 소스: `lib/case-commands.ts` main **blob `d18c555f04f65687c509a8e8d35aba4bb3597378`**, `if(page.role!==role)`의 **실제 1줄 함수 본문을 GitHub에서 가져와** V8 JavaScript로 실행 (TS 변환이 필요 없는 구간). `lib/domain.ts`의 `currentFacts` 구현은 최신 retracted 사실을 현재 리스트에서 제외함을 정적 검증.
- 합성 입력(PII 없음): 문서 `doc-1`/페이지1, 현재 증빙 `fact-1`(채무원금 100원·상태 verified/recognition accepted), typed `debt-1`은 `legalReview=accepted`, `factIds=[fact-1]`, documentMatch `accepted`. 페이지 역할 `administrative`로 변경.
- **독립 기대**: 현재 Fact=0, documentMatch=stale, typed `factIds=[]`/legalReview=unreviewed(금액은 수기 재검토 위해 보존).
- **main 관측**: 현재 Fact=0, documentMatch=stale, retracted Fact 1개 생성; 반면 typed `factIds=['fact-1']`, `legalReview='accepted'` 그대로. 기대와 불일치. **소스 함수 격리 실증이지 REST/Cloudflare D1 실제 사건에서 재현한 것은 아님.**
- **연관된 문서 전체 철회**는 `retractDocument`가 current facts를 철회·원본을 삭제하지만 `case-commands.ts`가 typed 객체 재검토를 호출하지 않는 구조를 정적 확인. 개별 대상자의 기존 법률 승인이 남을 수 있는 같은 계열 위험.

## 수정 브랜치 및 테스트 증빙

- 새 분리 브랜치: `audit/a1-document-evidence-cascade-20261030-1452`, 기준 `3cdcb6cbf3cb66e3c8dae5d7f8b8afb2166a32c4`, 마지막 작업 SHA `1395c93fb305700332c1c6604a1bcf332f56b562`.
- **[Draft PR #20](https://github.com/firmengine/firmengine/pull/20)**; **미병합**, main 동작 미변경.
- 수정 코드: `lib/document-evidence-cascade.ts` 추가. 임의 `FIELD` 정규화 이름에 의존하지 않고 `incomes/debts/assets/transactions/household`의 `factIds`를 전수 조사, 철회 사실 연결 제거·typed 금액 보존·인정 `unreviewed`/inventory `unknown`. `lib/case-commands.ts` 두 문서명령에서 호출·`WITHDRAWN_DOCUMENT_EVIDENCE` blocker·`projection_remap` 직원 검토 작업 및 감사 이력 연계. 법적 채택을 다시 자동 승인하지 않음.
- 새 회귀 테스트(저장소 **작성만**, Node 미실행): `tests/document-evidence-cascade.test.ts` 5개 테스트, `tests/case-commands.test.ts`에 추가된 `document.role`/ `document.retract` reducer 통합 2개.
- **실제 실행된 합성 V8 결과**: GitHub 브랜치에 등록된 정확한 helper 본문에서 TypeScript의 타입 표기만 제거 후 여섯 조건을 실행: (1) 임금 일부 증빙 철회=인정 해제/나머지 증빙 보존, (2) 채무 철회=본인 채무 법률승인만 해제/무관한 채무 보존, (3) 가구 증빙 철회=승인 해제, (4) 두 사실 동시 철회/재실행 멱등, (5) source-only fact면 inventory unknown, (6) 빈 철회 목록이면 no-op. **6/6 기대 일치**.
- **미실행**: GitHub 원본 전체 `npm ci`·Node 통합 테스트·TS typecheck·lint·build·GitHub CI, 실제 D1/R2/Cron, 85서류·693피처 전수 소비처, 95법률·전자서식/Word 및 변호사 승인. 이 테스트를 단위/운영 제품 통과로 보고하지 않음. 병합/배포/마이그레이션/전자제출 수행 없음.

## 변경 영향·남은 인수

- 법률 확인 전 실제 금융원금·원문은 변경하지 않고 **기존 인정 상태만 강등**한다. 새 `projection_remap`를 직원 검토·법률 확인/업무이력과 연결하는 실제 API/DB/원단위 서식 E2E 필요.
- 기존 PR #12·#17·A4 #19 등과 동시 작업을 피하기 위해 이번 수정은 별도 draft이며 4개 파일만 수정. PR 본문에 전부 미인증 항목 명시.
- 다음 A1 역할 순환: IT/AX/계산사무장. 추천 `A1-IT-008`(R2 성공·DB 실패의 이중 커밋과 cleanup), `A1-AX-015`(자동초안 artifact SHA→문안 편집→법률승인) 및 `A1-CALC-015`(원본·reference SHA 변경 후 stale 계산 차단). 기존 PR #17이 완료 CAS에 관련 있으므로 중복 패치 금지.
- **이번 회차 개별 A1 전체 인수 완료 0건; 3개 ID 부분 검토, 신규 결함 1종, draft PR 1개, 격리 V8 6/6, Node/운영 미인증.**
