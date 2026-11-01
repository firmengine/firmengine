# FirmEngine AX — A1 49차 코드 완결성·상호 기능충돌 감사

- 2026-11-01 KST. 범위: **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만**. 다른 A2/A3/A4 코드·문서, 운영 시스템은 변경하지 않음.
- 직전 48차 **IT/A X/계산사무장** → 이번 **서류담당자(A1-DOC-017) / 변호사(A1-LAW-014) / 데이터담당자(A1-DATA-015)** 순환. 모두 중앙 보드 `[ ]` 유지.
- 시작 최신 main `0decfe07c5c004b0d1d0131689fe0075fbf56300`; 최근 A4/A3/A2/A1 커밋·열려 있는 PR, 중앙 보드, 제48차 영수증, 소스/스키마/기존 테스트/제33·37차 영수증을 열람. Draft PR #90(법원 UI), #100(법률 서식 미확정 계보), #32(UI 명령 영수증) 및 신규 #124 참조.
- 입력은 전부 **합성·비식별**. 공개 Git에 고객 정보, 실제 OCR 값·PDF, 비공개 정답, 키/.env 저장 금지. 법률 판단·금액·법원 인가 확정 미실행.

## A1-DOC-017 — 예상 보완요청과 실제 법원 보정명령 UI 분리 [ ]

**원본 main**: `components/case-workflow.tsx` blob `2ec797958726b99a4358ec46ef35f78f90bfd927`; `lib/approval-readiness.ts` blob `d3aecf05688d3146ecff94a3795bb3da8a215d35`. 현재 workflow의 보정 이벤트 선택문구는 **“보정 요청”**, 이벤트 목록은 `label(event.state)`를 사용. readiness는 `internal_candidate`와 `recorded_court_event` 분리하지만 기록 자체의 법원 원문 확인·실제 효력 검증은 별개.

