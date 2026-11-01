# FirmEngine A1 69차 — 갈음 A←B+C / 서울 424호 관할·시행 / Fact 정정·철회

- 회차: 2026-11-02 08:47 KST 시작 기준. 대상: GitHub `firmengine/firmengine` **main**, 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 한정.
- 감사 시작/수정 직전 main HEAD: `7a2fea277221e3ded9540e2237c97736aff0bbc7`. 직전 main 커밋 A3 r68 `7a2fea2`, `d42d151`; A2 r68 `92aba53`, `d7058ae`; A1 r68 보드 `e14f05e`. 동시 에이전트 작업 가능.
- 읽은 단일 인수 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 원본 blob `6772e097386c478e9e4b7ea82f7fae6bdff27ac6`; 이전 A1 68차 영수증 blob `c3ed4b7db62315d42a2ffc3c605eb42b9195577e`. 기존 테스트 `tests/document-substitution.test.ts` blob `0bb1478bac062f3daa844f10374440af6cbdceb2`, `tests/domain.test.ts` blob `2a029bf0b6d37fc3e582a79003a8b3db311877fd`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 기존 변경 PR은 #57(A1 DOC 갈음 증빙역할, Draft), #94(A1 LAW 관할미확인, Draft), #12(A1 DATA review-only append-only, Draft) 확인. 다른 작업의 PR·코드는 덮어쓰지 않음.
- 이번 회차 역할: **사용자·서류담당자 → 변호사 → 데이터담당자**. A1-DOC-011, A1-LAW-012, A1-DATA-011 모두 **[ ] 미완료** 유지.

## 실제 검증 방식과 범위
GitHub에서 main과 기존 PR 브랜치의 **실제 TypeScript 함수 본문**을 각각 읽은 후 타입 주석만 제거한 JavaScript를 같은 V8 실행 환경에서 평가. 결과표의 수치는 **실제 실행한 합성 함수 조건**에 한정. DOC의 `activeSubstitutionPolicy/matchPublishedSubstitutionRoute` 및 `substitutionFactFingerprint`는 통제된 합성 허용정책/지문 stub; LAW는 main `reference-parameters.json`에 기록된 계수와 같은 값(관할 seoul, 시행 2026-10-01, 총채무 50,000,000원, 2년 급여/1년 신규채무)을 합성 reference stub으로 주입; DATA는 crypto UUID/structuredClone/원문 참조 판단을 합성 stub으로 대체(금액 정규화 경로 미호출). **원격 D1·R2, HTTP API, 브라우저, 실제 법원 PDF, Node 전체 테스트, TypeScript/CI는 실행하지 않음.** 최초 DOC 합성 fixture의 대문자 문서유형은 `idRoute`의 lowercase 계약을 위반하여 전체 restored가 나오는 잘못된 시험이었으므로 최종 집계에서 제외하고 lowercase ID로 정정 후 재실행.

## A1-DOC-011: 갈음서류 A←B+C, 실제 조정 함수 10개 합성 조건
- 원본: `lib/document-substitution.ts` main blob `9fea9344b923c961fe333761df99ddde431ce1bc`; #57 동일 파일 후보 blob `69e28b8462a58f9b65cef20d744605d4c78619cd`.
- 합성: 원서류 A, 대체유형 b/c, 기간 2026-04-01~09-30, **b 문서 Fact 2개가 필수 2개 슬롯을 모두 제공**하고 승인 match b·c가 존재. 기대: 두 유형 모두 **evidence-role** 페이지일 때만 원요청 비활성화, 둘 중 c가 administrative/filed_form인 경우 원요청 **복원**. 합성 기준 허용/증거지문 사용.
- **main 8/10 기대 일치, #57 후보 10/10.** 두 실패:
  - c 페이지 `administrative`: 기대 `activeRequest=true`, main 실제 `false` + `reasonCodes=[]`; #57 실제 `true` + `SELECTED_ALTERNATIVE_NOT_MATCHED`.
  - c 페이지 `filed_form`: 기대 `true`, main 실제 `false` + `reasonCodes=[]`; #57 실제 `true` + 해당 reason.
- 나머지 8조건: 양쪽 evidence 정상 비활성화, c match proposed·c 문서 철회·b Fact 미검증·c 잘못된 유형·b 문서 철회·b/c 기간 조합(b 기간 일부 공백을 c가 보완)·기본 슬롯 매핑 미검토에서 모두 기대일치. 조건은 각각 실제 `reconcileDocumentSubstitution` 호출.
- 결론: 기존 P1 재현이며 **새 중복 패치 없음**. #57은 Draft/미병합. 공식 허용정책/85개 서류/실 DB와 실무 확인은 미검증.

