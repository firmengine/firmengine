# FirmEngine A2 r100 — 사용자·서류담당자 / 계산금액 표시문자와 원천계보 오연결

- 2026-11-03 KST. 역할순환 r99 **IT담당자** → r100 **사용자·서류담당자** → r101 **계산사무장**.
- 허용 디렉터리 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 인수 단일 보드 우선, **A2-DOC-002 / 004 / 016 / 018** 네 ID 모두 [ ] 유지.
- 시작 main HEAD `238baaf09858621e0dfbbd148a324e994d1060b5`, 영수증 작성 직전 재조회 HEAD `238baaf09858621e0dfbbd148a324e994d1060b5`. 운영·전자제출·운영 D1 migration 금지.
- 원문 재독: `lib/lawgraph-document-field-projection.ts` main blob `a017294aa814f4d33360c2531abf91d9eb79a6e0`; `lib/document-preflight.ts` `dc771c0ff0497d24df19478b0366ebbb397bfbf2`, `lib/form-contracts.ts` `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef`, `lib/form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; `tests/lawgraph-document-field-projection.test.ts` `63e1b89a02c0235f0106fd7eec69d1f936da2ec5`; r94/r99 영수증.
- 최근 main/A2·타축 커밋과 Draft #200/#212(채권 행·숫자), #205/#207(Fact owner/subject), #209(run owner/version), #219(provisional) 조회. 투영 파일은 #205/#207/#209/#219와 중첩되므로 **[Draft #220](https://github.com/firmengine/firmengine/pull/220) 병합 HOLD**.

## 1) P1 후보 및 수정안

main `projectLawgraphDocumentFields()`의 계산피처 연결은 `sameValue`가 모든 쉼표·공백·₩·원 문자를 제거해 비교하므로 실제 표시 `"1,20"`을 저장 `"120"`과 같은 원화로 인정한다. 두 값이 똑같이 잘못된 `"1,20"`이어도 JS `a===b` 때문에 정상 linked로 승격되고, 불안전 숫자형을 허용한다. 이는 **원천 인정/법률상 유효성 입증이 아닌 기술적 lineage-status 오표시 위험**. #200의 strict preflight는 별도 경로.

신규 Draft #220: `lib/lawgraph-document-field-projection.ts`의 **computed/provisional 계산금액 비교 부분에만** 잘 형식화된 원단위 정수/천단위/통화표기를 BigInt 안전 비교하는 `sameComputedWon` 적용. source Fact의 별도 텍스트 비교·저장금액·수치 계산·법률상 인정 상태는 변경 없음. 해당 대상 금액 비교 실패는 source-only 가상 fixture에서 `lineage_review_required` 및 수동검토로 남는다. **코드 별도 브랜치, main 제품코드 미수정**.

## 2) 합성 입력/독립 기대/실제 관찰

- 원문/OCR 고객문서 **사용 없음/미관찰**. Fact는 `"SYN-REF"` 문자열 참조만, 실재·동일사건·승인 **미검증/source-only**. Typed 출력 바인딩 D5103 `monthly_income`, 저장형 합성 계산피처 `outputName=monthlyIncomeWon, status=computed`; SQL/D1 직접 INSERT/SELECT **미실행**. 실제 Word ZIP bytes/변호사 승인 **미실행**.
- 독립 기대: 정확한 원단위 정수만 같은 수로 링크(단위/정상 쉼표 차이는 허용), null·미관찰·부정확한 숫자표기·unsafe Number는 **링크 보류**. 숫자 타입/표시의 법률상 인가는 별도.
- 실행: **GitHub 실제 main/branch helper 식을 그대로 추출해 TypeScript 표시만 제거하고 V8에서 16개 직접 실행**. 독립 기대 main **10/16**, Draft #220 **16/16**. 이것은 `projectLawgraphDocumentFields`의 전체 호출, 실제 프로젝트 Node/CI/Cloudflare/DOCX 검사가 **아님**.
- 세부 독립 기대/관찰: 성공 6종 (`120=120`, `1,200원=1200`, `₩ 1,200원=1200`, 문자열0, 숫자0, 음수 -100), main/branch 모두 6 PASS. 거부 10종 중 main의 6개 오승격: `1,20=120`, `1,20=1,20`, `1,,200=1200`, `1 200=1200`, `12.5=12.5`, `unsafe Number=같은 큰값 문자열`. 4개는 양쪽 모두 거부(`1e3=1000`, `null=0`, `blank=0`, `0012=12`). Draft 전부 거부.
- `tests/a2-r100-doc-won-display-lineage.test.ts` **16개 합성 Node 테스트 + TODO 3개 작성·커밋**만. 프로젝트 Node runner **미실행**. 코드는 GitHub PR 리뷰 필수.
- 독립 BigInt 명목총액 `900000 × {36,48,60}` → `{32,400,000;43,200,000;54,000,000}` 원. 이는 현재가치/세금채권 배분/법원 인정 변제액 아님.

## 3) 계약·공식출처 확인

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 직접 JSON 집계: **18모듈, 입력선언91(고유78), 출력42(고유40), 결과경로42**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5106 48 / D5110 55 / D5111 82**. 전체 18개 계산실행·42 출력 저장/재독은 **미실행**.
- 서울회생법원 [2026-10-01 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187) 제424호 제2조 제2항 제7호 신설; [실무준칙 공식 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf), 부칙(2026-09-23 개정): **2026-10-01 시행·이후 최초 접수 사건 적용**, 기존 인가계획 효력 유지. PDF p391 부칙 페이지 이미지 재확인. 법원은 **서울회생법원**으로 한정, 사건별 관할·최초 접수 증빙·변호사 승인 전 법률 확정 금지.
- [법제처 법 제21490호 / 시행 2026-10-02 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR)와 [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR) 원문 읽음. 기간·우선채권/재단채권·인가의 법적 기준은 기술적 lineage 연결과 별개.
- [국세청 VAT/종소세 공식 안내](https://t.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반 6개월, 간이 통상 연간 부가세, 종소세 연간 과세. VAT 신고매출/종소세·입금·급여를 자동 월 순소득으로 이중 합산하지 않음. 이번 회차 실제 월별 소득 수집·계산 **미실행**.

## 4) ID별 상태 및 이어받을 항목

- **A2-DOC-002 [ ]** 채권자 0행+비영 합계 false-ready는 #212 미병합, #200 malformed row 숫자 경계 미병합. 이 회차 직접 read-only diff 비교만; 원천 Fact→복수채권 D5106/D5110/D5111 실제 출력 검증 미완료.
- **A2-DOC-004 [ ]** D5103 계산 월소득 표시 `1,20` vs 피처 120 오연결 재현; #220 기술적 격리 개선. 급여·사업소득 실제 월별/소득원·세금관계 인수 미완료.
- **A2-DOC-016 [ ]** 숫자0와 null/빈값·잘못된 그룹/unsafe Number 구별 **V8 helper 16건**; 실제 상태구분 SQL→Word 통합 미완료.
- **A2-DOC-018 [ ]** 정적 등록 토큰 재독만. 생성 DOCX ZIP/XML 수치·행·문단 및 공식 e-form parity **미실행/미인증**.
- **다음 r101 계산사무장:** #220/#219/#209/#205/#207와 #200/#212 실제 diff 통합·Node+tsc, SQL run owner/Facts, 36·48·60 월 배분/세금·재단·우선채권, D5103/6/D5110/11 출력 실물 readback. 병합, 최종 문서 승인 전 HOLD.

**코드 존재 ≠ V8 합성 단위 ≠ Node·CI ≠ staging D1/R2/Cron ≠ DOCX 생성/재독 ≠ 법원 공식서식 동등성 ≠ 서류담당자·변호사 승인 ≠ 법원 인가.** 제품 최종 인수 0건, 개인정보·원본OCR·키/env·비공개 정답 공개 Git 없음. 운영 배포/운영 DB 마이그레이션/전자제출/인가 확정 **미수행**.
