# FirmEngine A2 r73 — 데이터담당자: 채권 원천 구성액·배분·SQL 피처 계보 감사

작성일 **2026-11-02 KST** · 범위 `firmengine/firmengine/main`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 **A2만**. 직전 r72 변호사 → 이번 r73 데이터담당자 → 다음 r74 AX담당자. 개인정보, 원본 OCR, 운영 데이터, 키, .env 없음.

## 1. 선행 확인 / 버전 경계

- 시작 main HEAD: `7554696cde33d6f26d8a74f340f1e62953deed45`; 최근 A1 main commit과 A2 r72 이력·Draft #172/#168 및 0011 SQL, 입력/서식 카탈로그를 재조회.
- 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 읽은 blob `eadec6cb67c43af1b08d40ce6a529e849f268d45`. **선정 ID** `A2-DATA-009`, `A2-DATA-017`, `A2-DATA-018`, `A2-DATA-024`: 이 영수증은 네 ID만 업데이트할 수 있는 근거, 모두 미완료 `[ ]`.
- main `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`; r72 stacked branch의 동일 파일 blob `7d434e0a6170ce219b9df615e138582717611099`, parent commit `8648fe646c76f4c85ba749bb6e0bd6950e3f696f`.
- main `lib/debt-source-integrity.ts` `40b7c227d3e73ae141a79a71a9165603ad321c24`, `lib/form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, migration `0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`.
- 기준정보 `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`, 토큰 등록 `lib/template-token-catalog.json` `899c4d564fcb1726861f89dcf04dbf1b7e372687`, 공개 템플릿 `public/templates/catalog.json` `9bae52fdf47fbc0935314bb5267503e4182080bd`. 기존 테스트 `tests/repayment-plan-model.test.ts`, r72 신규 Node 테스트(24선언 + TODO2), r71·r69·r67 영수증 분리 참고.

## 2. 발견 P1 후보: 구성액 상한 초과를 정상 provisional로 취급

검증 대상은 **실제 PR #172의 `buildRepaymentPlanModel` 기본 변제원장 분기**. 외부 의존 `moneyValue/addTrusteeFeeRows/nat/orderRows`를 기능 동일한 합성 대역으로 주입하고 TypeScript 타입 표기만 제거한 **V8 함수본문 격리 실행**. 프로젝트 Node/전체 계산 엔진 실행 **아님**.

합성 사건 revision=8, 채권 두 명 A/B 각각 원금 100원·이자 20원, 계산 배분 각 A/B 원금 50원·이자 10원, 계획총액 120원, 제안 월 상한 120원, 수수료 0원. `36/48/60`개월별 각 8조건 = 총 **24조건**을 **기존 r72와 수정 후보**에서 각각 실행. 독립 기대:
- 정상(채권 2명 총 변제 120원), 구성액별 상한 정확히 일치, 명시적 0원, 2^53 초과 원화 정수 → `provisional` (법률상 확정 아님).
- A의 관측 원금 20원 < 배분원금 50원 / A의 관측 이자 5원 < 배분이자 10원 / 원리금 합계는 충분하지만 구성액이 뒤바뀐 경우 → `blocked`, **금액 재배분 금지**.
- A의 이자 원천 `null` → `blocked`(미관찰, 0원 대체 금지).

관찰: **기존 PR #172는 15/24 기대 일치**, 상한 초과 3유형×3기간=**9/9 오류**, 상태는 `provisional`이고 issues 빈 배열. 생성된 `balanceAfter`는 0 밑으로 내려가지 않도록 clamp되어 과배분을 감출 수 있음. **Draft #173 후보는 24/24 독립 기대 일치**, 새로운 `DEFAULT_ALLOCATION_EXCEEDS_SOURCE_COMPONENT` 차단 코드는 원금·이자 별 BigInt 대조 후 0행으로 보류. 금액 산식/재분배/법률 인정 변경 없음. 그 전 잘못된 테스트 fixture의 월 상한 및 거액 합계 오류를 고쳐 **정정된 24조건만 최종 증거로 채택**, 초기 실패한 fixture는 제품 결함으로 집계하지 않음.

**추가 미해결 Fact 계보 갭**: 같은 격리 함수에서 `allocation.factIds=[]`, 또는 채권의 Fact와 무관한 `["SYN-NONEXISTENT"]`를 넣으면 36/48/60개월 모두 `provisional`이며 월 원장의 `sourceIds`가 비거나 잘못된 채로 재생됨(6/6 허위 정상 후보). 아직 상위 실제 Fact 조회/소비처에서 막히는지 E2E 미관찰. 원천↔배분 Fact 동등성을 무조건 강제하면 적법한 보조 Fact를 누락할 수 있어 **정책 미승인·코드 미수정**, PR #173 TODO 두 건으로 격리. 우선·재단채권 별도 schedule 누락도 r72의 법률 TODO 유지.

## 3. 수정 경로·실행 vs 미실행

- **Draft PR #173**: https://github.com/firmengine/firmengine/pull/173 · base는 r72 Draft #172 브랜치, main 직접 변경 금지. 코드 blob `cea5637f9ba52fcfbaaa6093e85df3e9012e18f9`, 최종 PR head commit `50a5d5a50deb0f3865b87a6f5247b5afacc247b6`. 변경 경로 2개 모두 `ax-site` 내부: `lib/repayment-plan-model.ts`, `tests/a2-r73-data-default-source-component-cap.test.mjs`.
- 신규 Node 테스트 **24건 선언 + TODO3**: 실제 생성·Git 커밋했으나 **프로젝트 Node 러너 미실행**, 전체 CI/staging 미실행. V8 격리 24/24를 Node 실통과로 승격 금지. PR은 Draft 유지하고 계산사무장·변호사가 채권 구성액의 의미를 검토한 뒤만 별도 병합 검토.
- SQL 저장 시험: **SQLite 3.46.1 in-memory**, migration `0011`의 계산 run/feature/head DDL을 원문대로 옮기고 `cases` 최소 FK 테이블만 합성 작성. feature 행 4/4 삽입·재조회, FK 위반 0. `value_json="0", value_won="0", status=computed`와 `value_json=null, value_won=NULL, status=missing`, 비정규 원화 `"00100"/NULL/blocked`를 개별 유지. `source_fact_ids_json=["SYN-NONEXISTENT-FACT"]`도 SQL FK가 없어 적재 가능(기존 저장 스키마 성질; 실제 상위 검사 존재 여부 미관찰).
- 동일 feature ID `SYN-FEAT-0`에 값 0→900000원을 `INSERT OR IGNORE`하면 기존 0원만 남고 changes=0; 합성 Head는 별도 INSERT로 승격 가능. 이전 r63·r67 지적을 **재확인**, 정상 결정적 runId의 실충돌이 입증된 것은 아님. 실제 D1/운영 수집·staging DB **미실행**. SQL은 계산 저장형식만 관찰했고 **원문 OCR→Fact→typed API 실제 왕복은 미실행**.
- 실제 `form-mapping.ts`는 채권별 `monthly_payment`를 원장 status와 reconciliation에 의존해 작성하며, 원장 자체에 저장된 sourceIds와 Word 원본 바이트가 일치하는지는 미검증. **D5110/D5111 최종 출력 금액·Word 재독·SHA 검사 미실행**.

## 4. 독립 산술·카탈로그 / 법률·세무 출처

정적 재파싱: 계산 **18모듈**, 입력 **91선언·78고유**, 출력 **42선언·40고유**, `resultPaths` **42·전부 고유**. `template-token-catalog.json` 등록 토큰 D5103=**37**, D5110=**55**, D5111=**82**. 공개 catalog `mapped_tokens`는 **35/53/80**, 세 서식 모두 `approval_status=reviewer_pending`. 두 토큰 세트의 개수 차이는 정적 계약 단계의 검토 대상(전수 필드 차이·DOCX 바이트는 미관찰). 급여 12×240만 원=**2,880만 원**; 사업소득 관측 11×100만 원=**1,100만 원**; 관측 월별 단순 합계 **3,980만 원**은 독립 산술 예시일 뿐 12번째 사업 월 미관찰을 0원으로 채우거나 신고 VAT/종소세 금액을 합산한 값이 아님. 이 회차 해당 금액으로 18모듈/SQL/서식을 종단 실행하지 않음.

- **국가법령정보센터**, 채무자 회생 및 파산에 관한 법률 **[2026-10-02 시행, 법률 제21490호]** 제611조: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 · 재단/일반우선채권 전액 변제 사항, 3년 원칙 및 특별한 사정 5년 상한. 제614조: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 · 인가 요건(형평/수행가능성/청산가치)은 데이터 정합성과 다름. **2026-10-02 시행판 적용 사건별 사실 검토·변호사 승인 전 확정 금지**.
- **서울회생법원 공식 보도**, **2026-10-01** `실무준칙 제424호 제2조 제2항 제7호 신설`: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . 공식 게시글 본문과 날짜 직접 확인. 첨부 개정전문/부칙 및 경과조치·사건별 적용일 **미인증**; 서울 관할 외 일괄 적용 금지.
- **국세청 공식 부가세 개요**: https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401 일반과세자 6개월 과세기간, 간이과세자 통상 1년·유형전환 예외. 종합소득세와 월 사업소득 중복/법원 인정값 승격 금지.

## 5. 중앙 보드 대상 ID별 실제 결과 / 후속

| ID | 이번 실제 관찰 | 인수상태 |
| --- | --- | --- |
| `A2-DATA-009` | A/B 원금·이자 구성액과 36/48/60개월 배분 금액·잔액 clamp 교차 검증. 기존 9건 over-component 허위 provisional, Draft #173 24/24 V8 후보; null 이자와 명시0 분리 | 부분 `[ ]` |
| `A2-DATA-017` | /assessment/calculation/debtRows·allocations 값과 관련 SQL value_json/value_won/status/Fact ID 열의 차이·재검증 경로; 실제 42 output paths E2E 미검증 | 부분 `[ ]` |
| `A2-DATA-018` | 월 원장→D5110/D5111 `monthly_payment` 소비처 정적 재독, 37/55/82 vs 35/53/80 등록 비교; 실제 DOCX 미관찰 | 부분 `[ ]` |
| `A2-DATA-024` | SQLite 0011 동일 DDL 합성 4/4 저장·재독, FK0 및 unknown Fact ID 저장허용·동일 ID INSERT OR IGNORE 위험. staging D1 미실행 | 부분 `[ ]` |

**다음 r74 AX담당자**: #173/#172/#168 스택을 새 main HEAD와 독립 대조하고 원장 sourceIds가 실제 생산자 Fact·SQL feature의 source_fact_ids_json과 같은지를 재생해 검증. `allocation.factIds=[]/unrelated`가 상위 검사/approval-readiness/D5110/11에서 차단되는지 Node 프로젝트 통합시험으로 확인. priority/estate source component 용어·비해당 이자 vs 미관찰 이자 및 제424호 적용일은 계산사무장/변호사 승인 후 진행. 법원 인가 확정, 운영 DB migration, 전자제출, 운영 배포 **미실행**.

**제품 최종 인수 0건.** 코드 존재/작성된 Node 테스트/실행된 V8 격리·SQLite 테스트/전체 CI/staging D1·R2/Cron/DOCX/법원 공식 동등성/변호사 승인은 서로 다른 증거 수준.
