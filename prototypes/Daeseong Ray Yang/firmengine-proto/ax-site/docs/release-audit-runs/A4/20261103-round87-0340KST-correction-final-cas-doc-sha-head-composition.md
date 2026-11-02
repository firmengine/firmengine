# FirmEngine A4 87차 — 법원 보정항목 최종 CAS·SQL 원본 SHA·동일 사건번호 답변·스냅샷 결합 검증

작성: 2026-11-03 03:40 KST. **범위 고정:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 안의 A4 실행흐름/동시성/예외·복구만. 아래 모든 사건·문서·SHA·법원 사건번호는 **합성 입력**이며 실고객·법원 PDF·OCR 원문·키/.env·비공개 정답 없음. 법적 승인/실제 보정명령 이행/전자제출을 의미하지 않음.

## 1. 소스/HEAD/이전 인수 확인
- 시작 main SHA: `fc8db6cfaddfff4dc9433bfd595a0fafbcf0f8a1`. 최근 main 커밋은 A3 87차(`fc8db6c`,`d11db30`), A2 87차(`64f44ca`,`4fe7c48`), A1 86차(`f7771d8`). 본 문서는 작성 시점 HEAD의 별개 감사이며, 다른 에이전트의 main/보드 변경을 덮어쓰지 않는다.
- 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `4df306cb37e3c9b6930ac0b6a7201e9419807a71`의 미완료 ID, A4 85차·86차 영수증 선행 확인.
- 메인 원본 `lib/preapproval-correction-item-store.ts` blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`; DB `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; D1 `drizzle/0022_preapproval_court_correction_items.sql` blob `bec8b19780eaa951c4994530060c916f903a40fe`; 기존 원본 Node 시험 `tests/preapproval-correction-item-store.test.ts` blob `b78fa006c9c003b72b79fd79f74630e342b97238`; GET/POST API `app/api/cases/[id]/correction-items/route.ts` blob `baf7b7198adeac39e90673a54ab6248243c9fa3b`.
- 원본 등록 라우트 `app/api/cases/[id]/documents/route.ts` blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`: 일반 등록은 새 ID를 만들고 `touchCase` 후 `saveCase`; 따라서 아래 동일 ID SQL SHA 직접변경은 **비정상 DB 직접 변경/복구를 가정한 장애 주입**이지 정상 업로드에서 실제 발생했음을 확인한 것 아님.
- Draft PR #19(복수 법원 명령에 대한 답변 오연결) 및 Draft PR #196(D1 읽기 스냅샷/미관찰) open·미병합, 두 PR 모두 같은 `lib/preapproval-correction-item-store.ts`를 수정. 두 변경을 단순히 병합했다고 최신 원문·검수승인·권한·ABA까지 해결하는 것은 아님.

## 2. 독립 실행 시험 및 독립 기대값

환경 Node.js **22.16.0**, `node:sqlite` **파일 WAL 두 연결 A/B**. migration 0022의 버전·HEAD 테이블 컬럼/제약과 main의 `INSERT OR IGNORE ... SELECT ... WHERE EXISTS(case revision/source dataVersion and expected HEAD)` / `UPDATE HEAD` SQL 형태를 독립 전사한 별도 합성 검증. **원본 TypeScript 실행/실 D1 실행이 아님.**

가상 사건 `C1` revision 4, dataVersion 7, 증빙 `D1` SHA `a×64`, 구 HEAD `correction-A`, 신규 HEAD `correction-B`. 승인 결과는 모든 테스트에서 `courtApproval=false`; 기한 미관찰은 `deadline=null`, SQL 조회 누락은 0/NULL과 분리.

| 번호/입력 | 독립 기대 | 실제 관찰 |
|---|---|---|
| 1 초기 item 기록+HEAD 배치 | version=1, HEAD=1 | 1/1 |
| 2 두 워커 초기 HEAD 동시 생성 | 승자 COMMIT 1, 패자 rollback, orphan 0 | 1/0·version 1 |
| 3 두 워커 동일 구 HEAD 갱신 | 선행 A만 유효, 후행 B rollback | HEAD B만 남고 version 2 |
| 4 source dataVersion 7→8 | 구 version 최종 기록/HEAD 0 | 차단, 구 HEAD 보존 |
| 5 case revision 4→5 | 구 revision 최종 기록 0 | 차단 |
| 6 B가 SQL D1 SHA A→B 변경, revision/version 불변 | **main 최종 CAS에는 SHA 불검사 → 부정대조 저장 1** | 저장 1, 과거 SHA 증빙 HEAD 가능 |
| 7 동일 상황에서 비교용 최종 SQL `documents` SHA/소유사건 guard | 구 SHA의 새 HEAD 0 | 차단 0, 이전 HEAD·version 보존 |
| 8 D1 원문을 다른 사건 C2로 재연결 | 타 사건 원문 재사용 금지 | 비교용 guard 차단 |
| 9 COMMIT 성공 응답 유실 **가정** 후 재조회, B SQL SHA 변경 | 과거 COMMIT 증거와 현재 SHA 판단 별개 | 과거 HEAD 존재, 기존 최신판정 true / SHA guard false |
| 10 PR #196 상당 case+HEAD 시점 스냅샷 | 원문 SQL SHA 불포함은 구 SHA 최신성 보장 못함 | 기존 true / guard false |
| 11 B가 읽기 종료 후 HEAD 교체 | as-of 결과와 현재 HEAD 구분 | A 과거 조회/B 현재 저장 |
| 12 SHA A→B→A(ABA) | SHA만 비교로 중간 변경을 검출 못함 | 가드 true(잔여위험) |
| 13 같은 사건번호에 명령 O1/O2, 답변 R2 | main/#196 docket-only 연결 금지, #19 보류 | 기존 연결 true(부정대조)/#19 false |
| 14 명령 하나에 답변 하나 | 사람 확인 대상일 수 있으나 법원 인가 아님 | #19 연결 true, 법원승인 false |
| 15 답변 없음 | 연결/인가 둘 다 불가 | false |
| 16 문서 미관찰·기한 null·숫자 0 | `UNOBSERVED`≠`null`≠`0`, 승인 미승격 | 구분 일치 |

**실행 영수증:** 신규 Node 합성 **16/16 기대 관찰 일치**. 이전 A4 84~86차 스크립트 3개와 함께 로컬에서 실제 재실행한 합성 회귀 **54/54 기대 관찰 일치**. 부정대조는 원래 코드의 결함을 예상대로 재현한 항목이므로 **제품 54건 합격이 아니다.**

- 이번 스크립트(대화 산출물) `firmengine-a4/r87/correction_snapshot_final_cas_composition.test.mjs`, SHA-256 `5e8cff2520e3bae540aaa8d20980b5bb04a7c4861f6b43b27e2022dc4605f3df`.
- 신규 TAP 로그 `firmengine-a4/r87/r87-node-results.txt`, SHA-256 `a91cfaa2b5eda53e16f41a264258c57902d839c706ba3a4ca5aa719a87e39b4c`.
- 회귀 TAP 로그 `firmengine-a4/r87/regression-r84-r87.txt`, SHA-256 `330ee11750a5ecb8735349706e85dc5d3162bbb05f6e164554b02190645b529f`.

## 3. 6역할 순환 / 5개 체크 ID / 판정

이번 역할 순서는 **AX → IT → 서류담당자 → 계산사무장 → 변호사 → 데이터담당자**. 실제 역할 담당자의 검수·서명은 0건. 회차 선정 ID는 `A4-IT-003`, `A4-CALC-014`, `A4-LAW-008`, `A4-AX-013`, `X-042` **5개 모두 [ ] 유지**.

- **IT / A4-IT-003 [ ]:** 두 SQLite WAL 워커가 동일 HEAD/원천판본으로 기록하면 한쪽만 원자 성공. 별도 SHA가 DB 내부에서 변경되고 동일 revision/version이면 현재 최종 CAS는 통과할 수 있음. 실제 HTTP 2-worker 및 D1 미검증.
- **서류:** 새 원본/문서 철회 시 과거 item·직원 워드 검수 무효화는 읽기·쓰기 CAS가 모두 필요. UI와 R2 문서 재생성 미실행.
- **계산사무장 / A4-CALC-014 [ ]:** 원본 변경 후 10분 quiet calculation·청산가치·변제계획 재산정은 **미실행**. 이번 sourceVersion 7→8은 보호 SQL만 합성 검사.
- **변호사 / A4-LAW-008 [ ]:** 같은 `courtReference`의 O1/O2 별 답변 R2는 명령 ID가 명시적으로 연결되지 않으면 승인 금지. PR #19 후보 대조는 합성에 한정; 실제 법원 명령·기한·접수증·공식서식 확인 0.
- **데이터:** 동일 문서 ID SHA 직접 변경의 발생 범위를 정상 API / 비정상 복구/관리자 수정으로 분리. SHA A→B→A 중간 변경세대는 검출 불가. source-only/미관찰/0/상충 분리.
- **AX / A4-AX-013 [ ]:** 95 법률 risk→Word 초안→직원/변호사 승인과 재생성 무효화는 연동 실행 미검증. 기술적 `sourceCurrent`는 법원 인정이나 담당자 승인값 아님.
- **교차 X-042 [ ]:** 실제 원본 PDF, 보정명령 항목/기한/답변/접수증의 개별 명령 연결은 미실행·미확정. 합성 docket 부정대조만 검증.

## 4. 해결·남은 위험·다음 회차

- **이번 해소:** 통합 저장 계약을 위한 근거 16건(두 워커, source/version/head 보호, SQL SHA/소유 사건 판본, 오래된 ACK 영수증, PR #19 답변 고유성)을 **실제 로컬 합성 실행으로 재현**. 제품 코드 수정/실운영 위험 해결은 **0건**.
- **고위험 판단:** SQL `documents` SHA를 기존 `getCase()`와 동일 버전의 권위 있는 원문으로 계약할지, 이상한 DB 직접변경을 오류로 격리할지 **정책·마이그레이션·PR 충돌 검증 선행**. 정상 원문 업로드에서는 새 ID와 `touchCase`를 사용하므로 운영 결함 단정 금지. 신규 D1 최종 SHA CAS가 필요한 경우 `#196` 스냅샷과 `#19` 명령별 유일성 후보를 함께 통합하고 타입/회귀·실무자 검토 후 병합.
- **다음 체크:** `A4-IT-006` (R2 성공/D1 오류·ACK 유실 실재현), `A4-DOC-013` (증빙 변경 후 승인무효화), `A4-DATA-012` (지연/중복 재전달), `A4-LAW-008` (동일 사건번호 복수 명령), `X-044` (기한 Fact 철회). 추가로 `A4-CALC-014` 10분 계산 Run 및 `A4-AX-013` Word 재생성 연동을 검증.
- **미실행:** main 저장소 실제 TypeScript/Node 전체 회귀·Next 빌드/CI, staging D1/R2/Cron, 운영 n8n, R2 PUT 네트워크·D1 HTTP ACK 실손실, 중복 webhook, timeout/429/503 실제 장애주입, 상담→서류→OCR→10분→95법률→Word→직원/변호사→실제 보정 이벤트 E2E, 실제 PDF·법원 전자서식·전문가 승인, 사이트 운영 배포.
- 운영 배포·운영 D1 마이그레이션·전자제출·인가확정 **하지 않음**. 제품 인수 완료 **0/5**, 전체 출시 게이트 인증 **0건**.
