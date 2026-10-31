# FirmEngine A1 42차 — R2 실패 · 법률 모델 이벤트 재시도 · 동일 소득 Fact 중복 산입

- 역할 교대: **IT A1-IT-009 / AX A1-AX-012 / 계산사무장 A1-CALC-007** (직전 41차 서류·변호사·데이터에서 전환).
- 시작 main HEAD: `e27d5c0ed7265f73c2b35b2009b36f0df3294fe3`. 감사 영수증 반영 직전 main HEAD: `e27d5c0ed7265f73c2b35b2009b36f0df3294fe3`.
- 범위는 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 중앙 단일 보드의 기존 ID 기록/이전 41차 영수증/최근 main SHA·커밋 및 PR #24/#42/#107/최근 A2·A4 작업을 우선 확인.
- 테스트는 전부 합성 입력. 개인 식별정보·비공개 OCR·고객 문서·키·실제 법원 확인값을 공개 Git에 넣지 않음.
- **층위 분리:** 원본 함수 본문 V8 격리 실행, Draft 코드 V8 격리 실행, 정적 호출경로 확인, 작성만 한 Node 테스트, 실제 D1/R2·CI·배포는 구별한다.

## A1-IT-009 — 저장 순서/실패 복구 [ ] 유지

- main 소스 `lib/export-artifact-transaction.ts` blob `a114235e5b5de57b5ae58b41026f939ee8543174`; `tests/export-artifact-transaction.test.ts` blob `a684612f61234a9fb0ac30261684733ba749eefc`.
- 실제 `commitExportArtifactTransaction` 본문에서 TypeScript 선언·타입 표기만 제거해 V8으로 실행. 합성 R2=Map, D1 artifact rows=Map, manifest=배열. **독립 기대 6/6 관찰 일치**:
  1. 정상: return `saved`, R2 2/rows 2/manifest 2.
  2. R2 첫 PUT가 바이트 기록 후 거절: 오류, R2 0/rows 0/manifest 0.
  3. R2 둘째 PUT가 바이트 기록 후 거절: 오류, R2 0/rows 0/manifest 0.
  4. D1 rows 부분 저장 뒤 거절: 오류, R2 0/rows 0/manifest 0.
  5. manifest CAS 거절: 오류, R2 0/rows 0/manifest 0.
  6. **commit 후 감사 callback 거절:** 호출자는 `POST_COMMIT_ERROR` 수신, R2 2/rows 2/manifest 2 **보존**. 데이터 파괴는 없었으나 호출자에게 성공 ACK가 전달되지 않는 모호성이 있으므로 새 재시도 중복 위험은 종단 확인 필요.
