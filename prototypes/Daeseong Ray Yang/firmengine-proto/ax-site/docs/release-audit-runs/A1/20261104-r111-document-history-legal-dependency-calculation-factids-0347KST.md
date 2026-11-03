# FirmEngine A1 — 111차 코드 완결성·상호 기능충돌 독립 감사

- 시점: 2026-11-04 KST. 감사 시작/쓰기 직전 확인 `main` **a1a890d5e19bd96c5326f0cdeacfa1ddc318e8f8** (GitHub 2026-11-03 18:37:28 UTC).
- 범위: **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만**. 선행 [110차 영수증](20261104-r110-export-draft-gate-business-review-8e4661f.md)·중앙 보드 최신 상태, 최근 A3/A2 커밋 및 관련 Draft PR #12/#78/#177 확인.
- 순환 역할: **사용자·서류담당자 → 변호사 → 데이터담당자**. ID **A1-DOC-015 / A1-LAW-016 / A1-DATA-014**, 모두 **[ ] 미완료 유지**.
- 실제 읽기: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob **2451d7444bd64b50331cd52cc16e8f9d7edf6a49**; `lib/case-mutation-classifier.ts` **2d151e8d0f6accbf980cda5a62626a0278d704bf**; `lib/legal-review-identity.ts` **be300beef76f2ca130293763a28932d9046dcf59**; `lib/case-calculation-feature-store.ts` **bb5f88b26e68f5ae2234741063ac9301a927e27a**.
- 추가 계약: `lib/reference-decision-tables.json` **6924e3977caf748ce8a3d617fae15aff7d2fe2ce**, `lib/execution-catalog.ts` **6909ecc7c0e33792e3932b64d9ade0ba6028d736**, `db/schema.ts` **933f8686845ac14669312dd21bf85e02c62ed5e6**, `drizzle/0011_case_calculation_features.sql` **0caa359d250dce45765d269d271ad63170ec3efa**. 호출자 `lib/server-store.ts` **32350bd5045da89ea327f3c77fab6d2d19fbac56**, `lib/case-workflow-server.ts` **7e1a96e79afcdc0ff81e950fe52556b2794ab465**, `app/api/cases/[id]/export/route.ts` **4f9384e840517455cdec25f0fa734b593d31e533** 정적 연결 확인.
- 기존 테스트 원문 열람: `tests/workflow-only-source-watch.test.ts` **3d7d3ac8b4939dc5ba46a0073ec2878b3c31e9fe**, `tests/legal-review-identity.test.ts` **c2156ec147eaa8f1096716322be9f39470aa95af**, `tests/case-calculation-feature-store.test.ts` **844525d8633442d571ced2c48ed5bd00ba7bb5a0**.
- **실행 방법/한계:** GitHub의 해당 TypeScript 실제 함수 본문을 읽어 타입 표기·non-null assertion만 제한적으로 제거하고 JS V8 `Function`으로 격리 실행. `projected`는 원본 함수 본문을 이용했고, `structuredClone`은 JSON 합성 객체용 동형 복제로 대체. 독립 기대를 조건별 미리 선언; 외부 DB/권한/서비스는 호출하지 않음. **제품 Node 테스트/CI/운영 환경의 영수증이 아니다.** 격리 harness 초기 문법 변환 및 `structuredClone` 환경 오류는 수정 후 전건 재실행했으며 실패 수치에서 제외.

## A1-DOC-015 — 문서 편집·법률 검토 append-only 이력

원본 `assertNonSourceCaseChange`+`projected` 함수 직접 실행. 합성 `C-SYN` revision 3, 기존 문서편집 `E-OLD`, 과거 법률처분 `L-OLD`, 사업소득 제안 `P-OLD` 보유. 문서 수정은 직원 문안 **이력 불변성만 검증**하며 Word 생성·실사용자 승인 아님.

