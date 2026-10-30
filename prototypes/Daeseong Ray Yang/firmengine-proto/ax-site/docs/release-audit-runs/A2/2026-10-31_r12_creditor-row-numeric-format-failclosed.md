# FirmEngine A2 12차 — 채권자 변제행 금액·원화 표시가 숫자 검증을 우회하는 P1

작성 기준: 2026-10-31 KST. **합성 데이터만 사용**, 코드 변경 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 이전 11차의 변호사 중심 회차 다음으로 **AX → IT → 사용자·서류 → 계산사무장 → 데이터** 관점에서 시작한다. 합격/출시 0건.

## 0. main/PR/스키마·전회 영수증 확인

- 시작 main HEAD: `dc48c38289a9a28ec7fa1bd5f878bf73bb48b0ec` (2026-10-30 14:56 UTC). 최근 main 8개에는 A1 12차, A4 11차, A3 11차 및 A2 11차 `fcc37dd`/`022c5af` 포함. 이전 A2 11차 [영수증](2026-10-30_r11_d5110-d5111-numeric-scalar-final-gate.md)과 중앙 보드 확인.
- 현재 미병합 A2 Draft #13/#18/#21/#25/#29/#33/#37/#38/#43/#47/#50/#53 등을 조회. **#21과 #53 모두 `lib/document-preflight.ts`를 수정한다.** 그대로 합치지 않고 추후 병합/Node 종단 회귀 대상으로 남긴다.
- PR #53 변경 직전 HEAD `83fd82fd699d5219dade179d15eb32ed04fb7627`; 대상 원문 blob `6f032ff6215269658da6230d37e0503a05a92ca1`; 테스트 blob `a5e6bb6417a205aff64e477db92afb55a733e2dc`. SHA/CAS 재조회 후 같은 **기존 Draft PR #53** 브랜치의 2개 파일만 수정.
- 수정 코드 커밋 `6e76d8b2b6866beda2a0bbd02b544939323aff26` (blob `fb60cc2b737d4244867933f8b41211aa78d377af`), 테스트 추가 커밋 `dd481b05274358f2f14f7e3ae60fc314404b8101` (blob `214917ef5149407208da1e150b8d445d802a56ad`). PR 변경 파일은 해당 코드와 테스트, **둘 다 ax-site 아래**임을 재확인. main 제품 코드는 미변경.
- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 정적 파싱: 계산 18, 입력 선언 91(고유 78), 출력 선언 42(고유 40), resultPaths 42(고유 42). `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5110 55, D5111 82 토큰. **등록 개수와 실계산/SQL 저장/Word 결과는 다른 증거 단계**.

## 1. 실제 재현 — 이미 존재하는 숫자 토큰뿐 아니라 채권자 반복행도 확인해야 함

`document-preflight.ts`에서는 PR #53의 기존 scalar 검사 이후에도 `creditor.principal`, `creditor.monthly_payment`, `creditor.total_payment`이 `BAD`여도, 총계와 비교할 수 없으면 검사를 생략해 **final `ready`**였다. 또한 `numeric()`의 정규화는 쉼표·공백·원 문자를 임의 위치에서 모두 제거하므로 `1,00,0000` / `1원000000` / `1 000 000` / `1,,000`을 잘못된 표시로 차단하지 못했다. 이는 채권의 법률상 인정 여부가 아니라 **표시·숫자 무결성 문제**다.

격리 합성 입력: `FormBindings.scalars`의 월 인정소득 3,000,000원, 생계비 2,000,000원, 월 가용소득/월 변제액 각 1,000,000원, 기간 36회, 총 변제액 36,000,000원, 현재가치 12,000,000원, 청산가치 10,000,000원, 수수료 0원. `rows.creditor[0]`은 가상 채권자, 원금 `100000`/월액 `100`/총액 `3600` 사용. 실제 주민번호·채권자·OCR 사례는 포함하지 않음.

| 합성 범위 | 독립 기대 | #53 기존 함수 관찰 | 수정 후 실제 함수 관찰 |
|---|---|---|---|
| D5110/11 채권자 원금·월액·총액 각각 `BAD` (6건) | final blocked | 전부 ready | `PLAN_CREDITOR_ROW_NUMERIC_INVALID` blocked |
| 월액 `1,00,0000`, `1원000000`, `1 000 000`, `1,,000` (4건) | final blocked | 전부 ready | `PLAN_SCALAR_NUMERIC_INVALID` blocked |
| 정상 기준액, 천 단위 `1,000,000`, `₩1,000,000원`, 명시적 원금 `0` (4건) | 기존 정상 유지 | ready | ready |
| 채권자 원금 `[확인 필요]` (1건) | unresolved, final blocked | blocked | `FIELD_UNRESOLVED` blocked |
| 추가: draft의 채권자 월액 `BAD` | warning·승격금지 | — | `PLAN_CREDITOR_ROW_NUMERIC_INVALID` warning, 해당 blocker 0 |

**실제 함수 본문 격리 V8 실행은 위 최종본 15/15 기대 일치, 추가 초안 1건 기대 일치.** 수정 전 **10개 final 거짓 `ready`**를 관찰. 법률 산술 함수는 최신 main의 실제 본문을 TypeScript 선언만 제거해 실행했고, 계약 구성은 최신 실제 토큰·필수도 JSON으로 재구성했다. contractHash 계산의 WebCrypto는 더미로 대체했다. 따라서 **Node 프로젝트 테스트/타입검사/실제 D1/문서 Word 생성/전체 CI 통과가 아니다**. 실제 추가한 Node 테스트 3그룹은 코드로만 등록했고 프로젝트 실행은 하지 못했다.

독립 계산 검산: `3,000,000−2,000,000=1,000,000`, `1,000,000×36=36,000,000` (정수 BigInt). 숫자 표기 유효성만 판단했으며 적격 소득·청산가치 인정·현재가치 할인·변제배분의 법률적 타당성을 승인하지 않는다.

## 2. 수정 경계

- PR [#53](https://github.com/firmengine/firmengine/pull/53) 내 `lib/document-preflight.ts`의 숫자 파서를 단순 문자 삭제에서 **정수원 또는 정확한 천 단위 쉼표 + 통화 접두/접미 표시만 허용**하도록 변경. 행 단위로 3개 채권자 금액을 검사하여 **명시적 잘못된 금액만** final blocker / draft warning. `null`/미관찰/`[확인 필요]`은 기존 별도 상태, 명시적 `0`은 0.
- 새 회귀 3그룹 `tests/a2-plan-form-numeric-preflight.test.ts`에 합성 반례·정상·초안·미관찰 추가. 기존 11차 scalar 테스트 삭제/변경 없음.
- PR #21의 D5103 월별 원천 0행 차단과 PR #53의 금액 파서는 별도 수정이다. 이전 회차의 격리 합성 결합은 양쪽 조건이 독립 동작함을 보여줬지만, **이번 PR53 보완 후의 실제 Git 병합·Node 회귀는 미실행**. 병합하지 않는다.

## 3. 공식 원문·적용 경계

- [국가법령정보센터 제589조](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018130103): **채무자 회생 및 파산에 관한 법률 [시행 2026-10-02], 법률 제21490호**, 신청서 첨부 채권자목록의 채권 원인·금액, 재산목록, 수입·지출목록 및 소득증빙 확인. 이 법판본의 개별 사건 적용 여부는 사건 기준일별로 전문가 확인.
- [서울회생법원 2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 제424호 **제2조 제2항 제7호 신설** 내용 확인. **시행·사건별 경과조치 및 제7호 상세요건은 본 회차에 원문 PDF 독립 재독 미완료**; 자동 적용 금지.
- [국세청 부가가치세 안내](https://sc.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272): 일반과세·간이과세 계산 구분. VAT 납부세액/사업소득/법원 인정 순소득을 자동 동치 처리하지 않음. 이번 보완으로 VAT·소득세 산식을 변경하지 않음.

## 4. 체크 ID (모두 [ ] 부분 검증·인수 미완료)

| ID | 실제 관찰 및 남은 범위 |
|---|---|
| A2-AX-017 | 숫자 문자열이 법률상 인정/인가로 승격되지 않도록 final/draft 분리; 자동 법률승인 `false` 계약 코드 확인. 변호사 승인경로 E2E 미실행. |
| A2-IT-020 | 실제 TypeScript 함수본문의 엄격 숫자 파싱 경계, D5110/11 채권자행 금액 반례 15/15. Node 22 프로젝트·D1·API 미실행. |
| A2-DOC-018 | D5110/11 55·82 토큰 등록정보와 creditor 3종 금액 검사. 실제 DOCX·공식 e-form 양식 비교 미실행. |
| A2-CALC-030 | BigInt 독립 36회 총액 검산, 오류/0/미관찰 구별. 18 산식 91입력 전체 실행·36/48/60 배분/현재가치 미완료. |
| A2-DATA-020 | 명시적 0, `[확인 필요]`, present malformed, 초안 warning을 별개 상태로 유지한 함수 격리시험. Fact/typed/SQL 실재조회 미인증. |

## 5. 다음 A2

1. Draft PR #21 + #53의 **최신 원문 통합** 후 Node22/TS 및 D5103/D5110/D5111 생성 Word 실측, 3개 반복행/0행/혼합 숫자/마스킹/관할·시행일별 서식 대비.
2. PR #25/#29/#37/#43/#47/#50 통합 원장과 월별 36/48/60회 다채권·원단위/잔여원/월말 지급일에 대한 실제 노드·저장 재조회·D5110 금액/날짜 동일성.
3. `18×91` 계약과 42 resultPaths를 원문/Fact/typed/SQL/head/latest → official form token/Word SHA로 추적; 0/null/NA/상충/source-only를 분리.
4. 2026-10-01 서울 준칙 424호 부칙/제7호와 2026-10-02 법 시행판의 개별 사건 적용은 반드시 변호사·법률실무자 검토.

**최종 인수 완료 0건.** 운영 D1 migration, 배포, 실제 전자제출, 법원 인가 확정 수행하지 않음.
