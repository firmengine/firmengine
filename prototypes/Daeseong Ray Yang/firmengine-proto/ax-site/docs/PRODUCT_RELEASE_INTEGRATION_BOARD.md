# FirmEngine AX — 제품 인수 단일 보드 (2026-10-30 KST)

> **단일 현재 인수 기준 / 운영 준비는 미인증.** 2026-10-30 소스 감사 기준 `main`은 `032565be38c1f6f348d24f80d156de2ab83a9f7b`였다. 다른 에이전트가 계속 수정하므로 회차마다 최신 HEAD를 다시 읽고 상태를 갱신한다. 구 v35/v43/v44 기록은 역사 증거이지 현재 main의 CI·배포 영수증이 아니다. 이 문서는 기능·결함·미래 작업·과거 이력의 **단일 인수 항목표**이며 세부 원본 매트릭스·테스트 파일은 보존한다.

## 1. 현재 사실과 판정 기준

- 저장소: `firmengine/firmengine`; 수정 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 공개 Git에 실제 의뢰인 정보, 원본 PDF, OCR 추출값, 키, 비공개 샘플·정답을 반영하지 않는다.
- 현재 구조: canonical OCR **693** (기본524 + 문서확장 + 보강; 같은 ID가 여러 서류에 사용), 상담/첨부 문서 계약 **85**, 상담 workflow **46**, 계산 **18** (입력 선언 **91회**, 고유경로 **78**), 법률규칙 **50**, 예외 **46**, 법률위험 **95**, SQL migration **0000–0022**. `scripts/audit-product-contracts.mjs --fields`로 전체 피처별 원천 선언을 확인한다.
- **정적 코드 존재**, **단위/합성 실행**, **최신 main CI**, **staging D1/R2/Cron**, **공식 서식·실무준칙 전문가 확인**, **운영 배포**는 각각 독립된 합격 항목이다. 현재 HEAD에 대한 전체 Node/빌드/운영 D1·R2 시험 영수증은 이 감사에서 확보하지 못했다.
- 원본 값 → 인식 행·단위·대상·기간·원문 해시 → 검증/법적 인정 → 단수/복수 타입 객체 → 산식/계산 run → 법률·예외 → 서식 필드/생성물 해시 → 담당자/변호사 승인 순서로 동일 사건·같은 판본을 요구한다. 미관찰·없음·0·해당없음·상충·일부누락·source-only는 다르다. 자동 인가/법원 보정 이행 확정은 금지.

## 2. 기능별 코드·충돌·인수 상태 (진행 중 개별 점검표)

기호: **코드** = 현재 main에서 대응 경로 확인, **E2E 미인증** = 실제 저장소/모델/법원서식 종단 검증 불가, **미완** = 상세 계약/전문가 승인 또는 제품 실행이 남음. 완료 증빙 없으면 코드가 있어도 제품 합격 처리하지 않는다.

