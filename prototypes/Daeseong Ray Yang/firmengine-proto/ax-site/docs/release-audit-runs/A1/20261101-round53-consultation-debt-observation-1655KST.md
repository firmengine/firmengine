# FirmEngine A1 53차 — 상담 재분석, 채무 담보 분류 상충, OCR 원문 상태

- 감사 기준: **2026-11-01 약 16:55 KST**, 최초 관찰한 GitHub `main` HEAD `b457e03ffa8dd93ceadefd774df430c6e0f7e90b`, 영수증 작성 직전 `main` HEAD `b457e03ffa8dd93ceadefd774df430c6e0f7e90b`. 이전 A1 52차 IT/AX/CALC → 이번 **서류담당자/변호사/데이터담당자**로 역할 순환.
- 단일 인수 보드 항목: **A1-DOC-003, A1-LAW-004, A1-DATA-003**. 모두 부분 검증 **[ ] 유지**. 정확한 허용 변경 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 전체 GitHub main의 최근 커밋/열린 PR·전 회차 52차 영수증, DB migration 0009/0013/0019, 함수와 연계 테스트 소스를 확인한 뒤 수행. 개인정보·고객 PDF·비공개 OCR/정답·키 사용 없음.

## A1-DOC-003 [ ] — 추가 상담 뒤 요구서류 재평가

- **원본 SHA:** `lib/intake-store.ts` `c0bdea9443a018a46c080a8e39a74a0daf62759f`; `lib/case-document-requirement-store.ts` `a670cb4e6a38aa6e782e898b5ed30aad80619c6d`; `lib/intake-engine.ts` `82ddba689ea6d107ba587235205feef45e058527`. DB `drizzle/0009_case_document_requirements.sql` `050c53dd1d9bf1a49c0d8afc8d2821530b4cd078`; `drizzle/0019_consultation_revision_watch.sql` `356fd6787560be34e38652191da1a8a07d7301d7`. UI `components/consultation-checklist.tsx` `7748c02bf64c5162efe213939ce24cd20a74a923`; POST 상담 API `94d930eeb8c768626c05f3aa9b32654eb004cd2a`; GET 요구서류 API `64eb0d2c6a12dfdf7f6f2889eaecdfc1fb417b2e`.
- **상태 연결 확인:** `appendConsultation`은 상담 revision CAS 후 `consultation_heads.active_run_id=NULL`로 기존 현재 분석을 해제. `analyzeConsultation`은 현재 note + catalog + case fingerprint를 새로 검증하고 run 완료·active head 교체·해당 run의 immutable 요구서류 및 field-plan을 D1 batch로 시도. `listCaseDocumentRequirements`는 **현재 active run만** join, 구 run은 자료로 보존하되 현재 요청으로 반환하지 않는다. 미분석 상태는 `pendingReanalysis` 플래그를 구분. UI는 stale 결과를 과거안내로 표시하며 복사를 금지. 현재 화면/서버/SQL 구조의 **정적 연결 확인**이지 실제 브라우저 E2E는 아님.
- **실행 #1:** `activeConsultationNotes` 실제 함수 본문 타입만 제거 후 V8에서 합성 [첫 메모 A], [A+B 추가], [A를 B가 supersede] → active ID 각각 [A], [A,B], [B] **3/3** 독립 기대 일치.
- **실행 #2:** 코드에서 읽은 `listCaseDocumentRequirements` 조회 SQL의 join/active run 필터를 **Node 22.16 `node:sqlite` in-memory, 최소 호환 테이블**에 합성으로 재현. (i) head null=요청0 (ii) run A 활성=과거 요청 A만 (iii) 상담 추가 head null=현재 요청0 (iv) 과거 complete 존재=재분석 대기 판정 (v) run B 활성=새 요청 B만 (vi) 다른 사건의 요청은 혼입되지 않음 (vii) 타사건 run ID가 head에 들어가도 요청0: **7/7**. 실제 migration 전체 적용/Cloudflare D1 실행이 아닌 **SQL 격리 재현**.
- **미검증:** 모델 상담 2차 분류 정확성, 요구서류 85종/관할별 총량, 동시 상담 API/D1 batch 실제 경합, 브라우저 클릭·사람 승인. 별도 신규 확정 결함 없음.

## A1-LAW-004 [ ] — 담보·일반·우선·별제권·분쟁 채권 분기

