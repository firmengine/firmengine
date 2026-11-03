# FirmEngine A1 — 98차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-03 KST)

- **범위:** `firmengine/firmengine` main 중 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 97차 이후 순환 역할 **IT담당자 → AX담당자 → 계산사무장**. 대상 **A1-IT-007 / A1-AX-007 / A1-CALC-007**, 중앙 보드 상태는 모두 `[ ]` 유지.
- **감사 기준 HEAD:** `80c18991bcc9babc3753a094986d011c31ac5790` (영수증 저장 직전 조회 HEAD `80c18991bcc9babc3753a094986d011c31ac5790`). 보드 blob `a944d56de5bda595e0ecdf536ad5fc307f32dd16` (시작). 최근 main: A3 r98 보드 `80c18991`, A3 r98 영수증 `2e472c59`, A2 r98 보드 `5b78888e`; 공개 Draft #83 (교차소비), #111 (소득 중복), #218 (이번 대안), #216 (서류 기간). 선행 97차 영수증과 보드 34·64·74·78차 증빙, `db/schema.ts`, 제품 경로 및 기존 테스트 확인.
- **검증 방식:** GitHub의 실제 TypeScript **함수 본문을 읽은 뒤 타입 부분만 제거해 격리 V8 JS 실행**, 외부 함수/HTTP/DB/이벤트는 명시적 합성 stub. 입력은 모두 가상; 실 고객 자료/OCR 값/비공개 해시·키 없음. **독립 기대값과 실제 결과를 분리**, 제품 전체 합격과 혼동 금지.

## A1-IT-007 [ ] — 다중페이지·중복등록·손상/암호 PDF 경계
- 소스 `app/api/cases/[id]/documents/route.ts` main blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`; `app/api/cases/[id]/documents/[doc]/route.ts` `db20b9248e68d3ec412b5d3f4254254e0ffc8412`; `components/workspace.tsx` `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- **POST 실제 함수 7/7 합성 기대 일치**: (1) 유효 SHA·3쪽 → 201, 문서1·감사이벤트1, 1·3쪽 evidence와 2쪽 administrative 분리; (2) 기존 SHA·같은 pageCount → 200 idempotent·중복 이벤트0; (3) 같은 SHA·다른 pageCount →409; (4) 잘못된 SHA →400; (5) 601쪽 →400; (6) 유효 형식 SHA·pageCount이나 **파일 원문은 일절 전달하지 않은 POST** →201 문서 메타만 등록; (7) 기존 파일과 다른 SHA → 별도 문서201. 독립 기대는 메타 등록 동작이며 PDF 유효성 판정은 해당 POST 범위 밖.
- UI는 `pdfjs.getDocument(...)`로 PDF 페이지수 파싱 후 메타 POST→원본 PUT→페이지 업로드. PUT는 MIME allowlist/bytes SHA/크기를 확인하나 서버 PDF header/trailer·암호/손상 구조 파싱은 확인되지 않음. **실제 암호/손상 PDF·단일 PDF 다중 문서종류 분류·85종 문서·브라우저/R2/D1 검증은 수행 안 함**. POST 201 ≠ 정상 PDF, R2 저장 또는 OCR 완료.

## A1-AX-007 [ ] — 결정론 계산영수증의 모델·소스 바인딩
- 소스 `lib/case-agent.ts` blob `8b6f6f615c05551f8783e4efbee60dbf81bd3993`, `lib/calculation-adapter.ts` `556ef86b887d1d729af2c56d071211c74b4d5e46`, `lib/calculator-tools.ts` `13025c1feb8f16d1c52b41ca8de35ac4b2e3c7c0`; 기존 `tests/calculator-tools.test.ts` blob `4dbfc74926144524ea3ff60ae2af66e402a588c6`.
- **`runCaseCalculatorNode` 실제 함수 V8 6/8 독립 기대 일치**. 합성 도구 응답: 정확 사건ID/revision/input SHA → 허용, 영수증 `modelPerformedArithmetic=false`; 타 사건ID/오래된 revision/타 SHA/도구 `ok=false`/도구 throw 5조건 → 거절. **반례 2건**: 반환 `ruleReleaseId=stale` 또는 `courtApprovalInferred=true`인데 사건ID/revision/input SHA가 같으면 함수가 수용. 독립 기대는 신뢰 경계 fail-close. 실제 같은 프로세스의 `callCalculatorTool`은 현재 코드상 `CURRENT_RULESET.id`, `courtApprovalInferred:false`를 반환하므로 **실제 모델 조작·인가 승인 사고 재현이 아니라 반환계약 방어 부족 후보(P2)**. 새 AX 코드 수정 없음; 전제품 tool/최종서식 숫자변조 및 실 API E2E 미검증. 후속 별도 계약 테스트 필요.

