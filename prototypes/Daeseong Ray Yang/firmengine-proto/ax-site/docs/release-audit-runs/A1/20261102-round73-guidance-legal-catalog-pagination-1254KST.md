# FirmEngine A1 73차 — 수집안내 보존 / 50규칙·46예외 상태 / 대량 조회 판본 경쟁

- 감사 시각: 2026-11-02 KST 12:54; `main` 감사 시작 및 쓰기 직전 관찰 HEAD `78c66eda593db29bb28b47d399d16e93735083fa`.
- 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 중앙 인수 보드의 **A1-DOC-013 / A1-LAW-014 / A1-DATA-013**을 연속 검토. 역할 순환 **사용자·서류담당자 → 변호사 → 데이터담당자**. 세 ID 모두 **[ ] 미완료**.
- 기존 72차 영수증, 중앙 보드, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 현재 원본 코드·테스트, 기존 Draft PR #65/#49/#52를 읽었다.
- 실제 시험 수준: GitHub 원본 TypeScript의 각 **함수 본문**을 JS에서 실행하도록 타입 선언/타입 단언만 축소하고, 외부 의존성은 **합성 객체 또는 D1 모의 어댑터**로 주입한 V8 격리 실행. 실제 Node 프로젝트 테스트·브라우저·D1 SQL·R2/Cron·95법률 E2E가 아니다.

## A1-DOC-013 — 서류 발급처·서류명·기간·대상 안내

- `lib/case-requirements.ts` **main blob `7f0735dbf3d95796b5494d57959cc7182de18571`**, `components/case-workflow.tsx` blob `2ec797958726b99a4358ec46ef35f78f90bfd927` 확인.
- 독립 가상 입력: `documentTypeId=test_doc`, `documentName=합성 요청서`, `issuer=합성 발급기관`, `period=2026-01 ~ 2026-03`, 서로 다른 `subjectLinkId=person-A/person-B`, 승인 전 `mappingRequired=true`. `requirementOriginKey`는 합성 동등키 생성으로 대체.
- 독립 기대/관찰 6개: 서류명 보존 **기대 값/실제 null (불일치)**; 발급기관 보존 **기대 값/실제 null (불일치)**; 요청기간 보존 **일치**; 두 대상 링크 분리 **일치**; 자동 면제·비해당 승인 없음 **일치**; 매핑 검토 대기 **일치**. **main 4/6**.
- 기존 [Draft PR #65](https://github.com/firmengine/firmengine/pull/65) 실제 `lib/case-requirements.ts` 후보 blob `d8cd3240b6690df45af0e5ac4d00202ffd57e7d7`의 같은 본문 재실행은 **6/6 기대 일치**. PR 테스트 파일 blob `854fe3e31e7752865a2258e2c81247851110f63e` 확인했으나 **Node 실행 안 함**. 실제 85종 전수·화면 렌더·직원 요청 발송·발급일 유효성·법원 인정 확인은 미완료. 기존 P2와 중복 패치 없음.

## A1-LAW-014 — 50 법률규칙·46 예외 후보와 상충 처리

- `lib/preapproval-legal-coverage-audit.ts` main blob `3e4dcf275a22b1bbe6b52cff09dae748f3c62175`; `lib/legal-catalog.json` blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`; `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`; 기존 테스트 `tests/preapproval-legal-coverage-audit.test.ts` blob `6cf4c7acca98dd3db7d57a1f8b6c73360533f2a2`.
- 독립 가상 사건: 신청일 2026-10-30, 관할 `seoul`, 빈 Fact/수락집합; 이후 `applicant.address` `f1`을 미수락/수락/철회 상태로 변경.
- 실제 함수 본문 V8 총 **7조건 중 6 기대 일치**. 50/46 카탈로그 전체 유지(50/46), 자동 승인 **0**, 사후 범위 **KR-PR-050/EL-40/EL-46**, 미등록 법률규칙 참조 **0**, 미수락 Fact `source_unverified_or_unaccepted`, 인정된 원천도 `source_supported_needs_legal_application` 및 법률 자동 승인 없음. 누락 근거 질문 **227**.
- **알려진 격리 반례 1건**: 외부 호출자가 `state=retracted, recognition=rejected`인 `f1`을 잘못된 `sourceValidatedAcceptedFactIds={f1}`에 넣으면 helper가 `source_supported_needs_legal_application`으로 취급한다. 기대는 `source_unverified_or_unaccepted`. **현재 상위 API에서 currentFacts·승인 상태·원천 검증으로 집합을 만드는 경로**가 있어 E2E 결과로 확대하지 않음. 기존 31/49차의 명시된 helper 경계와 동일. 전문가 판단이 필요한 법적 적용·관할·판본·예외 상충은 승인 전; 임의 코드 패치 없음.

## A1-DATA-013 — 5,000 계산 피처 대량 조회와 head 경합

- `lib/case-calculation-feature-store.ts` main blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/extraction-row-store.ts` main blob `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`, SQL 스키마 `db/schema.ts` 확인.
- 실제 `listCaseCalculationFeatures` 본문+합성 D1 어댑터 **8조건 중 7 기대 일치**: 5000행 첫 50개/마지막 50개/경계 이후 0개, 잘못된 limit 0/501 거부, dataVersion 불일치 거부, 100페이지 × 50개 = **5000개/고유 5000개** 모두 기대 일치.
- 반례: 동일 사건 `caseRevision=1, dataVersion=3`에서 조회 시 활성 run A를 읽은 후 SQL feature 조회 중 head가 B로 바뀌었지만, 실제 함수는 **run A 10행을 반환**, `headStale=false`로 표기. 독립 기대는 stale 거절 또는 최신 B 반환. **기존 P1**로 [Draft PR #49](https://github.com/firmengine/firmengine/pull/49) 경합 수정 중. [Draft PR #52](https://github.com/firmengine/firmengine/pull/52)는 OCR head 교체 별도 경로. 이 회차에서 PR 두 후보를 다시 실행하지는 않았음.
- OCR 2000행은 33/45차 과거 격리 영수증만 확인, **이번 회차 재실행하지 않음**. 실제 D1 스냅샷·HTTP/브라우저 5000행·여러 사용자의 동시 조회는 미인증. 기존 수정 PR과 중복 패치하지 않음.

## 결론 및 후속

- **main DOC 4/6 / LAW 6/7 / DATA 7/8 기대일치**(각각 독립 격리 환경); 기존 PR #65 DOC 6/6 재검증. 신규 확정 결함·신규 제품 코드 패치 **0건**. 기존 이슈와 PR은 **미병합** 상태이므로 세 ID 미완료.
- 다음 역할 순환: **IT → AX → 계산사무장**, 보드 **A1-IT-012 / A1-AX-007 / A1-CALC-005**의 실제 설명과 선행 이력을 다시 읽은 뒤 선정·검증.
- 미관찰 / null / 명시적 0 / 비해당 / 상충 / source-only / 승인 전을 분리. 공개 Git에는 가상 입력·코드 사실·해시만 기록. 고객 사실·PII·.env·키·비공개 정답·원본 OCR 저장하지 않음.
- **전체 CI·Node 테스트·staging D1/R2/Cron·실제 85서류/18계산/95법률 E2E·C01/C02/C04·보정명령/실무자·법원 공식 서식 승인·사이트 배포 전부 미검증**. 운영 배포·운영 마이그레이션·실제 제출·법원 인가 확정 미실행.
