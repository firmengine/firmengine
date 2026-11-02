# FirmEngine A2 r81 — IT담당자: 검토된 변제원장의 Fact ID 형태·저장 계보 감사

- 회차: 2026-11-02 21:16 KST. 역할 순환: r80 AX담당자 → **r81 IT담당자** → r82 사용자·서류담당자.
- 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 실제 고객 파일, 개인정보, 원본 OCR 정답, 비밀정보, 키, .env 없음. 아래 입력은 전부 SYN 합성.
- 감사 시작 main SHA: `91c5e9a92d9d908b323700f6f37c23afeb7d72ed`. 보드 최초 blob: `c2ff40e6f7bc45f587e38fe2148a17e03cd3c27b`. PR #186은 Draft, 미병합, HEAD `3b38e1e2576628f126f1e5a92b75dc84f8a418e5`. 그 아래에만 새로운 Draft #188을 쌓았다.
- main 원장 `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`; 부모 #186 원장 blob `9ee87047a029108f665c72ae6c0241942d7b28b1`; main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; migration 0011 blob `0caa359d250dce45765d269d271ad63170ec3efa`; 저장계층 `case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`. package `8129160e33af3ae250c757a6a8195a29674ad031`; 이전 r80 영수증을 읽었다.

## 1. 실행 입력·독립 기술 기대·관찰
- 실제 #186 `buildRepaymentPlanModel` 함수 본문과 실제 main `normalizeMoney`/`moneyValue` 본문을 읽고 **TypeScript 타입 표기/ES import 부분만 제거하여 V8 격리 실행**했다. 자료 구조·금액·본문 분기·반환값은 동일, 외부 의존성의 full-app 환경은 아니다. Node 프로젝트 모듈 로더·전체 CI는 실행하지 않았다.
- 합성 입력: 사건 revision=8 / calculation caseRevision=8, ordinary 채권 `SYN-DEBT-A`, 원금 `normalizeMoney("100")`=100원, 이자 명시적 `normalizeMoney("0")`=0원, 검토된 payment schedule, 2026-12-31 월초기일, 기간 **36/48/60개월** 각각 매월 원금 1원·이자 0원, 수수료 0원. 독립 총배분은 36/48/60원, 원금 잔액 64/52/40원. `ledger.status="complete"`는 오직 해당 함수 기술 상태이며 법률 인가나 문서 승인 아님.
- 각 기간 10종 Fact 입력: `["SYN-FACT-A"]` 정상; `factIds=null`, 속성 누락, `[42]`, `[null]`, `[""]`, `[" SYN-FACT-A"]`, `["SYN-FACT-A","SYN-FACT-A"]` 7종 비정규; 빈 `[]` 및 외부 `["SYN-FOREIGN"]`은 형식은 정상이나 **소유관계 미인증**.
- 독립 기술 기대: 7종 비정규는 `blocked` 및 빈 rows, 정상 한 건은 기술 `complete`. 빈 목록/외부 문자열도 현 기술 분기에서는 `complete`로 남지만 **법률상 PASS/팩트 실재성 인증 불가**이며 별도 차단정책 판단 전 미완료.
- **부모 #186 실제 관찰:** 전체 30개 중 21개가 기대와 불일치. `null`/누락 배열의 36/48/60 **6건 TypeError throw**; 숫자/null원소/빈문자/선행공백/중복 5×3=**15건 기술 `complete` 오판**. 정상/빈배열/외부문자열 9건은 관찰만 기록(후자 6건은 진정성 미인증).
- **수정 후보 실제 V8 관찰:** 30/30 기술 기대와 일치. 7종 비정규×3기간=21건이 `REVIEWED_SOURCE_FACT_IDS_INVALID` + `rows=[]`로 fail-closed. 기존 정상 3건과 빈/외부 6건 동작 유지. 이는 TypeScript 전체 빌드·Node 프로젝트 테스트 통과가 아니다.

