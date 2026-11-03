# FirmEngine A1 — 109차: OCR 직원 정정 / 독립 결재 / 대량원천·계산 조회
- 회차 기준: 2026-11-04 KST. 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 순환 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**. 중앙 보드 선택 **A1-DOC-014 / A1-LAW-015 / A1-DATA-013**, 전부 **[ ] 미완료** 유지.
- 감사 시작 main **910cae47892e5448dacbcfcf5682af6f1c466643**. 보드 최초 blob **601fcc4493c0dff63712c4f08d258d3a8e9d8f69**. 선행 A1 108차 영수증 `20261104-r108-pagination-questions-ledger-0049KST.md` 및 보드 해당 ID의 19/23/33/39/45/73/75차 이력 참조. 최근 A3 r109 2커밋(910cae4/a29e6a9), 이전 A1 r108/관련 Draft PR 확인.
- main 실소스: `lib/case-commands.ts` blob **d18c555f04f65687c509a8e8d35aba4bb3597378**, `lib/extraction-row-store.ts` **ec3f6b9d3ad8bf5f9ce4419a6816fadede378125**, `lib/case-calculation-feature-store.ts` **bb5f88b26e68f5ae2234741063ac9301a927e27a**. `lib/domain.ts` **39ab41856f6d7a379aca7217d24b28f7f5f7616a** 원문/판본 경로와 `db/schema.ts` **933f8686845ac14669312dd21bf85e02c62ed5e6**, `tests/case-commands.test.ts` **a388177e8120174ee57c683264292b86faf76f2b**, `tests/extraction-row-store.test.ts` **adbb896c5bc69716e34ee82c5bfedc5555f677a2** 확인.
- 방법: GitHub에서 받은 **main 원본 조건문·함수**를 V8에서 실행하기 위해 TypeScript 타입표기/비-Null assertion만 제거. 권한 확인·fingerprint·parseContextPatch, D1 prepare/bind/first/all은 **합성 stub/adapter**; 메모리에서만 실행. 별도 쓰기/실 고객 데이터 없음. 아래 통과 수는 선택한 합성 조건의 독립 기대 일치이지 제품 정확도/인수 완료 아님.

