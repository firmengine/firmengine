# FirmEngine A1 14차 — 배포 판본·자동초안 완료 CAS·사업소득 재평가

- 기준일: **2026-10-31 KST**. 역할 순환: 13차 서류/변호사/데이터 → 이번 **IT `A1-IT-017`, AX `A1-AX-014`, 계산사무장 `A1-CALC-018`**. 제품 인수 완료 **0/3**, 각 ID는 **[ ] 부분검증**.
- 시작 GitHub `main` HEAD: `486f8963c0c49c2ac135eabc1b6299955dddc0eb`. 13차 A1 영수증, 2차 A1 영수증, 중앙 보드, 최근 커밋 및 열린 관련 PR #17/#55/#57, 관련 실제 스키마/함수/테스트/배포 증빙을 확인.
- 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 고객 사건/원문 OCR/키/.env/비공개 정답 없음. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확인 **미실행**.

## A1-IT-017 — Git main / 보관된 배포 소스 / reference 판본

**소스 blob**: `db/schema.ts` main `933f8686845ac14669312dd21bf85e02c62ed5e6`, `package.json` main `8129160e33af3ae250c757a6a8195a29674ad031`, `lib/reference-release.json` main `5537e47c163fb87447f51560e1433866d67faf76`. 이전 배포 영수증 `docs/releases/ax-v43/deployment-receipt.json` blob `5cf3179d2ff429bbda8b879d8aa1f8bbbc31ff51`, 기록 manifest blob `dec7460fd44424ba462618af1a215fc12b5c5230`.

**실제 검사:** manifest JSON 528개 중 아래 3개 path의 기록 Git blob과 2026-10-31 main blob을 직접 비교.

| path | 보관된 AX v43 blob | main blob | 관찰 |
|---|---|---|---|
| `lib/reference-release.json` | `5537e47c163fb87447f51560e1433866d67faf76` | `5537e47c163fb87447f51560e1433866d67faf76` | 파일 바이트 Git blob 동일 |
| `db/schema.ts` | `67fd5eac4dd83f6e3773d021bde3f937f67bc3df` | `933f8686845ac14669312dd21bf85e02c62ed5e6` | **소스 불일치** |
| `package.json` | `939c0b543bd201213bdebf3350958935f1451fcd` | `8129160e33af3ae250c757a6a8195a29674ad031` | **소스 불일치** |

v43 배포 영수증은 **2026-10-29 11:57:15 KST** `succeeded`, 보관된 배포 `source_commit=72b23f2c3faee5656caeeb1e6e6afce9a65de3cb`을 기록한다. 현재 main HEAD는 별도 `486f896...`이며 자동초안 코드 등 v43 manifest에 없는 파일도 있음. **이것은 과거 배포 증빙과 현재 Git 코드의 정적 불일치**이지, 2026-10-31 현시점 운영 사이트가 아직 v43인지의 실시간 확인이 아님. 사이트의 현재 published version/source SHA, staging 스키마·reference 판본을 읽을 수 없었으므로 **배포 동등성·실제 D1 정합성 합격 불가**, [ ] 유지. 별도 배포 시도하지 않음.

## A1-AX-014 — 미확정·구판본 초안 writer 완료 차단