| ID | 개별 기능 / 현행 연결 파일 | 확인된 코드 경계 | 남은 검증·상충 |
|---|---|---|---|
| F01 | 사건 CRUD·인증·역할 `app/api/cases`, `lib/app-roles.ts`, `server-store.ts` | 코드 | 사건/테넌트 권한, 동시 수정 CAS와 감사 로그 E2E |
| F02 | 상담 기록·revision·분류 `intake-store/intake-engine/intake-classifier` | 코드 | 상담 추가→재분류→활성 실행 채택 실제 DB 흐름 |
| F03 | 상담 결과에서 85종 제출서류·필드 요구 `case-requirements`, `case-requirement-field-plan` | 코드 | 필수/권장/법원개별명령/기간·대상 별 승인 누락 |
| F04 | 갈음 A←B+C 및 철회 `approve-document-substitution`, `case-substitution-watch` | 코드 | 85종×관할×문서 판본, 경고와 최종 출력 같은 결과 |
| F05 | 파일 접수·페이지·R2·해시 `app/api/.../documents`, `lib/page-refresh.ts` | 코드 | R2/DB 부분 성공·동시 업로드·교체·복구 |
| F06 | OCR 48 추출 family/85문서 `shared-document-catalog`, `extraction.ts` | 코드 | 실제 원본, 누락값·여러 행·문서종류 오분류·페이지 분할 |
| F07 | OCR 행·canonical 693·증빙 버전 `extraction-row-store`, `field-observation` | 코드 | 693 전체 필드별 정합/용도 및 2,000+ 행/페이지네이션 E2E |
| F08 | OCR→typed CaseData / 금액·대상자/기간 `canonical-field-binding`, `domain.ts` | 일부 명시적 변환 | 나머지 source-only·증빙·서식·법률 소비처 개별 확인; 단순 합계 금지 |
| F09 | 중복/상충 소득·채무·자산 `material-calculation-source-gate`, `assessment.ts` | 가드 코드 | 0/NULL, 동일 fact 다중 typed, 원문 값 변경/철회 실제 재투영 |
| F10 | 사업자 동일성/기간별 월매출·경비 `business-monthly-workbench`, `business-net-reconciliation` | 직원 제안·독립 변호사 채택 코드 | VAT·매출·경비·현금입금 중복, 연속기간, 별도 사업자, D5103·D5110 실제 양식 |
| F11 | 10분 계산·다중사건 queue `case-data-recompute`, `case-calculation-feature-store` | 0019/0020/0021 코드 | 실제 2-worker lease·retry·quiet window·source-only 판본 |
| F12 | 18 계산 산식 `assessment`, `case-execution`, `execution-catalog` | 계산 코드·합성 테스트 | 91 선언 입력 모두의 저장값→상태→출력·법원 폼 E2E |
| F13 | 법령/준칙·95 risk `legal-catalog/risk-catalog`, `legal-evidence-criteria` | 검토 계약 코드 | **95 중 88개** 기본 필수 피처 미정의; 전문가 승인·관할·시행일 필수 |
| F14 | 법률 AI 시작 전 source/calc preflight `case-legal-source-preflight`, `case-legal-calculation-preflight` | 코드 | 유료 95 호출 0/차단/부분상태·참조변경 실제 재시도 |
| F15 | LawGraph·자동초안·필드 투영 `case-legal-automation`, `form-mapping`, `automatic-review-draft` | C01 보호 코드 | 0 토큰/빈 필드/이전 run/오류의 R2 생성 미호출 검증 |
| F16 | 서류 생성·편집·검수·재생성 `exports`, `document-writer`, `automatic-draft-handoff` | C02 코드 | D1/R2 동일 artifact SHA, 문안 수정 후 직원→변호사 순차 승인 |
| F17 | 기준정보 승인·시행일·롤백 `reference-runtime`, `app/api/reference-data` | 코드 | 변경 가능한 실무 조건 전수 외부화, 승인·영향·철회 운영 DB 확인 |
| F18 | 법령 모니터/법원별 경보 `legal-monitor-core`, `case-policy-alert-scope` | 서울 중심 제한 구현 | **C03/P1 보류**: 타 관할 전체 기준/서식 분기 및 이력 |
| F19 | 인가 전 5단계/보정명령 항목 `preapproval-stage-audit`, `preapproval-correction-item-store` | read-only·보정항목 0022 코드 | item 기한/답변/접수증, 실제 법원 원문·CAS·권한·판례 검수 |
| F20 | n8n/Sheets/Drive/NAS 재구성 | 설계 문서만 | 새 stage-run/DB 권한/outbox/스키마/중복방지/장애회복 구현·검증 미완 |

## 3. 계산 산식 18개 — 각 모듈별 다음 합성 검증

