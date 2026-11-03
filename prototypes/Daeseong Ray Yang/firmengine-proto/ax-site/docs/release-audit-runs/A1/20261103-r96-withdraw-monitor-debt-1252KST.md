# FirmEngine A1 — 96차 문서 철회·공식출처 실패·채무 구성행 충돌 감사 (2026-11-03 12:52 KST)

- **범위:** `firmengine/firmengine` `main`, 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위. 역할 **IT담당자 → AX담당자 → 계산사무장**. A1-IT-006 / A1-AX-006 / A1-CALC-006만 점검. 각 ID **[ ] 유지**.
- **읽기 시작 main HEAD:** `16d35bb9c36fb766c3df2ee613e06b78a9c676cf` (2026-11-03 03:32:15 UTC). 보드 blob `38c4c9ad503c5ddc39b36dcd84c8d3aa60d0766f`. 최근 A3 96차 2건, A2 96차 2건, A1 95차 커밋과 PR #88/#105/#216 현황, 보드 및 95차 A1 영수증, 코드·schema·기존 테스트를 읽었다.
- **스키마·기존 테스트:** `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` (`cases.revision/storage_token`, `documents`, `page_jobs.status/lease_until`), `tests/case-commands.test.ts` blob `a388177e8120174ee57c683264292b86faf76f2b`, `tests/debt-resolution.test.ts` blob `98e9d53a335afaf022263f8c9a6bc6ba1a4086cb`. 기존 A1 32/40/62/72/76차 보드 영수증도 참조.
- **실행 방식·엄격 한계:** GitHub에서 조회한 **실제 TypeScript 함수 본문**을 내장 JS V8에서 타입 주석만 제거하여 실행. 합성 사건·문서·Fact 사용. `touchCase/currentFacts`, `validSourceRef/moneyValue`, DB `prepare/bind`는 표시한 합성 스텁. SQL은 실제 prepared 문장/바인딩을 검증했지만 D1/SQLite 엔진으로 실행하지는 않음. 첫 시도 TypeScript 변환/런타임 오류는 **전부 폐기**한 후 본문 변환을 바로잡아 재실행; 아래 수치는 성공적으로 실행된 재검증만 집계. **Node 프로젝트 테스트, tsc, CI, 브라우저, staging D1/R2/Cron, 공식 출처 실제 네트워크 오류 주입, 운영 실행은 미실행**.

## A1-IT-006 [ ] — 부모 철회와 하위 page_jobs 중단이 같은 CAS인가

