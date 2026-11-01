# FirmEngine A2 57차 — IT담당자: 계산 생산자 Fact 계보와 SQL 저장 계보 불일치

- 일자/역할: **2026-11-01 KST / IT담당자**, 직전 56차 AX담당자, 다음 **사용자·서류담당자**. 이 문서는 미병합 수정 후보의 테스트 증빙이지 제품 인수 인증서가 아니다.
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 A2만. 최초 main HEAD **`edb04af256d0107b5025d0090391a3d907247c01`**. 56차 기록과 Draft #71→#135→#136, main 0011 migration·계산 저장기·approval-readiness route·기존 테스트 원본을 읽었다.
- 선택한 중앙보드 ID: **A2-IT-013, A2-IT-015, A2-IT-019, A2-IT-020**. **모두 [ ] 부분검증**. 중앙보드만으로 인수완료/서식 승인 표시 금지.
- 기준 blob: main `lib/preapproval-calculation-replay.ts` `9517e71ee238955ee4af679bce1ebced888c4432`; 선행 #136 `f579b0fc0c6efbfdddc58ea3e207ab5e88ea9164`; main SQL 0011 `0caa359d250dce45765d269d271ad63170ec3efa`; main producer `bb5f88b26e68f5ae2234741063ac9301a927e27a`; main route `731f66a10d4af704b432dcd298061b452941fd13`.

## 1. 발견한 P1 데이터 계보 거짓 정상 — 합성 원문 / Fact / typed / SQL feature

가상 원문 사례는 **실제 OCR 결과가 아님**. 월급여 `2,400,000원` → 원천 Fact `SYN-F1`(예시 관측, 원문증빙의 인정판단 전) → typed `{monthlyIncomeWon:"2400000", sourceFactIds:["SYN-F1"]}` → 동일 실행 생산자 `income_average`, path `/assessment/calculation/monthlyIncomeWon`, `valueJson="\"2400000\""`, `valueWon="2400000"`, `status="computed"`, 예상 Fact `["SYN-F1"]`.

**핵심 반례:** SQL 행의 `source_fact_ids_json=["SYN-F2"]`로 바꾸되 `SYN-F1`과 `SYN-F2`를 둘 다 현재 Fact ID 집합으로 전달한다. 독립 기대는 **저장된 금액이 원본 실행과 일치해도 원천 Fact 계보가 다르므로 검토보류**. 실제 #136 기존 함수 원본문(TypeScript 타입만 제거) V8 격리에서는 `valid=true, issues={}`: 존재하는 Fact인지 검사하지만 **같은 계산 생산자가 소비한 Fact인지 비교하지 않는 결함**이다. 여분 Fact, 빈 목록, 중복 Fact도 같은 거짓 정상으로 재현했다. 소득을 두 배 계산했다는 증거는 아니며 **SQL 재생의 무결성 오판**이다.

