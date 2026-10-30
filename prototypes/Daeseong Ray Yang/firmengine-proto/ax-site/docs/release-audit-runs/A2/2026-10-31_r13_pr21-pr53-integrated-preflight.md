# FirmEngine A2 13차 — #21 + #53 금액·월별증빙 검증 충돌 없는 통합 초안

작성: 2026-10-31 KST. **합성 사건만 사용**. 모든 Git 변경은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래로 한정. 법원·세무 법적 인정은 미인증. 역할 순환: **변호사 → IT → 서류담당자 → 계산사무장 → 데이터담당자** (다음 AX 관점).

## 0. 읽은 원본·판본·병렬 충돌
- 읽기 시작 main HEAD: `451c02c031932e516f001a7304d5553ba3c85bc8` (2026-10-30 16:04 UTC), 최근 8 커밋과 A2 12차 영수증·중앙 보드 확인.
- 현재 main `lib/document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`. Draft PR #21의 동일 파일 blob `0af1d6701faaa7f215d3eab1539df1943d63f703`, Draft #53 blob `fb60cc2b737d4244867933f8b41211aa78d377af`. 둘 다 미병합이므로 main의 P1 문제는 여전함.
- 실제 `lib/form-contracts.ts`/토큰 JSON/법률 필드정책/법률 산술 코드 본문과 기존 테스트 #53·#21을 읽음. `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`에서 실제 정적 산술 선언 18모듈, 입력 선언 91, 출력 선언 42, 결과경로 선언 42. `template-token-catalog.json` D5103 **37**, D5110 **55**, D5111 **82** 등록 토큰. 개수=실제 SQL/Word 검증은 아님.

## 1. 구분된 합성 입력·독립 기대·실제 관찰
- 원문/Fact/typed/SQL을 새로 운영 저장하지 않음. **이번 직접 입력 경계는 실제 `FormBindings.scalars/rows`와 템플릿 계약**. 값은 순수 가상.
- D5103 `approved_monthly_income="2,400,000"`, `month=[]`, `month[{entity:"Synthetic",period:"2026-10",net_income:"2,400,000"}]`.
- D5110 가상 `approved_monthly_income="3000000"`, `recognized_living_cost="2000000"`, `monthly_disposable_income="1000000"`, `monthly_payment="1000000"`, `repayment_months="36"`, `total_repayment="36000000"`, `liquidation_value="10000000"`, `present_value="12000000"`; 채권자 행 `principal="100000"`, `monthly_payment="100"`, `total_payment="3600"`. 산술 독립 기대: 3,000,000−2,000,000=1,000,000원; 1,000,000×36=36,000,000원. 법률상 인정소득을 확정한 것이 아님.

| 실제 V8 실행 시나리오 | 독립 기대 | main 관찰 | PR #21 | PR #53 | **통합 초안** |
|---|---|---|---|---|---|
| D5103 final 월소득 240만/월별행 0 | blocker | **ready(결함)** | blocked | ready | **blocked / D5103_MONTH_ROWS_MISSING** |
| D5103 draft 동일 | 누락 경고 (최종 확정 아님) | 해당 코드 없음 | 경고 | 해당 코드 없음 | **D5103_MONTH_ROWS_MISSING warning** |
| D5103 2026-10 적법형식 한 행 | 누락 0행 오류 없음 | ready | ready | ready | **ready** |
| D5110 정상 양의 정수원 | 정수 표시 오류 없음 | ready | ready | ready | **ready** |
| D5110 `monthly_payment="BAD"` | blocker | **ready(결함)** | ready | blocked | **blocked / PLAN_SCALAR_NUMERIC_INVALID** |
| D5110 `monthly_payment="1,00,0000"` | blocker | **ready(결함)** | ready | blocked | **blocked / PLAN_SCALAR_NUMERIC_INVALID** |
| D5110 채권자 원금 `"BAD"` | blocker | **ready(결함)** | ready | blocked | **blocked / PLAN_CREDITOR_ROW_NUMERIC_INVALID** |
| D5110 채권자 원금 명시적 `"0"` | 0 유지, 표시 오류 아님 | ready | ready | ready | **ready** |

실행 방법: GitHub에서 가져온 **실제 main/#21/#53 함수 본문**을 TS 타입 선언만 제거한 V8로 실행, 제3의 통합 본문은 #53 파일에 #21의 월별행 0건 검사를 결합. 실제 토큰 카탈로그·법률 필드정책에서 18개 FormContract 구조 재구성(각각 D5103 37/D5110 55/D5111 82), 실제 `reviewLegalPlanArithmetic` 함수 본문 실행. 계산용 contract SHA digest는 더미라 계약 해시 검증은 하지 않음. 위 **8/8 기대 관찰**은 격리 함수 확인일 뿐 정식 TS import/Node 프로젝트 테스트·전체 CI·D1/R2·DOCX/전자소송 동일성은 아님. 동일 0과 null, 미관찰, NA, 상충, source-only 전수 검증도 아님.

