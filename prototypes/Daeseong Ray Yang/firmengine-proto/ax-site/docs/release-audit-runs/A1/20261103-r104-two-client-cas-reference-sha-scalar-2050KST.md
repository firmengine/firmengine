# FirmEngine A1 — 104차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-03 KST, 20:50 회차)

- **대상:** `firmengine/firmengine`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. **담당 관점 순환:** IT담당자 → AX담당자 → 계산사무장. 103차 `A1-DOC-010 / A1-LAW-011 / A1-DATA-010` 영수증 다음 미인수 ID 3개를 이어받음.
- **시작 main HEAD:** `742e5252644bbf2962570108ed29a512d279f504` (이전 103차 마지막 HEAD `fd32b356dc783e88c5d0523271c7d03d9364f999` 이후 다른 축의 커밋 존재). 중앙 보드 blob `bf6d0166bc59367bdc351ba66e545c0fab2f34b2` 읽음. 최근 커밋·미병합 Draft PR #49, #116, #121·스키마 및 기존 영수증 #70/#80/#84 확인.
- **검증 범위:** 원본 `saveCase` SQL 조건문을 그대로 복사한 SQLite WAL 테스트(**실제 Python sqlite3 3.46.1**); GitHub 실제 TS `extractionCacheKey`·`statusOf`의 함수 본문을 **타입 선언만 제거**하여 Code Mode V8 `Function`에서 직접 실행. SQL은 실제 D1 대신 최소 합성 스키마에 적용. 소스 주입·DB 상태는 모두 합성. **Node·타입검사·전체 CI·두 실제 브라우저·Cloudflare D1/R2/Cron·PDF/OCR·법률/계산 종단·사이트 배포·법원/변호사 승인은 실행하지 않음**.
- **실행 집계:** main SQL **14/14**, main OCR 캐시 **11/13**, main feature 상태 **14/22** = 혼합된 부분 테스트 **39/49 독립 기대 일치** (제품 정확도·전체 인수율 아님).

## A1-IT-010 [ ] — 동일 사건 두 클라이언트 CAS·revision/token 경합