| 조건(합성 변경) | 독립 기대 | 현재 main 관찰 | [Draft #12](https://github.com/firmengine/firmengine/pull/12) 관찰 |
|---|---|---|---|
| document.edit 새 1행 추가 | 허용 | 허용 | 허용 |
| 과거 E-OLD text 변조 후 신규 1행 | 거부 | **허용** | `NON_SOURCE_DOCUMENT_EDIT_NOT_APPEND_ONLY` |
| 과거 E-OLD 삭제 후 신규 1행 | 거부 | **허용** | 상동 거부 |
| 새 편집 2행 한 번에 추가 | 거부 | **허용** | 상동 거부 |
| legalCheck.dispose 새 1행 추가 | 허용 | 허용 | 허용 |
| 과거 L-OLD accepted→rejected 변조+1행 | 거부 | **허용** | `NON_SOURCE_LEGAL_DISPOSITION_NOT_APPEND_ONLY` |
| 과거 L-OLD 삭제+1행 | 거부 | **허용** | 상동 거부 |
| 새 법률처분 2행 추가 | 거부 | **허용** | 상동 거부 |
| 사업소득 제안 1행 append | 허용 | 허용 | 허용 |
| 과거 사업소득 제안 변조+추가 | 거부 | `NON_SOURCE_BUSINESS_PROPOSAL_NOT_APPEND_ONLY` | 동일 거부 |
| review-only 경로에 소득원 임의 추가 | 거부 | `NON_SOURCE_MUTATION_CHANGED_EVIDENCE` | 동일 거부 |
| 문서 review-only manifest 검수 상태 변경 | 허용 | 허용 | 허용 |
| artifact-only manifest 새 산출물 | 허용 | 허용 | 허용 |
| artifact-only 소득원 수정 | 거부 | `NON_SOURCE_MUTATION_CHANGED_EVIDENCE` | 동일 거부 |

**main 8/14, Draft #12 14/14 독립 기대 일치**. #12 소스 blob **54ad07fe24ec380ac87f44aedf2d08768a1267ab**, 미병합 draft. `server-store.saveCase`가 이 guard를 저장 직전에 호출하는 것은 정적 확인. 실제 D1 CAS, Word 생성·문안 편집·재생성/검수 화면·브라우저/권한 인수 **미실행**. 과거 이력 위변조 방어는 구현본 미완료.

## A1-LAW-016 — 원천/계산/기준정보 판본 변경 후 법률 승인 유효성

원본 `currentLegalDispositionOutcome` 실제 본문 실행. 합성 `C01`/주체 `S`/과거 `run-old` 의존 `DEP-A`, 인간 accepted. `DEP-B`는 다른 증빙·계산·reference 판본을 **가리키는 합성 지문**으로만 사용; 실제 SHA 계산·변호사 법률 승인 아님.

| 조건 | 독립 기대 | main | [Draft #78](https://github.com/firmengine/firmengine/pull/78) |
|---|---|---|---|
| 정확히 일치하는 run-old/DEP-A | accepted | accepted | accepted |
| DEP-B 새 run만 있음 | needs_review | needs_review | needs_review |
| DEP-A 과거 PASS + DEP-B 새 PASS 공존 | needs_review | **accepted** | needs_review |
| 상기 두 run 입력 역순 | needs_review | **accepted** | needs_review |
| DEP-A PASS + DEP-B FAIL | needs_review | needs_review | needs_review |
| 타 주체의 DEP-B만 추가 | accepted | accepted | accepted |
| 타 법률항목 C02의 DEP-B만 추가 | accepted | accepted | accepted |
| runId 변경(같은 지문) | needs_review | needs_review | needs_review |
| 같은 지문의 중복 PASS | accepted | accepted | accepted |
| 과거 사람 rejected, 신지문 run | rejected | rejected | rejected |
| 사람 needs_review 원상태 | needs_review | needs_review | needs_review |
| run 배열 공백 | needs_review | needs_review | needs_review |
| 기준정보 판본에 대응하는 의존지문 변경 | needs_review | needs_review | needs_review |
| 주체 지문 변경 | needs_review | needs_review | needs_review |

**main 12/14, Draft #78 14/14 기대 일치**. #78 소스 blob **178452aa6bbf2a5f90914b230ba8910b5bd3157d**, 미병합 draft. `case-workflow-server` 및 export가 함수를 소비하되 현재 run의 의미해시/헤드 필터링이 별도로 존재함을 정적 확인했으므로 **실제 최종승인 우회/95항목·전자제출은 입증되지 않았다**. 신·구 계산/Fact/기준정보 판본을 동시에 공급하는 통합 경로와 변호사 정책 검토 필요.

## A1-DATA-014 — 선언된 18계산/91입력과 저장 Fact-ID 계보

실제 `lib/reference-decision-tables.json` 전체 `calculations` 파싱(원본 JSON에 합성 자료 없음): **18 모듈, 총 입력 선언 91, 고유 입력 경로 78, 총 출력 선언 42(고유명 40), 결과 경로 42(고유42), ID 중복 0**. `execution-catalog.ts`가 같은 선언을 `getCalculationSpecs`로 전달하는 구조 확인. 이는 **DB에서 실제 18개가 계산되거나 42출력이 저장·재조회됐다는 의미가 아니다**.

`case-calculation-feature-store.ts`의 원본 `factIds` 함수 본문을 V8에서 실행. 대상은 가상 계산 trace `{factIds:...}` 또는 중첩 입력으로, 원문이 아닌 임의 ID만 사용.

| 합성 조건 | 독립 기대 | main 관찰 | [Draft #177](https://github.com/firmengine/firmengine/pull/177) 관찰 |
|---|---|---|---|
| null / {} / factIds:[] | 빈 목록 ×3 | 모두 [] | 모두 [] |
| ID 1개 / 중복 ID / 2개의 필드 종류 / 중첩 / sourceFactIds / 2개 정상 ID | 정상 집계 ×6 | 모두 기대일치 | 모두 기대일치 |
| factIds:[`""`] | 거부 | **빈 ID 보존** | `CALCULATION_FEATURE_INVALID_FACT_ID` |
| factIds:[`"   "`] | 거부 | **공백 ID 보존** | 동일 거부 |
| factIds:[`" F1 "`] | 거부 | **공백 포함 ID 보존** | 동일 거부 |
| factIds:[null] | 거부 | **무음 누락** | 동일 거부 |
| factIds:[42] | 거부 | **무음 누락** | 동일 거부 |
| factIds:[`"F1"`,null] | 거부 | **정상 F1만 남김** | 동일 거부 |
| factIds:[{}] | 거부 | **무음 누락** | 동일 거부 |
| factIds:[`"\\n"`] (실제 newline 값) | 거부 | **개행 ID 보존** | 동일 거부 |

**main 9/17, Draft #177 17/17 기대 일치**. #177 소스 blob **293c02d990d741e35033d7718c7f8efa56d6382b**, 미병합 draft. `calculationFeatureRows`가 이 helper의 결과를 `sourceFactIds`로 소비하고, `persistCaseCalculationFeatures`가 `case_calculation_features.source_fact_ids_json`에 기록하는 경로는 정적 확인. `db/schema.ts`와 `0011` DDL은 타입 `TEXT NOT NULL` 수준이므로 내부 JSON 요소 검증까지 강제하지 않음. **18계산·91입력 전수 실제 producer/typed/DB 소비, D1 저장, 42출력, 공식 서식 E2E 미실행**.

## 종합·조치·다음 ID

- 실제 **V8 격리 합성 45조건: main 29/45, 각 미병합 Draft 후보 각각 45/45(14+14+17) 기대 일치**. 특정 함수들의 독립 기대 비교이며 전체 제품 정확도·CI 통과·법률 적법성을 뜻하지 않음.
- 결함 재확인 **16조건**: DOC 6(과거 편집·처분 위변조), LAW 2(같은 PASS의 이질 의존지문), DATA 8(잘못된 Fact ID). 세 결함은 이미 각 기존 Draft PR에서 코드 수정 제안이 있어 **main 코드 중복패치/자동병합을 하지 않음**. Draft 후보도 실제 원본 함수만 부분 V8 확인; 기존 PR 테스트의 Node 실행·통합 검증/법률·데이터 승인 **미실행**.
- 사건 단계: 원천 **미관찰/null/명시적 0/비해당/상충/source-only/승인전**은 법률상 확정으로 올리지 않음. 이 영수증에는 실제 고객 문서·원문 OCR값·개인정보·키/.env·비공개 정답이 없다.
- 전체 Node/TS/lint/build/CI, 실제 브라우저·HTTP, staging D1/R2/Cron, 85서류·복수행·갈음 A←B+C·C01/C02/C04·보정명령·동시사건 및 상담→계산18→법률95→직원문안검수→법원보정 종단 **미실행**. 운영 배포/운영 D1 마이그레이션/전자제출/법원 인가 확정 없음. Extra High 설정 확인 불가.
- **다음 역할:** IT담당자 → AX담당자 → 계산사무장. 보드 **A1-IT-015 / A1-AX-015 / A1-CALC-015** 우선; 최신 SHA/최근 커밋·관련 PR 재조회 후 2~5개 검증. 특히 #12·#78·#177 통합 승인 전 노출 경계 재확인.
