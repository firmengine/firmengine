# FirmEngine A1 70차 — 동시 사건 CAS / OCR 근거·정수 형식 / 사업소득 복수 월·복수 사업자

- 실행 시작: 2026-11-02 09:49 KST, GitHub `firmengine/firmengine` **main**. 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 한정.
- 시작 main HEAD: `fb95cc96747ad1c7f5bb7b2d05fbea384d45b606`. 영수증 쓰기 직전 HEAD: `fb95cc96747ad1c7f5bb7b2d05fbea384d45b606`. 중앙 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 최초 blob `941bc7113761f4a89b770eb86ffedf24beb9ee85`. 69차 인계 영수증 blob `1c68adef1c24eff731c525da3a61f82d9591fa04`; 2차 CAS 영수증 blob `1e74c6aea659fe1927e477a5f903e1e93c56a954`.
- 최근 커밋: A4 r69 `fb95cc9` / `9d27117`, A3 r69 `4d7a08d` / `2a2da52` 등. 관련 기존 Draft PR: [#60](https://github.com/firmengine/firmengine/pull/60) OCR 원천정수·금액 형식, [#92](https://github.com/firmengine/firmengine/pull/92) 사업소득 관측기간, [#158](https://github.com/firmengine/firmengine/pull/158) OCR 인용·값의 중간 검증, 기존 #17 CAS/자동초안은 별도 경로. 중복 변경 금지.
- 역할 순환: **IT담당자 → AX담당자 → 계산사무장**. ID: **A1-IT-010 / A1-AX-005 / A1-CALC-003**; 세 ID 전부 **[ ] 미완료** 유지. 실제 입력은 비실명·가상 숫자/날짜이며 실제 법원 판단·고객 데이터 아님.
- 관련 스키마·코드·기존 테스트: `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `tests/case-command-storage.test.ts` `aa7265288e2ab2ba9d7ca3fab1493cd52408a04e`; `lib/ocr-calculation-input.ts` `8f7f51bf41f7c944b76419d7cc894e49ac771473`, `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/source-verification-identity.ts` `acdecd4e18970fe4faf6eb91dd4aefc97b83236b`; `lib/business-monthly-workbench.ts` `0174f228473516e94664be445d8f46a33f833f80`, `tests/business-monthly-workbench.test.ts` `f06c4b4dfd6694da07a9ac28dc558c6520ee2906`.

## A1-IT-010 — 두 작성자 동일 사건의 optimistic CAS
- 원본 `saveCase`의 기초 SQL: `UPDATE cases SET payload=?, revision=?, name=?, updated_at=?, storage_token=?, mutation_category=? WHERE id=? AND revision=? AND storage_token=?`. 추가 mutation 영수증은 `INSERT ... SELECT ... WHERE EXISTS (SELECT 1 FROM cases WHERE id=? AND revision=? AND storage_token=?)`인 코드 경로를 읽음.
- **실제 실행:** Python `sqlite3`의 파일 기반 **WAL**, 연결 2개에 같은 합성 사건 A(revision 1/tokenA)·독립 사건 B(revision 1/tokenB) 구성. 저장시점에 원본 SQL의 핵심 WHERE/UPDATE 및 영수증 EXISTS 조건을 사용한 **독립 SQL 투영 테스트 14개 관찰 / 14개 기대 일치**. 로컬 실행: `python /mnt/data/a1_r70_cas_sqlite.py` (회차 런타임 내 파일, 공개 Git 저장하지 않음).
- 검증 조건과 기대→관찰: 첫 브라우저 A 수정 1→1, 이미 읽은 revision/token을 쓰는 둘째 0→0, A 최신 revision/token/payload `(2,A2,a2)` 보존; 리뷰-only에서 같은 revision 유지·token A3로 회전한 첫 기록 1→1, 늦은 리뷰 0→0; B의 독립 저장 1→1; 틀린 사건 ID 0→0; 틀린 token 0→0; source 수정 1→1; 유효 명령 영수증 1→1; 구 token 패자 영수증 0→0, 영수증 총 1→1; source 이후 지연 리뷰 0→0; A 최신 상태 보존 (3,A6,source_edit)→일치. 시나리오 14개 각각 예상값과 실제 SQLite 반환을 비교함.
- **한계:** 실제 `saveCase` 전체 함수·D1 batch/트리거·R2 스냅샷·브라우저/HTTP/역할 revoke를 호출한 것이 아님. SQL predicate와 원장 INSERT만 별도 실행. 기존 제품 테스트의 존재도 이번 실행과 구분. 운영 인수 불가.

## A1-AX-005 — 원문에 없는 수치·날짜·결론과 source-only 형식 게이트
- `calculationSourceCellIssues` 원본 및 원본 `normalizeMoney`에서 **TS 타입선언만 걷고 원본문 V8 격리 실행**. 독립 기대 17개: integer `1,00`, `1,,000`, `12,34,567`, `1,000`(현재 typed projector는 grouping 미지원), 음·양 부호, 안전정수 초과는 형식검토; 정상 정수 `12`, 명시적 `0`, 최댓값은 형식허용; 금액 `1,00,0000`은 grouping 오류, `1,000,000` 정상, 날짜 `2026-02-30` 오류, 미관찰은 자동 0으로 승격 금지. **main 9/17 기대 일치**: 잘못된 정수 그룹/범위와 금액 그룹에서 8개 거짓-clear 재현. 관련 선행 A2 15차가 **같은 결함을 이미 PR #60으로 수정 중**이므로 신규 P2로 중복 계상하거나 동일 파일 새 패치를 생성하지 않음.
- 기존 Draft **PR #60 HEAD `95b80a273f076a65909dafd36889ffcbe3f1ae20`, 원본 수정 blob `62329db8a6910bffe52f5f855f23b34fd56e4c4b`**, 실제 함수 V8 재검증 **17/17 기대 일치**. PR 미병합, 프로젝트 Node/CI 미실행.
- quote/의미 검사 독립: `sourceQuotesOverlap` 원본문 V8 7/7 기대 일치(동일·다른 소득 항목·다른 금액·숫자 부분인용·빈 인용·날짜 불일치·NFKC). 그러나 `calculationSourceCellIssues`는 **형식 전용**이므로 `value=2000000`인데 `quote=기본급 3000000원`이어도 이 단일 게이트는 `[]`, 날짜 의미 충돌도 `[]`(설계상 형식 문제 아님). 별도의 독립검증 및 원문 geometry/법률승인 경로가 존재하므로 **최종 허위 Fact/법원 결론 통과를 입증한 것은 아님**. 문서 없는 법원 결론 생성 차단 종단 검증은 여전히 미실행·미완료.

## A1-CALC-003 — 월별 복수행과 두 사업자 분리
- 실제 `assembleBusinessMonthEvidence`의 원본문에서 TypeScript 타입만 제거한 V8 격리 실행, 동일한 합성 입력으로 main과 기존 **Draft #92 HEAD `02b166f35ce0b735d6e1062111778e3b6d7c031a` / 수정 blob `000992db45124f2a0a43791c249638d705bbed71`** 비교. 2026-01~02 및 2025 이력, 매출 300만원·비용 100만원=동일 sourceRecord 산술 미리보기 200만원 등, **10조건** 각각 독립 기대/관찰 확인.
- main **7/10**, #92 후보 **10/10 기대 일치**. 실패한 세 가지 반례: 같은 달 `periodOverlap=unknown`인 매출, `partly_outside`인 비용, 양쪽 `unknown`임에도 main에서 각각 **200만원 산술 미리보기** 생성(기대 null). #92는 세 경우 모두 null. `inside` 한 달 정상 200만원(법률승인 아님), 동일 source 두 월 200/400만원 구분, 한 월 누락, 같은 월 다른 사업자 매출 총액 둘, 원장비용 중복, 날짜가 월 경계와 안 맞는 행, 기간 밖 이력은 모두 기대일치.
- 합성 출력의 `legalNetApproved`는 전 조건 **false**, identity crosswalk 상태는 검토 필요. **동일 법률상 사업자 확인이나 승인된 순소득·가구 소득이 아님**. #92는 Draft·미병합.
- **검증 정정:** 처음 V8 타입 제거기에서 `row.amountWon!` 제거 표현이 `row.amountWon!==null`까지 잘못 고쳐 가짜 null 미리보기를 만들었고 그 데이터는 **즉시 폐기**. TypeScript non-null assertion `BigInt(row.amountWon!)`만 제거하도록 수정한 뒤 원본문 `row.amountWon!==null` 보존을 검증하고 **10조건 전체 재실행한 최종 결과만** 위의 7/10·10/10 집계에 사용했다.

## 코드 조치 / 통합 리스크 / 다음
- 이번 회차 신규 확정 결함 **0건**(기존 P1/P2 재현), 신규 PR **0개**, 제품 코드 변경 **0건**. 기존 #60/#92 재검증, 중복 패치·타 에이전트 덮어쓰기 없음. 중앙 보드에서는 **A1-IT-010 / A1-AX-005 / A1-CALC-003만** 진행 근거를 추가하고 `[ ]` 유지.
- 수치의 미관찰/null/0/비해당/상충/source-only/승인전은 구분. 새 원문 OCR/실제 고객 데이터/.env/키/비공개 정답 없음.
- 전체 Node, TypeScript, CI, 사이트 빌드·staging D1/R2/Cron, 실제 2브라우저 CAS/서류 85종/갈음 A←B+C/C01-C02-C04/18계산·95법률·법원 보정 종단·공식 서식·변호사 승인·배포 모두 **미실행**. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 없음. Extra High 실설정 여부 미확인.
- 다음 역할: **서류담당자·변호사·데이터담당자**, 우선 체크 **A1-DOC-012 / A1-LAW-013 / A1-DATA-012**.
