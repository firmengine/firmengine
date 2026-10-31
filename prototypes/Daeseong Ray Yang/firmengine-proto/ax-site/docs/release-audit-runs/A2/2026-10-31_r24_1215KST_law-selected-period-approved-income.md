# FirmEngine A2 r24 — 변호사: 대표기간 없는 '승인 월소득' 표시·법원 준칙 적용 경계

- 감사 시각: 2026-10-31 12:15 KST 시작, main 초기/변경 전 HEAD `7b242d2743976ae8e32fa65b0b071ad6ea39a94b`; 기존 r23 계산사무장 → **r24 변호사** → r25 데이터담당자.
- 감사 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 제품 변경은 기존 Draft [PR #76](https://github.com/firmengine/firmengine/pull/76)에만 존재하며 main 병합·운영 배포 없음.
- 선택 ID **A2-LAW-011 / A2-LAW-014 / A2-LAW-015 / A2-LAW-022 / A2-LAW-023**. 모두 **부분 검증, [ ] 유지**, 법률·회계 적합성 전문가 미인증, 제품 인수 완료 **0건**.
- 읽은 실제 자료: main HEAD/최근 커밋/PR #58 #67 #71 #76, 중앙 보드와 r23 영수증, `lib/assessment.ts`(`ee0f12b`), `lib/form-mapping.ts`(main `514bb4a`), `lib/document-preflight.ts`(main `dc771c0`, PR #58 `560935b`), `lib/domain.ts`, `lib/form-contracts.ts`, `drizzle/0011_case_calculation_features.sql`, `lib/reference-decision-tables.json`, `lib/template-token-catalog.json`, 기존 PR #76 Node 합성 테스트.

## A2-LAW-011 / LAW-022 / LAW-023 — P1 원천기간 미선택에도 승인 월소득 표시

- main `buildFormBindings`의 `approved_monthly_income` 조건에는 `data.context.filingPeriod` 존재 검사가 없었다. `calculateCase`는 대표기간 미선택 시 `INCOME_REPRESENTATIVE_PERIOD_NOT_SELECTED`를 기록하지만 다른 증빙·검토 조건이 참이면 관측 평균을 서식의 **approved** 토큰으로 표기할 수 있다. main과 기존 PR #76의 실제 조건식 모두 같은 결함.
- 합성 입력: `filingPeriod=undefined`, `incomePeriodReviewed=true`, `inventoryComplete.income=yes`, 소득 행 `monthlyWon="2400000"`, 근거 Fact 한 건, 해당 소득원 `recognition=accepted`, `factSourceLineageIssues=[]`. **독립 기대:** `approved_monthly_income="[확인 필요]"`, 원천 월별 프리뷰는 삭제하지 않음. **main/수정 전 PR #76 실제 조건식:** `"2,400,000"` (기대 불일치).
- **수정:** 기존 Draft PR #76의 `lib/form-mapping.ts`에 `!!data.context.filingPeriod` 승인 전제만 추가. 법률상 대표기간을 선택하지 않고, 계산 평균/법원 인정 산식을 변경하지 않음. 코드 커밋 `57c396f966847b44cafe9c0832ca0d2ec032a648`, 후속 합성 Node 테스트 추가 커밋 `ed3636d823969283502ee25e3e7af58999c4c4c3`. 별도 main 코드 수정 없음.
- **실제 실행한 시험:** main과 PR #76의 *실제 코드 조건식*을 추출해 V8 격리 수행. 합성 7조건: 기간 미선택(수정 전 실패, 수정 후 차단); 선택·승인된 240만원(유지); 선택·승인된 명시적 0원(0 유지); 끝단 미관찰로 계산 null(미확정); 담당자 미검토(미확정); 출처 충돌(미확정); 목록 미완료(미확정). **main/PR 수정 전 6/7 → 수정 후 7/7** 독립 기대와 일치. 실제 `buildFormBindings()` 전체 실행이나 Node 프로젝트 회귀·D1/Word 생성 **아님**.
- PR #76 `tests/a2-r23-filing-window-month-form.test.ts`에 12개월 가상 소득이 있더라도 대표기간 미선택이면 승인 토큰을 차단하는 Node 테스트 1그룹 추가. **테스트 코드는 작성하였으나 정식 Node 테스트 자체는 미실행**. PR 재조회: 두 변경 파일 모두 허용 경로 안; Draft·미병합.
- 상태 구분: **원천 관측 2,400,000원 = source-only 프리뷰**이며 **법률상 승인 월소득 = 미확정**. 관측 0과 null, 관측 외 월, 사실상 무소득·휴직/누락은 별개.

## A2-LAW-014 / LAW-015 — 변제기간·공식 출처

- **국가법령정보센터 직접 재확인 2026-10-31**: 「채무자 회생 및 파산에 관한 법률」 [시행 **2026-10-02**] [법률 **제21490호**, 2026-03-24 타법개정], 제611조 제1항(재산·소득·채권변제) 및 제5항(원칙 3년, 법률상 특별사정에서 최대 5년). https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777
- **서울회생법원 공식 보도자료 직접 재확인 2026-10-31**: 게시 **2026-10-01**, 실무준칙 제424호 **제2조 제2항 제7호 신설**. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . **첨부 PDF 개정전문/부칙·경과조치·관할별 사건 적용일 미열람**, 제7호 세부 요건 자동규칙 반영 **금지**. 2026-10-01 공지일과 사건별 효력 발생일은 동의어가 아님.
- **국세청 공식 안내 직접 재확인 2026-10-31**: 일반과세자 VAT 과세기간 6개월, 간이과세자 통상 1년 등 구분. https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574 . VAT 신고 매출, 종합소득세 소득금액, 변제재원 인정금액은 분리해야 하며 이번 PR은 세무/회계 계산 변경 없음.
- 독립 BigInt 산술 참고(법률상 승인 아님): 240만원×12개월=2,880만원; 11개월=2,640만원(차액 240만원). 월 240만원−생활비 140만원=월 가용 100만원일 때 36/48/60회 명목 총액 3,600만/4,800만/6,000만원. 사업매출 300만원−경비 100만원=산술 프리뷰 200만원(별도 VAT·종소세 이중 차감·법적 인정 없음).

## D5103 월별 증빙과 인수 남은 경계

- **실제 PR #58 D5103 사전검증 코드 블록 V8 추출 실행**(공통 numeric 모의, 형식 바깥 계약/해시/법률산식 모의로 격리): 12개월 정상, 중간 6월 누락 `D5103_MONTH_COVERAGE_GAP`, 0행 `D5103_MONTH_ROWS_MISSING`, 명시적 0원 보존. **1~11월만 존재/첫 월 누락은 개별 D5103 코드만으로 감지하지 못함**(예상기간 입력 없음). main에는 중간 누락도 자체 코드 미존재. 실제 `calculateCase`에는 대표기간 대비 개월수 부족을 `INCOME_PERIOD_COVERAGE_INCOMPLETE`로 보고하여 전체 월소득 null 처리하는 코드가 **정적으로 존재**하나, 이 계산 경계부터 D5103 최종 생성까지의 **실제 종단 실행 미검증**.
- 계산 등록명세 main `6924e397`: **18모듈/입력 선언 91(고유 78)/결과 경로 42**; 토큰 카탈로그 `899c4d56`: **D5103 37·D5110 55·D5111 82**. 정적 재파싱만 확인. 91입력→Fact/typed→SQL feature→42출력→DOCX 토큰 전체 값 대조 미인증.
- 스키마 `0011`의 `value_json TEXT NOT NULL`, `value_won TEXT NULL`, status·source refs 분리 코드를 재확인했으나 실제 SQL INSERT/SELECT·staging D1/R2·Word 바이트 검사 미실행.

## 다음 r25 데이터담당자 실행항목

1. PR #76 신규 Node 테스트 **실제 실행**, PR #58/#67/#71 동시 결합 회귀 및 타 브랜치 변경 충돌 확인. 이번 7/7은 V8 **부분식** 격리이며 전체 Node/CI가 아님.
2. 대표기간 2026-01~12 중 2026-12 누락·첫월 누락·중간월 누락·실제 무소득 월 0의 원천→Fact→typed→`calculateCase`→D5103 preflight E2E. 특히 미관찰/0/비해당/상충/source-only/승인전 상태를 분리.
3. 복수사업자/겸업 급여/VAT/종소세 이중계산, 채권·청산가치, 원단위 배분 및 36·48·60개월 법률 승인 경계; 정식 실무자 검수·공식 서식/개정 PDF 효력 확인 후에만 합격.
4. 현재 제품 인수 **0건**; 운영 배포·운영 D1 migration·실제 전자제출·법원 인가 확정 없음. 고객 문서/OCR 사실값/.env/키/비공개 정답 저장 없음.
