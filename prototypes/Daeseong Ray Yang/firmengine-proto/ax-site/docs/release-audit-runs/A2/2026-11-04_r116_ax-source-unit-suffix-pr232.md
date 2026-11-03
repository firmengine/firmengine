# A2 r116 — AX담당자 | OCR 원단위 접미사와 추출 단위 상충

- 2026-11-04 KST 약 08:20. 역할 순환 r115 DATA → r116 AX → r117 IT. 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 엄수.
- 시작 main `294553f5b526c9eca730c6c51f6a50dd8059139d`; 감사 영수증 쓰기 직전 main `294553f5b526c9eca730c6c51f6a50dd8059139d`. 보드 초기 blob `feebe717c59d2f5938d03d19b34aa8767fd3317e`. #231(부모)와 #60 및 이전 r115 영수증 재독, 최근 main 커밋·미병합 PR 확인.
- 재독 blob: main domain.ts `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; #231 domain.ts `8af6c5d87a207100ed13ee76ea369cd662c384b3`; source gate ocr-calculation-input.ts `8f7f51bf41f7c944b76419d7cc894e49ac771473`; 계산 feature store `bb5f88b26e68f5ae2234741063ac9301a927e27a`; migration 0011 `0caa359d250dce45765d269d271ad63170ec3efa`. 기준표 `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`; 서식 토큰 `899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- 체크 ID: `A2-AX-002`, `A2-AX-004`, `A2-AX-008`, `A2-AX-015`. 모두 [ ] **부분 기술검증**. 제품 인수 0. 모든 예시는 SYN 합성. 실제 고객자료, 개인정보, 원본 OCR, 비공개 정답, 키/.env 비저장.

## 결함, 독립 기대, 실제 관찰