- 본 함수는 **R2 업로드 → D1 산출물 저장 → manifest CAS** 순서여서, 질문의 'D1 성공 후 R2 실패'를 그대로 구성하는 경로는 아님. 모든 실제 호출 API의 D1→R2 순서·HTTP ACK/중복 영수증·R2 cleanup / 실제 Cloudflare D1·R2 장애는 미검증. 기존 manifest ACK 유실 P0 수정 [Draft #24](https://github.com/firmengine/firmengine/pull/24), 통합 [Draft #61](https://github.com/firmengine/firmengine/pull/61) 참고. 신규 코드는 변경하지 않음.

## A1-AX-012 — 법률 모델 이벤트 재시도 [ ] 유지

- main `lib/pipeline.ts` blob `79dce5f9822cf2debe1f886ab93ece4a256659e6`에서 `reviewLegal`은 `callLuna<Advisory>` 호출 성공 직후 `await event(caseId,"model.call",{agent:"legal_checklist",...usage})`를 실행하고, 이후 `analyses` 저장한다는 **실제 코드 순서 확인**.
- 모델 응답 후 이벤트 저장이 거절되면 durable legal_advisory INSERT 전에 예외 종료되는 기존 P1 호출 순서이다. 같은 입력의 재시도 비용 위험이 남는다. [Draft #42](https://github.com/firmengine/firmengine/pull/42)의 best-effort 모델 사용량 이벤트 변경은 **미병합**.
- **이번 회차에는 전체 reviewLegal / 외부 모델 호출·비용·lease·사건 간 오염의 실험을 수행하지 않음.** 8차 이전 영수증의 V8 2회 유료 호출 관찰을 이번 회차 실행으로 재표시하지 않음. #42 helper 재조회 시 파일 ref 확인에 실패했으므로 수정 브랜치 helper 런타임도 이번에는 검증하지 못함. 코드 조치 없음.

## A1-CALC-007 — 동일 current net Fact의 복수 소득행 산입 [ ] 유지

- main `lib/income-resolution.ts` blob `f370c4b14fd347089708c5c3241fa9c72522d4bf`, `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`를 확인. 관련 기존 소득·채무·재산 중복 판정 테스트도 검토.
- **신규 P1 후보 (중복 금전 Fact 사용):** current `income.net` Fact `F1` 1,000,000원을 서로 다른 2개 소득 typed 행(A/B)의 `factIds`에 재사용하고, 급여 지급자 라벨을 다르게 입력. 원본 실제 `resolveIncomeRows` 함수 본문 V8 격리 결과 A/B 둘 다 유지, duplicates 0, issues 0. 독립 기대는 두 행을 보존하되 중복 산입 불확실 경고 및 사건 전체 수입 확정 보류이다. 실제 사건 계산 오류·최종 서식 오작성 관찰은 아님.
- 신규 수정 [**Draft PR #111**](https://github.com/firmengine/firmengine/pull/111), HEAD `7654366f8f6c9b0049578ae94da46d39e6a1a3c3`:
  - `income-resolution.ts` 수정 blob `bd0bab366acd16c7a47212ff1dda133991f0a79b`: 정확히 중복된 typed 관측은 종전 병합 유지. **병합 후 남은** current net Fact(`income.net`/`income.monthly_net`)를 둘 이상의 수입행이 소비하는 경우만 `INCOME_SAME_NET_FACT_MULTIPLE_ROWS_REVIEW_REQUIRED` 경고.
  - `assessment.ts` 수정 blob `c2b3e86db024e6283437a1767f6785a58216b6f5`: 해당 충돌이면 사건 전체 `monthlyIncomeWon=null` 보류. 개별 원본 행·Fact·법률 인정값 재작성 없음.
  - 신규 `tests/income-shared-net-fact-reuse.test.ts` blob `445c7b47b5ac6c427ee5843e9921888ae0dfee21`: 합성 Node 테스트 6개 작성, **실제 Node 실행 안 함**.
- 실제 GitHub 저장된 수정 함수 본문 재조회 후 V8 합성 **6/6 독립 기대 일치**: 동일 net Fact 다른 소득원→경고/2행 유지, 동일 관측 중복→1행/중복1, 서로 다른 Fact→2행/경고0, 한 행 안 중복 ID→경고0, gross-only Fact 공유→경고0, `income.monthly_net` 공유→경고. V8에서는 `currentFacts`, `observationCore`, `sourceIdentity`, `sourceObservationSignature` 주변 의존성을 합성 스텁으로 대체. 계산 집계의 `null` 조건은 **정적 확인만** 했고 실제 통합 `calculateCase`나 D1·API·Word 종단은 실행하지 않음.
- 리뷰 필요: 합법적 결합 원천/여러 소득행에서 동일 net Fact의 사용 의미, 업무 판본, A2 병렬 `assessment.ts` 수정과 충돌 및 전체 회귀. PR은 계산 의미를 보수적으로 변경하므로 **Draft·미병합** 유지.

## 판정 / 인계

- 세 체크 ID 모두 **[ ] 미완료**, 실제 검증 범위에만 '합성 조건 통과' 기재. 이번 P1 후보 1건 수정 Draft PR #111, main 실행 코드 미변경.
- 다음 역할: 서류담당자 **A1-DOC-015** (문안 재생성·검수 불변 이력), 변호사 **A1-LAW-016** (신규 원문·계산·기준 변경 후 승인 무효화), 데이터담당자 **A1-DATA-017** (재분류·정정 하위 소비처 재투영).
- 85서류/18계산/95법률/갈음 A←B+C/C01-C02-C04/동시 사건 전체 경로·Node/CI/빌드·staging D1/R2/Cron·브라우저·공식 법원 서식·변호사 검수·사이트 배포 **미인증**. 제품 전체 인수 완료 0건. 운영 배포·운영 마이그레이션·법원 전자제출·법원 인가 확정 실행하지 않음.
- 추론 실행기의 실제 Extra High 모델/추론 강도 설정은 확인할 수 없으므로 해당 모드로 수행했다고 주장하지 않음.
