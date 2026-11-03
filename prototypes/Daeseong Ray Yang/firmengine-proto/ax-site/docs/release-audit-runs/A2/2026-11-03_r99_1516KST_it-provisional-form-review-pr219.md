# FirmEngine A2 r99 — IT담당자 / provisional 계산 피처의 법원서식 수동검토 게이트

- 일자: **2026-11-03 KST**. 역할 순환: r98 **AX담당자** → r99 **IT담당자** → r100 **사용자·서류담당자**.
- 작업 허용범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 시작 및 영수증 직전 main HEAD `e265d66237a31049f58987daf8236619109aa4c8` (재검증 시 변할 수 있음). 중앙 인수보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 우선.
- 우선 A2 ID: **A2-IT-003 / A2-IT-015 / A2-IT-019 / A2-IT-020**, 네 ID **모두 [ ] 보존**. 기술적 일부 검증이지 제품 인수/법률 인증이 아님.
- 원본/Schema/테스트 직접 읽음: main `lib/lawgraph-document-field-projection.ts` blob `a017294aa814f4d33360c2531abf91d9eb79a6e0`; `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`; `tests/lawgraph-document-field-projection.test.ts` blob `63e1b89a02c0235f0106fd7eec69d1f936da2ec5`; 기존 [r93 IT 영수증](2026-11-03_r93_it-form-run-owner-pr209.md), [r98 AX 영수증](2026-11-03_r98_ax-category-proof-pv-and-filing-date-gates.md).
- Draft #209(계산 run 사건·revision·version 격리), #217(#18 위 제424호 긍정 Fact ID), #84(PV 검토), #215(임시 원장 final), #205/#207(Fact lineage) 확인; 관련 변경 중 #209·#205·#207이 같은 서식 projection 파일에 걸쳐 병합 충돌 가능. #209는 **Draft, main 미병합**, run 메타만 검사하며 원천 Fact·reference SHA나 provisional 승인은 보증하지 않음.

## 1. 새 P1 후보 — 서식 계산금액의 미승인 상태가 검토 불필요로 표시됨

main `projectLawgraphDocumentFields()`의 exact 행 선택 조건은 `["computed","provisional"].includes(r.status)`; `status="linked_calculation"`에서 `manualReviewRequired=false`가 된다. 즉 독립 Fact 승인 확인 없이 *provisional* 계산 feature가 기술적 링크이며 **서식 수동검토 불필요**로 노출되는 불일치가 발생한다.

독립 기술 기대: **provisional 금액/원천은 그대로 유지하지만 수동검토 플래그 TRUE**. 이는 법률적 승격/금액 변경이 아닌 서식 데이터 상태 표시상의 보수적 검토 경계다. 최종 문서 자동통과를 입증한 것은 아님.