| 모듈 | 대표 입력/실패 시나리오 | 확인해야 할 공식 결과 |
|---|---|---|
| `income_average` | 월/연/기간 합계, 기간일수·분모 누락, 동종 소득원 12개월 일부 결측 | 원문 월별 행과 월평균·대표기간 근거; 결측은 0 아님 |
| `income_aggregation` | 동일/서로 다른 지급자, 사업자 ID, 중복 매출·입금 | 인정 소득원만 합산, 미완 기간 시 월소득 미확정 |
| `debt_total` | 계약별 원금·이자·비용·양도·복수 원문 | 실제 채권 현재액 및 채권자목록과 합계 |
| `debt_cap` | 담보/무담보·우선/재단·보증인·한도 | 법 제579조 분류, 기준일/법령판본 |
| `asset_liquidation` | 부동산·예금·보험·보증금·지분·담보·면제 | 청산가치 개별 산정 및 법적 차감 근거 |
| `available_income` | 월소득/인정 생계비/추가생계비 누락·중복 | 가용소득 결측 차단, 추가비용 이중 차감 금지 |
| `ordinary_budget` | 관재비·우선변제·재단채권 누락 | 배당 가능액 0/null/음수 상태 |
| `nominal_plan` | 36·48·60회 및 회차별 가변액 | 명목총액과 월별 합계 일치 |
| `allocation` | 다수 채권자·잔액·분배 잔여원 | 채권자별 분배합계·원금/이자 처리 |
| `liquidation_comparison` | 평가 기준일·PV 할인·청산가치 변경 | 명목액과 현재가치를 구분해 제614조 검토 |
| `disposal_conservation` | 매각대금·담보상환·수수료·대체 현금 | 자산/현금 이중계상 방지 |
| `payment_schedule` | 누락/중복/변제회차 변경 | 모든 회차·채권자·채무자 합계 검증 |
| `living_cost_proposal` | 가구원/서울/연도별 기준표·비용 기준 | '제안'과 법원이 인정한 생계비 분리 |
| `objection_minimum` | 이의 여부·채권 총액 PV·승인 기초일 | 법 제614조 요건 위반 자동 통과 금지 |
| `seoul_short_term` | 2026-10-01 전후, 미성년 자녀수·저소득/채무 | 서울 제424호 적용일·개정별 후보·변호사 승인 |
| `transaction_review` | 통장 입출금/매출·급여 중복·시간대 | 증거 관측과 소득 인정 혼합 금지 |
| `form_projection` | D5103/D5110 값/단위/서식 판본·행수 | 필드 토큰·출력 값·원문 source lineage 일치 |
| `installment_distribution` | 1회차/마지막 회차·우선채권·보수 | 생성 문서 변제계획 총액이 계산 run과 일치 |

합성 실행 오라클: **정상/경계/부정/누락/상충/복수행/기간중복/현재관할/구판본/재시도/동시성** 각각의 입력을 실제 저장 스키마 `extraction_records/extracted_features`, `cases.payload` typed `facts/incomes/debts/assets`, `case_calculation_features`의 최신 판본에 맞춰 구성. 법원/세무 결과는 자동 채택하지 않고 원문/공식자료와 독립 비교. 과거 작성 테스트 파일은 테스트 *존재*만 확인됐으며 최신 main 전체 실행 영수증은 없다.

## 4. 피처 693개 전수 소비처 확인 규칙

`node scripts/audit-product-contracts.mjs --fields`는 **693개 각각의 원문 선언 및 등록 ID를 열거**하고 계약이 고아·의미충돌인지 검사한다. 이는 downstream 사용을 증명하지 않는다. 각 피처마다 ① 증거 보존/대조 ② 계산 입력 ③ 법률·예외/누락 역질문 ④ 공식 서식/첨부 ⑤ 갈음/보정 ⑥ 원본 전용 ⑦ 법원/시행일별 비해당 이유를 검사하고 **각 상태의 테스트 영수증**을 연결한다. source-only 피처를 합산하거나 미사용을 곧 삭제하지 않는다. 인가 전 95 위험의 필수 출처 계약·법률인정은 사람 승인 전 빈 상태를 유지한다.

## 5. 운영 자동화·충돌 인수 및 출시 게이트

| 우선 | ID | 미해결 조건 | 완료 증빙 |
|---|---|---|---|
| P0 | G01 | 0021/0022 포함 D1 실제 migration, 재기동/롤백/권한 | staging D1 실행 영수증·기존 사건 데이터 비교 |
| P0 | G02 | 같은 사건 상담 A→B·갈음 철회·OCR 수정 후 10분 재계산 | source dataVersion/CAS/중복 이벤트/실제 queue 영수증 |
| P0 | G03 | 같은 사업자 12개월의 매출/순소득·VAT·비용·중복 | 월별 원문·세무 근거·직원/변호사 승인·D5103/11 대조 |
| P0 | G04 | 18 계산+95 법률 risk+85 문서 순차/병렬 결속 | 3개 이상 격리 사건의 정상/누락/상충/경계·최종 문서 검증 |
| P0 | G05 | LawGraph 88 미매핑 체크의 조건/증빙/사람 승인 | 관할/시행일/법령·원문/법률전문가 승인된 기준 릴리스 |
| P0 | G06 | R2 저장 후 D1 실패, 2워커 경합, lost response, 재시도 | 0 중복/교차 사건 유출, 기존 승인 의도치 않은 승격 0 |
| P0 | G07 | 공식 전자소송 서식/실제 인가 전 법원 실무준칙 대조 | eform parity 증빙, 법원·서식 판본·변호사 서명 |
| P1 | G08 | 타 관할 자동 라우팅 C03 | 서울 외 법원별 공문/준칙/서식판본+이력·시뮬레이터 |
| P1 | G09 | n8n/외부 스토리지 이벤트 플로우 | Outbox + idempotency + stage queue 운영 실측 |

