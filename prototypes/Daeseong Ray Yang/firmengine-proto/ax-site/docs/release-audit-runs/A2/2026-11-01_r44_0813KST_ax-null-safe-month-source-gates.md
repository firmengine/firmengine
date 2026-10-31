# FirmEngine A2 r44 — AX담당자 소득 월행 계약·소득원별 관측기간·서식 승격 감사

- 기준: 2026-11-01 KST. r43 데이터담당자 → **r44 AX담당자** → r45 IT담당자.
- 감사 시작 main HEAD: `0207a76cc4e73ad8112f1722ac4927556f5c6ecd`; 영수증 쓰기 직전 HEAD: `0207a76cc4e73ad8112f1722ac4927556f5c6ecd`.
- 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 중앙 단일 보드의 **A2-AX-004, A2-AX-010, A2-AX-012, A2-AX-017**만 부분 재검증, 모두 **[ ] 미인수**.
- 기존 근거: r43 `2026-11-01_r43_data-source-stream-cutoff-sql-evidence.md`, r42 법률 감사, r41 PR #108 및 테스트, r40 PR #106, r38 PR #102, r35/36 PR #96/#98, PR #97. 최근 main 및 여러 Draft PR은 상호 병합되지 않은 상태로 각각 읽었다.
- main 주요 blob: `assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `income-resolution.ts` `f370c4b14fd347089708c5c3241fa9c72522d4bf`; `form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; `document-writer.ts` `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`; `document-preflight.ts` `dc771c0ff0497d24df19478b0366ebbb397bfbf2`; SQL 0011 `0caa359d250dce45765d269d271ad63170ec3efa`; feature store `bb5f88b26e68f5ae2234741063ac9301a927e27a`. 이는 소스 읽기이며 전체 런타임 테스트가 아니다.

## 1. PR #108 원함수 TypeScript 제거 V8 격리 14건

- 실제 소스: PR #108 `lib/income-period-coverage.ts` blob `d3cc44be8fc18b5760d280f1e8aee9076`. TypeScript 선언/주석만 제거 후 `checkSelectedIncomePeriodCoverage` 본문을 V8 `new Function`으로 실행. 시각·금액·로직 mock 없음.
- 합성 대표기간: 2026-01-01~12-31. 급여 월 2,400,000원 × 12 = 28,800,000원, ×11 = 26,400,000원. 별도 사업 월 1,000,000원 ×11 = 11,000,000원; **각 독립원천 모두 승인된 경우에만** 월합 3,400,000원은 단순 산술 참고값.
- 독립 기대는 **데이터·안전성 검토보류**의 오라클이며 법률상 인정 또는 서울회생법원 12개월 필수기간 주장이 아님.

| 합성 입력 / 조건 | 독립 기대 | PR #108 실제 | 의미 |
|---|---|---|---|
| 급여 12월 완비, cutoff 2027-01-01 | complete | complete | 월 union 정상 |
| 급여 12월 + 사업 11월(12월 누락) | 원천별 review_required | **complete** | 별도 원천 ID가 helper 입력의 검증키가 아님 |
| 급여 12월 + 사업 1월 1건 | 원천별 review_required | **complete** | 다른 원천이 결손을 은폐 가능 |
| cutoff 2026-10-01, 10월 전체금액 | 관측종료시점 검토 | **complete** | cutoff 월 내부 날짜 미고려 |
| cutoff 2026-10-31, 11-12월 | review_required | review_required | 명시된 미래월 검출 |
| cutoff 미관찰, 2026-11~12월 포함 | 기준일 검토보류 | **complete** | 미관찰은 미래월 입증이 아니라 불확실 |
| source-only 원천 검토상태 메타만 추가 | 검토 보류 | **complete** | helper 계약 바깥 메타라 무시(제품 오류 입증 아님) |
| 문자열 "0" 월행 | complete | complete | 실제 관측 0 보존 |
| `net_income: null` | review_required | **TypeError trim** | 비정형 경계 예외 |
| `net_income: 0` (숫자형) | review_required | **TypeError trim** | 0원 문자열과 숫자형 혼동 |
| 월행 `null` | review_required | **TypeError period** | 비정형 행 예외 |
| 1월 누락 | review_required | review_required | 정상 |
| 12월 누락 | review_required | review_required | 정상 |
| 금액 `2,40,000` | review_required | review_required | 쉼표 오류 정상 차단 |

**14건 실행 / 6건 독립 기대 일치 / 8건 불일치·예외**. 이들 중 원천별/cutoff/source-only 사례는 실제 `calculateCase()` 상위 방어가 추가 차단할 수 있어 제품 오류로 단정하지 않는다. **새로운 확인 가능한 코딩 결함**은 비정형 월행·`null`·숫자형 0이 helper에서 검토 결과 대신 예외를 발생시키는 경계 동작이다. TypeScript `FormBindings` 정상 구성 시 문자열만 기대하므로 해당 비정형 입력이 제품에서 실재하는 경로까지 증명된 것은 아니다.

## 2. 보정 구현 및 실제 실행