| 합성 저장 feature 입력 | 독립 기대 (status/manual) | main V8 관찰 | [Draft #219](https://github.com/firmengine/firmengine/pull/219) V8 관찰 |
|---|---|---|---|
| computed + D5103 월소득 900000 | linked / false | linked / false | linked / false |
| **provisional** + 동일 금액 | **linked / true** | **linked / false** | **linked / true** |
| blocked + 동일 금액 | review_required / true | 동일 | 동일 |
| conflict + 동일 금액 | review_required / true | 동일 | 동일 |
| missing + 동일 금액 | review_required / true | 동일 | 동일 |
| computed + 명시적 `"0"` / 표시 `"0"` | linked / false | 동일 | 동일 |
| computed + 표시 null | missing_value / true | 동일 | 동일 |
| computed + 표시 900001 (저장값 900000) | review_required / true | 동일 | 동일 |
| provisional + source IDs `[]` | linked / true (단, 실제 Fact 미검증) | linked / false | linked / true |
| computed + source IDs `[]` | linked / false (기존 기술동작, 별도 문제) | 동일 | 동일 |

**실행법:** GitHub의 main 및 PR #219 *실제 함수 본문*을 가져와 TS 타입 선언만 제거, `currentFacts`, 양식 계약(합성 D5103 월소득 토큰), 필수 서식 선택은 명시적 stub으로 주입한 격리 V8 시험. *수정 전 독립 기대 8/10*, *수정 후 10/10*, 원문 표시값/출처 Fact ID 보존 10/10. 프로젝트의 실물 form contract/실제 Facts/계산엔진/DB/API/Node runner를 수행한 결과가 **절대 아님**.

특히 computed + `sourceFactIds=[]`이 이미 `manualReviewRequired=false`인 경계는 **#205/#207의 타 사건/빈 Fact/subject 가드 통합이 없으면 여전히 문제**다. #219는 이를 의도적으로 변경하지 않았다. Draft #219는 2파일만 수정: `lib/lawgraph-document-field-projection.ts` 1표현식, `tests/a2-r99-it-provisional-form-lineage.test.ts` 합성 Node 회귀 **7개 작성만, 미실행**, TODO 2건. 코드 커밋 `b5c130ad853cf7c914f5b3c8ec167b984cdaea45`, 테스트 커밋 `80a1e7e2cddb0b39713feb56f3cfe977f5388be8`; 변경 blob `74c7a5c8ca7ed9bd3549f0ccece5dcaaa6735872`. **main 제품 코드는 바꾸지 않음**. CI status 0개 관찰됨 → CI PASS 아님.

## 2. 실행 데이터 / 독립 산술 / 정적 계약

- **원문/OCR:** 합성 단계에서 사용하지 않음(미관찰), 실제 고객 원본·OCR facts 저장 없음.
- **Fact:** `SYN-FACT`는 합성 **문자열 참조**만, DB 존재/동일 사건/recognition/승인은 source-only 미검증.
- **typed:** `D5103.monthly_income="900000"`(및 0, null, 900001), `caseRevision=7` 합성.
- **SQL feature:** 본 시험은 migration 0011 저장형식(`value_json`=`"900000"` 직렬화, `source_fact_ids_json`=`["SYN-FACT"]`, status=`provisional`)과 동일한 필드로 생성한 JS **projection input**. 실제 SQL INSERT/SELECT/D1 **수행 안 함**. 계산 run owner/revision/dataVersion은 #209 별도 초안의 검증 경계; input/source/reference SHA 또는 활성 head/인정 확정 미검증.
- **서식:** D5103 합성 token projection을 **실제 함수**로 계산, Word/DOCX bytes 생성·재독 아님. D5110/D5111 출력값은 **미관찰**.
- 독립 BigInt 명목변제: 월 900000원 × 36/48/60개월 각각 **32400000 / 43200000 / 54000000원**. 할인 현재가치/청산가치/법원 인정액이나 전체 18계산엔진 결과가 아님.
- main `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 정적 직접 파싱 **18모듈, input 선언 91 (고유78), output 42 (고유40)**; `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 직접 파싱 D5103 **37**·D5106 **48**·D5110 **55**·D5111 **82**. 각 token의 실물 DOCX 렌더·재독, 42개 출력의 계산·저장은 미실행.

## 3. 법원/법률/세무 원문과 적용 경계 (2026-11-03 조회)

- **서울회생법원** 실무준칙 제424호 `https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2` PDF **0기준 p271~272 제424호 / p391 부칙 이미지 직접 확인**: 2026-09-23 개정, 2026-10-01 시행, 시행 이후 **최초 접수 사건부터 적용**; 이전 이미 인가된 계획 효력 비침해. 제7호에는 최근 2년 최저임금 미만 급여, 채무 5000만원 이하, 개인채권자 없음, 최근 1년 신규채무 없음(물품구입 신용카드채무 예외)의 누적요건이 있다. **법원=서울회생법원**에 한정; 개별 사건 최초 접수일/관할은 원천증빙 및 변호사 승인 전 미확정.
- **법률 제21490호 (2026-03-24 타법개정, 2026-10-02 시행판)**: 제611조 `https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR` 및 제614조 동일 주소 `joNo=0614`를 공식 원문으로 직접 확인. 변제기간 원칙/예외·재단채권/우선채권·인가 요건은 단순 SQL 링크/합성 산술과 별개. 서울 준칙 시행 10/01과 법률 10/02를 혼합하지 않음.
- **국세청** 부가가치세 안내 `https://t.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486`: 일반과세자 반기 6개월, 간이과세자 통상 연간. VAT 신고액/종소세·수입/입금을 법원 인정 월순소득에 무승인 자동합산·중복계상하지 않음. 이번 IT 회차에 실제 급여/사업/세금 월별 실계산은 **미실행**.

## 4. 보드 ID별 판정 및 다음 (네 ID 모두 [ ] 미완료)

- **A2-IT-003 [ ]** run case/revision/version #209(미병합)·reference/input SHA/활성 head·서식 status 미연결. #219 provisional human-review 시각화 보완만 격리검증.
- **A2-IT-015 [ ]** 0011 DDL과 실제 feature 저장 문자열을 검토했으나 이번 회차 SQL INSERT/SELECT, D1→typed→재계산→42 output round trip 미실행.
- **A2-IT-019 [ ]** source Fact 소유/인정/원문 SHA→계산 input/output/sourceHeads SHA→서식 금액 해시 종단 미실행. #219의 source strings는 source-only.
- **A2-IT-020 [ ]** computed/provisional/blocked/conflict/missing, 명시적 0/누락 null/상충값 **10개 격리 조건** 테스트; Node 작성된 7개 미실행. 정적 타입 보증/전체 프로젝트 CI 미실행.
- **다음 r100 사용자·서류담당자:** #219와 #209/#205/#207/#195/#200/#212의 projection/final-form 충돌 및 테스트 독립 기대값 대조, 정식 Node 프로젝트 러너/tsc/CI, staging D1·R2, 실제 D5103/D5110/D5111 Word byte 재독. 최초 접수일·관할 Fact, 미승인 PV(#84)·잠정 변제원장(#215) 최종 게이트 별도 변호사·서류담당자 승인 HOLD.

**합성 V8 부분 통과 ≠ Node 프로젝트 테스트 ≠ CI ≠ staging D1/R2/Cron ≠ Word/법원 공식 서식 동등성 ≠ 실무자/변호사 승인 ≠ 법원 인가.** RELEASE_READY 0건. 공개 Git에 개인정보/원본OCR/키/.env/비공개 정답 미기록. 운영 배포·운영 D1 마이그레이션·전자제출·인가 확정 **미수행**.

## 5. 커밋 후 TypeScript 계약 확인 보완

`StoredDocumentField.citation?: unknown` (`lib/case-lawgraph-store.ts` blob `eea435bb78f804c79a213c464af54e8014a3c3a5`)이므로 신규 Node 테스트 내 필드 직접 속성 접근 12곳을 `(row.citation as any)` 타입 단언 후 검사하도록 수정했다. 보완 커밋 `c0eaedac73c982b8b79f64138bfe3bcd1781abcd`, 테스트 파일 blob `57160f8ff612e89780d8b69b57cbddf38790ea14`. 타입 시그니처 정적 재독에 따른 수정이지 **실제 TypeScript/Node 프로젝트 컴파일 PASS 관찰이 아님**. Draft PR #219은 계속 HOLD.
