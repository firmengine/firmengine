# FirmEngine A2 59차 — 계산사무장: D5110/D5111 산술용 표시 숫자형식 및 변제기간·청산가치 경계

- **2026-11-01 KST**, 58차 사용자·서류담당자 → **59차 계산사무장** → 다음 **60차 변호사**. 이번 제품 최종인수 **0건**.
- 작업범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래 A2만. 시작 main **`bfb5f59c6601bcfcfe90c7648d7cd89ac2de6e85`**, 코드 원본 blob `9edab755df5adae5f143d15285c550feb0e0f6d5`, 기준정보 blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, 토큰 카탈로그 blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`, migration 0011 blob `0caa359d250dce45765d269d271ad63170ec3efa`.
- 앞선 [r58 영수증](2026-11-01_r58_2213KST_doc-unresolved-render-provenance.md), [Draft #141](https://github.com/firmengine/firmengine/pull/141), [Draft #130](https://github.com/firmengine/firmengine/pull/130), [Draft #133](https://github.com/firmengine/firmengine/pull/133), [Draft #138](https://github.com/firmengine/firmengine/pull/138), r53·r54 원장/변동계획 위험을 이어받음. **각 Draft는 미병합**. 전체 통합검증 결과로 표현하지 않음.

## 1. 발견: 형식오류를 유효 금액으로 만드는 거짓 정상 P1 후보

- 실제 main `lib/legal-calculation-readiness.ts`의 `won()` 원본문은 `normalize("NFKC").replace(/[\\s,₩원]/g,"")`로 쉼표/공백을 무차별 제거함. `"9,00"`→900, `"3,6"`→36, `"1 0 0 0"`→1000으로 해석해, 산술 검토가 불일치/미관찰을 차단하지 못할 수 있음. **원문 함수 본문 V8 격리 실행으로 재현**.
- 예시 A: D5110 `approved_monthly_income="1000", recognized_living_cost="100", monthly_disposable_income="9,00"`. 독립 기대: 월가용액 표시 무효, 검토보류. main `issues=[]`(실제로 900으로 해석), 수정 후보 `PLAN_SCALAR_FORMAT_UNRESOLVED`.
- 예시 B: `repayment_months="3,6"`. 독립 기대: 회차 형식 무효, 검토보류. main `issues=[]`(36으로 해석), 수정 후보 검토보류.
- 별도 D5111/기간 `48`, `60`은 형식상 숫자여도 법 제611조 3년 초과 사유와 실무자 승인이 필요. 포맷 검사가 법률적 기간승인이 되어서는 안 됨.

## 2. 별도 Draft 수정, 실제 실행한 범위

- [**Draft PR #144**](https://github.com/firmengine/firmengine/pull/144), 브랜치 `audit/a2-r59-calc-scalar-format-20261101`. 수정코드 커밋 `d6fba64c12052b695386c9448044fb0714543a8b`, 신규 테스트 원문 커밋 `467afde1e657f71f0c7cfa8c794b7452dd9e262c`. branch blob `9f862a9101aade6d3923ddf82be0112e53880116`.
- `lib/legal-calculation-readiness.ts`: 숫자 또는 정규 천단위 쉼표만 파싱하고, 비정상 표기·런타임 숫자형 `0`을 `PLAN_SCALAR_FORMAT_UNRESOLVED` **내부 데이터 무결성 blocker**로 표시. 문자열 `"0"`은 명시적 0 유지. `null`·미관찰·source-only·비해당는 승격하지 않으며 기존 별도 승인지표 필요. `FIRMENGINE-INTERNAL-DATA-INTEGRITY`는 법조문이 아님.
- `tests/a2-r59-plan-scalar-format-readiness.test.ts`: 합성 테스트 **6그룹 작성·커밋**, **프로젝트 Node 러너 미실행**.
- GitHub main vs branch의 함수 원문에서 **TypeScript 타입 표기만 제거해 JS V8 격리 실행**. 고정 독립 기대 20사례 중 main **12/20**, Draft **20/20** 일치. 범주: 유효 기본/천단위/원 표시/명시적 0, 쉼표오류/중간공백/소수기간/비정상 단위/숫자형 0, null·미관찰·source-only·비해당, 기존 산식 불일치, 48개월 특별검토, D5103 비적용.
- 수정 branch 소스 재조회 V8 **추가 7/7** 독립 기대 일치: 월 900,000원×36/48/60 = **32,400,000 / 43,200,000 / 54,000,000원**; 36개월 보류 추가 없음, 48·60개월 `PLAN_OVER_THREE_YEARS_REQUIRES_SPECIAL_REVIEW`. PV 30,000,000원 < 청산가치 32,000,000원은 `PLAN_LIQUIDATION_EXCEPTION_REQUIRES_REVIEW`; 동일 금액·명시 0원은 비교 이슈 없음. 문자열 `"null"`은 비정상 포맷 차단.
- 코드 변경은 위 **2파일 전부 ax-site 내부**, compare main...branch `ahead_by=2`, `behind_by=0`. **Node 전체, CI, 실제 18모듈 계산 실행/저장서식 연결 미실행**. Draft를 운영/법원 적합성으로 승격 금지.

## 3. SQL 독립 재현과 계약 크기

- main `drizzle/0011_case_calculation_features.sql` 동일 테이블·인덱스 DDL에 합성 `cases` FK stub만 추가한 **Python SQLite 메모리 테스트 5/5 INSERT/SELECT**, `foreign_key_check=[]`. 관찰: `value_json="\"0\"",value_won="0"` 유지; `value_json="\"9,00\"",value_won=NULL,status=computed` 허용; `value_json=null,value_won="0",status=computed` 상충 저장 허용; `source_fact_ids_json=NOT_JSON`도 저장 허용. **SQL 저장 허용은 의미상 완결성/실 D1 재현을 의미하지 않음**.
- 기준 JSON 직접 재파싱: **18개 계산모듈 / 91 입력선언(고유 78) / 42 출력선언(고유 40) / 42 결과경로(고유 42)**. D5103 **37**, D5110 **55**, D5111 **82** 등록 토큰. 이는 **정적 계약**, 91입력의 계산→SQL→DOCX 총괄 시험이 아님.
- 독립 기초 산술: 급여 2,400,000×12=28,800,000원, 사업 순소득 1,000,000×11=11,000,000원, 관찰합계 39,800,000원. 사업 12월 미관찰은 **null**, 임의 0 또는 소득 인정으로 치환 금지. VAT/종소세 장부 및 신청당시 대표기간의 실제 법원 인정은 검증하지 않음.

## 4. 공식 원문 / 시행·법원 경계 (자동규칙 적용 금지)

- **국가법령정보센터**, 채무자 회생 및 파산에 관한 법률 **2026-10-02 시행판, 법률 제21490호**, [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759). 제611조 제5항 3년 원칙/특별사정 5년 이내, 제614조 법률적합·수행가능성·청산가치/동의 등의 법원 인가요건은 별도 심사. 포맷 검사와 법률상 인가는 절대 동의어 아님.
- **서울회생법원**, [2026-10-01 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 제424호 제2조 제2항 **제7호 신설** 공지 확인. 부칙·경과조치·접수시점·사건별 적용일은 **미확인**, 공지일을 모든 사건 자동 시행일로 적용하지 않음.
- **국세청** [VAT 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 반기별, 간이과세자 통상 연간 과세기간. VAT 신고매출·종합소득세 과거 신고액을 곧장 법적 월인정순소득으로 승격하지 않음.

## 5. A2 ID 독립 판정과 다음

| ID | 실제 관찰/한계 | 상태 |
|---|---|---|
| `A2-CALC-025` | 월소득-생계비=가용소득 합성 정상 1000-100=900/오입력 800 불일치, 표시 `9,00` 정상오판 발견. 재산·비용·실제 분배 예산 종단 미실행 | **[ ] 부분** |
| `A2-CALC-026` | 900,000원×36/48/60 독립 값, 제611조 기간검토 이슈 V8 일치. 월별 실원장/잔여원/월말·변동계획/D5110·11 미검증 | **[ ] 부분** |
| `A2-CALC-028` | 30,000,000<32,000,000 원 PV/청산가치 비교 검토이슈 관찰. 인가요건/채권자동의·자산 기준정보 판본 미인증 | **[ ] 부분** |
| `A2-CALC-030` | main 12/20→Draft 20/20 표시 형식/0/null/비해당·단위·숫자형, SQLite 5/5 저장. 18×91×42 E2E/전 체인 미인증 | **[ ] 부분** |

**다음 r60 변호사**: #144의 데이터 내부경고가 제611·614조 적법성 자동판정처럼 보이지 않는지 검토하고, #130/#141/#133/#138과 충돌·실제 Node 통합·DOCX 재독·표시토큰 바이트 대조. SQL에 저장된 잘못된 금액은 계산 생산자/재생 검증과 결합해야 하며, 법원 공식 준칙 개정전문 부칙 및 사건별 시행일/실무자 승인 별도 확인. 고객 원문·OCR사실값·비공개정답·키 저장 없음. 운영 배포, 운영 D1 마이그레이션, 전자제출, 법원 인가 확정 **미실행**.
