# FirmEngine A1 — 105차 코드 완결성·상호 기능충돌 감사 (2026-11-03 21:55 KST)

- **허용 범위:** `firmengine/firmengine` main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 이전 A1 104차 영수증에서 순환 인수한 역할: **사용자·서류담당자 → 변호사 → 데이터담당자**.
- **조회한 main HEAD:** 최초 `f027cbb2dd4a47db36b3b003bc6d39a24013ffd8`, 영수증 쓰기 직전 `f027cbb2dd4a47db36b3b003bc6d39a24013ffd8`. 단일 중앙 보드 blob `f06edca7e50891964eecb3e95bf16dec1e91c513`; 직전 A1 104차 영수증 blob `ac6a258406684cee60b7b94edfcb4e438c22dcd3` 확인. 최근 main A3 105차/A2 105차/A1 104차 커밋·현재 Draft PR #57/#94/#12(및 최신 PR) 조회.
- **참고한 실제 스키마/테스트:** `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; `tests/document-substitution.test.ts` blob `0bb1478bac062f3daa844f10374440af6cbdceb2`; `tests/domain.test.ts` blob `2a029bf0b6d37fc3e582a79003a8b3db311877fd`; `tests/legal-proposals.test.ts`, `tests/reference-parameters.test.ts` 경로 검색 확인. 이전 A1 69차 동일 ID 검증 영수증 blob `1c68adef1c24eff731c525da3a61f82d9591fa04`.
- **방법:** GitHub에서 `main` 및 Draft PR HEAD의 실제 TypeScript 함수 본문을 읽고 **타입 선언만 제거하여 V8 `new Function`에서 호출**. `activeSubstitutionPolicy/matchPublishedSubstitutionRoute`, `substitutionFactFingerprint`는 동일 고정 합성 stub(게시 법원 허용/실제 SHA의 증명이 아님). 서울 424 reference-parameter 조회는 확인한 `reference-parameters.json` seed 값(서울, 2026-10-01, 5천만원, 2년, 1년)만 합성 대체. Fact 함수의 `structuredClone/crypto.randomUUID/validSourceRef`는 테스트용 합성 의존성(원본 조회 결과가 아닌 스텁). **실제 함수 로직을 실행한 격리 합성 검증**이지만 Node 테스트 실행·실 DB/HTTP/브라우저·법률 검토가 아님.
- **이번 수치:** main DOC **11/14**, LAW **11/14**, DATA **24/24** = 서로 다른 조건·단계의 합성 assertion **46/52** 기대 일치. Draft #57 **14/14**, Draft #94 **14/14**. 이는 선정한 반례들에 대한 합성 결과이며 제품 정확도·전체 합격률이 아님. 세 ID 모두 인수 **[ ] 미완료**.

## A1-DOC-011 [ ] — A←B+C 갈음에서 비증빙 C의 오인

- **실제 main:** `lib/document-substitution.ts` blob `9fea9344b923c961fe333761df99ddde431ce1bc`. 기존 미병합 [Draft PR #57](https://github.com/firmengine/firmengine/pull/57) HEAD `6c2a6a354f7c050967657084f06bd386d603fab3`, 수정 소스 blob `69e28b8462a58f9b65cef20d744605d4c78619cd`.
- **합성 기본 입력:** A 필수서류, B/C 두 대체유형 모두 선택, 2026-04-01~2026-09-30, 승인 문서-match B/C, B의 **두 개** 유효 Fact가 두 필수 proof slot 모두를 채움, active 문서 SHA·확인 subject·원천지문/인적검토 충족, 기본 B/C 페이지 `evidence`. 독립 기대: B/C 모두 **증빙 페이지**로 승인된 경우에만 A 비활성; C가 행정·기존 제출서식·미확정 역할이면 A 재요청.
- **실제 결과 (14개):**
  
  | 합성 변형 | 독립 기대 A 요청 활성 | main 관찰 | Draft #57 관찰 |
  | --- | --- | --- | --- |
  | B/C 둘 다 evidence | false | false | false |
  | C administrative | **true** | **false** | true |
  | C filed_form | **true** | **false** | true |
  | C unknown role | **true** | **false** | true |
  | C deleted / C stale match / C pageIds 빈 배열 | true | true / true / true | true / true / true |
  | B 미검증 / B 원천 주체 불일치 / B 인식 rejected | true | true / true / true | true / true / true |
  | 정책 변경 / 법원 변경 / C 문서유형 불일치 / 증빙 기간 공백 | true | true / true / true / true | true / true / true / true |

- **기존 P1 재현+추가 unknown-role 반례**: main은 C 승인 match만 있으면 C가 non-evidence 역할인데도 `SELECTED_ALTERNATIVE_NOT_MATCHED`을 만들지 않고 A 요청을 거짓 비활성화. #57에서는 복원 reason `SELECTED_ALTERNATIVE_NOT_MATCHED`. 허용 정책/지문은 합성 스텁이며 직원 편집기준정보·85서류별 갈음 실제 정책·D1/UI 통합검증은 없음. **중복 패치 없음**.

## A1-LAW-012 [ ] — 서울 424 후보의 관할 불확실성

- **실제 main:** `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da`. 기존 미병합 [Draft PR #94](https://github.com/firmengine/firmengine/pull/94) HEAD `264dd618a25fa5bc31bd65d86f1753016155d0cd`, 수정 blob `f25c71d3b01f105944098b798d60517e41086c76`. 서울 준칙 기준 seed `lib/reference-parameters.json` blob `e57a9d7c99efe052d4581d780ed478d876eb3330`의 `verification=inherited` (공식 승인 아님).
- **독립 기대:** 관할 `null/""/"  "`은 `unknown` + route `null`; 서울·신규 시행일·모든 제7호 조건 인정은 **candidate_for_human_review**(법원 인가 절대 아님); 타 관할은 `not_applicable`, 시행 전은 `unsupported_version`, 형식 오류 날짜·미승인 증거는 `unknown`.
- **실제 실행 14개:** 정상 경계일 2026-10-01 후보, 관할 `null` (main **candidate_for_human_review/category_7**, Draft **unknown/null**), 빈 관할 `""` (main **not_applicable/no**, Draft **unknown/unknown**), 공백 관할 `"  "` (main **not_applicable/no**, Draft **unknown/unknown**). 나머지 타 관할, 2026-09-30, 2026-02-30, 접수일 null, 제1~6호 개별 후보, 급여 미관찰/법적 인정 전, 부채 문턱 판본 불일치, 신규채무 기간 불일치, 급여 조건 불충족은 main/Draft 모두 기대 일치. **main 11/14, Draft 14/14**, `courtApprovalInferred=false` 14조건 전부 유지.
- **기존 관할 P2 후보 재현**. `legal-proposals.ts` 호출 경로는 코드검색에서 확인했지만 이 회차 전체 호출은 실행하지 않음. **실제 원문 PDF의 규정·2026-10-01 적용일 및 경과규정, 최초 접수일의 독립 원천 증빙·변호사 법률 인정은 미검증**. Draft #94 임의 병합/정책 수정 없음.

## A1-DATA-011 [ ] — Fact 판본·정정·철회

- **실제 main:** `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`의 `currentFacts`, `invalidateExports`, `touchCase`, `reviewFact`, `retractDocument` 함수 본문. `validSourceRef`는 합성 active 문서·page role·source hash·인용문 존재 검사 스텁(실제 원문 비교가 아님). 기존 [Draft PR #12](https://github.com/firmengine/firmengine/pull/12)은 review-only 저장 이력 변조 방어 별도 영역; 미병합.
- **합성 사건:** `case-a` revision1, parent/child/unrelated 문서, child의 f1=100 보고·미승인, unrelated의 f2=명시 0 verified/accepted, current export 검수 영수증. f1 원문확인→별도 명시적 인정→값 200 정정→parent 철회, 타 사건·무관 문서는 보존.
- **실제 24/24 assertion 기대 일치**: 최초 current 2개; f1 verified v2 append와 v1 불변; current v2; 현행 export invalidated 및 직원/변호사 review null; 같은 값의 Fact ID를 typed income/household가 새 ID로 remap; 미검증 accepted 거절; 검토 후 accepted; 이전 ID 수정 거절; 200으로 값 정정 시 최신 Fact reported/unreviewed·rawValue 200·과거 accepted 원장 유지·구 ID typed 연결 자동 승격 방지; v1~v4 보존; parent/child deleted; unrelated active; 최신 f1 철회 후 current 숨김, f2 보존, f1 전체 append-only 버전 5행 보존; 초기 사건 revision 불변; 중복 철회 거절; inventory unknown 초기화.
- **남은 영역:** 실제 DB에서 append-only 영수증/트랜잭션/동시 사건 CAS, OCR 저장 후 관측행 재판독·85서류/693 필드 소비, typed·18계산·95법률·법원 보정·R2/UI는 미검증. 원문 지문·실제 신원 매칭도 스텁이며 법률 승인 처리 금지.

## 코드·Git 조치 및 다음 회차

- 기존 두 결함에 이미 별도 Draft PR #57/#94가 있으므로 신규 코드 수정/PR 생성·자동 병합 **0건**. 제품 소스 SHA 변화 없음. 단일 보드의 **A1-DOC-011 / A1-LAW-012 / A1-DATA-011만** 근거를 append하고 `[ ]` 유지. 다른 에이전트의 파일/ID 무수정.
- **다음 순환 역할:** IT담당자 → AX담당자 → 계산사무장. **다음 ID:** `A1-IT-011` (보드 실존·기재 내용 선확인), `A1-AX-011` (보드 선확인), `A1-CALC-011` (보드 선확인). 이후 DOC/Law/Data `A1-DOC-012`/`A1-LAW-013`/`A1-DATA-012`.
- **인수경계:** Node 프로젝트 테스트·TypeScript·전체 CI·실제 브라우저/API·staging D1/R2/Cron·85서류·18계산·95법률·자동초안/문안검수·C01/C02/C04·실제 법원 보정·공식 서식 및 변호사 승인은 이번에 실행하지 않음. **제품 종단 인수 완료 0건**. 고객 파일/원본 OCR·신원정보·비공개 정답·키/.env 게시/사용 없음. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 없음. **Extra High 추론 모드 실제 설정 여부 확인 불가**.
