# FirmEngine A1 — 85차 코드 완결성·상호 기능충돌 감사 (2026-11-03 KST)

- **허용 범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만. 이전 A1 84차 영수증과 중앙 보드 미완료 ID를 먼저 읽고, 사용자·서류담당자 → 변호사 → 데이터담당자 순환.
- **읽기 전 main:** `d06bdd6f9e599a732754ea72fa1176624c021943`; **신규 Draft PR 분기 기준 main:** `c2d18c61b8a9b2aae4893cdbd9988faa30822271`; 이번 영수증 기록 직전 main HEAD: `c2d18c61b8a9b2aae4893cdbd9988faa30822271`. 중앙 보드 업데이트는 별도 최신 SHA로 CAS 처리한다.
- **최근 변경/PR:** main 최근 A2/A3/A4 감사 및 보드 커밋, 열린 PR #196/#195/#194/#193/#192/#191 등 확인; 기존 A1 데이터 주체 종류 충돌 Draft PR #137과 이번 #197은 독립 수정. 기존 84차 영수증 `70c7530a0b6f566ef8604c1baa22d0eff071dd00` 참조.
- **관련 소스(blob):** `lib/intake-engine.ts` `82ddba689ea6d107ba587235205feef45e058527`; `lib/intake-classifier.ts` `3e07327750e0330baceee79dc5608758a862d3e2`; `lib/intake-types.ts` `24788d5edc77d7af97e105992d381d44064cf8e2`; `lib/intake-store.ts` `c0bdea9443a018a46c080a8e39a74a0daf62759f`; `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `lib/legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`; `lib/legal-evidence-criteria.ts` `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`; `lib/feature-lineage-audit.ts` `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`; `lib/party-identity.ts` `4c5df4399298fe314f6d978c4a68c4285914664a`; `lib/document-fulfillment.ts` `d8434f2b81fdfe79be6254714d8428dccf272214`; `lib/extraction-row-store.ts` `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- **기존 테스트 소스(읽기만):** `tests/intake-engine.test.ts` `92fc9c734e02629446a364e915e08e37eb21c8b3`, `tests/feature-lineage-audit.test.ts` `4257434140eaa18efef88bc4fd1fc721048a4d00`, `tests/extraction-row-store.test.ts` `adbb896c5bc69716e34ee82c5bfedc5555f677a2`. 본 회차 전체 Node 프로젝트 회귀는 실행하지 않았다.

## A1-DOC-001 [ ] — 상담 주체의 구조 형식 충돌

