# FirmEngine A2 r34 — 사용자·서류담당자: D5103 월별증빙·승인전 상태 통합 검증

- 기록: 2026-10-31 22:24 KST. 역할 순환 r33 IT → **r34 사용자·서류담당자** → r35 계산사무장.
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 경로만 Git 수정. 중앙 단일보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A2-DOC-004 / 015 / 016 / 018**를 부분감사, 네 ID 모두 `[ ]` 유지.
- 시작 main SHA `a3b1052a0dcd3b341966b9f3a2c387340241ba0e`, 시작 중앙보드 blob `93288bbd3f9b5ad94661ae532352d3efd0010ec2`. 직전 [A2 r33](2026-10-31_r33_2110KST_it-legal-calculation-preflight-reference-fence.md) 및 [A2 r28](2026-10-31_r28_1608KST_doc-final-approval-source-only.md), #58/#81/#76/#79/#91 Draft PR, 현재 main의 `document-preflight.ts`, `form-mapping.ts`, `document-writer.ts`, `form-contracts.ts`, 토큰 카탈로그·기준정보·SQL 0011 및 기존 테스트를 재독.
- main `document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`; #58 해당 blob `560935bbbc61f1c253b26a05ecd866840efd6da0`; #81 해당 blob `958cc86eb9461bec4aeeda8d6ef5d9dbee6849a9`; 새 [Draft PR #93](https://github.com/firmengine/firmengine/pull/93) 통합 blob `5f1deccc54f77d54f5f3b9f9a5ae2bf58428c773`, 별도 합성 Node 테스트 blob `b8283d89520321efb5d7dbd239d0aa5aa9394240`.
- #93 브랜치 `audit/a2-r34-doc-d5103-integrated-20261031-2216`, 생성 기준 main `a3b1052`; 제품 코드 `77246ee8`, 새 테스트 `150a9794` 커밋. GitHub PR은 Draft·미병합. 변경 파일은 허용 경로 내 두 개뿐.

## 합성 입력 구조와 독립 기댓값

입력은 실제 고객문서가 아닌 가상 급여 월별행이다. 원문 `SYN-WAGE-YYYY-MM` → Fact `period=2026-MM, income.net=2400000, source-only/observed` → typed `income(periodStart, periodEnd, amountBasis, netWon="2400000", factIds)` → 계산 18모듈의 `incomeRows`와 `monthlyIncomeWon` 프리뷰 → D5103 `rows.month[].{entity,period,net_income,revenue,expense}`, `monthly_income`(관측) vs `approved_monthly_income`(검토) 분리. 이것은 **구조 대응을 설명하는 논리적 합성 예시**이며 실제 OCR 추출/Fact 변환 API를 실행한 증빙이 아니다.

독립 정수 산술: 12×2,400,000원=28,800,000원, 11×2,400,000원=26,400,000원, 두 총액 차 2,400,000원. 선택 대표기간이 완전한 12개월이어야 한다고 자동 법률 규정으로 추론하지 않았으며, 첫·끝월 누락은 데이터 완전성 미확정으로 둔다.

실제 GitHub `drizzle/0011_case_calculation_features.sql` (blob `0caa359d250dce45765d269d271ad63170ec3efa`)과 같은 `case_calculation_runs`·`features`·`heads` 테이블 및 합성 `cases` FK를 인메모리 Python SQLite에 구성하여 4개 행 INSERT/재조회 **4/4 실제 일치**:
- `value_json='"0"', value_won='0',status='computed'` : 명시적 0 보존.
- `value_json='null',value_won=SQL NULL,status='missing'` : SQL NULL은 0 아님.
- `value_json='"2400000"',value_won='2400000',status='provisional'` : 관측 프리뷰와 승인 상태 별도.
- `value_json='"0"',value_won='0',status='blocked'` : **스키마만으로 숫자+blocked의 의미 충돌을 막지 못함**. #71 등 응용 계층의 상태 검증 필요.
이는 **SQLite 로컬 합성 실험**, 실제 Cloudflare D1/API/R2/고객 데이터가 아니다.

## 실제 코드 격리 검증: 중복 미병합 PR 방어 결합

#58의 월별행 없음·중간월 공백·정수원 그룹표시 검사와 #81의 관측 소득 대비 미승인 월액 검사를 동일 함수에 합쳤다. 실제 #93 GitHub 커밋의 함수 본문에서 TypeScript 타입 표기만 제거하여 V8 함수로 실행하고, 공식 토큰 카탈로그에서 계약 모양을 구성하였다(계약 메타 일부 mock, SHA 계산 mock, 법률산술 mock). **관측 결과가 비즈니스 인수/실제 Word 검증과 같지 않다.**

