# FirmEngine A1 — 75차 독립 감사: OCR 정정·서명 독립성·계산 출처 Fact-ID

- 실행: 2026-11-02 KST, A1 기능 완결성·상호충돌만. 감사 시작 소스 `main` HEAD `6242391036e42301a307fcb2286ee4473e9e0612`; 영수증 기록 직전 `main` HEAD `6242391036e42301a307fcb2286ee4473e9e0612`. 74차 영수증 `20261102-round74-migrations-calculator-monthly-1356KST.md`와 중앙 보드, 최근 10개 main 커밋, 관련 열린 Draft PR #28/#69/#103/#121/#138/#148/#163/#175, 스키마·실코드·테스트를 조회했다.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 순환 역할: **사용자·서류담당자 A1-DOC-014 → 변호사 A1-LAW-015 → 데이터담당자 A1-DATA-014**. 모두 **[ ] 미완료** 유지.
- 증거 수준: 실제 GitHub 함수 본문에서 타입 선언만 제거한 V8 격리 시험. 일부 의존성은 합성 stub. GitHub 함수/정적 스키마 확인과 Node 전체 실행, CI, 운영/스테이징 D1·R2, 실제 문서 및 변호사 승인은 다르다. 실제 고객·OCR·법원 서식·인증키 정보 사용 안 함.

## A1-DOC-014 — 원문과 직원 정정의 판본 분리

- main `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`; 기존 Draft #69 소스 blob `4ed37b0f0ed779d44f66910e7e70e80d55e8871f`; `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`. 기존 `tests/case-commands.test.ts` blob `a388177e8120174ee57c683264292b86faf76f2b`.
- `fact.correct`의 **실제 입력 가드** V8 12조건: 단일 텍스트/숫자/명시 0/null/빈 문자열/단위만 변경 수용, 값과 단위 동시 누락/undefined/배열/중첩배열/객체/잘못된 단위 거절. **main 10/12, Draft #69 12/12 독립 기대 일치**. main에서 배열 `["A"]`와 중첩배열 `[["A"]]`이 수용되는 **기존 P2** 재현.
- `reviewFact` 실제 함수 본문을 현재 Fact 조회·revision 갱신·비금액 판정을 합성 의존성으로 주입해 **4/4 기대 일치**: 문자열 변경, 명시적 null, 0, sourceUnit만 변경. 각 조건에서 기존 Fact version=1 유지·수정 version=2 생성·기존 입력 불변·수정 Fact `unreviewed`·기존 OCR fieldObservation의 `supersededByHumanFactId` 연결·새 Fact의 이전 `sourceVerification` 삭제를 관찰.
- 결론: 기존 입력 타입 오수락은 main에 있음. 정정/원본 판본 연결은 이 4개 합성 입력에서 통과했으나 `fact.correct` API→D1→실제 원문/페이지→서식 전체 흐름은 **미검증**. 기존 #69가 수정 중이므로 중복 PR 없음.

## A1-LAW-015 — 직원 제안자와 독립 채택자

- main `lib/case-commands.ts` 동일 blob `d18c555f04f65687c509a8e8d35aba4bb3597378`; Draft #103 후보 blob `6f9bab5fd1b7f7ba1614cc7b3f69a63f59275b70`.
- 실제 `decision.adopt` 분기 본문 V8 합성 8조건: 같은 actor, 앞뒤 공백만 변경, 대·소문자만 변경, 다른 actor, 제안자 공백, stale fingerprint, 이미 채택, 검토 권한 없음. 독립 기대 **main 4/8, Draft #103 8/8**. main은 동일 사람·공백·대소문자·미기록 제안자 4조건을 승인해 **기존 P1 독립성 결함** 재현. 동일인이 `case_editor`+`caseworker_review` 권한을 모두 가진 합성 권한 조건임.
- #103은 다른 담당자 및 trim/case 비교를 강제하지만 **lawyer_review 역할 필수 여부는 별도 변호사 실무 정책**이다. 최종 문서 이중 검수 Draft #28은 이와 별도 명령 경로이며 이 회차에서는 실행하지 않았다. UI/API/D1 서명 검증 불가; 모두 미완료.