- 직접 PR #108 브랜치를 수정하지 않음. 해당 head `f1916651bb09ba5c26b1994060f7b3e4981ed6df`에서 **별도 stacked Draft PR #113** 생성, base는 PR #108 브랜치(아직 main 직접 병합 아님).
- 변경: `lib/income-period-coverage.ts`의 `validWon`이 문자열 타입일 때만 `.trim()` 호출, null/non-object 월행은 기존 `D5103_MONTH_EVIDENCE_UNRESOLVED`/누락월로 정형 보류. 어떠한 소득 금액도 0으로 보정하지 않음.
- **수정된 GitHub 소스(blob `0ba7e7bdace572bad849e56e0b5752c153a3a96d`) 재독 후 TypeScript 제거 V8 8/8 독립 기대 일치**: null 금액, 숫자형 0, boolean 금액, null 행, 숫자 행, 잘못된 쉼표 금액 → 모두 review_required; 문자열 "0" 및 "2,400,000" → complete. 별도 테스트 파일 blob `6eb6d5ee7f5e0fbc39e67d35c751d30443d891ee`, Node 테스트 8건은 **작성/커밋했으나 프로젝트 Node runner 실행 안 함**.
- PR #113 `https://github.com/firmengine/firmengine/pull/113`, PR #108 검토 의견 comment `6550468153`. PR #113 변경 파일은 `ax-site` 아래 정확히 두 개로 재조회.
- **법률·산식 의미 변경 없음**, main 제품 코드 미변경, Draft 병합 보류.

## 3. 현재 계산·저장·서식 정적 계약 재독

- `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18모듈 / 입력선언91(고유78) / 출력42(고유40) / 저장 resultPaths42(고유42)**.
- `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37 / D5110 55 / D5111 82** 토큰. `public/templates/catalog.json` blob `9bae52fdf47fbc0935314bb5267503e4182080bd`: 등록 서식 매핑 35/53/80, `approval_status=reviewer_pending`. 두 관리용 토큰 차이는 기존 문서대로 별도 검토, 실제 DOCX 바이트 미검증.
- `form-mapping.ts`에서 `rows.month`는 `entity,period,revenue,expense,net_income`만 투영하여 지급자·소득원 ID/Fact IDs/기간말일/원천 검토상태를 반환하지 않음. `document-writer.ts`와 Draft #108 모두 이 투영값만으로 월 완결성을 검사함. `assessment.ts`의 `incomeGroups`에는 별도 coverageIncomplete 방어가 있어 **상위에서 차단 가능성을 미확인 상태로 보존**.
- SQL 0011은 `value_json/value_won/status/source_fact_ids_json` 별도 저장. r43 합성 replay 9/9는 **이전 회차 실행 증거**이며 이번 r44에서 SQLite/실 D1 재실행한 것으로 주장하지 않는다. null/0/승인 전 상태를 SQL 저장 성공과 동일시하지 않는다.

## 4. 공식 조문/관할·시행일

- 국가법령정보센터 `채무자 회생 및 파산에 관한 법률` **[시행 2026-10-02, 법률 제21490호]** 제611조(변제계획의 내용/변제기간), 제614조(인가요건): https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 , https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 (2026-11-01 원문 웹 재조회).
- **서울회생법원** 2026-10-01 보도자료는 실무준칙 제424호 제2조 제2항 제7호 신설을 확인: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187. **첨부 개정전문 부칙·경과조치, 사건별 적용일은 미인증**; 공지일을 시행일이나 전국법원 자동규칙으로 승격하지 않음.
- 국세청 공식 VAT 신고 안내: https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 (2026-11-01 재조회). 일반과세자 반기별/간이과세자 원칙 연간 과세기간은 세무 기준일 뿐 사업 순이익/종소세 신고액/법원 인정소득과 동일하지 않음.

## 5. 선택 A2 ID별 인수 판정 / 후속

- **A2-AX-004 [ ]**: null vs 숫자 0 vs 문자열 "0", source-only·미관찰 분리. 비정형 입력 예외는 PR #113 후보, 본 프로젝트 통합 미실행.
- **A2-AX-010 [ ]**: 복수 소득원 12+11 / 12+1, 첫·끝월 / 미래월 합성. 월 union 한계 확인; `calculateCase()` 통합 미실행.
- **A2-AX-012 [ ]**: 관측 소득·계산·서식 승인 금액의 상태 승격 경계. main D5103 월행에 source IDs 불포함, Draft #106/#108/#98/#102 결합 미실행.
- **A2-AX-017 [ ]**: 공식 법률 시행판과 내부 상태 구분, 변호사/계산사무장 승인·공식 서식 검증 전 법률상 인증 불가. 개정 준칙 사건 적용일 불명.
- 후속 **r45 IT담당자**: #113→#108 스택 검토, #106 및 #97/#96/#98/#102 병합 경로를 독립 branch/CI에서 재현. 월행마다 지급자·소득원 안정 ID, Fact refs, 기간 시작·종료, 관측 종료일/cutoff, review state를 별도 내부 계약으로 유지한 뒤 `calculateCase()`→`prepareDocumentWrite()`→D5103/5110/5111과 SQL 42출력 일치 시험. 기간별 VAT/종소세 중복도 source-of-truth 타입 대조.
- **제품 인수 0, 전체 Node CI 미실행, staging D1/R2/Cron 미실행, 실제 DOCX·공식서식 parity 미검증, 법률·세무 실무 승인 미인증**. 실제 고객정보/OCR 사실값/키/.env/비공개 정답 없음; 운영 배포/운영 D1 migration/전자제출/법원 인가 확정 실행 없음.

> 코드 존재 ≠ V8 격리 합성 ≠ 전체 Node/CI ≠ staging D1·R2 ≠ 실제 DOCX ≠ 공식 법원 서식 ≠ 변호사·회계 승인 ≠ 법원 인가.