**수정 후보:** 별도 [Draft PR #138](https://github.com/firmengine/firmengine/pull/138), #136을 base로 한 스택. `expectedOutputs`에 생산기 `calculationFeatureRows(execution)`의 `sourceFactIds`를 전달하여 같은 (calculationId,outputPath)별 정렬된 Fact ID 배열과 저장 JSON 배열을 비교한다. 누락·변경·여분·반복·비정상 JSON이면 `STORED_FACT_LINEAGE_MISMATCH` 검토보류(기존 `STORED_FACT_IDS_INVALID`, `SOURCE_FACT_NOT_CURRENT` 보존). 소스/금액/상태/원화 값은 자동 변경하지 않음. 결과는 법원 인정 및 변호사 승인이 아님.

## 2. 실행한 시험의 독립 기대와 실제 관찰

- **기존 #136 V8 원본문 실측:** `["SYN-F1"]` 정상, **다른 유효 Fact `["SYN-F2"]`, 여분 `["SYN-F1","SYN-F2"]`, 빈 목록 `[]`, 반복 `["SYN-F1","SYN-F1"]` 모두 기존 `valid=true` 관찰; 후자의 4건은 독립 기대 `false`와 불일치.
- **수정본 실제 GitHub blob `d82d5fa187e34bb7a2ce261a379f54841640fc7b`로 V8 타입제거 격리 실행:** 신규 합성 Node 테스트 **14개 테스트 본문을 V8에서 실행해 14/14 기대 일치**; 선행 56차 10개 회귀 본문도 **10/10 기대 일치**. 정상 단일·서로 다른 현재 Fact·여분/빈·중복·순서반전·과거 Fact·정상 빈 lineage·명시적 `"0"`·미관찰 `null`·계보 필드 부재·잘못된 JSON·계약 없는 과거 호출·예상 밖 출력경로 각각 비교했다. **Node 프로젝트 테스트러너/전체 CI는 미실행**. 새 테스트 소스는 `tests/a2-r57-producer-fact-lineage.test.ts`에 커밋.
- **Python SQLite in-memory (main migration 0011과 동일 테이블/인덱스 DDL, 가상 `cases` FK stub):** 계산 run 1건·피처 4건 저장 후 재조회. `["SYN-F2"]` 변조 계보 보존, 동일 outputPath 2행 허용, `value_json=null/value_won="0"` 상충 및 `source_fact_ids_json={bad` 저장 허용, `PRAGMA foreign_key_check=[]`. 이는 SQL 제약만으로 원천/값 의미정합을 인증할 수 없다는 증거이며 **실제 D1 저장·조회 실측 아님**.
- **별도 Node 22 BigInt 독립 오라클 실행:** 2025년 급여 2,400,000×12 = 28,800,000, 사업 1,000,000×11 = 11,000,000, 합계 **39,800,000원**; 관측되지 않은 2025-12 사업소득은 `null` 유지(0 보간 금지). 월제안액 900,000×36/48/60 = 32,400,000/43,200,000/54,000,000원. **산술 6건 + 0/null 상태 2건** 일치. 이는 **기존 18개 엔진을 실행한 결과가 아닌 독립 산술**.
- **main 정적 JSON 재파싱:** 계산모듈 **18개**, 입력 선언 **91개/고유 78**, 출력 선언 **42개/고유 40**, resultPaths **42개/고유 42**; D5103/D5110/D5111 등록토큰 각각 **37/55/82**. 정적 숫자와 실제 SQL 42개 출력·Word 내용 검증을 혼동하지 않음.
- **GitHub HEAD 검사:** #136 source head `dde45ee69e7a0dccb1e6acc4f08f7d4eb5c77bed`에서 별도 Draft 브랜치 생성, 커밋 전 파일 blob SHA/브랜치 HEAD 비교. #136 대비 PR #138의 변경 **3파일 모두 ax-site 내부**; 신규 코드·테스트 커밋 HEAD `5c7f7f2c4b3360b96ed648383075865d569d175e`. PR HEAD에 대응하는 GitHub workflow run/combined status 조회 결과 각각 **0건**이므로 CI 통과 주장하지 않음.

## 3. 공식 법률·세무 원문과 적용 경계

- **국가법령정보센터**, `채무자 회생 및 파산에 관한 법률` **[시행 2026-10-02] [법률 제21490호]** [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777) 변제기간은 원칙 3년, 특별 사정이면 5년 이내; [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) 공정성/수행가능성/인가결정일 청산가치 등. 산술의 48/60개월 테스트는 법적 인가가 아니다.
- **서울회생법원**, [2026-10-01 제424호 제2조 제2항 제7호 신설 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187). **공지일을 모든 사건의 시행·적용일로 자동 확정하지 않음**; 첨부 개정전문 부칙·경과규정/법원관할·개별 사건 접수일은 미검증.
- **국세청**, [부가가치세 신고·납부 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 반기/간이과세자 통상 연간 과세기간. VAT 신고매출·종소세 자료를 개인회생 법적 인정 월순소득으로 자동 승격하지 않음.

## 4. ID별 판단 및 다음

| ID | 관찰/수정 | 상태 |
|---|---|---|
| A2-IT-013 | computed 금액이 정합이어도 source Fact ID만 바뀌는 거짓 정상. 별도 `STORED_FACT_LINEAGE_MISMATCH` 제안; 0/null/기존 상태검증 보존 | **[ ] 부분** |
| A2-IT-015 | migration 0011 합성 4행 SQL 재독(원천·금액 모순도 저장됨), 실제 D1·API→typed→재계산 종단 미실행 | **[ ] 부분** |
| A2-IT-019 | 같은 생산자 output에 정확한 원천 Fact 집합 요구. 본 검사는 SHA 해시 원본 대조를 대체하지 않음 | **[ ] 부분** |
| A2-IT-020 | source ID 배열의 빈/중복/순서반전/비정상 JSON 타입 경계. Node 프로젝트/TypeScript 전체 빌드 미검증 | **[ ] 부분** |

**후속 사용자·서류담당자 회차:** PR #71→#135→#136→#138 의존 스택 실제 Node 22 테스트 및 CI, 기준판본 CAS·다중 워커 SQL 저장재생·전체 18×91→42 생산자/Fact 계약, D5103/D5110/D5111 공식 Word 금액·내부 계보 비노출, 정상 이직/휴직 사업원별 관측기간 승인 및 #130/#133 충돌 우선. **최종 변호사·실무자 법률/세무 적합성 확인 전 미인증**. 운영 D1 migration/배포·전자제출·법원 인가 수행 없음. 제품 인수 완료 **0건**.
