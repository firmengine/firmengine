# FirmEngine A4 5차 — Export 재시도·증빙·감사 이벤트 무결성

- 감사: 2026-10-30 KST 17시 회차, 최초 소스 main 2a8519a763cf32609798c5267eea61caf2a5a03f, 기록 직전 main 2a8519a763cf32609798c5267eea61caf2a5a03f.
- 범위: 오직 prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/.
- 역할 순환: A4 4차 서류담당자/계산사무장/변호사/데이터담당자에 이어 이번 회차 AX담당자→IT담당자→데이터담당자 관점. ID: A4-AX-003, A4-IT-002, A4-DATA-003, A4-DATA-020, X-041. 모두 부분검증 [ ] 유지.
- 이전: [A4 4차 감사](20261030-round04-page-empty-export-postcommit-retry.md), [이벤트 실패 후 중복 내보내기 재현 코드](20261030-round04-export-retry-repro.test.ts).
- 열린 관련 PR: #15/#16/#19/#23/#24/#27 및 타 축 #28/#29/#30 확인. #24는 COMMIT ACK 유실 시 R2 삭제 방지, 이번 #31은 COMMIT 후 독립 감사 이벤트 실패에 따른 재요청 중복 방지로 기능 목적이 다르다. 같은 route 파일 PR 충돌을 검토 없이 병합 금지.

## 원본 코드 확인

GitHub main에서 export route blob 4f9384e840517455cdec25f0fa734b593d31e533, transaction blob a114235e5b5de57b5ae58b41026f939ee8543174, domain blob 39ab41856f6d7a379aca7217d24b28f7f5f7616a, workspace blob 37bc60405f3017bf42b12d8a26a7f0aace78d0cc, client mutation blob a91fa0b6951027fe8463d2294bb7355dbd282a26와 기존 회귀를 검토했다.

기존 POST는 매 요청마다 새로운 artifact UUID를 만들고, R2/SQL/manifest 확정 **이후** 이벤트 2건을 D1에 별도 INSERT한다. 이 INSERT가 실패하면 요청이 오류를 반환하지만 artifact는 이미 확정되어 있다. 동일 POST 재요청은 두 번째 신규 UUID/SQL/R2 데이터를 만든다. 이전 A4 4차 합성 Node 1/1은 이 결함을 **재현한 성공**이지 제품 정상 통과가 아니다.

## Draft PR #31 — 보수적 수동 Export 요청 토큰