[Draft #231](https://github.com/firmengine/firmengine/pull/231)에는 OCR 쉼표 그룹 정규식 보강이 있으나 원문 `1,234원`에 외부 추출 `unit="만원"`이 들어오면 `normalizeMoney()`는 `12340000`원 exact로 출력한다. 명시적 원화 접미사와 만원/천원 등 배율 단위는 상충하므로 독립 기대는 **invalid/null, 원문 유지, 수동 확인 필요**이다. main의 source OCR money gate도 이 정상형을 `issues=[]`로 통과시킨다. 실제 `1,234원`을 자동으로 `1,234`원으로 '수정'하는 것도 허용하지 않음.

| 합성 OCR 원문 / 추출 unit | 독립 기대 | #231 실관찰 | Draft #232 실관찰 |
|---|---|---|---|
| `1,234원` / `만원` | invalid/null, OCR issue | exact 12,340,000원 / [] | invalid/null / SOURCE_MONEY_NOT_EXACT_KRW |
| `1,234원` / `천원` | invalid/null, OCR issue | exact 1,234,000원 / [] | invalid/null / issue |
| `1,234KRW` / `million_won` | invalid/null, OCR issue | exact 1,234,000,000원 / [] | invalid/null / issue |
| `0원` / `만원` | invalid/null, 실제 0과 단위상충 분리 | exact 0원 / [] | invalid/null / issue |
| `1,234원` / `KRW` | exact 1,234원 | exact 1,234원 | exact 1,234원 |
| `1,234` / `만원` | exact 12,340,000원 (단위 메타정보만) | exact 12,340,000원 | exact 12,340,000원 |
| `0원` / `KRW` | exact 0원 | exact 0원 | exact 0원 |
| null / KRW | missing/null | missing/null | missing/null |
| `1,20원` / KRW | invalid/null | invalid/null (#231 guard) | invalid/null |

실제 GitHub의 `normalizeMoney` 및 `calculationSourceCellIssues` 원본문을 추출하여 TS 타입 선언만 제거한 V8 격리함수에서 독립 기대와 대조: 18건 `normalizeMoney`: #231 **13/18** vs 후보 **18/18**; 18건 `calculationSourceCellIssues`: #231 **13/18** vs 후보 **18/18**. 처음 22개 확장 합성점검은 main 13/22, #231 17/22, 후보 22/22. 후보 코드를 **커밋 후 GitHub에서 재조회**하여 18+18 재실행, 전건 독립 기술 기대와 일치. 이는 제품 Node/CI나 모델·OCR 실제 문서시험이 아니다.

## 코드 변경 / 충돌보류

- [Draft #232](https://github.com/firmengine/firmengine/pull/232): 부모가 미병합 #231인 **stacked Draft**, main 제품코드는 불변. 브랜치 `audit/a2-r116-ax-explicit-unit-conflict-20261104` HEAD `271f6bf2fc57bc07b84521bb13d52317ae25dba2`.
- `lib/domain.ts` 커밋 blob `93a99efb76bfeef61b57f3e5b2430a655d6165b7`: 원문 접미사 원/KRW와 unit 메타값 간 배율 상충이면 `normalizationStatus=invalid`, `amountWon=null`; 원문은 보존. 법률상 승인금액·세무·원장 계산 변경 안함.
- `tests/a2-r116-money-source-unit-conflict.test.ts` blob `97c9dd1f849a85c6175d87203252754134b00d68`: 18 norm + 18 OCR Node 회귀 케이스 **작성·커밋만, 프로젝트 러너 미실행**. 소스 게이트 #60과 변경중복·모듈 회귀는 추후 통합시험.
- 잠재 법률/금액 의미 확대 위험: 회계 담당자가 원문에서 접미사 '원'과 meta unit의 우선순위를 정하고 변호사가 인정여부 결정. 자동 '원'→만원 교정 금지. #225/#226/#230 서울424 최초접수 증빙 미연결 및 #43/#223/#229 차단원장 0원 충돌은 **미해결**.

## 정적 계약/독립 산술

- `reference-decision-tables.json` 파싱: 계산모듈 18, 입력 선언 91(고유78), 출력 42(고유40), resultPaths 42.
- `template-token-catalog.json` 파싱: D5103=37, D5106=48, D5110=55, D5111=82 토큰. 실제 DOCX·서식 재독 아님.
- SYN 사업소득 월 매출 2,000,000원/비용 500,000원 ⇒ 단순 순액 1,500,000원. 36/48/60개월 원단위 독립산술 54,000,000 / 72,000,000 / 90,000,000원. 현행 calculateCase 실행/소득 인정/세법 적합성·변제기간 인가/청산가치 대조는 아님.
- SQL 0011과 피처 저장원 코드 정적 재독만 수행. 실제 Fact→typed→SQL→42출력 및 D1/R2/Cron·Word 출력 **미실행**. SQL 사용한 금액의 승인 상태는 미확정.
  
## 공식 기준 (2026-11-04 조회)

- 서울회생법원 **2026-10-01** 공식 보도자료 `개인회생 변제기간 단축 대상에 관한 실무준칙 개정`: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 — 제424호 제2조② 제7호 신설 확인. **개정전문 PDF 부칙·최초접수 적용일 이번 회차 직접 재독하지 못함**. 2026-09-23 개정·2026-10-01 시행·최초접수 관할 적용은 과거 영수증에 있으나 이번 확인 완료로 바꾸지 않음.
- 법제처 법률 제21490호, **시행 2026-10-02** 채무자회생법 제611조: https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR ; 제614조: https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR . 법률상 인정/법원인가 불추론.
- 국세청 VAT 과세기간: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574 ; 일반과세자 6개월, 간이과세자 원칙적 1년. 신고매출·종합소득세 신고액을 승인 월순소득으로 자동 산입하지 않음.

## 다음

r117 IT: #232+#231+#60 결합 실제 Node22 전체 회귀; 급여·사업·VAT·종소세·채권·재산 파서 소비처 영향; 0/null/invalid 및 source-only/approval lineage, #225→#230 최초접수 Fact 소유, #43/#223/#229 차단 원장의 SQL/서식 차이. staging D1/R2/Cron, 전체 CI, 실제 DOCX/공식 법원서식·변호사/계산사무장 최종승인은 **미실행/미인증**. 운영배포/실제 전자제출/인가 확정 없음.
