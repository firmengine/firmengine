# FirmEngine A1 65차 — 문서 재분류 잔여 법률상태 · 가구원 생계비 제안 · 월별 관측 충돌

- 날짜: **2026-11-02 KST**. 직전 64차(IT/AX/계산) → 이번 역할 **사용자·서류담당자 / 변호사 / 데이터담당자**.
- 대상 저장소 `firmengine/firmengine`, 단일 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 최초 main `cb5a3c282278ce126549ffd88ad265b7fadde7d5`; 중앙 보드 최초 blob `47189e819946e1ccc3cf8f23c81b05b07dd49de6`. 최근 A4/A3의 보드 커밋과 Draft PR #20/#95 존재를 확인. 기존 9·35·37·64차 영수증, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`와 코드/기존 테스트를 읽음.
- 범위: **A1-DOC-009 / A1-LAW-010 / A1-DATA-009**. 모두 여전히 **[ ] 미완료**. 사용자 기록·원본 PDF/OCR·운영 환경·키 없음. 수치/문구/날짜/식별자는 전부 합성. 실행은 GitHub에서 읽은 **원본 함수 코드의 국소 타입 제거 후 V8 평가**, 외부 의존성은 명시적 synthetic stub. 코드 존재/격리실행/Node/CI/staging/법원 승인/배포는 서로 다른 관찰 층.

