# A4 12차 — Export 증빙 수집 중 같은 artifact ID의 상충 SQL/사건 판본이 정상으로 보이는 진단 결함

- 날짜: 2026-10-31 KST. 읽기 시작 시 `main` HEAD `f2f0fb0cbb61edddc57df28f1dcbf1e9ca83c9e7`; 코드 변경 커밋 `8bbfab75b9e2604b6c1e25c7e9d3c84442c3127b`; 신규 회귀 테스트 커밋 `45f7db558a364b588c01fddc87ec3d0867d53cb9`. 모든 변경 경로는 지정된 `ax-site/` 내부.
- 순환 관점: 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사. 이번 코드 실행 범위 ID: `A4-DATA-020`, `A4-AX-003`, `A4-IT-006`, `A4-DOC-011`, 교차 `X-047`. `A4-CALC-014`, `A4-LAW-013`은 독립 원본·산식·Word 바이트 검증 미실행으로 합격/상태 승격 없음.
- 먼저 확인한 것: 최신 `main` SHA·최근 커밋/열린 PR, 단일 인수 보드 A4의 실제 ID, `db/schema.ts`의 `artifacts` 정의, `app/api/cases/[id]/export/route.ts`, `lib/export-artifact-transaction.ts`, `lib/export-reconciliation.ts`, 기존 합성 테스트 16+9건, A4 10·11차 영수증 및 Export 관련 PR #24/#31/#35/#40/#45 설명. 메인 route는 여전히 읽기전용 reconciliation helper를 호출하지 않음.

## 독립 기대값 → 실제 관찰(모두 합성 입력; 고객 자료 없음)

`reconcileExportEvidence`는 여러 R2 관측·SQL·과거 receipt 증빙을 하나의 case로 모아 진단함. 초기 코드의 `new Map(artifactRows.map(row => [row.id,row]))`는 같은 ID가 다른 사건 또는 서로 다른 revision으로 **두 번 수집**되면 입력 순서상 마지막 행만 남김.

| 합성 입력 | 독립 기대 | 수정 전 실제 | 수정 후 실제 |
|---|---|---|---|
| 현재 B(id=B,rev=4,SHA=a×64) + 동일 id의 타 사건 행이 앞에 있고 현재 행이 마지막; R2 proof 일치 | 증빙 상충을 차단, verified=false | `issues=[]`, `currentArtifactsVerified=true` **거짓 정상** | `ARTIFACT_EVIDENCE_CONFLICT`, verified=false |
| 위 두 행의 순서 역전 | 순서 무관 동일 차단 | 타 사건으로 분류될 수 있지만 ID 충돌 자체는 숨김 | ID 상충 경고, verified=false |
| 같은 사건 B(id=B) revision 3 → 4 서로 다른 두 행; B의 바이트 SHA 유효 | 버전 상충 차단 | ID 상충 근거 없이 마지막 행이 선택됨 | ID 상충 경고, verified=false |
| 과거 A의 revision 2/3 상충, 현재 B는 독립 검증됨 | A 조사 필요·B 현재 검증 상태는 독립 유지 | A의 ID 상충 별도 경고 없음 | A 경고, B current verified=true (A 복구 미인증) |
| 무관한 타 사건 X만 입력에 포함 | 다른 사건 정보 비노출 | 경고 없음 | 경고 없음 |
| 현재 B 한 행과 바이트 SHA 일치 | 정상 진단 | 정상 | 정상 |
| 현재 B의 R2 관찰 `exists=null` | 미확정, 삭제 불가 | 미확정 | 미확정 |

**부정대조:** 원본 Git blob `e06a32df777cfe8bb83af80d1ca0dc210d28517c`을 `git hash-object`로 동일성 확인한 로컬 Node 22.16.0 실행에서 신규 7테스트 **3 PASS / 4 FAIL**. 수정 전의 실패는 요구조건 위반을 정확히 검출한 반례다.

**수정:** 입력에 동일 artifact ID의 서로 다른 `caseId/revision/objectKey/hash`가 발견되면 `ARTIFACT_EVIDENCE_CONFLICT`를 보존 경고로 남김. 관련 ID가 현재 manifest에 속하면 byte SHA가 맞더라도 `currentArtifactsVerified=false`. 무관한 타 사건의 ID·해시는 경고에 공개하지 않음. 실제 원본·증빙·SQL·R2 객체를 변경하거나 삭제하지 않음.

**실제 실행:** Node `node --experimental-strip-types --test tests/export-reconciliation*.test.ts` **32/32 PASS**(기존 25 + 신규 7). `tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext lib/export-reconciliation.ts`: 오류 0. 기존 두 테스트 파일의 원본 Git blob도 각각 `597d480713e861a2edf58c6b8a90351bf6e7b87b`, `ad4a98d4ce6be693c93592974f32dd21c6a37916`로 동일함을 검증.

변경 결과 blob: `lib/export-reconciliation.ts` = `f4a1f350c63e58afea09af8932e071ba654fb279`; `tests/export-reconciliation-r12.test.ts` = `495992bd6d20c37ff0324320a60daa8d530fee81` (로컬 `git hash-object` = GitHub 반영 SHA).

## 증거 한계 및 승인 경계

- D1 `artifacts.id`는 PK라 단일 DB 정상 쿼리에서 실제 중복 row가 저장되는 상황을 확인했다는 **주장이 아님**. 이번 반례는 서로 다른 시점·사건의 읽기 결과/재시도 증빙을 조합하는 **읽기전용 수집기 입력**의 상충 검증이다.
- 현재 Export API에 검증 모듈 호출 없음. 수정은 진단 helper의 **합성 단위 보강**이며 영속 요청 원장/API/Worker의 운영 결함 해결 아님. PR #24/#31/#35/#40/#45 미병합·경합 가능. 저장 후 ACK 불확실한 R2는 삭제 금지.
- `null` R2 관찰/0개 SQL 행/확인된 부재 `false`/현재 B/역사 A/타 사건/사람 승인 전을 분리. 자동 법률 인정, 법원 보정 이행, 계산 적정성·서식·사람 승인을 확정하지 않음.
- **미실행:** 최신 저장소 전체 CI/빌드, staging D1/R2/Cron, 실제 두 HTTP worker, n8n 운영, OCR→10분 quiet calculation→95법률→Word→직원·변호사→법원 실제 보정 이벤트 종단 실행. 운영 배포/마이그레이션/전자제출 없음.

## 다음 A4 체크

1. `A4-IT-003`, `A4-AX-003`, `X-046`: 고위험 단일 통합 브랜치/PR에서 #24/#31/#35/#40/#45의 claim/source CAS/atomic event/ACK uncertainty 순서를 합성 HTTP 두 워커로 검증.
2. `A4-DATA-020`, `X-047`: 읽기전용 증빙수집 어댑터가 같은 사건의 SQL 행·manifest·receipt·R2 HEAD/바이트 hash를 **실제로** 관측하는 staging 영수증 구축. 재시도·부분성공·수집 충돌 시 자동 삭제 없음.
3. `A4-CALC-014`, `A4-LAW-013`, `A4-DOC-012`: 실제 새 원본/관할판본 변경에 대한 계산·법률검토 current 판정과 Word 바이트, 직원 선행/변호사 후행 승인 증거 별도 실행.

**제품 최종 인수 완료 0건.** 본 회차 체크 ID들은 일부 합성 단위 검증만 진행했고 [ ] 유지.
