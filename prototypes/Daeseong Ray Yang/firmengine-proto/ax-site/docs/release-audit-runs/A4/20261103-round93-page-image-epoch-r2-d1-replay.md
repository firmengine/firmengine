# FirmEngine A4 제93차 — OCR 페이지 이미지 PUT의 원천판본·철회·중복 재생성 경합

작성일: 2026-11-03 KST. 수정 가능 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만. **전부 합성 입력**. 고객/사건 원본·개인정보·OCR 사실값·API 키·법률 인정값 없음.

## 1. 실제 읽은 GitHub main·PR·스키마·이전 감사

- 시작 `main` HEAD `41df3b6363a4d255c562e2b389e207c442cd7a95` (2026-11-03T00:36:19Z; A3 r93), 이전 main의 A4 r92 `063051763ce06f4be54dd28584db50f276716bcc`. 최근 A3/A2/A1 커밋을 확인.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 최초 blob `2c7927a7314c056c264a3dd4fcccabed45b49e98`. A4 체크 ID 원문 먼저 확인.
- 실제 원본 GET/PUT `app/api/cases/[id]/documents/[doc]/route.ts` blob **`db20b9248e68d3ec412b5d3f4254254e0ffc8412`**. `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/case-command-store.ts` blob `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`. 원문 문서 등록 POST blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`.
- A4 r91 원본 PUT 철회 경합, r92 원본 revision/token guard 회차 영수증을 확인. Draft [#23](https://github.com/firmengine/firmengine/pull/23) R2/D1 ACK 보존, [#201](https://github.com/firmengine/firmengine/pull/201) POST 저장 이후 과삭제 방지, [#208](https://github.com/firmengine/firmengine/pull/208) **원본** PUT epoch guard 모두 Open/Draft/미병합임을 확인. 원본 PUT과 달리 **페이지 이미지** PUT의 최종 CAS는 여전히 원천판본과 독립이다.

## 2. 독립 신규 결함 후보 — 페이지 이미지 원본 변경 후 stale 승격

`main`의 페이지 PUT은 최초 `record()`에서 활성 문서를 확인하나 R2 `bucket().put()` 뒤 최종 저장은 다음 조건뿐이다.

```sql
UPDATE page_jobs
SET image_key=?, image_hash=?, status='pending', stage='waiting',
    error=NULL, attempts=0, updated_at=?
WHERE id=? AND case_id=? AND image_hash IS NULL
  AND status='awaiting_upload';