- **실제 main 소스 SHA:** `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- **실제 검사 대상 SQL:** `UPDATE cases SET payload=?, revision=?, name=?, updated_at=?, storage_token=?, mutation_category=? WHERE id=? AND revision=? AND storage_token=?`와 `INSERT INTO analyses ... SELECT ... WHERE EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=? AND storage_token=?)`. `saveCase` 전체 호출을 실행한 것은 아니며 Cloudflare D1 `batch` 및 HTTP 응답 경로는 미실행.
- **합성 입력:** SQLite WAL 실제 파일, 독립 연결 2개, 사건 A/B 각각 초기 `revision=3, storage_token=t0`; 두 연결이 사건 A의 같은 상태를 읽은 뒤 첫 연결은 `revision=4/token=t1`, 두 번째는 stale `token=t0` 저장 시도. 이후 같은 revision을 유지하며 review-only `t4`, artifact-only `t6`로 토큰을 회전시켜 오래된 토큰으로 덮어쓰기 시도. B는 독립 갱신. 마지막에 승자/패자 CAS 토큰으로 guarded `analyses` INSERT 시도.
- **독립 기대 및 실제 관찰 (Python sqlite3 3.46.1, 14/14):** 첫 저장 변경행 1, stale 0, 최종 A=(4,t1), B 초기=(3,t0), 잘못된 revision 0, 잘못된 token 0, review-only token 교체 변경행 1, 이전 review token 0, 새로운 token artifact-only 변경행 1, 이전 artifact token 0, B 별도 수정 1, A 불변 (4,t6), 승자 조건부 분석행 1, 패자 0. 모두 기대 일치.
- **남은 위험:** 실제 두 브라우저 인증/역할·서버 `getCase` snapshot·R2 저장·D1 원자성/ACK 유실·자동 재시도·명령 영수증 전체 경로를 실행한 것은 아님. 70차와 유사한 SQLite 수준 재검증임을 구분. 인수 [ ] 유지, 코드 수정 없음.

## A1-AX-010 [ ] — OCR 캐시 판본에 runtime reference SHA 포함

- **실제 main 소스 SHA:** `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a` (`extractionCacheKey`), `lib/pipeline.ts` `79dce5f9822cf2debe1f886ab93ece4a256659e6` (페이지 작업의 키 호출).
- **기존 [Draft PR #116](https://github.com/firmengine/firmengine/pull/116)** HEAD `858928cb119583f5115e21a48c4dd915dd0f8304`, 수정 도메인 blob `7c0baf061e22d1bf1a62a9cfa6f0522fb5c4b86f`, 수정 pipeline blob `c7a16274c1f3c61cec376dac6eb7b51f900d828e`. **Draft·미병합**.
- **합성 입력:** `DOC-A` / SHA `a×64` / pages [2,1] / mapping income-v1 / prompt-v1 / ocr-v1 / rules-v1 / 승인 reference SHA `b×64`. 쌍별 비교 13조건: 완전 동일, 페이지 순서 역전, 문서 ID 교체, 원본 해시 교체, 페이지 조합 교체, mapping/prompt/model/rule 변경, reference SHA만 `b×64 → d×64` 변경, reference SHA 누락, 동일 reference 유지, 두 번째 원본 해시 변경.
- **독립 기대:** 동일 의미의 키·페이지 순서만 다른 경우 동일, 실제 판본·원본·매핑/프롬프트/모델/규칙/reference SHA가 다르면 다른 키. **관찰:** main **11/13**, Draft #116 **13/13**. main 반례는 reference SHA 단독 변경·reference SHA 누락이 **동일 키**; Draft #116은 구분. PR의 `pipeline.ts` 두 호출 위치 모두 `referenceIdentity()?.sha256` 전달 코드도 정적 확인.
- **남은 위험:** 실제 reference 승인/시행일 변화·worker 캐시 히트·D1 snapshot/모델 재실행을 수행하지 않았음. 46/80차에서 발견한 기존 결함이며 신규 결함으로 중복 집계 금지. 기존 #49의 calculation run-head 조회 시 판본 교체 문제는 이번에 재실행하지 않았음. [ ] 유지.

## A1-CALC-010 [ ] — 0/null/음수/비해당/상충·비정상 scalar 구분

- **실제 main 소스 SHA:** `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`의 `statusOf`. 기존 [Draft PR #121](https://github.com/firmengine/firmengine/pull/121) HEAD `b7c63a9614f0cd4363c01ba058b92afd37612003`, 수정 blob `aa9a1f53519831c5bc571cdaa9cd3a53267bcea6` (**Draft·미병합**).
- **합성 입력 22조건:** 명시 0, 음수 -12, null, undefined, unknown, blocked+null, not_applicable+0, NaN, +Infinity, -Infinity, 빈 문자열, 공백/탭, 줄바꿈, blocked+빈 문자열/공백, blocked+0/-1, FACT_CONFLICT+0/NaN, not_applicable+null, unreviewed+unknown, 문자열 `"0"` (공식 법적 금액 승인이 아니라 상태 분류만).
- **독립 기대:** 0과 음수는 산술 관측값으로만 유지, null/undefined/unknown/공문자는 missing(또는 blocked), NaN/무한대는 blocked, 상충 사유는 conflict, 비해당는 not_applicable, aggregate blocked + 개별 유효수치는 provisional. **관찰:** main **14/22**, PR #121 **22/22**.
- **대표 반례:** main `NaN/±Infinity` → `computed`, 공백/빈 문자열 → `computed`, blocked+공문자 → `provisional`. 또한 표준 `JSON.stringify({value:NaN,status:"computed"})`는 `{"value":null,"status":"computed"}`가 되어 미관찰(null)과 잘못된 계산값이 저장표현상 혼동될 위험이 있음. 실제 D1 저장·18개 계산·법률 인정 상태 전이는 미실행.
- **코드 조치:** 기존 #121이 수정하므로 중복 PR/코드 수정 없음. [ ] 유지.

## 회차 조치 / 미완 인수 / 다음 확인

- **Git 반영:** 이 감사 영수증의 고유 파일 + 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **정확히 A1-IT-010/A1-AX-010/A1-CALC-010 3개 행만 보존 병합**. 세 ID 모두 미완료 [ ]; 실제 코드 수정·PR 병합·운영 배포 없음.
- **미해결 결함:** runtime reference SHA 없는 캐시 충돌 (#116), 비정상 계산 스칼라의 확정값 오표현 (#121), 별도 run-head 판본 감시 (#49) 검토. 법적 인정/승인 정책은 이 회차에 변경하지 않음.
- **다음 담당 역할:** 사용자·서류담당자 → 변호사 → 데이터담당자. **다음 ID:** `A1-DOC-011`(갈음 A←B+C 중 B만 제출/행정 C 제외), `A1-LAW-012`(서울424 접수일/관할 판본), `A1-DATA-011`(Fact 정정·철회 이력/현재값).
- **종단 구분:** 상담→85서류→OCR→정규화→18계산→95법률→자동초안·직원문안검수→보정명령, C01/C02/C04, 동시 사건 모두 전체 종단 **검증완료 0건**. 이번 합성 부분테스트를 전체 CI·staging·공식 법원 서식·실제 변호사 승인과 혼동하지 않음. 운영 D1 마이그레이션·실제 고객정보/문서/키 게시·전자제출·법원 인가 확정은 실행하지 않음. 실제 Extra High 추론 모드 적용 여부 확인 불가.