## 2. 실제 수정·커밋 경계
- 신규 **[Draft PR #58](https://github.com/firmengine/firmengine/pull/58)**: `audit/a2-r13-d5103-d5110-integrated-preflight-20261031` 브랜치를 위 main HEAD에서 생성.
- `lib/document-preflight.ts`: #53의 표시 숫자/채권자 행 검증을 보존하면서 #21의 `D5103_MONTH_ROWS_MISSING` 최종차단/초안경고를 같이 포함. 코드 커밋 `03684a42f4b33d57b624761922d1e2cf137141f2`; 새 코드 blob `f115533c761b0feb64bc7219f3d5807d4b924b60`.
- `tests/a2-preflight-integrated-r13.test.ts`: 합성 6개 Node 테스트 작성 커밋 `7bfb4522338c72180de7cfb59676b70eb01c0f6f`. **프로젝트 Node 6개 테스트 실행 안 함**; PR 상태 open/draft, 변경파일 2개 모두 허용 하위경로, 자동 병합/배포 안 함. GitHub commit status 조회 `statuses=[]`: CI 성공 증거 없음.
- 기존 #21/#53 코드를 덮어쓰거나 main 제품 코드에 병합하지 않음. #21/#53/새 #58의 동일파일 병렬 충돌을 실제 테스트와 리뷰 후 해소해야 함.

## 3. 법원/법률·세무 공식 원문 (확인 범위)
1. **채무자 회생 및 파산에 관한 법률 제589조**, 법률 제21490호 [시행 **2026-10-02**], 국가법령정보센터 https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018130103 — 개인회생 채권자목록·재산목록·수입지출목록·급여/영업소득 증빙 제출 내용 확인. 사건·신청일별 실제 적용/전자소송 서식 동일성은 미확인.
2. **서울회생법원 보도자료 2026-10-01**, https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 — 실무준칙 제424호 제2조 제2항 제7호 신설 공식 공지 확인. PDF 개정 조항 본문·부칙/경과조치 및 사건별 적용 여부 본 회차 정밀 대조하지 않음. **자동 규칙 미추가**.
3. **국세청 부가가치세 개요**, https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401 — 일반과세자 (매출세액-매입세액)와 간이과세자 (업종별 부가가치율 적용) 별도 계산. 이번 수정에 VAT/종소세·사업소득 인정액 산식 변경 없음. VAT=순소득 등치 금지.

## 4. 5개 보드 체크 ID — 모두 **[ ] 부분검증/인수 보류**
- **A2-LAW-020**: 제589조·서울 제424호 공식 공지 및 적용일 구분; 실제 D5103/5110/5111 공인 서식·변호사 승인 없음.
- **A2-IT-020**: #21/#53 소스 해시 대조, TypeScript 본문 격리 실행 8사례 및 신규 통합 Draft PR; 정식 Node/CI 미실행.
- **A2-DOC-015**: D5103 월소득 있는데 0행 final false-ready가 통합 초안에서 막힘; D5103 실제 Word, 필수 첨부 전체 미검증.
- **A2-CALC-030**: 월 가용소득 1,000,000원·36회 36,000,000원 독립 산술 및 숫자/명시적 0 분리, 단 18×91·42 경로 실제 산식/SQL replay 미인증.
- **A2-DATA-020**: `"BAD"`/`"1,00,0000"`/정상 0/월별행0 상태를 코드상 분리; 실제 원문→Fact→typed→SQL→Word 전수 불가.

## 5. 다음 A2
1. #58 브랜치에서 **실제 TS/Node 테스트·typecheck**, 전체 CI 및 main 최신 HEAD 대비 충돌 재확인. 원본 #21/#53 문제 해소는 리뷰 승인 후 조정; 이번엔 병합 금지.
2. 다음은 **AX 시작**으로 18모듈/91입력(고유78)/42 이종 출력 저장·재조회 경로의 원문/Fact/typed/SQL→실제 D5103/5110/5111 문서 bytes SHA, 중복/0/null/상충/source-only 검증.
3. 변제원장 #25/#29/#37/#43/#47/#50과 SQL #33/#38은 별도 충돌 없는 통합 회귀, 36/48/60회·월말·잔여원, 실제 staging D1/R2/공식 서식은 아직 미검증.
4. 제424호 제7호 PDF/부칙 및 2026-10-02 시행판 개별 사건 적용은 서울회생법원 실무·변호사 최종검토 전 미인증.

**본 회차 제품 인수 완료 0건. 운영 배포, D1 운영 마이그레이션, 전자제출, 법원 인가 확정 실행하지 않음.**