| 합성 조건 | 독립 기대 | main 또는 단독 PR 문제 | #93 커밋 코드 V8 관찰 |
|---|---|---|---|
| 12개월 source-only, 승인 월액 [확인 필요], final | 차단 | main/#58 ready | `blocked / D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED` |
| 동일, draft | 경고 | main/#58 별도 승인전 경고 없음 | `draft_with_unresolved / warning` |
| 12개월·승인 2,400,000원 | 숫자 프리뷰 유지 | 해당 승인경계 정상 | 내부 preflight `ready` |
| 명시적 승인 0원·월별행 0원 | 0 유지 | 해당 승인경계 정상 | `ready` (법원 인가 아님) |
| 12개월 중 **6월 누락** | 누락 경고/차단 | main/#81 통과 | `blocked / D5103_MONTH_COVERAGE_GAP` |
| 월별행 0, 승인 월액 존재 | 차단 | main/#81 통과 | `blocked / D5103_MONTH_ROWS_MISSING` |
| 미승인 월액 SQL null/undefined | 차단 | main/#58 통과 | 두 경우 모두 승인전 `blocked` |
| 6월 미관찰 표시 | 차단 | main도 구별 | `blocked / D5103_MONTH_EVIDENCE_UNRESOLVED` |
| 6월 명시적 0 | 누락으로 바꾸지 않음 | 상태 구별 | 증빙누락 코드 없음 |
| 잘못된 쉼표 `2,40,000` | 단위 검증 보류 | main/#81 통과 | `blocked / D5103_MONTH_EVIDENCE_UNRESOLVED` |
| **1월 누락** (2~12월 11행) | 선택 대표기간 연결 후 보류 | #58/#81의 현재 단독 검사 미탐지 | **ready; 기대 불일치, 미해결** |
| **12월 누락** (1~11월 11행) | 선택 대표기간 연결 후 보류 | #58/#81의 현재 단독 검사 미탐지 | **ready; 기대 불일치, 미해결** |

실제 커밋 대상 14개 V8 사례 중 **12개 관찰/기대 일치, 2개 의도적으로 실패 경계**. 별도로 미래월 `2027-01` 등은 날짜 형식만 맞으면 preflight 단독으로 현재성을 판별하지 못함. 선택 대표기간·사건 평가기준일을 연결하지 않은 상황에서 임의의 12개월 강제·무승인 자동규칙을 도입하지 않았다. 관측소득 자체가 없는 빈 경우에도 전용 승인전 코드가 생성되지 않는 것은 별도 인수 검토 대상이며 법원 제출의 적격을 뜻하지 않는다.

새 TypeScript Node 회귀 테스트는 이전 #81의 7개와 통합 확인 4개, 미해결 TODO 3개로 **파일만 작성**했다. **원본 프로젝트 `node --test`, TS typecheck, 전체 CI는 실행하지 않았음**. `document-writer.ts` main blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`에서 mode=final일 때 preflight blocker를 throw하는 호출(라인 164~165)을 **정적 확인**했지만 실제 생성/Word DOCX 확인은 하지 않았다.

현재 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 재파싱: 계산 **18모듈, 91입력 선언, 42출력 선언, 42 resultPaths**. `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5110 **55**, D5111 **82**. 실제 91입력→42출력 경로→DB→공식 Word 필드 종단검증 아님.

## 공식 시행일·법원·세무 근거 — 자동 법률 승격 금지

- 국가법령정보센터 채무자회생법 **법률 제21490호, [시행 2026-10-02] 제611조** (https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777): 원칙 3년/특별사정 5년 한도 및 재산·소득, 채권자목록 관련 변제계획사항. 이것이 D5103 무조건 12개월 또는 법적 인가를 뜻하지 않음.
- **서울회생법원 2026-10-01 공식 보도자료** (https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 **제424호 제2조 제2항 제7호 신설** 안내 확인. 첨부 개정전문 원문·부칙/경과조치, 개정시행일과 개별 사건 적용일은 이 회차 검증하지 못함. 공지일=개별 사건 적용일 추정 및 무승인 자동규칙 반영 금지.
- 국세청 VAT 일반·간이과세자 신고·과세기간 안내 (https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 6개월, 간이과세자 통상 1년으로 구분. 월별 관측 급여/사업 자료와 VAT/종합소득세 자료의 회계 중복 위험은 계속 미인증. 법률상 순소득/세무 인정 산식 변경 없음.

## 충돌·인수·다음 단계

- [Draft PR #93](https://github.com/firmengine/firmengine/pull/93)은 **#58 + #81 제안 기능 결합**이고, 두 기존 PR/다른 에이전트 수정은 덮어쓰지 않았다. main 제품 코드 미반영·미병합. PR 상태 Draft이며 충돌 및 정식 CI 검토 전 병합 금지.
- `A2-DOC-004 / 015 / 016 / 018`은 **부분검증 [ ]**, 제품 인수 완료 **0건**. V8 격리/SQLite 4행/정적 호출 ≠ Node 통합/CI/staging D1·R2·Cron/실제 DOCX/공식 서식·변호사 승인/사이트 배포.
- r35 **계산사무장**: 선택 대표기간 첫·중간·마지막 결손과 미래월, #67/#79/#76 계산·서식 영향, VAT/종소세의 다중 소득원/중복, #71 SQL 저장 roundtrip, #93 실제 프로젝트 Node·DOCX 생성 및 담당 변호사 승인 로직을 순차 감사. `source-only`·`unknown`·`null`·`0`·`not_applicable`·`conflict`·`unapproved`의 구별 고수.
- 운영배포/운영 D1 마이그레이션/실제 전자제출/법원 인가 확정: **수행하지 않음**. 개인·민감정보·키·.env·실제 OCR 원본값 공개 Git 기록 없음. 
