# FirmEngine A2 r111 — IT담당자 / 법률증빙 타입·라우트 경계·SQL 원화 상태 감사

- 감사일: **2026-11-04 KST**, 역할 순환 **r110 AX → r111 IT → r112 사용자·서류담당자**. 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`에서만 작업.
- 시작 main HEAD: `ec0e12400d234349ce218a1b45d5f8579a83feb9`; 영수증 쓰기 직전 main HEAD: `ec0e12400d234349ce218a1b45d5f8579a83feb9`. 최근 A2 [r110](2026-11-04_r110_ax-seoul424-integrated-evidence-pr225.md), Draft [#225](https://github.com/firmengine/firmengine/pull/225) 및 기존 #18/#217/#224 파일/커밋 확인.
- 실제 소스: main `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`, #225 blob `4bba45b6bcade596f0bf2d951302467435090e2f`; 호출부 main `lib/legal-proposals.ts` blob `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`. 스키마 `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`. package scripts에는 `test:legal-auto` 등 있으며 r110 신규 테스트가 그 스크립트에 자동 포함된다는 보장은 없음.

## 1. 신규 P1 결함: 비불리언 승인 표시가 법률 후보로 오승격

`wageCriterion`은 `!history.sourceValidated || !history.legallyRecognized`를 사용하고, `evidenceTri`는 `e.sourceValidated && e.legallyRecognized`를 사용한다. 런타임 JSON에 문자열 `"false"` 또는 숫자 `1`이 오면 JavaScript truthiness 때문에 **검토되지 않은 제7호 사실을 검토 후보로 오승격**한다. #225 역시 이 방어가 없다. `categoryRoutes=null` 또는 `[null]`은 예외를 발생시킨다.

**독립 실행 방법:** GitHub에서 가져온 main/#225 실제 함수본문의 TypeScript 타입 표기만 제거하고 V8 `new Function` 격리 실행. 참조 파라미터는 가상 고정값 `court=seoul`, `effectiveFrom=2026-10-01`, `totalDebtThreshold=50,000,000`, `wageYears=2`, `recentDebtYears=1`; `SYN-*` Fact ID만 사용. 법령판본/법률적격성을 stub으로 **증명한 것이 아님**.

| 번호/합성 입력 | 독립 기술 기대 | main 실제 | #225 실제 | 신규 #226 함수 수정 후 실제 |
|---|---|---|---|---|
| 1. 정상형 모든 flag=true | candidate_for_human_review | candidate | candidate | candidate |
| 2~3. 급여 sourceValidated 또는 legallyRecognized `"false"` | unknown | **candidate** | **candidate** | unknown |
| 4. 총채무 sourceValidated `"false"` | unknown | **candidate** | **candidate** | unknown |
| 5. 개인채권자 legallyRecognized `"false"` | unknown | **candidate** | **candidate** | unknown |
| 6~7. 최근채무/급여 sourceValidated = 숫자 `1` | unknown | **candidate** | **candidate** | unknown |
| 8~9. categoryRoutes = null / [null] | unknown, 예외 없음 | **TypeError** | **TypeError** | unknown |
| 10~11. 경로 status=`"YES"` / factIds=`"SYN-R"` 비배열 | unknown | 미인증 | 미인증 | unknown |
| 12~15. 시행전·일자없음·관할없음·급여 Fact ID 공백 | unsupported_version/unknown | 판본별 일부 정상 | 판본별 정상 | 모두 기술 기대 일치 |

- **15조건 독립 기술 기대 일치:** main **5/15**, #225 **7/15**, **#226 15/15**. 모든 #226 관찰에서 `courtApprovalInferred=false`; 15개 전체를 실제 Node 러너로 돌린 수치 **아님**.
- #226는 #225를 부모로 하는 **별도 미병합 [Draft PR #226](https://github.com/firmengine/firmengine/pull/226)**. 오직 평가기 1파일과 신규 테스트 1파일 변경. 실제 업데이트 후 평가기 blob `2e6f879e182d7c428f58d91ed75793029f2a7a20`, 신규 15개 Node 테스트 소스 blob `12371a351910848f076c94dd9ef92afa9834d78c`, 브랜치 HEAD `06a580bc564c6268710343317d55abec5252a89c`.
- 방어 방식: 증빙 flag는 `=== true`만 긍정, categoryRoutes 컨테이너/요소/status/factIds 형식이 어긋나면 `unknown` 보류. **법률 의미 변경 우려 때문에 main 제품 코드는 그대로**, Draft 및 실무자 검토 보류. #225의 기존 22개 Node 회귀시험도 프로젝트 러너 **미실행**.

## 2. SQL 0011 동형 합성 저장·재독 (실제 D1 아님)

GitHub main `0011`의 3테이블 CREATE TABLE·INDEX 원문과 동형 DDL을 `sqlite3 3.46.1` **인메모리**에 실행; `SYN-C` case, `SYN-RUN` calculation run 및 6개 synthetic feature 저장/재독.

| 입력 feature | 독립 기대(무결성 기준) | 관찰 SQL |
|---|---|---|
| TRUE_ZERO: `value_json="\\\"0\\\""`, `value_won="0"` | 실제 명시적 0 보존 | 저장·재독 |
| UNKNOWN: `value_json="null"`, `value_won=NULL` | 미관찰 구별 | 저장·재독 |
| NULL_ZERO_CONFLICT: `value_json="null"`, `value_won="0"` | 상충 차단/검토보류 필요 | **DB 수락** |
| STRING_FALSE: `{"sourceValidated":"false","legallyRecognized":"false"}` | 불리언 인증 불가 | **DB 수락·string 보존** |
| NUMBER_ONE: `{"sourceValidated":1,"legallyRecognized":1}` | 불리언 인증 불가 | **DB 수락·number 보존** |
| FAKE_FACT: 타사건 ID 모사, `status="approved"` | Fact 소유/상태 검증 필요 | **DB 수락** |
| 미존재 run FK | 거부 | **IntegrityError 거부** |

`PRAGMA foreign_key_check=[]`; 저장 허용은 업무 무결성 PASS가 아니다. SQL에 승인 flag가 들어간 것은 **형태 가능성 실험**일 뿐 제품 mapper가 이런 `EvidenceValue`를 실제 feature에 직렬화한다는 주장 아님. 운영/staging D1·실제 source Fact 귀속·typed→42출력→Word 소비는 미관찰.

## 3. 계산·서식 정적 선언과 독립 산술

main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18모듈, 91개 입력 선언(고유78), 42개 출력 선언(고유40), resultPaths 42개**. main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103=37, D5106=48, D5110=55, D5111=82**. 둘 다 직접 JSON 파싱 재확인(정적 계약만). 독립 산술 기준 월 `900,000원 × 36/48/60개월 = 32,400,000 / 43,200,000 / 54,000,000원`; 계산 18모듈/원문 Fact→typed→SQL→서식 실제 실행·대조는 **안 함**.

## 4. 공식 법원·법령·국세청 재조회

- [서울회생법원 2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187) **제424호 제2조 제2항 제7호 신설** 직접 재열람. 법원 개정전문 PDF/부칙은 **이번 r111 재독하지 않음**. 앞선 r108의 2026-09-23 개정/2026-10-01 시행/이후 최초접수 적용 기록과 구분.
- 국가법령정보센터 [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR) **[시행 2026-10-02] 법률 제21490호** 직접 열람. 총채무 금액/청산가치·법원인가 요건은 가상 기술 후보와 독립.
- 국세청의 부가가치세 안내는 [개인 부가가치세 메뉴](https://www.nts.go.kr/)에서 존재 확인하되, 기존 링크 `cntntsId=7802`는 현재 실제 **'가산세'** 페이지임을 발견. **VAT 과세기간 6개월/1년 원문을 이번 회차 신규 검증하지 않았음**. VAT·종소세 신고액·월별 법원인정 순소득을 자동 동등시/전환하지 않음.

## 5. A2 IT 체크 ID / 수정 / 다음

- **A2-IT-004 [ ]**: null/0/unknown·비불리언 flag와 저장 의미를 분리, source-only→법률 인정 승격 방지. 전체 경로 미검증.
- **A2-IT-015 [ ]**: 0011 동형 SQLite 6건 수락과 외래키 1거부; 실 D1/typed feature→재계산 미검증.
- **A2-IT-018 [ ]**: 서울 424호 2026-10-01 공식 공지, 법률 제611/614조 2026-10-02 시행판 직접 열람, VAT URL 판본 오류 표기. 법원 부칙·공식 판본별 사건 적용 미인증.
- **A2-IT-020 [ ]**: TS/JSON 런타임 flag 타입·경로 타입의 P1 결함 재현, Draft #226 수정·15건 V8 격리 일치. 실제 전체 Node/CI 및 승인 미인증.

**다음 r112 사용자·서류담당자**: #226의 실제 Node22 러너(신규 15 + 부모 22) 및 `buildLegalProposals` 실제 호출 입력·Fact 귀속·관할/최초접수일 전파; blocked 원장 금액이 D5103/06/10/11에 0원으로 표시되는지 SQL/문서 생성·재독. #225/226 중첩 PR은 실무 법률/데이터 승인 전 병합 금지.

**제품 최종 인수 완료 0건**. 실제 Node 프로젝트 러너/전체 CI/staging D1·R2·Cron/공식 DOCX·서식 동등성/변호사·계산사무장 승인/운영 배포·전자제출·법원 인가 확정 전부 미수행. 미관찰/null/0/비해당/상충/source-only/승인전 상태는 합치지 않음.
