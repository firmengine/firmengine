# FirmEngine A1 40차 — 23 SQL migration·법률 출처 실패·채무 원천 슬롯 충돌

- 일자: **2026-11-01 KST**, 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만.
- 시작 `main`: `917a4269c179b44b24f65188f3c1d5d28aff7f9d`; 이 영수증 생성 직전 main 재조회: `917a4269c179b44b24f65188f3c1d5d28aff7f9d`. 최근 GitHub main 커밋/PR, 중앙 보드, 39차 영수증, Drizzle journal/SQL 23개, 관련 코드·테스트를 확인.
- 역할 순환: **IT A1-IT-012 → AX A1-AX-006 → 계산사무장 A1-CALC-006** (직전 39차 DOC/LAW/DATA에서 전환).
- 비밀키·.env·실고객 문서·원본 OCR 사실값·비공개 정답 사용 없음. 모든 사실 입력은 합성 텍스트/숫자. 아래 합성 V8 검증은 TypeScript 전체 실행이나 Node CI, 실제 D1/R2, 법원·변호사 인가와 다름.

## A1-IT-012 — migration 0000~0022 메타·DDL 정적 검증 [ ] 유지

- `drizzle/meta/_journal.json` blob `45ec213999a1cf35bc65bdaf79f63a053e7d9796`; GitHub에서 `drizzle/` 디렉터리 목록과 `0000`~`0022`의 **23개 SQL 파일 각각의 소스/blob/DDL 구문을 직접 조회**.
- 독립 기대: journal index 0~22의 숫자 연속성/중복 없음, SQL 명명 대응 23:23, `when` 증가, DDL에 나타난 `ALTER TABLE` 대상이 선행 마이그레이션에서 생성됨.
- 관찰: **journal 23 / SQL 23, 누락 0, 초과 0, idx/시간 오름차순 23/23 일치**. `ALTER` 대상 `cases`, `page_derivatives`, `consultation_runs`, `extracted_features`는 모두 앞선 SQL에서 생성된 것으로 확인. 마지막 `0022_preapproval_court_correction_items.sql` blob `bec8b19780eaa951c4994530060c916f903a40fe`의 법원 보정항목 관련 2개 테이블 생성문 존재. SQL `DROP TABLE` 구문 검출 0.
- **한계:** 각 SQL을 실제 SQLite/Cloudflare D1 엔진에 적용해 실행하지 않았으며, Drizzle 모델과 전체 열 제약 대조·기존 사건 역호환·롤백·운영 적용은 미관찰. 정적 목록 일치는 D1 스키마 통과가 아님.

## A1-AX-006 — 공식 출처 조회 실패를 source preflight가 수용하는지 [ ] 유지

- `lib/case-legal-source-preflight.ts` blob `0a4bf038a97de015652d4957a56ecddd5c049bd8`, `lib/legal-monitor-status.ts` blob `846b1de1eb9f47c84e51ee829ba2ef66ee26db8d`. 독립 원문 preflight와 공식 모니터 실패 분류의 연결 여부를 점검.
- 실제 주 분기 `evaluateLegalSourceReadiness`와 `classifyMonitorObservation`의 TypeScript 타입 선언만 제거해 V8 격리 실행. 합성 원문 1쪽 정상/OCR 미완료/정규화 헤드 누락/상담 판본 불일치/공식 모니터 failed/partial **6조건**, 독립 기대 대비 **4/6 일치**.
- 독립 기대/관찰: 정상 `ready`→`ready`; OCR 미완료 `waiting_evidence`→`waiting_evidence`; 헤드 누락 `review_required`→동일; 상담 지연 `review_required`→동일. 다만 완전한 원문 패킷에 `monitorSourceHealth:[{status:"failed"}]` 또는 `partial`을 추가하면 독립 기대는 `review_required`, 실제 `ready=true`. 분류 함수는 failed 관측을 `failed/baselineUpdated=false`로 정확히 반환.
- **중요한 판정 한계:** `monitorSourceHealth`는 해당 source preflight 함수의 공식 입력 계약에 **아예 없는 필드**로, 합성 외부 상태가 무시된 것은 사실이지만 이것만으로 REST 법률 AI가 공식 조회 실패 후 실행된 것으로 단정할 수 없음. 이전 24차와 동일한 **통합 계약·법률 운영정책 검토 공백**으로 남김. 자동 법률 판단 변경·승격 코딩 없음.

