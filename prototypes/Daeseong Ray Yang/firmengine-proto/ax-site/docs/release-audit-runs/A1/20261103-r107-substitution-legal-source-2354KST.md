# FirmEngine A1 107차 — 갈음 철회 / 95 위험 근거계약 / 출처 전처리 독립 감사

- 일시: 2026-11-03 23:54 KST 회차. GitHub `firmengine/firmengine`의 `main`만 감사. 변경 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 한정.
- 최신 HEAD 확인 후 영수증 작성: `d3df43797268751e149af3ca026a85ba5401f36e`. 해당 시점 단일보드 blob `5f880eeedb97c729c651f217c3f440c9ada6c2c6` (보드 재갱신 전 재확인 필요).
- 최근 커밋: `d3df437` A3 중앙보드, `1b913d2` A3 영수증, `4042a1a` A2 중앙보드. 다른 에이전트 변경은 보존한다.
- 순환 역할: **사용자·서류담당자 → 변호사 → 데이터담당자**. 선택 체크 **A1-DOC-012, A1-LAW-013, A1-DATA-012**, 모두 **[ ] 유지**.
- 기실행 기록: 71차 영수증 `20261102-round71-substitution-legal-packet-1053KST.md`, 직전 A1 106차 `20261103-r106-legacy-approval-budget-2256KST.md` 읽음. 기존 `tests/document-substitution.test.ts` blob `0bb1478bac062f3daa844f10374440af6cbdceb2`, `tests/legal-review-packet.test.ts` blob `0bcdb16455019195bbf6be460a16aefd12de4c8d`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` 실제 읽음.
- 기존 Draft [#57](https://github.com/firmengine/firmengine/pull/57), [#46](https://github.com/firmengine/firmengine/pull/46), [#75](https://github.com/firmengine/firmengine/pull/75)는 모두 **open/draft, 미병합**으로 조회. 동일 파일에 중복 수정하지 않음.

## 검증 방법과 경계

GitHub `main`에서 받은 **실제 TypeScript 함수본문**에서 타입 선언만 필요한 부분 제거하고 함수 자체를 V8에서 실행. 정책 승인/fingerprint, 법률 coverage/model 응답, 식별된 source ref 유효성은 합성 의존성 또는 사전 정의 기대값이며 실제 법원 정책, 변호사 승인, D1/R2, OCR, LLM, 전체 Node/CI 실행은 **아님**. 출력은 엄격히 해당 합성 조건에만 적용한다.

## A1-DOC-012 — A←B+C 철회·역할변경 뒤 원요청 복원

- 실제 `lib/document-substitution.ts` blob **`9fea9344b923c961fe333761df99ddde431ce1bc`**의 `reconcileDocumentSubstitution` 실행.
- 합성 입력: 원요구 A, 대체 B/C, 증빙 필드 f1/f2, 기간 2026-01-01~2026-03-31, 승인 match+서류 SHA 일치, 별도 직원 검토 기록. 정책 `matchPublishedSubstitutionRoute` 및 `substitutionFactFingerprint`는 합성 stub.
- **10조건 중 7조건 기대 일치**: B+C 정상일 때 `inactive_by_substitution`, B 철회·C 철회·C만 행정 전환·C match stale·Fact 지문 변경·정책변경은 `restored`.
- **반례 3/3 실제 재현**: B 하나가 필수 증빙 필드 둘을 제공하고, C의 accepted match는 남아 있으나 C 페이지 역할을 `administrative`/`filed_form`/`unknown`으로 변경하면 독립 기대는 `activeRequest=true`이나 main은 모두 `inactive_by_substitution / activeRequest=false / reasonCodes=[]`. 기존 #57과 동일 영역 결함; 이번 #57 후보 실행은 **하지 않음**.
- 결론: 사람 승인·갈음 정책 존재와 체크리스트 비활성은 다른 의미. 본문 함수 실패 확인, 직원 UI/DB와 공식 85문서 E2E는 **미검증**.

## A1-LAW-013 — 증거계약 3필드가 위험 batch에서 유실

- main `lib/pipeline.ts` blob **`79dce5f9822cf2debe1f886ab93ece4a256659e6`**의 실제 `const batch=catalog.filter(...).slice(...).map(...)` 표현식과 `lib/legal-review-packet.ts` blob **`38b46feff4bb196c89d3a48ff97346846c9a9da9`**의 실제 `gateLegalReviewChecks` 함수 실행.
- 가상의 **승인된 증빙계약** `canonicalFieldGroups=[['income.net']]`, `requiredCalculationOutputs=['netIncome']`, `evidenceContractStatus='approved_evidence_route'`; 합성 인정 Fact와 AI `pass` 응답. coverage는 **전부 충족 stub**으로 고정해 배치 정보 전달만 비교.
- **8조건 중 2조건 독립 기대 일치**. 원래 검토가능해야 할 완비 근거(기대 pass), null/unknown 계산(기대 missing), 명시적 0(기대 해당 게이트 pass), canonical 인용 누락(기대 missing), 부적격 source ID(기대 missing) 등 6조건이 main에서는 `legal_review`로 뭉개짐. 계약 미승인·manual 위험 2조건만 기대와 일치.
- `canonicalFieldGroups`, `requiredCalculationOutputs`, `evidenceContractStatus`가 **3/3 누락**됨을 batch object 직접 확인. 계약에 따르는 원인분류 정확도 문제이며 **현재 실제 95 risk 자동 PASS나 법률상 위법 확정의 증거는 아님**. 기존 #46은 별도 Draft; 실제 95 항목, Node, 변호사 인수 미검증.

## A1-DATA-012 — source-less Fact의 법률 AI 요청 후보 오계수

- main `lib/legal-review-packet.ts` 동일 blob **`38b46feff4bb196c89d3a48ff97346846c9a9da9`**의 실제 `selectedFacts` 및 관련 key/priority 함수 V8 격리 실행. 가상 `income.net` 직접 피처 및 canonical OR 그룹.
- **10조건 중 4조건 기대 일치.** 출처 없는 문자열, 명시적 0, null, 빈 structuredRefs, 논쟁(disputed) Fact, 존재하지 않는 문서 ID에 연결한 stale ref는 모두 **선별 제외 기대**였으나 main은 전부 AI 요청 후보에 포함, featureCount에서도 `provided=1`로 집계(6반례).
- 유효 모양의 문서 ref, 문서 ref의 0원, 별도 asset 축, synthetic 구조화 ref는 선택 기대와 일치(4조건). 단 실제 문서 ref 정합성·structured ref validity는 이 함수 안에서 검증하지 않으므로 `refs` 존재만으로 확정 증거 아님.
- **상호 기능충돌**: `pipeline.reviewLegal`은 `buildLegalReviewPacket`으로 패킷 생성→외부 모델 호출→그 **후에** `validSourceRef`/lineage/eligibleFactIds를 통한 출력 게이트를 실행. 출력 게이트가 미확정 근거를 제거할 수 있어도 외부 모델 입력 자체는 source-less/stale 가상 사실에 오염될 여지가 있다. **실제 외부 모델 호출이나 오류 추론은 이번에 관찰하지 않음**. 기존 #75는 source-less anchor 1차 보완만 하며 stale ref까지 완전 검증하지는 않음.

## 조치·인수판정·다음

- 소스 코드 및 회귀 테스트 신규 수정 **0건**: 3개 결함 영역에 기존 open Draft #57/#46/#75가 있어 다른 에이전트 변경을 덮어쓰지 않음. 병합 전 #75의 **모델 요청 직전** 원천 유효성 검증·coverage 재산정, #46의 **승인계약 전달 + gate** 결합 및 #57의 **갈음 지원 증빙 페이지 역할** 회귀를 함께 테스트해야 한다.
- 이번 실제 소스 기반 V8 격리 합성 결과: DOC **7/10**, LAW **2/8**, DATA **4/10**, 총 **13/28 조건 기대일치**. 이 비율은 제품 점수가 아니다. 중앙 보드 각 ID는 **[ ] 미완료**.
- 누락/미관찰, null, 명시 0, 해당없음, 상충, source-only, 승인전 상태를 자동으로 승격하지 않음. 고객 문서/개인정보/원본 OCR 실제값/비공개 정답/키/.env 공개 Git 미작성.
- 이번에 Node/TypeScript/전체 CI/사이트/브라우저/staging D1·R2·Cron/85종 문서·18계산·95법률 종단/공식 서식·변호사 승인 **실행하지 않음**. 배포·운영 DB 마이그레이션·전자제출·인가 확정 **실행하지 않음**. Extra High 추론 모드 실제 설정 여부 미확인.
- 다음 교대 **IT담당자 → AX담당자 → 계산사무장**: 보드 **A1-IT-013**(대량 페이지네이션 active head), **A1-AX-013**(증빙누락 ↔ 사람 역질문), **A1-CALC-013**(변제 원장·채권별 배분·현재가치/청산가치) 우선.
