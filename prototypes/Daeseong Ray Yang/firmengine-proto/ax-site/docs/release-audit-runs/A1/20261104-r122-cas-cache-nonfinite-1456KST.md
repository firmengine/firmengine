# FirmEngine A1 — 122차 코드 완결성·상호 기능충돌 감사 (2026-11-04 KST)

- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 만. 역할 순환: **IT담당자 → AX담당자 → 계산사무장**(직전 A1 121차: 사용자·서류담당자 → 변호사 → 데이터담당자).
- 시작 및 재확인 `main` HEAD `2c0cc038c33b75bb0b1136b940d104b1e53de4f0`, 보드 blob `a6caaf0d0a4dac100c313a2a4918f823795e9999`. 최근 커밋(A1 r121, A2/A3 이후 감사 보드 변경), 현재 오픈 Draft PR #49/#116/#121, `db/schema.ts`, `tests/case-calculation-feature-store.test.ts`, A1 r104/r121 영수증 및 실제 함수/호출부를 읽음.
- **실제 실행 방법:** A1-IT-010은 `lib/server-store.ts`에 선언된 UPDATE/guard SELECT를 최소 합성 SQLite WAL DB에 그대로 사용하고 두 독립 연결로 실행한 Python sqlite3 테스트. A1-AX-010/A1-CALC-010은 GitHub에서 읽은 **실제 TS 함수 본문**을 타입 선언만 제거하여 Code Mode V8 `Function`으로 실행. Draft PR 후보도 저장된 PR blob을 따로 읽어 같은 입력으로 격리 실행. 이 방식은 소스 일부 직접실행이나 합성 DB 검사일 뿐 프로젝트 전체 Node/CI, 서버 saveCase 호출, D1/R2/Cron, 2개 브라우저·실제 OCR/법률·계산 산출 및 사이트 배포가 아님.

## A1-IT-010 [ ] — 두 세션 동일 사건 CAS + 원자적 롤백

