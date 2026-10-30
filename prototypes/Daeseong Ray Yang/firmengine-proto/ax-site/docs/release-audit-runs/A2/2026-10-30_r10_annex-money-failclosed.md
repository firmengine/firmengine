# FirmEngine A2 10차 — 변제예정액표 금액 미관찰/오인식의 BigInt 예외·source_backed 거짓 통과

작성 2026-10-30 KST · 프로젝트 `firmengine/firmengine` · 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.

## 0. 실제 확인·이전 회차 인계

- 최초 점검 GitHub main **`623d78610b67378871e60059d5c089dcc1539215`**, 영수증 작성 직전 main **`623d78610b67378871e60059d5c089dcc1539215`**. 이전 [A2 9차 영수증](2026-10-30_r09_creditor-partial-month-d5110.md)과 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 체크 ID·계산계약·최근 A1/A3/A4 커밋/열린 PR을 재조회.
- 이전 A2 9차 **LAW→IT→DOC→CALC→DATA** 순환 이후, 이번은 **AX→IT→DOC→CALC→DATA**로 다섯 관점을 확인. 다음 A2는 **변호사 관점 우선**으로 재개.
- 이번 항목 5개: `A2-AX-018`, `A2-IT-016`, `A2-DOC-018`, `A2-CALC-026`, `A2-DATA-018`. 전부 **[ ] 부분검증**. `RELEASE_READY` 0건.
- 실제 GitHub main 함수: `lib/document-annexes.ts` `repaymentPlanLedgerAnnex`, 원본 blob `9041330c95858390647d355cc3d1cbdbcab76b47`; 주변 호출 `lib/exports.ts`→`lib/office-writer.ts` (DOCX), 수치 원본 `lib/repayment-plan-model.ts`→`lib/plan-reconciliation.ts`. 기존 테스트 `tests/repayment-plan-model.test.ts` / `tests/calculation-18-output-golden.test.ts` 참고.
- 기존 열린 Draft PR `#25/#29`는 원장 파일 중첩, `#37/#43`은 정합 함수 중첩, `#47`은 D5110 월액 렌더 변경, 최신 `#49`는 DB 조회 캐시 교체 결함. 새 수정은 위 PR들과 **직접 수정 파일 중복 없음**, 합본 동작은 여전히 미인증.

## 1. P1 결함: 문서단에서 승인되지 않은 금액을 정상 보이거나 예외로 중단

원본 함수의 TypeScript 선언만 최소 제외하고 **GitHub 실제 함수본문**을 격리 V8에 실행. 아래 데이터는 실제 의뢰인과 무관한 단순 합성 구조다.

입력 공통:
```text
data.context.planMonths = 1
calculation.monthlyPaymentWon = "10"
ledger = { status:"complete", rows:[{
  installment:1, paymentDate:"2026-11-30", phaseId:"P1",
  debtId:"D1", claimClass:"ordinary",
  principalWon:"10", interestWon:"0", otherComponentWon:"0",
  balanceAfter:"90", fundingSourceId:"ordinary_budget", sourceIds:[]
}], issues:[] }
reconciliation = {
 status:"reconciled", issues:[], totals:{
  principalWon:"10", interestWon:"0", otherComponentWon:"0",
  totalWon:"10", ordinaryWon:"10", priorityWon:"0",
  estateWon:"0", trusteeFeeWon:"0"
 }, unallocatedBudgets:{"1:disposable_income":"0"}
}
```

각 사례는 공통 입력에서 **해당 필드 하나만** 바꿈. 독립 기대: 확인 불능 금액은 0으로 추정하거나 공식 제출값으로 승격하지 않고 `[확인 필요]`, 문서 annex `blocked`, 복구 가능한 검토 안내.

| 변화 | 기존 main의 실제 관찰 | 독립 기대 | 수정안 브랜치 V8 결과 |
|---|---|---|---|
| 정상 10원 + 실제 이자 0원 | source_backed·10원 | source_backed·10원 | 일치 |
| 원금 `"INVALID"` | **BigInt 예외** | blocked·표시 미확정 | 일치 |
| 원금 `null` | **BigInt 예외** | blocked·표시 미확정 | 일치 |
| 이자 `null` / `"1.2"` | **BigInt 변환 오류/비정상 숫자** | blocked·합계 미확정 | 일치 |
| 잔액 `"unknown"` | **source_backed 거짓 통과** | blocked·잔액 미확정 | 일치 |
| 기타 금액 `"N/A"` | BigInt 예외 | blocked·합계 미확정 | 일치 |
| `unallocatedBudgets["1:disposable_income"]="?"` | BigInt 예외 | blocked·잔여예산 미확정 | 일치 |
| `unallocatedBudgets={}` | **총계 잔여예산 0원** / source_backed | blocked·총계 미확정 | 일치 |
| 합계 `ordinaryWon="N/A"` | BigInt 예외 | blocked·합계 미확정 | 일치 |
| 계획 2회, 실제 행 1회 | **source_backed 거짓 통과** | blocked·누락 회차 | 일치 |
| 명시적 0원 / 큰 정수원 / 음수 / provisional | 일부 정상, 음수 허용 가능 | 0·BigInt 정확, 음수 거부, provisional 보류 | 일치 |

**실제 결과 범위**: 새 브랜치에 저장된 **수정 함수 본문**을 다시 GitHub에서 읽어 격리 실행한 **15개 합성 분기 중 15개 기대 일치**. 주석/타입 선언만 JS로 제외한 V8 검사다. 전체 app Node/typecheck/build·공식 Word 생성 테스트는 실행하지 않음.

## 2. 수정 제안 — Draft PR #50, main 원본 코드 미변경

