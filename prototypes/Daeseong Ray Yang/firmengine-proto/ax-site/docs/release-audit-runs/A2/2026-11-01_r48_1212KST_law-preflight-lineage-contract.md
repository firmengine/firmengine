# FirmEngine A2 r48 — 변호사 관점 / 소득 Fact 계보와 공식 서식 토큰 계약 충돌

- 회차: 2026-11-01 KST, 직전 r47 계산사무장 → 이번 **변호사** → 다음 r49 **데이터담당자**. 감사 축 **A2** 전용.
- 최초 확인 main HEAD: `4c90af55c7ae90ca4ad872918286694720759b1f`. 본 영수증 작성 직전 재조회 main: `4c90af55c7ae90ca4ad872918286694720759b1f`. 모든 코드·PR·문서는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래.
- 인수 보드 체크 ID: **A2-LAW-015, A2-LAW-020, A2-LAW-022, A2-LAW-023**. 네 ID 모두 **[ ] 부분검증·미인증**, 코드/시험/법원 승인 단계 구분.
- 참고: 직전 `docs/release-audit-runs/A2/2026-11-01_r47_1116KST_calc-source-stream-fact-lineage.md`, 기존 Draft #119(상위 #117/#115/#113/#108), #106 및 main 기준 계약/코드. 다른 작업자의 변경을 병합하지 않음.

## 신규 P1 — 검토용 계보 메타데이터가 3종 서식 계약을 모두 차단

실제 커밋된 소스와 SHA:
- main `lib/document-preflight.ts` **blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`**: `evaluateDocumentPreflight`는 공통 `bindings.rows`의 등록되지 않은 키마다 **`UNKNOWN_ROW_TOKEN` blocker**를 생성하고 `blockers.length>0`이면 `blocked` 반환.
- Draft #119 `lib/form-mapping.ts` **blob `cadd4c46bf2b10f0297a5f28c75ca85c833c08ab`**: D5103 `rows.month`에 공개 서식에 없는 5개의 **내부 검토용** 키 `source_id/source_stream_id/source_fact_ids/source_review_status/source_calc_role` 추가. 금액·기간은 원래 필드를 사용.
- main `lib/template-token-catalog.json` **blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`**: D5103 `month` 공개 등록 필드는 `entity,expense,net_income,period,revenue` 딱 5개. 위 내부 키 **0/5 등록**. D5110/D5111도 공통 `bindings.rows`를 검사하므로 다른 서식에 영향 가능.
- Draft #119 `lib/document-writer.ts` **blob `94b9c00d67577c280c8ad085f07fe69f2348d1bc`**의 호출 순서: `evaluateDocumentPreflight` → 선택월·소득원 검토 `checkSelectedIncomePeriodCoverage`. 내부 계보 검토 전 이미 서식 validator가 차단 코드를 넣을 수 있음.

**실제 실행 범위:** GitHub에서 기준·수정 `document-preflight.ts`와 공개 토큰 JSON을 다시 읽고, **그 파일의 정확한 반복행 검증 루프를 추출해 V8에서 실행**. 아래 금액/Fact/소득원은 오직 합성값이고 법률상 인정 아님.

| 합성 입력·형식 | 독립 기대(변경 전 → 수정 후보) | 실제 관찰(V8) |
| --- | --- | --- |
| D5103 한 월, 순소득 `2,400,000`, 내부 계보 5키 | 비등록 토큰 5 → **0** | **5 → 0** |
| D5103 12월(2026-01~12, 월 2,400,000원), 내부 계보 | 60 → **0** | **60 → 0** |
| 같은 월 binding을 사용하는 D5110 | 5 → **0** | **5 → 0** |
| 같은 월 binding을 사용하는 D5111 | 5 → **0** | **5 → 0** |
| 임의 `month.source_legal_approval` 추가 | 6 → **1** (임의키 거부 유지) | **6 → 1** |
| `creditor.source_id` 미등록 키 | 1 → **1** (거부 유지) | **1 → 1** |
| 공개 필드 5개만 있는 기존 월행 | 0 → **0** | **0 → 0** |
| 빈 월행(이 게이트만 검사) | 0 → **0** | **0 → 0** |

**총 8/8 경계 사례가 독립 기댓값과 일치**. `UNKNOWN_ROW_TOKEN` 수만 검증했으며, 빈 월행이 최종본 허가를 받는다는 주장이 아니다. 기존 코드에서 이 토큰의 blocker 처리와 최종 `blocked` 조건은 정적으로 확인. 전체 `evaluateDocumentPreflight()`, `calculateCase()`, `prepareDocumentWrite()`, 실제 DOCX 생성은 **미실행**.

## 수정안 및 독립 검토 필요

