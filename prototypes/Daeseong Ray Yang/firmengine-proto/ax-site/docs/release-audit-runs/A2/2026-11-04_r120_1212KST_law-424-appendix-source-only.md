# A2 r120 — 변호사: 제424호 부칙·최초 접수일과 사업소득 미관찰/0 표시 교차검증

- 2026-11-04 KST, 감사 시작 main `a0c8099d25696dee63ff62d0a5f6c200b14356b6`, 회차 영수증 생성 전 main `a0c8099d25696dee63ff62d0a5f6c200b14356b6`. 정확한 변경 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`; r119 계산사무장 → **r120 변호사** → 다음 r121 데이터담당자.
- **중앙 보드 ID 5개:** `A2-LAW-015`, `A2-LAW-019`, `A2-LAW-021`, `A2-LAW-022`, `A2-LAW-024`, 모두 **[ ] 미완료**. 전문변호사·법원·실무자 승인이 아니라 증거/기술 검증이다.
- 최근 main 커밋 `a0c8099`(A1 보드 보존병합), `7e90784`, `9fc20b7`, `0b0ac30`, `2a8a79f` 및 기존 A2 r114·r119 영수증을 재독. 기존 Draft [#225](https://github.com/firmengine/firmengine/pull/225)→[#226](https://github.com/firmengine/firmengine/pull/226)→[#230](https://github.com/firmengine/firmengine/pull/230), [#234](https://github.com/firmengine/firmengine/pull/234), [#34](https://github.com/firmengine/firmengine/pull/34)는 **미병합**. 중복 제품 수정/법률 규칙 개정 없이 검증 영수증만 기록.

## 읽은 코드·계약·저장 스키마
- main `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`, #230 수정 후보 blob `92f1bc09d35062da1bb3328fcb3a930050dcfb96`.
- main `lib/legal-proposals.ts` blob `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`: **122행** `data.context.applicationDate`를 직접 `firstFilingDate`로 전달. 법원 최초 접수증의 Fact ID·사건 귀속·날짜 판본·인적 승인 연결은 해당 코드에서 검증하지 않음. `lib/context-validation.ts` blob `7ea7262cca177cc92a59f65fe917cc14573786db`에 context `applicationDate`는 있으나 독립된 법원 최초접수 증빙 필드/검토 계약 미확인. 이는 실제 법률 적용 판정의 **P1 유보** 사항.
- main `lib/business-source-evidence.ts` blob `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`, `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`, #234 후보 blob `216ea2f889d146b1762be65b097da2f896e826dc`.
- 실제 회귀테스트 소스 `tests/legal-proposals.test.ts` blob `4cd74960411f11652c4e1746d05bfb555bd87540`, `tests/business-source-evidence.test.ts` blob `518a718be6ceac81cd48a68ad634c8cc039d9fcb`; **읽기만 수행**. `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: runs/features/heads 테이블과 `value_json`, `value_won`, `status`, `source_fact_ids_json` 선언 재독. 실제 제품 D1 적재/재조회는 미실행.
- 참조파라미터 `lib/reference-parameters.json` blob `e57a9d7c99efe052d4581d780ed478d876eb3330`: 서울 관할/2026-10-01/총채무 5천만원/임금 2년/최근채무 1년, 값은 `verification=inherited`, 승인정책 `human_review_required`. 참조정의 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`를 JSON 파싱해 **18 modules/91 input declarations/42 output declarations/42 resultPaths**, `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`를 JSON 파싱해 **D5103 37 / D5106 48 / D5110 55 / D5111 82** 토큰 확인. 이는 정적 계약 재독일 뿐 계산 출력 42개·Word 서식 생성 검증 아님.

## 서울회생법원 제424호 공식 PDF **부칙 직접 페이지 확인 — 이번 회차 신규 독립 증거**
- 서울회생법원 [2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187)에서 제424호 제2조 제2항 **제7호 신설** 확인. 공식 [실무준칙 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2)를 web PDF 페이지 **0-index 271(인쇄 252), 272(인쇄 253), 391(인쇄 372)** 화면으로 실제 재독.
- 개정 **2026-09-23**, PDF 인쇄 253쪽 제7호는 **가. 최근 2년 최저임금 미만 급여, 나. 총채무 5천만원 이하, 다. 개인채권자 없음, 라. 최근 1년 신규채무 없음(물품구입 신용카드채무 제외)** 4개 모두 요건으로 기재. §2(3)는 법원 고려사항을 별도로 명시.
- **부칙(2026.9.23), 인쇄 372쪽:** 제1조 시행일 **2026-10-01**; 제2조 **시행 이후 최초 접수되는 사건부터 적용**, **시행 전 이미 인가된 변제계획 효력에 영향 없음**. 따라서 코드의 `applicationDate`와 법원 최초접수일을 승인 없이 동일시해서는 안 됨.
- [국가법령정보센터 제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777) 및 [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759)는 **2026-10-02 시행, 법률 제21490호** 별도 법 판본이다. 611조의 변제기간 원칙/예외와 614조의 공정·형평·수행가능성·청산가치 등 인가요건은 제424호 기술 후보와 법적 의미가 다름. 승인 전 자동 법률 규칙 승격 금지.
- [국세청 부가가치세 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 6개월/간이과세자 1년 과세기간. VAT 매출자료·종합소득세 연간 증빙을 법원 인정 월순소득으로 자동 합산·승격 금지.

## **실제로 실행**한 격리 기술 검증 — 단위·법률 승인 혼동 금지
GitHub의 실제 `evaluateSeoul424`(및 validDate/wageCriterion/evidenceTri) 함수본문을 읽어 **TypeScript 타입 표기만 제거**한 JavaScript V8 Function으로 실행; 참조값은 실제 JSON의 2026-10-01/서울/5천만원/2년/1년과 동형 주입. 입력은 모두 `SYN-*` 합성 Fact ID, 외부 증빙·DB/인증은 stub이다.
- **17조건:** 독립 보수적 기술 기대 **main 8/17, Draft #230 17/17**. 아래 `candidate`는 `candidate_for_human_review`이며 인가/법률 검토 승인 아님.

| 합성 조건 | 독립 기대 | main 관찰 | #230 관찰 |
|---|---|---|---|
| 서울/2026-10-02/제7호 4조건 긍정 증빙 합성 | candidate | candidate | candidate |
| 서울 관할 `null` | unknown | **candidate (오승격)** | unknown |
| 관할 `""` / 공백 / 앞뒤 공백 `" seoul "` | unknown | **not_applicable (3조건 오분류)** | unknown |
| 관할 명시적 부산 | not_applicable | not_applicable | not_applicable |
| 최초 접수 합성 `2026-09-30` | unsupported_version | unsupported_version | unsupported_version |
| 최초 접수 합성 `2026-10-01` | candidate | candidate | candidate |
| 날짜 `2026-10-32` 또는 null | unknown | unknown | unknown |
| 급여 증빙 null | unknown | unknown | unknown |
| 급여 sourceValidated 문자열 `"false"` / legallyRecognized 숫자 `1` | unknown | **candidate (2조건 오승격)** | unknown |
| 급여 Fact ID 공백 / 중복 | unknown | **candidate (2조건 오승격)** | unknown |
| 제1~6호 명시적 YES 및 유효 합성 ID | candidate | candidate | candidate |
| 제1~6호 YES인데 Fact ID 빈 문자열 | unknown | **candidate (오승격)** | unknown |

`lib/form-mapping.ts` 실제 `monthly_business_income` 스칼라 projection expression 격리 실행, **12조건 main 8/12, Draft #234 12/12**: 급여 2,000,000원만 존재하며 사업그룹 0개면 **main 문자열 `"0"`**, #234 `"[확인 필요]"`; 소득 0행/계산 0에서도 동일 허위 0; 급여그룹만 존재할 때도 main 0. **명시적으로 관찰된 사업소득 0원**은 양쪽 실제 `"0"` 유지; 사업소득 1,500,000원, 복수 사업소득 1m+2m=3m은 동일 정확. 사업원천 존재·그룹 누락, 인벤토리 incomplete, calc null, group null, 부분 그룹 null은 모두 보류. **`[확인 필요]` vs 법률상 `비해당` 표현은 사람이 확정**해야 한다.

`business-source-evidence.ts` actual `relevant` predicate V8 **8조건 보수적 검토 기대 main 6/8**. `observedState="explicit_none"`와 `amountWon="1000"` 또는 `"0"` 상충인데도 review 집계에서 제외(false negative)되는 **읽기 전용 감사 필터 수준 결함 후보**. 정상 present1000, explicit_none+null, rejected, outside, unknown-period, present+null 조건은 기대대로 동작. 기존 Draft #34 검토 없이 중복 변경·자동 수치 인정 금지. 전체 원천 Fact 파서/실제 SQL 경로 결함으로 확정한 것은 아님.

독립 BigInt **순수 산술 예시**: 합성 월매출 `3,000,000` − 합성 필요경비 `1,000,000` = `2,000,000`원/월, 단순 36/48/60개월 곱 `72,000,000 / 96,000,000 / 120,000,000`원. **그 어떤 금액도 법원 적격 순소득·변제금/기간·인가 확정값이 아님**.

## ID별 미인증 및 다음 조치
- `A2-LAW-015` [ ]: **PDF 부칙 원문 확인 완료**, 그러나 사건별 최초접수증 Fact/승인/판본 계약 0·실제 적용 미인증.
- `A2-LAW-019` [ ]: 서울 null/무효 관할을 타관할로 확정 금지, Draft #230 17조건 보수적 수용; Node·실제 법원 관할 증빙 미인증.
- `A2-LAW-021` [ ]: 서울회생법원 **2026-09-23 개정·10-01 시행·최초접수 적용**, 법 **10-02 시행**, 국세청 과세기간 원문을 각각 분리. 변호사 공식 적용 판단 미인증.
- `A2-LAW-022` [ ]: 급여만 있는 사건의 D5103 사업소득 허위 0원 V8 재현, #234 기술 표시보류는 법률상 비해당 판정 아님. Word·법원 공식서식·법률 승인은 미검증.
- `A2-LAW-024` [ ]: source-only VAT/사업비용의 `explicit_none+금액` 상충을 거짓 제외하는 검토 필터 후보 발견, 실제 `null`, 명시적 `0`, `비해당`, `blocked` 및 사람 승인 구분하여 후속 검수; DB/산식 실제 end-to-end 미인증.

**수정/병합:** 제품 코드 변경 **0**, 신규 제품 테스트 커밋 **0**, 이미 존재하는 Draft #230/#234/#34를 독립 재검증만 함. **이 회차 영수증과 보드 5 ID만 main에 보존병합**. 실제 Node 프로젝트 테스트/전체 CI, staging D1/R2/Cron, 18모듈 모든 입력·출력 실행/SQL 재독, 실제 D5103/D5106/D5110/D5111 DOCX 생성·바이트 재독·법원 공식서식 동등성, 변호사/계산사무장 최종승인 **모두 미실행**. 실제 고객문서/개인정보/원본 OCR 사실값/키/.env/정답 저장 없음. 운영 배포/운영 마이그레이션/실제 전자제출/인가 확정 없음.
**다음 r121 데이터담당자**: 법원 **최초 접수증** 문서 유형·원천 Fact(사건/관할/접수일/증빙문서/접수순서)→typed→SQL feature→`firstFilingDate`의 별도 사람 승인 계약 설계. #225→#226→#230 통합 Node 검증, #234와 #34 충돌 회귀, VAT·종소세 중복 및 blocked→임시 0→D5103/D5110 종단검증. 모든 미검증 ID는 [ ] 유지.
