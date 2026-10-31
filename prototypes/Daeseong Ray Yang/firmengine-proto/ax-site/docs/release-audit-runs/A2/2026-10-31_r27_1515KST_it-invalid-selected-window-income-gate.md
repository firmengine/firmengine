# FirmEngine A2 r27 — IT담당자: 무효 대표기간의 case-wide 월소득 금액 게이트

- 감사일 2026-10-31 KST, r26 AX → **r27 IT** → r28 사용자·서류담당자.
- 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위. 초기 main HEAD `388bf8d83dbb0e0c6a0f4f90280da5e95ca6c4ea`. 읽은 자료: 중앙 보드 A2 ID, r26 영수증, 최근 main commits/PR #58/#67/#71/#76, `assessment.ts`, `income-resolution.ts`, `form-mapping.ts`, `document-preflight.ts`, `case-calculation-feature-store.ts`, `preapproval-calculation-replay.ts`, SQL `0011_case_calculation_features.sql`, `package.json`, PR #76 테스트 및 계산·서식 카탈로그.
- 부분 검증/미완료 **A2-IT-002, A2-IT-012, A2-IT-017, A2-IT-018**. 제품 인수완료 **0건**, 법률·회계·공식서식 미인증.

## P1 코드 결함 — A2-IT-002 / 017

`lib/assessment.ts` main Git blob **`ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`**에서 `monthSpan`·`aggregateIncomeObservations` 실제 함수 본문(타입 선언만 제거)을 V8 격리 실행: `2026-01-15~2026-12-31` 및 `2026-01-01~2026-12-15`처럼 **불완전한 선택 대표기간**은 `INCOME_FILING_PERIOD_INVALID`를 기록하나, 동일 월 소득 2,400,000원 × 12개월 관측이 있으면 그룹 `total=2400000`을 반환. 외부 `calculateCase`의 `income` 조건은 `coverageIncomplete`는 검사해도 **`hasFilingPeriod && !filingPeriodValid`는 검사하지 않으므로 case-wide `monthlyIncomeWon`을 null로 막지 못할 수 있음**. 이는 소득 원천 월액 자체를 바꾸라는 법률 주장이 아니라, **무효 기간의 산술 집계 결과를 사건 확정 금액으로 재사용하지 못하도록 하는 내부 경계**.

합성 원문/Fact/typed 모델(실 DB 미기록): 가상문서 `SYN-doc` → 각 월 `F-2026-01...` verified/source-linked `income.net=2400000` → `I-YYYY-MM` 완전달력월 `amountBasis=monthly` → 집계/출력. 실제 원본 OCR/고객자료·서식 생성·SQL I/O를 사용한 것이 아님.

| 합성 대표기간/월 관측 | 독립 기대 case-wide 원화 | main 조건식 | PR #79 조건식 |
|---|---:|---:|---:|
| 2026-01-01~12-31, 12/12 월 | 2,400,000 | 2,400,000 | 2,400,000 |
| 2026-01-01~12-31, 첫달 11/12 | null | null | null |
| 위 기간, 중간달 11/12 | null | null | null |
| 위 기간, 마지막달 11/12 | null | null | null |
| **2026-01-15~12-31, 12/12** | **null** | **2,400,000 오판** | null |
| **2026-01-01~12-15, 12/12** | **null** | **2,400,000 오판** | null |
| 2026-01-01~02-30, 2개월 입력 | null | null | null |
| 역전된 기간, 12개월 입력 | null | null | null |
| 완전기간·명시적 0원, 12/12 | **0** | 0 | 0 |
| 미래기간 2027, 2026 자료만 존재 | null | null | null |

- **V8 격리 산술·게이트 비교:** main **8/10**, 제안 **10/10** 독립 기대 일치. 첫·중·끝단 11/12의 null은 기존 외부 coverage 분기에서 도출되는 **단위 격리**이며, full `createCase→calculateCase→DB→Word` 통과를 뜻하지 않음.
- 별도 실제 함수본문 V8 순서 테스트 **3개 배열(정순/역순/홀수월 우선)**에서 동일 관측 12개월 평균 **2,400,000원**, observedMonths=12, 그룹 sourceIds 순서는 서로 달라 **최종 실행 결과 hash 순서 독립성은 미인증**(A2-IT-012 [ ]).
- 부분 시작/종료 두 반례의 독립 산술 관측합계는 2,400,000 × 12 = **28,800,000원**이지만 이는 대표기간 승인 월소득이 아님.
- PR #76의 `form-mapping.ts`는 별도로 승인 토큰을 보류하도록 제안 중이지만 **Draft 미병합**. 따라서 case-wide 계산 API/SQL 경계도 독립적으로 필요. `0` / null / missing / source-only / blocked / 법률 승인전 구분.

