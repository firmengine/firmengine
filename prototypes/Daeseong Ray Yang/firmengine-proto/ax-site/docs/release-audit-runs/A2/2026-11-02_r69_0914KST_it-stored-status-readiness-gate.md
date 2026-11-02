# FirmEngine A2 r69 — IT담당자 / 저장 피처 재독 정합성과 미해결 상태를 승인 준비도에서 분리

- **시점:** 2026-11-02 09:14 KST. 담당 순환: **r68 AX → r69 IT → r70 사용자·서류**.
- **범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 기준 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 A2 ID 4개만 [ ] 부분감사 유지.
- **시작 main:** `ba5e6c3312ad92e7b1d0f2f27b670f1690ee95c8` (2026-11-02 08:54 KST 시각의 최신 조회). 최근 A1 r69 / A4 r68 / A3 r68 / A2 r68 커밋, PR #163/#160/#157/#153 및 기존 r68 영수증 재조회.
- **실제 코드/blob:** main `app/api/cases/[id]/approval-readiness/route.ts` `731f66a10d4af704b432dcd298061b452941fd13`; #163 브랜치 route `fe1610c8e5ec776d02455ed984c49fc608bf65e6`; 기존 `lib/approval-readiness.ts` `d3aecf05688d3146ecff94a3795bb3da8a215d35`; #163 replay `lib/preapproval-calculation-replay.ts` `673747359f563011c53eb53e7d5272fdef530126`; main migration `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`.
- **제품 변경 후보:** [Draft PR #165](https://github.com/firmengine/firmengine/pull/165) 브랜치 `audit/a2-r69-it-stored-feature-readiness-20261102-0914` commit `dcfbbe071de3eff20402ad171c67abe38ab41c90`, #163에 stacked, 4개 파일 모두 허용 경로. 아직 **미병합**. 기존 #163 및 #160도 미병합. main 제품 코드는 변경하지 않음.

## 1. 실제 코드에 근거한 P1 조건부 반례

#163 replay는 원문 `"00100"` / `status=blocked` / `value_won=NULL`을 **데이터 정합성 측면에서 유효한 재독**으로 분류한다. 그러나 현재 approval-readiness 소비처는 `storedCalculationReplay.valid === false`만 `calculationCurrent=false`로 보내고, 기존 업무 task는 계산 엔진 `traces.status`에서 생성한다. 따라서 엔진 trace는 `calculated`이고 저장단계에서만 `blocked`로 분류된 데이터가 존재하면 **저장 상태가 미해결인데 `lawyer_approval_review_pending`이라는 내부 상태가 가능**한 코드 경로가 있다. 이것은 **실제 route/D1 API 재현이 아닌 코드 경로 + 합성 V8 재현**이며 법률 인가·승인이나 전자제출은 애초에 false이다.

새 Draft #165는 리플레이 정합성과 별개로 `computed`/`provisional`/`blocked`/`missing`/`conflict`/`not_applicable`/잘못된 저장 상태를 개별 계수한다. 미관찰·불완전 판독 또는 `provisional|blocked|missing|conflict|invalid`이면 **독립적인 urgent calculation review task**를 생성한다. 원본 revision·reference SHA·Fact replay의 `calculationCurrent` 값은 임의로 뒤집지 않는다. 이는 최종 인정이 아니라 내부 담당자 검토로 전환하는 후보이다. `missing/provisional`에 선택적·비필수 결과가 포함되면 과다 차단할 가능성이 있어 **실무자 승인까지 Draft 병합 금지**.

### 합성 입력 / 독립 기대 / 실제 관찰

동일한 합성 사건 revision 8, source dataVersion 4, calc run `SYN-RUN`, 법률 review `SYN-LEGAL`, 모니터 current, 위험 check 0, trace `calculated`(차단 task 없음)로 기준조건을 통제했다. **실제 main 및 Draft #165의 `buildPreApprovalReadiness` 소스 함수 본문에서 TypeScript 타입 표기만 제거해 V8 격리 실행**한 결과:

| 저장 상태 한 행 | 기대(저장 상태 독립 판정) | 기존 main 관찰 | #165 후보 관찰 |
|---|---|---|---|
| `computed` | 별도 저장 차단 없음 | `lawyer_approval_review_pending` | 동일 |
| `not_applicable` | 법률 승인과 혼동 금지·차단 없음 | `lawyer_approval_review_pending` | 동일 |
| `blocked` (예: raw `"00100"`) | urgent 계산 검토 | **`lawyer_approval_review_pending`** | `supplement_or_recalculation_required` |
| `missing` (`null`과 구별하지 않고 0으로 채우지 않음) | urgent 계산 검토 | **`lawyer_approval_review_pending`** | `supplement_or_recalculation_required` |
| `provisional` | 승인 전 계산 검토 | **`lawyer_approval_review_pending`** | `supplement_or_recalculation_required` |
| `conflict` (명시적 0원과 원천상충 가능) | urgent 계산 검토 | **`lawyer_approval_review_pending`** | `supplement_or_recalculation_required` |
| `source-only` (알 수 없는 status) | invalid·검토 | **`lawyer_approval_review_pending`** | `supplement_or_recalculation_required` |

**V8 실제 함수 격리 7/7개 상태 범주 기대 일치**. 개선 후보는 `calculation.persistedCurrent=true`, `legalReview.current=true`를 고정했으므로 판본 최신성과 미해결 저장 상태를 구분함. `autoApproval=false` 보존. 사용한 입력은 synthetic; 실제 실무 사건·법원 인가 판단 아님.

### 직접 실행한 Node 테스트

- Node **v22.16.0**, `node --experimental-strip-types --test`: 신규 **순수 저장 상태 가드 8/8 passed**, failed 0. 명시적 0·비해당·원문 `blocked`·미관찰 `missing`·`provisional`·`conflict`·잘못된 source-only·빈/불완전 SQL 조회·상태별 집계 등.
- `tsc --noEmit --skipLibCheck --strict` 새 순수 helper에 실행하여 0오류.
- 실제 제품 `buildPreApprovalReadiness` 직접 import하는 **2개 Node 통합 회귀시험은 파일로 커밋했으나 프로젝트 전체 Node 러너에서 실행하지 못함**. V8 격리검증과 project Node/CI 성공은 동의어가 아님.

## 2. SQL 0011 구조와 독립 산술

실제 migration 0011의 runs/features/heads DDL에서 Drizzle의 `--> statement-breakpoint` 구분주석만 제거해 Node 내장 `node:sqlite` 인메모리 DB를 구성하고 부모 `cases` 합성 stub 사용. 합성 feature **7/7건** `value_json/value_won/status/source_fact_ids_json` 저장·재조회 일치; `PRAGMA foreign_key_check` **0건**. `"0"/"0"/computed`, `null/NULL/missing`, `"00100"/NULL/blocked`, `"0"/"0"/conflict`, `"900000"/"900000"/provisional`, `false/NULL/not_applicable` 구분.

조건부 재시도: 동일 `SYN-1` ID에 원화 240만→900만, 원천 Fact F1→F2 재삽입은 `INSERT OR IGNORE` 결과 `changes=0`, 기존 240만원 행 유지, 별도 HEAD INSERT `changes=1`. **정상 결정적 runId가 실제로 이 충돌을 생성한다고 증명한 것은 아니며**, staging D1 CAS/멱등성 검증 필요. 고위험 저장 계약 변경 없음.

독립 BigInt: 급여 2,400,000×12=**28,800,000원**, 사업소득 **관측** 1,000,000×11=**11,000,000원**, 합계 **39,800,000원**. 사업소득 미래 12월은 **미관찰(null)**, 0원으로 보간하지 않음. 예시 VAT 신고매출·전년도 종합소득세는 **source-only**로 분리하며 법률 인정 월순소득으로 자동 합산하지 않음. 명목 변제 900,000×36/48/60=**32,400,000/43,200,000/54,000,000원**. 청산가치 32,000,000 - 현재가치 30,000,000=**2,000,000원**. 이는 실무 인정금액·현재가치 산식 전체의 검증이 아님.

main JSON 정적 재파싱: 계산 **18모듈, 91입력(고유78), 42출력(고유40), 42저장 resultPath(고유42)**. 템플릿 토큰 catalog blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 재파싱: **D5103 37, D5110 55, D5111 82 토큰**(각 고유). **실제 91입력 소비처·42결과 SQL→DOCX 실제 바이트 재독은 미실행**.

## 3. 공식 법률·세무 원문 (법원·시행일 고정, 자동 적용 금지)

- 서울회생법원 **2026-10-01 작성** [실무준칙 제424호 제2조 제2항 제7호 신설 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 개정 보도 사실 확인. **첨부 PDF 전문·부칙·경과조치 및 사건별 적용일 미검증** → 자동규칙 반영 금지. 공지일이 곧 모든 사건의 시행일이라는 추론 금지.
- 국가법령정보센터 [채무자회생법 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **[시행 2026-10-02, 법률 제21490호, 2026-03-24 타법개정]** 판본 확인. 3년 원칙·특별사정 5년 상한, 청산가치 비교·법원 인가요건이 내부 status와 별개임 확인. 사건별 적용 최종 변호사 검토 전 미인증.
- 국세청 [과세기간·신고 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574): 일반과세자 반기(1~6월/7~12월)·간이과세자 통상 연간 과세기간 확인. **VAT 매출 ≠ 개인회생 승인 월순소득**.

## 4. 중앙 보드 ID / 다음 회차

| ID | 이번 실제 검증 / 미완료 경계 | 상태 |
|---|---|---|
| **A2-IT-013** | observed 0·null·missing·blocked·conflict·provisional·NA·invalid 분리 V8 7종/Node 8그룹 | [ ] 부분 |
| **A2-IT-015** | 0011 SQL 합성 7/7 재독·FK0, 동일 ID 재시도 은폐; D1 API→typed 재계산 미실행 | [ ] 부분 |
| **A2-IT-017** | #163 replay-valid 상태에서도 저장 blocked의 독립 urgent task 후보 #165; 정식 Node route·Word final 미실행 | [ ] 부분 |
| **A2-IT-019** | Fact 계보/판본·SHA 소비처 코드와 동일 ID 이질 원천 반례 확인; 원문 OCR SHA→typed→SQL→Word full hash 미실행 | [ ] 부분 |

**다음 r70 사용자·서류 담당자:** #165의 실제 `buildPreApprovalReadiness` 프로젝트 Node 통합시험과 #163/#160 writer/replay 연결, Draft #154/#141 서식 preflight, D5103·D5110·D5111 실제 Word 출력의 숫자·미해결 상태·source-only 표시를 확인한다. 이후 IT 후속에서는 staging D1 같은 ID 충돌/Head CAS, Node 전체 CI와 18모듈·91입력·42출력 전수 검증. 반드시 실무자 법원 적용일과 청산가치/세무 원칙 승인 후 별도로 인수.

**제품 최종 인수 완료 0건.** 전체 CI/Node 통합·staging D1/R2/Cron·공식 DOCX/법원서식·실제 변호사/계산사무장 인증 및 배포 미실행. 공개 Git에 실제 고객 문서·개인정보·OCR 사실값·비밀키/.env/비공개 정답 없음. 운영 배포·운영 D1 migration·전자제출·법원 인가 실행 없음.
