# FirmEngine A1 46차 — Export ACK 유실 / OCR 참조 SHA / 가구원 충돌

- 감사일: 2026-11-01 KST. 허용 작업 범위: prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/ 아래만.
- 시작 GitHub main SHA: 0a2dc53456d5a3dca4dd714e7d74c752c691e6d9; 중앙 보드 시작 blob: 77a6855a886f216a7554cadf9c5bb44fdec86e67. 45차 영수증, 최근 커밋/PR, 기존 테스트와 코드를 먼저 확인.
- 역할: 이전 DOC/LAW/DATA에서 IT/AX/CALC로 순환. 검증 ID: A1-IT-014 / A1-AX-010 / A1-CALC-009 모두 [ ] 미완료.
- 아래 숫자는 GitHub 실제 TypeScript 함수의 타입만 제거한 V8 격리 합성 시험 또는 코드 대조다. 전체 Node, CI, 브라우저, 실제 D1/R2/Cron, 공식 서식, 변호사 승인과는 다르다. 실제 고객정보/OCR 원본/키/비공개 정답 없음.

## A1-IT-014 [ ] — 문서 작성 실패/재시도 중 증빙 보존

대상: lib/export-artifact-transaction.ts, main blob a114235e5b5de57b5ae58b41026f939ee8543174, 기존 Draft PR #24 blob 10dc79b9ec9dcf29ff74901af6a621a17d880573.
합성 구성: 기존 other export 1건, 신규 synthetic-a artifact 1건, in-memory row/object/manifest, 5가지 실패시점 주입. 두 실제 함수의 본문을 V8에서 실행함.

| 조건 | 독립 기대 | main 관찰 | Draft #24 관찰 |
|---|---|---|---|
| 정상 | row/object/manifest 보존 | 셋 모두 보존 | 셋 모두 보존 |
| manifest 전 SQL 오류 | 신규 소유 row/object 정리, 기존 보존 | 정리 | 정리 |
| manifest COMMIT 후 ACK 유실 | live row/object 삭제 금지, 불확실 상태 보존 | **row/object 삭제, manifest만 남음** | 셋 보존, uncertain 콜백 |
| manifest CAS 오류 | 성공 추정 금지, 정리/보류 구분 | row/object 정리 | row/object 보존, uncertain 콜백 |
| manifest 이후 event 오류 | 증빙 보존, event 오류 전파 가능 | 셋 보존 | 셋 보존 |

기존 P0를 재현. #24는 ACK 유실 삭제를 막지만 CAS 오류 보수적 보존 후 고아증빙 정리·영속 receipt·실제 복구는 미검증. 통합 Draft #61도 확인했으며 중복 수정/병합 없음. 취소/중복 요청/실제 서버 및 D1/R2 실행 없음.

## A1-AX-010 [ ] — OCR checkpoint key에 runtime reference SHA 미포함

main lib/domain.ts blob 39ab41856f6d7a379aca7217d24b28f7f5f7616a, lib/pipeline.ts blob 79dce5f9822cf2debe1f886ab93ece4a256659e6.
독립 안전 기대: 문서, 페이지, 모델, 프롬프트, static rule ID가 같아도 운영자가 관리하는 현재 reference snapshot SHA가 달라지면 이전 OCR read/checkpoint cache key를 재사용하지 말아야 한다.

실제 원본 extractionCacheKey V8 합성: 같은 페이지 집합의 순서만 변경하면 동일 키; 원문 SHA/프롬프트/규칙 ID 변경 시 다른 키; **referenceSha256만 변경하면 동일 키**. Pipeline의 2개 함수 호출도 SHA를 전달하지 않음. reference-context.ts는 요청별 활성 snapshot을 읽는 코드를 보유.

작은 수정은 별도 [Draft PR #116](https://github.com/firmengine/firmengine/pull/116)으로 등록: helper에 optional referenceSha256 추가/키 반영, pipeline 추출·재검증 2개 호출 모두 referenceIdentity()?.sha256 전달, tests/extraction-cache-reference-sha.test.ts 신규 작성. 기준정보 값, 법률 인정, OCR 사실 자체는 변경하지 않음.
PR head 858928cb119583f5115e21a48c4dd915dd0f8304; 수정 blob domain 7c0baf061e22d1bf1a62a9cfa6f0522fb5c4b86f / pipeline c7a16274c1f3c61cec376dac6eb7b51f900d828e / test ed2437e76951c5417482f34828f17b84e5822ed4.
GitHub PR HEAD 소스·테스트를 다시 읽어 TypeScript import/annotation 제외 후 실제 테스트 본문을 V8에서 실행: **3/3 블록 통과**, key 구분 7+ 단언 기대 일치. 2개 pipeline call site는 정적 확인. Node 명령·CI·OCR end-to-end·실제 reference request context 적용은 미실행. SHA provider 부재 시 undefined일 수 있으므로 전체 버전 보증 완료로 보지 않는다.

## A1-CALC-009 [ ] — 상충 가구원 수와 부양근거 인수

실제 소스: lib/living-cost-proposal.ts blob e74e7362ad25c234da87fa726aae755507902720, lib/calculation-adapter.ts blob 556ef86b887d1d729af2c56d071211c74b4d5e46, lib/assessment.ts blob ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5, lib/context-validation.ts blob 7ea7262cca177cc92a59f65fe917cc14573786db.
실제 제안 함수와 adapter를 V8 격리 실행한 합성 9조건:
- 인정 가구원 null -> proposal blocked, 명시 1인/서울/2026 -> proposal, 그 결과 법률 효력 draft_proposal_only, 타 관할 blocked.
- adapter는 정상 계산 결과 ready, snapshot revision 불일치 blocked, 생계비 null blocked, upstream provisional trace면 provisional.
- 그러나 결과를 그대로 둔 채 신고 가구원만 1->3으로 변경하거나 가구원 fact ID를 둘로 바꾸어도 adapter ready. 단순 신고인원과 법원 인정인원이 달라지는 것은 합법적으로 가능한 상황이고, 이 합성 Result가 실제 upstream 전체 계산으로 생성 가능한지는 확인하지 않았으므로 **제품 결함이나 법적 확정이라고 단정하지 않는다**. 원문 가구원/부양증빙 상충, 인간 인정 사유, 18계산·95법률·서식의 전체 인수는 미완료.
코드 조치 없음. 법률상 의미/부양 판단을 임의 수정하지 않음.

## 조치·다음 회차

- 새 P2 후보 1건: OCR runtime 기준정보 SHA에 따른 캐시 갱신 누락. 수정 Draft #116 3파일 커밋, main 제품 코드 미병합.
- 기존 P0 ACK 유실 재현 1건; PR #24/#61 기존 후보 유지.
- 중앙 보드의 위 세 A1 ID만 개별 이력 추가하고 [ ] 유지. 본 영수증은 A1 고유 경로에 기록.
- 다음 역할 DOC/LAW/DATA. 보드 실제 ID 기준 **A1-DOC-016**(직원/변호사 검수), **A1-LAW-017**(법원 보정 원본·기한·접수증), **A1-DATA-018**(합성 사건/실제 사건 격리) 예정.
- 운영 배포, D1 운영 마이그레이션, 실제 전자제출, 법원 인가 확정 없음. Extra High 실제 실행 설정은 확인되지 않음. 전체 제품 인수 0.
