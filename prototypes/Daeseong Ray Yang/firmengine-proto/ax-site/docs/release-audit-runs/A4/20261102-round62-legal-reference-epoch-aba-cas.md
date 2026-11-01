# FirmEngine A4 62차 — 활성 기준정보 승인세대 경합과 법률 작업권·상태 CAS (2026-11-02 KST)

## 범위·선행조건
- 변경 허용: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 공개 Git에는 합성 사건/검증 결과만 기재; 고객 원문·원본 OCR·키·.env·승인된 정답은 기록하지 않음.
- 최초 확인 GitHub `main` HEAD: `3b9a8d6d76daa1f9404edfb5a3b9a855b893ef77`. 최근 커밋에는 A1/A2/A3 62차 보드 변경, A4 61차 `1b847a0c4802f1fb12402936ce637dfc03ad4775` 존재. 기존 A4 61차 영수증과 보드 확인.
- 읽은 main blob: `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `lib/reference-store.ts` `16164f17d4a5d849d586a1b094922b020b57103a`; `lib/reference-context.ts` `537a231c915445cf7ed5481fa5b35e63612229a7`; `lib/reference-runtime.ts` `9993469a164740e8c9128874b299a967b420e230`; `tests/case-legal-automation-flow.test.ts` `f44fbbaf233ed64355e5c49a04c7722559399c27`.
- 직전 Draft #150 HEAD `744a5f17e4189517e049419a871c9039597bc0ff`, Open/Draft/미병합. #150은 타 사건 Run 소유권 확인을 보강하지만 활성 법률 기준정보의 DB 승인세대를 CAS에 묶지는 않음. #110/#120/#123/#126/#139/#142/#146 등 미병합 PR의 보호장치가 main에 적용됐다고 가정하지 않음.
- 이번 선정 ID **A4-IT-003 / A4-CALC-004 / A4-LAW-006 / A4-DATA-004 / X-046** 5개. 모든 ID **[ ] 미완료**. A4-DOC-013·A4-AX-016은 간접 교차 검토만.
- 6역할 순환: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**. 실제 직원/변호사 판단 및 승인은 이번 회차 없음.

## 소스 기반 문제 설명 (P1 후보, 실제 운영 장애 단정 아님)
- `runWithReferenceContext`는 DB에서 읽은 불변 `ReferenceSnapshot`을 AsyncLocalStorage 요청 컨텍스트에 고정. `assertCurrent`는 `latest()`와 이 **요청 시점** `referenceIdentity()?.sha256`를 비교하므로, 이후 **다른 DB 연결**에서 활성 release가 A→B로 바뀌면 요청 내부의 A 스냅샷은 자동 갱신되지 않음.
- main `case-legal-automation.ts:86-90`의 `transition()`은 lease token·lease_until·원본 version·case revision·Head run/input SHA만 DB 단일 UPDATE에서 비교하며, **현재 활성 `legal_reference_releases` 행의 release ID·revision·SHA를 확인하지 않음**. 이에 앞선 코드의 `assertCurrent` 성공이 DB의 동시 release 변경을 선형화하지는 않음.
- Draft #150의 후보 `claim`은 Run 동일 사건/원본 SHA 확인은 추가하지만 활성 `legal_reference_releases`를 DB에서 비교하지 않음. 요청에 포착된 A 기준으로 `processJob()`이 진행되면 B 활성 후에도 A job의 lease 갱신 가능 조건이 남음.
- 실제 `referenceSnapshotHash(seed,values,metadata,bundleReview)`는 release **ID·revision을 해시하지 않음**. `restoreReferenceRelease`는 새 immutable release ID/revision을 만들어 같은 내용 hash로 복원할 수 있으므로, A→B→A와 같은 **동일 SHA, 상이한 승인세대**는 가능한 검증 조건. 이는 A 재승인 시 기존 A 실행을 반드시 금지해야 한다는 법률 정책 확정이 아니며, 승계 허용 여부는 실무자 결정이 필요.
- 합성 조건에서 `draft_ready` 상태가 DB에 기록될 가능성을 확인. 실제 Word 바이트 생성·법률 95개 실행·직원/변호사 승인까지 잘못 진행됐다는 증거는 없음.

## 실제 실행 — Node 22.16.0, SQLite WAL 파일형 두 독립 연결
- 로컬 재현: `/mnt/data/firmengine-a4/round62_legal_transition_reference_epoch_sqlite.test.mjs` (합성값만 포함). `node --test` 최종 **11/11 하위 조건 기대 일치**, TAP 상위 그룹 포함 **12/12 pass**. 최초 시험에서는 SQLite 반환 객체의 null-prototype 때문에 `deepStrictEqual` 하네스 assertion 1건 실패했으나, 필드별 확인으로 정정하고 전체 재실행 통과. 실제 제품 결함을 해결한 것이 아닌 **시험하네스만 정정**.
- 이전 56~61차 스크립트와 62차를 함께 로컬 Node로 재실행: **53/53 TAP test pass**. 과거 결함 부정대조를 포함하므로 제품 안전성 53건 합격이 아님.
- DB 합성: case-A, sourceDataVersion=7, revision=3, Head=run-A, input SHA=64자 '1', job.reference SHA=64자 'a', lease-A 유효; 법률 release A1(id=release-A1,revision=1,SHA=a) → 다른 연결에서 활성 B2(id=release-B2,revision=2,SHA=b) 승인 COMMIT → A3(id=release-A3,revision=3,SHA=a) 복원. Node SQLite WAL `foreign_keys=ON`.
- main `transition` SQL **실제 blob에서 전사**. Draft #150 `claim` SQL **PR patch에서 전사**. `SHA fence`와 `release ID+revision+SHA fence`는 오로지 합성 대조용 SQL이며 Github 코드 수정이나 운영 반영 아님.

| 입력·상태 | 독립 기대 | 실제 SQL 관찰 | 해석 |
|---|---|---|---|
| active=A1, valid lease-A | 정상 transition 1 | main **1**, draft_ready | 정상 대조 |
| 유효 lease-A 이후 다른 연결에서 active=B2 COMMIT | DB 현재 B | **B2 확인** | 경합 환경 확인 |
| active=B2, old A1 worker | 구 작업은 draft_ready로 최종화 금지 | main transition **1**, draft_ready | **P1 부정대조 재현** |
| active=B2, synthetic active SHA CAS | 0 | **0** | SHA fence 조건부 보완 |
| active=B2, synthetic ID/revision/SHA CAS | 0 | **0** | 승인세대 fence 조건부 보완 |
| active=A3(동일 SHA A), old A1 worker | 승인세대 구분 필요 | SHA-only CAS **1** | **A→B→A ABA 부정대조** |
| active=A3, old A1 ID/rev CAS | 0 | **0** | 새 승인세대 구분 |
| active=A3, new A3 ID/rev CAS | 1 | **1** | 정상 신규세대 허용 |
| lease token 변경(새 워커 소유) | old lease transition 0 | **0**, 새 lease 보존 | 정상 소유권 대조 |
| active=B4, old A run/job, #150 동일사건 owner-guard claim | 기존 승인세대 old job을 재선점하면 안 됨 | **claim 1** | #150과 남은 교차 공백 |
| active=B4, old A1 job + 합성 승인세대 claim CAS | 0 | **0** | 실제 제품 반영 전 |

## 미실행·승인 경계
- 이번 회차는 **법률 scheduler claim / 법률 job 최종 상태 transition**의 DB 조건만 검증. 상담→서류→OCR→10분 quiet calculation→95 법률→Word→독립 직원/변호사 승인→실제 보정 이벤트 전체 종단 실행 **미실행**.
- 저장소 전체 Node-native 테스트/TypeScript/Next CI **미실행**. staging Cloudflare D1/R2/Cron, 실제 HTTP 두 워커, R2 성공 후 D1 실패/ACK 유실, 중복웹훅, timeout/429/503, 운영 n8n **미실행**. n8n 설계 문서는 운영 실행을 입증하지 않음.
- 원문 변경/갈음 철회/관할 판본 변경/기한 미확정/Word 재생성/과거 사람 승인 무효화는 **법률 인계 관점에서 source-only 검토**; 이 회차 재현하지 않음.
- 단계값 **미관찰 / null / 0 / 비해당 / 상충 / source-only / 승인 전** 구분. 누구의 승인을 추정하거나 법원 인가로 승격시키지 않음. 운영 배포·운영 D1 migration·고객자료 변경·실제 전자제출·인가 확정 수행하지 않음.

## 결론·복구·후속 ID
1. **P1 후보, 미해결:** 코드의 선행 스냅샷 검증만으로는 active release 변경과 `claim/transition` 사이의 원자성 확보 불가. Draft #150에 보완 필요 근거 기록; 다른 PR의 충돌 및 성능 영향 검토 없이 main 실행 로직에 직접 삽입 금지.
2. 최소 설계 검토안: 법률 job의 고정 release **ID+revision+SHA** 및 계산 Run·Head·lease를 함께 보존하고 DB 단일 상태변경의 승인세대 검증·영수증/감사 원자성을 확보. 다만 seed fallback, 복구 재사용 정책, release 롤백 인정 조건, 여러 active 행·동시 승인, old job 폐기/새 job 재생성 시점은 IT·계산사무장·변호사 검토 필요.
3. 다음 ID: `A4-IT-003` / `A4-CALC-004` / `A4-LAW-006` / `A4-DATA-004` / `X-046`; 이어 `A4-DOC-013` / `A4-AX-016`로 95법률→Word 재생성 및 기존 검수 무효화 점검.
4. 실제 staging D1 두 워커/상태 재조회, 오류 ACK·429/503·R2 부분성공, 사람 승인/법원 서식 적합성은 별도 검증·실무자 인수 전까지 **[ ] 유지**.

**62차 선정 ID 최종 인수 0/5. 제품 전체 최종 인수 0건.**