## A1-CALC-006 — 동일 채권 미해결 비용/총액 슬롯 소실 신규 P1 후보 [ ] 유지

- `lib/debt-resolution.ts` main blob `1e5cf8aa0e903896205010e415d71f76ec39ba2a`, `lib/debt-source-integrity.ts` main blob `40b7c227d3e73ae141a79a71a9165603ad321c24`, `lib/domain.ts` main blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/assessment.ts` main blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, 기존 `tests/debt-resolution.test.ts` blob `98e9d53a335afaf022263f8c9a6bc6ba1a4086cb`.
- 실제 `resolveDebtRows` 함수 본문에서 TS 타입만 제거해 V8에 합성 currentFacts/moneyValue/원문참조 최소 어댑터로 실행. 동일 발행기관 `ISSUER-1001`, 동일 전체 계약번호 `LOAN-1001`, 각각 원금100·이자20, 같은 기준일을 사용. 원문 참조 및 개별 원천 Fact ID는 합성으로 재현.
- 독립 불변식: 동일 계약의 **미해결 `sourceComponentIssues` 집합이 다르면** 다른 관측을 중복으로 없애지 말고 `DEBT_CONTRACT_CONFLICT`로 보류; 단 동일 집합(순서 무관)은 정상 중복 제거.
- main 원본문 8조건 **6/8 기대 일치**, 미해결 `legal_costs`가 첫/나중 행 중 하나에만 있을 때 **2건 실패**: 2행 중 1행을 중복 제거하고 `issues=[]`. 원인은 `fingerprint`가 `sourceComponentIssues`를 비교하지 않기 때문. 별도 비용·총액 값은 원금+이자에 자동 합산해서는 안 됨.
- 수정 후보: fingerprint에 `[...new Set(d.sourceComponentIssues??[])].sort()`를 포함. 최초 수정 소스 V8 **8/8**, PR 브랜치에 저장된 소스를 재조회한 뒤 추가 10조건 **10/10** 독립 기대 일치(비용·총액 미해결 양방향, 동일 집합·정렬·공백·우선순위·보증 차이). `assessment.ts`는 `deduped.issues`가 있으면 집계완결 차단하도록 연결된 코드를 확인. 전체 계산 종단 실행은 미수행.
- [Draft PR #105](https://github.com/firmengine/firmengine/pull/105): 브랜치 `audit/a1-r40-debt-component-dedup-20261101`, HEAD `368a38c1632360d6a63b6553d827390bf42b941d`. 변경 source blob `26c8054fb1e0b9d73e3df402b52e5bbc72f8af04`, 회귀 테스트 blob `14af0ba24ea3ccd73095dfb6670734074c6c2882`. 3개 Node 테스트 블록 작성·커밋, **Node 테스트 실행 안 함**. GitHub PR 변경 파일 2개 모두 ax-site 내부로 확인. 미병합 Draft 유지·실무 검토 필요.
- 실제 D1 저장·지문 충돌·계산 18모듈·채권자목록 Word 서식·법원 재판·기존 다른 브랜치와 통합 병렬 회귀는 미검증. 보증책임·담보 인정 관련 법률 의미 변화는 주지 않음.

## 다음 교대 / 인수 보류

- 다음: **A1-DOC-018**(네트워크 복구 후 멱등/중복), **A1-LAW-018**(서식 생성과 법원 제출/인가의 별개 상태), **A1-DATA-016**(Drizzle 스키마와 23 SQL 열/제약 개별 대응).
- 3개 ID **[ ] 유지**. 제품 인수 완료 0; 최신 main 전체 Node·TypeScript·CI/빌드·staging/운영 D1/R2/Cron·브라우저·85서류·18계산·95법률·최종 Word/변호사 검수는 **실행/인증하지 않음**.
- 운영 배포·운영 DB 마이그레이션·실제 전자제출·법원 인가 확정 **수행 금지/미실행**. 실행 환경 실제 Extra High 추론 설정도 미확인.
