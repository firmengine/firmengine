# FirmEngine A1 39차 — OCR 정정 단일값·계산입력 독립 승인·18계산 91입력 경계

- 일자: 2026-11-01 KST. 범위: `firmengine/firmengine`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 감사 시작 당시 실제 GitHub `refs/heads/main` = `a9c28602f0ddef45bcf542907a96bef9c61eb3b6`. GitHub API ref·최근 커밋 및 PR, 중앙 보드, 직전 A1 38차 영수증, `db/schema.ts`, 관련 SQL·소스·테스트 직접 조회.
- 이번 순환: **서류담당자 A1-DOC-014 → 변호사 A1-LAW-015 → 데이터담당자 A1-DATA-014**. 직전 IT/AX/계산사무장 역할과 교차.
- **실측 기준:** 실제 원본 소스에 포함된 보호 분기 JS를 V8에서 격리 실행(순수 입력·합성 의존 함수). 실행 코드와 원래 TypeScript 전체 빌드/API 통합/운영 DB 실행을 동일시하지 않는다. 원본 OCR·실제 사건·개인정보·인증키·비공개 정답 사용/업로드 없음.

## A1-DOC-014 — OCR 직원 정정 값이 배열로 바뀌는 기존 결함 재확인

- main `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`, `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`. 기존 `tests/case-commands.test.ts` blob `a388177e8120174ee57c683264292b86faf76f2b` 참조.
- `fact.correct` 입력 단계의 **실제 값 검증식**을 V8에서 실행. 합성 입력 8조건 = 일반 텍스트/숫자/null/배열/중첩배열/객체/undefined/단위만 정정. 독립 기대는 단일 문자열·숫자·명시적 null 및 단위만 정정 허용; 배열·객체·undefined 거절.
- main **6/8** 기대 일치: 배열 `["A"]`·중첩배열 `[["A"]]`을 원문 단일값으로 잘못 허용. 기존 [Draft PR #69](https://github.com/firmengine/firmengine/pull/69) 수정 조건 **8/8** 기대 일치. #69는 아직 main에 없으므로 신규 결함으로 중복 집계하지 않음.
- `reviewFact()`는 supersedes/version을 이용하여 과거 Fact와 정정 Fact를 분리하는 코드가 있으나, 이번은 입력 가드 분기 격리일 뿐 실제 `fact.correct` API→D1 저장→원문대조→UI의 전 과정은 미실행. **[ ] 미완료**.

## A1-LAW-015 — 계산입력 제안자 자기승인의 추가 경로 (신규 P1 후보)

- main `lib/case-commands.ts` 동일 blob `d18c555f04f65687c509a8e8d35aba4bb3597378`, `lib/case-command-contract.ts` blob `4bcae36d910c50db4181f015a952a3060e4189ed`, `lib/calculation-overrides.ts` blob `2069b0fb81a15a8a8450d3c22fc6edb845db5fff`.
- 코드 경로: `decision.propose`는 `actor`를 기록. `decision.adopt`는 서버 `caseworker_review` 권한·제안 상태·근거 fingerprint를 확인하나 **저장된 제안자와 현재 승인자 동일인 여부를 비교하지 않음**. 동일 인물에게 편집·검토 권한이 겹치면 자기 채택 가능. 이것은 최종 문서 동일인 이중검수 [Draft #28](https://github.com/firmengine/firmengine/pull/28)과 **다른 명령 경로**.
- 실제 양쪽 GitHub 소스의 `decision.adopt` 분기 본문(타입 단언 1개 제거) + 합성 함수 의존성으로 실행한 **독립 7조건**:
  1. 동일 제안자/승인자 → 기대 거절; main **허용**, PR 후보 거절.
  2. 양측 공백만 다른 ID → 기대 거절; main **허용**, PR 후보 거절.
  3. 대·소문자만 다른 ID → 기대 거절; main **허용**, PR 후보 거절.
  4. 다른 사람의 승인 → 기대 허용; 양측 허용.
  5. 제안자 ID 공백 → 기대 거절; main **허용**, PR 후보 거절.
  6. 무효화된 기준 fingerprint → 기대 거절; 양측 거절.
  7. 이미 채택된 제안 → 기대 거절; 양측 거절.
- main **3/7**, **저장된 수정 브랜치 7/7 기대 일치**. [Draft PR #103](https://github.com/firmengine/firmengine/pull/103), 브랜치 `audit/a1-r39-independent-decision-adopt-20261101` HEAD `3c550b3b771d3ee31a2e061f11d0efad7c203f6c`; 코드 blob `6f9bab5fd1b7f7ba1614cc7b3f69a63f59275b70`; 새 Node 회귀 blob `56fdc40c418160b7fdabc2669fe10cbcfec6541c`.
- 수정은 actor 미존재/공백 및 trim+소문자 기준 동일인 자기승인을 `INDEPENDENT_REVIEW_REQUIRED`로 거절. 계산 수치·산식·법원 인정 상태·기존 이력은 변경하지 않음. **역할 정책은 기존 `caseworker_review` 그대로**이므로 변호사의 별도 권한이 이 경로에 필수인지는 실제 변호사/운영담당자 결정 필요.
- Node 회귀 **4개 작성·GitHub 커밋했지만 실행하지 않음**. PR #103은 Draft·미병합, status checks 0건/Actions 0건. 기존 #20/#69 역시 같은 소스 파일 변경하므로 안전한 rebase·통합 회귀 필요. 실제 REST 권한·D1·브라우저 승인 흐름과 법률 실무 검토는 **미검증**. **[ ] 미완료**.

## A1-DATA-014 — 18계산·91입력 선언/SQL 보존 경계

- 실제 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`의 `calculations` 전체를 파싱해 독립 집계: **18개 모듈**, 입력 선언 **91개(고유 경로 78개)**, 출력 선언 **42개(고유 이름 40개)**, resultPaths **42개(고유 경로 42개)**.
- `lib/execution-catalog.ts` blob `6909ecc7c0e33792e3932b64d9ade0ba6028d736`가 선언을 읽어 처리하는 경로, `lib/calculation-input-audit.ts` blob `288edc397527842c96874ef3e713f23bb534a5f1`의 direct/derived/context/source-only 분류, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`의 `calculationFeatureRows` 및 저장 경로를 검토.
- `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`의 run/head/feature 테이블 및 `source_fact_ids_json`/`input_refs_json`/`formula` 저장 컬럼 존재 직접 확인. 이는 **스키마·코드 존재 증거**일 뿐, 91개 원천의 실제 저장/재독 및 18개 산식 소비 완료 증거가 아니다.
- 기존 `tests/calculation-input-audit.test.ts` blob `6b039d94ae0912e825103c5461e2e8bf5e0d3445`는 미실행. 실제 D1에서 가상 사건의 91 입력→18계산→42 출력 저장→유효 Fact 비교·run 재조회 전체 경로를 수행하지 않았음. 결측/null/0/비해당/상충을 자동으로 동일 처리하지 않음. **[ ] 미완료**.

## 후속/제약

- 세 ID 모두 인수 완료 **0개**, source-only 부분검증으로 중앙 보드 미완료 유지.
- 새 P1 후보 1개(기존 #28의 단순 중복 아님), 수정 Draft PR #103 1개, 기존 DOC #69 반례 재확인, 데이터 18/91/42 정적 계약 집계.
- 다음 역할 교차: **IT A1-IT-012**(마이그레이션 0000~0022), **AX A1-AX-006**(법률 출처 검색 실패 검토보류), **계산사무장 A1-CALC-006**(채무 구성 요소·다중 행).
- 전체 Node 프로젝트 회귀·TypeScript·lint·CI/빌드·Cloudflare staging D1/R2/Cron·실제 PDF/Word 공식서식·변호사 실승인·사이트 배포 **미실행**. 운영 배포, D1 운영 마이그레이션, 실제 전자제출 및 법원 인가 확정 **수행하지 않음**. 실행기의 실제 Extra High 모드는 검증 불가.