## 수정·검증·충돌 제어

- **[Draft PR #79](https://github.com/firmengine/firmengine/pull/79)** (main 미병합), 브랜치 `audit/a2-r27-it-invalid-selected-period-20261031`, HEAD **`cb9ed102c81830a7356b457ffd2f61c83e29a90a`**. 코드 커밋 `4d7eb76225130f7a007552ea451457b3ccd42d7d`; 신규 테스트 커밋 `cb9ed102c81830a7356b457ffd2f61c83e29a90a`.
- `lib/assessment.ts`의 case-wide `income` null 조건에 `(hasFilingPeriod && !filingPeriodValid)`만 추가. 원천·Fact·소득 관측 행 삭제/0원 대체 없음. 법정 대표기간 자동선정이나 세무·회계 산식 변경 없음.
- 신규 `tests/a2-r27-selected-period-income-gate.test.ts` **5그룹 작성·미실행**; 권장 실행 `node --experimental-strip-types --test tests/a2-r27-selected-period-income-gate.test.ts`. 네이티브 Node 프로젝트 테스트/빌드/CI 성공 주장은 금지.
- PR diff **2개 파일 모두 지정 디렉터리 내부**. **PR #67이 동일 `lib/assessment.ts`를 수정**하므로 자동 동시 병합 금지, 충돌·통합회귀 검토 필수. 기존 #58/#71/#76 파일 변경 없음.

## 등록 산식·서식·저장 계약 대조

- main `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 계산 **18모듈 / 입력 91 선언(고유 78) / 출력 42 선언(고유 40)**. `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**·D5110 **55**·D5111 **82** 토큰.
- SQL `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: `value_json TEXT NOT NULL`, `value_won TEXT` (nullable), `status TEXT NOT NULL`. `case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`는 원화 문자열 저장·원천행 상태를 별도로 기록. **실제 D1 INSERT/SELECT·API 응답·42 결과 원단위 출력·Word 토큰 대조는 미수행**: A2-IT-002 [ ] 유지.
- 참고: PR #71이 SQL 저장 재검산의 missing/null/0 구분을 다루나 미병합이며 이번 #79가 그 코드를 검증/변경한 것은 아님.

## 공식 출처·법원/시행 경계 — A2-IT-018

- [국가법령정보센터, 채무자회생법 제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221): **[시행 2026-10-02], 법률 제21490호(2026-03-24 타법개정)**. 3년 원칙/특별사정 최대 5년 규정; 이번 소득 무결성 수정이 36/48/60회나 인가요건 자동결정 아님.
- [서울회생법원 공식 게시(2026-10-01)](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 **제424호 제2조② 제7호 신설** 공지. 첨부 개정전문 PDF **부칙·경과조치·사건별 적용일 미검증**; 공지일=시행일로 간주 금지. 무승인 자동규칙 적용 금지.
- [국세청 부가가치세 과세기간](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272): 일반과세자 통상 6개월, 간이과세자 통상 1년; 사업매출/VAT/종소세가 인정 순소득으로 자동 중복 산입되어서는 안 됨. 세무 산식 실증/전문가 승인 없음.

## 인수 제한·차기

- **A2-IT-002 / 012 / 017 / 018 모두 [ ]**. 실제 고객 원문/개인정보/원본 OCR 값/키/.env/비공개 정답을 Git에 올리지 않음.
- 다음 r28 **사용자·서류담당자**: PR #79 + #67 동일파일 충돌해결 제안의 완전 Node 테스트, PR #58 D5103 끝단 누락과 #76 대표기간 token, #71 SQL 결과를 **한 작업트리에서** 11/12/0/null/미래월/휴직 합성 검증 → 실제 Word 바이트/공식서식 대응 확인. 지속해서 채권/재산/청산가치/36·48·60 배분/부가세·종소세 이중계산을 점검.
- **전체 CI / staging D1·R2 / Cron / Word·공식 법원서식 / 변호사 승인 / 사이트 배포 전부 미인증.** 운영 배포·운영 D1 마이그레이션·실제 법원 전자제출/인가 행위 없음.
