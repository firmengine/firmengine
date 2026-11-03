# FirmEngine A1 — 114차 코드 완결성·상호충돌 감사 (2026-11-04 06:51 KST)

## 관찰 범위와 증거 등급
- 저장소 `firmengine/firmengine`, 변경 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 감사 시작 GitHub main `0966420cb4bcb9721c6e12b0688dd927f0e91cdf`; 영수증 작성 전 head `0966420cb4bcb9721c6e12b0688dd927f0e91cdf`.
- 이전 113차(DOC/LAW/DATA) 다음 순환: **IT → AX → 계산사무장**. 단일 보드 미완료 `A1-IT-016`, `A1-AX-016`, `A1-CALC-016`을 선정. 관련 main 스키마 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, package/lock/tsconfig/runner, 원본 함수, 기존 56·60·82·113차 영수증 및 기존 PR #21/#53/#58 참조.
- 실행 환경: 로컬 Node `v22.16.0` 확인. `git ls-remote https://github.com/firmengine/firmengine.git HEAD` 실제 실행 → `Could not resolve host: github.com`. GitHub connector로 main 원본 파일을 직접 읽어 **해당 본문만 TypeScript 타입을 최소 제거하여 V8 합성 격리 실행**. 테스트 데이터·원화 금액은 모두 가상. 권한/D1/R2/서식 API·진짜 고객자료·원본 OCR·비밀키 사용 없음.
- 분리: 소스 존재/함수 합성 통과/실제 전체 Node·TS·lint·빌드/실제 GitHub CI/staging D1·R2/Cron/공식 Word/변호사 승인/배포는 각각 **별개의 관측 상태**. 아래 결과는 앞 두 단계만.

## A1-IT-016 [ ] — 최신 HEAD CI·빌드·타입·회귀 영수증
- `package.json` blob `8129160e33af3ae250c757a6a8195a29674ad031`: Node >=22.13, `build` / `lint` / `test:intake-pipeline` / `test:legal-auto` / `check:product` 선언 확인. `tsconfig.json` `f1c3de3fee3b976e8e4329809563892fc66b2d92`, `package-lock.json` `f70044374d26fdde379c9a2afea2feb5495474fb` 존재.
- `scripts/run-preapproval-regressions.mjs` blob `c4bbeca539457d55b42d4029a416d6586cb06f86` 실제 본문에는 `--full` 시 `tests/*.test.ts` + ESLint + build 호출 정의. `scripts/verify-source-tree.mjs` blob `56fa722365f3d8ca7f1a9a0373cce6f6aa35de82`는 merge-marker 스캔 구현. **구현 확인은 실행 통과가 아님**.
- GitHub Actions `GET /actions/runs?branch=main&per_page=5` → `total_count=0`, `workflow_runs=[]`. 지정 main SHA의 combined statuses → `statuses=[]`. 따라서 **main에 CI 통과 기록 없음**(실패 기록도 조회 범위에는 없음).
- GitHub 원본 전체 checkout 불가(DNS), `npm ci`, `tsc`, ESLint, source-tree 원본 전체 스캔, full Node test, bundle, staging **미실행**. A1-IT-016은 **미완료**. PR/코드 수정 없음.

## A1-AX-016 [ ] — 실제 TS 실행 경로와 참고 n8n 분리
- main `app/api/cases/[id]/process/route.ts` blob `e153bdb44ec7614de4cd9a9adfaf76e5e7fc4b64`의 **실제 POST 함수 본문**을 V8에서 최소 타입 제거·합성 서버 의존성(mock `getCase`, JSON, handlers, auth)으로 호출.
- 독립 기대 → 관찰, 모두 일치 **12/12**: `next→processNext`, `next_batch[j1,j2]→processNextBatch`, `legal→reviewLegal`, `reconcile→reconcileCase`, `retry→retryFailed`, `reverify_page→reverifyPage`, `refresh_page→retryPage` 200의 합성 매핑; 알 수 없는 action 400, 미지정 batch 400, legal에 jobIds 제공 400, 합성 reference-test 사건의 next 409·handler 미호출, 같은 사건 legal은 허용. **이 상태코드는 합성 응답**으로 실제 서버 HTTP 관찰이 아님.
- 참고 `n8n-reference/workflows/firmengine-p0.json` blob `37e7833bc3612638adb01b97e811a566e9b26e6b`: 실제 JSON 파싱 `active:false`, 노드 **9개**, localhost:8010 `/internal/stages/{classify,extract,prepare,validate,generate,complete}` 6개. `law-watch.json` blob `fd63f035483a55c49ebb6ec6198bd17277c3b2cf`: `active:false`, 노드 **2개**, 과거 `/internal/knowledge/check`. `NODE_MAP.md` blob `9573aba2351bf0f12d92a9169bd6700c96f55a93`도 참조본임을 명시.
- TS 엔드포인트 코드와 저장소 참고 JSON의 분리는 **확인**. 실제 배포 런타임 n8n 활성 상태, Cron 연결, 호출 이력, 운영 URL은 **미관찰**. `active:false`만으로 외부 n8n 게시 상태 확정 금지. A1-AX-016 **미완료**.