**원본 main**: `lib/automatic-review-draft.ts` blob `5ee8860250303ac9ca513b0be22e886f98c8e904`, `lib/case-legal-automation.ts` blob `3a816faa42ab7dc82b69ce95da0caf8f6174f490`. `db/schema.ts` 참조. 기존 [Draft PR #17](https://github.com/firmengine/firmengine/pull/17)의 `lib/automatic-draft-manifest-cas.ts` blob `ebb2de08c1371ed3c37d9946f37b3ce251a8b628` 재검토.

**독립 기대:** 동일 사건 `caseRevision=4`, `dataVersion=5`, `calc-A`, `legal-A`, reference SHA `r×64`, job `job-A`·`lease-A`의 pending writer가 완료되려면 모든 최신성 조건이 원자적으로 유지돼야 한다. 완료 중 사건 revision/sourceVersion/current calculation/current legal/worker lease/lease 만료/reference SHA가 바뀌면 **UPDATE 0행, status=pending**이어야 한다.

**실제 실행:** GitHub main의 `commitManifest` UPDATE SQL 술어를 동일 문자열로 격리 Python `sqlite3`에 복제해 실행. 케이스별 인메모리 SQLite 테이블 7개(사건, source-version, calc head/run, legal head, job, document run) 사용, 각 시나리오에서 pending을 초기화. PR #17 SQL 생성 헬퍼의 결합 SQL 술어도 격리 SQLite에서 동일 조건 시험. 결과:

| 합성 조작 | 기대 UPDATE | main 관찰 | PR #17 수정안 관찰 |
|---|---:|---:|---:|
| 변경 없음 | 1 | 1 | 1 |
| 사건 revision 4→5 | 0 | **1 (구판본 완료)** | 0 |
| source dataVersion 5→6 | 0 | **1 (구판본 완료)** | 0 |
| lease-A→lease-B | 0 | **1 (구 lease 완료)** | 0 |
| current calc-A→calc-B | 0 | **1 (구 계산 완료)** | 0 |
| legal-A→legal-B | 0 | 0 | 0 |
| worker lease 기한 만료 | 0 | **1 (만료 lease 완료)** | 0 |
| calc-A 참조 SHA 변경 | 0 | **1 (구 기준정보 완료)** | 0 |

main **2/8 독립 기대 일치**, 별도 PR #17 SQL **8/8 일치**. 이는 **기존 2차 P0/P1 기능 결함을 새 합성 SQLite로 재확인**한 것이며 **새 결함으로 중복 집계하지 않음**. `case-legal-automation.processDraft`는 저장된 projection 필드와 법률 head를 writer 호출 전 확인하는 경로가 있으나, 이후 `commitManifest`의 원자 CAS 누락을 대체하지 못함. PR #17은 미병합 상태로 취급; 코드 중복 수정 없음.

**정확한 범위:** 단일 UPDATE 격리 SQL 검증이다. PR #17의 receipt INSERT+UPDATE를 실제 D1 `database.batch` 원자성·다중 worker/시간경합·R2 artifact·HTTP까지 실행한 결과가 아니다. 기존 [PR #24](https://github.com/firmengine/firmengine/pull/24) ACK 소실 관련 미병합 결함과 결합되는 실경로 검증도 필요. C01/C02/C04/95규칙/실제 Word E2E 합격 선언 금지. [ ] 유지.

## A1-CALC-018 — 사업소득 승인 후 원천·법률·최종 검수 재평가

**원본 main blob**: `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378`, `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/legal-review-identity.ts` `be300beef76f2ca130293763a28932d9046dcf59`, `lib/business-net-reconciliation.ts` `60a4fc295943dce404a7f99efffe88f58dd2d4ff`. 기존 `tests/business-net-review-lifecycle.test.ts` blob `dc089bd14f4c07f204cde7ca4038fe49ca08410c`.

`business.net.propose`는 review-only; 변호사 `business.net.adopt`는 실제 사업소득 source를 추가하고 `touchCase(previous)`→`resetReviews(data,impact)`로 분기함을 코드에서 확인. 승인 확정은 아니며, 기존 동일인 과거 승인 무효 검증의 [Draft PR #55](https://github.com/firmengine/firmengine/pull/55) 미병합 별도 주의.

**실제 격리 V8 합성:** GitHub의 실제 `touchCase`, `invalidateExports`, `resetReviews`, `currentLegalDispositionOutcome` 함수 본문에서 TypeScript 타입 주석만 제거해 동적 실행. 실행기에서 지원되지 않는 `structuredClone`은 JSON round-trip deep-clone shim으로 대체(입력은 단순 JSON), 단순 source fixture `caseRevision=4`·문서 current/archived·문서 직원/변호사 서명·검토 플래그 true·기존 승인 legal disposition 포함. 기존 revision 4는 변경하지 않은 채 복제본은 5로 변경, current file invalidated 및 기존 서명 null, 대표기간/계산/기준 승인 false·reference-review SHA 삭제·paymentSchedule.reviewed false·제안 stale·독립 두 번째 사건 불변을 확인. 합성 old legal disposition은 기록으로 보존하지만, current 법률 run이 없거나 새로운 dependency fingerprint의 run만 있으면 `currentLegalDispositionOutcome`은 `needs_review`, 동일한 새 승인 run+fingerprint일 때만 accepted. 이전 명시적 rejection은 계속 rejected. **총 15/15 독립 기대 일치**.

**중요 미검증:** 실제 `business.net.adopt`의 허가/원문/정책 계약→D1 source-watch 증가→10분 후 18계산 head 교체→95 LawGraph 검토 재생성→직원/변호사 화면/문서 완결 경로는 **실행하지 않음**. 기존 대기 PR #55에는 과거 자기승인 기록이 유효 계산소득으로 재사용되는 P1이 있으므로 main 제품 합격 아님. [ ] 유지.

## 이번 회차 결과 및 후속

- `A1-IT-017`: 보관된 v43 SHA와 main의 schema/package 불일치 **정적 확인**, reference-release 파일 동일; **현재 배포판/실제 DB 미관찰**.
- `A1-AX-014`: 기존 구판본 자동초안 writer 완료 버그 **main 격리 SQLite 재현**(main 2/8, PR#17 수정안 8/8). 중복 코드 수정·새 PR 없음.
- `A1-CALC-018`: 실제 순수 함수 추출/JSON shim 격리 **15/15 기대 일치**; 전체 승인 후 재계산/법률/문서 파이프라인 미검증.
- 모든 체크 **[ ] 유지**, 제품 전체 인수 완료 **0**. 전체 Node/TypeScript/lint/build/Actions CI·staging D1/R2/Cron·법원 공식 서식·실무자 승인/사이트 배포 미실행.
- 다음 회차 역할: **서류담당자→변호사→데이터담당자**. 우선 ID: `A1-DOC-012`(갈음 승인 후 원본 철회/상담변경 재요청), `A1-LAW-016`(새 사업소득 소스와 구 법률승인 경계), `A1-DATA-017`(원문/기준정보 수정 시 소비처 재투영). 특히 PR #17/#24/#55/#57 병합/충돌 상황과 기존 ID 증빙 선확인.
