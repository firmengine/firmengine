# FirmEngine A4 45차 — 법률 수동재시도 활성 기준판본 이탈 차단 (Draft)

- 감사 시점: 2026-11-01 KST. 첫 확인 `main` HEAD `b383107382a9d3c742c41bd219a18270c9e944ff` (타 축 A3 r45 보드 보존 병합). 작업 범위는 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- 단일 인수 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. **직접 독립검증 4 ID:** `A4-IT-003`, `A4-LAW-001`, `A4-DATA-014`, `X-046`. 연관 인계만 확인: `A4-DOC-017`, `A4-CALC-004`, `A4-AX-005`. 전부 **[ ] 미완료**.
- 6역할 순환: **사용자·서류 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자**. 직전 r44는 IT 선행.
- 읽은 원본: `drizzle/0017_legal_reanalysis_orchestration.sql` blob `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`; `main lib/case-legal-automation.ts` blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`; PR #110 동일 파일 최초 blob `86c933372028024c5a19a2786b0325ae45823a2c`; `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`; 수동 재시도 API route `4157b0dd7b670882f81b64ae083d0f106d75e0f3`; `tests/case-legal-manual-retry-current-head-r42.test.mjs`; A4 r44 이전 감사 영수증 및 PR #16/#110/#114/#61 상태.
- 주요 PR은 조회 시 #110 **Draft/Open**, #114 **Draft/Open**, #16 **Open/미병합**, #61 **Draft/Open**. 각 PR 병합·staging/CI 결과로 간주하지 않음.

## 독립 반례: 현재 계산 head와 활성 기준정보 release는 서로 다르다

- 합성 사건: case=`synthetic-case`, source dataVersion=1, caseRevision=1, current calculation head `calc-1/input/ref-old`, 법률 job `failed`; 그러나 **현재 활성 기준정보 식별자 `ref-new`**. 원본 수치, 실제 의뢰인/개인정보/비공개 OCR, 법률 인정/인가 자료는 일절 사용하지 않음.
- `main`/기존 PR #110은 `latest()`의 계산 run 식별자/버전은 검증하지만, `retryFailedCaseLegalAutomation()` 입구에서 현재 `referenceIdentity()?.sha256??referenceRelease.sha256`와 run `referenceSha256`를 비교하지 않음. PR #110의 기존 correlated UPDATE CAS도 과거 run/job **서로 간의 동일성**만 검사하여, 현재 활성 release가 변경되었으나 아직 새 계산 head로 반영되지 않은 시점을 잡지 못함.
- 최초 **실제 PR #110 함수 원본문 V8 발췌 실행**(TypeScript 선언만 자바스크립트로 치환, D1 prepared/batch mock): ref-old head + ref-new 활성 상태에서 **UPDATE+감사 batch ACK 합성 1/1, `retry_wait` 성공 반환** 관찰. 예상은 이전 기준판본 작업 재활성화 금지. **P1 후보 부정대조**(운영 사고 확정 아님).
- 별도 대조: 같은 ref-old 활성에서는 정상 `retry_wait`; dataVersion 불일치는 `LEGAL_AUTOMATION_RETRY_STALE_VERSION`; job 부재는 `LEGAL_AUTOMATION_NO_CURRENT_FAILED_JOB`. 입구 가드 누락의 영향 범위를 독립 분리함.

## 수정 후보 / 실제 관찰

- **[Draft PR #110](https://github.com/firmengine/firmengine/pull/110)**의 기존 코드와 blob을 읽고, 업데이트 직전 `main` HEAD 및 PR head·파일 blob을 재확인한 뒤 **PR 브랜치만** 변경. 관련 코드 commit `82772e574411a6cafd75f993ca251d4df44ea0ff`, 새 source blob `6155b30dd3b0921788a7d7fac3dc7363fde5d0cb`.
- `latest()`에서 얻은 현재 계산 head의 `referenceSha256`가 활성 `referenceIdentity()?.sha256??referenceRelease.sha256`와 다르면 **어떤 D1 UPDATE도 수행하기 전** `LEGAL_AUTOMATION_RETRY_STALE_REFERENCE`로 보류. SQL 산식/95개 법률 판단·승인 상태 의미는 변경하지 않음. 신규 저장소 회귀 테스트 `tests/case-legal-manual-retry-reference-r45.test.mjs` 5건 작성·Draft commit `766f0b0f919bbfa6037fc92cbf8ac8f53acf0e20`.
- **수정 후 GitHub 발췌 원본문을 V8에서 다시 실행 5/5 기대 일치**: stale active ref → 오류/DB writes 0; matched ref → `retry_wait`/batch 1; dataVersion stale → 오류/0; missing calc head → 오류/0; missing job → 오류/0. **함수 V8·D1 응답 모사**이지 Node-native·Cloudflare D1 실행이 아니다.
- 독립 컨테이너 Node 22.16.0 `node --test /mnt/data/firmengine-a4/round41_manual_retry_batch_sqlite.test.mjs /mnt/data/firmengine-a4/round42_legal_retry_head_cas_sqlite.test.mjs /mnt/data/firmengine-a4/round43_transition_audit_atomic_sqlite.test.mjs /mnt/data/firmengine-a4/round44_failure_ack_batch_sqlite.test.mjs`: **40/40 관찰 일치**. 기존 오류 부정대조가 포함되어 **안전 인증 40건**을 뜻하지 않는다. 새 r45 소스 파일 기반 Node-native 테스트는 저장소 안에 작성했으나 **미실행**.
- `main` 코드·DB 스키마·서식·운영 실행 변경 없음. PR #110의 다른 커밋·파일은 보존. #114와의 동일 파일 충돌·향후 staging D1과 HTTP 두 워커 통합을 병합 전에 검토해야 함.

## 남은 위험과 불가 판정

1. 기준정보가 **입구 검증 뒤 실행 중** 바뀌는 경쟁, 동일 source version의 계산 head 구 reference 역전(PR #16), 수동 재시도 API의 stale 반환 코드와 HTTP status 매핑, batch COMMIT 이후 ACK 유실 영속 재조회는 여전히 미해결. 본 후보는 입구 시점의 확정적으로 오래된 release를 차단할 뿐, reference의 완전한 원자적 세대 고정은 아님.
2. 실제 `drizzle/0017` 저장소와 타 법률 단계의 `transition/failure` batch 후보(#110/#114)는 병합·전체 회귀·D1 staging 검증 전. `D1 meta.changes` 0/1/null/미관찰/2/오류·부분성공/감사 누락을 다른 의미로 승격하지 않음.
3. 상담→서류→OCR→10분 quiet calculation→95법률→Word 초안→직원/변호사 승인→법원 실제 보정 단계는 **scheduler/법률 워커의 source-only 연결 확인**이며, 기능 전체를 실제 실행한 영수증 아님. 변경 후 기존 서명·검토 무효화, 갈음 철회, 관할판본, null 기한 등은 미검증.
4. 운영 n8n 워크플로·Cloudflare staging D1/R2/Cron·실 HTTP 두 워커·실제 DOCX/공식 서식·변호사 검수·전자제출은 **미실행**. n8n 설계문서와 배포된 운영 워크플로는 동일하다고 주장하지 않음.

## 다음 A4 ID / 인계

- `A4-IT-003 / X-046 / A4-CALC-004`: reference release 변화 **입구-DB UPDATE 사이** 및 계산 head 동일 버전 경합을 실제 이중연결/실 staging에서 검증; PR #16과 #110 수동재시도 CAS를 함께 설계.
- `A4-DATA-014 / A4-LAW-001 / A4-LAW-006`: PR #110/#114 병합 충돌, legal 상태·감사 atomic batch, COMMIT 후 응답 유실 영속 재조회, 기존 승인 stale 판정·Word 재생성의 사람 검토.
- `A4-DOC-017 / A4-AX-005 / X-048`: R2 성공/D1 실패, 429/503/timeout 부분성공 및 성공 증빙의 재시도 보존; 운영 모델·Cron 실패를 임의로 성공 표시하지 않기.

**이번 직접검증 ID 4개 모두 [ ] 미완료; 제품 최종 인수 완료 0건.** 고객정보/키/.env/원본 OCR 사실값 공개 Git 미기록. 운영 배포, 운영 D1 마이그레이션, 실제 전자제출/인가 미실행.