**기존 수정 후보**: [Draft PR #90](https://github.com/firmengine/firmengine/pull/90), 표시 전용 `lib/procedure-event-display.ts` blob `e1f9bc1583b0ee503286374fd704ab5a54698263`, PR UI blob `3ae63b4e6ec41c66f9c7682a31aef4294a43a215`. 실제 표시 함수의 TS 타입 표기만 제거한 V8 격리 **3조건**(correction, amended, unknown) 기대 일치. PR UI 문자열·원문 검증주의·기존 명령 호출 보존 **6조건**, main에 경고 부재 **1조건** 정적 일치. 합계 **10/10**, 단 동일한 종류의 테스트로 합산해 제품 합격률로 해석 금지.
- **독립 기대**: 실제 원문·기한·접수증 미확인이면 오직 “담당자 기록”으로 표현. **관찰**: 현재 main UI 경고 없음; PR #90은 기록/법원 확정 구분 경고. 근거 문서의 실제 종류/진위/변호사 승인 미관찰. [Draft #32](https://github.com/firmengine/firmengine/pull/32)와 같은 UI 파일이므로 통합 검토 전 병합 금지.
- 전체 React/브라우저/직원 입력/API/D1/법원 원본 테스트 **미실행**, 신규 패치 없음. 이전 보드에 있는 법원 원문 종류 검증 P0 후보의 확정/해결로 오인하지 말 것.

## A1-LAW-014 — 법률 50규칙·46예외 후보와 원천 승인 [ ]

**main 실소스** `lib/preapproval-legal-coverage-audit.ts` blob `3e4dcf275a22b1bbe6b52cff09dae748f3c62175`; `lib/legal-catalog.json` blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`; `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`; `app/api/cases/[id]/approval-readiness/route.ts` blob `731f66a10d4af704b432dcd298061b452941fd13`.

실제 함수 본문에서 TS 타입 표기만 제거하여 V8 실행, 카탈로그 원문 JSON **50/46 전량 입력**, Fact 없는 사건(서울·신청일 2026-10-30)에서 **규칙 미증빙 49·후행 보류1 / 예외 사전후보44·후행보류2 / 미등록 ruleRef 0 / 자동 충족 0 / 근거 미충족 질문 227** 관찰. 이는 규칙·예외의 **법적 판단 성공 96건이 아니라 선언과 보류 결과 집계**다.

합성 `applicant.address` 관련 5조건:
| 합성 조건 | 독립 기대 `feature.status` | main 관찰 |
| --- | --- | --- |
| Fact 없음 | `canonical_route_or_evidence_missing` | 일치 |
| 추출·미승인 Fact, 승인 ID 미제공 | `source_unverified_or_unaccepted` | 일치 |
| `verified/accepted` Fact 및 정확한 승인 ID | `source_supported_needs_legal_application` | 일치(법적 적용 승인 아님) |
| `rejected` Fact인데 호출자가 승인 ID를 부정확하게 주입 | `source_unverified_or_unaccepted` | **불일치**: source_supported |
| `disputed` Fact인데 호출자가 승인 ID를 부정확하게 주입 | `source_unverified_or_unaccepted` | **불일치**: source_supported |

독립 helper의 승인 ID 집합과 Fact 상태가 **상충하는 호출**은 방어되지 않는다. **기존 제31차에서 이미 보고된 한계의 재확인**으로 신규 결함 집계 없음. 현재 API 호출자는 `currentFacts`의 `verified/accepted` 및 `factSourceLineageIssues=0`를 검사해 승인집합을 만들어 전달하는 것을 실제 코드에서 확인. 따라서 실제 엔드포인트가 거짓 법률 승인에 도달했다는 재현은 아님. 50/46 개별 규칙별 법원·시행일·증빙 진위/변호사 판단 **미검증**, 법적 승인 승격 금지.

## A1-DATA-015 — 서식 반복행 계보의 subjectId 미관찰 오연결, 신규 P2 후보 [ ]

**main 소스** `lib/lawgraph-document-field-projection.ts` blob `a017294aa814f4d33360c2531abf91d9eb79a6e0`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `lib/form-contracts.ts` blob `7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef`, `lib/template-token-catalog.json`에 실제 D5103 `month.net_income` 반복 토큰 확인. 기존 [Draft #100](https://github.com/firmengine/firmengine/pull/100) source blob `8a8a0e63004328e8c4ccb2b0c08ca1cab0b52727`를 직접 읽고 비교.

**원인**: 원본 `exact` 조건 `(!subjectId||!r.subjectId||r.subjectId===subjectId)`가 계산 피처의 `r.subjectId=null`을 모든 반복행의 subject에 일치시킴. `rowOrdinal=0`·값=“100”만 같은 두 경우에 `linked_calculation`이 거짓으로 형성됨. 스칼라 `rowOrdinal=null`도 `r.subjectId`가 다른 값이어도 허용. **계산금액을 바꾼 사고나 실제 타 사건의 데이터 오염이 아니라, 특정 누락 subjectId 입력에 대한 서식 토큰 계보의 오연결 방어 결함**.

독립 기대 대 현재 main/수정 branch/PR #100과 합성결합:
| 합성 입력과 대상 | 기대 | main | PR #124 | #100+#124 격리 결합 |
| --- | --- | --- | --- | --- |
| 반복행 동일 ordinal·subject | linked | linked | linked | linked |
| 반복행 source subject null, 표시행 subject=B | review | **linked** | review | review |
| 반복행 source subject=A, 표시행 subject=B | review | review | review | review |
| 반복행 ordinal 불일치 | review | review | review | review |
| 스칼라 ordinal=null, subject=null | linked | linked | linked | linked |
| 스칼라 ordinal=null, source subject=A | review | **linked** | review | review |

실제 GitHub 저장 소스 **TS 타입만 제거한 V8 원 함수 실행**: **main 4/6, 신규 PR #124 6/6, 기존 #100 소스와 신규 술어의 격리 합성 조합 6/6** 독립 기대 일치. 관계 라이브러리·FormContract·currentFacts와 D1은 합성 대체이므로 전체 제품 Node 실행·D1 저장·Word 출력 증명이 아니다.

**코드 조치**: [Draft PR #124](https://github.com/firmengine/firmengine/pull/124), base main `0decfe07c5c004b0d1d0131689fe0075fbf56300`, HEAD `c607406a68368cfe4774c88cb5336f44ac44d2d5`. `lib/lawgraph-document-field-projection.ts` 수정 blob `86efb1a328516cecbf17ad2824ea9594c86cc227`; 신규 `tests/lawgraph-document-field-subject-r49.test.ts` blob `170df7b81c3222fd82f2c39383fedaff9a337af0`. **Node 회귀 6블록 작성·커밋, 실제 Node/TypeScript/CI 미실행**. 서식 값·산식·원천 Fact·승인·법률판단 변경 없이 row/subject 계보 검사만 강화. **기존 #100과 같은 파일 수정이므로 병합 전 통합검증/실무 검토 필요**. 실제 D5103/D5110/D1/R2/docx/법원 서식/사람 승인 미인증.

## 결론·다음 회차

- 이번 A1 검증 **A1-DOC-017, A1-LAW-014, A1-DATA-015 모두 미완료 `[ ]`**. 신규 P2 계보 후보 **1건**, Draft PR **1건**, 기존 법률 helper 한계 및 법원 UI 표시는 **기존 문제 재검증**. 실제 소스의 V8 격리 검사·정적 연계만 통과; **전체 제품 인수 완료 0**.
- 다음 순환 **IT담당자 / AX담당자 / 계산사무장**: `A1-IT-016` (최신 HEAD Node/TypeScript/빌드/회귀 영수증), `A1-AX-013` (누락 근거→사람 질문→서류 요청의 API 연결), `A1-CALC-011` (월 변제가능액 및 비용 결손 시 최종 검토본 차단).
- 최신 main CI, 브라우저, staging D1/R2/Cron, 공식 서식/법원 원본/변호사 승인, 사이트 배포는 **미실행·미확인**. 운영 배포·운영 DB 마이그레이션·전자제출·법원 인가 확정 **미수행**. 실제 모델 추론 모드 Extra High 설정 여부 **미확인**.
