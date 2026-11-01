# FirmEngine A2 r63 — IT담당자: 계산 피처 SQL 멱등 충돌·Head 승격 격리 검증

- 기준일: **2026-11-02 KST**. r62 AX담당자에 이어 **r63 IT담당자**, 다음 r64 사용자·서류담당자.
- 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 읽은 main HEAD 최초 `48b78b05ec35050a835a86542d5b13c51719ccfa`; 기록 직전 HEAD `48b78b05ec35050a835a86542d5b13c51719ccfa`; 최근 main 커밋(A1 r63·A4 r62·A3 r62), 미병합 PR #148/#151 및 r62 영수증 확인.
- 핵심 원본/Blob: `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`; `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`; `lib/template-token-catalog.json` `899c4d564fcb1726861f89dcf04dbf1b7e372687`. #148 계산 피처 후보 소스 Blob `eec10fb49653ced2928ae3ea9455c246339c7073`; #151 기존 직렬화 테스트 Blob `63b8ca92c024f5922a0867d3f29aceab8ebfe372`.
- 보드 검토: **A2-IT-008 / A2-IT-010 / A2-IT-015 / A2-IT-019**, 모두 **[ ] 부분검증**, 제품 인수 **0건**.

## 1. 실제 source·schema 및 독립 SQL 실행

**main의 원래 SQL**을 재독: `persistCaseCalculationFeatures()`에서 run과 feature는 `INSERT OR IGNORE`, head는 버전 조건 `ON CONFLICT DO UPDATE`; 반환 전에 **마지막 head `meta.changes`만 확인**. 동일 primary key의 기존 feature 행과 후보 행의 내용 동등성 비교는 보이지 않는다. `runId`는 `caseId/dataVersion/caseRevision/inputSha256/ruleReleaseId/reference/sourceHeadsSha/rawResultSha` 해시로 생성되므로 **정상 재계산의 원본 결과가 달라지면 보통 다른 run ID**가 된다.