- **Draft PR #122:** https://github.com/firmengine/firmengine/pull/122 (상위 #119 브랜치 기반, main에 병합 금지).
- 수정: `lib/document-preflight.ts` **blob `315dde15a255ca5af248dcd6ec7cee2797496726`**. 정확히 내부 `month` 다섯 계보키에만 등록토큰 예외를 두고 다른 신규 키 및 `creditor` 임의키는 기존처럼 차단. 공개 `template-token-catalog.json`/서식 계약·소득 산식/법률 기준 변경 **없음**.
- 추가: `tests/a2-r48-internal-lineage-preflight.test.ts` **blob `bd0d00f4abb63d54b41142dee973fb419d3b452a`**, Node 테스트 5그룹 **작성·미실행**. 작업 브랜치 HEAD `21bd24528cea43fc69d19b9785619710e97af746`. 전체 CI/PR CI **미실행·성공 기록 없음**(GitHub combined statuses 0개, PR-triggered workflow runs 0개 조회). 테스트 소스 존재만으로 통과 표기 금지.
- #119에 반례·#122 링크 댓글 기록. **#119 자체의 정상 이직 6+6개월 과차단도 미해결**. 실제 사용자 승인된 급여지급자 ID·직장별 시작/종료월/휴직·계절적 사업 기간을 어떻게 연결·승인할지 결정 전 병합 금지.
- 예시 독립 산술: 합성 이직 급여 1~6월 매월 240만원, 7~12월 매월 270만원이면 관측 합계 **3,060만원**, 12개월 단순 평균 **255만원**. 지급자별 6개월 누락은 반드시 오류라고 볼 수 없고, 어떤 금액도 법원 인정 월소득으로 자동 승격 금지.
- 원문/Fact/typed/SQL feature/Word 전체 재독은 미실행. `source-only`, `null`, 명시적 `0`, `not_applicable`, 상충, 승인 전은 별도 상태로 유지. 금액과 인가가능성 무단 확정 금지.

## 18모듈/91입력 및 서식 계약 정적 대조 (실행 아님)

- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: `calculations=18`, 입력 선언 **91**(고유 **78**), 출력 선언 **42**, `resultPaths=42`.
- main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5110 **55**, D5111 **82** 등록 토큰. 수량이 맞아도 Word/법원서식 동등성 확인은 아님.
- 변제·채권 배분·청산가치·VAT·종소세 계산금액의 실제 18모듈 E2E는 이번 회차 미검증. 월별 급여·사업소득·원천과 법적 변제재원은 구별.

## 2026-11-01 공식 원문 대조 / 시행일·관할

1. **국가법령정보센터:** 채무자 회생 및 파산에 관한 법률 **[시행 2026-10-02, 법률 제21490호, 2026-03-24 타법개정]** 제611조(변제계획 내용·기간), 제614조(인가요건·변제액 현재가치/청산가치). https://www.law.go.kr/LSW/lsLinkProc.do?joNo=061100&lsNm=%EC%B1%84%EB%AC%B4%EC%9E%90+%ED%9A%8C%EC%83%9D+%EB%B0%8F+%ED%8C%8C%EC%82%B0%EC%97%90+%EA%B4%80%ED%95%9C+%EB%B2%95%EB%A5%A0&mode=11 ; https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . **개별 사건의 접수일·인가일에 따라 판본/경과규정을 대조해야 하며 이 판본 확인만으로 모든 사건 적용 확정 금지.**
2. **서울회생법원:** **2026-10-01 보도자료**에 실무준칙 제424호 제2조 제2항 **제7호 신설** 문구 명시. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . **첨부 PDF 개정전문·부칙·경과·사건별 적용 효력 검증은 미완료**, 서울 외 법원 자동 적용 금지. 법원/변호사 승인 없이 단축기간 자동규칙 변경 금지.
3. **국세청:** 일반 VAT 과세기간 원칙상 반기, 간이과세자 통상 연간 신고. https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 . VAT 총매출, 종소세 신고액, 순사업소득, 개인회생 인정소득 자동 동일시 금지.

## A2 ID 및 다음

- **A2-LAW-015 [ ]**: 공식 10/01 개정 공지의 제7호 신설만 확인, 개정전문·사건별 효력 미인증.
- **A2-LAW-020 [ ]**: 공개 D5103/D5110/D5111 등록 토큰과 내부 review lineage 충돌 직접 재현, #122 Draft 격리 방어; 실제 Word·전자소송 원본 대조 미실행.
- **A2-LAW-022 [ ]**: 내부 Fact 검토키 존재 ≠ 금액 승인·인가. `UNKNOWN_ROW_TOKEN` 과차단 해결 후보는 준비되었으나 소득중복/상충/법률산식 전체 연결 미완료.
- **A2-LAW-023 [ ]**: 승인 전/미관찰/source-only/명시0 구분, 6+6 정상 이직도 승인 우회 설계 없이 자동 인정 금지.
- 다음 r49 **데이터담당자**: #119의 Fact/소득원/관측기간 메타가 preflight/Word에 유출되거나 누락되지 않는지 확인, reviewer-approved interval 계약의 소스/버전/행 바인딩 설계 및 #122+ #119 + #106 실제 Node 통합시험. 이후 SQL feature `value_json` vs `value_won` 불일치와 지급액 배분 검증.

**제품 인수완료 0건**. 실제 Node 단위/전체 CI/staging D1·R2·Cron/실제 DOCX·공식서식·변호사/계산사무장 승인/사이트 배포는 모두 미검증. 운영 배포, 운영 D1 migration, 전자제출, 인가 확정 **실행하지 않음**. 공개 Git에 실제 의뢰인 문서·개인정보·비공개 정답·원본 OCR 사실·토큰/.env 미기록.