**기능 교차상충 최신 판정**: F01–F04(source/review 분리), C01(빈 투영 차단), C02(원본 artifact 인계), C04(갈음 공통판단)는 관련 코드가 반영됐다고 기록되어 있으나 **제품 E2E는 미인증**. C05(불필요한 유료 법률 AI 호출)는 `case-agent-scheduler.ts`에서 `inspectLegalAutomationCalculationReadiness`를 연결한 최신 소스를 확인했으므로 초기 감사문서의 '미반영' 표현을 재사용하지 않는다. 실제 사건/DB 비용회귀는 별도. P0-09 보정기한/항목 0022는 코드에 존재하지만 운영 반영 여부는 미확인. 오래된 분기 `fix/intake-court-coverage-20261030`은 최신 main보다 뒤처졌고, `fix/ocr-field-db-form-legal-calculation-20261030`의 PR #2는 병합됐으나 브랜치 자체가 뒤처져 있으므로 **브랜치 파일을 그대로 덮어쓰거나 재병합 금지**.

**배포 승인 불변식:** 최신 `main`에서 `node scripts/audit-product-contracts.mjs`, `node scripts/run-preapproval-regressions.mjs --full` (Node 22+, `npm ci` 선행), staging D1/R2/Cron, 실제 법원 서식/변호사 독립 검수 순서. 커밋·모의 테스트·기존 v44 테스트 통과는 새 배포나 법적 완결성을 뜻하지 않는다. 정적 감사 실패 시 새 코드로 제품 이관하지 않는다.

## 6. 역사 이력 합본 / 보관정책

- **2026-10-29 v43**: 예전 병합 기록·당시 테스트 799/799, 운영 배포 미실시. `ax-v43-merge.md` 및 `releases/ax-v43`은 당시 기록.
- **2026-10-29 v44**: 기록상 당시 950 테스트·합성 사건 52건/비교 1,397건 통과, 실제 최신 main 회귀 아님. `release-v44.md`, `verification.md`은 배포판 이력.
- **2026-10-30 P0 보완**: 상담 revision F02, 계산 poll F03, 원문 preflight F04, review-only change F01, C01/C02/C04 코드 수정, 사업소득 월별 검토, 사전인가 자료·계산·보정자료 추가. 세부 기술 기록은 `p0-in-place-hardening-20261030.md`, `current-unresolved-and-synthetic-audit-20261030.md`, `business-monthly-reconciliation-20261030.md` 등에서 재현 가능.
- **정리 원칙**: 오래된 `audit-*`, `ax-v35/v43-merge*`, 이전 `production-p0-plan` 및 JSON manifests는 **역사/증빙으로만 보존**하고 이번 보드를 현재 인수 판단의 단일 표로 삼는다. 과거 PDF, 비밀키, 고객 자료는 저장·재게시하지 않는다. 모든 과거 기록을 기계적으로 삭제하면 참조와 법적 근거가 손상될 수 있으므로 검색/복원 가능한 상태를 유지한다.

## 7. 최신 검증 상황 및 다음 감사 시작점

- **실제 확인:** GitHub main 소스/트리·문서·커밋·병합 PR #2·법률/서식 reference catalog·문제 경계 소스 및 기본 집계. 현재 앱의 `scripts/verify-source-tree.mjs`는 merge marker 검사만 하며, 신규 정적 감사는 등록 계약/마이그레이션 고아를 차단한다.
- **최신 main CI, 노드 전체 실행, D1/R2 운영, 실제 OCR/법원 폼, 변호사 독립 평가:** **미실행 / 미확인**. 본 기록이 제품 합격증은 아님.
- **다음 순서:** G01 migration/staging 준비 상태 → G02 상담·OCR 수정 CAS → G03 사업 소득 세무기간/월별 검사 → G04 18 계산/법률/서식 필드 인수 → G05 위험 88 체크 → G06 경합/재시도.
- **공식 대조 기준:** 채무자회생법 2026-10-02 시행 제579·589·611·614조(https://www.law.go.kr/), 법원 공개 서식모음(https://www.scourt.go.kr/nm/minwon/doc/ProDocList.work), 서울회생법원 2026-10-01 제424호 개정 공지 및 실무준칙(https://slb.scourt.go.kr/), 소득세법 제24·27·39조와 부가가치세법의 기간·총수입/필요경비 구분. 개별 관할/서식의 최신판·적용일은 케이스별 별도 승인 대상.
