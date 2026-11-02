# FirmEngine A2 r70 — 사용자·서류담당자 / 서식 미확정 토큰의 사전검증·공개 표시 정합성

- 시각: 2026-11-02 10:15 KST. 역할 순환 **r69 IT → r70 사용자·서류 → r71 계산사무장**.
- 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이내. 합성 상태·숫자만 사용, 실고객/PDF/OCR/민감정보/키 없음.
- 시작 main HEAD **86bdae0ff040190e4d9b7d423ecbde441e0abe49**. 최근 A1 r70, A4/A3 r69, A2 r69 커밋 및 Draft #165/#163/#160/#157/#154/#141/#130, 이전 r69·r64 영수증 재조회.
- 핵심 실제 blob: main `lib/document-preflight.ts` **dc771c0ff0497d24df19478b0366ebbb397bfbf2**; #154 `lib/document-preflight.ts` **8bd541f99ca5d638686ac7cf53c14952c286492e**; #141 `lib/form-mapping.ts` **fed97085b02e95dc9d81024dc19f1550c087f46b**; main `lib/document-writer.ts` **42dc797739784b6d4354bdf377c5afe6e8fc3e5a**; SQL 0011 **0caa359d250dce45765d269d271ad63170ec3efa**.
- 기준정보: `lib/reference-decision-tables.json` blob **6924e3977caf748ce8a3d617fae15aff7d2fe2ce**; `lib/template-token-catalog.json` blob **899c4d564fcb1726861f89dcf04dbf1b7e372687**.
- 신규 분리 [**Draft PR #166**](https://github.com/firmengine/firmengine/pull/166), base=#154의 브랜치 `audit/a2-r64-doc-pending-marker-preflight-20261102-0411`, head=`audit/a2-r70-doc-marker-parity-20261102-1015`, 커밋 **8a44afe103a4cd9cd8c34fee189b58e278c42196**. 제품 main 미변경. 비교 파일 2개 모두 범위 내부; 법률·회계 의미 변경 없음.

## A. 검증 결함 — 동일 미확정 토큰이 공개 표시에서는 unresolved, 최종 사전검증에서는 ready

#154의 실제 `absent` 함수와 #141의 `classifyPublicFormToken` 전체 함수에서 **타입 표기만 제거하고 V8 격리 실행**. 공개 표시 측은 unresolved인데 서식 사전검증 측은 present로 취급하는 반례 6건을 식별했다. #165 승인 준비도는 별도 경로이므로 그것이 수정됐다는 이유만으로 D5103/D5110/D5111 출력 게이트가 안전하다고 보지 않았다.

| 합성 required 필드값 | 독립 기대(최종/draft) | #154 검사 원본문 | Draft #166 수정본문 |
|---|---|---|---|
| `[확인 필요] 원문` | blocked / draft_with_unresolved | present(위험) | absent(안전) |
| `[확인 필요]123` | blocked / draft_with_unresolved | present(위험) | absent(안전) |
| `[불일치]` | blocked / draft_with_unresolved | present(위험) | absent(안전) |
| `[불일치] 123` | blocked / draft_with_unresolved | present(위험) | absent(안전) |
| `[불일치·확인 필요] 검토` | blocked / draft_with_unresolved | present(위험) | absent(안전) |
| `source-only_bad` | blocked / draft_with_unresolved | present(위험) | absent(안전) |

**실제 실행한 것은 토큰 판별식 V8 격리검증 26개 입력:** 독립 안전 기대 기준 #154 **20/26**, #166 **26/26**. 누락·검토·상충·승인전·원문만·미관찰은 계속 fail-closed. 문자열 `"0"`·`[비해당]`·`[해당없음]`은 이 일반 **상태 판별식**에서 누락/0으로 임의 변환하지 않음; 조건부 법률 의미는 실무 확인 대상. `[검토완료]`은 #166 preflight가 여전히 보수적으로 absent, #141 display classifier는 unresolved=false(안전 방향의 비대칭 1건): 해당 수동 승인 표시의 공통 계약은 추가 검토 필요.

새 회귀 소스 `tests/a2-r70-doc-unresolved-marker-parity.test.ts` 는 **D5103/D5110/D5111 각각** 최종/초안/기존 미확정/문자열0을 테스트하도록 작성·커밋. **실제 프로젝트 Node 테스트·CI에서는 아직 실행하지 않음.** 위 26/26을 세 서식 전 과정 통과/실제 Word·공식 법원서식/변호사 승인으로 해석 금지.

## B. 실제 소비경로와 통합 차단 조건

main `lib/document-writer.ts::prepareDocumentWrite`는 `assessment.generationGate.canFinalize`와 서식별 `evaluateDocumentPreflight`의 blocker를 검토한다. 반면 #165의 `approval-readiness` 저장 상태 가드는 **별도 API/내부 업무 task 경로**다. 따라서 #165만으로 문서 writer의 `blocked/missing/provisional/source-only` 안전성이 입증됐다고 주장할 수 없다. 실제 제품 API→생성 DOCX→숫자·행·표시 토큰 재독은 **미실행**. 공개 렌더링 `classifyPublicFormToken`과 preflight `absent`의 공통 단일 helper 통합은 #141과 #154가 서로 다른 Draft base라 병렬 변경 덮어쓰기 방지를 위해 **이번 PR에서 하지 않음**.

## C. 정적 산식·SQL·서식과 독립 오라클

main JSON 재파싱: **18 계산모듈, 91 입력 선언(고유 78), 42 출력 선언(고유 40), resultPaths 42(고유 42)**. D5103 **37**, D5110 **55**, D5111 **82** 등록 토큰 각 중복 0. 실제 입력 전수 소비·Word 바이트 검증 아님.

합성 BigInt: 월급 2,400,000원×12 = **28,800,000원**. 사업 관측 월순소득 1,000,000원×11 = **11,000,000원**. 합계 **39,800,000원**. 사업 2026년 12월은 미래 미관찰 `null`이며 0원으로 보간하지 않음. VAT 60,000,000원과 전년도 종소세 20,000,000원은 각 `source-only` 비교 자료로 분리해 추가 합산하지 않음. 월 900,000원×36/48/60개월 명목 합계 **32,400,000 / 43,200,000 / 54,000,000원**. 현재가치 30,000,000과 청산가치 32,000,000 차액 **2,000,000원** — 법률 인정/현재가치 산정 완결 아님.

SQL 0011의 `value_json/value_won/status/source_fact_ids_json` 구조를 읽었으나 이번 r70 **SQLite/D1 저장 실행 없음**. 실제 원문→Fact→typed→SQL feature→DOCX 토큰 동등성도 미인증.

## D. 공식 원문 및 적용일 경계 (변호사 확인 전 자동 적용 금지)

- 서울회생법원 **2026-10-01 작성** [실무준칙 제424호 제2조 제2항 제7호 신설 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187) 웹 원문 재조회. 첨부 전문/부칙/경과조치·사건별 시행일 **미검증**. 공지일=모든 사건 적용일로 자동 판단 금지.
- 법제처 국가법령정보센터 [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) **[시행 2026-10-02, 법률 21490호]** 직접 웹 재조회. 3년 원칙·특별사정 5년 한계, 법원 인가/청산가치 요건은 내부 상태 판별과 분리.
- [국세청 VAT 신고·납부 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574) 일반과세 6개월·간이과세 통상 1년 과세기간 확인. 신고매출≠법원 인정 월순소득.

## E. A2 체크 ID 및 후속 (모두 [ ] 유지)

| ID | 이번 검증 | 남은 완료 조건 |
|---|---|---|
| A2-DOC-015 | required 최종 검토표시 6개 false-ready 판별식 재현·Draft #166 수정 | 실제 3서식 preflight, 직원 조건부 서류 확인, 생성 차단 E2E |
| A2-DOC-016 | 0/null/비해당/미관찰/상충/source-only/승인전의 **표시 분류** 26 입력 | 원문/Fact/typed/SQL/Word 동일 상태 재독, 필드별 NA 승인 |
| A2-DOC-018 | D5103 37 / D5110 55 / D5111 82 등록 토큰 정적 | 실제 DOCX 숫자·표·문단·반복행 바이트 재독 |
| A2-DOC-020 | #141 공개 판별과 #154 preflight 불일치 6건 및 보수적 차이 1건 | 공개 렌더 실제 상태/내부 source IDs·검토메모 비노출 E2E |

**다음 r71 계산사무장:** #166을 #154/#130/#141과 실제 Node 결합 후 #165의 별도 readiness와 `document-writer` 게이트를 독립 비교. 사업소득 월별·VAT/종소세 중복, 다채권/변제기간·원금/배분·0/null·미래월·가치 현재화의 실제 18모듈/91입력/42출력→D5103/D5110/D5111 재독. Draft 병합 전 실무자(서류담당자/계산사무장/변호사) 확인.

**제품 최종 인수 0건.** 전체 Node/CI·staging D1/R2/Cron·실제 DOCX 재독·공식 법원서식/변호사 승인·사이트 배포 미수행/미인증. 운영배포/운영 D1 마이그레이션/전자제출/법원인가 절대 실행하지 않음.
