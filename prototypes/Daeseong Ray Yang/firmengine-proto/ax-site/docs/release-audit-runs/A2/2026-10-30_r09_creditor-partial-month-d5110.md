# FirmEngine A2 9차 — D5110 채권자별 일부 회차만으로 월변제액 확정되는 결함 (2026-10-30 KST)

## 0. 범위·인계

- 수정 허용: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 감사 시작 GitHub **main `019e2ad02a6e9056a84abf57d37bbfa420a90042`**, 기록 쓰기 직전 main `019e2ad02a6e9056a84abf57d37bbfa420a90042`. 8차 `docs/release-audit-runs/A2/2026-10-30_r08_ledger-integrity-and-sql-5000.md`와 단일 인수 보드, 최근 A1/A3/A4 커밋, 열린 Draft PR #13/#18/#21/#25/#29/#33/#37/#38/#43 등 확인.
- 체크 5개·순환 관점: **변호사** `A2-LAW-020`, **IT** `A2-IT-016`, **서류담당** `A2-DOC-005`, **계산사무장** `A2-CALC-026`, **데이터담당** `A2-DATA-018`. 다음 회차는 AX 관점부터. **[ ] 유지; 5건 모두 부분검증**.
- 레벨 분리: 실제 GitHub main `lib/form-mapping.ts` 식의 TypeScript 타입 선언만 제외한 원 함수본문 V8 재현 / PR 코드 helper 함수본문 V8 / Node 22 순수 합성 단위시험 / 전체 프로젝트 Node·빌드·CI 미실행 / D1·R2·Cron 미실행 / D5110 실제 Word 바이트·최신 법원본/변호사 승인 미실행.

## 1. P1 원인 및 원본 재현

- 경로: `lib/form-mapping.ts:162`의 `buildFormBindings().rows.creditor[].monthly_payment`. 기존 식은 **그 채권자의 ledger에 실제 존재하는 회차끼리 금액이 같은지만 검사**하고, 사건 전체 기대 변제회차가 전부 존재하는지 확인하지 않았다.
- 그 결과 사건 계획이 2개월인데 A채권자는 1개월차 10원만 존재하고 B채권자는 1·2개월차 각각 7원이 존재하는 경우, 전체 계획 월 존재를 별도 확인했다 하더라도 A채권자의 서식용 월액은 **10원**으로 출력된다. 기대 결과는 **`[확인 필요]`**이며, 채권자별 미지급월을 임의 0원이나 10원으로 간주해서는 안 된다.
- **main 실제 함수 본문 격리 V8 4건: 2/4 기대값 일치**, 2건 위양성. `const months=new Map<number,bigint>()` 등 TypeScript 주석/타입만 최소 제거하고 금액 매핑 식 자체를 실행. 독립 기대 결과는 코드 로직과 별도로 정의.

| 합성 입력(실제 사건값 없음) | 독립 기대 서식 `monthly_payment` | 기존 main 실제 | 해석 |
| --- | --- | --- | --- |
| 2회 계획: A 1회차 10원, B 1·2회차 7원 | A=`[확인 필요]` | **A=10원** | P1: 부분행을 상수 월액으로 오인 |
| 2회 계획: A는 1회차만, B는 2회차만 | A=`[확인 필요]` | **A=10원** | P1 동일 |
| A 1·2회차 모두 10원 | 10원 | 10원 | 정상 상수 |
| A 1·2회차 **명시적 0원** | 0원 | 0원 | 정상 영값은 보존 |

## 2. 독립 검증 및 수정안

- **Draft PR #47**: https://github.com/firmengine/firmengine/pull/47 . main 직접 수정·병합 없음. `lib/creditor-monthly-payment.ts` pure BigInt 검증과 `lib/form-mapping.ts` 작은 바인딩 교체 및 `tests/a2-creditor-monthly-coverage.test.ts` 9개 Node 테스트 케이스를 새 브랜치에서 작성.
- 구체적 게이트: 해당 채권자가 **예정 회차 1..N 각각에 실제 명시적 행을 보유**해야 하고, 원금·이자·기타구성액이 유효한 정수원이며, 회차별 총액이 모두 같을 때에만 월액을 렌더한다. 중간 누락/기간 미확정/기준외 회차/가변 금액은 `[확인 필요]`. 명시적 0원은 `0` 유지. 법률상 인가·채권액 자동 인정 없음.
- **Node 22.16.0 `node --experimental-strip-types --test tests/creditor-monthly-payment.test.ts` 순수 모듈 격리본 9/9 성공** (로컬 `/mnt/data/firmengine_a2_round9`, 변경 의미가 동일한 미러 코드), **PR #47 실제 helper 함수본문 V8 타입 제거 격리 검증 12/12 성공**. 36·48·60개월 **각각 상수 월액 경계값** 확인. 이는 변제 계획 전체 산식·잔여원·실제 D5110 파일 시험은 아님.
- 새 테스트 자체를 **프로젝트 의존성 설치 상태에서 실행하지 못했음**. 따라서 해당 PR의 실제 Next/Sites 빌드·전체 TypeScript 검사/CI는 미인증이다.
- PR #25/#29 같은 `repayment-plan-model.ts` 수정, PR #37/#43 같은 `plan-reconciliation.ts` 수정 등 **통합 병합 충돌 위험**이 여전히 존재한다. PR #47은 별도 `form-mapping.ts`에 적용되어 직접 수정 파일 중첩은 없으나 planLedger/reconciliation 입력 계약이 바뀌면 재시험 필요.