- **main 원본 SHA:** `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`. `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`에는 법률 class(`ordinary|secured|tax|estate|non_dischargeable|disputed|unknown`)와 담보 여부(`yes|no|unknown`)가 서로 다른 필드로 선언되어 있다.
- **새 P1 후보 재현:** main `calculateCase`의 **채무한도 분류 부분 실제 함수 body**를 TS 타입만 제거해 V8 실행. 합성 단일 채무 원금 100원 + 이자 20원 = 출처 관찰 120원, inventoryComplete.debt=yes, 동일 신청/평가일, priority=ordinary, 보증 없음, 법률 인정=accepted. `classification=secured,secured=no`인데 **main 관찰 담보 0/무담보 120**, `classification=ordinary,secured=yes`인데 **main 담보 120/무담보 0**; 양쪽 모두 원천 분류 상충으로 독립 기대는 분류 금액 **null/null + 사람 검토 요청**, 전체 채무 관측합계 120은 보존.
- **수정:** `DEBT_COLLATERAL_CLASSIFICATION_CONFLICT:<debtId>` + `DEBT_CAP_CLASSIFICATION_INCOMPLETE`로 오분류 한도 산출 차단. 관찰 원천 금액 자체는 변경 없음. **[Draft PR #132](https://github.com/firmengine/firmengine/pull/132)** (미병합), HEAD `6645ff8243214d3637da2e4c9ee8907b23f2f9d4`. 변경 코드 blob `3e7411a039be527d837f31ac623715c1617bc42c`; 회귀 테스트 blob `645388351e162a839d6b03a489541f2b9f286167`. 변경 파일 `lib/assessment.ts`, `tests/debt-source-integrity.test.ts` **2개만**, 둘 다 허용 디렉터리 내부.
- **실행 독립 기대:** PR에 실제 저장된 새 소스 재조회 후 V8 7조건: 일반/no→(0,120), 담보/yes→(120,0), 담보/no→(null,null), 일반/yes→(null,null), tax 미승인→(null,null), tax 승인→(0,120), 담보 unknown→(null,null); 모든 조건에서 총 채무 120 보존: **7/7 일치**. main은 분류 상충 2건 실패. 기존 채무합계/보증·분쟁·별제권/우선·priority 로직 전체를 검증한 것은 아님.
- **신규 프로젝트 회귀 테스트 3개 블록 작성·GitHub 커밋**. 그러나 테스트 프로젝트 Node 실행/TypeScript/전체 CI **미실행**. 법적 담보 분류와 채무한도 의미에 영향을 줄 수 있으므로 Draft 유지 및 **계산사무장·변호사 실제 승인 필수**. 테스트만으로 법률 확정 아님.

## A1-DATA-003 [ ] — 0 / 미관찰 / 오인식 / 비해당 / 상충의 구별

- **소스 SHA:** `lib/field-observation.ts` `c96954c09fa426e0dba5db2e5f787e2f3b880f19`, 기존 `tests/field-observation.test.ts` `290ba62fd31b263dee82a285117c1d96486a9fed`.
- **실행:** `observeField`의 실제 GitHub 함수 body를 타입 구문 제거 후 V8 실행. 외부 `documentFieldContract` / `bindCanonicalSourceField`는 **합성 unbound stub**으로 고정해 **원문 상태만** 격리 평가. 각각 독립 기대와 관찰 `sourceState / extractionState / sourceClaim`: null unknown, 관측 0, source blank, masked, conflicting, not_seen, 원문 앵커 있는 explicit_none + NA, blank에 붙은 NA(거절), present/null 충돌(unknown), unreadable(가독불량) **10/10**. 모든 결과의 `applicability.caseDecision=unreviewed` 유지. 실제 법적 비해당/직원 인정으로 자동 승격 없음.
- **미검증:** 실제 OCR 추출 정확도, page→DB row→typed Fact→18 계산→95 법률 전체 전달, 다수행/원천의례·케이스 전환·실 D1, 공식 서식/변호사 승인. 이 경계에서 신규 확정 결함 없음.

## 인수·배포 경계와 다음 회차

- **세 ID 전부 부분 검증 [ ]**. 제품 종단 인수 완료 0. 이번 회차 신규 P1 **후보 1건**, 수정 Draft PR **1건**. main 실행 코드 변경 **0건**; 다른 에이전트 PR/코드 덮어쓰기 없음.
- 실제 실행한 검증: DOC note 3/3 V8 + SQLite 모의 schema/query 7/7, LAW PR body V8 7/7 (main에서 상충 2 실패), DATA observeField V8 10/10. **V8 함수·SQL 격리 성립 ≠ 전체 Node 프로젝트/CI/staging D1/R2/Cron/브라우저/실무 법원 서식**.
- 본 문서와 보드만 main에 기록. 고객 정보/원본 OCR/.env/키/비공개 정답 기록 없음. 운영 배포·D1 운영 migration·전자제출·법원 인가 확정 미실행.
- 다음 54차는 **IT/AX/CALC** 역할로 전환. 제안 ID: **A1-IT-002** 사건/테넌트 격리·권한, **A1-AX-015** 자동초안 법률 승인 판본 경계(단일 보드 실제 제목 재확인), **A1-CALC-013** 납부/채권 분류 관련 계산·원문 연계(단일 보드 실제 제목 재확인). Draft PR #132는 최신 main rebase·실 Node 회귀·실무 승인 전 미병합.