- 원본 파일/blob: `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 사용한 소스 SQL: `UPDATE cases SET payload = ?, revision = ?, name = ?, updated_at = ?, storage_token = ?, mutation_category = ? WHERE id = ? AND revision = ? AND storage_token = ?` 및 `INSERT INTO analyses (...) SELECT ... WHERE EXISTS (SELECT 1 FROM cases WHERE id = ? AND revision = ? AND storage_token = ?)`. 실행 DB는 SQLite 2연결, WAL, 임시 스키마(사건·분석·명령 영수증) 및 오직 합성 사건 A/B.
- 입력: 사건 A,B `revision=5/token=t0`. A 클라이언트가 `revision=6/token=t1` 저장, B의 오래된 토큰 `t0`으로 동일 사건 재저장. 다른 사건 B는 독립 갱신. A의 review-only `revision=6/token=t2`, artifact-only `revision=6/token=t3` 후 구 토큰으로 재저장 시도. 현재 토큰과 구 토큰으로 guarded analysis INSERT. 마지막으로 단일 합성 트랜잭션에서 A의 CAS UPDATE 성공 직후 분석 PK 중복을 강제로 발생시켜 `ROLLBACK`.
- 독립 기대: 동일 사건 원본 판본에서 첫 쓰기만 성공, 재시도·잘못된 ID/판본·구 토큰은 변경행 0, 다른 사건은 독립, 동 revision의 review/artifact도 token 회전, guarded 부수행은 현재 토큰에만 기록, 후속 실패 시 update+부수행 원자적 롤백.
- **실제 Python sqlite3 관찰: 19/19 기대 일치** (첫 클라이언트 1·구 클라이언트 0, 별도 사건 1, 동일 revision 토큰 회전 2회 1씩, stale 재시도 0, 분석 승자 1/패자 0, 의도적 중간 오류 후 A의 `revision=6/token=t3` 복구, 두 연결에서 최종 A/B 독립 확인). 이는 실제 D1 batch 또는 R2 snapshot atomicity가 증명된 것이 아니므로 **[ ] 유지**. 기존 r104의 14개 SQL 조건에 합성 트랜잭션 롤백/다른 연결 관찰을 추가한 재확인.

## A1-AX-010 [ ] — OCR 캐시 판본의 runtime reference SHA

- 원본/blob: `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/pipeline.ts` `79dce5f9822cf2debe1f886ab93ece4a256659e6`. main의 `processNext`와 `requestReverification` 두 `extractionCacheKey` 호출부에서 `referenceSha256` 전달 부재를 정적 확인.
- 기존 [Draft PR #116](https://github.com/firmengine/firmengine/pull/116)은 **open/draft/unmerged**, 함수 후보 blob `7c0baf061e22d1bf1a62a9cfa6f0522fb5c4b86f`. PR body/patch도 재조회함.
- 합성 입력: `doc-a`/원본 SHA `a×64`/페이지 [1,2]/매핑 income-v1/프롬프트 prompt-v1/모델 model-v1/룰 rules-v1/승인 기준정보 SHA `b×64`. 16개의 쌍별 동일성 기대: 완전 동일·페이지 순서만 바꿈·문서ID·원본·페이지구성·매핑·프롬프트·모델·룰·runtime SHA 변경·runtime SHA 누락·빈 SHA·동일 SHA·중복 페이지 등.
- 독립 기대: 페이지 순서만 달라지면 동일 키, 나머지 식별자 또는 runtime 기준 SHA가 바뀌면 다른 키. **main 13/16**. 3개 불일치(runtime SHA b→d, SHA 누락, 빈 SHA): **main은 동일 캐시 키를 반환**. PR #116 후보 함수 **16/16**. PR은 SHA가 주입됐을 때 분리하나, **실제 요청 시 runtime snapshot이 반드시 존재한다는 사실은 미검증**. 따라서 PR 합성 통과를 제품 캐시 완결로 승격하지 않으며 **[ ] 유지**.

## A1-CALC-010 [ ] — 0/null/음수/비해당/상충과 비정상 숫자 분리

- 원본/blob: `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a` 의 실제 `conflict` + `statusOf`. 기존 [Draft PR #121](https://github.com/firmengine/firmengine/pull/121) **open/draft/unmerged**, 후보 blob `aa9a1f53519831c5bc571cdaa9cd3a53267bcea6`.
- 합성 입력 29개: 0/-12/-0, null/undefined/unknown, blocked+null/0/음수, not_applicable+0/null, NaN/±Infinity, 공문자·스페이스·탭·줄바꿈, blocked+공문자, FACT_CONFLICT/DISPUTED+숫자·null, reviewed_basis+0, 문자열 `"0"`, `source_only`+공문자 등. 일반 계산 출력 이외에 `courtApprovalInferred=false`처럼 합법적인 불리언·복합 구조 값도 존재하므로 blanket 숫자 강제 기대는 적용하지 않음.
- 독립 기대: 명시적 0/음수는 값 존재(법률상 적격 인정 아님), null/unknown/공문자는 missing 또는 blocked, NaN/무한대는 blocked, 상충은 conflict, 비해당는 not_applicable, aggregate blocked+유효 component는 provisional.
- **실제 원본문 V8 main 19/29**. 불일치 10개: NaN/±Infinity `computed` 3, 빈값/공백/탭/줄바꿈 `computed` 4, blocked+빈값/공백 `provisional` 2, source_only+빈값 `provisional` 1. 기존 PR #121 후보 원본문 **29/29**.
- 직렬화 반례: `JSON.stringify({value:NaN,status:"computed"})` → `{"value":null,"status":"computed"}`로 값 null과 승인된 계산 상태가 불일치할 수 있음. 실제 DB JSON 저장·18계산·95법률/서식 소비는 미실행. **[ ] 유지**.

## 코드조치·종합·다음 인수

- 이번 회차 현재 main 선택 SQL/함수 합성은 **IT 19/19, AX 13/16, CALC 19/29 = 51/64**. 나머지 **13조건 기대 불일치**는 기존 #116/#121에서 지적한 **재현된 기존 결함**이며 운영 장애 13건을 의미하지 않음. 기존 코드 결함에 중복 덮어쓰기/새 PR을 만들지 않았음. **제품 실행 코드 변경 0건.**
- #116/#121은 서로 다른 파일을 고치지만 #49도 calculation feature store를 변경하므로, **#49/#121 병합 순서·통합 회귀**, #116 pipeline 다른 PR 충돌, 최신 main 재검토가 필요. 안전한 범위의 이번 작업은 테스트·영수증 및 보드 기록뿐임. CI·제품 테스트 통과로 표시하지 않음.
- 중앙 보드 `A1-IT-010`, `A1-AX-010`, `A1-CALC-010`의 기존 이력은 그대로 보존하고 각 ID **[ ]** 유지. 새 영수증 고유 파일로 기록.
- **다음 역할:** 사용자·서류담당자 → 변호사 → 데이터담당자. 다음 ID: `A1-DOC-011`(갈음 A←B+C 행정 C 제외), `A1-LAW-012`(접수일/관할 판본), `A1-DATA-011`(Fact 수정·철회 후 현재값/역사값).
- 미검증/미관찰: 전체 화면·API·DB·역할 통합, 85종 서류 및 C01/C02/C04, 18계산·95법률, 두 브라우저/실제 D1/R2/Cron, 활성 reference 판본, 공식 서식/실무자 검토, 제품 전체 CI/배포. **종단 인수 0건**, 법률상 자동 승인/인가 확정 없음. 운영 배포·운영 D1 migration·전자제출 수행하지 않음. 실제 Extra High 모드인지 확인되지 않아 해당 주장 없음. 실제 고객정보, OCR 원문, 원본 PDF, 키/.env/비공개 정답 기록 없음.
