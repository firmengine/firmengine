# FirmEngine A2 r33 — IT담당자: 계산 head 참조판본/입력 지문과 법률 AI 사전검사

- 2026-10-31 KST / 회차: r32 AX담당자 → **r33 IT담당자** → r34 사용자·서류담당자.
- 엄수 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 운영 배포·운영 D1·전자제출 없음.
- 시작 관찰 main: `8e3e27abe5b31b3bdef434e3bc53ba52f4188bd3`; PR 브랜치 생성 직전 main: `1f8f346856e7254ecb797ccf9376f15bfe5e4550`. 쓰기 전 재조회 main: `1f8f346856e7254ecb797ccf9376f15bfe5e4550`.
- 기존 영수증: [r32](2026-10-31_r32_2010KST_ax-reference-head-paging-integration.md). Draft PR #49/#87/#41와 최근 커밋을 재조회했으며 기존 코드/PR을 main으로 가정하지 않음.

## 보드 선택 ID와 결과

| ID | 확인사항 | 판정 |
|---|---|---|
| A2-IT-003 | case/source/head/run 버전·input SHA·reference SHA 일치 검사 | 부분. main 법률 AI 사전검사에 reference 비교 없음; Draft #91에서 별도 보수적 판정 제안. **[ ] 유지** |
| A2-IT-008 | 계산 중 기준정보 A↔B 변경 및 CAS | r32 main 실제 UPSERT에서 B→A 덮어쓰기, r33 기존 preflight SELECT에서도 구 A 채택 재현. **쓰기 CAS 미해결, [ ]** |
| A2-IT-009 | 관리 기준정보 활성화/롤백 및 영향검사 | reference-runtime의 request-scoped provider, fallback release SHA 정적 확인; 활성판본 고정/롤백·DB 원자적 epoch 미검증. **[ ]** |
| A2-IT-019 | 입력 SHA와 저장된 계산 run/head 지문 일치 | SQL B/구 A·run/head mismatch 합성 검증, Draft #91 helper 17/17. 전체 원문→Fact→typed→SQL hash E2E 미실행. **[ ]** |

## 실제 읽은 main 코드/스키마

- `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a` — immutable run/features, head UPSERT 비교가 revision/dataVersion에 제한.
- `lib/case-legal-calculation-preflight.ts` blob `c17892e63bf00d2981f292b0ef28e032d66a8dc7` — current SELECT가 revision/dataVersion만 비교; `r.reference_sha256`, `r.input_sha256` 불검사.
- `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`; `drizzle/0020_calculation_poll_fairness.sql` blob `f4906ad0dcefa4bdce67f00b104540d2266f890d`.
- `lib/reference-runtime.ts` blob `9993469a164740e8a9128874b299a967b420e230`와 `lib/reference-release.json` blob `5537e47c163fb87447f51560e1433866d67faf76`; 실제 다른 worker의 최신 승인판본을 DB가 원자적으로 보증하는 계약은 미확인.
- 기존 `tests/case-calculation-feature-store.test.ts`, `tests/case-legal-calculation-preflight.test.ts`; Draft #41가 후자 원화 검사를 수정하므로 합성 통합회귀 필요.

## 합성 입력/독립 기대/관찰

- 원천의 **가상** 한 줄 `2026-01 급여 2,400,000원`; Fact 후보 `{factId:'SYN-r33-F1',value:'2400000',state:'source_only'}`, typed 후보 `{approvedMonthlyIncomeWon:null,observedMonthlyIncomeWon:'2400000'}`로 0/미관찰/승인전 구별. 이는 **설계상 표현 예시**이고 실제 원문→Fact→typed 앱 실행 결과가 아님.
- 인메모리 SQLite는 실 코드 migration 0011과 동형 3테이블을 사용. 사건 `synthetic-r32`, revision `7`, source dataVersion `4`, input SHA `111…`(64자리); B(reference `bbb…`, 원화 `2400000`), A(reference `aaa…`, 원화 `0` = **명시적 0**, `NULL` 아님).
- **독립 기대:** 활성 기준 B라면 B 계산만 current이며 과거 A는 동일 revision/dataVersion이라도 current=false. 인가/인정/승인액으로 자동 승격 불가.
- **현재 main 관찰:** r32 동형 UPSERT SQL의 A 지연 저장은 B head를 A로 덮음. r33 직접 실행한 **main 법률 AI preflight 원본 SELECT**는 구 A를 여전히 1행 반환(본래 current WHERE 술어 만족), reference A/B 불일치는 검사하지 않음. 별도 `status=computed`는 법률 인정이 아님.

