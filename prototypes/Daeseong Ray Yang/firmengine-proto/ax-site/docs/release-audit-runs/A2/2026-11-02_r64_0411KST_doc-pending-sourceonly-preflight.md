# FirmEngine A2 r64 — 사용자·서류담당자: 미관찰·승인전·원천만 필드의 서식 사전검증 불일치

- 검증 시각: **2026-11-02 KST**. 역할 순환 r63 IT담당자 → **r64 사용자·서류담당자** → 다음 **r65 계산사무장**.
- 작업 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. **실제 고객정보, OCR 사실값, 사건 데이터, 비공개 정답, 키, .env 없음.**
- 읽은 최신 main HEAD (작성 직전): `4fbe73a3ad881d255a951668ccbd964161bc1f2c`, 최신 commit A1 r64. 직전 [A2 r63](2026-11-02_r63_0312KST_it-sql-idempotence-head-replay.md) 영수증, 최근 공개 Draft PR #153/#151/#148/#145/#141 및 **#130** 검토.
- main blob: `lib/form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`, `lib/document-preflight.ts` `dc771c0ff0497d24df19478b0366ebbb397bfbf2`, `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`, `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, `lib/template-token-catalog.json` `899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- 실제 테스트 대상은 최신 main 완성 기능이 아니라, **미병합 서식 통합안 #130**의 `document-preflight.ts` blob `71c07116cb627be360ce0e18a47b30c022b08ee2` 및 **미병합 표시기 #141** `form-mapping.ts` blob `fed97085b02e95dc9d81024dc19f1550c087f46b`. 따라서 검증된 문제는 **통합 제안 간의 조건부 P1 위험 후보**이며 운영 사이트의 실장애 단정 불가.

## 1. 결함 재현 — 문서 서식 provenance vs final 사전검증

#141의 `classifyPublicFormToken`은 `[미관찰]`, `[승인전]`, `[미상]`, `[원문만]`, `[원천만]`, `source-only`를 미확정으로 인식하나, #130의 `absent`는 `[확인 필요]`, `[상충]`, `[누락]` 등만 검출한다. 미확정 표시가 그대로 required 텍스트 필드에 들어가면 **#130 사전검증이 final-ready 또는 draft-ready로 오인**하는 반례가 성립한다. 실제 소스 조합을 병합해 실행한 것이 아니라, 각각의 실제 함수 본문을 별도 추출해 대조했다.

### 실제 실행 환경·독립 오라클

- **실행**: GitHub #130의 실제 `evaluateDocumentPreflight` 전체 함수 코드를 재조회하고 TypeScript 타입 주석만 제거한 **V8 격리실행**. 임의 개조한 계산기나 모의 preflight 분기는 사용하지 않음. 외부 의존성 `FORM_CONTRACTS`는 D5103의 등록된 `client_name` 1개 required 필드만 포함하도록 합성했고, 법률산술 adapter는 빈 결과, digest는 고정 mock. 이는 실제 프로젝트 Node 실행, TypeScript typecheck 또는 end-to-end 테스트가 **아님**.
- **독립 기대**: required 필드가 미관찰/source-only/승인전이면 final=`blocked` + `FIELD_UNRESOLVED`, draft=`draft_with_unresolved` + 경고. 정상 텍스트와 명시적 문자열 `"0"`은 이 **일반 상태 판별기에서는** 누락으로 자동 변환하지 않음. 비해당 `[해당없음]`은 별도 상황별 적용성 심사에 맡김. 이 테스트는 해당 문자열이 실제 신청인 성명으로 적합하다고 인정하지 않음.
- **16개 합성 입력 × 2개 모드 = 32회 실행**: 기존 #130 **16/32 독립 기대 일치**, 한 줄 패치 후 **32/32 일치**, 실패 **0**. `[미관찰]`, `[승인전]`, `[미상]`, `[원문만]`, `[원천만]`, `[source-only]`, `source-only`, `source-only: 2400000`은 기존 final=`ready` 및 draft=`ready` → 패치 후 각각 `blocked`/`draft_with_unresolved`. `[확인 필요]`, `[상충]`, `[누락]`, `[검토 필요]`, `[검토완료]`은 기존 방어 유지. `0`/일반 텍스트/비해당는 일반 판별기에선 구별.
- 실제 D5103 생성 시 위 미확정 문자열이 required 필드로 전달되는 **전체 원문→Fact→typed→bindings 경로는 미실행**. 따라서 오류 심각도와 발생 가능성은 실무 검증 전 잠정.

## 2. 변경 및 GitHub 수렴 상태