별도 브랜치의 [Draft PR #153](https://github.com/firmengine/firmengine/pull/153)에 SQL 전용 테스트 `tests/a2-r63-it-sql-idempotence-diagnostic.test.mjs`를 추가(제품 코드 변경 없음). main의 실제 migration **0011 텍스트를 readFileSync로 실행**하고, main 함수에 적힌 3가지 SQL(run/feature/head)을 동일하게 사용한다. 가상 사건/Facts/원화 값만 사용; 실제 고객 문서·OCR 정답·키 없음. 로컬 Node **v22.16.0** 명령 `node --no-warnings --test tests/a2-r63-it-sql-idempotence-diagnostic.test.mjs`: **5개 진단 테스트 실행·통과, 1개 TODO, 실패 0**. 이는 전체 프로젝트 Node/CI·실제 Cloudflare D1 시험이 아니다.

| 합성 입력 | 독립 기대 | 실행 관찰 | 의미 |
| --- | --- | --- | --- |
| 첫 저장: `SYN-C1`, version=5, `value_json="2400000"`, `value_won=2400000`, Fact `SYN-F1` | run/feature/head 각각 1행 영향 | **1/1/1** | 정상 |
| 같은 run/feature ID, 같은 값·Fact 재시도 | 멱등 보존 | **0/0/1**, 기존 240만원 유지 | 정상 재시도 |
| **조건부 기존 행 불일치**: 같은 ID로 900만원 후보 | head 승격 전 금액 상충 감지·보류 필요 | feature changes **0**, head changes **1**, 저장금액 **240만원** | **SQL 수준 탐지 부재** |
| 같은 ID, Fact를 `SYN-F1→SYN-F2`로 변경 | head 승격 전 계보 상충 감지·보류 필요 | feature changes **0**, head changes **1**, stored Fact=`SYN-F1` | **SQL 수준 탐지 부재** |
| data_version 4 재실행, 현재 5 | 구판본 head 승격 거부 | head changes **0** | 버전 보호 작동 |
| `value_won="0"`, `value_json="\"0\""` 저장 후 JSON만 `null`로 오염시키는 합성 | SQL 의미적 상충 탐지 필요 | `value_json=null`·`value_won="0"`·`status=computed` 동시 보관 허용 | CHECK/대조 게이트 없음 |
| 외래키 검사 | 0 위반 | **0** | FK만 확인 |

**엄격한 해석:** 위 900만원/Fact 변경은 **동일 ID가 의도적으로 사전 점유된 합성 시나리오**다. 따라서 정상 계산기가 서로 다른 내용으로 동일 runId를 생성한다고 입증하지 않았다. 구 데이터 오염, serializer/계약 버전 변경, 이전 작성 오류가 있을 때 `INSERT OR IGNORE`로 SQL이 상충을 숨길 수 있다는 **조건부 P1 위험 후보**만 입증했다. `headChanges=1`을 기능적 완전성/법률 승인/서식 인가의 근거로 삼을 수 없다. D1 batch 원자성·실제 동시성은 미관찰. 트랜잭션/CAS·식별자 생성규칙 변경은 고위험이므로 **코드 자동 변경·병합하지 않음**.

## 2. 카탈로그·산술·서식 계약 재독

- main `reference-decision-tables.json` **18 모듈**, 입력 선언 **91**(고유 **78**), 출력 선언 **42**(고유 **40**), `resultPaths` **42**(고유 **42**). main `template-token-catalog.json` 등록 D5103 **37**, D5110 **55**, D5111 **82**. 모두 GitHub JSON 직접 재파싱, **실제 91 입력→42 출력→SQL→DOCX 종단검증 아님**.
- 독립 Python 정수 산술: 관측 가상 급여 **2,400,000×12=28,800,000원**, 사업 순소득 **1,000,000×11=11,000,000원**, 관측합계 **39,800,000원**. 사업 12월은 **미관찰**이며 0이나 미래 추정값으로 채우지 않음. 가상 VAT 매출 60,000,000원·종합소득세 자료 20,000,000원은 **source-only**, 월순소득 합계에 중복 추가 금지.
- 가상 월변제액 900,000원×**36/48/60**=**32,400,000/43,200,000/54,000,000원**(명목총액). 청산가치 32,000,000원과 현재가치 30,000,000원의 차액 **2,000,000원**. 법률상 기간 적합성·변제가능성·인가 요건은 **승인 전**.
- 이번 test는 원문→Fact→typed→SQL의 전체 라인지를 생산하지 않는다. `null`, 명시적 `0`, 상충, 비해당, source-only, 미관찰, 승인전은 **상호 구분**. 저장된 `computed`와 법률상 인정은 다르다.

## 3. 최신 공식 법률·세무 원문 (2026-11-02 재조회)

- 국가법령정보센터 [채무자회생법 제611조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **[시행 2026-10-02] 법률 제21490호**, 변제기간 원칙 3년·특별사정 최장 5년 및 인가요건 원문 확인. 산술만으로 자동인가 금지.
- **서울회생법원** [2026-10-01 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 **제424호 제2조 제2항 제7호 신설** 공지 확인. PDF 개정전문의 **부칙·경과조치·사건별 적용일은 미열람/미인증**. 공지일을 전 사건의 법률 적용일로 자동 확정 금지.
- 국세청 [부가가치세 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 통상 반기, 간이과세자 통상 연간 과세기간 확인. VAT/종소세 신고액을 법원 인정 월순소득으로 자동 승격 금지.

## 4. 인수 ID, 미실행 항목, 다음 처리

| 보드 ID | 이번 실제 검증 | 미완료 사유 |
| --- | --- | --- |
| **A2-IT-008 [ ]** | SQL 조건부 동일-ID 충돌 시 head UPDATE 가능, 구판본 dataVersion 차단 | 전체 애플리케이션 CAS/D1 동시 워커·사전오염 실환경 검증 없음 |
| **A2-IT-010 [ ]** | 실제 0011 migration DDL, 인덱스/FK 구조를 인메모리 실행 | 스테이징 migration journal/실제 테이블 diff 없음 |
| **A2-IT-015 [ ]** | 5개 Node SQL 진단, 0/null·value/Fact 재독 | D1 → typed → 재계산·42 경로 전수 왕복/Word 없음 |
| **A2-IT-019 [ ]** | SQL run/feature/head ID·Fact 계보 변경 시 차단 부재 관찰 | 원문 OCR/typed 해시부터 최종 output hash·서식 서명까지 미검증 |

- [Draft PR #153](https://github.com/firmengine/firmengine/pull/153) **테스트 파일 1개만**, 원화 값·산식·DB 정책·법률 기준정보 수정 없음. `test.todo`는 의도적으로 남겼고 **보완코드 통과가 아니다**. 기존 [Draft #148](https://github.com/firmengine/firmengine/pull/148)→[Draft #151](https://github.com/firmengine/firmengine/pull/151) 원화 직렬화 회귀와 실제 프로젝트 Node 러너 결합은 미실행.
- **다음 r64 사용자·서류담당자:** D5103/D5110/D5111의 승인전·상충 미표시 게이트, #130/#141 서식, #138 원천 Fact 및 #133 변제배분 통합. IT 후속에서 D1 격리 transaction + 멱등 재시도 기존 행 전열 비교·조건부 head 승격의 경쟁·오염 시험을 설계하여 별도 PR 리뷰할 것.
- **최종 인수: 0건.** 실제 앱 전체 Node/CI, staging D1/R2/Cron, 실제 DOCX 생성·재독, 공식 서식 동등성, 변호사·계산사무장 확인 모두 **미실행/미인증**. 운영 배포·운영 D1 migration·전자제출·인가 확정 없음.