## 변경 및 실제 검증

- **Draft [PR #91](https://github.com/firmengine/firmengine/pull/91)** (main 미병합), 제품 3파일: 신규 `lib/legal-calculation-head-freshness.ts`, 새 `tests/a2-r33-legal-calculation-head-freshness.test.ts`, 수정 `lib/case-legal-calculation-preflight.ts`. 수학·인정·기준값은 미변경; 구 reference/run-head 입력 지문 불일치는 대기 경계로 표시.
- Node v22.16.0 `node --experimental-strip-types --test tests/a2-r33-legal-calculation-head-freshness.test.ts`: **17/17 실제 실행**. B=current, A=stale, case/head/run revision/버전/sha 충돌, null·0, missing/invalid ID·invalid ref.
- `tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext lib/legal-calculation-head-freshness.ts`: **exit 0**. 전체 TypeScript 프로젝트 검사는 아님.
- Python in-memory SQLite: 새 SELECT + 이력재현 조건 **7/7 독립 기대일치**, main 현재 조회 구 A 채택 반례 **1/1 재현**. 실제 Cloudflare D1/동시 HTTP/스테이징 아님.
- 이전 r32 SQLite 16/16 포함 수치는 **결함의 예상 재현 성공**이지 제품 인수 합격률이 아님.
- Draft #41의 같은 파일 `evaluateLegalCalculationPreflight` 범위와 별개 수정이나, **통합 회귀 없이는 병합 불가**. Draft #49/#87 페이지 run/조회 stale 조건은 #91로 대체되지 않음.
- 제품 인수 0건. 신규 로컬 Node 순수 helper·SQL 합성 검증만 수행했고 전체 repo Node/CI, 실제 legal AI scheduler, D1/R2/Cron, Word, 공인 서식, 세무·법률 실무자 승인 모두 미인증.

## 정적 계약 대조

- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 직접 JSON 파싱: **18개 모듈, 91 입력 선언(고유 78), 42 출력 선언(고유 40), 결과 경로 42(고유 42)**.
- main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 직접 JSON 파싱: **D5103 37, D5110 55, D5111 82토큰**. 서식 생성 바이트 검증 아님.

## 공식 원문 확인(사건별 적용 미인증)

- [국가법령정보센터 법률 제21490호·시행 2026-10-02 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777): 변제기간 3년 원칙, 특별한 사정에서 최대 5년; [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710773): 실제 법원 인가요건 별도.
- [서울회생법원 공지 2026-10-01](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 제424호 제2조 제2항 제7호 신설 **공지 확인**. PDF 부칙·시행일/경과조치·개별 사건 법원 적용 확인 전 **무승인 자동규칙 불가**.
- [국세청 VAT·종합소득세 공식 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480): 일반과세자 VAT 6개월, 간이과세자 1년, 종합소득세 연간 합산 안내. VAT·종소세·순사업소득 서로 자동 동일시하지 않으며 이 회차 세무 계산 변경 없음.

## 다음 r34 사용자·서류담당자

1. #91 + #41의 같은 파일 교차회귀; 선택 소득 12/11개월+0/null/미래월에서 미승인 수치가 D5103 최종본의 인정 소득으로 승격하지 않는지 종단검증.
2. P0 구 reference 지연 쓰기 막는 DB 원자적 reference epoch + CAS 계약 설계/별도 Draft PR 및 IT·데이터·변호사 동의. 현재 #91은 사후 preflight 감지에 한정.
3. 실행 전후 reference SHA 변경 TOCTOU, #49/#87 페이지 run/조회 통합, SQL 5,000/5,001, 18/91/42 출력·Word token·실제 D1/R2/staging 테스트 분리.
4. [ ] 미완료 유지, 실제 고객 문서·원본 OCR/개인정보/.env/비공개 정답/키 Git 금지. 운영 배포·운영 마이그레이션·전자제출·법원 인가 확정 금지.