# FirmEngine A2 r51 — IT담당자: 소득월 원천 Fact·행 식별자 재사용 검토 경계

- 점검시각: **2026-11-01 KST**. 직전 r50 AX담당자 → r51 **IT담당자** → 다음 r52 **사용자·서류담당자**.
- 작업 한정 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래. main 시작 HEAD **`c9b40dd07dd4193e3b0c726e0a1902f8f25037e8`**; A2 단일 중앙 보드 읽기 당시 blob **`28f20ca65e7e8d2bc0d47e117b784cd19cf4a9cf`**.
- 참고: 직전 r50 영수증, 최근 main 8개 커밋, Draft #106/#108/#113/#115/#117/#119/#122/#125/#127, main & stacked `form-mapping.ts`, `document-writer.ts`, `document-preflight.ts`, `income-period-coverage.ts`, 기존 r47/r50 테스트, migration 0011, 기준정보/서식 토큰 JSON 직접 읽음.
- 선택 체크 **`A2-IT-012` / `A2-IT-016` / `A2-IT-017`**: 모두 **[ ] 부분 검증**, 실제 제품 인수 0건. 사람의 법률상 인정·세무회계 승인·공식 서식 인증 없음.

## 1. 독립 합성 입력과 기존 코드 관찰

선택 기간 **2026-01-01~2026-12-31**, 소득원 `W`, 월 금액 **2,400,000원**, 월별 고유 Source ID `W-YYYY-MM`, 고유 Fact ID `fact-YYYY-MM`, review status `accepted`, source role `period_income_observation`, 월말 cutoff **2026-12-31**. 전부 **가상·합성**임. `source_id`·`source_stream_id`·`source_fact_ids`는 법원서식 공개 토큰이 아닌 내부 검토정보다.

동일 월·같은 stream에서 하나의 Fact를 복수행에 재사용하거나 같은 Source row ID를 재사용하는 경우는 *검증·중복 배제 없이* 이 검사만으로 `complete`를 반환해서는 안 된다는 독립 기대. 이는 실제 중복소득 확정이나 법률상 불인정 결정이 아니라 **추가 사람 검토 필요** 판정이다.

| 독립 조건 | 독립 기대 | #127 기존 코드 실제 V8 관찰 |
|---|---|---|
| 12개월 고유 Source row/Fact 12건 | `complete` | `complete` |
| 명시적 문자열 `"0"` 12개월 | 본 게이트 `complete` (0원 보존) | `complete` |
| 12월 누락 | `review_required`, gap | `review_required` |
| **1월 동일 소득원·동일 Fact 재사용** | **`review_required`** | **`complete` 오판** |
| **1월 Fact를 2월에 동일 소득원으로 재사용** | **`review_required`** | **`complete` 오판** |
| **같은 Source ID를 다른 Fact와 재사용** | **`review_required`** | **`complete` 오판** |
| **한 행의 `source_fact_ids`가 `fact-2026-01,fact-2026-01`** | **`review_required`** | **`complete` 오판** |
| 서로 다른 stream이 Fact 공유 | cross-stream review | 기존 검출 정상 |
| 서로 다른 두 stream이 모두 독립 Fact | 이 게이트 `complete` | `complete` |
| 원천 `unreviewed`, VAT gross role, 금액 `null` | 각각 검토보류 | 검토보류 |

**기존 소스 격리 실행: 12개 비교 중 8개 독립 기대 일치, 4개 불일치.** 실제 GitHub `income-period-coverage.ts` blob **`66f7bcaf73ac302add2dfd35b55333388fbb7d39`**에서 TypeScript 타입 주석만 제거하고 V8에서 **실제 함수 본문** 실행. 독립 조건을 사전에 정한 검증이며, 전체 계산 함수/SQL/Node 프로젝트 테스트 실행이 아니다.