- **소스 SHA:** `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a` (실제 `retractDocument`), `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378` (impact.withdrawPageJobs 계산), `lib/case-command-store.ts` `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01` (guarded SQL).
- **합성 입력/독립 기대/관찰:** active parent→child→grandchild, 무관 active other, 이미 deleted pastChild. `retractDocument(parent)` 실제 본문은 parent·child·grandchild deleted, other active, 원본 입력 불변, 이미 deleted 문서 재철회 거부(**3/3 기대 일치**). 그러나 실제 main `guardedStatements`에서 `document.retract` SQL을 실행 가능한 JS로 분리해 `prepare/bind` 호출을 계측하면 대상은 **['parent']**뿐. 독립 기대 **['parent','child','grand']** 대비 불일치. 다른 8개 추가 guard/인자/잘못된 입력 조건과 합쳐 main 관련 관측 **11/12 기대 일치**.
- **기존 수정안:** [Draft #88](https://github.com/firmengine/firmengine/pull/88) `lib/document-withdrawal-targets.ts` blob `de1b174ddd31af9195ce5fe33185d52912ce9246`. **동일 PR helper 실제 본문** V8에서 parent+child+grand 3개 guarded SQL 생성, 동일 CAS token 인자 유지, 무관 문서 미포함, parent 누락/빈 목록/null/비문자값은 쿼리 생성 전 거절, 중복 ID 제거 등 **8/8 독립 기대 일치**. 실제 D1 batch rollback/lease worker 경쟁/85서류·자식 다중 삭제는 별도 통합 검증 필요.
- **코드 조치:** 해당 결함에 이미 Draft #88 존재하므로 동일 범위 중복패치 없음. PR은 미병합, 인수 완료 아님.

## A1-AX-006 [ ] — 공식 법률 출처 실패/부분실패/미관찰을 법률 AI 준비에 연결

- **소스 SHA:** `lib/case-legal-source-preflight.ts` `0a4bf038a97de015652d4957a56ecddd5c049bd8` (`evaluateLegalSourceReadiness`), `lib/legal-monitor-status.ts` `846b1de1eb9f47c84e51ee829ba2ef66ee26db8d` (`classifyMonitorObservation`).
- **독립 예상 vs 관찰 (V8 실제 함수):** activeDoc=1, evidencePage=['doc:1'], normalized=['doc:1'], processingComplete=true, legacyFallback=false, 상담·업무 최신이라는 정상 입력 → `ready=true` (기대). 무문서, OCR 처리대기, 상담 재분석, 업무-상담 실행 불일치, 레거시 원문, normalized head 누락도 각각 기대 상태로 차단(**기본 7/7**). 별도 공식 모니터가 `failed`, `partial`, `null`인 3조건을 **합성 확장 입력**으로 더했지만 함수 시그니처에 `monitorStatus`가 없어 모두 `ready=true` 반환(출처 미확인 시 `review_required`을 요구하는 보수적인 독립 기대와 3/3 불일치). 총 **10/13 기대 일치**.
- **별도 모니터:** 실제 `classifyMonitorObservation` 본문에서 failed→failed, partial→partial_failure, 신규 success→first_observation **3/3**. 따라서 모니터 쪽 상태 감지는 구현되어 있으나 **preflight로 전달되는 계약이 본문에 없음**. 합성 extra property 무시의 함수 계약 관측일 뿐 실제 공식 사이트 장애가 법률 AI 출력을 승인했다는 증명은 아님.
- **코드 조치:** 없음. 공식 모니터와 개별 법률 판정의 소스 freshness/실패 처리 정책은 LAW/AX 담당자 검토가 먼저 필요. 공식 조회 실패를 자동으로 법률 인정/비인정으로 결론 내리지 않는다. source-only/null/failed/partial/approval-pending 분리.

## A1-CALC-006 [ ] — 원금·이자·비용·담보/양도/보증 구성행의 중복 제거

- **소스 SHA:** `lib/debt-resolution.ts` main `1e5cf8aa0e903896205010e415d71f76ec39ba2a`; [Draft #105](https://github.com/firmengine/firmengine/pull/105) 수정 본문 blob `26c8054fb1e0b9d73e3df402b52e5bbc72f8af04`.
- **합성 데이터:** 채무 2행, 동일 `LOAN-1001` 계약 ID, 동일 issuer `ISSUER-1001` 증빙 quote, principal 1,000,000원, interest 0원, 기준일 2026-10-27; 행별 source Fact 2개. validSourceRef·moneyValue·currentFacts는 명시적 deterministic 합성 스텁; dedup/충돌 판정은 **실제 함수 전체 본문** 실행. 독립 기대 형식: `[남은 행수, duplicates 수, DEBT_CONTRACT_CONFLICT 수]`.
- **실제 11조건:**
  - 양쪽 sourceComponentIssues 없음 → [1,1,0] main/PR 모두 기대.
  - `legal_costs` 첫 행만/둘째 행만, `total` 첫 행만/둘째 행만, 2슬롯 대 1슬롯 → **각각 기대 [2,0,1], main은 [1,1,0]**, 즉 검토대상 구성행을 뒤 행 삭제로 소거(**5건 불일치**). PR #105 모두 [2,0,1].
  - 동일 구성행 집합의 순서만 역전, 명시 빈 배열 vs 미관찰, 다른 priority, 다른 interest, 다른 issuer → main/PR 모두 독립 기대 일치.
- **집계:** main **6/11**, PR #105 **11/11** 기대 일치. 미해결 legal_costs/total의 값 자체나 법적 인정액을 계산한 테스트가 아님. 담보·양도·보증/전부명령·채권자목록 서식으로의 종단 연결 및 18계산·공식 원장 검증 미실행.
- **코드 조치:** 이미 Draft #105 존재, 기존 PR의 범위 내 겹침을 피하며 main 수정 없음. 병합 전 계산사무장/변호사/데이터담당자 검토 필요.

## 최종 범위/다음 ID

- **현재 독립 합성 실행:** IT **11/12**, AX **10/13**, CALC **6/11** main 기대 일치 (총 **27/36**). 기존 Draft 수정안 별도 계측 IT helper **8/8**, CALC resolver **11/11**. **모든 ID [ ]** — 테스트 비율은 제품·법률 인수율이 아니다.
- **새 코드 결함의 중복 수정 없음:** A1-IT-006은 #88, A1-CALC-006은 #105 미병합 PR로 이미 분리. A1-AX-006은 공식 법률 정보 수집 실패와 개별 판단의 관계가 미확정이므로 정책/호출 경로 심사 전 임의 수정 금지.
- **다음 순환:** 서류담당자 **A1-DOC-007**(동일 파일 재등록/철회/교체+감사 이벤트), 변호사 **A1-LAW-008**(배우자 재산·명의신탁·면제재산), 데이터담당자 **A1-DATA-007**(원본 SHA·D1 기록·R2 포인터/ACK 불명확성).
- **불인증/금지:** 85서류/갈음 A←B+C/C01/C02/C04, 보정명령, 동시 사건 전체 플로우, 실제 OCR, 18계산·95법률·서식, Node/CI, staging, 변호사/법원 승인, 사이트 배포는 모두 **미검증**. 운영 배포·D1 운영 마이그레이션·실제 전자제출·법원 인가 확정하지 않음. 실제 Extra High 설정 확인 불가.
