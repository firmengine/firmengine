# FirmEngine A2 r71 — 계산사무장 / 기본 변제원장 합성 중복·음수·비정규 금액 무결성

- 일시: **2026-11-02 11:13 KST**; r70 사용자·서류담당자 → **r71 계산사무장** → r72 변호사.
- 대상: GitHub `firmengine/firmengine` main, 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 합성 데이터만. 고객/원본 OCR/키/환경파일 없음.
- 감사 시작 main SHA: **3f0ea9ba386dbff52db9b5d98ab1725dcf229385**. 영수증 작성 직전 재조회 main SHA: **3f0ea9ba386dbff52db9b5d98ab1725dcf229385**.
- 선행 r70 [서식 표시와 사전검증 불일치](./2026-11-02_r70_1015KST_doc-marker-parity-pr166.md), r69 저장 피처 readiness 상태, r65 stale 계산 revision, Draft #133/#157/#165/#166 및 main 최근 A1/A3/A4 커밋 확인.
- 검증 원문: main `lib/repayment-plan-model.ts` blob **6b9e53caba3be1eab17373956aa19717cfeec980**; stacked Draft #157 원문 blob **156a144115c968125f5096095c78c69235f1114f**; r71 Draft 후보 blob **9abf2eff723d11d9da3d1b13507bbb2b27022422**. main 계산 참조 JSON blob **6924e3977caf748ce8a3d617fae15aff7d2fe2ce**, 토큰 JSON **899c4d564fcb1726861f89dcf04dbf1b7e372687**. 본 감사는 운영 DB/문서 생성이 아닌 실제 소스 함수 *기본 경로* 격리 검증.

## A. 결함: 기본 변제원장에 동일 채권 중복배분/음수/형식오류가 남음

`buildRepaymentPlanModel`의 generated-default 경로를 실제 GitHub 코드에서 가져와 TypeScript 타입 주석만 제거하고 V8 격리에서 실행했다. 의존성 `moneyValue`, `addTrusteeFeeRows`, `orderRows`는 최소 대체 함수이며 제품 Node 전체 실행과 **동의어 아님**.

독립 오라클: 채권 `SYN-A`와 `SYN-B` 각각 매월 **1원**, 36/48/60개월 정상 명목 총액 **72/96/120원**. 두 채권 중 A를 중복한 3개 allocation이 있고 **월제안 3원**이면 실제 출력은 매월 **3원**, 전체 **108/144/180원**으로 부풀지만 기존 #157 원문은 `provisional`, 문제코드 없음. 같은 계산 결과의 `planTotalWon`은 원래 **72/96/120원**인 상태였음. 실제 `calculateCase`가 이런 입력을 정상적으로 생성한다는 증거가 아니며 **손상된 결과/복원된 입력에서의 조건부 위험**이다.

| 합성 사례 | 독립 기대 | #157 실제 관찰 | r71 후보 격리 관찰 |
|---|---|---|---|
| 36/48/60개월, 두 채권 각 1원 | 36/48/60 ×2행, 정상 산술, 법률 승인 아님 | provisional | provisional |
| A 채권 allocation 동일 ID 2회, 월허용 3원 | 중복 차단, 금액 조정하지 않음 | **provisional / 이슈 없음** | blocked / `DEFAULT_ALLOCATION_DUPLICATE_DEBT_ID` |
| allocatedPrincipalWon=-36/-48/-60 | 음수 지급액 차단 | **provisional / 음수 행 생성** | blocked / `DEFAULT_ALLOCATION_INVALID` |
| allocatedPrincipalWon=0036/0048/0060 | 비정규형 원화 보류 | **provisional** | blocked / `DEFAULT_ALLOCATION_INVALID` |
| debt principal 원문 `9,00` | 검토보류·예외 없이 반환 | **BigInt SyntaxError** | blocked / `DEFAULT_DEBT_BALANCE_INVALID` |
| calculation revision 7 vs 사건 revision 8 | 이전 계산 차단 | blocked / CALCULATION_SNAPSHOT_STALE | 동일 |
| 명시적 0원 월액·배분 | 0원 유지, null 취급 금지 | provisional | 동일 |
| 제안 월액 null | 0으로 임의 변환 금지 | provisional | 동일; 미승인 |

**실제 소스 기본 경로 V8 격리 결과 16/16 후보 기대 일치.** 36/48/60 각각 4건(정상/중복/음수/비정규형) + 4건(잘못된 debt 잔액/stale/0/null). 앞 12개 중 9개는 기존 허위 provisional 반례. 후보에서는 중복이나 오류 입력을 0·null로 교정하지 않고 빈 원장+검토보류로 반환하며 금액·배분·법원 기간을 새로 결정하지 않는다.

## B. 수정 및 실제 GitHub 이력