## A1-DOC-014 — 정정 입력의 단일 원문값 경계
`case-commands.ts` 실제 `fact.correct` 가드 13조건 **10/13 기대 일치**.
- 일치 10: 문자열 "200", 명시적 0, null, sourceUnit만 지정 "KRW", sourceUnit null은 가드 허용; 객체 `{amount:"10"}`, value undefined, 단위 숫자, 길이 65자 단위, 완전 빈 patch는 가드 거부.
- **불일치 3**: `value=[]`, `value=["10"]`, `value=[["10"]]`의 독립 기대는 원문 단일 스칼라 위반으로 거부; **main은 모두 허용**. 기정 결함이며 새로운 발견으로 중복 집계하지 않음.
- `reviewFact`는 원문 판본 변경·인정상태 초기화 경로가 있지만 이번에는 종단 실행하지 않음. 가드 통과가 OCR 원문 수정/서류 재인정 성공이라는 뜻 아님.
- [기존 Draft PR #69](https://github.com/firmengine/firmengine/pull/69) open/draft 확인(HEAD `72cd495915a0a647ce88370ed301995fcd10b04d`). 해당 PR 수정안은 **이번에 재실행하지 않음**, 코드 패치 중복 생성하지 않음. PR #20도 같은 명령 소스 충돌 가능.

## A1-LAW-015 — 직원 제안자와 채택자 분리
`case-commands.ts` 실제 `decision.adopt` 분기 10조건 **6/10 기대 일치**. authority/review/fingerprint는 원본 경계와 같은 의미의 합성 stub이며 **실 사용자 인증·변호사 승인 검증 아님**.
- 기대 일치: 제안자 staff → 별개 채택자 lawyer(가상 authority) 허용; 존재하지 않는 제안 ID, 이미 채택된 제안, 만료 fingerprint, 승인역할 부재, synthetic 사건은 거부.
- **불일치 4**: 동일 actor `staff→staff`, 양끝 공백 `staff→" staff "`, 대소문자 `staff→"STAFF"`, 제안자 `""`인 기록을 채택하는 경우 모두 독립 기대는 거부이나 **main은 adopted**. actor 비교가 없다는 선행 P1 동일 결함 재현.
- 이 경로는 `decision.adopt`이고 최종 문서 `document.review`의 이중서명과 별개. `review(auth)`는 `caseworker_review` 역할만 기본 검사하므로 변호사 역할의 법률정책은 사람 검토 전 미확정.
- [기존 Draft PR #103](https://github.com/firmengine/firmengine/pull/103) open/draft 확인(HEAD `3c550b3b771d3ee31a2e061f11d0efad7c203f6c`). [Draft #28](https://github.com/firmengine/firmengine/pull/28)은 문서 이중승인 별도 경로. 이 회차 후보 수정 코드는 실행하지 않음.

## A1-DATA-013 — 2,000 OCR 원문행 / 5,000 계산행, head 경합
`listCaseExtractionRows`·`listCaseCalculationFeatures` 실제 원본 함수+합성 D1 adapter **10/12 기대 일치**.
- OCR 2,000원문행 × 1필드, **40페이지 × 50행** 모두 조회: 2000/2000 고유 행, 2000/2000 필드; 단일 head run 유지. limit 51 거부 `INVALID_EXTRACTION_ROW_QUERY`, 요구 revision 불일치 거부 `CASE_REVISION_MISMATCH`.
- 계산 **5,000행 × 10페이지(500행)**: 5000/5000 고유 행; limit 501 거부 `INVALID_CALCULATION_FEATURE_QUERY`, 요구 dataVersion 8 vs 현재 7 거부 `CALCULATION_VERSION_MISMATCH`. 생성 원천값 0은 합성값이지 법률상 인정 0이 아님.
- **불일치 2**: OCR 함수가 A 데이터를 읽은 직후 같은 case revision=1로 활성 head A→B로 변경된 합성 경합: 독립 기대 `CASE_REVISION_MISMATCH`, 관찰 `STALE_A_ACCEPTED`. 계산 함수가 run A의 feature를 읽고 revision=1,dataVersion=7 유지한 채 active head B로 변경: 독립 기대 `CALCULATION_VERSION_MISMATCH`, 관찰 `STALE_A_ACCEPTED`. 쿼리는 전후 revision/dataVersion만 비교하고 head를 재조회하지 않음. 실제 D1 경합/HTTP 아니며, 기존 P1 중복 집계하지 않음.
- OCR 200필드×50행/10000 필드 한계 및 실 2200셀 Node SQL 경로는 **이번에 실행하지 않음**. [Draft #52](https://github.com/firmengine/firmengine/pull/52)와 [Draft #49](https://github.com/firmengine/firmengine/pull/49)는 open/draft, 이 회차 PR 후보는 미실행.

## 결과·보류·다음
- 이 회차 실행 합계 **26/35** 독립 기대 일치(DOC 10/13, LAW 6/10, DATA 10/12), 불일치 9. **전체 제품 점수 아님.** 세 ID 모두 [ ] 유지. 제품 코드 수정/PR 병합 0; 기존 관련 Draft가 있어 범위 중복 패치 회피, 법률 승인 의미 변경 없음.
- 상태 분리: `missing/null/0/not_applicable/conflict/source-only/unapproved` 동일 취급 금지. 인증된 원문/사람 승인의 근거·법원 인정값으로 승격하지 않음.
- Node/TypeScript 전체테스트, CI, 실제 브라우저, 실 staging D1/R2/Cron, 85문서/18계산/95법률 end-to-end, 공식 서식/변호사 승인 **모두 미검증**. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 **실행하지 않음**. 추론 모드 Extra High 설정 여부 **미확인**.
- 다음 역할 순환 **IT담당자 → AX담당자 → 계산사무장** 후보는 최신 중앙 보드의 **A1-IT-014 / A1-AX-014 / A1-CALC-014**를 우선 확인하고 실제 미검증 ID 존재 여부에 따라 선정. 별도 후속 서류/법률/데이터 후보: **A1-DOC-015 / A1-LAW-016 / A1-DATA-014**.