## A1-CALC-016 [ ] — 계산 결과·원화 서식 출력의 소스/합성 정합성
- main `lib/form-mapping.ts` blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`에서 **원본 `exactSourceCalendarMonth` 본문** V8 격리 합성 **8/8** 기대 일치: 정확한 2026-10 전체 달/2028-02 윤년은 허용, 부분 달/연간/월경계 교차/불가능 날짜/unknown basis/null 일자는 null. 이는 실제 원천 fact 진위 검증 아님.
- 같은 소스의 **원본 D5110 ③=①−②, ⑤=③−④, 회차×⑤ 스칼라 계산 분기** 격리 합성 **6/6**: 가상 월 3,000,000−생계 2,000,000−보수 100,000=⑤ **900,000원**, 36회 **32,400,000원**. 보수 0→1,000,000/36,000,000, 보수 null→[확인 필요], 월소득 null→[확인 필요], 0회→총액 [확인 필요], 음수 수지→명시적 음수 표시를 관찰. `moneyValue`/format `amount`는 **합성 스텁**. ⑤는 일반채권 계획 월변제액 `monthly_payment`와 **서로 다른 의미**로 표시하도록 원본 매핑·D5110 템플릿 치환을 확인. 법률상 인정은 미확정.
- main `lib/document-preflight.ts` blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`의 **원본 `evaluateDocumentPreflight` 본문**을 V8에서 타입만 제거하여 합성 최소 D5103 form contract와 mocked hash·legal-readiness로 실행: **8/12** 독립 기대 일치.
  - 정상 `1000`, `1,000`, 명시적 `0` → ready 기대/실제; 빈칸, 비숫자, 잘못된 월, 기간 없음, Infinity → blocked 기대/실제.
  - **기존 P1 재현 4건:** `1,00` / `1,,000` / `1 00` / `1원00`은 **blocked 기대 대비 main ready**. 숫자 파서가 쉼표·공백·'원'을 문자열 내부에서도 무차별 제거하기 때문. 승인전/미관찰/0/오류를 합치지 말 것.
  - 기존 미병합 [Draft PR #53](https://github.com/firmengine/firmengine/pull/53) 원본 numeric(blob `fb60cc2b737d4244867933f8b41211aa78d377af`)과 [Draft #58](https://github.com/firmengine/firmengine/pull/58) 원본 numeric(blob `560935bbbc61f1c253b26a05ecd866840efd6da0`)을 **각 9/9** 별도 V8 검증: 정상 정수/정상 세 자리 쉼표/0/외곽 원화표시 허용, 4개 기형 문자열 거절. 다만 PR 전체 preflight·코드 병합·법원 서식 통합은 미검증. 동일 파일 중복 PR이므로 통합 전 충돌 검토 필요.
- 총 main **22/26** (calendar 8/8 + D5110 6/6 + D5103 8/12), 별도 Draft numeric **18/18**(각각 9) 기대 일치. **공식 DOCX 렌더, DB persisted calculate→token→Word 왕복, 서식 적용 적법성, 실무자 승인 0건**. A1-CALC-016 **미완료**.

## 코드조치·다음 인수
- 코드 수정 **0**: D5103 숫자 파서 결함은 기존 PR #53/#58에 이미 중복 수정안이 있고 승인·공식 표기 규칙 문제이므로 무검증 main 직접 수정 금지. 신규 Draft/병합/운영 쓰기 없음.
- 3 ID 모두 `[ ]` 상태. 이번 독립 V8 합성 검증 main **34/38** (AX 12/12 + CALC 22/26); PR 후보 numeric 비교 18/18 별도. 제품 전체 비율/품질 점수 아님.
- 다음 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**, 보드 최신 ID 확인 후 `A1-DOC-017`, `A1-LAW-018`, `A1-DATA-016` 우선. 재현 가능한 작은 검증만 합격 표시.
- 종단 인수 **0건**. Node 통합/TypeScript/lint/build/CI·브라우저·staging D1/R2/Cron·85종 문서·18계산·95법률·공식 서식·법원 보정·변호사 승인·배포 **미인증**. Extra High 실제 설정 미확인. 운영 배포/D1 운영 마이그레이션/실제 전자제출/인가 확정 **수행 안 함**.
