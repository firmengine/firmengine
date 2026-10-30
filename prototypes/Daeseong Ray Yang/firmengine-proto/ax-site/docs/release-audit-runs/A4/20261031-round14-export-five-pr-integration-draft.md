# FirmEngine A4 — 14차, 수동 Export 5개 Draft PR 결합 후보 및 원자성 계약 감사

- 작성: 2026-10-31 KST; 작업 시작 기준 `main` SHA `e5d580e4d0ee0dc2fafb6749a20fb940d0be70be`; 영수증 게시 직전 main SHA `e5d580e4d0ee0dc2fafb6749a20fb940d0be70be`.
- 수정 허용범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 별도 통합 브랜치 `audit/a4-r14-export-atomic-integration-20261031` / [Draft PR #61](https://github.com/firmengine/firmengine/pull/61), head `4c236dd1c0dba7f0838fd3c22cbbc9fcfef61822`.
- 이번 집중 역할: **계산사무장 → 변호사 → IT → 데이터 → AX** 순서; 서류담당자는 전회차 검토 내용 보존, 이번에는 실제 Word 편집/검수 재현을 하지 않아 인수 미완. 체크 ID **A4-IT-003, A4-CALC-016, A4-LAW-013, A4-DATA-003, A4-AX-003, X-046**. 모두 **[ ] (부분검증)**, 최종 제품 인수 완료 **0건**.
- 선행 확인: 최신 main/recent commits, main `db/schema.ts`·`server-store.ts`·`app/api/cases/[id]/export/route.ts`·`lib/export-artifact-transaction.ts`, 단일 인수 보드, 직전 13차 영수증; Draft PR #24/#31/#35/#40/#45의 head/변경 코드 및 겹치는 파일 확인.
- 선행 PR head: #24 `dc5d93d45e944466ba126d2b998345d6c2f38843`; #31 `4999628852d4cec9135c6c33bf60c24f817bce18`; #35 `7f2c58c8da0dd1d5870b8324bebb14bc0917f942`; #40 `fd1e1df9f8252af01dd58e5c8e8e7e94188a52e2`; #45 `0330edff2e84564504ca74a16386aa0d9369d492`. 이 다섯 PR은 기존 **미병합 Draft**, 새 #61 생성만으로 병합된 것이 아님.

## 인계 경계/통합 초안

`상담→요구서류→OCR→원본 quiet 10분 계산→95 법률위험→Word→직원/변호사 순차 검수→법원 보정` 가운데 이번 회차 실제 변경·검사는 **Word 수동 Export 저장/증빙 인계**에 한정. 앞뒤 다른 stage는 스키마·가드 정적 연결만 확인했고 실제 종단 실행/법률 승인은 하지 않음.

#61은 요청 UUID를 받는 UI 및 Export route, 요청원장 0023 테이블, OCR `dataVersion`와 사건 `revision/storage_token`과 청구된 request identity를 결합한 동일 D1 manifest SQL CAS, 기존 artifact SQL 소속/판본 확인, 감사 2건과 원장 commit을 같은 D1 batch로 연결하는 **통합 후보 코드**. R2 PUT 이전 요청 claim, R2/SQL 성공 후 D1 commit ACK 불확실 시 자동 삭제 금지, 완료된 요청 재전달은 D1 artifact + **R2 실제 바이트 SHA**를 재확인하고 같은 생성물 반환. 과거 A→새 B 이후 늦은 A는 새 Export로 재발급하지 않는다. claim 원본 `storage_token`과 저장 snapshot token 일치 가드도 추가.

**주의: 0023 migration을 실행하거나 운영 서버/사이트에 배포한 적 없음.** 읽기전용 재조정/고아 증빙의 인수 및 안전한 재시도는 여전히 설계/실무 검수 게이트이다. 두 **서로 다른** UUID 워커가 함께 R2/SQL까지 작성하고 한쪽만 CAS 승리한다면 패자의 고아 데이터가 남을 수 있다. 이는 자동삭제 대상 아님.

## 실제 실행 입력 / 독립 기대 / 관찰 결과

기구: 공개 데이터가 아닌 **가상 사건 `synthetic-A`, `synthetic-B`**, SQLite 메모리 DB의 `cases`/source/version/receipt/artifact/events 구조 및 변경된 원장 SQL에 대응하는 합성 원자 UPDATE 배치. 실행: `python /mnt/data/firmengine-a4/sql_atomic_contract.py`; 2026-10-31 회차에서 결과 다시 확인 **10/10 예상 일치**. 대상은 **Python sqlite3 SQL 계약 모형**이지 통합 TypeScript HTTP route 자체가 아니다.

| 합성 입력/순서 | 독립 기대 | 실제 관찰 |
|---|---|---|
| 같은 사건·동일 request UUID, 두 워커가 동일 claim 제출 | 영속 원장 1행·승자 1 | **PASS** |
| 다른 request UUID 두 워커가 revision/storage token 동일하게 출발 | 현재 manifest 1회만 갱신·패자는 비현재 | **PASS**, 패자 원장 claimed 잔류 조사 |
| artifact SQL 행 0개인데 해당 ID로 완료 시도 | manifest/receipt 변경 0 | **PASS** |
| artifact ID가 다른 사건 소유 | cross-case 완료 차단 | **PASS** |
| artifact revision이 사건 구판본 | 구판본 완료 차단 | **PASS** |
| source dataVersion 4→5, 사건 revision 불변 | 저장 0/검토 필요 | **PASS** |
| 감사 이벤트 INSERT가 의도적으로 실패 | manifest와 receipt 모두 롤백 | **PASS** |
| D1 batch COMMIT 뒤 HTTP ACK만 유실 | 원장 committed + 감사 2건 + manifest 보존 | **PASS** |
| 같은 committed 원장 다시 완료 시도 | 중복 committed/생성 이벤트 방지 | **PASS** |
| 오래된 storage token으로 새 claim | 선점 0 | **PASS** |

입력의 수치 버전(4→5), 사건/원장/아티팩트 키는 전부 가상이며 개인정보 또는 실제 고객 OCR 값 사용 없음. 법률 의미, 법원 승인, 실업무 기한은 시험 대상 아님.

GitHub 통합 branch diff의 **18개 변경 파일 전부 지정 경로 내부**. 통합 route/store의 정적 검사 9항목 일치(요청 선등록, 동일 CAS, 원본 token 고정, 두 감사 이벤트 batch, 완료 원장, R2 바이트 대조, 독립 source 버전 CAS, 불확실 완료 보존 등). 이 **정적 확인은 CI 통과가 아님**. 5개 PR에서 복사한 `tests/*.test.ts`는 **이번 회차 미실행**; Node/TypeScript 전체 검사, Next build, 실제 Cloudflare staging D1/R2/Cron, 실제 두 워커 HTTP 재현, 429/503/timeout, 원본 갈음 철회·관할판본 변경, 10분 계산→95법률→Word/직원/변호사 검수/실제 법원 보정 이벤트 **전부 미실행**. n8n은 설계 문서와 운영 워크플로를 동일시하지 않음.

## 재현 결론/남은 P0/P1 게이트

- 합성 SQL에서는 성공한 manifest가 성공한 receipt·감사 2건과 결속되며, 출처 버전 경합·과거 artifact 참조는 차단됨. 실제 통합 코드는 **Draft**, 기능적 완결/운영 검증과 동의어 아님.
- fail-closed: 요청 UUID 없는 구형 클라이언트 HTTP 400; R2 실패 후 `claimed` 원장은 운영자 판단 없이 자동 재선점 불가; 비확정 ACK에서는 R2/SQL 삭제 금지. 이 상태의 복구 UI/Outbox/성공영수증 read API는 별도 필요.
- 다른 UUID 두 워커 경쟁, reference release/서식판본 변경의 최종 동일-트랜잭션 결속, Word 생성 중 입력 내용 변경, 미관찰/null/0/비해당/상충/source-only 구별 및 사람 승인 원장 인계는 여전히 미검증.
- PR #61을 **병합/배포하지 말 것**: TypeScript build/Node test, staging migration 0023 (운영 migration 금지), staging R2/D1 실제 장애 주입, UI 하위호환성, 법률 실무자·서류담당자 최종 검수를 통과하기 전에는 제품 합격이 아니다.
- 다음 A4: `A4-IT-005, A4-IT-006, A4-DOC-012, A4-CALC-016, A4-LAW-013, A4-AX-003, X-047` 중 미검증 2~5개를 골라 실제 route/저장 실패 후 receipt 조회의 정확성, 두 워커·고아 파일 안전 복구, 원본/관할 판본 전환에 따른 이전 승인 무효화를 하나씩 재현. staging 접근 없으면 **미실행**.

**운영 D1·R2·Cron·사이트·실제 문서·실제 제출/인가 상태 변경 없음. 고객정보/키/env/비공개 정답 공개 Git 기록 없음.**
