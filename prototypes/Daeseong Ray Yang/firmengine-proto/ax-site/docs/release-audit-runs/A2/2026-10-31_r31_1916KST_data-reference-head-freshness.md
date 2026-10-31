# FirmEngine A2 r31 — 데이터담당자: 기준정보 reference SHA와 계산 head/feature 재생 신선도

- 감사: 2026-10-31 KST. 역할 순환 **r30 변호사 → r31 데이터담당자 → r32 AX담당자**.
- 프로젝트 `firmengine/firmengine`; 수정 허용 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **내부만**.
- 시작 main `c0e5337961a3c8a6863249e55a2250c6e1bf8ace`; r30 최신 [영수증](2026-10-31_r30_1813KST_law-liquidation-provisional-reasons.md)와 중앙 [단일 인수 보드](../../PRODUCT_RELEASE_INTEGRATION_BOARD.md) 읽음. 최근 main commits/PR #49/#70/#71/#84와 관련 스키마/코드/테스트 확인. 이 기록 생성 직전 main `c0e5337961a3c8a6863249e55a2250c6e1bf8ace`.
- 관련 main 원본 blob: `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`; `lib/case-data-recompute.ts` `cd967ced1c8262b1e8c67d62c2a373e4d2e2be94`; `tests/case-calculation-feature-store.test.ts` `844525d8633442d571ced2c48ed5bd00ba7bb5a0`; `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`; `lib/template-token-catalog.json` `899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- 선택 A2 ID: **A2-DATA-015, A2-DATA-016, A2-DATA-017, A2-DATA-024**. 모두 **[ ] 유지, 부분 검증**. 법률·회계 제품 인수 완료 **0건**.

## 1. 실제 GitHub SQL 보존계층 합성 replay (A2-DATA-015/017/024)

실제 고객 자료 없음. Python `sqlite3` 인메모리 DB에 **현재 `0011`의 계산 runs/features/heads 3테이블 컬럼·FK·인덱스와 동일 DDL**, 최소한의 합성 `cases`/`case_data_change_state`를 사용. `case-calculation-feature-store.ts`의 **실제 head 승격 INSERT ... SELECT ... ON CONFLICT WHERE 조건**을 그대로 복사해 실행함. 단 **Cloudflare D1 운영/staging 실행은 아님**.

- 합성: `synthetic-case`, 사건 revision **7**, 원본 dataVersion **4**, 동일 `inputSha256='1'*64`; 승인된 기준판본은 테스트상 **B**(SHA `bbbb…`)이고 저장된 새 head `run-new`가 B를 사용. 지연 입력 `run-old`는 구판본 **A**(SHA `aaaa…`)를 사용. 각 run에 월소득 JSON `"2400000"`, SQL `value_won='2400000'`과 수식 `SUM/N`을 저장.
- **독립 기대:** 오래된 기준 A run은 같은 case revision/dataVersion이라고 해도 현재 B run의 head를 덮어쓰면 안 되며, A run이 보이면 `headStale=true`여야 함.
- **실제 관찰:** 현재 main의 head UPSERT는 지연 A run에 대해 **changes=1**, head가 **run-new → run-old**로 바뀜. 현재 조회 `headStale`는 revision/dataVersion만 검사하므로 **false**, 그러나 저장 SHA A와 현재 B는 **불일치**. 쓰기경합 P0는 [A1 16차 영수증](../A1/20261031-round16-case-read-guard-handoff-ref-cas-0351KST.md)에서 이미 독립 보고된 미해결 문제. **이 감사의 read-side 수정을 write-side CAS 해결로 표현 금지**.
- 역조건: 사건 revision을 **8**로 바꾸고 오래된 revision **7** 저장 시 changes **0**; 원본 dataVersion을 **5**로 바꾸고 오래된 dataVersion **4** 저장 시 changes **0**. 이 두 기존 차단은 기대와 일치.
- SQL feature 명시적 `"0"` + `value_won='0'` + `computed` 및 `null` + `value_won=NULL` + `missing` INSERT/SELECT 재조회 성공; 서로 혼합되지 않음. 비해당/not_applicable, conflict, source-only, 승인전 PV와 법률 인정은 이 SQLite 사례에서 직접 실행하지 않았으며 **합격 처리 금지**.

## 2. 수정안과 검증 한계

- 새 **[Draft PR #87](https://github.com/firmengine/firmengine/pull/87)**; 별도 브랜치 `audit/a2-r31-data-reference-head-freshness-20261031`, HEAD `e299e787f433beee798697bf316b0b8f56a90827`. 모두 ax-site 하위 파일 3개만 변경, main 제품코드 미병합.
- `lib/calculation-head-freshness.ts`에 **read-side 신선도**만 판단하는 순수 함수: caseRevision, dataVersion뿐 아니라 현재 활성 reference SHA와 stored run reference SHA를 비교. `lib/case-calculation-feature-store.ts`의 반환 `headStale`에 연결. 새 회귀 테스트 `tests/a2-r31-reference-head-freshness.test.ts` 작성.
- Node **v22.16.0** 격리 환경에서 동일 helper 구현의 `node --experimental-strip-types --test` 8개 합성시험 **8/8 통과**. 동일판본 정상, 구판본, 활성판본 교체, 사건 revision, 원본 version, SQL NULL, 명시적 0 version, head 부재를 확인. **GitHub 프로젝트 checkout에서 해당 테스트를 import하여 실행한 것은 아님**. TypeScript 전체빌드·기존 테스트·CI 미실행.
- 고위험 **잔여 P0:** 같은 revision/dataVersion에서 늦은 A run이 head를 덮는 쓰기 CAS는 PR #87에서 수정하지 않음. 실제 활성 기준정보 판본의 트랜잭션 원천을 확인한 후 IT/데이터담당/변호사 검토가 필요. Draft #49 역시 `case-calculation-feature-store.ts`를 수정하므로 충돌 통합 회귀 전 **병합 금지**. 다른 에이전트 작업 덮어쓰지 않음.

## 3. 18모듈·91입력 / 서식 토큰 정적 재독 (A2-DATA-016/017)

실제 GitHub JSON 직접 파싱: **18 modules / 91 input declarations (78 distinct) / 42 output declarations / 42 distinct resultPaths**. `template-token-catalog.json`: **D5103 37 / D5110 55 / D5111 82** tokens. 이것은 **정적 등록계약 검증**일 뿐 91 typed input JSON 포인터→42 실제 SQL행→서식 output 전체를 계산/재독하는 E2E가 아님.

`case_calculation_features.value_json`은 필수, `value_won`은 nullable, `status`는 필수. 단수/복수 행과 `source_fact_ids_json`은 별도 저장. 원문 → Fact(reported/extracted/verified/disputed/retracted) → typed NumericInput → 계산 run → SQL feature → D5103/D5110/D5111 토큰의 **동일 revision/source heads/reference SHA** 종단 연결은 미관찰이다. 원천 없는 추정값, VAT 신고매출 vs 종소세 소득, 청산가치 미승인 PV도 자동 인정 금지.

## 4. 법령·국세청·서울회생법원 원문

- [국가법령정보센터 법 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777): 법률 제21490호 **시행 2026-10-02**, 변제기간 3년 원칙, 특별사정 5년 범위. 개별 기간 기계 적용 금지.
- [국가법령정보센터 법 제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710773): 인가의 공정·형평·수행가능성·기준일 청산가치 및 이의 시 추가 요건. 합성 `met`/금액은 법원의 인가가 아님.
- [서울회생법원 2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 준칙 제424호 제2조 제2항 **제7호 신설**. **공지는 확인, 첨부 PDF 개정전문 부칙·경과조치/사건별 적용일은 이번 실행 미확인**. 2026-10-01을 사건별 자동 시행일로 승격 금지.
- [국세청 VAT 신고·과세기간 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480): 일반과세자 반기/간이과세자 연단위. 매출/VAT/종합소득세/법원 인정소득 자동 동일시 금지.

## 5. 다음 r32 AX 항목

- PR #87와 #49의 동일 파일 병합충돌/회귀 검증; 별도 P0 reference CAS의 활성 기준판본 트랜잭션 원자성 검토.
- #84 청산가치 reviewer flags/approval PV가 사건 revision·dataVersion·reference/source head 바뀔 때 신선도 판정에 반영되는지; #71 SQL replay/#70 원화 SQL NULL/#58·#81 D5103 최종 검증과 종단 시험.
- 원문/Fact/typed/SQL 18모듈·91입력/42출력 및 Word 실바이트/토큰/서식 동등성, staging D1/R2/Cron/CI, 변호사/계산사무장 승인 **모두 미인증**.
- 운영 배포/운영 D1 migration/실제 전자제출/법원 인가 확정 **미실행**. A2 제품 인수 **0**.
