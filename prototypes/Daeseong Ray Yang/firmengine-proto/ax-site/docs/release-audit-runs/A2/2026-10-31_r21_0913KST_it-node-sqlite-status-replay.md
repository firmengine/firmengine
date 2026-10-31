# FirmEngine A2 21차 — IT담당자: SQL 계산 피처 status 역전 거짓 정상 차단

- 기록일: 2026-10-31 KST; 역할 순환: r20 AX담당자 → **r21 IT담당자** → 다음 사용자·서류담당자.
- 작업 범위: `firmengine/firmengine` GitHub `main`, `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 시작 main **50d42d8a9b36e9b8008690e1a440aa095bc54f0f**. PR #71 최신 HEAD **42582fb14c13d2cb05d751dff6497c66be8dc756**, Draft·미병합. 기존 r20 영수증, 보드, 0011 schema, 저장기, replay, API, 테스트, 최근 main 커밋 및 열려 있는 PR를 열어 확인.
- 체크 ID 4개: **A2-IT-001, A2-IT-011, A2-IT-013, A2-IT-015**. 전부 **부분 검증 [ ] 유지**. 인수 0건.
- 코드 blob 재조회: 저장기 `bb5f88b26e68f5ae2234741063ac9301a927e27a`; SQL 0011 `0caa359d250dce45765d269d271ad63170ec3efa`; 새 replay `d381298c7bf5d698f646b1f8ca81a52f0e6808c0`; 기존 테스트 수정 `c515b88ddc78b7b41723a72b21affb415cc9f43f`; 새 테스트 `6f4264a89c76fe69030c2241c5741d8762482b5c`. 세 파일 Git blob SHA를 컨테이너의 동일 바이트와 맞춘 후 Node로 시험.

## 1. P1 저장 상태 불변식 결함 — 기존 r20 통합 PR #71에서도 거짓 정상

실제 저장기 `statusOf`는 값이 `null` 또는 `unknown`이면 (충돌·비해당을 제외하고) `missing` 또는 `blocked`를 만들며, 알려진 금액은 다른 구성요소 때문에 엔진이 막혀도 `provisional`로 남긴다. 기존 replay는 status의 문자열을 허용 집합에 속하는지만 검사하여 아래의 잘못된 저장 조합을 모두 `valid:true`로 통과시켰다.

| 전부 합성 원문→Fact→typed→SQL replay | 독립 기대 | PR #71 수정 전 Node 관찰 | 수정 후 Node 관찰 |
| --- | --- | --- | --- |
| 원문 미관찰 / Fact 없음 / typed `null`; `value_json=null,value_won=NULL,status=computed` | 차단(미관찰은 계산완료 아님) | **valid:true 거짓 통과** | `STORED_STATUS_VALUE_CONFLICT` |
| Fact 미확정 / typed `unknown`; `value_json="unknown",value_won=NULL,status=provisional` | 차단 | **valid:true 거짓 통과** | 차단 |
| Fact 명시적 0원 / typed `"0"`; `value_won="0",status=missing` | 차단(0≠missing) | **valid:true 거짓 통과** | 차단 |
| Fact 관측 240만원 / typed `2400000`; `value_won="2400000",status=blocked` | producer status와 불일치 차단 | **valid:true 거짓 통과** | 차단 |
| 미관찰 `null/missing`, `unknown/blocked` | 정상 미확정 유지 | valid | valid |
| 명시적 `0/computed`, `0/provisional`, `null/not_applicable` | 상태 분리 유지 | valid | valid |

**반례 실행:** 수정 전 신규 Node 4그룹 중 **3개 실패/1개 통과**, 이후 범위 내 replay 분기에 `STORED_STATUS_VALUE_CONFLICT`를 추가. 사용자·법원 인정 상태는 승격하거나 재계산하지 않음. 새 코드 Draft PR #71에만 반영하고 법률/세무 변경은 하지 않았음.

## 2. 실제 실행: GitHub와 바이트 동일한 Node 22 테스트

- 독립 런타임: Node **v22.16.0**, 명령 `node --experimental-strip-types --test tests/a2-r20-integrated-replay-numeric-won.test.ts tests/a2-r21-status-replay.test.ts` (파일·모듈은 허용된 GitHub branch blob SHA와 일치하도록 격리 복사).
- 기존 r20 테스트 7그룹과 신규 r21 테스트 4그룹, **11/11 PASS**, 0 fail, 0 skip. `unknown` 테스트의 fixture는 `statusOf` 실제 계약과 달리 provisional이던 것을 missing으로 보정했으며 기존 7개 기대 assertion은 유지.
- 정확 Git blob: `lib/preapproval-calculation-replay.ts` = `d381298c7bf5d698f646b1f8ca81a52f0e6808c0`, r20 test = `c515b88ddc78b7b41723a72b21affb415cc9f43f`, r21 test = `6f4264a89c76fe69030c2241c5741d8762482b5c`.
- **실행 범위의 정확한 의미:** 패키지 의존성 없는 해당 두 테스트만, 프로젝트 root `npm ci`·TypeScript build·전체 Node/CI·staging D1/R2/Word·배포가 아님.

## 3. 5,000/5,001 원화 SQL 부하 및 정밀도: SQLite 인메모리 제한

- GitHub main의 `drizzle/0011_case_calculation_features.sql`에서 `case_calculation_runs`, `case_calculation_features`, `case_calculation_heads` 열·FK·인덱스를 확인하고 Python SQLite **3.46.1 인메모리**에 재현. 참조 `cases` 테이블은 synthetic 최소 FK stub으로 대체. 실제 애플리케이션 `persistCaseCalculationFeatures`나 D1이 아님.
- synthetic run `SYN_RUN`의 **5,000행 INSERT/SELECT** 실제 성공, `LIMIT 5001` 조회 **5000행**, 적용 predicate `rowCount<=5000`은 true. 1행 추가 후 **5001행** 조회, 같은 predicate false. FK 위반 **0**.
- `value_json="null",value_won=NULL,status=missing`; `value_json=0,value_won="0",status=provisional`; `value_json="\\"9007199254740993\\"",value_won="9007199254740993"`의 세 저장·재조회 상태를 각각 대조. JSON number 거액으로 부정확하게 변환하지 않고 문자열로 보존.
- 이 시험은 실제 Cloudflare staging D1 batch/2워커 경합, read API, byte-limit, insert 경쟁 방어는 **미검증**. SQLite 조회 성공을 D1 합격이라고 표현하지 않음.

## 4. 계산·서식 정적 등록정보 대조

- `lib/reference-decision-tables.json` SHA `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 계산 **18모듈**, input 선언 **91**, 고유 **78**, output 선언 **42**(고유 이름 40), resultPaths **42**(고유 42).
- `lib/template-token-catalog.json` SHA `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37, D5110 55, D5111 82** 토큰.
- *정적 계약 파싱만 실행*했고 91입력→42출력→서식 DOCX 실제 값은 미실행. 가상 금액 2,400,000 − 1,400,000 = 1,000,000원, 36/48/60회 명목 합계 36/48/60백만원은 독립 산술 예상일 뿐 실제 법원 인정값 아님.

## 5. 공식 원문/적용일 및 승인 경계

- 국가법령정보센터 「채무자 회생 및 파산에 관한 법률」 **[시행 2026.10.02.]**, 법률 제21490호(2026.03.24. 타법개정), 제611조 변제계획 내용(제5항 원칙 3년 이내, 특별사정 예외 최대 5년). 공식: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221
- 서울회생법원 공식 **2026.10.01.** 보도자료: 실무준칙 제424호 제2조 제2항 **제7호 신설**. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . **첨부 개정 PDF 전문/부칙/경과조치 및 사건별 적용일 미인증**; 자동규칙을 추가하지 않음.
- 국세청 공식 일반/간이과세자 VAT 과세기간 및 신고안내: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 . VAT/종소세/경비를 월 급여·변제가능액으로 동일시하지 않음. 이 회차에 법률·회계 산식 수정 없음.
- 서울회생법원 공지=개별 법원 사건 인정 아님. 공식 법률 원문 확인=사건 승인/법원 인가 아님. 변호사·계산사무장 법률·세무·회계 최종 확인 전 미인증.

## 6. 적용 및 후속

- **Draft PR #71**: https://github.com/firmengine/firmengine/pull/71 에 `lib/preapproval-calculation-replay.ts` 보강, r20 fixture 1줄 수정, 신규 r21 테스트 4그룹 추가. 변경은 허용 `ax-site` 내부 3파일만.
- main에는 감사 영수증과 A2 ID 4개 부분진행 이력만 기록, 체크박스 **전부 [ ] 유지**. source-only/null/0/비해당/상충/승인전 구분 유지.
- 다음 r22 **사용자·서류담당자**: PR #71을 기준으로 더 넓은 Node/TypeScript·전체 CI 및 staging D1 저장기·조회기 종단 검증(우선 5000/5001). PR #67(부분월 급여), #60(OCR 원화), #58(D5103/D5110/11 preflight) 통합 충돌 검증. 급여 11/12개월·VAT/종소세 이중반영·36/48/60회 채권 배분·청산가치·공식 DOCX 바이트 및 법률실무자 승인 별개.

**인수 완료 0건, PR 미병합. 운영 배포/D1 운영 migration/실제 전자제출/법원인가 시행 0건.**
