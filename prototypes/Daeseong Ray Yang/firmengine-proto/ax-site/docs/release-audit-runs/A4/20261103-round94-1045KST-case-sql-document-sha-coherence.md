# FirmEngine A4 제94차 — CaseData와 D1 SQL 문서 SHA 불일치 시 R2 업로드·페이지 재활성화

작성: 2026-11-03 KST. 작업 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. **합성 사례·해시만 사용. 실제 고객/법원 사건정보, OCR 원본, 법률 확정값, 비밀 없음.**

## 1. 읽은 기준 (main / PR / 실제 코드 / 이전 영수증)

- 시작 확인 `main` HEAD **`1cb909ddfe4cd5b19474c3770b6615951f546893`**. [commit](https://github.com/firmengine/firmengine/commit/1cb909ddfe4cd5b19474c3770b6615951f546893); GitHub compare to `main` = identical. 단일 인수 보드 최초 Blob `0f88443b5d8d2d2f5f51d9757d143676c89cd7a3`. 최근 커밋/미병합 PR 검색.
- main `app/api/cases/[id]/documents/[doc]/route.ts` Blob **`db20b9248e68d3ec412b5d3f4254254e0ffc8412`**, `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `lib/case-command-store.ts` `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`, POST 문서등록 `274f7a6e73988ca254607422d2ff2cddd1326ac0` 대조.
- 10분 quiet `lib/case-data-recompute.ts` Blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`, Word `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`, 법원 보정 `lib/preapproval-correction-item-store.ts` `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`, 법률 `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92` **정적 읽기만**. 실제 10분 타이머/95 법률/Word/사람 승인 호출 아님.
- 직전 [r92](20261103-round92-0845KST-original-put-source-epoch-fence-pr208.md)·[r93](20261103-round93-page-image-epoch-r2-d1-replay.md) 영수증과 [Draft PR #23](https://github.com/firmengine/firmengine/pull/23), [#201](https://github.com/firmengine/firmengine/pull/201), [#208](https://github.com/firmengine/firmengine/pull/208), [#210](https://github.com/firmengine/firmengine/pull/210) 변경 코드를 확인. 모두 PR 후보, **main 미병합**.

## 2. 새로운 조건부 P1 후보 — 사건 증빙 SHA와 SQL 원본 SHA의 시작점 불일치

현재 `record(id,doc)`는 CaseData에서 **해당 ID의 활성상태만** 확인한 뒤 SQL `documents`의 `sha256`을 반환하며 두 SHA의 동일성·활성문서 ID 유일성을 검증하지 않는다. CaseData 문서 `DOC94.sha256=A`, SQL documents `DOC94.sha256=B`, 사건 revision=1/token=T1이 유지된 상태라면, PR #208의 원본 PUT 최종 CAS 및 PR #210의 페이지 PUT 최종 CAS는 둘 다 **SQL B를 기준으로 UPDATE 1행**을 허용하고, PR #210의 페이지 readback도 B를 반환한다.

이 조건은 **SQL과 CaseData가 서로 상충하는 복구/관리자 변경/데이터 손상**을 가정한 합성 상태다. 정상 문서 등록만으로 같은 상태가 생긴다는 증거는 없으며, 실제 운영 사고는 확인하지 않았다. 또한 SQL SHA A→B→A 복귀는 변경세대 없이는 감지할 수 없다.

| 독립 SQL 합성 입력 / 오라클 | 실제 관찰 |
|---|---|
| T01 CaseData A = SQL A | 원본 포인터 CAS=1 |
| **T02 CaseData A ≠ SQL B, revision/token 유지** | **#208 상당 SQL 원본 PUT CAS=1 (부정대조)** |
| **T03 CaseData A ≠ SQL B, revision/token 유지** | **#210 상당 페이지 PUT CAS=1 (부정대조)** |
| T04 별도 CaseData/SQL 동등성 선행 가드 | 상충 입력 차단=0 |
| T05 구 사건 revision | 원본 PUT 0 |
| T06 구 storage token | 페이지 PUT 0 |
| T07 원본 시작 SHA A, 저장 전 SQL B 변경 | 원본 PUT 0 |
| T08 SQL SHA A→B→A, 변경세대 없음 | 원본 PUT 1 (잔여 위험) |
| T09 두 독립 워커 원본 PUT | CAS 승자 1 / 패자 0 |
| **T10 PR #210 상당 readback과 SQL B** | SQL B 페이지 `pending` 조회, CaseData A와 상충 |
| T11 CaseData 문서 철회, SQL/epoch 미동기화(비정상 합성) | 페이지 SQL 1 (부정대조) |
| T12 동일 해시 readback에서 CaseData 불일치 | 추가 parity guard 판정 false |

**실제 실행**: Node.js 22.16.0 `node --test /mnt/data/firmengine-a4/r94/20261103-round94-sql-case-document-sha-fence.test.mjs`: SQLite WAL **독립 연결 2개**, **12/12 기대 관찰 일치**, 0 fail. 실제 Github #208/#210 최종 SQL 문자열을 독립 DB에서 실행했으며, 정상 Next.js 함수 전체·실 D1/R2 요청을 실행한 것이 아니다. 부정대조 포함, 제품 안전성 통과율 아님.

**회귀 재실행**: r92 Node 합성 **16/16**, r93 합성 **11/11** = **27/27 기대 관찰 일치**; 기존 위험 부정대조 포함. 새로운 helper native Node `node --experimental-strip-types --test` **8/8**; 실 파일 `git hash-object`가 GitHub Blob `f984eca48e947c1477415a6cafb0f4c03eedd388` (helper), `9ee914674dee920483772bdd362194078ea64b9a` (테스트)와 **일치**한다.

## 3. 작은 비운영 변경 후보 — [Draft PR #213](https://github.com/firmengine/firmengine/pull/213)

브랜치 `audit/a4-r94-case-sql-document-sha-coherence-20261103`. `record()`에서 **하나의 활성 CaseData 문서 ID, SHA 형식, SQL 문서 SHA 완전 일치**를 강제하는 선행 read-only 방어. 출처 상충 시 409로 보류한다. 변경 3개 파일은 route 1, `lib/evidence-document-read-gate.ts` 1, `tests/evidence-document-read-gate-r94.test.mjs` 1로 모두 `ax-site/` 내부다. 현재 **Draft/Open/미병합**; 실제 Next/TS·전체 CI 불가, R2 PUT 및 D1 최종 CAS·응답유실의 완전한 복구 보장 아님. 승인 없이 법률 자료로 승격 금지.

PR #208/#210과 같은 `record()`와 import를 수정하여 **충돌 가능**. #23의 R2 ACK 보존, #201의 문서 POST OCR job 보존과 하나의 복구 계약으로 통합하고, SQL 변경세대/DB 진실원장 정책을 승인받기 전 단독 병합 금지. [#208 의견](https://github.com/firmengine/firmengine/pull/208#issuecomment-6593247790), [#210 의견](https://github.com/firmengine/firmengine/pull/210#issuecomment-6593248410), [#23 의견](https://github.com/firmengine/firmengine/pull/23#issuecomment-6593248938).

## 4. 역할 순환 / 중앙 체크 ID — 합격 0/5

검토 역할 순환 **계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자**. 실제 직원/사무장/변호사 승인은 없고 각자의 관점에서 기술·증빙 상태만 평가.

- **A4-IT-006 [ ]**: SQL/CaseData SHA 상충 시 기존 원본·페이지 저장 성공, Draft guard 409. R2↔D1 ACK 손실 복구/실 DB 미검증.
- **A4-DOC-012 [ ]**: 원본 SHA 상충 후 Word 초안의 기존 직원→변호사 승인 재검토/무효화 **미실행**. 원본 PUT 성공은 인가값 아님.
- **A4-CALC-014 [ ]**: 10분 quiet time 코드 `600_000` 정적 확인만; 상충 증거가 청산가치/변제계획 재계산·인계되는 실제 실행 **미실행**.
- **A4-LAW-008 [ ]**: 법원 보정 원문·기한·원본 SHA 결속 코드 정적 확인만. courtReference 중복·기한 null 및 법률 인가/공식 원문·실무자 승인 **미실행**.
- **X-047 [ ]**: WAL SQL의 상충/중복 CAS와 재조회 경합 합성 실행. 실제 R2 업로드→D1 응답유실/503/429/timeout와 staging **미실행**.

상태를 독립 구분: **미관찰**=D1/R2 응답 없음; **null**=조회값 없음; **0**=확정 0행; **비해당**=대상 조건에 해당하지 않음; **상충**=CaseData/SQL SHA 불일치; **source-only**=원천만 보존; **승인전**=법률/직원 확정 아님. 사건 원문/결과 보존은 삭제·자동 승인과 별개다.

## 5. 미실행/복구/다음 회차

**미실행**: 전체 원본 TypeScript/Next CI, HTTP 실제 두 워커, staging D1·R2·Cron, 운영 n8n(workflow 설계와 운영 실체 구분), 실제 PDF/OCR, 법률 95·관할판본/보정기한, Word 재생성, 직원/변호사 승인, 법원 접수증. 운영 배포, 운영 D1 migration, 실제 전자제출, 법원 인가 확정 **미실행**.

**복구 규칙 제안**: (1) CaseData/SQL 활성문서 ID와 SHA 선행 대조 (2) 최종 사건 epoch 및 문서 version/ownership CAS (3) SQL 저장 성공/확정 실패/미관찰을 분리 (4) 원본 R2 바이트/SQL 포인터/작업행/이벤트 영수증 각각 확인 (5) 지연 응답으로 기존 Word·직원·변호사 승인을 자동 승격하거나 R2를 삭제하지 않음 (6) 관할·법률판본 교체 시 초안 무효화는 별도 실무자 검증.

**다음 체크 ID** `A4-IT-005`, `A4-DOC-013`, `A4-DATA-003`, `A4-AX-013`, `X-047`. 우선 PR #23/#201/#208/#210/#213 통합 시 동일 `record` 함수 계약·부모 철회·R2/D1 503 응답유실·두 워커 테스트를 실제 통합 소스로 재실행.
