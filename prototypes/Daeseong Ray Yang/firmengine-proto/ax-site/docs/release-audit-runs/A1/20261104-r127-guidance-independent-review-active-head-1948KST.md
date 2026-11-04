# A1 127차 — 서류발급 안내·독립결재·대량행 active-head 경합

- 일시: 2026-11-04 KST, 실행 당시 main HEAD `548d17d35fc7bab649b9ac200a2b51aab28466ad` (원본문 테스트 고정 SHA `548d17d35fc7bab649b9ac200a2b51aab28466ad`).
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. **사용자·서류담당자 → 변호사 → 데이터담당자**. 체크 `A1-DOC-013 / A1-LAW-015 / A1-DATA-013`, 모두 **[ ] 미완료**.
- 선행: 중앙보드 `e8a35ba226275275128c8ca9c8fb3849851fcb87`, 126차 영수증 `9953b1eb751f9e902e168f1101c8f76957ea6074`, 109차 영수증 `80be7738c5d4861f9ea21c7e2daf2d6430c2c38f`, 스키마 `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `lib/case-workflow-state.ts` `e43ffe37a4f832d6f486633a6c7ae9054bb4e8d1`, `lib/intake-types.ts` `24788d5edc77d7af97e105992d381d44064cf8e2` 읽음. 최근 A3 영수증/보드 커밋이 main에 추가되어 A1 실행 코드는 이전 회차와 동일한 blob인 것을 직접 확인.
- 방법: 실제 GitHub TypeScript 함수 **본문**의 타입 문법만 분리/제거해 JavaScript V8에서 실행. 외부 DB/인증/해시/규칙/SQL 응답은 명시적 합성 mock. **Node/TS 프로젝트 빌드, 전체 CI, 실제 D1/R2, 브라우저, 법원서식, 변호사 승인 테스트가 아님**. 수행하지 않은 영역은 pass 처리 안 함.

## A1-DOC-013 [ ] — 발급처/서류명·기간·대상자 지침

- `lib/case-requirements.ts` blob `7f0735dbf3d95796b5494d57959cc7182de18571`, 원본 `makeCaseRequirement` 본문 격리. `intake-types.ts`의 `IntakeRequirement`에는 `issuer`, `documentName`, `subjectId/subjectLabel`, `period` 필드가 존재. 합성 원천: D01 급여명세서, 발급처 '재직 사업장', 본인 link1, 2026-01~2026-12, D02 대안, net_won 미승인 매핑.
- **독립 기대:** 발급처·서류명·기간·대상·대안 안내가 구조화된 사건 요구서류에 보존되고 필수항목은 사람 확인 전 미승인.
- 실제 유효 조건 **5/8**: 기간/subjectLinkId/대체명/sourceEvidenceFields/mappingRequired 5 일치. issuer 보존, documentName 보존, 발급처 typed 값 존재 3 불일치: 반환 객체에 해당 필드 없음(`undefined`). 두 발급처 조건은 동일 원인에 대한 다른 관찰이며 별도 제품 결함 2건으로 세지 않음.
- `components/case-workflow.tsx` 현재 UI는 요구서류 카드에 `requiredPeriod`를 출력하지만 source issuer/name 출력경로는 확인되지 않음(정적 확인만). 전체 85종, 실제 직원 자료요청 전송, 대상자별 안내, 실무 검수 미실행. 기존 [Draft PR #65](https://github.com/firmengine/firmengine/pull/65), open/draft, HEAD `68f5969dbdbfa00ef49ab28532761bcd77218584`; 후보 이번 실행 안 함.

## A1-LAW-015 [ ] — 직원 제안/결재자 분리

- `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`의 `decision.adopt` 실제 분기, `case-workflow-state.ts`의 `decisions.actor/status` 구조를 확인. 합성 이전판본 fingerprint 'fp', `planMonths:36`, `caseworker_review` 권한, `isSynthetic=false` 및 `commandHash`/resetReviews 등 명시적 stub.
- **독립 기대:** 실제 다른 actor만 제안 채택 허용; 동일 ID, 공백·대소문자 variant, 제안자 null/빈값/미기록은 거부. 사람 신원·권한의 실제 인증을 대체한 계약 수준 기대.
- 유효 10조건에서 **3/10**: 독립 actor 3건 정상 채택, 동일 actor·앞뒤 공백 양방향·대소문자·제안자 빈/null/undefined **7건** 모두 `decision.status=adopted`로 변함(독립 기대는 거부). 이전 첫 실험에 `impact` stub 미정의가 있어 전 건 실패했으므로 **그 실험은 폐기/분모 제외**; `impact={}`를 보완한 최종 10조건만 채점.
- 기존 [Draft PR #103](https://github.com/firmengine/firmengine/pull/103), open/draft, HEAD `3c550b3b771d3ee31a2e061f11d0efad7c203f6c`; 이 PR은 제안-채택 명령 경계이며 [Draft #28](https://github.com/firmengine/firmengine/pull/28)의 최종 문서 이중서명과 다름. 후보 이번 실행 안 함. 실제 법률 인가/직원 신분 확인/사건 DB 기록 미검증.

## A1-DATA-013 [ ] — 2,000 OCR행·5,000 계산행·active head 경합

- OCR `lib/extraction-row-store.ts` blob `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`의 실제 `listCaseExtractionRows` 본문+합성 D1 adapter: **44/45**. 40페이지×50행=2,000개 모두 유일, 각 행 1개 합성 필드, limit 51 거부, 요구 revision 불일치 및 읽기 중 revision 변경 거부 정상. **반례 1건:** 조회 중 `case_extraction_heads`가 `runA→runB`로 교체되되 case revision 4 유지 ⇒ `runA` 반환; 기대는 head 불일치 거부. 모델 실행/원문 PDF는 없음.
- 계산 `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`의 실제 `listCaseCalculationFeatures` 본문+합성 D1 adapter: **14/15**. 10페이지×500행=5,000개 모두 유일, limit 501 거부, 요구 dataVersion 불일치/읽기 중 version 변경 거부 정상. **반례 1건:** 동일 case revision 3·dataVersion 7에서 active head `runA→runB`, 반환 `runA`, `headStale=false`(기대 거부 또는 새 head 반영). 교체는 mock SQL 조회 순서에 주입, 실제 D1 동시성 보장 아님.
- 기존 OCR [Draft #52](https://github.com/firmengine/firmengine/pull/52) open/draft HEAD `d6a455aa46b807318c16894138d5c46ebe77d772`, 계산 [Draft #49](https://github.com/firmengine/firmengine/pull/49) open/draft HEAD `d828f20e22f3c6fb9a443b3e13f12063a9b0caca`; 이번 수정후보 재실행 없음.

## 127차 조치·분리된 인수 상태

- 유효 합성 **66/78** 조건 독립 기대 일치: DOC 5/8, LAW 3/10, DATA OCR 44/45 + CALC rows 14/15. **12개 불일치 조건**은 복수 조건이 동일 원인을 중복 측정하므로 독립 결함 12건으로 해석 금지.
- 신규 제품 코드 수정 없음: 결함과 동일 경로의 기존 open Draft PR 4개가 있어 병렬 중복/덮어쓰기를 피하고 리그레션 범위·정책 결정을 남김. 현재 main에 PR을 병합하지 않음.
- 코드 존재/합성 테스트/CI/staging D1·R2·Cron/공식 서식·변호사 승인/사이트 배포는 **상호 대체 불가**. 실제 고객·OCR 원문·키·.env·비공개 정답은 기록하지 않음. 미관찰/null/0/비해당/상충/source-only/승인전 상태는 변경/승격하지 않음. 운영 배포·실 D1 마이그레이션·전자제출·법원 인가 확정은 미실행.
- 다음 순환 **IT담당자 → AX담당자 → 계산사무장**, 보드 우선 ID **A1-IT-013 / A1-AX-013 / A1-CALC-013**(최신 main 재검증 후 선택).
