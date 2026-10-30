# A1 기능·충돌 감사 — 2026-10-30 KST 회차 2
소스 기준 GitHub main: `80d18be3dade8f21143ecabb2f4027336f9a8a63` (2026-10-30 13:46:08 KST).
작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`에만 한정. 공개 사건 원본·OCR 사실값·키·비밀정보 사용 없음.

## 선행 작업/타 에이전트 교차 확인

- 선행 A1 회차: [2026-10-30_1309_KST_review-only-append-guard.md](2026-10-30_1309_KST_review-only-append-guard.md); `A1-LAW-015`, `A1-DOC-015`, `A1-DATA-011`의 review-only 이력변조 방어 결함은 **PR #12 미병합**. 변경 중인 소스는 덮지 않음.
- 최근 타 축: A2 [PR #13](https://github.com/firmengine/firmengine/pull/13), A3 [PR #14](https://github.com/firmengine/firmengine/pull/14), A4 [PR #15](https://github.com/firmengine/firmengine/pull/15)·[PR #16](https://github.com/firmengine/firmengine/pull/16). 이번 A1 [PR #17](https://github.com/firmengine/firmengine/pull/17)은 다른 기존 PR 파일과 중복 수정 없음.
- 이번 6역할 순환: 이전 변호사/서류담당/데이터 관점 다음으로 **IT / AX / 계산사무장** 관점을 선택. 3개 개별 체크 ID를 검토.

## 체크 ID별 검증 상태

| ID | 관점/범위 | 실제 관찰/증빙 | 판정 |
| --- | --- | --- | --- |
| `A1-IT-010` | IT / 동일 사건 두 작성자 CAS 저장과 타 사건 격리 | `lib/server-store.ts` main blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`: `UPDATE cases ... WHERE id=? AND revision=? AND storage_token=?`. 동일 SQL 격리 sqlite3에서 (a) 동일 revision/token 두 소스 수정 1성공/1거부, (b) review-only 동일 revision에서 token 변경 시 늦은 저장 거부, (c) 다른 사건 ID 두 저장 독립성, (d) 잘못된 token 0건 검증. 기존 `tests/case-command-storage.test.ts`에도 4개 상황의 테스트가 등록되어 있으나 **이번 회차 Node 원본 테스트 및 실제 브라우저·D1 동시경합 미실행**. | `SYNTHETIC_SQLITE_EXECUTED` / 제품 인수 **미완** |
| `A1-AX-014` | AX / 법률·서식 미확정 시 writer 차단과 초안 완료 경합 | `lib/case-legal-automation.ts`의 `processDraft`는 `assessAutomaticDraftProjection`에서 0필드·필수 토큰 누락·중복을 구조적으로 차단하는 기존 코드. 그러나 `lib/automatic-review-draft.ts`의 마지막 `commitManifest`는 별도 async `assertCurrent` 이후 **이전 legal/calculation head만 살아 있으면 현재 case/source/lease가 바뀌어도 완료**하는 SQL을 사용. 실제 원본 SQL을 sqlite3로 실행: 시작 case revision=4/sourceVersion=5/old legal-v5·calc-v5, 작업 중 현재 revision=5/sourceVersion=6, 과거 head는 보존 → **기대: writer receipt 0건, complete 0건 / 실제: receipt 1건, UPDATE 1건, status=complete**. 이것은 DB 조건의 **격리 합성 반례**이며 운영 Cloudflare exploit 재현이 아님. **Draft [PR #17](https://github.com/firmengine/firmengine/pull/17)**에서 sourceVersion·caseRevision·계산/법률/기준 SHA·현재 lease를 같은 원자 SQL CAS로 검증, receipt INSERT도 동일조건 게이트, 양쪽 변경 1건씩 요구. 순수 Node 22.16.0/SQLite 9개 합성 회귀 **9/9**. | `DEFECT_REPRODUCED / SYNTHETIC_SQLITE_EXECUTED / PR_PENDING`, **미병합·제품 인수 미완** |
| `A1-CALC-018` | 계산사무장 / 승인 영업소득 이후 구 대표기간·변제·문서 승인 무효화 | `lib/case-commands.ts`의 `business.net.adopt`는 인적 `lawyer_review` 권한·합성원본 자동승인 차단 후 `adoptBusinessNet`으로 typed income 추가, `resetReviews`에서 `incomePeriodReviewed`·`presentValueReviewed`·`allocationBasisReviewed` 등 false 및 `shortenedTermReview` 삭제. 출처 변경은 `touchCase` 호출을 거치며 `lib/domain.ts`의 실제 본문을 V8로 분리 실행해 JSON 합성 5조건(사건 revision+1, current 산출물 invalidated, archived 보존, 직원/변호사 서명 null, 원래 스냅샷 불변) **5/5 기대일치**. `tests/business-net-review-lifecycle.test.ts`에 기간 무효화 검증 존재하나 본 회차 Node 전체/운영 D1·실제 서식 통합 재실행 없음. 법률/계산 최신 head가 실제로 갱신되고 직원 UI가 종전 승인으로 표시하지 않는지 별도 확인 필요. | `CODE_REVIEWED / ISOLATED_V8_EXECUTED`, 전체 인수 **미완** |

## 수정 PR #17·실제 합성 오라클

- 브랜치: `audit/a1-draft-commit-cas-20261030-1353` / 기준 main `80d18be3...` / head `0ce1292a241d8baf98d5b9e230071cca980eb2fa` / **draft·미병합**.
- 수정 파일: `lib/automatic-review-draft.ts`, 신규 `lib/automatic-draft-manifest-cas.ts`, 신규 `tests/automatic-draft-manifest-cas.test.ts`. **이 3개만** 변경.
- 기존 SQL 반례: 최소 SQLite 테이블 `cases`, `case_data_change_state`, `case_calculation_heads`, `case_legal_review_heads`, `case_automatic_document_runs`, `analyses`; 이중 current source 버전만 증가해도 이전 EXISTS가 참으로 남았다. 먼저 unguarded receipt INSERT가 저장되며 stale complete가 가능했다.
- 새 guard 합성 9개: current 정합 정상 1/1, 사건 revision 변경, OCR-only sourceVersion 변경, worker lease 교체, lease 만료, calculator head 교체, legal head 교체, reference SHA 변경, 이미 complete된 run 중복. 실행: `node --experimental-strip-types --test /mnt/data/a1_round2/tests/automatic-draft-manifest-cas.test.ts`, Node v22.16.0 → **9/9 통과**. 격리 로컬 복제된 동일 SQL 헬퍼를 실행한 결과로서 GitHub 커밋 테스트 파일·전체 프로젝트 CI 실행과 구별한다.
- A1-IT-010 합성 독립 Oracle: `python /mnt/data/a1_round2/sqlite-case-storage-cas.py` → 위 네 SQLite 조건 기대 일치. 런타임·DB/브라우저 통합이 아닌 **동일 UPDATE SQL 조건 실행**이다.
- 제품 미인증: 원본 전체 테스트(`npm ci`, `node --test`), lint·build·TypeScript 검증, Cloudflare staging D1/R2·Cron·모델/실제 Word 생성, 법원 양식/변호사 승인. 공개 Git에 로컬 합성 파일의 임의 원문 데이터를 업로드하지 않았으며, PR #17 테스트는 완전 합성 코드다.

## 후속 우선순위

1. **PR #17 실제 Node 회귀 + staging Cloudflare D1 batch/worker 경쟁 + R2 유실 복구** 확인 후에만 병합 판단. PR #12·#15·#16과 별도이므로 병합시 최신 main 재베이스.
2. `A1-DOC-015` 기존 PR #12 검증, `A1-LAW-016` 실제 새 소득 채택 후 법률 승인 재평가, `A1-DATA-017` 원문/기준정보 변경의 서류·법률 소비처 재투영. 역할은 다음 회차 **서류→변호사→데이터** 순환.
3. 추가 보류 의심: `commitExportArtifactTransaction`의 마지막 D1 batch가 **성공 후 응답 소실**하는 경우 호출자에서 DB 커밋 확인 없이 R2를 cleanup할 가능성. 현재는 **코드 경로상 우려(아직 재현/수정 아님)**. 별도 A1/A4 실패주입에서 독립 실행하여 검증.
4. 이 회차 최종 승인 처리: **0건**. 실제 법률 결론, 법원 제출 또는 운영 릴리스 변경 없음.