## A1-DATA-014 — 18계산/91입력과 출처 Fact-ID

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 실제 JSON 독립 파싱: **18 모듈 / 입력 선언 91(고유 경로 78) / 출력 선언 42(고유 이름 40) / resultPaths 42(고유 42)**; 미정의 dependsOn 0, 중복 모듈 ID 0, 입력·출력·결과경로 중 하나라도 빈 모듈 0. 'status', 'totals' 출력 이름은 모듈 간 중복이므로 단순 이름만으로 SQL-계산 모듈 일대일 매핑을 인증할 수 없음.
- `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`. 영속 열: run/head/feature, source_fact_ids_json, input_refs_json, formula. `tests/case-calculation-feature-store.test.ts` blob `844525d8633442d571ced2c48ed5bd00ba7bb5a0` 실제 파일 확인.
- 실제 순수 `statusOf` V8: null/undefined/unknown/명시적 0/문자열 0/blocked/conflict/not_applicable/reviewed_basis 구분 **12/12 독립 기대 일치**. 이 결과는 숫자의 법적 인정·모듈 18개 완결성을 뜻하지 않음.
- **신규 P2 후보:** `factIds` 실제 함수에 `sourceFactIds:[""]`, `["  "]`, `factIds:[null]`, `[42]`가 오면 공란 ID를 그대로 반환하거나 무효 요소를 조용히 삭제했다. provenance 배열에는 명시적으로 유효한 Fact-ID 문자열만 존재해야 하며, 원장 저장 전 묵인하면 출처 검증력이 떨어짐. 11개 합성 입력 main **6/11** 기대 일치, 수정 후보 **11/11**.
- 별도 [Draft PR #177](https://github.com/firmengine/firmengine/pull/177) 작성: `lib/case-calculation-feature-store.ts` 수정 blob `293c02d990d741e35033d7718c7f8efa56d6382b`, `tests/a1-r75-calculation-fact-lineage.test.ts` 신규 blob `1feacc5c1ab2de93c46f75ef39878396faf3e791`, PR HEAD `ca259d6d5ba259c378acdd167f2ab5ff28d2c691`. 명시된 배열의 잘못된 요소만 `CALCULATION_FEATURE_INVALID_FACT_ID`로 fail-closed. 정상 ID·중복 제거·원천 ID 미관찰(`null` 또는 빈 배열)과 명시 0원은 별도 유지. **작성된 Node 회귀 블록 3개는 프로젝트 실행 미수행**. PR 수정 GitHub 본문 재조회 후 실제 helper V8 7/7 재확인.
- 드래프트를 main에 자동 병합하지 않음. 기존 #49/#121/#138/#148/#163 및 #175의 인접 provenance/replay·저장소 수정과 통합 검증, 구판본 수치 저장/오류 처리 계약, 전수 DB/서식 소비처 및 데이터담당자·계산사무장 검수 필요.

## 종합 및 인수 게이트

- 본 회차 신규 **P2 결함 후보 1개**, 기존 P2/P1 각 1개 재현. 신규 Draft PR **#177** 1개, 제품코드 main 변경 0개. 본문·코드·테스트 파일은 `ax-site/` 경로만 접근/수정. 중앙 보드에서는 해당 3개 A1 ID에만 이 기록을 추가하고 모두 `[ ]` 유지.
- 다음 순환 **IT A1-IT-013 / AX A1-AX-008 / 계산사무장 A1-CALC-006** (정확한 체크 문구는 다음 회차의 최신 단일 보드에서 재조회). 다음 회차는 병렬 HEAD CAS·C01/C02/C04·복수행/갈음/보정명령과의 경계 및 미병합 PR 충돌을 대조한다.
- 전체 프로젝트 Node/TypeScript/lint/CI/빌드·staging D1/R2/Cron·브라우저·실제 85서류/18계산/95법률 종단·공식 법원 양식·직원/변호사 승인·운영 사이트 배포 **미검증**. 운영 배포, 운영 DB migration, 실제 전자제출·법원 인가 확정 **미실행**. Extra High 실행 모드 확인 불가.