- 별도 [Draft PR #154](https://github.com/firmengine/firmengine/pull/154) 생성. **#130 브랜치를 base로 둔 stacked PR**, main 병합 없음. #130의 source lineage/3종 서식 검증을 덮어쓰지 않음.
- 최초 #130 base HEAD `bfe5ac4e3ed55611a8cca1e6febd1b3581ecc30a`, 원본 blob `71c07116cb627be360ce0e18a47b30c022b08ee2`를 쓰기 직전 재검증. 실제 변경은 `lib/document-preflight.ts`의 미확정 분류 1개 논리식 (+2줄 설명), 신규 `tests/a2-r64-doc-pending-marker-preflight.test.ts` **4 그룹**뿐. 새 source blob `8bd541f99ca5d638686ac7cf53c14952c286492e`.
- #154 head `d39932aacb1f7922cc18fc762d02edebaf0a3362`; 변경 파일 2개 모두 ax-site 내부. 이전 #130 및 #141은 **Draft 미병합**, #154 역시 **Draft**.
- 4개 **프로젝트 Node 테스트 그룹은 작성·커밋했으나 아직 실행하지 않았음**. V8 32/32를 Node/CI/실제 DOCX 성능과 혼용 금지.

## 3. 산식·저장·서식의 독립 재독

- main 카탈로그 실제 JSON 재파싱 결과 계산 **18모듈**, 입력 선언 **91개(고유 78)**, 출력 선언 **42개(고유 40)**, 결과 경로 **42개(고유 42)**. DOCX 등록 토큰 D5103 **37**, D5110 **55**, D5111 **82**. **정적 계약**일 뿐 91개 입력 전부의 실행·SQL 저장·Word 바이트 동등성 검증 아님.
- 독립 BigInt 원화 합성 산술: 급여 `2,400,000원 × 12개월 = 28,800,000원`, 사업 순소득 관측 `1,000,000원 × 11개월 = 11,000,000원`, 관측 합계 `39,800,000원`. 사업 12월은 **미관찰**, 임의 0/미래값 보간하지 않음. VAT 매출 `60,000,000원`, 종소세 원천 `20,000,000원`은 **source-only**로 관측 순소득에 더하지 않음.
- 월 계획금 `900,000원 × 36/48/60` 명목액은 각각 `32,400,000/43,200,000/54,000,000원`; 청산가치 `32,000,000원`, 변제액 현재가치 `30,000,000원`의 차이는 `2,000,000원`. **법정기간 적합성·인가요건·사람 승인 및 실제 배분의 검증 결과 아님**.
- migration 0011의 SQL 정의를 **재독**했으나 이번 회차에 SQL을 직접 실행하거나 실제 D1을 접근하지 않음. 원문→Fact→typed→SQL 42개 경로→D5103/11 Word 종단검증은 **미실행**.

## 4. 법률·회계 공식 원문 및 적용일 경계

- **서울회생법원** 2026-10-01 [공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 **제424호 제2조 제2항 제7호 신설** 문구 확인. 첨부 PDF의 부칙·경과조치 및 **사건별 적용일 미열람·미인증**. 공지일 2026-10-01을 모든 사건의 자동 규칙 적용일로 간주하지 않음.
- **국가법령정보센터** [채무자회생법 제611조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **[시행 2026-10-02] 법률 제21490호** 조문 재확인. 변제기간 3년 원칙·특별사정 5년 상한, 공정/수행가능·청산가치 등 법원 인가요건은 계산기 성공·문서 preflight와 구분.
- **국세청** [부가가치세 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486): 일반과세자 통상 반기·간이과세자 통상 연간 과세기간 확인. VAT 매출·종소세 신고를 인정 월순소득으로 자동 승격하지 않음.
- 법률/회계/법원 서식 적합성은 **담당 변호사·계산사무장·서류담당자 최종 서면 승인 전 미인증**.

## 5. 중앙 보드와 다음 담당자

| ID | 이번 관찰 | 현재 상태/남은 일 |
|---|---|---|
| `A2-DOC-015` | required 필드 미확정 표시의 final-ready 거짓정상 V8 재현, Draft #154 경계 강화 | **[ ] 부분 검증**, 실제 writer/DOCX 생성 게이트 미검증 |
| `A2-DOC-016` | `0`·`null`·미관찰·source-only·승인전·비해당 분류 의미 분리 | **[ ] 부분 검증**, DB typed/Word 표기·실무 적합성 미검증 |
| `A2-DOC-018` | D5103 37/D5110 55/D5111 82개 **등록 토큰만** 재독 | **[ ] 부분 검증**, 실제 DOCX 숫자/행/문단 바이트 미실행 |
| `A2-DOC-020` | #141 unresolved provenance와 #130 preflight의 상충 확인 | **[ ] 부분 검증**, 내부 주석/원천 계보의 공개 Word 비노출 미인증 |

- **다음 r65 계산사무장**: #154/#130/#141 통합 실행 계약, #145 원화·기간 형식, #133 변제원장 및 #138 Fact 계보 충돌 점검. 18개 산식·91 입력·42 출력에 대해 실제 Node 계산→typed→SQL→3 Word 금액 독립 오라클 시행. 재직·사업 VAT/종소세 중복, 다채권/청산가치, 0/null, 부분월·미래월·예외 분리. 법률/회계 의미 변경 시 별도 법률검토 PR.
- **제품 최종 인수 0건**. 전체 Node·CI, staging D1/R2/Cron, 실제 DOCX 렌더·재독, 공식 법원서식 동등성, 변호사/실무자 승인, 사이트 배포 **미실행 또는 미인증**. 운영 배포/운영 D1 migration/전자제출/인가 확정 **미수행**.