- [PR #31](https://github.com/firmengine/firmengine/pull/31), branch audit/a4-export-retry-identity-20261030-r5. base SHA 2a8519a763cf32609798c5267eea61caf2a5a03f. **main 미병합**.
- 다섯 파일 모두 ax-site: lib/export-request-replay.ts, tests/export-request-replay.test.ts, lib/domain.ts, app/api/cases/[id]/export/route.ts, components/workspace.tsx.
- 브라우저의 동일 사건·revision·mode **모호한 5xx/응답 유실 재요청**은 같은 UUIDv4 requestId를 유지. 2xx 정상 완료 뒤 의도적으로 다시 생성하면 새 ID 사용.
- D1 manifest는 optional exportRequestId와 sourceDataVersionAtExport를 저장. 같은 요청 ID라도 사건·모드·sourceDataVersion·현재 승인 reference SHA·현재 artifact 상태가 달라지면 409 보류. 사람의 최종 법률 승인으로 자동 승격하지 않음.
- 같은 manifest 재사용 전에 SQL artifact hash 및 R2 HEAD 존재 검사. 파일 참조가 없으면 409·검토필요이며 재생성 성공으로 위장하지 않음.
- 새 manifest commit 직전 현재 sourceDataVersion 재조회. 문서 생성 도중 OCR 값이 달라졌다면 409.
- 이전 legacy API 요청은 requestId가 없으므로 replay 보호가 적용되지 않는다.

## 실행 실측 / 독립 기대값

실제 수행 환경 Node v22.16.0, TypeScript 5.8.3. 로컬 격리용 파일로 다음 명령 실행:

    node --experimental-strip-types --test tests/export-request-replay.test.ts
    tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/export-request-replay.ts
    git hash-object lib/export-request-replay.ts tests/export-request-replay.test.ts

- **Node 단위 7/7 PASS, 0 FAIL.** 포함 시나리오: UUIDv4 유효성·legacy 누락; 최초 요청/명시적 새 생성; 정상 정확한 replay; source 버전·reference SHA·caseRevision·mode 변화 차단; 철회·빈 파일·원문 증거 부재 차단; 버전 증명 부재; 첫 commit 후 감사 이벤트 실패 → 같은 토큰 재요청으로 artifact 1개/SQL 1행/R2 1개 유지, 의도적 새 토큰에 artifact 2개 생성 허용.
- 단독 helper TypeScript 진단 **0**. 검사에 쓰인 로컬 domain.ts는 ExportManifest 형태의 **의존성 없는 타입 stub**으로, 저장소 전체 타입/Next.js app을 컴파일하지 않았다.
- Git blob 비교 일치: helper 4268b1d13061f4a1d17e0051984d559e8e3ecb96, test 05ad7ad38897d6ef8abb0f79f7249ae515da38b9. 브랜치 PR 원문과 로컬 git hash-object 동등.
- **실제 HTTP/Cloudflare D1·R2/Cron/Word/법원서식/변호사**는 이 회차 실행하지 않았다. PR #31은 제안이지 운영 적용이 아니다.

| 합성 조건 | 독립 기대 | 관찰 범위 |
| --- | --- | --- |
| 같은 requestId, caseRevision, sourceVersion, referenceSHA | 기존 artifact 그대로 반환 | helper 모델 재생성 0 / 7테스트 중 1 PASS |
| 별도의 명시적 새 token | 독립된 artifact 신규생성 | 합성 생성 수 2 정상 |
| 원본·관할·reference/모드·revision 변경 | 기존 요청 재사용 차단 | helper conflict, route 409 정적 경로 확인 |
| 원본 철회·빈파일·증빙 불일치 | 성공으로 표시 금지 | helper conflict, 실제 R2 HEAD 경로 정적 확인 |
| audit event SQL 실패 후 동일 POST | 재요청 artifact 중복 0 | 격리 시퀀스 PASS, 실제 D1 이벤트 복구 미실행 |

## 남은 결함/병합 게이트

- **P1 미해결**: 별도 events INSERT가 최초 실패하면, artifact 중복 방지와 별개로 감사 event 자체가 영구 누락될 수 있다. durably persisted outbox, event dedupe·reconciliation, 재실행 영수증 설계가 필요. event 실패를 단순 무시하는 임시 patch 금지.
- **P1 미해결**: 다른 수동 생성이 manifest를 교체한 뒤 구 요청 ID 재전달, 브라우저 새로고침으로 pending ref 유실, 토큰 미전달 legacy 호출, 두 개의 동시 POST는 완전한 exactly-once가 아니다. 요청 고유 SQL 인덱스와 영속 command receipt 필요.
- **미인증**: 최신 프로젝트 전체 Node test/lint/build, Next HTTP route, 운영/staging D1·R2/Cron 2 worker·429/503 장애 주입, 파일 바이트 SHA 검증, 공식 Word/전자소송 양식, 변호사 서명. **RELEASE_READY 0**.
- 다음 A4는 서류담당자→계산사무장→변호사 역할로 순환해 감사 이벤트 내구성, 재시도 CAS와 법률 승인 무효화, 별도 PR #24와의 안전한 병합 전 회귀를 확인한다.

판정: 4개 ID + X-041 모두 실제 종단 인수 [ ] 유지. 사용자 데이터·운영 DB/배포/법원 절차 변경 없음.