## A1-DOC-009 — 페이지 역할 재분류와 기존 법률상태
- main `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`, `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`.
- 실제 `reduceCaseCommand`의 **`document.role` 분기 본문**을 추출하여 실행. 합성 문서 1쪽 + Fact 1개(accepted) + 채무 1개(`legalReview=accepted`, `factIds=[fact-1]`) + accepted documentMatch. `resetReviews`는 **호출 횟수만 기록하는 stub**, 따라서 전사 상태검증이나 전체 명령 실행이라고 주장하지 않음.
- 독립 기대/관찰: `evidence→administrative`와 `evidence→unknown`은 Fact 새 버전 retracted·documentMatch stale **실제 통과**, 그러나 채무의 기존 `legalReview=accepted`는 그대로 잔존(**기대와 불일치**). 역할 불변 `evidence→evidence`, `unknown→evidence`는 불필요한 retraction 없음(**기대 일치**). **4조건 중 2/4 독립 기대 일치**.
- 이것은 이미 9차에 기록된 **기존 P0 범위**이며 [Draft PR #20](https://github.com/firmengine/firmengine/pull/20) open/draft/미병합. 신규 결함으로 중복 집계하지 않음. 실제 D1 쓰기·정규화 재투영·18계산·95법률·Word 문서까지의 종단 테스트 미실행.

## A1-LAW-010 — 가구원 및 추가생계비 법률 승인 경계
- main `lib/living-cost-proposal.ts` blob `e74e7362ad25c234da87fa726aae755507902720`, `lib/reference-parameters.json` blob `e57a9d7c99efe052d4581d780ed478d876eb3330`의 2026·서울 1인 2,564,238원/2인 4,199,292원, 분수 3/5, court `seoul`을 확인.
- 실제 `proposeLivingCost` + `decimalRatio` 함수 본문 V8 실행. 2026 서울 1인가구→**1,538,542.8원 제안**, 2인가구→**2,519,575.2원 제안**, 별도 추가생계비 `"0"` 명시 0 보존, `"-1"` 미지원→null, 가구수 null·1.5·미지원 연도·타 관할 blocked: **8/8 합성 기대 일치**.
- 반환 `needsRecognizedHousehold=true`, `needsAdditionalExpenseRecognition=true`, `legalEffect=draft_proposal_only`. 관리 기준의 중위소득 표 `verification=unverified`, 다른 링크 `inherited`; **법원/법률상 실질 인정 아님**. 가구원·부양/추가비용 출처-직원-변호사 승인/서식 종단 및 공식 법원 판본은 미확인.

## A1-DATA-009 — 기간·기준일·발급일 및 서로 다른 월 관측의 오상충
- main `lib/observed-source-details.ts` blob `b77563cd9d1c283de153bc705f3387d3093ef6bd`; `lib/domain.ts`의 Fact `periodStart/periodEnd/asOf` 및 EvidenceDocument `uploadedAt` 검토. 발급일을 `uploadedAt`이나 `asOf`로 자동 대입하지 않음. 발급일 별도 typed 경계는 확인되지 않음.
- 실제 `observedSourceDetails` 원본문 + 합성 `currentFacts/validSourceRef` 등을 주입하여 **8조건 중 5/8 기대 일치**. 기한+기준일 동시 존재 및 부분기간+기준일에서 `asOf` 출력 누락 **2건은 기존 P2** [Draft PR #95](https://github.com/firmengine/firmengine/pull/95) open/draft/미병합. **이번 신규 P2 후보**: 같은 주체·같은 scalar key라도 2026-01-01~31의 100원과 2026-02-01~28의 200원을 모두 `상충 · 선택 보류`라고 표시. 서로 비중첩인 완결 기간은 별도 월별 관측이며 동일기간 상충이 아니어야 함.
- 이번 신규 보수적 수정 [Draft PR #156](https://github.com/firmengine/firmengine/pull/156), branch `audit/a1-r65-observed-period-conflicts-20261102`, HEAD `249d1c88290ec9e6eb67aee7228c1650a12f3cb5`. main 기능 변경 없음. 새 순수 helper `lib/observed-period-collision.ts` blob `efed4dc508d743d923d2511a47321544e0603f4c`; consumer `lib/observed-source-details.ts` blob `66d18f225971a4faf74d0ff0b076cc907acc066d`; Node 회귀 테스트 `tests/observed-period-conflict-r65.test.ts` blob `775dbc1246592c99bdd178865d19da3910363717`.
- **실제 검증:** helper TS 구조를 타입 표기만 제거한 V8 함수 10/10 독립 기대 일치; GitHub PR 브랜치 재조회 후 helper+실제 consumer 원본문 결합 V8 **9/9 기대 일치**(비중첩 정상, 동일기간/기간겹침 상충, null·부분기간 보수적 보류, 같은 값/다른 주체/별도 문단 정상, asOf 단독 표시). **6개 Node test() 블록은 작성·커밋했지만 Node는 실행하지 않음.** 새 PR은 date-aware conflict UI 표시만 수정하며 `periodStart/End`+ `asOf` 동시 표시는 #95의 별도 수정이 필요. 두 PR 모두 같은 consumer 파일을 수정하므로 병합 전 재기반/충돌 검증 필요.
- 누락/미관찰·명시 0·비해당·상충·source-only·승인전 상태를 혼동하지 않음. 새 helper는 유효한 완결 비중첩 날짜 **만** 독립 관측으로 분리하고 누락/부분/무효 날짜와 중복기간 값 차이는 계속 상충으로 보수 처리. 공식 원문/발급일/사실/법률 인정을 자동 확정하지 않음.

## 결론 및 인계
- 신규 **P2 UI 경계 후보 1건**, 신규 **Draft PR #156**, 기존 P0 DOC 재확인 및 기존 P2 날짜표시 재현. 본 회차 **DOC main 2/4, LAW main 8/8, DATA main 5/8**, PR helper 10/10 + consumer 9/9 모두 **V8 국소 합성/독립 기대**. 검사 번호 자체의 전체 인수 **0건**.
- 프로젝트 Node/전체 TypeScript/lint/build/CI, staging D1·R2/Cron, 실제 OCR/85서류·갈음 A←B+C·18계산/95법률·C01/C02/C04·보정명령·동시 사건, 브라우저/공식 법원 서식/직원·변호사 승인/사이트 운영 배포는 **미실행·미검증**. 운영 D1 마이그레이션·실제 전자제출·인가 확정 미수행.
- 신규 PR은 임시 방어안으로 미병합. main에는 A1 영수증과 보드 해당 3행만 반영; 다른 에이전트 파일과 타 경로 미변경.
- **다음 역할 IT / AX / 계산사무장**, 후보 미완료 ID **A1-IT-008**(Export R2→D1 ACK 실패), **A1-AX-003**(OCR·분류·검증 span 결속), **A1-CALC-001**(급여 12개월·상여/공제). 실행기의 추론 모드가 Extra High라고 확인되지 않았으므로 그런 표시를 하지 않음.
