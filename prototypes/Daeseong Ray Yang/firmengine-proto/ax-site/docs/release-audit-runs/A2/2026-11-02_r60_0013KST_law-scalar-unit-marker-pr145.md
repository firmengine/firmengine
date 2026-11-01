# FirmEngine A2 60차 — 변호사 관점: 변제기간 단위/미확정 토큰의 내부 산술 오해 방지

- 날짜: **2026-11-02 KST**. 이전 **59차 계산사무장** → 이번 **60차 변호사** → 다음 **61차 데이터담당자**. A2 제품 최종인수 **0건**.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 이번 회차 시작 main `593e2b629e2a7cdfd69928099d17b14b05cbebab`; 직전 r59 영수증 `2026-11-01_r59_calc-form-scalar-format-provenance.md`. 기존 #130/#133/#138/#141/#144 전부 Draft/미병합으로 확인.
- 비교한 실제 GitHub blob: r59 Draft #144 `lib/legal-calculation-readiness.ts` **`9f862a9101aade6d3923ddf82be0112e53880116`**, r60 Draft #145 **`de4305960d3ed8e40e7f38e188c7a14b09a8e2af`**. 최신 main 코드의 동일 파일 blob **`9edab755df5adae5f143d15285c550feb0e0f6d5`**.
- 의도: `A2-LAW-014`, `A2-LAW-015`, `A2-LAW-018`, `A2-LAW-022`의 법률/데이터 게이트를 **서로 다른 승인계층**으로 유지. 전체 **[ ] 부분검증**, 사람 승인은 0건.

## 1. 실제 코드 재독과 독립 오라클

59차 수정안 #144의 `won()`은 정규 천단위 금액과 통화단위 접두·접미표시를 받아들인다. 이 파서를 `repayment_months`에도 동일 적용하기 때문에, **금액 표시 `"₩36원"`을 36개월로 받아** 내부 포맷 이슈가 0건이 된다. `"₩61원"`의 경우 **자료형/단위 오류가 먼저임에도** `PLAN_DURATION_OUTSIDE_STATUTORY_LIMIT`만 보고하여 사용자가 법률 기간 판단이 수행된 것으로 오인할 수 있다. 미확정 판정의 접두 정규식은 대괄호 종료 검사 없이 `[미관찰]999`, `[검토완료]`, `[source-only]900` 등을 통째로 건너뛴다. 이는 *서식 스칼라 표시 데이터 검증* 결함 후보이지 실제 개인회생 사건의 법률상 적법성 결론은 아니다.

GitHub에서 **수정 브랜치 코드 커밋·테스트 커밋 이후 재조회한 실제 함수 본문**을 TS 타입 선언만 제거하고 V8에서 실행하였다. 독립 고정 기대 24개 중 **기존 #144 16/24**, **#145 24/24** 일치. 수치별 상태:

| 합성 바인딩(모두 가상) | 독립 기대 (내부 경계) | #144 실제 | #145 실제 |
|---|---|---|---|
| D5110 `repayment_months="₩36원"` | `PLAN_SCALAR_FORMAT_UNRESOLVED` | issues=[] (거짓 정상) | 형식 blocker |
| D5110 `repayment_months="₩61원"` | 금액 단위 오류, 법률 기간 계산 미실행 | 기간 60 초과 법률코드만 | 형식 blocker만 |
| D5110 `repayment_months="36"` | 별도 기간 이슈 없음(승인 아님) | 없음 | 없음 |
| D5111 `repayment_months="48"` | 3년 초과 특별사정 검토 | 법률 검토코드 | 법률 검토코드 |
| D5111 `repayment_months="61"` | 기간 범위 초과 검토 | 범위 초과코드 | 범위 초과코드 |
| D5110 `monthly_payment="[미관찰]999"` | 형식 blocker | issues=[] | 형식 blocker |
| D5110 `monthly_payment="[검토완료]"` | 형식 blocker, 법률 승인 아님 | issues=[] | 형식 blocker |
| D5110 `monthly_payment="[source-only]900"` | 형식 blocker | issues=[] | 형식 blocker |
| D5110 `monthly_payment="[미관찰]"` | 미관찰 유지, 자동 0/승인 금지 | issues=[] | issues=[] |
| D5110 `monthly_payment="[미관찰: 증빙없음]"` | 미관찰 세부사유, 자동 승인 금지 | issues=[] | issues=[] |
| D5110 `monthly_payment="0"` | 문자열 명시적 0원 | issues=[] | issues=[] |
| D5110 `monthly_payment=0` | 숫자형 오류 (원문 바인딩 계약 위반) | 형식 blocker | 형식 blocker |
| D5110 `monthly_payment=null` | 미관찰 null (0 아님) | issues=[] | issues=[] |
| D5110 `monthly_payment="₩ 900,000원"` | 원화 금액 표기로서 파싱 가능 | issues=[] | issues=[] |
| D5111 `present_value=30,000,000,liquidation_value=32,000,000` | 제614조 관련 실무자 검토 필요 | 원래 검토코드 | 원래 검토코드 |
| D5103 `repayment_months="₩36원"` | 이 신규 D5110/11 게이트 비적용 | issues=[] | issues=[] |

