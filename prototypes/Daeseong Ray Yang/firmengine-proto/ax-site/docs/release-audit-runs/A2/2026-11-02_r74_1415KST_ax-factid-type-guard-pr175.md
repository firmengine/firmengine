# FirmEngine A2 r74 — AX담당자 독립 감사: 변제원장 Fact ID 형태·원천 계보

작성: **2026-11-02 KST**. 범위 `firmengine/firmengine/main`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 A2만. 직전 r73 데이터담당자 → 이번 r74 AX담당자 → 다음 r75 IT담당자. 공개 가능한 합성 데이터만 사용; 실제 사건·OCR·정답·개인정보·키·.env 없음.

## 1. 인수·SHA·읽은 자료
- r73 영수증 `docs/release-audit-runs/A2/2026-11-02_r73_1316KST_data-ledger-source-component-cap.md` 재독. r73의 미해결 `allocation.factIds=[]` 또는 외부 Fact ID의 `sourceIds` 전파 위험을 계승.
- 시작 main: `a3dfdceae9c37d443758987f9401c12fd5e17fd5`. 중앙 보드 읽은 blob: `1aab7c0bb5353cc14afba813b629c11452c898b9` (실제 쓰기 직전에 다시 조회·병합).
- #173 (Draft·미병합) HEAD `50a5d5a50deb0f3865b87a6f5247b5afacc247b6`, `lib/repayment-plan-model.ts` blob `cea5637f9ba52fcfbaaa6093e85df3e9012e18f9`. 이전 #172/#168 스택, main의 `lib/assessment.ts`, `lib/plan-reconciliation.ts`, `lib/debt-source-integrity.ts`, `lib/case-calculation-feature-store.ts`, `lib/form-mapping.ts`, `lib/approval-readiness.ts`, `app/api/cases/[id]/approval-readiness/route.ts`, `tests/repayment-plan-model.test.ts`, `package.json` 재독.
- 실제 생산자 `assessment.ts`는 기본 allocations의 `factIds`를 해당 채권 `debt.factIds`에서 복사하며, typed Fact 계보에는 `invalidLineage` 검사도 존재. 그러나 기본 원장의 런타임 입력 검사는 `Array.isArray(a.factIds)`만 보아 원소가 정규 ID인지 검사하지 않음. 후속 `case-calculation-feature-store.ts`의 `factIds()`는 string 원소만 수집함. 따라서 원장 `sourceIds`와 SQL `source_fact_ids_json` 사이 타입/값 상충 가능성. 실제 정상 생산자가 비문자 원소를 내보냈다는 증거는 아님.

## 2. 합성 입력·독립 기대·실제 실행
- 합성 사건 revision 8, 생성 기본 원장, ordinary 채권 A 원금 `100`원·이자 `20`원, 계산 allocatedPrincipal `50`원/allocatedInterest `10`원, planTotal `60`원, 월 제안 상한 `60`원, 회생위원 보수 `0`원. `36/48/60`개월 각각 동일 케이스 재생. 오라클: 정상 Fact ID는 `provisional`(승인 아님), 비문자/null/빈 문자열/공백 ID 원소는 `blocked` + 원장 행 `0`; 명시적 0원 이자는 계속 0원으로 보존. 비정규 금액 `05`는 기존처럼 차단.
- 실제 GitHub `buildRepaymentPlanModel()` 함수 본문에서 **TypeScript 타입 표기만 제거**하고 `nat`, `addTrusteeFeeRows`, `orderRows` 3개 주변 함수를 기능상 동등한 합성 대역으로 주입한 **V8 격리 실행**. 3기간 × 10입력 = **30케이스**. **기존 #173은 18/30** 독립 기대 일치, 수정 후보는 **30/30**. 오판은 4종 × 3기간 = **12건**. 기존 #173은 `factIds:[42]`, `[null]`, `[""]`, `[" \\t "]`를 그대로 월 원장 `sourceIds`로 복제하면서 `provisional`, `issues=[]`를 반환. 후보는 `DEFAULT_ALLOCATION_INVALID`, `rows=[]`, `blocked`.
- 중요 **미해결 두 조건**: `factIds:[]`와 정상 문자열이나 실제 Fact 색인에 없는 `["SYN-FOREIGN"]`은 기존/수정안 모두 `provisional`. 이 두 조건은 법률상 적격 사실로 판단한 것이 아니라 **실제 Fact 인덱스·소유/보조 Fact 의미·기각/철회 수명주기 E2E 미검증**을 뜻함. 실무적으로 적법한 보조 Fact를 오차단할 수 있어 확인 없는 식별자 동등성 규칙은 추가하지 않음. 중복 Fact ID도 의미 결정 전 변경하지 않음.
- 독립 산술: 급여 12×2,400,000원 = 28,800,000원, 사업소득 **관측분** 11×1,000,000원 = 11,000,000원, 관측액 단순 합계 39,800,000원. 사업소득 미래 12월은 `null`/미관찰이며 0원 보간·VAT/종합소득세 중복합산/법원 인정소득 자동승격 **금지**.
- 프로젝트 Node 테스트 러너 **미실행**. V8 격리 통과를 Node 통합·CI·D1·DOCX 통과라고 기록하지 않는다.