- [Draft PR #50](https://github.com/firmengine/firmengine/pull/50) — `lib/document-annexes.ts` 금액 타입 검증, `BigInt` 안전 합산, 필수 월/잔여예산/합계 일치 확인, 미확정 수치 **0원으로 대체 금지**, 부정확 총계 차단.
- 회귀 테스트 `tests/a2-plan-ledger-annex-money-guard.test.ts` 6개는 브랜치에 **작성**, GitHub blob SHA 재확인. 테스트는 현재 **Node 실제 실행 미완료**. 브랜치 실제 함수본문 격리 V8 15/15가 단위 실행의 최대 근거다.
- 실제 `0`은 계속 0, 900719925474099312345원 같은 BigInt 정수는 정확하게 합산. malformed/누락·일부 월·출처 없는 잔여예산과 검토 전 결과는 원본·계산·법률·서식 각 영역의 미인증 상태 유지.
- 법적 채권 분류·계산 수치/세율/법원 기준·월수/인가 판단은 변경하지 않는다. **PR 합병/배포 없음**. 충돌 없는 코드 구현일지라도 전체 프로젝트 인수 아니므로 draft 유지.

## 3. 산식 선언·SQL 저장 스키마 실측 경계

- `lib/reference-decision-tables.json` 현재 main blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 계산모듈**, **91 input 선언(78 고유)**, **42 outputs 선언(40 고유 명칭)**, **42 resultPaths(42 고유 경로)**. 42개 resultPaths와 SQL 42개 저장행은 **같은 개념 아님**; 산식·서식·대조·검토 출력이 혼재.
- `lib/case-calculation-feature-store.ts` main blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`: row `>5000` 애플리케이션 가드, outputPath·formula·sourceFactIds·inputRefs 및 source-head SHA 저장 코드 존재. `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ab63170ec3efa`와 비교. 실제 **42 출력 재실행·저장/재독·D1·R2·2-worker·sourceVersion 경쟁은 이번 회차 미실행**.
- 이전 8차 격리 SQLite 5,000행 결과와 최신 main 현재의 5,000 제한을 혼동 금지. 새 Draft PR #49는 동일 계산조회 파일을 변경하므로 SQL replay/페이지 race 후속 통합 검증 필요.

## 4. 공식 법률·법원·세무 출처(관할별 법적 확정 아님)

- 국가법령정보센터 **채무자 회생 및 파산에 관한 법률** `[시행 2026.10.2.]` 법률 제21490호(2026.3.24. 타법개정), 제589조 개인회생 신청서와 채권자목록/재산목록/수입·지출목록 첨부 의무: https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018130103 . **시행일 확인과 실제 사건에 적용할 조문·서식 판단은 분리.**
- 서울회생법원 공식 보도자료 **2026.10.1.** 제목 '개인회생 변제기간 단축 대상에 관한 실무준칙 개정', 제424호 제2조 제2항 제7호 신설: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . 2026.9.23 개정본 상세 PDF는 이번 회차 웹에서 다시 열기 timeout, 따라서 상세 요건·부칙을 이번 회차 새로 검증했다고 표시하지 않는다. **제424호를 자동 규칙으로 활성화하지 않음.**
- 국세청 2026-10-30 조회 VAT 일반과세/간이과세 세액 계산 안내: https://sc.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272 . 매출액·VAT 세액/공제·순사업소득은 다른 값이며 이번 작업은 사업소득 인정 계산을 변경하지 않음.
- D5110 공식 전자소송 Word 파일 자체, 최근 법원 양식 적용일 및 변호사 검수는 **미검증**. 따라서 법원 적합성·변호사 승인 최종 결론을 내리지 않는다.

## 5. 검토 ID·이번 합격 범위·후속 순서

| ID / 관점 | 실제 확인 | 미완료 |
|---|---|---|
| `A2-AX-018` AX | 브랜치 실제 렌더러 함수본문 합성 15/15, 기준/실행층 분리, 부정 데이터 상태 분포 | 전체 파이프라인/모델·OCR 품질측정, 유료 모델 재실행, 실제 법률 평가 |
| `A2-IT-016` IT | 계산원화 문자열/BigInt 보존, invalid/null/0 분기, 출력 타입 | 전체 Node/TS 빌드, 실제 D1/R2 저장·응답, 문서 바이트 |
| `A2-DOC-018` 서류 | 총계/월별/잔여예산의 누락값과 0의 출력 구분 코드·함수 실행 | 실제 D5110 DOCX 생성·공식 판본 숫자/행/첨부 순서 |
| `A2-CALC-026` 사무장 | 1·2회 경계 누락, 거액 BigInt 합계·월별 유효 예산 표시 경계 | 36/48/60회 원장+리컨실리+PDF/Word 실제 통합 |
| `A2-DATA-018` 데이터 | result row/total/잔여예산 현 데이터 타입·source path·JSON과 annex 상태 계약 | 원문 Fact→typed→SQL run→42 outputs→D5110 artifact SHA 전체 lineage |

**5개 모두 [ ] 부분 검증, 제품 인수 0건.** 최근 PR #25/#29/#37/#43/#47 및 이번 #50의 실제 Node 병합·회귀 및 공식 법원 서식 검증 전 `RELEASE_READY` 금지.

다음 회차 우선순위는 **변호사 관점** `A2-LAW-021`/신청일별 법령·준칙판본, `A2-IT-015`/실제 DB 재독, `A2-CALC-026` 36·48·60회, `A2-DOC-018` D5110 DOCX byte-level, `A2-DATA-018` 42 result paths 및 SQL replay. 최신 main·열린 PR·실행 영수증을 처음부터 다시 읽고 시작한다.

**금지 작업 준수**: 공개 Git에 실제 개인정보/PDF/추출값/비밀키를 넣지 않았고, main 실제 제품 수정·운영 migration/배포/전자제출은 실행하지 않았다.
