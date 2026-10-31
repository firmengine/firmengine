# FirmEngine A1 24차 — R2/D1 저장 경계·공식 법률 출처 실패·일반채권 변제예산

- **실행 범위:** GitHub `firmengine/firmengine`의 `main`, 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만 읽기/쓰기. 시작 main 관찰 `a599cdd04e8a069abcde4bb15929587b9c46f51a`, 기록 직전 `d86f423587cfb87078c13084eca8e26cb91643a2`. 다른 에이전트의 후속 커밋 때문에 판본이 변했으며 기록 직전 HEAD와 보드 blob을 다시 대조했다.
- **역할 순환:** 직전 23차 사용자·서류담당자/변호사/데이터담당자 → 이번 **IT `A1-IT-009` / AX `A1-AX-006` / 계산사무장 `A1-CALC-011`**. 세 ID 모두 **[ ] 부분검증 유지**.
- **기초 자료:** 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, [A1 23차 영수증](20261031-round23-document-history-independent-review-source-packet-1052KST.md), 최신 main·최근 커밋·열린 PR, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 코드·기존 회귀 테스트. 중복 수정 회피 대상으로 Draft [#24](https://github.com/firmengine/firmengine/pull/24), [#61](https://github.com/firmengine/firmengine/pull/61), [#73](https://github.com/firmengine/firmengine/pull/73), [#75](https://github.com/firmengine/firmengine/pull/75) 확인.
- **검증 수준:** 실제 GitHub main의 함수 **본문을 가져와 TypeScript 타입 구문만 제거해 V8 격리 실행**, D1/R2는 합성 Map·인위 장애로 대체. `assessment`의 보수/우선/재단 비용 산식은 실제 본문 substring 실행. 테스트 하네스·의존 함수는 합성. **원본 프로젝트 Node 테스트, TypeScript/lint/build, 전체 CI, 브라우저, staging/운영 D1·R2/Cron, 실제 문서/OCR, 법원 공식 서식·변호사 독립승인은 실행하지 않음.** 아래 기대일치는 제품 합격이 아니다. 공개 Git에 고객값·원문 OCR·키·비공개 정답 없음.

## A1-IT-009 — R2 파일 실패를 D1 저장 성공으로 위장하지 않는가

- 원본 `lib/export-artifact-transaction.ts` **blob `a114235e5b5de57b5ae58b41026f939ee8543174`**, `app/api/cases/[id]/export/route.ts` **blob `4f9384e840517455cdec25f0fa734b593d31e533`**, 기존 `tests/export-artifact-transaction.test.ts` **blob `a684612f61234a9fb0ac30261684733ba749eefc`**.
- 코드 경로: 생성 Export는 **R2 upload → D1 artifact 행 persist → 사건 manifest CAS** 순으로 실행한다. `upload`가 reject되면 `persistRecords` 및 `commitManifest`를 실행하지 않는다. 원본 업로드 `app/api/cases/[id]/documents/[doc]/route.ts` (blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`)도 R2 업로드와 길이/해시 검사를 기다린 후 `ready=1` D1 포인터를 갱신한다. 반면 `POST documents` (blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`) HTTP201은 **원본 저장 완료가 아니라 등록/업로드 대기 상태**를 뜻하므로 성공 종류를 분리해야 한다.
- **합성 입력:** 동일 사건 신규 산출물 A/B 및 기존 다른 산출물 foreign. 각 callback에서 사전 정의된 인위 실패 발생. **독립 기대:** R2 실패면 D1 persist 0, manifest 0, 성공 반환 없음; D1 부분 실패나 manifest CAS 실패면 본 실행 소유 객체만 정리; 다른 산출물 불변; 사후 로깅 실패는 이미 커밋된 객체를 삭제하지 않음.
  
| 합성 조건 | 기대 | 실제 함수 관찰 | 판정 |
| --- | --- | --- | --- |
| 정상 R2 두 번 + SQL + manifest | 성공/manifest A,B | 성공; upload2/persist1/commit1 | 기대일치 |
| 첫 R2 업로드 오류 | 오류; persist0/commit0 | 오류; persist0/commit0, 잔여 객체 없음 | 기대일치 |
| 두 번째 R2 업로드 뒤 오류 | 오류; persist0/commit0 | 오류; persist0/commit0, 본 실행 객체 정리 | 기대일치 |
| D1 한 행 삽입 뒤 실패 | 오류; 본 실행 행·객체 제거 | 오류; 본 실행 행·객체 제거 | 기대일치 |
| manifest CAS 충돌 | 오류; 본 실행만 제거 | 오류; 본 실행만 제거 | 기대일치 |
| manifest 후 로깅 실패 | 오류지만 커밋 행·객체 보존 | 오류; 본 실행 행·객체·manifest 보존 | 기대일치 |

- **실제 실행 6/6 합성 기대일치**. 다른 산출물 foreign은 모든 경로에 잔존. 단, R2/D1의 진짜 ACK 소실·경합·정합성은 미실행. 특히 `commitManifest`가 DB를 커밋했지만 응답만 유실된 경우 **catch가 실재 산출물을 삭제할 수 있는 기존 P0**는 [#24](https://github.com/firmengine/firmengine/pull/24)/[#61](https://github.com/firmengine/firmengine/pull/61)의 중복 이슈로 이미 관리 중; **이번 통과에 포함하지 않음**. 사후 이벤트 실패의 HTTP 응답 불확실성도 제품 인수 미해결.
- **결론:** 생성 Export 내 단순 R2 reject에서는 거짓 성공이 재현되지 않았으나, 전체 문서 흐름·실제 D1/R2 미검증이므로 `A1-IT-009` [ ].

## A1-AX-006 — 공식 법률 출처 검색 실패와 상담/법률 AI 상태의 분리

- `lib/case-legal-source-preflight.ts` **blob `0a4bf038a97de015652d4957a56ecddd5c049bd8`**, `lib/case-agent-scheduler.ts` **blob `0bb91c69dbc06495873cff1e4d5911679baaa335`**, `lib/case-legal-automation.ts` **blob `3a816faa42ab7dc82b69ce95da0caf8f6174f490`**, `lib/legal-monitor-core.ts` **blob `a8e514dcc04680a4adbca5aa0d3f8aa459159b62`**, `lib/legal-monitor-store.ts` **blob `a1776e68db46a1d691b15f78c0290a1071990ad1`**, `lib/legal-evidence-criteria.ts` **blob `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`**.
- 실제 `evaluateLegalSourceReadiness` 원본 함수의 합성 7조건: 문서/정규화/상담 등 **정상 ready**, **증빙 페이지 없음 waiting_evidence**, **처리 중 waiting_evidence**, **상담 구판본 review_required**, **업무판본 구판본 review_required**, **정규화 원문 head 누락 review_required**, **legacy fallback review_required** → **7/7 기대일치**.
- **중요 구현 공백(정적 연결 검토):** 위 source-preflight의 입력 계약에는 공식 법률 출처의 실제 HTTP 조회 상태, 마지막 확인시각, 출처 버전, `legal-monitor`의 `sourceHealth`/`discoveryStatus`가 존재하지 않는다. 모니터는 `failed/blocked/deferred`와 `discoveryStatus=failed`를 별도로 남긴다. AX 예약 경로의 사전검증은 주로 사건 원천/계산을 확인하고, 자동초안 단계는 대기 법원 정책 알림을 검사한다. **공식 검색 실패만 발생하고 새 정책 알림은 없는 상태를 반드시 `review_required`로 전환한다는 연결은 확인되지 않았다.** 공식 URL이 정책에 기재된 것과 온라인 조회가 실제 성공한 것은 다르다.
- **판정 엄격 구분:** 이번 회차에서는 실제 공식 사이트 503/차단/timeout을 공급하거나 실 법률 AI를 실행하지 않았다. 그러므로 `법률 AI가 공식 검색 실패 상태에서 무조건 승인했다`는 실제 장애 재현 주장은 하지 않음. 현 단계는 **source-only 사전계약 공백·종단 미검증**. 전문 변호사/AX 담당자의 미조회 정책·유효기간·모니터와 자문 분리 여부 합의 전 법률상 확정으로 승격 금지. 법률 의미가 바뀌므로 즉시 main 수정하지 않음. `A1-AX-006` [ ].

## A1-CALC-011 — 월 변제예산과 보수·우선·재단 비용 누락

- `lib/assessment.ts` **blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`**, `lib/calculation-adapter.ts` **blob `556ef86b887d1d729af2c56d071211c74b4d5e46`**, `lib/case-legal-calculation-preflight.ts` **blob `c17892e63bf00d2981f292b0ef28e032d66a8dc7`**, `lib/case-lawgraph-store.ts` **blob `eea435bb78f804c79a213c464af54e8014a3c3a5`**.
- 실제 산식: `ordinaryBudget = disposable - trustee - priority - estate`; `disposable = income-living`. 4항목 중 값이 `null`이면 계산 budget도 `null`; `0`은 유효한 관측 0으로 별도 취급한다. `PLAN_COST_OR_PRIORITY_PAYMENT_MISSING` 진단 이벤트도 코드 존재.
- **실제 본문 V8 산식 7조건/7 기대일치:** (income100,living30,각 비용0)→70; (income100,living30,보수5+우선7+재단8)→50; 보수 null/우선 null/재단 null/소득 null/생계비 null → 전부 **null** (임의 단위의 합성 BigInt, 실제 법원 금액 아님).
- **실제 `evaluateLegalCalculationPreflight` 함수 V8 8/8 코드 정책 기대일치:** 계산 head 없음 차단, 본질적 원천 오류 차단, 대표 소득기간 미선택 차단, 필수 계산출력 누락/blocked 차단, 정상 허용. **예외적으로** 계산 이슈 `PLAN_COST_OR_PRIORITY_PAYMENT_MISSING`만 있고 `requiredOutputs=[]`라면 `ready:true`를 반환. 해당 비용이 승인된 필수 `ordinaryRepaymentBudgetWon` 출력으로 명시되면 `blocked/null`일 때는 차단. 이는 법률 AI의 *예비 자문 단계*를 허용하는 현재 정책이지 최종 서식/법원 인가 승인 의미 아님.
- **자동초안 기계적 게이트 V8 6/6 기대일치(함수 본문은 실제, `expectedIds/checkCoverage`만 합성):** `ordinaryRepaymentBudgetWon`이 `null`/미관찰/`unknown`이면 `CALCULATION_VALUE_MISSING`; `blocked`/`conflict`이면 `CALCULATION_VALUE_UNRESOLVED`로 거절; `"0"` computed는 이 순수 게이트 자체에서 허용. 별도 엔진의 `canGenerateDraft` 및 95개 법률 상태 게이트와 **동의어 아님**.
- **논점:** 누락 비용을 계산에서 0으로 대체하지 않고 budget 확정을 막는 동작은 확인. 그러나 예비 자문에 비용 미확정이 들어갈 수 있으므로 법률 의견의 범위·UI 경고·법률 검토비용 정책은 별도 설계/실무 검토 필요. 실제 18산식 전체→95법률→D5103/D5110 문서 값과 예산·우선권 법적 분류의 일치성은 미실행. `A1-CALC-011` [ ].

## 조치 및 다음 회차

- 이번 회차 **신규 제품 실행 코드 변경 0건**. 기존 #24/#61과 중복되는 산출물 ACK 문제는 재수정 금지. 법률 검색 실패와 예비 자문/최종 확정 경계 변경은 별도 정책·사람 검토 없이는 변경하지 않는다. 본 문서 및 중앙 보드의 해당 세 ID에만 실제 실행증빙을 남긴다.
- **총 실제 함수/산식 V8 조건 34/34 독립적으로 설정한 기대와 일치** (IT 6, AX source 7, CALC 산식 7 + 법률 calc preflight 8 + 자동초안 6). 이 수치는 법률 정확도, 원본 프로젝트 테스트 합격, 제품 인수 퍼센트가 아님.
- 다음 역할: **서류담당자 `A1-DOC-018`**(네트워크 단절/재요청의 동일 명령 중복), **변호사 `A1-LAW-013`**(95위험 미승인 증거계약), **데이터담당자 `A1-DATA-007`**(원본 해시·DB 포인터·R2 바이트 일치).
- **미관찰 / null / 실제 0 / 비해당 / 상충 / source-only / 사람 승인 전**은 계속 구분. 실제 고객문서·개인정보·키·전자제출·운영배포·운영 DB 마이그레이션·법원 인가확정 처리 없음.
