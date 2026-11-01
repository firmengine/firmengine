# FirmEngine A2 58차 — 사용자·서류담당자: 공개서식 미확정 토큰의 누락·null 렌더링 예외

- 2026-11-01 KST / **사용자·서류담당자**. 직전 r57 IT, 다음 r59 계산사무장. **인수 완료 0건**, 법률/세무 적합성 미인증.
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래 A2만. 감사 시작 main HEAD **`f20ae31759ec8799ac1a10676f07acde80ad18d0`**. 중앙 보드 blob `05dab4271219950e92d6920969ad3c0ad8d1d55d`. 이번 ID: **A2-DOC-015 / A2-DOC-016 / A2-DOC-018 / A2-DOC-020** — **모두 [ ] 부분검증**.
- 실제 읽은 메인: `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e` L270–274, `lib/document-writer.ts` blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`, `lib/document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`, `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`.
- 기존 영수증 r52 [D5103/D5110/D5111 합본](2026-11-01_r52_1607KST_doc-threeform-lineage-pr130.md) 및 r57 [Fact 계보](2026-11-01_r57_2113KST_it-producer-fact-lineage.md), 미병합 Draft [#130](https://github.com/firmengine/firmengine/pull/130) 및 [#138](https://github.com/firmengine/firmengine/pull/138) 재독. 기존 PR 기능을 덮어쓰지 않음.

## 1. 소스 기반 재현 — 공개 서식 provenance 허위 누락

`renderPublicForm()`의 실제 토큰 치환식은 `undefined`, `[확인 필요]`, `[불일치...]`만 `provenance.unresolvedTokens`에 기록했다. **`[미관찰]`, `[상충]`, `[누락]`, `[검토 필요]`, `source-only` 같은 미확정 상태를 Word에는 기재하면서도 미확정 토큰 목록에는 기록하지 않는 결함**이다. 런타임에 잘못 들어온 scalar `null`/숫자 `0`은 `.startsWith`에서 `TypeError`. 금액이 법원에 잘못 제출된 실제 사건을 관찰한 것은 아니다.

독립 기대: 보이는 0원 문자열 `"0"`은 유효 관측값, `null`/타입이 다른 숫자 `0`은 미확정, `[해당없음]`은 비해당, `[상충]`은 상충, `source-only`는 승인 전. 두 범주의 저장/출력 상태를 합치거나 금액을 자동 인정하지 않는다.

**실행한 소스 함수 격리 V8**: main L270–274의 치환식에서 TypeScript 타입 표기만 제거. 12개 합성 `{{field}}` 입력/독립 expected 문자열·미확정 여부 검사에서 기존 **6/12 일치**, 4개 미확정 허위 누락 + null/숫자 0의 TypeError 2개. 후보치환식 **12/12 기대 일치**. 합성 입력 일부: `"2400000"`→정상, `"0"`→정상, `"[미관찰]"`→미확정, `"[상충]"`→미확정, `null`/숫자 `0`→`[확인 필요]` 및 미확정. 실제 Word XML/전체 렌더러 실행은 아니다.

## 2. 수정 후보 / 실행 검증

별도 [**Draft PR #141**](https://github.com/firmengine/firmengine/pull/141) (main 기반, **미병합**). `lib/form-mapping.ts`의 `classifyPublicFormToken(value:unknown)`이 미관찰·상충·원문만/source-only·승인전·불일치 등 상태를 표시된 문자열 그대로 유지하면서 `unresolvedTokens`에 표기한다. null/비문자값/공백은 `[확인 필요]`로 표시하고 미확정으로 유지한다. `[해당없음]`과 명시적 문자열 `"0"`은 미확정으로 전환하지 않는다. 실제 렌더 함수의 치환문에서 이 helper 사용. 계산·법률 인정·신고서식 금액 산식 변경 없음.

- main 원본 blob `514bb4ad...` → 변경 blob **`fed97085b02e95dc9d81024dc19f1550c087f46b`**. GitHub 변경 커밋 `476707d5c38aa830fc6b26293c5e350c1925d00a`.
- GitHub 후보 blob 함수 본문을 그대로 추출한 **V8 격리 17/17** 기대 일치.
- 독립 **Node v22.16.0**에서 해당 helper 로직으로 **24/24 합성 상태** 기대 일치 (2,400,000원, 0원, 비해당, source-only, null, 배열, 상충, 승인전 등). 이것은 **프로젝트 Node 테스트 러너가 아닌 독립 helper 시험**.
- 프로젝트 `tests/a2-r58-public-form-unresolved-token-classification.test.ts` 신규 4 test 그룹 **작성·커밋만, 실행 안 함**, 커밋 `72ddd0872c02abab7148218205b746b92fdab462`.
- PR 변경파일 2개 전부 ax-site 허용 경로. 전체 CI/실제 DOCX/공식 서식 동등성 및 변호사/계산사무장 검수 **미실행·미인증**.

## 3. 독립 금액·SQL·정적 계약

- Node BigInt 독립 오라클: 급여 **2,400,000×12=28,800,000원**, 사업순소득 **1,000,000×11=11,000,000원**, 관측 합계 **39,800,000원**; 사업 12월은 `null` 미관찰/보간 금지. 월 900,000원 × **36/48/60** = **32,400,000 / 43,200,000 / 54,000,000원**. **18개 계산 엔진 실행 성과가 아님**.
- main 0011과 같은 테이블/인덱스 DDL + 합성 `cases` FK stub에서 **SQLite 인메모리 4행 INSERT/SELECT 재독 4/4**, `foreign_key_check=[]`. JSON `"0"`/원화 `"0"` 보존, JSON `null`/SQL `NULL` 분리. 반면 JSON `null` + 원화 `"0"` 상태 `computed`와 잘못된 Fact ID JSON도 SQL 저장 허용; 의미적 정합성은 별도 검증 필요. **실제 D1·SQL 애플리케이션 저장재생 시험이 아님**.
- 실제 정적 JSON 재파싱: **18계산 모듈 / 91입력선언(고유 78) / 42출력선언(고유 40) / 42 결과경로(고유 42)**. D5103/D5110/D5111 토큰 **37/55/82**. 전체 입출력 실행 및 Word 본문 검증 아님.

## 4. 공식 법률·세무 경계 — 자동규칙 미승격

- 서울회생법원 **2026-10-01** 공지: [실무준칙 제424호 제2조 제2항 **제7호 신설**](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187). **공지 날짜와 사건별 시행/경과 적용일은 동의어가 아니다**. 첨부 개정전문의 부칙/경과조치·접수일·관할 적용은 미검증, 자동 규칙에 반영 금지.
- 국가법령정보센터: `채무자 회생 및 파산에 관한 법률` [시행 **2026-10-02**, 법률 제21490호], [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777) 변제기간 원칙 3년/특별사정 5년 이내, [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) 법률적합·공정성·형평성·수행가능성·청산가치 등 별도 인가. 산술/Word 생성과 법원 인가 혼동 금지.
- [국세청 공식 세무 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반 VAT 6개월/간이 1년 신고, 종합소득세는 연간 귀속소득 신고. VAT 매출과 월 인정순소득을 자동 동일시하지 않는다.

## 5. 보드 ID별 부분 판정 / 다음

| ID | 이번 독립 관찰 | 상태 |
|---|---|---|
| A2-DOC-015 | 미확정값 provenance 누락 및 타입 예외가 후속 초안/최종본 검증을 약화시킬 위험. 사전검사·writer 전체 통합/최종본 차단은 미실행 | **[ ] 부분** |
| A2-DOC-016 | `"0"` / 숫자 `0` / `null` / `[해당없음]` / `[미관찰]` 분리. helper 24/24 독립 Node | **[ ] 부분** |
| A2-DOC-018 | Word 토큰 치환코드 V8 격리 6/12→12/12, 실제 D5103/D5110/D5111 DOCX 바이트·공식 양식 미검증 | **[ ] 부분** |
| A2-DOC-020 | 내부 미확정/source-only 상태의 provenance 누락 후보 수정. 실제 첨부/부록·DOCX 내부 Fact ID 비노출/민감정보 유출 부재는 **미인증** | **[ ] 부분** |

**다음 r59 계산사무장:** Draft #141 helper와 #130 서식 승인/ #138 저장 Fact 계보의 통합 Node 22 시험, 실제 18×91→42 계산·SQL 재조회, D5103/D5110/D5111 Word ZIP/XML 숫자·source-only·0/null·부록 원천 ID를 검사. 사업매출/VAT/종소세 중복, 채권·재산·청산가치, 36/48/60개월 월별 배분·법률 시행일의 전문직 승인 경계 유지. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 미실행.
