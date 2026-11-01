# FirmEngine A4 46차 — 법률 수동재시도 활성 기준정보 release TOCTOU 반례

- 감사 일자: 2026-11-01 KST. 쓰기 직전 main HEAD: f888bfcc68561a1f7f0a4f421046bddd3472cf81. 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 단일 체크 보드: docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md. 직접 검증 ID 5개: A4-IT-003, A4-CALC-004, A4-LAW-001, A4-DATA-004, X-046. 서류 A4-DOC-013 및 AX A4-AX-006은 인계관계만 검토, 종단 실행 아님. 모든 체크 [ ] 유지.
- 6역할 순환: 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자. 직전 45차는 서류 선행.
- 읽은 main source: lib/case-legal-automation.ts blob 4af7a76d0935d532a3f5c0ca5fef4656be7eaf92; lib/case-data-recompute.ts 7e8053ffebe892a6065d6e40f9fec5c19b2d701f; lib/case-agent-scheduler.ts 0bb91c69dbc06495873cff1e4d5911679baaa335; drizzle/0017_legal_reanalysis_orchestration.sql 27083bd2b6c7b2c69b1d74d7e3755d39f7de965d; 45차 영수증 720c763ecf7b8473cefd6ae5ff34aba38bc75d5c.
- 읽은 Draft PR #110: HEAD 766f0b0f919bbfa6037fc92cbf8ac8f53acf0e20, 해당 legal source blob 6155b30dd3b0921788a7d7fac3dc7363fde5d0cb, 45차 회귀 테스트 blob 12a7f67fd5d70e90449c1b014f497da0cb5179c2; PR #114 HEAD 1f9ebb36c0b488a6b7eb07a8afb9732994f0ccae, PR #16 HEAD 453936e15b804e0142801495327ecb3024d25da1. 모두 검토 당시 미병합. 45차 이후 main 최신 SHA와 타 축 커밋을 별도 확인.

## 입력·독립 기대값·관찰: 동시성 음성대조

- 합성 사건: case=synthetic-case, revision=1, sourceDataVersion=1, current calc head=calc-A/input-A/ref-A, failed legal job=synthetic-job/ref-A, 현재 활성 기준정보 ref-A. 원문 OCR, 실제 의뢰인, 키, 법률 인정값 없음.
- 시퀀스: (1) 수동 재시도가 `latest()`를 읽고 activeReference=ref-A로 입구 검사를 통과. (2) 외부에서 활성 reference release가 ref-B로 변경되나 아직 D1 계산 head는 calc-A/ref-A. (3) PR #110의 정확한 상관 UPDATE CAS와 조건부 audit INSERT를 두 연결 WAL SQLite에서 실행.
- **독립 기대값:** ref-A 기준 법률 작업은 ref-B 활성 이후 재활성화되지 않고 `failed` 유지, audit 0건, 새로운 계산·법률 판본 검토 보류.
- **실제 관찰:** UPDATE changes=1, audit INSERT changes=1, job status=`retry_wait`; 최신 활성 기준정보가 ref-B라도 SQL에는 활성 release 세대 행/epoch 검사가 없어 DB가 이를 판별하지 못함. **P1 후보 반례**, 실제 Cloudflare D1 사고 확정 아님.
- 분리대조: ref-B가 입구 검사 이전 활성화되면 write 0; 계산 head가 calc-B로 전환되면 CAS 0·audit 0; source dataVersion 2면 CAS 0·audit 0; 동일 job 두 연결 경쟁에서는 첫 1/1·둘째 0/0; audit 트리거 오류는 SQLite 단일 트랜잭션 rollback; COMMIT 응답유실은 read-only 재조회 필요.
- 실행환경: Node v22.16.0 node:sqlite(DatabaseSync), 독립 WAL 연결 2개, 임시 SQLite DB, 완전 합성 SQL. 신규 r46 8/8 **관찰 일치**(그중 1건은 위험 동작을 재현한 부정대조), r41~44 기존 40/40 관찰 일치, 합계 48/48. 이 결과는 운영 안전 통과·제품 E2E 48건 인증이 아니다.
- 로컬 실행자료: round46_reference_release_runtime_race_sqlite.test.mjs SHA-256 eb59fa290e3f7bd0fbfedcea4d30b3469507968071743942eec531a9a16b0796, 76 lines; 기존 round41~44 독립 SQL 스크립트도 재실행. 저장소 Node-native 전체 suite·CI·TypeScript 빌드 미실행.

## 결함 범위 / 수정 판단

- PR #110의 입구 `referenceIdentity()?.sha256` 비교는 **입구 순간** stale release를 차단한다. 그러나 그 직후 기준정보가 바뀌고 calc head 갱신이 늦으면 동시 D1 UPDATE CAS가 통과한다. D1 테이블의 run/ref 상호 동일성만으로는 외부 활성 release의 현시점 동일성을 증명할 수 없다.
- 안전한 해결 후보: 활성 기준정보 식별자/세대(epoch)를 D1의 승인형 영속 레코드로 관리하고 법률 retry CAS·계산 head 승격과 같은 트랜잭션에서 현재세대 체크; 기준정보 publish/invalidation 원자 순서 및 참조 판본별 human approval 무효화 계약 명시. 단순 인메모리 재조회만 추가하면 race window는 축소돼도 제거되지 않는다.
- 법률 실행 가능 상태·승인 재검토 의미가 바뀌므로 **main 코드 변경 없음**. PR #110에서 재현/설계 검토, IT·변호사·데이터 담당자 승인 후 변경. PR #110/#114 공통 법률 워커 충돌도 별도 조정.
- 상태 UPDATE+감사 INSERT의 실제 D1 batch 원자성 및 COMMIT ACK 유실 영속복구는 staging 미실행이며, 기존 PR #110/#114 수정은 아직 인수/운영이 아니다.

## 단계별 인계 및 결론

- 상담→서류→OCR→10분 quiet 계산→95 법률→Word→직원/변호사 승인→실제 보정 이벤트: 실제 종단 호출 미실행. scheduler와 legal worker 코드의 연결은 source-only 정적 관찰.
- 데이터 결과: ref-B release 변경이 DB에서 미관찰이라면 0·null·비해당·승인으로 대체할 수 없음. 현재 활성 release와 run ref-A가 상충하는 상태는 **보류/상충**이다. 구 법률 승인과 Word 최신본은 재검토 전 자동 승격 금지.
- n8n 설계 문서와 운영 워크플로는 동일하다고 주장하지 않음. Cloudflare staging D1/R2/Cron, 모델 429/503/timeout, 실제 R2→D1 유실, 고객 Word 바이트, 공식 법원서식, 변호사 최종 검수, 운영 사이트 배포 **모두 미실행**.
- 다음: A4-IT-003/X-046 (실제 D1 release 경쟁 CAS); A4-CALC-004/A4-DATA-004 (계산 head 세대·lease 경합); A4-LAW-001/A4-LAW-006 (법률 승인·Word 재생성 stale 무효화); A4-DOC-013/A4-AX-006 (인계 확인); X-047/X-048 (R2/DB/모델 실패).
- 제품 신규 최종 인수 완료 0건, 5개 체크 ID 모두 [ ] 미완료. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정은 수행하지 않음.