## 3. 실제 법원·세무 공식 출처 교차 대조(법률 적용/승인 아님)

- 국가법령정보센터: 채무자회생법 **2026-10-02 시행**, 법률 제21490호, 2026-03-24 타법개정 — https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0001&lsiSeq=290631&urlMode=lsScJoRltInfoR . 특정 사건의 신청일 및 적용법·법률상 채권 인정은 별도 검토한다.
- 서울회생법원 2026-10-01 공식 보도자료: 실무준칙 **제424호 제2조 제2항 제7호 신설** — https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . **이번 D5110 월액 조정은 해당 특례의 요건·인정액·기간을 전혀 바꾸지 않는다**.
- 국세청 공식 사업소득·VAT 안내: 일반/간이과세 세액 계산과 장부 사업소득 = 총수입금액−필요경비를 구분 — https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802 . 월 채권 배분 표에 세무 신고액을 끼워 넣거나 인정 소득을 자동 승인하지 않는다.
- 대법원 공식 서식 검색 https://www.scourt.go.kr/nm/minwon/doc/ProDocList.work (이번 확인 시 웹 방화벽에서 목록 직접 열람 차단). 기존 코드의 D5110 매핑과 내부 문서의 판본 명칭은 확인했지만 **최신 공식 전자소송 서식과 Word/PDF 바이트를 직접 대조하지 못했다**. 이 검사는 내부 무결성 가드이며 법원 서식상 채권자 월 변제액 기재 방식의 법적 적정성은 변호사 검토대기.

## 4. A2 체크 ID 부분검증·재검증 대상

| ID | 관점 | 이번 확인 | 미완료 조건 |
| --- | --- | --- | --- |
| `A2-LAW-020` | 변호사 | 공식 법령 시행판/서울 제424호 공지 및 D5110 기준자료 출처 구분 | 최신 공식 전자소송 원본·법원별 제출표·변호사 독립 검수 |
| `A2-IT-016` | IT | 서식 금액 BigInt 원단위 변환과 일부행 위양성 차단 12/12 | 실제 전체 앱 타입/빌드, DB 재독 및 Word 값 |
| `A2-DOC-005` | 서류담당 | 2회 계획 중 일부 채권자의 누락월을 월 10원으로 표기하는 결함 재현 및 PR #47 | D5110 Word·36/48/60 실제 문안/표/기일 E2E |
| `A2-CALC-026` | 계산사무장 | 36/48/60 월액 상수·원단위/복수행 순수 함수 9/9, 실제 PR helper 12/12 | 전체 정산·잔여원·phase 날짜·재원/채권 변동 및 PR #25/#29/#37/#43 통합 |
| `A2-DATA-018` | 데이터 | `rows.creditor[].monthly_payment`가 ledger 채권자·회차를 소비하는 코드 연결 확인 | 원문 factIds→SQL run→D5110 token·법률검토 해시 실측 미검증 |

## 5. 후속 작업

1. **다음 AX 관점 우선**: `A2-AX-018` 품질지표, `A2-IT-019` 원본/산식 input/output SHA, `A2-CALC-027` PV/평가기준일, `A2-DOC-014` 실제 Word 첨부/행, `A2-LAW-021` 공식자료 판본.
2. D5110 Word/D5111 원본 대비 회차별 36/48/60 원금·이자·총액·일자·채권자 행 검증. 현재 코드가 있는 것과 최신 공식 서식을 통과했다는 것 구별.
3. PR #25/#29/#37/#43/#47 **통합 브랜치에서** 테스트하고 담당 계산사무장·변호사 검토 후 병합 판단. 실제 D1/R2/Cron·운영배포·전자제출 금지.
4. 18계산 모듈/91선언 입력(고유78)/42등록 output path의 실제 SQL 저장·replay/서식 출력 비교는 아직 부분 검증. 검증 수치 임의 100% 보고 금지.

**현재 제품 RELEASE_READY: 0건.** 해당 체크 ID의 [ ]를 유지한다.