## 3. 수정 및 독립 릴리스 상태
- 코드 변화는 단 한 검증식의 원소 형태 검사: `!Array.isArray(a.factIds)||a.factIds.some(id=>typeof id!=="string"||!id.trim())`. 원화 산식, 채권별 원금/이자 상한, 변제기간, 비해당/미관찰/승인 상태는 변경 없음.
- **Draft PR #175** https://github.com/firmengine/firmengine/pull/175 는 Draft #173을 base로 하는 별도 스택. PR HEAD `c64b3da3afd955189df32ddc3f50191e6b3a4533`; 코드 blob `1a5193ba86919892d1d088c1e87e37b37e73a2fa`; 신규 Node 합성 테스트 blob `8f85f56f88d36daf6a3a0f7518d55c51bc2c994f`. 변경 파일 정확히 2개, 둘 다 허용 `ax-site` 아래. **3기간×8=24개 Node 동적 테스트 선언 + TODO 3개 작성/커밋, 프로젝트 실제 Node 실행 미관찰**. PR workflow runs 0, status checks 0(조회 시점).
- Node 테스트 예시는 ID `[42]`, `[null]`, `[""]`, 공백·탭, 정상 ID, 명시적 0 이자, 잘못된 `05`원, 비어 있는 Fact 배열. TODO는 실제 Fact 색인 존재·소유권/보조 Fact 정책·SQL/승인/D5110/D5111 재독.
- 현재 main **제품 코드 수정 없음**. 별도 PR은 계산사무장/변호사 승인, stacked 선행 #168/#172/#173과 전체 Node/CI, 소비처 E2E 전까지 병합 금지.

## 4. 18계산·91입력·출력/서식 정적 재파싱
- main 기준정보 blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18계산 모듈, 91 입력 선언(78 고유), 42 출력 선언(40 고유), 42 고유 resultPaths**.
- 토큰 등록 blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103/D5110/D5111 각각 **37/55/82**. 공개 매핑 blob `9bae52fdf47fbc0935314bb5267503e4182080bd`: **35/53/80**, 차이 **세 서식 모두 `review_status`, `revision` 2개**, 공개 세 서식 `approval_status=reviewer_pending`. 현 코드의 `form-mapping.ts` 실제 원장·reconciliation 소비처만 정적 읽음. 실제 91 입력→18모듈→42출력→SQL→D5103/D5110/D5111 DOCX 바이트 생성·재독 **미실행**.

## 5. 공식 원문·시행일·불확실성
- 서울회생법원 공식 게시 **2026-10-01**: 실무준칙 제424호 제2조 제2항 제7호 신설 확인, https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . 첨부 개정전문/경과조치·개별 사건 적용일 **미인증**. 서울 관할 외 자동 적용 금지.
- 국가법령정보센터 `채무자 회생 및 파산에 관한 법률` **[시행 2026-10-02, 법률 제21490호]** 제611조 https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 , 제614조 https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 변제기간 3년 원칙/특별사정 5년 범위, 우선·재단채권 및 인가요건은 **형식 무결성 검사와 별도 법률 판단**, 사건별 적용일·변호사 승인 전 자동확정 불가.
- 국세청 공식 VAT https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401 : 일반과세자 반기, 간이과세자 통상 연간 과세기간(전환·예외 존재). VAT 신고금액·과거 종합소득세 자료를 월 인정순소득으로 승격하지 않음.

## 6. A2 ID별 결과/차기 담당
| ID | 확인/제한 | 제품 합격 |
|---|---|---|
| `A2-AX-004` | 정상 문자열·비정규 원소, null/명시적0/미관찰 상태 분리. V8 30조건. 실제 원문→typed 미검증 | **[ ] 부분** |
| `A2-AX-015` | 36/48/60월 독립 금액 오라클 및 함수본문 정합성, 전체 18모듈 E2E 미실행 | **[ ] 부분** |
| `A2-AX-017` | 원장 `provisional`/차단, approval-readiness/Form 경로 정적 확인. 자동승인 검증(실제 API) 미실행 | **[ ] 부분** |
| `A2-AX-018` | main/PR·blob·입력·기대·관찰·수정·미완료/공식출처 기록; 전체 품질지표 미완결 | **[ ] 부분** |

**다음 r75 IT담당자**: Node 22 실제 회귀시험, #173/#175 스택 실통합 및 Fact 원천 `sourceIds` vs SQL `source_fact_ids_json` vs 원장 승인 준비도와 D5110/D5111 DOCX 행·액수 실재독; empty/foreign/withdrawn Fact ID 사례의 upstream/consumer fail-closed 증빙. 실무자·변호사 법률·회계 최종 승인 전 미인증. 제품 최종 인수 **0건**. 전체 CI, staging D1/R2/Cron, 공식 법원서식 동등성, 사이트 배포, 실제 전자제출, 법원 인가 확정 **미실행**.
