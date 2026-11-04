# FirmEngine A2 r124 — 사용자·서류담당자: 채권원금/이자 출력 총계 미관찰·오인식 차단 (Draft #236)

- 실행일: **2026-11-04 KST**, 회차 124; 직전 r123 IT담당자 → 이번 사용자·서류담당자. 기준 조회 main HEAD `92de9cc892abf8678a3d472e3713b4c17a2c6c70`, 감사 영수증 작성 직전 HEAD `92de9cc892abf8678a3d472e3713b4c17a2c6c70`.
- 변경범위: 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. **제품 인수 0건**, A2-DOC-002/005/016/018 모두 [ ] 유지.
- 기존 r123 [영수증](2026-11-04_r123_1516KST_it-form-malformed-money-draft235.md)과 r88 [영수증](2026-11-03_r88_0409KST_doc-strict-preflight-month-creditor-pr200.md), 해당 Draft #200 및 #234→#235 확인. 기존 중앙 보드 ID 이력 우선.

## 새 경계조건: 유효 채권행 + 불명확한 합계

현재 main `lib/document-preflight.ts` (읽은 blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`)는 `numeric()`에서 쉼표·공백·원 기호를 임의 제거하여 `1,20`을 120원으로 파싱한다. [Draft #200](https://github.com/firmengine/firmengine/pull/200) (부모 HEAD `d463ccceb08d08f4f66146fe11098bd969303e59`, 해당 파일 blob `65ba55037cb4fc64c00ccf8c6203617f56ce2c00`)은 행 금액의 비정상 형식을 차단하지만 **출력 합계가 null/미확정/비정상인 경우 `total===null`로 계산 대조를 건너뛰는 분기**가 남았다. 원금/이자 합계에 유효 행이 존재하면 독립 총계 대조가 불가능하므로 최종서식 준비 완료로 승격할 수 없다는 기술적 무결성 기대를 사용했다.

동일한 실제 GitHub 함수에서 `numeric()`와 채권 반복행 대조 구간을 추출해 TypeScript 타입만 제거한 V8 격리 함수로 실행함(엔진 재구현/전체 Node 실행 아님).

| 합성 표시총계 / 반복행 | 독립 기술 기대 | main | #200 | #236 후보 |
|---|---|---|---|---|
| `120` / `120` | 통과(형식·합계만) | 통과 | 통과 | 통과 |
| `121` / `120` | 합계 불일치 차단 | 미차단 | 불일치 차단 | 불일치 차단 |
| `1,20` / `120` | 총계 미검증 차단 | 미차단 | 미차단 | **총계 차단** |
| `0 0` / `0` | 총계 오인식 차단 | 미차단 | 미차단 | **총계 차단** |
| `1원2` / `12` | 총계 오인식 차단 | 미차단 | 미차단 | **총계 차단** |
| `[확인 필요]` 또는 null / `100` | 총계 미관찰 차단 | 미차단 | 미차단 | **총계 차단** |
| 총이자 `BAD` / 이자행 `0` | 이자 총계 차단 | 미차단 | 미차단 | **총계 차단** |
| `300` / `100`+`200` | 합계 검산 통과 | 통과 | 통과 | 통과 |
| `3,00` / `100`+`200` | 총계 오인식 차단 | 미차단 | 미차단 | **총계 차단** |

**격리 14 최종조건 독립 기대 일치: main 5/14, 기존 #200 7/14, 새 후보 #236 14/14.** 단순 산술 독립값: 100+200=300, 0+0=0. 수정 브랜치에 커밋된 실제 `document-preflight.ts` (blob `d814bf6a06e2206d8125c9cadf39514c1bbc645f`) 재읽기 후 13/13 최종 V8 조건 일치, draft 미검증 총계 → warning, 총이자 BAD → final blocker 추가 격리 확인. 원문 Fact/typed/SQL 실사례 종단 평가가 아니다.

## 수정 및 실제 수행 범위

- 새 **미병합 stacked [Draft PR #236](https://github.com/firmengine/firmengine/pull/236)**. 부모는 미병합 #200 브랜치. 변경 코드 `lib/document-preflight.ts`: 채권행이 1개 이상이고 총원금/총이자 파싱이 null이면 `REPEAT_TOTAL_AMOUNT_UNVERIFIED` (final=blocker, draft=warning). 숫자·채권 우선순위·소득 인정·법률 기준 변경 없음.
- 추가 합성 회귀 파일 `tests/a2-r124-doc-creditor-total-unverified.test.mjs` 15개 test+1 todo, 커밋 `1fa3db7635b90c75f7b22e9f68351cc2590499e2`. **프로젝트 Node 러너로 실행하지 않음**; 별도 V8 실제 코드 단편만 실행. #200 대비 diff 2개 파일 모두 허용 경로 내부.
- 채권행이 **0개**인 경우 해당 변경은 대조하지 않음; 기존 [Draft #212](https://github.com/firmengine/firmengine/pull/212)의 반복행 누락 게이트와 통합해야 함. #234→#235의 소득금액 표시보류도 미병합, 전체 Word/CI와 별도.
- main 제품 변경 없음. SQL `drizzle/0011_case_calculation_features.sql`의 raw JSON/status/value_won 저장 계약 및 `lib/form-mapping.ts`의 채권/변제 투영 읽기만 수행; 실행한 D1 SQL 저장·Word 바이트 없음.

## 계약·법률/세무 확인의 경계

- main `lib/reference-decision-tables.json` (blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`)을 JSON 파싱: **18 모듈, 입력 선언 91/고유78, 출력 선언 42/고유40, 결과경로 42**.
- main `lib/template-token-catalog.json` (blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`)을 JSON 파싱: **D5103 37, D5106 48, D5110 55, D5111 82** 등록토큰. 등록 사실은 실제 Word 서식 치환/공식양식 검증과 다름.
- 2026-11-04 직접 웹 확인: [서울회생법원 2026-10-01 제424호 제7호 신설 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187). 부칙 **시행 이후 최초 접수 사건** 조건은 기존 r120 공식 개정전문 재독 영수증 인계; 이번 회차 직접 PDF/부칙 재독 없음. 최초 접수증 Fact·관할·승인 lineage 미인증 → 자동확정 금지.
- [국세청 공식 부가가치세 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806): 일반 6개월·간이 원칙적 1년 확인. VAT 신고매출/종소세를 인정 월순소득으로 자동 확정하지 않음.
- 국가법령정보센터 [제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) 2026-10-02 시행판은 r123 영수증 인계 링크이며 **이번 회차 직접 열람은 접근 실패**, 새 법률 적합성 인증 없음.

## ID / 미완료 / 다음 회차

- `A2-DOC-002` [ ]: 채권행과 원금/이자 총계 형식·대조. 이번 신규 총계 null/문자형 차단 초안·V8 검증, D5106 실제 Word 재독 미완.
- `A2-DOC-005` [ ]: D5110/D5111 반복채권 배분의 총계/월액 대조는 아직 정적 소비처만 확인, 실제 36/48/60개월 원장 종단 검증 미완.
- `A2-DOC-016` [ ]: 원래 0/미관찰 null/형식 상충을 구분한 총계 보류, 법률상 비해당와 사용자 승인 구분 미완.
- `A2-DOC-018` [ ]: 등록 토큰 정적 확인만. 실제 DOCX 생성/행·셀·문단 재독 0건.
- 다음 회차는 **계산사무장** 순서. #200→#236 vs #212/#234→#235 병합 시 충돌/효과 및 Node 테스트 실제 실행, 채권자별 원장/총액·36/48/60개월·재산/청산가치 종단검증 우선. 최초 접수 Fact와 법률 승인 연결 과제 지속.

**실제 프로젝트 전체 Node 테스트, CI, staging D1·R2/Cron, 법원 공식 양식 대조, 실무자·변호사 승인, 운영 배포, 운영 DB 마이그레이션, 전자제출, 법원 인가는 모두 미실행/미인증.** 고객문서/개인정보/원본 OCR·키·비공개 정답을 공개 Git에 기록하지 않음.
