# FirmEngine AX A2 r113b — 계산사무장 독립 교차감사: 서식 월변제액 원장의 null 행 예외
작성일: 2026-11-04 KST · 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만 · 법률/제품 인수 **0건**.

## 1. 범위, 판본, 실제 읽은 코드
- 이전 A2 r112 사용자·서류담당자 영수증 `2026-11-04_r112_0416KST_doc-cross-consumer-zero-pr227.md`와 A2 r113 기존 [Draft #228](https://github.com/firmengine/firmengine/pull/228) 이어 검증. 같은 역할의 감사를 덮어쓰지 않고 r113b 독립 통합 반례만 기록.
- 점검 시작 및 제품 코드 수정 직전 관찰 main: `85d3c3290e01fa48a78eac298ea35cf15d6e59a8`. 이 시점 main에는 신규 표시 guard가 없음. 검증 대상은 **미병합** #227→#228의 코드, main 완료로 오인 금지.
- #228 head `d1b0332b681911dfa243960336971ba6226a3d80`, 실제 `lib/plan-form-monthly-guard.ts` blob `753ba25598e0307cff5657de0a874717503ae13b`.
- main SQL `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa` 구조 정적 재독. `case_calculation_features.value_json TEXT NOT NULL`, `value_won TEXT`, `source_fact_ids_json TEXT NOT NULL`; JSON 내부 원소의 null/숫자/오류를 DB 컬럼 자체에서 제한하지 않음. **실제 D1/SQLite 쓰기·재독은 이번 회차 미실행**.
- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` JSON 재파싱: 계산 18모듈, 입력 91선언/고유78, 출력 42선언/고유40, resultPaths 42/고유42. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5106 48, D5110 55, D5111 82. **정적 확인**, 각 계산실행/실제 Word 바이트 확인 아님.

## 2. 독립 산술 기대값 · 입력 · 실제 V8 관찰
- 대상 함수: Draft #228의 실제 `reconciledCreditorMonthlyWon()` 본문. 단순 TS 유형 주석/제네릭만 제거한 격리 V8 실행(모델 재구현 아님). 합성 채권 SYN-D는 매월 원금 1원, 이자/기타 0원, 회차 36/48/60, `status=complete/reconciled`, `issues=[]`, 월 예산 잔액 `"0"`, 총액은 독립 BigInt 기반.
- 정상: 36×1=36원, 48×1=48원, 60×1=60원, 대상 채권 월액 `"1"`. 관찰된 실제 0원은 월액 `"0"` 유지. 채권자 매월 원금 1+이자 1, 별도 trustee fee 1 추가는 전체 월별 3원(총액 108/144/180원)이지만 대상 채권 표시 월액은 `"2"`가 기대.
- **P1 후보**: 위 정상 배열 끝에 `null` 또는 `undefined` 원장 행 하나를 추가하되 합계는 고정. 독립 기대는 `null`(출력 보류), #228 실제는 **TypeError**. 3 기간×2 입력=6회 예외 재현. 배열에 null 원소가 남을 수 있는 비정상 JSON/API 경계임. 법원서식 실제 생성 시 throw 전파 여부는 아직 미검증.
- 그 외 원장 행 `7`/false/문자열/[]/{} 5종, 중복 0원행, 기존 원장/대조 issues, 다른 클래스, 잘못된 금액 `"1,20"`, 누락월, stale 총계 등을 포함 **17 시나리오 × 3 기간 = 판본별 51호출**.
- 기대값 일치: #228 원함수 **45/51**, 수정 후보 **51/51**. 변경 후 null·undefined를 포함한 비객체 행은 수치 접근 전에 표시 보류. 비정상 항목을 0원으로 대체하지 않음. 이 격리 테스트는 실행했으나 저장소 checkout의 `node --test`, 전체 CI, 실제 D1, DOCX 생성·재독은 **실행하지 않음**.
- 참고하는 미완료 의미 경계: 이 함수는 `issues` 속성 생략과 `legalReviewTasks` 생략을 허용하며, 월별 잔여예산 양수도 금액 형식이 정상이면 통과. 이들은 입력 계약/법률상 예산 소진 요건을 확정하지 않았으므로 이번 최소 패치에서 임의로 변경하지 않고 별도 검토로 남김.

## 3. 수정 및 독립 테스트 자산
- [Draft PR #229](https://github.com/firmengine/firmengine/pull/229), 부모 #228 브랜치 `audit/a2-r113-calc-form-snapshot-issues-20261104`; r113b 브랜치 `audit/a2-r113b-calc-null-ledger-row-20261104`.
- 실제 수정 **2파일**, ax-site 내부만: `lib/plan-form-monthly-guard.ts` null/primitive row fail-closed guard (수정후 blob `75da00bc999b4cc9ecb5e836b7bf6429c3dc28de`), `tests/a2-r113b-monthly-guard-null-rows.test.ts` 51합성 test 선언.
- 커밋: 코드 `1f0e8069affc96138b5bf0c5c7558581fb343c7a`, 시험파일 `35dd9d6414ca33f4df2824c4f95b43062d0c5914`. **시험파일 작성/커밋은 확인, 저장소 전체 Node runner에서 실제 실행은 안 함**. PR은 미병합 Draft/부모 의존.

## 4. 공식 원문 및 법률 인증 구분
- 서울회생법원 [2026-10-01 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187) 직접 재조회: 제424호 제2조 제2항 **제7호 신설** 공지. 개정전문/부칙 PDF는 **이번 회차 직접 열람하지 않음**; 최초 접수일/관할·적용 시점 및 변호사 승인은 독립 인수 전까지 미인증.
- 법제처 [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR) 직접 재조회: **2026-10-02 시행, 법률 제21490호**. 산술 분배·표시와 우선채권 전액변제/청산가치·법원 인가는 구분.
- 국세청 [부가가치세 신고기간 안내](https://g.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574) 직접 재조회: 일반과세자 6개월, 간이과세자 원칙적 1년 과세기간. 신고매출을 사람 승인 없는 월순소득으로 계산 확정하지 않음.

## 5. 중앙 보드 대응(모두 [ ] 부분검증만)
- `A2-CALC-019`: 원금·이자·기타원·부적격 row의 null·금액 구분; legal debt source correctness 미인증.
- `A2-CALC-025`: 별도 회생위원 보수 `trustee_fee` + 채권자 월 이자·원금 표시 예시, 36/48/60 전체 3/월·2/월 독립 검산; 법률상 가용소득/우선권 판단 미인증.
- `A2-CALC-026`: 기간별 월 1원 합계(36/48/60)와 malformed row가 섞일 때 출력 보류를 격리 재현; 전체 배분/원단위 잔여분/법원 기간 미인증.
- `A2-CALC-030`: `null`/`undefined`/숫자/문자열/실제 0/비정규 원/중복/상충의 기술적 경계, 51/51 후보 통과; 18모듈/91입력 전체 golden, D1/DOCX/CI 미인증.

**다음:** 부모 #228→#227 및 #43/#203/#222/#223와 통합 실행; Node 프로젝트 테스트, 원문 Fact→typed→SQL feature→42 결과→4종 실제 DOCX 재독, 법률/계산사무장 최종 확인. 운영 배포, D1 운영 마이그레이션, 전자제출·인가 확정은 실행하지 않음.