독립 산술은 중복 행의 잠재 규모를 보여주기 위한 것일 뿐: **2,400,000원×12=28,800,000원**, 같은 1월 금액을 검증 없이 두 번 합치면 **31,200,000원**으로 +2,400,000원 차이가 난다. **실제 `calculateCase()`가 이를 이중합산했다는 주장 아님**; 기존 helper의 누락 검출만 확정.

## 2. 독립 수정안·검증 등급

- **Draft PR #129** https://github.com/firmengine/firmengine/pull/129 ; #127의 정확한 HEAD **`37f1768976e73c090315a5351b8f2f88b72eb236`**에서 새로운 별도 브랜치 `audit/a2-r51-it-duplicate-month-fact-20261101-1510` 생성. #127/#125/#122/#119 등 선행 PR은 미병합. #106은 별도 병합 후보.
- 세 파일만 수정: `lib/income-period-coverage.ts`, `lib/document-writer.ts`, `tests/a2-r51-repeated-fact-row-review.test.ts`. 바뀐 파일 모두 지정된 하위 경로임. 기존 다른 에이전트의 브랜치/파일을 덮어쓰지 않음.
- 월별 관측 helper에 `repeatedFactIds`, `repeatedSourceRowIds`를 별도 반환하고 `D5103_REPEATED_FACT_REVIEW_REQUIRED` / `D5103_REPEATED_SOURCE_ROW_REVIEW_REQUIRED`로 **검토보류**. 기존 cross-stream Fact 충돌, 월 누락, cutoff 미관찰, 명시적 0의 구분 유지. Writer 초안 경고/최종 차단에 사용되는 상세 메세지에 중복 ID를 보존.
- 후보 함수 V8 **14/14 독립 기대 일치**: 기존 반례 4종, 정상 고유 원천, 0원, 월누락, 두 소득원, VAT 자료, 미관찰 cutoff, 잘못된 금액, 역순 반복 검증 포함. 구체적인 관찰 상태는 PR 설명 참조. **실행한 것은 GitHub 코드 원본의 타입 제거 격리 함수이고, 프로젝트 Node/TS/CI가 아님**.
- 실제 작성한 **Node 테스트 소스 8그룹**은 GitHub `tests/a2-r51-repeated-fact-row-review.test.ts` blob **`c02bf287f0be923c47415c716cba8d09580ecc5c`**. **Node 테스트 러너로 실제 실행하지 않았으므로 PASS 취급 금지**.
- 실제 GitHub 재독 확인: 후보 helper blob **`ca2d05e83457186b1aca8774cbb53b0e1e9ab15d`**, writer blob **`35b66c5a5eab44026b2eefd4abd248ea24378f71`**. PR #129 Draft, HEAD **`7b39ca3ab308d472aaa4891b4b1b9eefa90f24e3`**, 변경 파일 3개만. **main 제품 코드 미병합**.
- 같은 Fact로 실제 여러 월을 정당하게 입증할 수 있는 업무상 예외(연간 자료의 월별 상세항목 등)는 가능하므로 **법률 불인정·자동 차감·삭제를 하지 않았음**. 이를 풀어주는 승인기간/원천 적합성은 변호사·계산사무장 검토 대상.

## 3. 실제 코드·저장형식·정적 계약 경계

