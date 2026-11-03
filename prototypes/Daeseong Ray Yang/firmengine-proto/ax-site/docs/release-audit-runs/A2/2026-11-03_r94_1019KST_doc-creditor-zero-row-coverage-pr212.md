# FirmEngine A2 r94 — 사용자·서류담당자 / 채권행 전부 누락 vs 비영(非零) 총채권액 검토

- 시점: 2026-11-03 KST, r93 **IT담당자** → r94 **사용자·서류담당자** → r95 **계산사무장**.
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 실제 고객·OCR·개인정보·키·env·정답 사용하지 않음.
- 시작 시 최신 main HEAD: `dc87f6b3472462e46234104f1568dd3fb35202ce` (2026-11-03 00:58:29Z). 최근 A1 r93/A4 r93 커밋, r93 A2 감사 및 #209 Draft를 재조회. 저장된 기준 보드 SHA `5f578be8028eda90494c29493af12c727f943f78` (쓰기 전 새 조회 필수).
- 이번 점검 보드: **A2-DOC-002 / A2-DOC-004 / A2-DOC-016 / A2-DOC-018**. 전부 **미완료 [ ]**, 전체 제품 인수 0. 이것은 법적 채권 인정이나 공식 제출 적합성 인증이 아니다.

## 1) 관련 실제 구현·테스트/PR 재독

- main `lib/document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`, Draft #200 같은 파일 blob `65ba55037cb4fc64c00ccf8c6203617f56ce2c00`의 숫자 parser 및 `creditor` 합계 루프를 실제 코드에서 추출했다.
- `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`: 채권자 행은 `calculation.debtRows`, 원금/이자 합계는 계산 scalar에서 생성. 소득 `rows.month`는 Fact 검증과 `exactSourceCalendarMonth`를 거친 별도 행, 직접 세금신고액 환산 금지.
- `lib/form-contracts.ts` blob `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef`와 `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5106 creditor 반복필드 16개, D5110/D5111 creditor 각 7개, D5103 creditor 반복그룹 **없음**.
- `lib/document-writer.ts` blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`는 final preflight blocker 발생 시 throw를 정적 확인. **실제 DOCX 출력 미생성**.
- 선행 미병합 Draft #200(잘못된 금액 판독), #195(계보·숫자), #198/#199(JSON Fact ID), #205/#207(동일 사건·대상 Fact), #209(run 소유·판본) 및 서로 겹치는 변경 파일·base 상태 재조회. 실제 Git 통합 빌드/충돌 해결/병합 없음.

## 2) 합성 입력, 독립 기대값 및 실제 관찰

검증 방식: GitHub main 및 부모 Draft #200 **실제 함수 내 numeric + creditor 루프 본문**을 추출, TypeScript 타입 표기만 제거해 V8에서 실행. 프로젝트 함수 전체/Node runner는 미실행. 독립 기대는 수기로 미리 정한 BigInt 원화 산술과 보수적 서식 검토 계약. 모든 자료는 **SYN** 가상이며 법적 판단이 아니다.

| 합성 입력 (원/채권행) | 독립 기술 기대 | main 관찰 | 부모 #200 관찰 | 후보 #212 관찰 |
| --- | --- | --- | --- | --- |
| `total_principal="1,200원"`, `total_interest="0"`, `creditor=[]` | 비영 총채권·행없음 **block** | 차단 없음 | 차단 없음 | `REPEAT_ROW_CREDITOR_COVERAGE_MISSING` |
| 원금0·이자35, 채권행 없음 | block | 없음 | 없음 | 위 blocker |
| 원금-1·이자0, 채권행 없음 | block | 없음 | 없음 | 위 blocker |
| 원금0·이자0, 채권행 없음 | **명시적 0 보존** | 없음 | 없음 | 없음 |
| 원금/이자 `[확인 필요]`, 채권행 없음 | **미관찰 유지** (0으로 확정 금지) | 없음 | 없음 | 없음 |
| D5103처럼 creditor 반복그룹 없는 서식 | 이 조건으로 차단 금지 | 없음 | 없음 | 없음 |
| 채권 1행 원금 1200·이자0 | 합계 일치 | 없음 | 없음 | 없음 |
| 채권 2행 원금 300+900=1200, 이자 5+7=12 | 합계 일치 | 없음 | 없음 | 없음 |
| 2행 1200 vs 총합 1201 | `REPEAT_ROW_TOTAL_MISMATCH` | blocker | blocker | blocker |
| 잘못된 금액 `1,20` | `REPEAT_ROW_AMOUNT_FORMAT_INVALID` | 없음 | blocker | blocker |
| 미관찰 이자 `[미관찰]` | 잘못된 숫자값으로 검토보류 | 없음 | blocker | blocker |

