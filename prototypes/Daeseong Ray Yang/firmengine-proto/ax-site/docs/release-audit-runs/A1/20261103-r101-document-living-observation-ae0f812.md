# FirmEngine A1 — 101차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-03 KST)

- 범위: `firmengine/firmengine`, **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만**. 100차(IT/AX/계산) 다음 순환 **사용자·서류담당자 → 변호사 → 데이터담당자**.
- **본 회차 ID:** `A1-DOC-009`, `A1-LAW-010`, `A1-DATA-009`; 세 ID 모두 **[ ] 미인수**.
- 감사 시작 시 확인한 `main` SHA **ae0f812fb764136bb2bfd9517cc9a479f0cc5f64**, 중앙 보드 blob **e2fd2a4fef9e0297836ab1ba0655aae62bcca455**. 최근 A2/A3/A4 보드 커밋과 관련 Draft PR #20/#95/#156, 65·100차 영수증, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 구현·기존 `tests/pipeline-audit.test.ts` 및 Draft #156 테스트를 읽음.
- **실제 실행 단위:** GitHub의 현행 함수/분기 **본문을 읽어 V8 `new Function`으로 격리 실행**. TypeScript 타입 표기만 제거하고 외부 `currentFacts`, PDF metadata, reference getter 등 의존성은 합성 stub으로 대체했다. 독립 기대값을 먼저 정의하여 비교. 전체 Node, TS build, API·D1/R2, PDF OCR, 법원 실무검증, 브라우저·사이트 배포 실험으로 **간주하지 않음**. 모든 데이터 합성, 실제 의뢰인/원본 OCR/키 없음.

## A1-DOC-009 [ ] — 문서 페이지 재분류의 하위 typed 법률상태 무효화

- `lib/case-commands.ts` **main blob `d18c555f04f65687c509a8e8d35aba4bb3597378`**의 실제 `document.role` 분기를 사용했다. `resetReviews`는 호출 횟수만 기록하는 stub이며 전사 초기화를 검증한 것이 아니다.
- 합성 사건: 활성 문서 D 1쪽, 검증·인정 Fact F 한 개(그 페이지 참조), typed 채무 X (`legalReview=accepted, factIds=[F]`), 수용 문서매칭 하나.
- **`evidence→administrative`, `evidence→unknown`, `evidence→filed_form`:** 독립 기대는 Fact 새 버전 철회 + 문서매칭 stale + typed 법률인정 `unreviewed`이다. 실제 **Fact retracted=true, match stale=true, typed `legalReview=accepted` 잔존**. 3/3 불일치.
- **`evidence→evidence`, `unknown→evidence`:** 불필요한 Fact 철회·match stale·typed 인정 강등이 없어야 한다. 실제 2/2 일치.
- 합계 **main 2/5 독립 기대 일치**. 기존 P0 경계로 `document-evidence-cascade.ts` 변경을 제시한 [Draft #20](https://github.com/firmengine/firmengine/pull/20)이 이미 존재하므로 중복 수정·신규 결함 집계 금지. #20 분기를 이번에 실제 실행한 것은 아님. 업무의 하위 계산 무효화·법률·서식/DB 저장 종단은 미인증.

## A1-LAW-010 [ ] — 가구원 수·추가생계비는 법원 재량·승인 전 제안

- `lib/living-cost-proposal.ts` **blob `e74e7362ad25c234da87fa726aae755507902720`**, `lib/reference-parameters.json` **blob `e57a9d7c99efe052d4581d780ed478d876eb3330`** 관리 기준을 읽고 실제 `proposeLivingCost` + `decimalRatio` 본문을 격리 실행했다.
- 2026년 서울 1인 → **1,538,542.8원**, 2인 → **2,519,575.2원** 기초 생계비 **계산 제안**. 명시적 추가비용 `"0"`은 0 보존, `"-1"`은 null; 가구원 null·1.5, 타 관할, 미지원 2034년은 blocked.
- **8/8 독립 기대 일치**, 전 proposal 응답 `needsRecognizedHousehold=true`, `needsAdditionalExpenseRecognition=true`, `legalEffect=draft_proposal_only`. `reference-parameters`의 일부 reference `verification=unverified/inherited`; 공식 판본·법원 인정·변호사 승인 미확인. 값을 법률 확정액으로 승격하지 않음.

## A1-DATA-009 [ ] — 기간·기준일 병기, 월별 관측 오상충

- `lib/observed-source-details.ts` **main blob `b77563cd9d1c283de153bc705f3387d3093ef6bd`**; [Draft #156](https://github.com/firmengine/firmengine/pull/156) consumer blob **`66d18f225971a4faf74d0ff0b076cc907acc066d`**, helper **`efed4dc508d743d923d2511a47321544e0603f4c`** (PR commit `249d1c88290ec9e6eb67aee7228c1650a12f3cb5`) 실제 본문을 V8 평가.
- 합성 10조건: 단독 값, 1월 100원 + 2월 200원(비중첩), 중첩 기간 다른 값, 같은 기간 같은 값, 다른 주체, 1월 관측기간+2월 기준일 `asOf` 동시 존재, 불완전 기간, 기준일 단독, 잘못된 역전기간, 독립 문단.
- **main 8/10**: 비중첩 월별 서로 다른 금액이 `상충 · 선택 보류`로 **오표시**되고, 기간과 `asOf` 동시 존재 시 기준일 **누락**. **Draft #156 9/10**: 월별 오상충은 해결, 기간+`asOf` 동시 표시는 그대로 누락. 이는 기존 [Draft #95](https://github.com/firmengine/firmengine/pull/95)에서 별도 보완하려는 범위이며 #95/#156은 같은 consumer 파일 변경 → 충돌 해소·통합 회귀가 필요.
- 첫 내부 V8 구성은 `value(data,fact)`의 stub 인수를 잘못 연결하여 **무효로 폐기**. 이후 실제 2인자 호출과 일치하도록 수정한 **최종 실행 10조건만 위 점수에 산입**. 이 회차에 기존 Node 테스트를 **읽기만 했고 실행하지 않았다**. 원문 발급일의 별도 typed 필드 및 발생일/발급일/신청일과 실제 파일 기록 교차 확인도 미인증.

## 코드 조치·미완·다음

- **제품 코드 조치 없음.** DOC 기존 Draft #20, DATA 기존 Draft #95/#156을 중복 재작성하지 않음. PR 자동병합·main 제품 수정 없이 본 영수증과 중앙 보드 **해당 3개 ID**만 보존 병합.
- 범례 분리: 미관찰(null), 명시적 0, 비해당, 상충, source-only, 승인 전은 서로 다른 상태. `draft_proposal_only`는 법원/변호사 승인 아님.
- 다음 순환 **IT → AX → 계산사무장**: **A1-IT-009**(R2 실패 뒤 D1 상태/성공 응답), **A1-AX-009**(OCR 다중 행 오병합), **A1-CALC-009**(상충 가구원 수가 생계비에 반영될 때 계산 보류).
- 상담→85서류→OCR→정규화→18계산→95법률→초안/직원검수→법원보정, 갈음 A←B+C/C01-C02-C04·동시 사건/실제 D1·R2·Cron, Node 전체/CI, PDF·브라우저/공식 서식·법률 승인은 **미관찰/미인수**. **제품 전체 종단 인수 0건**. 운영 배포, 운영 D1 마이그레이션, 전자제출, 법원 인가 확정 실행 없음. 실제 Extra High 추론 모드 설정 확인 안 됨.