```

구체적 합성 경합: A가 활성 `DOC-93`/case revision 1/token T1을 읽고 페이지 이미지 PUT 시작 → B가 사건의 해당 문서 또는 상위 문서를 철회해 revision 2/token T2로 변경 → **하위 `page_jobs`의 status가 구 상태 `awaiting_upload`로 남는 상황** → A가 저장을 끝내면 기존 SQL 변경 1행, `pending`으로 OCR 진행 가능. 부모 철회 시 자식 job 정리 누락 가능성은 `case-command-store`의 `document.retract` guard가 대상 ID의 row만 변경하는 구조와 연결된다. 이는 실제 운영 사건 장애를 확인한 것이 아니라 소스 기반 합성 조건이다.

별도 **동일 해시 거짓 멱등**: 코드의 `if(job.image_hash===hash) return stored:true` 와 UPDATE=0 후 `latest.image_hash===hash`는 `withdrawn`/role 변경 및 case revision/token 변경을 확인하지 않는다. 철회된 `page_jobs`에 같은 `image_hash`가 남으면 `stored:true`로 표시할 수 있다. 저장 성공은 실제 법적 증빙 승인·OCR 완료·Word 검수 완료가 아니다.

## 3. 실제 수행한 3종 증빙 (Node 22.16.0 + SQLite WAL)

**(a) 신규 독립 합성 11/11 기대 관찰 일치**: `node --test /mnt/data/firmengine-a4/r93/20261103-round93-page-image-epoch-race.test.mjs`, 실행 출력 `node-r93-results.txt`. 별도 DB 연결 2개, 가상 사건 SYNTH-93/문서 DOC-93/hash a×64/가상 R2 key. 정상 1행; 2워커 승/패 1/0; 상위 문서 철회+자식 job 잔존 → 기존 main SQL 1행(부정대조), revision/token 가드 SQL 0행; 해시 같지만 철회된 row의 선행·후행 멱등 2종 기존 TRUE(부정대조)/가드 FALSE; review-only token 변경 기존 1/가드 0; `NULL` 관측과 `0` 행수 분리. 독립 원본 코드 설명과 SQL 조건을 대조했으며 **실제 Next API/Cloudflare 런타임 함수 실행은 아님**.

**(b) GitHub에 등록한 동일 코드 Blob의 Node 재실행 8/8 기대 관찰 일치**: `docs/release-audit-runs/A4/20261103-round93-page-image-epoch-two-worker.test.mjs` = Draft PR #210의 `tests/page-image-source-epoch-r93.test.mjs`; 두 파일의 Git blob SHA는 모두 **`681220403faaa511d89e3e152485ce78b038420d`**. 로컬로 동일 Blob을 복사한 `page-image-source-epoch-r93-branch-test-copy.mjs`의 `git hash-object`도 정확히 동일한 SHA였고, `node --test` **8/8, 0 fail**. 테스트는 원본 부정대조 + 후보 revision/token, OCR role, SQL document SHA, 동시 1/0, missing ACK 분리. 로컬 시험은 실제 소스 전체를 import하지 않은 **독립 SQL 격리 시험**이다.

**(c) 직전 r92 원본 PUT 합성회귀 재실행**: 기존 `/mnt/data/firmengine-a4/r92/20261103-r92-original-upload-source-snapshot-cas.test.mjs`를 Node에서 실행해 **16/16 기대 관찰 일치**. r92의 기존 결함 부정대조 포함. #23/#208 병합 상태의 라우트를 실행한 것은 아님.

총 11 + 8 + 16 = **35개 독립 기대 관찰 일치**, 그중 여러 건은 기존 취약 동작을 의도적으로 관찰한 부정대조이다. **제품 결함 0건, 출시 안전성 35건 합격이라는 의미가 아니다.**

## 4. 비운영 코드 수정 후보 — Draft PR #210

[Draft PR #210](https://github.com/firmengine/firmengine/pull/210)은 `audit/a4-r93-page-image-source-epoch-20261103` 브랜치에만 존재한다.

- `lib/server-store.ts`: 동일 `getCase` 객체의 WeakMap에 저장된 원본 revision/storage token 노출(`caseSnapshotIdentity`). 별도 시점에서 DB를 다시 읽어 원본판본을 잘못 섞지 않는다.
- `app/api/cases/[id]/documents/[doc]/route.ts`: 최종 `page_jobs` UPDATE를 사건 revision+token, SQL 문서 SHA, 문서 ID/페이지/role과 연결. 선행 및 후행 `image_hash` 멱등 재조회도 활성판본·철회/held 여부 검사. UPDATE=0과 비정상/미관찰 ACK를 분리한다. R2 보관물 자동삭제나 법적 승인 자동승격은 구현하지 않는다.
- `tests/page-image-source-epoch-r93.test.mjs`: 8개 독립 SQLite 부정/양성 회귀.
- 브랜치 3파일 모두 `ax-site/` 내부임을 GitHub compare API로 확인. 현재 **미병합**이고 코드 실행을 GitHub checkout에서 TypeScript로 수행하거나 전체 빌드 검증하지 않았다.
- `route.ts`는 Draft #23/#208과 **동일 파일 충돌**, 새 `caseSnapshotIdentity`는 #208과 **동일 API 중복**. 하나의 통합 PR·실제 TypeScript/Next CI·D1/R2/Cron staging·사람 검수 전 **단독 merge 금지**.

## 5. 6역할 순환 및 체크 ID (최종 인수 0/5)

역할 검토 순서 **AX → IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터**. 사람 결재를 실제 수행하지 않았으며 검토 역할을 기술 관점으로 적용했다.

- **A4-IT-012 [ ]**: 구 사건판본 페이지 이미지 최종 CAS, child-job 철회 누락 시 기존 UPDATE=1, 후보 CASE epoch guard=0. 실제 API 2워커와 전체 CI 미실행.
- **A4-DOC-013 [ ]**: 새/철회된 증빙과 페이지 역할 변경 후 이전 Word/직원·변호사 검수의 무효화 여부는 이번 SQL 시험으로 **보증 불가**. 실제 직원·변호사 승인 미실행.
- **A4-DATA-003 [ ]**: 동일 해시 재전달 중 `withdrawn` job의 기존 `stored:true` 반환 부정대조, 후보 readback fence 부분 검증. 실 웹훅 중복·outbox/inbox 미실행.
- **A4-AX-013 [ ]**: 페이지 이미지 재등록·OCR 재처리 후 10분 계산→95 법률→Word 재생성→승인 인계 실제 수행 **미실행**. 오래된 해시를 법률상 확정값으로 취급하지 않는다.
- **X-047 [ ]**: R2 이미지 PUT 완료 후 D1에서 source revision/token이 바뀌어 CAS=0인 조건을 모의. 후보는 경합 차단하지만 **미참조 R2 객체 자동 정리·D1 ACK 유실·429/503/timeout 복구·운영 R2 검사**는 미실행.

단계 구분: `0`=확정 UPDATE 0행; `null`=SQL 값 없음; `미관찰`=응답 실패/ACK 불확정; `비해당`=대상 아님; `상충`=문서/사건판본 부일치; `source-only`=근거만 보존; `승인전`=사용자/실무자 결재 없음. 모든 범주 분리.

## 6. 미실행·복구·다음 검토

- **미실행**: 원본 TypeScript 모듈 import, Next.js/typecheck/lint/build/전체 CI, 실제 Cloudflare staging D1/R2/Cron, HTTP 두 워커, R2 실제 바이트 SHA, 실패/응답 유실/429·503·timeout 주입, 중복 webhook 운영 n8n, 상담→서류→OCR→10분 quiet calculation→95 법률→Word→직원/변호사 검수→법원 보정명령 종단시험, 공식 법원 서식/실무자 승인, 사이트 배포.
- **실패 복구 방향**: 1) SQL/CaseData/원본 SHA+revision/token+문서 활성상태가 같은 판본인지 읽기전용 대조 2) 확정 0/1/미관찰 분리 3) R2 미참조 객체는 원장·소유권·상태 확인 전 삭제 금지 4) #23 + #208 + #210 라우트 충돌 해결 후 같은 두 워커로 검증 5) #201 등록·감사 이벤트 손실/고아 작업까지 통합 6) 이후 Word 검수 무효화.
- **다음 ID**: `A4-IT-006`, `A4-DOC-012`, `A4-CALC-014`, `A4-LAW-008`, `X-047` (첫 검토 관점은 IT 대신 계산/법률로 순환).
- **n8n**: 설계와 실제 운영 워크플로는 다르며 이번 실제 워크플로 접속/실행 없음. 운영 배포, D1 운영 마이그레이션, 전자제출, 인가 확정 **전부 수행하지 않음**.
