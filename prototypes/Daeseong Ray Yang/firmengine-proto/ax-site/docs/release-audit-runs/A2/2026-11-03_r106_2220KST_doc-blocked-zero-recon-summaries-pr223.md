# FirmEngine A2 r106 — 사용자·서류담당자 / blocked 원장 총계의 가짜 0원 표시 차단

- 작성 2026-11-03 22:20 KST. 순환: r105 IT담당자 → **r106 사용자·서류담당자** → r107 계산사무장. 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 이번 조회 main 시작 `b9873ddbf8f95f701afa46fc11d3f55b210d974f`, 본 영수증 작성 직전 최신 검색 `b9873ddbf8f95f701afa46fc11d3f55b210d974f`. 중앙 보드 원본 blob `e4618cb43ea204e66cff17ced83a5fe93e08b78c`(업데이트 직전 다시 읽어 병합). 기존 [r105 원장/zero placeholder 영수증](2026-11-03_r105_it-ledger-failclosed-zero-sentinel-integration.md) 연속 검증. 최근 A1/A3 main 커밋과 Draft #43/#50/#194/#203/#215/#219/#220/#222 확인.
- 실제 main 원본문/blob: `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, `lib/document-annexes.ts` `9041330c95858390647d355cc3d1cbdbcab76b47`, `lib/exports.ts` `699411b5b20a4a4558761d3015d8827797c7991f`, `lib/office-writer.ts` `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`. Draft #50의 annex 수정 원본문/blob `42b2f77cefa5c79f575c11fa2b7ae9f65fb70c1d`, 이번 수정 후 `f96fad1409a3681fffb5789a49e6a572a89ffb7c`.
- 실제 연결 정적 재독: `exports.ts:119-123, 175-181` → `repaymentPlanLedgerAnnex` → `office-writer.ts:196-225`에서 재구축 및 생성 DOCX 표 재독 로직이 **존재**. DOCX를 생성/재독하여 이 경로 전체 성공 관찰한 것은 **아님**.

## 1) 실제 합성 입력/독립 산술 기대/관찰

검증의 유일한 고객 데이터는 없음. 합성 구조: `context.planMonths`=36/48/60, 채권 `SYN-D`, 월별 원장 각 회차 원금 `"1"`원, 이자/기타 `"0"`, 잔액은 `term-installment`, `unallocatedBudgets[month+":disposable_income"]="0"`; 모든 원화 값은 문자열, `0`은 **실제 관찰 0** 대조 케이스에서만 사용. 원장 합계에 대한 외부 독립 산술 기대: 원금 1원 × 36/48/60 = **36/48/60원**, 각각 36/48/60행. 조작한 `reconciliation.totals.*="0"`는 계산 차단시 사용한 **placeholder 0** 또는 의도적 stale 응답일 뿐, 진짜 0이 아님.

실제 GitHub main의 `repaymentPlanLedgerAnnex` 함수본문(TypeScript 선언 일부만 제거) V8 격리 실행: (1) 잘못된 원금 `"1,20"`+blocked에서 **SyntaxError: Cannot convert 1,20 to a BigInt**. (2) 유효 원금 5원+reconciliation blocked, `totals.*="0"`에서 annex 상태는 blocked이나 행 원금 5원과 합계 총액 0원이 **같은 표에 나옴**. (3) 명시적 0원 행은 0원 유지. (4) blocked 빈 행은 예외 없이 차단. 원본문 추출 실행이지 앱 E2E는 아님.

부모 Draft **#50** 실제 원본문의 36/48/60개월 × 6조건 = **18건**과, 같은 함수에 단일 합계 검증 경계만 더한 수정안의 **18건**을 각각 V8 격리 실행. 매 조건에 대해 입력·행수·상태·표시되는 원금/총합/검토상태를 독립 기대와 대조했고 **수정안 18/18 기대 일치**:
- 정상 각 월 1원: 부모/수정본 모두 `source_backed`, 총계 36/48/60원.
- 실제 관찰 0원: 부모/수정본 모두 `source_backed`, 명시 0 보존.
- `reconciliation.status="blocked"`, 합계 zero-placeholder: **부모** 상태 blocked + 총계 `"0"` 표시(모순); **수정본** 상태 blocked + 총계 `[확인 필요]`, 원래 원금 행/합계는 보존.
- `reconciliation.status="reconciled"`이나 명시 원금 36/48/60원 대비 저장 합계 `"0"`: **부모** 잘못된 `source_backed/합계 대조 완료/0원`; **수정본** `blocked/[확인 필요]/대조 보류`.
- `ledger.status="blocked"`, 원금행은 정상: **부모** 금액 총계를 `합계 대조 완료`로 표시; **수정본** 총계 미확정.
- 원금 `"1,20"` 비정규: 부모/수정본 모두 예외 없이 `blocked/[확인 필요]`.

**정확한 경계**: 18건은 **원본문 함수의 격리 V8 실행**. 추가된 실제 Node test 파일의 12조건+TODO 1은 **작성·커밋만 했으며 Node 테스트 러너 실행 0건**, 전체 CI·D1·DOCX E2E 0건. 18개 모듈 산출이나 91입력 actual-path 전수 검증 아님.

## 2) 수정/PR / 소비처 잔여 위험

- [Draft PR #223](https://github.com/firmengine/firmengine/pull/223): 기존 [Draft #50](https://github.com/firmengine/firmengine/pull/50)의 보수적 원화/월수 처리 위에 **stacked**, 부모 branch SHA `adc628fdcb98c50e3edb15468570a4b13cd3c15f`. 소스 변경은 `lib/document-annexes.ts` 13줄 추가/1줄 교체, `tests/a2-r106-ledger-annex-blocked-summary.test.ts` 신규; 두 파일 모두 허용 경로 내부. 코드/회귀시험은 Draft에만 존재, **main 제품코드 미변경**. 부모 및 자식 파일 blob SHA를 바꾸기 직전 확인했고, 부모 브랜치 위 2커밋만 포함함.
- 핵심 변경: `ledger.status==="complete"` 및 `reconciliation.status==="reconciled"`, 8개 원화 totals와 독립 BigInt 원본 행 합계가 전부 일치해야 검증된 총계를 표시. 그 외 총계는 `[확인 필요]`; **행 원금 1원과 명시적 실제 0원은 변경하지 않음**.
- 상위 [#43](https://github.com/firmengine/firmengine/pull/43)이 blocked 때 합계 0이라는 sentinel을 **생성**하는 문제는 #223으로 수정되지 않음. 저장/API 및 모든 다른 서식 소비처가 `status` 무시 시 수치 오인 위험. [#194/#203/#215/#222](https://github.com/firmengine/firmengine/pull/222) 원장/class/legal review와 #219/#220 form projection도 **서로 미병합/충돌 미해결**. #50/#223 직접 main 병합 금지. 검토자/변호사 확인 전 법적 승인 승격 금지.

## 3) 정적 기준 계약 / 공식 원문(동시성·시행일)

- 원본 `reference-decision-tables.json` 직접 JSON 파싱: 계산모듈 **18**, 입력 선언 **91**(고유 78), 출력 선언 **42**(고유 40), resultPaths **42**(고유 42). `template-token-catalog.json`: D5103 **37**, D5106 **48**, D5110 **55**, D5111 **82**. **정적 수만 확인**했고 모든 값을 실제 서식과 대조하지 못함.
- 서울회생법원 2026-10-01 공식 보도자료 확인: 제424호 제2조 제2항 **제7호 신설**, https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . 2026-09-23 개정·2026-10-01 시행·시행 후 최초 접수사건 적용은 기존 r103 검토 기록과 분리. 이번 [실무준칙 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2) 직접 재조회 **타임아웃**, 부칙을 새로 검증한 것으로 기록하지 않음.
- 국가법령정보센터 **[2026-10-02 시행판 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR)**, **[제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR)** 실제 조문 재독. 법적 변제계획 기재/인가와 계산·서식 기술 검증은 구분. 제424호 실무준칙 시행일과 법률 시행일을 일치시키지 않음.
- 국세청 공식 VAT 일반과세자 6개월·간이과세자 통상 1년 기간 https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574 . VAT 신고매출/종소세 신고액을 승인된 월순소득으로 자동 변환하지 않음. 세금/급여 실데이터 월별 계산은 이번 합성 서식 축에서 실행하지 않음.

## 4) 중앙 인수 보드 ID / 다음

- `A2-DOC-005 [ ]`: 36/48/60회 분배 명목원금과 변제예정액표 월/총계 표시 독립 대조; blocked/stale false-safe. 실제 DOCX/변호사 승인 미검증.
- `A2-DOC-015 [ ]`: blocked 상태는 서식 검토보류에 연결되지만 실제 전체 final 생성 차단·문서 패키지 재독 미실행. `office-writer.ts:203-207` 최종 생성 게이트 **코드존재**만 확인.
- `A2-DOC-016 [ ]`: 실제 입력 0원과 계산실패/미확정 placeholder 0원을 구분하는 #223 Draft; SQL/typed 수치 계약 미완결.
- `A2-DOC-018 [ ]`: source rows 36/48/60 × 변제예정액표 함수 V8 18/18; **DOCX 숫자/행/문단 바이트의 실재독은 0건**. 공식 서식/실무자 확인 미완료.
- 다음 회차 **r107 계산사무장**: #43/#50/#223과 #194/#203/#222의 숫자·채권분류·우선채권 정책 통합 산식 테스트, 실제 project Node test/TS 및 36·48·60 × 복수채권의 BigInt 원장 보존 대조, 원본→Fact→typed→SQL 42 outputs→D5110/11 DOCX 재독. staged D1/R2/Cron, 법원·실무 승인 없이 미확정.
- **RELEASE_READY 0건**. 코드 존재·원본문 V8 18/18·정적 token 확인 ≠ 전체 Node/CI ≠ staging D1/R2/Cron ≠ 실제 공식 Word/법원 동등성 ≠ 변호사/계산사무장 서명 ≠ 운영 배포. 실제 고객/OCR/키/.env 미사용, 운영 DB/배포/전자제출/인가 확정 안 함.
