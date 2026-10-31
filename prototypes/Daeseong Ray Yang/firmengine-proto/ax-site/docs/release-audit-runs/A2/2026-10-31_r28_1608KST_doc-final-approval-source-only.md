# FirmEngine A2 r28 — 사용자·서류담당자: D5103 미승인 월소득의 final-ready 오판 감사

- 일시: 2026-10-31 KST. 순환: r27 IT → **r28 사용자·서류담당자** → r29 계산사무장.
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 시작 main `c374bd88674a65394c31f679a3f0819f92dafd4e`; 본 영수증 저장 직전 main `c374bd88674a65394c31f679a3f0819f92dafd4e`. 최근 main A1/A3/A4 타 에이전트 변경은 유지.
- 이전 [A2 r27 영수증](2026-10-31_r27_1515KST_it-invalid-selected-window-income-gate.md), 중앙 단일보드 A2-DOC ID, PR #58/#67/#71/#76/#79, schema/calc/폼 카탈로그와 실제 `document-preflight.ts`, `form-mapping.ts`, `assessment.ts`, `case-calculation-feature-store.ts` 및 해당 PR 테스트를 읽음.
- 선택: **A2-DOC-004 / A2-DOC-015 / A2-DOC-016 / A2-DOC-018**. 네 ID 모두 **부분검증 [ ] 유지**, 제품 인수 완료 0. 본문 내용은 공개 가능 합성 자료만 포함.

## P1 후보: 관측 월소득만으로 D5103 final ready 반환

실제 main `lib/document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`, D5103 토큰 catalogue `899c4d564fcb1726861f89dcf04dbf1b7e372687`, `form-contracts.ts` `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef`, `legal-form-field-policy.json` `f6ea8211ff1f4e4c1339165e510e2120d2d4775b` 대조. 현재 D5103 `approved_monthly_income`은 `requiredness:unverified`라 승인값 `[확인 필요]`에서도 필드 경고만 발생하고 final status는 `ready`가 될 수 있음. 이 사실은 법원 필수항목이나 법적 소득 인정이라는 주장이 아님. **내부 직원 최종확인 경계** 위반 후보.

실제 함수 본문(타입 선언만 제거, hash/법률 산술 mock) + **Git의 실제 D5103 37토큰/내부 requiredness**를 이용한 V8 단위 격리. 독립 목표는 미승인 관측액은 final 차단, draft 경고, 정상 승인과 명시적 0원은 보존:

| 합성 입력/형식 | 독립 기대 | main 관찰 | Draft PR #81 관찰 |
|---|---|---|---|
| 가상 급여 2026-01~12 12행 × 2,400,000원; monthly_income 2,400,000; approved_monthly_income `[확인 필요]`; final | blocked | **ready (P1 거짓 통과)** | blocked / `D5103_APPROVED_MONTHLY_INCOME_UNRESOLVED` |
| 동일 source-only, draft | warning / draft_with_unresolved | draft_with_unresolved, 승인전 별도 경고 없음 | 승인전 경고 / draft_with_unresolved |
| 12행·승인 월 2,400,000원 | ready (다른 서식·법률 인수 의미 아님) | ready | ready |
| 12행·승인 **명시적 0원** | ready, 0 유지 | ready | ready |
| 미관찰 `monthly_income=[확인 필요]`, 행 0, 승인전 | 새 승인조건에서 추정 금지 | ready | ready |
| 관측 2,400,000원, 승인 SQL-의미 `null` | blocked | **ready** | blocked |
| 관측 2,400,000원, 승인 `undefined` | blocked | **ready** | blocked |

**단위 격리 독립 기대 일치 main 4/7 → PR #81 7/7.** 코드/기준 카탈로그는 실제 Git blob에서 읽었으나 완전한 TypeScript module import·원본 Node22 프로젝트 테스트, 실제 D1 API 저장, 실제 Word 생성이 아님. 신규 Node 테스트 **7그룹 작성, 미실행**. `[확인 필요]`와 SQL null은 별도의 상태이며 두 상태 모두 승인액으로 승격하지 않음.

### 시뮬레이션 데이터 계층과 SQL 경계

합성 서류 `SYN-DOC`의 월급여 관측 → 합성 Fact `F-2026-MM income.net=2400000, month=2026-MM, source-backed/verified` → 합성 typed 소득 `I-2026-MM monthly/month-start~month-end, amountWon="2400000"` → 18모듈 입력/계산 관측 프리뷰 → D5103 월별행/승인 토큰. 이는 계약에 맞춘 **논리적 가상 입력**이며 실제 OCR Fact를 DB에 INSERT하지 않음. SQL 실제 `0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`: `value_json TEXT NOT NULL`, `value_won TEXT` nullable, `status TEXT NOT NULL`. SQL `null` / 명시적 `"0"` / source-only / blocked / 법률승인전은 구별. 이 회차 실제 SQL INSERT/SELECT·staging D1은 미실행.

