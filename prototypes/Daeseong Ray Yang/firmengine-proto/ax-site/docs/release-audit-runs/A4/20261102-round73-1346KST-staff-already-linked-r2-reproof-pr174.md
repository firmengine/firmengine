# FirmEngine A4 — 73차: 직원 Word 이미 연결된 초안 재사용의 증빙 재검증 (Draft #174)

- 감사 시작 `main`: `aaa8281b7619a6b4e0cdf831a4d0cd80849c2ee2`; 최종 기록 직전 `main`: `aaa8281b7619a6b4e0cdf831a4d0cd80849c2ee2`. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **내부만**.
- 최신 main/PR 목록 및 보드 blob `25df24b2324169cf6f8f988134767b75d92d4265` 확인. 기존 69~72차 A4 영수증을 이어받음. 관련 Draft PR #164/#167/#170은 **main 미병합**; 이 회차에는 병합 또는 운영 코드 변경 없음.
- 실제 main 소스/blob: `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`, `lib/automatic-draft-handoff-contract.ts` `43cd0e0245bb74d396879880161654cf80a2978e`, `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/reference-context.ts` `537a231c915445cf7ed5481fa5b35e63612229a7`, `lib/reference-store.ts` `16164f17d4a5d849d586a1b094922b020b57103a`, `drizzle/0006_legal_reference_monitor.sql` `fc2eeb9e336b2275440064a6b88bf90fbc939187`; 기존 테스트/72차 영수증과 PR #167/#170 패치 비교.
- 역할 순환: **AX → IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터**. 직접 선정 5 ID: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-046`. 계산사무장 `A4-CALC-016`와 AX `A4-AX-013`은 인계 조건만 간접 검토; 종단 미검증.

## 실제 관찰 및 독립 기대

기존 main `adoptAutomaticDraftForReview()`는 `decision.alreadyLinked`일 때 **현재 SQL artifact/R2 bytes/writer receipt 검사 전에 바로 성공을 반환**한다. 69차에서 이미 지적한 기존 위험이며, 이번에는 회귀 가능한 **독립 Draft 수정**을 제안했다. 구 상태를 운영 사고라고 주장하지 않는다.

- Draft 후보 **[PR #174](https://github.com/firmengine/firmengine/pull/174)** / head `d4f4cc314f6175a40bd18a4124e17191cae9543a` (Open/Draft/미병합). 기준: main `aaa8281...`. 수정은 `lib/automatic-draft-handoff.ts`와 `tests/automatic-draft-already-linked-proof.test.mjs` **2파일**만; 외부 경로 0.
- 후보 변경: `already_linked` 이전에 기존 D1 artifact 소유권·objectKey·revision·hash, R2 **실제 bytes SHA-256**, 렌더링 writer receipt/현재 재계산 일치를 확인한다. 원격 조회 장애는 `AUTODRAFT_OBJECT_UNOBSERVED` **503(미관찰)**, 실제 GET null은 `MISSING`, 정상 응답 바이트 SHA 상충은 `CONFLICT`로 분리한다. R2 이후 최신 run/head/case 상태를 다시 읽고 재사용 판단한다. 불확실한 ACK 후 재요청의 오래된 fingerprint 자체는 성공 근거가 아니며 **증빙이 일치하는 경우에만** 재사용 후보이다.
- 독립 가상 입력: 사건 `case-SYN` / revision3 / `artifact-SYN` / 무해한 ZIP 모사 바이트 / 현재 원본 SHA. Node 22.16 `node:sqlite` WAL **두 연결**과 메모리 R2 대체를 사용.
- 독립 기대 → **실제 합성 관찰**: 정상 SQL/R2 `VERIFIED`; SQL 행 삭제/타 사건 소유/해시·objectKey 불일치/revision 2 → `CONFLICT_SQL`; R2 객체 null → `MISSING_R2`; 변경 바이트 → `CONFLICT_BYTES`; 조회 503/timeout 모사 → `UNOBSERVED_R2`. **신규 9/9 합성 기대 관찰 일치**. 원래 main 모듈·R2 API를 직접 호출한 테스트가 아니다.
- 추가 GitHub branch source-order 조건 **5/5 true**: 이미 연결된 초안의 성공 반환이 SQL/R2/영수증 확인 뒤에 있고, 503/null 구분, 최신 사건 재조회, 초기 조기반환 없음, 새 테스트 파일 3+9 시나리오 구조 대조. 이는 branch **정적 확인**이지 실제 저장소 Node 실행이 아니다.
- 로컬 `node --test` 69~73차 합성 회귀 합계 **60개 발견, 57 pass, 0 fail, 3 skipped**(branch 실제 소스가 로컬에 없어서 r73 source-bound test 3개 skip; 이전 69~72차 48개는 모두 실행). 로컬 신규 증빙 `/mnt/data/firmengine-a4/r73/automatic-draft-already-linked-proof.test.mjs`, SHA-256 `09e1f5fb204cafaf9062ba7b992c4960dbc4667582a66321f25931fa718149af`; 전체 실행 출력 `local-node-test-output.txt`.
- **저장소에서 PR 테스트 직접 실행하지 않음**. GitHub commit combined status에 보고된 status 0건(이는 CI PASS가 아님). Node/TypeScript/Next 전체, staging D1/R2/Cron, HTTP 두 워커, 실제 Word 바이트·직원/변호사 승인·법원 문서는 **미실행**.

## 원인, 수정 상태, 복구 경계

`already_linked` 조기반환 → 가용성 결함/문서 무결성 오류에도 재조회 안 함. Draft #174는 SQL/R2/Writer 확인으로 조기 성공을 억제하는 **수정 후보**이며, 원격 R2 조회 비용 증가·승인/ACK 유실 UX·동일 파일을 수정하는 #164/#167/#170 충돌·현재 기준정보 승인세대 CAS는 별도 검토가 필요하다. `already_linked` 재검증 이후에도 객체가 바로 변경되는 R2 시점 경쟁, 기준정보의 A→B→A와 다중 active, 영수증 유실(#17/#24/#161)은 끝나지 않았다.

- **추가 병합 보류 조건(소스 확인, 미실행):** Draft #174에서는 이전 조기반환과 달리 `already_linked` 경로가 `caseExtras(data)`를 통과한다. `server-store.ts`의 `caseExtras → readDerivedEvaluation`은 누락/불일치된 계산 캐시에 `analyses` pending INSERT 또는 재계산·reset 경로를 가질 수 있으므로 **기존 재시도의 read-only/무과금 속성을 보장하지 않는다**. 이는 새 부작용 가능성에 대한 정적 분석이며 실제 D1 쓰기 발생은 미관찰. PR #174 [검토 댓글](https://github.com/firmengine/firmengine/pull/174#issuecomment-6569385402)에 별도 보류 조건 등록. `caseExtras` read-only 대체 또는 부작용·과금 불발의 저장소/staging 회귀 후 병합 판단.

- `A4-IT-005` **[ ]**: 재생성·재시도 경계의 조기 성공 제거 후보. 실제 HTTP 병렬·staging CAS는 미관찰.
- `A4-DOC-011` **[ ]**: 직원 기존 연결 문서 재인계 전에 D1/R2/receipt 체크 필요. 실제 직원 화면·문서 링크 미관찰.
- `A4-LAW-013` **[ ]**: Writer receipt 검사 후에도 실제 변호사·Word 최종 바이트 승인 **미실행**; 승인으로 승격하지 않음.
- `A4-DATA-013` **[ ]**: SQL/R2 누락·해시상충·503의 상태 구분 모사; 실제 D1/R2 원자성·ACK 유실 E2E 미인증.
- `X-046` **[ ]**: two-connection SQL artifact 변경/읽기 부정대조. 진짜 두 워커 동시 요청·재생성 경합 미실행.
- `A4-CALC-016`, `A4-AX-013` **[ ] 간접**: quiet 계산 10분/95법률/Word 재생성의 완전한 인계는 관찰하지 않음.

## 단계별 오인 금지 및 다음 순서

상담 → 서류 → OCR → **10분 quiet calculation** → 95법률 → Word 초안 → 직원·변호사 검수 → 실제 보정 이벤트 종단 E2E **미실행**; 이번에는 **Word 직원 인계의 재사용 분기**만 확인. n8n 설계 문서가 있어도 운영 워크플로 증빙은 없다.

상태 분리: **0**=이 회차에서 실제 성공적인 인계·감사 이벤트 INSERT를 실행하지 않았으며 운영 결과 0건이라는 뜻이 아님; **null**=R2가 성공적으로 '없음'이라고 응답; **미관찰**=R2 503/timeout 및 운영 D1/R2 미접속; **상충**=SQL 또는 R2 해시/소유권 불일치; **source-only**=Draft #174; **승인전**=직원/변호사 승인 미획득; **비해당**=법원 인가 판단·실전자제출.

다음 회차 ID: `A4-IT-012`, `A4-CALC-016`, `A4-AX-013`, `A4-LAW-006`, `X-047`: #174 재사용 후 원본변경/기준세대 복원 경합, #164/#167/#170 통합, R2 성공→D1 ACK 유실·중복웹훅·Word 재생성 시 검수 무효화. **PR은 실무자 검토 전 병합하지 않음.**

**신규 최종 인수 0/5; 제품 전체 인수 0**. 운영 배포·D1 운영 마이그레이션·법원 전자제출·인가 확정은 수행하지 않았다.
