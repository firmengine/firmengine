# FirmEngine A1 72차 — 구판본 workflow null / 공식 법률 출처 장애 / 동일 Fact 소득 중복

- 기준 회차: 2026-11-02 KST 11:48. 소스 `firmengine/firmengine` main, 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 감사 소스 확인 시점 main HEAD: `26aa3071a6963761bfda6310dea14d9a8bb9418c`. 기존 71차 회차 영수증 및 중앙 단일 보드, 관련 source/schema/tests와 최신 PR 확인. 현재 main의 제품 코드는 변경하지 않음.
- 역할 순환: **IT → AX → 계산사무장**. 체크 **A1-IT-011 / A1-AX-006 / A1-CALC-004**, 모두 `[ ]` 미완료.
- 실제 스키마 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` 확인. 과거 테스트 `tests/case-schema-migration.test.ts` blob `48bbaf9ad3486c1216ea2c21552060e72c2d052d`, `tests/income-resolution.test.ts` blob `396bc23785130e82eb62af5fe626fe31e4e43582`, 38·71차 영수증 검토.
- 검증 수준: GitHub 실제 소스의 TypeScript 선언을 소량 제거한 **V8 격리 실행**, 의존부는 명시된 합성 stub. `caseWorkflow`의 `structuredClone`은 JSON 안전한 가상 객체 대상으로 JSON round-trip 대체. 독립 oracles는 아래 명기. 전체 프로젝트 Node/CI/브라우저/D1/R2/모델 호출과 혼동 금지.

## A1-IT-011 — 구판본 JSON의 명시 null 계약

- 소스 main `lib/case-workflow-state.ts` blob `e43ffe37a4f832d6f486633a6c7ae9054bb4e8d1`, 소비 `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378` 및 `lib/case-workflow-server.ts` blob `7e1a96e79afcdc0ff81e950fe52556b2794ab465`, `lib/server-store.ts` 원본 blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`.
- 입력/독립 기대/관찰(6): (1) workflow 미입력→기본 배열, 기대일치; (2) 구판본 누락 tasks→기본 배열·version3 유지, 일치; (3) `tasks:null`→복구 필요·제어된 응답 기대, 실제 `.findIndex` **TypeError**; (4) `requirements:null`→제어된 응답 기대, 실제 `.some` **TypeError**; (5) 알 수 없는 미래 필드 보존, 일치; (6) 명시적 `tasks:[]`는 정상 빈 배열, 일치. **main 격리 4/6**. 실제 HTTP 500 관찰은 아님.
- 수동 의미 변경 없이 읽기 경계에서 **명시 null/scalar를 HTTP 409 검토필요로 거절**, 누락 구필드는 그대로 허용하는 작은 변경을 독립 **[Draft PR #171](https://github.com/firmengine/firmengine/pull/171)** 작성. 세 파일 모두 ax-site 내부: `lib/case-workflow-contract.ts` blob `3cb06a69f5c1daf4df32c1c9b288481ecfb8e625`; `lib/server-store.ts` 후보 blob `b6d303950e4b9056ebf07b6714748cce68d376a0`; `tests/a1-r72-workflow-null-guard.test.ts` blob `41cf0795c7e66b6e77f1fedd547e195a7e6071f1`. **단독 Node 22 `--experimental-strip-types --test` 3/3 테스트 블록 실제 통과**, 커밋된 helper/test blob이 실행한 로컬 파일의 Git hash와 일치함. **getCase/HTTP 통합 실행 및 전체 TypeScript/CI는 미실행**, PR Draft·미병합. 다른 에이전트 파일 변경 없음.
- 저장된 malformed case를 자동 보정하지 않고 기존 JSON·revision 유지. 구판본 사건의 명시 null 사유와 운영 복구 UX는 IT/데이터 검토 필수. `[ ]`.

## A1-AX-006 — 법률 출처 monitor 실패의 source-preflight 누락

- 소스 main `lib/case-legal-source-preflight.ts` blob `0a4bf038a97de015652d4957a56ecddd5c049bd8`; `lib/legal-monitor-status.ts` blob `846b1de1eb9f47c84e51ee829ba2ef66ee26db8d`.
- 독립 기대: 증빙/상담/법률 모니터 출처 건강이 모두 확인됐을 때만 해당 source-preflight ready. 입력은 활성 증빙1, `doc:1` head 정상, OCR 완료, 상담 최신, fallback=false, 나머지 조건 고정. 원본 evaluate 함수에 **계약 밖 필드** `officialSourceHealth`를 추가한 합성 8조건: 정상 true, OCR 미완 false, 증빙 0 false, 상담 stale false, source head 누락 false는 일치(5/8); monitor `failed`·`partial`·`null`은 독립 기대 false이나 실제 **모두 ready=true**(3 불일치). 별도 `classifyMonitorObservation`는 `failed`→`failed`, `partial`→`partial_failure`, 첫 success→`first_observation`으로 분류됨.
- 원인: 실제 source-preflight 함수의 입력 계약과 DB 검사에는 공식 모니터 health가 포함되지 않음. 실제 법률 외부 검색 실패를 주입했거나 95개 법률 AI 호출 결과가 거짓 승인된 것은 **아님**. 법률 적용범위/법원별 출처 신뢰도 및 sourceHealth 게이트 정책은 변호사·기준정보 담당 승인을 요하므로 코드 임의 수정 없음. 기존 24·40차 미해결 재검증, `[ ]`.

## A1-CALC-004 — 동일 Fact에 상충하는 소득 인정/집계결정

- 소스 main `lib/income-resolution.ts` blob `f370c4b14fd347089708c5c3241fa9c72522d4bf`; 기존 [Draft PR #97](https://github.com/firmengine/firmengine/pull/97) 후보 blob `d340e7c0b051ce0fede8f897b05854e2904953db`. PR #96은 별도 월평균 집계 승인게이트.
- V8 대상은 **원본 `resolveIncomeRows` 함수 본문**과 PR 후보 같은 함수. `currentFacts`는 주어진 f1/f2 목록, `sourceIdentity`와 `sourceObservationSignature`는 `null` stub으로 두어 **동일 Fact ID exactKey 경로만** 재현. `observationCore`와 `moneyFingerprint`는 의존성 격리용 JSON 동등변환. 소스 2행, 금액 100원, 2026-01-01~01-31, 동일 원천 f1. 독립 기대는 **같은 증빙+같은 검토결정만 병합**, 다르면 2행과 승인상충 경고.
- 8조건: 동일 검토 상태→병합(일치); recognition·aggregationTreatment·sourceCalculationRole·aggregationReviewed·aggregationReviewReason 각각 상충→병합 금지+상충 코드 기대이나 main은 모두 두 번째 행 제거(5 실패); 기간 다른 행→분리(일치); Fact ID 다른 행→분리(일치). **main 3/8, PR #97 8/8 독립 기대 일치**. 이 수치는 exact-Fact branch 격리로, sourceIdentity/structured-source 및 실제 18계산·월평균 승인 검증을 뜻하지 않음.
- 기존 PR #97이 수정 처리 중이고 동일 파일/집계 논리의 PR #96과 합성 필요. 중복 패치하지 않음. 법률상 사업/급여 인정이나 계산 승인 없음. `[ ]`.

## 범위·후속

- 신규 Draft PR **#171** 1건(IT null contract만). 기존 결함 재확인 AX·CALC는 제품 코드 중복 수정 0건. main 실행 코드 수정 0건, board 3 ID만 추가 예정.
- 미관찰 / null / 명시 0 / 비해당 / 상충 / source-only / 인간 승인 전을 혼합하지 않음. 테스트 금액과 ID는 모두 합성, 실제 고객 문서·개인정보·원본 OCR 사실값·키/.env·비공개 정답을 사용하거나 Git에 기록하지 않음.
- **Node standalone 3/3만 실행**; 전체 프로젝트 Node 테스트·TypeScript·CI·staging D1/R2/Cron·실제 브라우저/모델·85 서류·18 계산·95 법률·C01/C02/C04·보정명령/서식·실무자 승인은 **미검증**. 운영 배포, D1 운영 마이그레이션, 전자제출, 법원 인가 확정 **미실행**. 실제 Extra High 추론 설정 확인 불가.
- 다음 회차는 **서류담당 A1-DOC-013 / 변호사 A1-LAW-014 / 데이터담당 A1-DATA-013**로 전환.
