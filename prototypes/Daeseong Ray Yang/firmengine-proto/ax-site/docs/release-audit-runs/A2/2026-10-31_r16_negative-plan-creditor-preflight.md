# FirmEngine A2 16차 — 변제계획·채권자 음수 금액의 최종본 거짓 정상 위험

- 기준: 2026-10-31 KST. 전원 **합성값**, 고객 원본/비공개 정답/키 없음.
- 순환 주관: **사용자·서류담당자** (14차 AX → 15차 IT → 16차 DOC). A2 피처 저장·계산·법원서식만 검토.
- 시작 main: `4f2eabdc21a81c40c32af294fa637bf00723ad97`; 이전 15차 영수증 및 인수 보드의 A2 ID 확인. 열린 #58/#60 및 #21/#53의 미병합 관계 확인.
- 대상 blob (수정 전): PR #58 `lib/document-preflight.ts` `f115533c761b0feb64bc7219f3d5807d4b924b60`; main 법률 산술 `lib/legal-calculation-readiness.ts`의 원본문 확인. 본회차 PR #58의 코드 새 blob `ed5f26cb58064cfd11b19a9b38b22d28d20d9f10`.
- SQL 저장 계약 정적 열람: `extracted_features.raw_value_json/source_state/validation_json` → typed `cases.payload` → `case_calculation_features.value_json/value_won/status/output_path`; `case_calculation_runs.input_sha256/reference_sha256/source_heads_sha256`. **실제 SQL 삽입/재조회 미실행**.

## 독립 산술 입력·기댓값·실측

원화 정수 단위이며 아래는 실제 사건이 아닌 회귀용 숫자. 법률상 금액 인정과 무관.

| 합성 조건 | 독립 기대 | 수정 전 #58의 실제 함수 분기 V8 | 수정 후 #58의 실제 함수 분기 V8 |
| --- | --- | --- | --- |
| 소득 100, 생계비 50, 가용 50, 월납부 **-5**, 36회, 총액 **-180**, 현재/청산가치 0 | 월납부/총액 음수 차단; -5×36=-180은 산식일치여도 최종본 부적격 | 음수 차단 0건 | `PLAN_SCALAR_NEGATIVE_INVALID` 월납부·총액 2건 |
| 원금 **-10**, 채권자 월납부 5/총액 180 | 채권 원금 음수 최종본 차단 | 음수 차단 0건 | `PLAN_CREDITOR_ROW_NEGATIVE_INVALID` |
| 월납부 0/총액 0, 채권원금 0 | 명시적 0원 유지 | 음수 차단 0건 | 음수 차단 0건 |
| 월납부 미관찰 `[확인 필요]` | 0원/음수로 승격 금지 | 해당값 숫자로 승격 안 함 | 동일 |
| `BAD`, `+100` 월납부 | 정수원 표시오류 검토 차단 | PR #58 기존 숫자형 게이트 | 기존 `PLAN_SCALAR_NUMERIC_INVALID` 유지 |

- **실제 원본 분기**(PR #58 변경 전/후)의 V8 비교: 음수 월납부·음수 채권자·명시적 0 세 조건 각각 관찰. 별도 확장된 수정본 분기 테스트에서 **16/16 합성 기대 일치**: 3개 음수 scalar×final/draft, 3개 음수 creditor×final/draft, 0·누락·오인식·부호 형식.
- main `reviewLegalPlanArithmetic` 원본문을 TS 타입 선언만 제거한 V8에서 실행: 월납부 -5, 총액 -180을 비롯한 위 금액 조합이 **issues=[]**이며 `automaticLegalApproval:false`. 즉 산술 경고가 음수의 독립 안전장치가 아니었음. 이는 **내부 최종본 검사 범위 결함**이지 실제 법원 제출이나 인가의 재현은 아님.
- 정식 `node --experimental-strip-types --test` 테스트, TypeScript 빌드, 전체 CI, 실제 D1/R2, DOCX 바이트 검사 **미실행**. 새 회귀 테스트 **4 그룹 작성만** 함.

## 수정·충돌 방지

- 기존 Draft PR **#58**의 동일 사전검증 파일을 이어 보완; main 제품 코드에는 미병합. PR 브랜치/파일 SHA 재조회한 뒤 **코드 커밋 `a76f0fb93da285b869cfed3706dd85747a821f6e`**, 별도 합성 테스트 `tests/a2-preflight-negative-amount-r16.test.ts` **커밋 `0da0622cc270791e123afa9579ea963f874a400a`**.
- 음수 `monthly_payment`, `monthly_trustee_fee`, `total_repayment`, `creditor.principal`, `creditor.monthly_payment`, `creditor.total_payment`을 최종본 **blocker**/초안 **warning**으로 구분. `0`과 `null`/미관찰은 변경하지 않으며 법원별 승인·채권 법률 인정값은 변경하지 않음.
- #58이 #21 + #53을 선행 통합하므로 자동 병합금지, 코드 소유자·서류담당자·변호사 독립 리뷰 필요.
- PR #60 원문 정수/금액 수정과 이번 코드의 **실제 원문→Fact→typed→SQL→Word** 통합은 미검증.

## 명세·공식 기준 재독 (법률·세무 인정 미인증)

- main `lib/reference-decision-tables.json` SHA `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18 모듈/91 입력 선언/고유 78/42 출력/42 결과경로** 정적 열거. `lib/template-token-catalog.json` SHA `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103=37, D5110=55, D5111=82 토큰**. 이번에는 각 91입력과 42출력을 실제 계산·저장·Word로 모두 실행한 것이 아님.
- 국가법령정보센터 **[시행 2026-10-02] 채무자회생법 제589조** 개인회생 신청·첨부 서류, **제611조** 변제계획 내용·정기변제·3년 원칙/특별한 사정 5년 한도 재독. https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018130103 / https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221
- **서울회생법원 2026-10-01** 공식 보도자료에서 제424호 **제2조 제2항 제7호 신설** 확인. 원문 PDF 상세 조건 및 사건별 적용경과는 **미인증·자동적용 금지**. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187
- **국세청** 공식 부가가치세 안내: 일반/간이 과세기간 구별. 이번 수정은 VAT·종합소득세·순사업소득 산식을 변경하지 않음. https://d.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272

## A2 인수 보드 5 ID (전부 [ ] 유지)

- `A2-DOC-005`: D5110/11 월변제·채권원금 음수 금액의 내부 서식 사전검증 부분.
- `A2-CALC-030`: 독립 음수/0·정수 예외 합성 산술과 분기(총액 -180 검산) 부분.
- `A2-IT-020`: `numeric()`가 음수를 유효 정수로 수용하더라도 허용 field의 부호는 별도로 제한.
- `A2-DATA-020`: 실제 0, 미관찰, 형식오류, 음수 구분의 **분기 단위만** 부분.
- `A2-LAW-022`: 법률상 확정값 승인 아님. 내부 문서 `ready` 거짓 정상 위험 격리.
- **제품 인수 완료 0건**. 다음 회차: PR #58 새 Node 회귀 및 #60 OCR→typed 결합 실행; 음수 차단의 전체 계산 경로 영향, 11/12개월 급여·사업소득, VAT·종소세 중복, 36/48/60 변제배분, 실제 D1 재독/공식 D5110 Word·법원별 서식 대조. 법률·회계 전문가 승인 전 미인증. 운영 배포/마이그레이션/전자제출 미실행.