## A1-CALC-007 [ ] — 동일 원천 Fact의 교차범주 수치 중복
- main `lib/material-calculation-source-gate.ts` blob `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, 기존 `tests/material-calculation-source-gate.test.ts` blob `eb37d53f09ad13fa0d13839325db8fd635c76bb7`; 관련 `income-resolution.ts` `f370c4b14fd347089708c5c3241fa9c72522d4bf`, `debt-resolution.ts` `1e5cf8aa0e903896205010e415d71f76ec39ba2a`, `asset-resolution.ts` `ffda6d7684a8d34f228a568d090602bfcdd89cbf`.
- **main 실제 source-gate 함수 V8 6/10 독립 기대 일치**: 단일 bank balance fact→asset 1행은 문제 없음, 자산 2행 공유는 `CALC_INPUT_MULTIPLE_TYPED_MATCHES`, 미연결은 `UNCONNECTED`, 미관찰은 `AMOUNT_INVALID`, 명시적 0 단일 자산은 허용, 금전없는 다른 채무참조는 허용. 그러나 **asset gross + debt principal / income net / 다른 금액의 채무원금 / 명시 0 자산 + 0 이자**의 4개 교차범주 소비에서는 `issues=[]` 관찰(독립 기대: 충돌 검토보류).
- **새 Draft [PR #218](https://github.com/firmengine/firmengine/pull/218), 미병합**: branch `audit/a1-r98-crosscategory-monetary-fact-20261103`, HEAD `08ae34aa55c20ea86c8d28be2f8f272e22e7a41b`, code blob `3c00d03f32bc2d14b118102eac3127f13824b048`, 신규 테스트 blob `378d39ee42cab8bfcc8a296c5800ec5f37ad842e`. 커밋 후 실제 수정 함수 재조회/V8 **10/10** 독립 기대 일치, Node 회귀 4블록 **작성만·실행 안 함**. 변경 파일은 범위 내 소스1/테스트1.
- **기존 [Draft PR #83](https://github.com/firmengine/firmengine/pull/83)을 보드 A1-DATA-008에서 뒤늦게 확인**: 이미 동일 Fact·**동일 금액** 교차 소비 8/8 후보를 고쳤으며 main 미병합. 이번 #218은 **금액이 달라도 다른 범주의 실제 금전 소비**면 보류, #83은 서로 다른 금액을 단순 문서교차참조로 간주한다는 **정책 차이**가 있음. **둘 중 하나를 실무자가 선택/수동 통합해야 하며 동시 자동 병합 금지**. PR #218 본문에 중복·차이·충돌을 명시. 계산사무장·데이터·변호사·AX 검토 필수. 법률 인정이나 회계상 이중계상을 실제 DB에서 입증한 것은 아님. 전체 18계산·서식·D1·CI 미실행.

## 범위·상태·다음 순환
- 이번 A1 실제 격리 V8 **IT 7/7, AX 6/8, CALC main 6/10 (서로 다른 목적·분모), 수정안 CALC 10/10 별도**. 전체 인수 완료 0. 결함은 코드 경로/가상 입력/실제 반환과 연결하되 법적 인정 변경 금지.
- **코드 조치:** main 제품코드 변경 없음; 별도 Draft #218에 소스1/테스트1 commit. main에는 이 영수증 및 해당 ID 보드에만 이력 반영. 새 PR은 #83과 중첩, 무조건 병합 금지.
- **다음 역할:** 사용자·서류담당자 `A1-DOC-008` (OCR 숫자·문구↔원문 PDF 좌표 UI), 변호사 `A1-LAW-009` (소득금액증명/실소득 상충 법률 경계), 데이터담당자 `A1-DATA-008` (교차 Fact 및 #83/#218 비교).
- 전체 Node/TypeScript/lint/빌드/CI, staging D1/R2/Cron, 브라우저, 실제 OCR·85서류/복수행/갈음 A←B+C/C01-C02-C04/보정명령, 18계산/95법률 종단, 공식 법원 서식·직원/변호사 승인/사이트 배포는 **미검증**. `0/null/미관찰/비해당/상충/source-only/승인전`은 별도, 사람 승인 없는 법적 확정 승격 없음. 운영 배포·D1 운영 마이그레이션·전자제출·인가 확정 **미수행**. Extra High 모드 설정 증빙 없음.