## 2. 수정과 PR·미실행
- 별도 **[Draft PR #188](https://github.com/firmengine/firmengine/pull/188)**. 부모 Draft #186의 HEAD로 브랜치 `audit/a2-r81-it-reviewed-factids-20261102-2116` 생성. 제품 patch commit `430b38f5c4f43dfbd70a75025f87c49245aaffae`; 신규 합성 테스트 commit `2ca106d84f1b6a2f710c11f92462bb86ed1a3531`. 소스 새 blob `8194631ec6fae948e5db12825219afbab47f50b2`.
- 변경 정확히 2파일, 모두 허용 prefix: `lib/repayment-plan-model.ts` (6 추가줄) 및 `tests/a2-r81-it-reviewed-factids.test.mjs` (합성 84줄). 검토원장에 Fact ID 배열 타입, 원소 비어있음/앞뒤 공백, 목록 내부 중복을 체크하여 실패 시 초기에 blocked 반환. 원금·이자·지급합/변제기간·채권 법적 분류/세금 기준 변경 없음.
- 새 Node 실행형 테스트 소스 작성: 36/48/60×(정상·7종 비정규·음수/미관찰 원금/채권 ID 중복/구판본 회귀·빈/외부 목록 미인증 동작) + TODO 3건. **프로젝트 Node test runner/TS 빌드·전체 CI는 미실행**, 코드를 저장했다는 사실을 통과로 표시하지 않음. PR 미병합, main 제품 코드는 미변경. PR의 즉시 mergeable 상태는 승인/충돌해결의 증명이 아님.

## 3. SQL/typed·출력·서식 독립 대조
- 실제 `drizzle/0011_case_calculation_features.sql`에 있는 3테이블·2인덱스와 동일한 DDL을 Python `sqlite3 3.46.1` 인메모리에 **수동 재기입**, FK용 합성 cases parent 추가 후 SQL INSERT/SELECT 8행을 실행. `value_json`, `value_won`, `status`, `source_fact_ids_json` 각 행 **8/8 바이트 문자열/NULL 재조회 일치**, `PRAGMA foreign_key_check=0`. 명시적 `"0"/"0"/computed` vs `null/NULL/missing`은 구별됨. 동시에 이종 JSON/원화(`"36"/"37"`), `[42]`·동일 ID 중복·외부 ID·잘못된 JSON도 SQL **저장 허용**; Fact ID 자체 FK 및 값-상태 의미제약을 DDL에서 보증하지 못함. 이것은 실 D1 schema journal 조회/Cloudflare D1·앱 API 왕복이 아니다.
- main `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 직접 JSON 파싱 **18모듈, 91 입력선언(고유78), 42 출력선언(고유40), 42 resultPaths(고유42)**. **전 모듈 실행 아님**.
- main `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: 직접 JSON 파싱 D5103/D5110/D5111 등록 토큰 **37/55/82**. 공개 매핑 이전 기록 35/53/80은 이번 회차 실제 Word bytes 재독으로 검증하지 않음. 공식 template-reviewer pending/실제 서식 법적 적합성 승인 아님.
- 독립 산술 보조 예시: 월 급여 2,400,000원×12 = 28,800,000원; 사업 순소득 관측월 1,000,000원×11 = 11,000,000원; 관측합계 39,800,000원. 미래·미관찰 12번째 사업월은 **null**, 0원·승인소득으로 대체하지 않는다. VAT/종소세 신고 수입·납부세액은 자동 합산하지 않는다.

## 4. 공식 근거·법원/시행일 구별 — 자동 적용 없음
- 서울회생법원 2026-10-01 공지 HTML: [제424호 제2조 제2항 제7호 신설](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187). **2026-10-01은 공지 게시일**. 첨부 개정 PDF의 부칙·경과규정/사건별 법적 적용일은 이번 회차에 읽지 않았으므로 미인증.
- 국가법령정보센터: 법률 제21490호 **[시행 2026-10-02]** [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR) 변제계획 내용·기간 및 [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR) 인가요건. 조문 시행일 확인 ≠ 사건별 관할·적용판본 법률 승인.
- 국세청 [VAT 과세기간 공식 안내](https://s.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401): 일반과세자 반기, 간이과세자 통상 1년(유형전환·예정신고 예외). 신고금액을 법원 인정 월순소득에 자동 승격 금지.

## 5. 중앙 보드 체크 ID / 다음 항목
| ID | 실제 관찰 및 잔여 | 상태 |
|---|---|---|
| `A2-IT-012` | Reviewed 원장 3기간·비정규 Fact 배열·중복 30건 V8/순서·실제 해시 재현성은 미검증 | **부분 [ ]** |
| `A2-IT-015` | SQL 동형 스키마 8/8 저장·재독, 정상/미관찰 0/null 분리; 앱 D1→typed→재계산 실측 미실행 | **부분 [ ]** |
| `A2-IT-019` | Fact ID 타입/중복/공백 방어 #188; 실제 생산자-동일사건/판본 hash/원천/저장/서식 해시 미검증 | **부분 [ ]** |
| `A2-IT-020` | TS 구조 가정 무시한 런타임 `factIds` 타입 변조 시 throw/허위 complete 21건, 수정 V8 30/30; Node/CI 미실행 | **부분 [ ]** |

**r82 사용자·서류담당자 다음**: #188(부모 #186→... #168) 실제 Node 테스트와 기존 회귀, 공란/외부 Fact를 실제 사건·생산자·revision·Fact state와 연결 검증, `case_calculation_features.source_fact_ids_json` 및 원장 `sourceIds`를 producer별 대조. `approval-readiness`/D5110·D5111 Word 재독까지 source-only, 승인전/미관찰/0/비해당 구분을 종단 확인. 제424호 사건별 적용·세금채권 및 초과지급은 변호사·계산사무장 검토 전 자동 인정 금지.

**최종 제품 인수 완료 0건.** full Node/CI, staging D1/R2/Cron, 실제 DOCX 생성·재독, 법원 공식서식 동등성, 변호사·계산사무장 승인, 사이트 배포 모두 미인증. 운영 배포·운영 D1 migration·실제 전자제출·법원 인가 확정 **미실행**.