- main `form-mapping.ts` 월별 공개 projection은 금액/월만 전달; Draft #127은 내부 `source_id`/`source_stream_id`/Fact/role/review를 추가. Draft #122은 내부 5필드의 `UNKNOWN_ROW_TOKEN` 차단 충돌을 별도 조정. 실제 DOCX 공개 누출/변경 여부는 바이너리까지 검사하지 않음.
- Draft #127 `document-writer.ts`는 **D5103**에 한하여 `checkSelectedIncomePeriodCoverage(... inspectSourceStreams:true)`를 호출. D5110·D5111 단독 생성 또는 타 PR #106/#104의 승인조건과 결합은 실제로 실행하지 않음. `prepareDocumentWrite` 전체/실제 `calculateCase` 및 원문→Fact→typed→SQL feature→문서 E2E 미검증.
- main `drizzle/0011_case_calculation_features.sql` blob **`0caa359d250dce45765d269d271ad63170ec3efa`**: `value_json` / `value_won` / `status` / `source_fact_ids_json`은 분리 저장. **이번 회차 SQL INSERT·SELECT/실제 D1은 실행 안 함**. 이전 회차의 `value_json=null`, `value_won="0"`, `status=computed` 의미적 모순 허용 위험은 미해결·전 회차 근거와 분리.
- main `reference-decision-tables.json` 실파싱: **18 계산모듈 / 입력 선언 91(고유 78) / 출력 선언 42(고유 40) / resultPaths 42**. `template-token-catalog.json`의 D5103/D5110/D5111 등록 토큰은 **37/55/82**, 공개 template 매핑 토큰 **35/53/80**, 공개 양식 `approval_status=reviewer_pending`. 숫자 세기 **정적 계약 관찰**로서 91개 입력별 실제 산식/DB 재독/서식 생성 인수 아님.

## 4. 공식 원문·법원·시행일·사건별 승인 경계 (2026-11-01 웹 재조회)

1. **국가법령정보센터** 채무자 회생 및 파산에 관한 법률 **[시행 2026-10-02, 법률 제21490호, 2026-03-24 타법개정]**, **제611조**: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 . 변제계획에는 재산·소득 및 채권변제 사항을 담으며 내부 월별 검증과 법률상 인가는 다름.
2. 동일 법률 **제614조**: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 법원이 판단하는 인가 요건과 산술 코드 `complete` 구별.
3. **서울회생법원** **2026-10-01 보도자료** https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 : **실무준칙 제424호 제2조 제2항 제7호 신설** 확인. **첨부 개정전문 부칙/경과조치와 개별 사건 적용일 미검증**. 공지일을 사건 적용일로 자동 채택하지 않음.
4. **국세청** 2026-11-01 재조회 https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 : 일반과세자 부가가치세 원칙 반기, 간이과세자 원칙 연간 과세기간. VAT 총매출/종합소득세 자료를 개인회생 월순소득으로 자동 인정하거나 배분하지 않음.

## 5. ID별 미완료 및 다음 회차

- **A2-IT-012 [ ]** 월행 순서 정/역 변경에서도 **같은 Source ID 및 Fact의 반복이 검토보류**됨을 후보 원본문 격리 대조. 행·sourceIds 직렬화/최종 해시/SQL 결과 전체 순서 재현성은 미검증.
- **A2-IT-016 [ ]** D5103 작성 전 입력의 중복 source Fact/row가 경고·차단용 코드 및 상세 ID로 전달되는 후보 경계를 정적 확인. 실제 API 값→42출력→3서식 숫자·DOCX 생성은 미실행.
- **A2-IT-017 [ ]** `document-writer.ts`의 D5103 final 블로커/초안 경고 분기를 재독하고 후보 경고 상세를 연결. 문서 전체 실행 및 D5110/D5111 단독 생성 경로는 미실행; 법률 인가 불추론.
- **다음 r52 사용자·서류담당자:** Draft #129를 #106의 삼중서식 사전검사와 비교, #96/#97/#98/#102 중복·승인 게이트 및 이직·휴직·계절사업의 사람 승인기간 검토. 반례가 실제 `calculateCase()`에서 중복 산입되는지는 **반드시 별도 실행 검증**, 증빙 Fact가 같은 경우의 합법적 재사용/분할 기준 승인 전 일괄 불인정 금지. SQL feature 원화/JSON/Fact shape와 D5110/D5111 승인소득 최종본 게이트 연결 검증.

**결론: 제품 인수 0건.** 이번에는 V8 함수 격리실행과 GitHub 코드·계약 정적확인만 완료. 전체 Node·CI, staging D1/R2/Cron, 실제 DOCX/공식서식 동등성, 변호사·계산사무장 승인 각 미인증. 운영 배포, D1 운영 migration, 전자제출, 법원 인가 확정 **모두 실행하지 않음**.