**최종 11개 기술 기대 일치:** main **6/11**, Draft #200 **8/11**, #212 후보 **11/11**. 3개 비영 무행 반례의 **draft 모드**는 blocker가 아닌 `REPEAT_ROW_CREDITOR_COVERAGE_MISSING` 경고로 관찰; explicit 0 / unobserved / 비해당 서식에서는 신규 경고 없음. 단위가 다른 연간 신고/VAT를 합산하지 않았다.

합성 판본 구분: 원문/OCR **미관찰**, 합성 Fact ID **없음/source-only**, typed 계산 scalar **위 명시값**, SQL feature 저장/조회 **이번 회차 미실행**, 서식 바인딩/계약 반복그룹 **코드 기반 V8**. `0`·null·미관찰·비해당·상충·source-only·승인전은 수치/법률 인정으로 자동 승격하지 않는다.

`lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`의 **18 계산모듈 / 91 입력 선언(고유 78) / 42 출력 선언(고유 40) / 42 결과경로(고유 42)** 직접 재파싱; 등록 토큰은 **D5103 37 / D5106 48 / D5110 55 / D5111 82**. 이것은 정적 집계, 18모듈 전체 실행이나 산식·SQL·Word 왕복 PASS가 아니다. 36/48/60개월 가상 900,000원 월액의 단순 곱은 32,400,000 / 43,200,000 / 54,000,000원 (독립 수학, 엔진 산출 미측정).

## 3) 작은 수정 제안 / 테스트 계층 / 승인 HOLD

- **[Draft PR #212](https://github.com/firmengine/firmengine/pull/212)**, `audit/a2-r94-doc-creditor-coverage-20261103-1019`, 부모 Draft #200 브랜치에 stacked. 코드+테스트 2파일만 ax-site 내부. 마지막 제품 후보 커밋 `a801ba0b057b8cbb9b5a692529ef900d8679099b`.
- 기존 엄격 숫자파서 재사용. 양수/음수 명시 총원금 또는 총이자가 존재하고 creditor 반복그룹이 있으나 행이 전부 0개일 때 final blocker/draft warning. 0/null/미관찰, creditor 반복그룹 자체 없는 서식의 동작은 유지. 기존 금액/계산/분류/법률/원문 데이터 변조 없음.
- `tests/a2-r94-doc-creditor-coverage.test.mjs`: 프로젝트 함수 직접 import하는 **합성 Node 검증 14개 + TODO 3건을 작성/커밋**. **프로젝트 Node22 실행·TS 전체 검사·CI 실행하지 않음**. V8 11건은 실제 실행, Node 14건은 **테스트 소스 존재일 뿐 PASS가 아님**.
- 보류: #200 부모와 별개 main 병합 불가. #195/#198/#199/#205/#207/#209의 투영/런타임 검증과 겹친 변경 병합, 실제 run Fact/source owner, D5106/D5110/D5111 ZIP/XML 행수/수치 E2E, 전체 CI·staging D1/R2/Cron, 서류담당자·변호사 공식 서식/법률 적용 승인 전까지 release [ ].

## 4) 공식 법원·법률·국세청 대조 (법원/시행일/출처)

- **서울회생법원 2026-10-01 보도자료**, 실무준칙 제424호 제2조 제2항 **제7호 신설**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . 법원의 공지 **본문만 직접 재확인**, PDF 개정전문/부칙/사건별 적용일 **미확인**. 관할·개시/신청시점에 따라 적용 검토 필수; 자동 변제기간 단축 불허.
- **국가법령정보센터, [시행 2026-10-02] 법률 제21490호**, 채무자회생법 제611조(변제계획의 내용/기간): https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 및 제614조(인가 요건): https://www.law.go.kr/LSW/lsLinkProc.do?joNo=061400&lsNm=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0&mode=11 . 법령 시행일≠개별 사건 소급적용 판단.
- **국세청 부가가치세 신고기간**: https://d.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 . 일반과세자 반기, 간이과세자 통상 연단위. VAT/종합소득세/급여 소득 월평균을 무승인 중복 합산하지 않음; 실제 12개월 원문·사업소득 비용/승인 교차검증은 미실행.

## 5) 다음 r95 계산사무장

1. **Draft #212/#200의 범위를 분리 검토**하고 채권 원천 Fact(동일 사건/승인상태), `debtRows`, SQL feature, D5106 채권표, D5110/D5111 36/48/60개월 배분/우선·재단세금채권의 합계 구조를 실제 Node/SQL/DOCX에서 검증. null/0/외부 source-only/복수 채권·빈 채권 목록 반드시 포함.
2. #194/#203 변제원장 분류·세금 미지급액 및 #209 run 판본과 연결. 단순 기술적 `ready` / `reconciled`는 법률상 인가 확정이 아님.
3. 매 회차 main HEAD·blob SHA·보드 ID 충돌 확인 후 증빙 기록. 제품 최종 인수 **0건**; 운영 배포·운영 DB migration·법원 제출·인가 실행 금지.