PR #76의 실제 `rows.month` 생성 코드 조각을 V8 격리: 선택기간 2026-01~12와 가상 2025-12/2027-01 금액 240만은 main 서식에 정상금액 표시, PR #76은 두 기간외 행을 보존하되 `[확인 필요]`; 2026-12의 명시적 0은 `0` 유지, 2026-06 미관찰은 `[확인 필요]`. 실제 Fact/DB/Word 관통 검증 아님.

PR #58 실제 D5103 월행 preflight 블록 격리 10건: main **7/10**, PR #58 **10/10** 해당 내부 기대 분기 일치. 중간 6월 빠짐은 PR #58의 `D5103_MONTH_COVERAGE_GAP`으로 final 차단/draft 경고, 행 0이면 `D5103_MONTH_ROWS_MISSING`. **첫월/끝월 11/12 누락은 서식의 관측행만으로 미탐지**. 계산엔진의 선택기간 완전성 검사를 결합한 end-to-end 시험 없이는 최종 오승격을 확정할 수 없음.

등록계약 JSON 재파싱: 계산 **18모듈**, 입력선언 **91**(고유 78), 출력선언 **42**(고유 40), resultPaths **42**(고유 42); 출력 이름 `status`/`totals`은 여러 모듈에 있으나 고유 경로를 통한 구별. D5103 **37**, D5110 **55**, D5111 **82** 토큰; 실제 91입력→42경로→SQL→Word 전수는 **미검증**.

## 수정 PR·충돌 및 독립성

- [Draft PR #81](https://github.com/firmengine/firmengine/pull/81), 브랜치 `audit/a2-r28-doc-income-approval-guard-20261031`, HEAD `211fc98661dcca43b425c9df14ae84c54daace03`. `lib/document-preflight.ts` 코드 커밋 `aba843ae4508c6290c3eb7016628e49f07e91978`; 신규 `tests/a2-r28-d5103-approval-gate.test.ts` 7그룹 커밋 `211fc98661dcca43b425c9df14ae84c54daace03`.
- source-only 금액 관측 + approved 토큰 absent일 때만 final blocker / draft warning 추가. 소득액·기간을 임의 보정하거나 0원으로 대체하지 않고, 세무/VAT/법률 인정 또는 관할자동화 규칙은 변경하지 않음.
- PR #58이 **동일 파일** `document-preflight.ts`에 독립 검사를 추가함. #58과 #81을 **한 작업트리에 통합해 실제 Node 테스트·Writer 최종 출력 검사 후 사람 검토**해야 함. PR #67·#79는 `assessment.ts` 동일 파일, #76은 `form-mapping.ts`, #71은 SQL replay; 독립 Draft 제안이며 모두 main 미병합. 다른 에이전트 변경에 대한 overwrite/merge 없음.
- 신규 테스트 소스는 작성·Git SHA 재조회, PR 변경 파일 2개가 전부 지정 디렉터리임을 확인. **Node 테스트 미실행 / 전체 CI 미인증 / staging D1·R2·Cron 미인증 / DOCX·공식 서식 동등성 미인증 / 변호사·세무회계 실무자 승인 미인증 / 운영 사이트 배포 미인증**.

## 법령·법원·세무 공식 근거(적용일 미확정 규칙 자동도입 금지)

- [국가법령정보센터 「채무자 회생 및 파산에 관한 법률」 제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221): **2026-10-02 시행판**, 법률 제21490호(2026-03-24 타법개정); 3년 원칙/특별 사정 5년 이내. 이 내부 승인토큰 변경은 법적 변제기간 결정·법원 인가가 아님.
- [서울회생법원 2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 **제424호 제2조 제2항 제7호 신설 공지**. **첨부 개정전문/부칙·경과조치·개별 사건 적용일은 이 회차 미검증**, 공지일과 사건 적용일 동일하다고 주장·자동 적용 금지.
- [국세청 VAT 신고 과세기간 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272): 일반/간이과세자 신고기간 구별. VAT 매출/종소세 서류를 중복 계산하거나 순사업소득 자동 인정하지 않음; 상세 세무 산식·직원 확인 미완료.

## 차기 r29 (계산사무장)

A2-CALC 중 미검증 ID 2~5개를 단일 보드에서 선택: PR #67+#79 부분월/무효 대표기간의 실제 프로젝트 Node 결합, #58+#81 D5103 마지막/첫 누락과 승인 전 final 차단, #71 SQL replay 실제 저장·독립산술 대조. 급여·사업소득 월별/부가세·종소세 중복·채권/재산/청산가치·36/48/60회 원단위 배분에 확대하되 법률/세무 실무자 승인 전 [ ] 유지.

**이번 회차 제품 인수 완료 0건, 4개 A2 ID [ ] 유지.** 운영 배포, 운영 D1 마이그레이션, 실제 전자제출·법원 인가 확정 미수행.