## A1-LAW-012: 서울 424호, 실제 후보 함수 11개 합성 조건
- 원본: `lib/seoul424-candidate.ts` main blob `fb4f7f09e37e957481996304fbe4916764c8d7da`; #94 후보 blob `f25c71d3b01f105944098b798d60517e41086c76`. 참조 정의 `lib/reference-parameters.ts` blob `a1bcd220362b850833b38dc815f5255f4be4ca42`, seed `lib/reference-parameters.json` blob `e57a9d7c99efe052d4581d780ed478d876eb3330`. 위 seed의 해당 항목은 `verification=inherited`로서 공식 검증 완료가 아님.
- **main 8/11 기대 일치, #94 후보 11/11.** 관할 `null`: 기대 `status=unknown, route=null`, main은 `candidate_for_human_review/category_7`. 관할 공란 `""` 및 공백 `" "`: 기대 `unknown`·court_scope `unknown`, main은 `not_applicable`·scope `no`. #94는 세 조건 모두 unknown, 후보 승격 없음.
- 정상 서울·시행일 정확히 2026-10-01은 `candidate_for_human_review`이며 **법원 인가가 아님**. 타 관할은 not_applicable, 2026-09-30 접수는 unsupported_version, 비정상 2026-02-30/접수일 null은 unknown, 법률특정 1~6호 yes는 별도 후보경로, 채무요건 no는 후보 제외, 급여증거 null은 unknown — 나머지 8조건 기대일치.
- 기존 P2 재현. #94 미병합·법원 공식 424호 PDF 원문/적용일·경과규정·실무자 승인 **독립 검증하지 않음**. 합성에서 참조값을 사용했다는 사실은 법률 승인/원문 확인이 아님.

## A1-DATA-011: Fact 버전·정정·철회
- 원본: `lib/domain.ts` main blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`. 실제 `currentFacts`, `reviewFact`, `touchCase`, `retractDocument` 함수 본문을 타입주석만 제거해 실행. 초기 Fact v1 미검증/미승인, 참조문서 parent-child, 합성 사건 revision=1, exportManifest current에서 시작.
- **15/15개 독립 기대 일치**: v2 verified 생성, v1 보존, export 및 직원/변호사 리뷰 무효화, v3 인정은 verified 후만, 같은 값 재검토 시 객체 참조가 v3로 갱신, 과거 v1 리뷰 거부, 값정정 v4는 `reported/unreviewed`, 이전 승인 Fact 참조 자동 재사용하지 않음, v1~v4 append-only, v5 retract 후 `currentFacts=[]`이지만 원장 v1~v5 유지, 부모 문서 철회 시 하위 문서도 deleted 및 관련 Fact retracted(원장이력 2행 보존), 다른 합성 사건 revision 불변.
- 이 15조건은 **도메인 함수의 격리 실험**. 실제 명령 저장 영수증, D1 atomic batch, R2 snapshot, 동시 사건 optimistic CAS, 외부 DB 이벤트 append-only 불변성까지 입증한 것은 아님. 관련 #12는 review-only 워크플로 이력 변조 방어 **별도 문제**로 Draft/미병합이며 이 회차 코드 변경 없음.

## 인수 결론 / 미검증 / 다음
- A1-DOC-011(기존 P1), A1-LAW-012(기존 P2), A1-DATA-011(합성 범위 기대일치) 모두 `[ ]` 유지. **신규 확정 결함 0건, 신규 PR 0건, 제품 실행 코드 변경 0건**. 기존 Draft #57/#94/#12를 임의 병합하거나 재작성하지 않음.
- CI·전체 Node·TypeScript·빌드·staging D1/R2/Cron·브라우저·실제 OCR·85문서 갈음 정책·18계산/95법률 종단·공식 법원서식·직원/변호사 승인 **미관찰**. 고객 자료·원문 OCR 추출값·비공개 정답·키/.env 사용/적재 없음. 운영 배포·DB 운영 마이그레이션·전자제출·법원 확정 행위 없음. 실행기 Extra High 실제 설정은 확인되지 않음.
- 다음 순환: **IT/AX/계산사무장**으로 전환하며 아직 미완료인 **A1-IT-010 / A1-AX-005 / A1-CALC-003**를 중앙 보드 원문에서 선확인해 수행. 서류/변호사/데이터 축의 순차 후속 ID는 **A1-DOC-012 / A1-LAW-013 / A1-DATA-012**.