- **독립 기대:** 실제 상담 분류 요청 스키마의 `^<scope>:[A-Za-z0-9][A-Za-z0-9_.:-]*$` 및 최대 120자 계약을 서버 `validateIntakeClaims` 역시 적용하고, 다른 범위·신원 혼합은 사람 검토 전에 정상 수용되지 않아야 한다. 신청인/가족/상대방의 *실제 신원*은 문자열 구조 통과와 별개다.
- **실제 재현:** GitHub 원본 `requireSubject` 함수 본문을 V8 격리 실행(14개 합성 `subjectId/scope/state`). `income:wage1`, `household:mother`, `debt:loan.12-5`, `case`, 명시적 부재 `income:none`은 수용; 타 scope/빈 접미사/양성 none은 거부. 하지만 `income:  `, `income:person A`, `income:x/../y`, `income:가족`, 127자 ID, `income:x\n`은 서버가 **수용**하여 요청 스키마와 불일치. **main 8/14 기대 일치.**
- **코드 조치:** 별도 Draft [PR #197](https://github.com/firmengine/firmengine/pull/197), 브랜치 `audit/a1-r85-intake-subject-id-20261103`; `lib/intake-engine.ts` 소스 blob `cc848e246ca8817850919fe97b99fc8e462c3dfd`, 신규 `tests/a1-r85-intake-subject-id-contract.test.ts` blob `b40bdd51782fc014b5e5f6817a14396b092cf519`. 원본문 대비 변경 후 GitHub 커밋 파일 **재조회** 및 원본 함수 V8 동일 14조건 **14/14 기대 일치**. Node 테스트 3블록 **작성/미실행**.
- **한계:** 신원/대화 발화자 분리의 실제 모델 응답, 음성 전사, 상담→85서류→주체 승격·직원 확인, 실제 저장/브라우저는 **미검증**. 과거 잘못된 ID 수용 데이터와 호환성은 실무 확인 후 병합. **[ ] 유지**.

## A1-LAW-002 [ ] — 제595조·과거 면책과 법률상 사실 인정 분리

- **독립 기대:** 과거 면책효력일, 5년 소급기간, 재신청 이력/10년 관련 서류, 허위진술·진술 불성실은 원본·법령 적용일·법률가 검토를 각각 요구한다. `reviewed=yes` UI 값만으로 법률상 면책 제한의 사실 확인을 대신하지 않는다.
- **실제 소스/입력:** `lib/legal-catalog.json`의 `KR-PR-008`은 `context.applicationDate`, `priorProceedings.coverage`, `priorProceedings.dischargeEffectiveDate`, `priorProceedings.type`과 5년 검토를 선언한다. `KR-PR-009`는 별도로 10년 신청/관련서류 검토를 선언(정적 pseudocode; 자동 실행 증거 아님). `lib/assessment.ts` 실제 자격분기 함수 본문을 V8 격리 실행(7개 합성 eligibility 조합): `priorProceedingsReviewed=yes`인데 Fact/면책일을 넣지 않으면 해당 개별 finding은 **0건**; `unknown/no/미설정`은 `review_required`; `naturalPerson=no` 및 `insolventOrRisk=no`는 각 `fail`; 전 항목 unknown은 3개 `review_required`. 해당 분기 안에 원천 Fact 검증 경로 **없음**.
- **판정:** 기존 A3-27/A3-62의 **P2 검토 경계 재현**. 이 분기만으로 `assessCase` 전체 적격 자동통과, 95 법률 검토 우회, 실제 법원 인가 확정은 증명되지 않는다. 허위진술 사유의 실제 조사·조문별 적용일·정식 법원 문서 진위·변호사 승인은 별도 미검증. 법률 의미 변경이므로 **코드 수정 0건, [ ] 유지**.

## A1-DATA-001 [ ] — 문서/페이지/원천 필드/Fact와 주체 링크의 결속

- **독립 기대:** 요구서류가 `link-a`로 확인된 `person-a`에 연결돼 있다면, 같은 문서와 페이지 안의 다른 `person-b` Fact만으로 해당 주체의 필수 필드를 충족하지 않는다. 미확정 subject link도 단독으로 승인 사실로 승격하지 않는다.
- **실제 소스/입력:** `lib/feature-lineage-audit.ts`의 `evaluateCaseFieldLineage` 내부 `referenced` 실제 원본 함수를 V8 격리 실행; `validSourceRef`는 합성 성공 stub, 같은 문서 SHA, page 1, matched requirement `req-a`와 `link-a` 기준. **8조건 중 6/8 독립 기대 일치**. 정상 동일인 Fact true, 제안만 된 match/다른 페이지/변경 해시/다른 requirement/다른 link false. 반례 2건: 같은 문서·페이지의 **다른 `person-b` Fact도 true**, 승인된 match 행만 있고 `subjectLinks` 배열이 **비어 있어도 true**. 이것은 inner predicate의 논리적 경계이며 전체 SQL/CaseData/상위 후속 가드를 돌린 결과는 아니다.
- **상호 교차:** `lib/party-identity.ts`에서 `confirmed` 주체는 `typedEntityId`를 보유하고, `document-fulfillment.ts`에서 match accept는 해당 주체 링크를 검증한다. 그러나 lineage `referenced`는 그 검증을 독립적으로 반복하지 않는다. 실제 Fact.subjectId ↔ typedEntityId 교차 매핑의 일대일 계약이 모든 객체 종류에 확인되지 않으므로 **임의로 문자열 비교 패치하지 않는다**. Draft #137은 kind mismatch 영역으로 별도; 이번 행/기간/주체 문제를 해결했다고 판단 금지.
- **문서/페이지/행/693 ID→Fact 정적 경로:** `extraction-row-store.ts`는 case/document/page/run/record ordinal, canonical id, raw/source state, bound projection을 저장하도록 구현; `field-observation.ts`는 null·0·explicit_none·unknown·conflict 분리; `feature-lineage-audit.ts`는 required source candidate를 조회한다. **실제 693 전체 SQL 저장/재독, 모든 행 역방향, 복수 사건/두 사람/갈음 A←B+C, C01/C02/C04, 법원 보정 E2E는 미실행**. 법적 인정값 승격 0건. **[ ] 유지**.

## 조치와 남은 인수

- 신규 Draft PR **1개 (#197)** / 신규 회귀 test 파일 1개(작성만) / 현 `main` 제품 실행 코드 변경 **0개**. 감사 영수증과 중앙 보드 3개 ID만 `main` 문서로 갱신. 운영 배포·D1 운영 migration·전자제출·법원 인가 확정 **0건**.
- 전체 Node/TypeScript/lint/build/CI, 브라우저, 실제 staging D1/R2/Cron, 법원 공식 서식/변호사 승인/85서류/18계산/95법률 E2E 모두 **미검증**. 실제 고객 문서, PII, 원본 OCR, 키, .env, 비공개 정답은 **미사용**. 합성 결과/코드 존재/통합 E2E/법률승인/운영배포를 동일시하지 않는다.
- **다음 역할 IT담당자 → AX담당자 → 계산사무장; 다음 미완료 ID A1-IT-002 / A1-AX-002 / A1-CALC-002.** Extra High 실제 설정 여부는 알 수 없다.