- [Draft PR #168](https://github.com/firmengine/firmengine/pull/168): **#157을 base로 한 stacked 변경**, #157은 다시 #133에 의존. `lib/repayment-plan-model.ts`의 기본 경로 입력에 정규형 원화·중복 debt ID·malformed balance 경계를 추가.
- 신규 테스트 `tests/a2-r71-default-plan-allocation-integrity.test.mjs` (16개 synthetic test 선언), 변경 파일 합계 **2개, 모두 ax-site 내부**. 검사 소스 자체를 GitHub에 커밋했으나 **프로젝트 Node 실행/CI 실행하지 않음**. PR은 Draft·미병합, 계산사무장/변호사 승인 전 병합금지.
- main 제품 코드는 **변경하지 않음**. 다른 에이전트의 Draft #165/#166 및 A1/A3/A4 코드는 수정하지 않음.
- 주의: 기존 `principal`/`interest`의 진짜 null은 원래 0으로 대체하는 경로가 남아 있어, 법률상 채권 잔액 확정에 대한 별도 human gate 필요. 제안 월액 null이 provisional인 기존 정책도 유지(승인 아님).
- 성능/경쟁상태, 실제 calculation producer가 중복을 배제하는지, 실제 `reconcilePlanLedger`/서식 writer/D1 저장 값 검증은 **미실행**.

## C. 18 계산모듈 / 91 선언 입력 / 42 출력 / 서식 토큰 재파싱

main `lib/reference-decision-tables.json`을 `JSON.parse`하여 `calculations` 18개, `inputs` 총 **91**(고유 **78**), `outputs` **42**(고유 **40**), `resultPaths` **42**(고유 **42**) 확인. `lib/template-token-catalog.json`: D5103 **37**(고유 37), D5110 **55**(고유 55), D5111 **82**(고유 82). 코드 경유 91 input/42 output의 실제 전수 소비·SQL→DOCX 렌더링 재독 아님.

별도 독립 BigInt 합성 산술: 급여 월 2,400,000원×관측 12개월=**28,800,000원**. 사업 순소득 월 1,000,000원×관측 11개월=**11,000,000원**. 현재까지 관측된 두 스트림 합계 **39,800,000원**이나 사업 **2026-12 미래월 null**, 12개월 완결 평균은 **미산정**. VAT 신고 매출 예시 60,000,000원과 종소세 연간 신고 20,000,000원은 **source-only 비교 자료**, 이 39,800,000원에 중복 합산하지 않음. 월 900,000원×36/48/60개월=**32,400,000 / 43,200,000 / 54,000,000원**. PV 30,000,000원 vs 청산가치 32,000,000원의 단순 차액 **2,000,000원**이나 PV 인정요건·자산평가·할인율·법률 인가는 미인증.

## D. 공식 법률·세무 원문

- **서울회생법원**, 보도자료 **2026-10-01**, [제424호 제2조 제2항 제7호 신설 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187) 직접 확인. 첨부 PDF 전문, 부칙/경과조치 및 사건별 적용일은 **읽지 못했음/미검증**. 공지일을 모든 사건 적용일로 자동 적용 금지.
- **국가법령정보센터**, [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759), **법률 제21490호 / 시행 2026-10-02** 원문 확인. 제611조 변제기간 3년 원칙과 특별사정 5년 범위, 제614조 인가/청산가치 기준은 본 산술검증과 분리.
- **국세청**, [부가가치세 공식 신고 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802), 일반과세자 반기, 간이과세자 통상 연간 과세기간 확인. VAT 매출액 및 종합소득세 신고액을 법원 인정 월순소득으로 자동 승격 금지.
- **법률·세무·회계 적합성은 변호사·계산사무장 승인 전 미인증**, 법원 제424호 개정의 시행/사건 적용과 소득/자산 인정 자동규칙 추가하지 않음.

## E. 중앙 보드 A2 ID (4건 모두 [ ] 유지)

| ID | 이번 실제 수행 범위 | 남은 검증 |
|---|---|---|
| `A2-CALC-019` | 채권원금/이자 별 금액 입력/복원 오류의 BigInt 예외 경로 확인 | 실제 채권 구분·양도/담보/원천 문서 및 법률 인정 검증 |
| `A2-CALC-025` | 복수 채권자 월 가용예산 2/3원 조건의 원장 합계 위반 분리 | 실제 claimClass별 예산·수수료·배분 원장·D5110/11 회귀 |
| `A2-CALC-026` | 36/48/60개월 1원 단위 보존/중복배분 반례 | 월말·phase·일부회차/잔여원·법률기간 승인 |
| `A2-CALC-030` | 0/null/음수/비정규형/중복/예외 synthetic 16/16 격리 | Node 프로젝트 전수 18모듈/91입력/42출력·SQL/Word 증빙 |

**다음 r72 변호사:** 이 데이터 무결성 후보를 법률상 인가요건과 구별하고, Draft #168/#157/#133의 계산 원장 및 #165 승인 준비도·#166 미확정 서식 검증 간 충돌 위험 재검토. 정상 계산 generator가 동일 채권 중복/음수 allocation을 불가능하게 하는지 실제 producer→SQL→D5110/11 최종 재독 필요. 무승인 법률 규칙/공식 서식/전자제출 적용 금지.

**이번 회차 제품 최종 인수 0건.** Node 통합·CI, staging D1/R2/Cron, 실제 Word/DOCX 생성·재독, 공식 양식 동등성, 실무자/변호사 최종 승인, 사이트 배포는 수행하지 않음. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가확정도 미수행.