추가 경계 8건(36원, ₩36, 36개월, source-only, [검토 필요], 비정상 쉼표, D5111 형식, 일반 0)을 포함하여 총 24개. 서로 다른 입력들의 예상/관찰은 테스트 실행 결과로 확인되나, `issues=[]`는 **법률상 합격이나 최종 문서 준비 상태가 아님**. `automaticLegalApproval`은 기존/수정 모두 false. 24/24는 **격리 함수 V8**, 전체 Node 프로젝트·CI·staging D1·R2·Cron·실제 DOCX·법률 인가가 아니다.

## 2. 수정과 충돌 통제

- **[Draft PR #145](https://github.com/firmengine/firmengine/pull/145)**: `audit/a2-r60-law-scalar-unit-marker-20261102-0013`, base `audit/a2-r59-calc-scalar-format-20261101` (#144의 head), **stacked/미병합**. 파일 변경 2개 모두 허용 범위 내부. 코드 커밋 `a05b49245f918f3d7a4bded812aaad5440ca4cc1`, 테스트 커밋 `799c19b72471909654320032b86163de60665748`. 선행 HEAD `467afde1e657f71f0c7cfa8c794b7452dd9e262c`; compare ahead=2, behind=0.
- `lib/legal-calculation-readiness.ts`: `repayment_months`는 통화 접두/접미/원화 표기 대신 *단위 없는 정수* 형식으로 제한. 잘못된 숫자는 `PLAN_SCALAR_FORMAT_UNRESOLVED`만 낸 뒤 **그 오입력으로 기간 제611조 판단을 수행하지 않음**. 미확정 토큰은 정확히 닫힌 대괄호 형태만 허용. 금액 산식·기간 기준·청산가치 비교 기준, `automaticLegalApproval:false` 변경 없음.
- `tests/a2-r60-law-scalar-unit-marker.test.ts` 신규 4그룹 작성/커밋. **프로젝트 Node 러너에서 미실행**. #144의 기존 테스트 6그룹 및 #130/#133/#138/#141 실제 통합시험도 미실행. PR #145 병합/운영 적용 금지(실무검토 필요).

## 3. 저장형식별 합성 재독과 전체 계약

main `drizzle/0011_case_calculation_features.sql` blob **`0caa359d250dce45765d269d271ad63170ec3efa`**의 계산 테이블/인덱스 DDL을 인메모리 SQLite에 설치하고 `cases` FK 대상만 합성 stub 생성. 합성 실행 `SYN-RUN` 아래 원문/Fact ID/typed/SQL feature 대응 5행 INSERT→SELECT를 실행. **5/5 행 저장·재조회**, `foreign_key_check=[]`:
1. `value_json='"0"', value_won='0', status='computed', source_fact_ids_json='["SYN-FACT-1"]'`: **관측 명시적 0**.
2. `value_json='null', value_won=NULL, status='missing'`: **미관찰 null**.
3. `value_json='null', value_won='0', status='computed'`: SQL 허용하나 **의미적 상충**.
4. `value_json='"36원"', value_won='36', status='computed'`: SQL 허용하나 **단위 상충/원천 검토**.
5. `source_fact_ids_json='NOT_JSON'`: SQL 허용하나 **Fact 계보 JSON 오염**.

이 시험은 **SQLite 스키마 기반**이며 실제 제품 저장코드나 운영/스테이징 D1 호출이 아님. SQL 성공은 법원 인정액/개인정보 증빙 확인을 뜻하지 않음.

main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`와 `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`를 실제 JSON 파싱: **18개 모듈 / 91 입력 선언(고유 78) / 42 출력 선언(고유 40) / 42 결과경로(고유 42)**, 서식 등록 토큰 **D5103 37 / D5110 55 / D5111 82**. 이는 정적 계약이며 종단 실행·SQL→DOCX 숫자 일치 시험 아님. 독립 산술: `2,400,000×12=28,800,000`, `1,000,000×11=11,000,000`, 합 `39,800,000`원. 사업소득 미관찰 12월은 null, VAT/종소세 자료는 법적 인정 월순소득과 별개.

## 4. 공식 원문·관할/판본 및 승인 경계

- **국가법령정보센터** `채무자 회생 및 파산에 관한 법률` **[시행 2026-10-02], 법률 제21490호**; [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777) 변제기간 3년 원칙과 특별사정 최대 5년, [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) 법률 적합성·공정/형평·수행가능성·인가결정일 기준 청산가치/동의 등 법원 판단. **회차 숫자 형식은 법률 인가 근거가 아님.**
- **서울회생법원** [2026-10-01 공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 서울 준칙 제424호 **제2조②제7호 신설** 공지 확인. 공식 공지의 PDF 첨부/별도 준칙 전문·부칙·경과조치에 대한 스크린샷 확인은 이번에도 실패/미확인; 사건별 적용일을 10/1로 확정하거나 24개월 등을 자동 부여하지 않음. main `lib/reference-parameters.json` blob `e57a9d7c99efe052d4581d780ed478d876eb3330`은 서울 단축기간 법원 parameter `effectiveFrom=2026-10-01`, `verification=inherited`, `changePolicy=human_review_required`. 이는 법원 공식 부칙에 대한 검증 완료가 아님.
- **국세청** [부가가치세 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 보통 반기(1~6월/7~12월), 간이과세자 통상 1년. VAT 매출금액·종합소득세 과거 신고액을 그대로 법적 월변제재원으로 승격하지 않음.

## 5. ID별 상태·다음

| 보드 ID | 실제 검증/남은 점 | 상태 |
|---|---|---|
| `A2-LAW-014` | 통화단위 기간이 법률 기간 검토로 위장되는 문제를 V8에서 재현·표시 입력 차단 후보. 36/48/60 및 청산가치의 법률 허용판단·사건별 심사 별도 | **[ ] 부분** |
| `A2-LAW-015` | 서울 2026-10-01 신설 공지 vs 시행 2026-10-02 법률판본 vs inherited reference를 독립 기록; 경과조치/사건별 적용 확인 전 미인증 | **[ ] 부분** |
| `A2-LAW-018` | 제614조 산술 플래그/청산가치 독립 재실행. 법률상 인가요건, 채권자 동의 및 수행가능성 자동증명 불가 | **[ ] 부분** |
| `A2-LAW-022` | [미관찰]999·[검토완료]·원화단위 월수의 무경고 통과 재현→Draft #145 수정; 0/null/비해당/source-only는 검토 단계 분리. 실제 최종서식 검증 미인증 | **[ ] 부분** |

**다음 r61 데이터담당자:** #145의 원천 형태→typed 숫자→SQL feature 저장→재독·표시단위, #144 및 #130/#141/#138/#133의 상충 검증과 합성 Node 통합. 월별 급여/사업소득/중복/VAT/종소세/채권·재산·청산·변제배분의 18×91×42 전체 확인은 미완료. 공식 서울 준칙 PDF 부칙 확인 및 법률/세무/서식 실무자 승인 별도. 고객 문서/개인정보/OCR 사실값/.env/비공개 정답/키 공개 Git 미적재. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 **미실행**.
