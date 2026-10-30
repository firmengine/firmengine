# FirmEngine A1 17차 — 상담 서류 안내 / 법원 절차·인가 상태 / Drizzle 스키마 대응

- 회차: 2026-10-31 04:52 KST 전후. 이전 회차 IT·AX·계산사무장에서 이번 회차 **사용자·서류담당자 / 변호사 / 데이터담당자**로 순환.
- 감사 출발 `main` SHA: `91bd58c8643ec6680d0b82d5a6e47776665a411c`. 이력상 주된 신규 수정은 이전 A1 16차 이후 A2/A3/A4 별도 감사문서이며, A1 제품 코드 자체 병합을 확인하지 않았다.
- 인수 최우선 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 원본 blob: `af7a429f9881b029e27efedb3d7b585636bde9ef`. **정식 ID/문구** 기준 이번 `A1-DOC-013`, `A1-LAW-018`, `A1-DATA-016` 3개 선택. 16차 후속 추천의 DOC-013 다중문서라는 구두 설명 대신 중앙 보드의 실제 정의인 **발급처·기간·대상자 안내**를 우선한다.
- 기존 16차 영수증: `docs/release-audit-runs/A1/20261031-round16-case-read-guard-handoff-ref-cas-0351KST.md` blob `ee8f4a860e337e84fcef0382879c75eef7342318`; 해당 회차 보안 Draft PR #64 미병합. 이번 A1 감사에서 타 에이전트 PR 코드 변경·병합·운영 DB/사이트 조작 없음.
- 판정 구분: **원본문 격리 V8 실행 / SQL-only SQLite / 선언·소스 대조**만 해당. 앱 전체 Node·TypeScript·CI, 실제 D1/R2/Cron, 브라우저·서식·변호사 승인·법원 인가·운영배포는 **미관찰**. 3개 ID 모두 `[ ]` 유지.

## A1-DOC-013 — 서류명·발급처 안내 누락 P2

**원본 경로/sha:** `lib/reference-intake-catalog.json` `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`, `lib/intake-types.ts` `24788d5edc77d7af97e105992d381d44064cf8e2`, `lib/case-requirements.ts` `7f0735dbf3d95796b5494d57959cc7182de18571`, `lib/intake-case-bridge.ts` `1628e6ad01935a3d13cf1009d750958cf2f3630c`, `components/case-workflow.tsx` `2ec797958726b99a4358ec46ef35f78f90bfd927`, `lib/case-document-requirement-store.ts` `a670cb4e6a38aa6e782e898b5ed30aad80619c6d`.

- 독립 기대: 상담 85종 카탈로그에 있는 `documentName`, `issuer`, 요청 `period`를 직원 자료요청 화면에서 볼 수 있어야 한다. 대상은 **확인된** 사건 항목 링크로만 식별하며 미확정 대상의 자유입력 이름을 자동 노출·확정하지 않는다. 발급처 안내는 서류 유효성 또는 법원 증거 인정이 아니다.
- 코드 관찰: 85개 `IntakeDocumentType` 모두 `issuer` 비어 있지 않음. 상담 `IntakeRequirement`에는 이름/발급처/대상라벨/기간이 있지만 `makeCaseRequirement`가 이름/발급처/대상라벨을 버리며 기간만 workflow에 복사. 실제 UI 자료요청 카드에서는 범용 `요청 자료`와 `requiredPeriod`만 출력한다. 별도 상담 DB는 원본 JSON에 안내를 이미 저장하므로 전체 데이터가 사라졌다고 판단하지 않는다.
- **실제 main 원본 함수본문 + 후보 함수본문 격리 V8**: `resident_registration` 기대 발급처 `정부24·주민센터`, `salary_withholding` 기대 `사용자·홈택스`, `family_relation` 기대 `전자가족관계등록시스템·주민센터`. 원본문 세 사례 모두 `issuer=null`, `documentName=null`, 기간만 같음. 수정 후보 세 사례 **3/3 기대일치**, 전후 `mappingRequired` 동일, `subjectLabel` 필드를 새 workflow 객체에 복사하지 않음.
- **[Draft PR #65](https://github.com/firmengine/firmengine/pull/65)** 브랜치 `audit/a1-doc-issuer-guidance-20261031-r17-0452`, 최종 HEAD `68f5969dbdbfa00ef49ab28532761bcd77218584`: `CaseRequirement`에 **optional** `documentName`/`issuer` 추가 후 정확한 상담 카탈로그 값을 복사. 기존 화면에 이름·발급처·요청기간 표시, 대상은 이미 조회 중인 **확정된 subjectLink/typed entity**만 표시, 아니면 `대상 연결·검토 필요`. 발급처와 기간은 확정/승인 아님을 UI에 표시. 신규 회귀 `tests/case-requirement-collection-guidance.test.ts`에 85종·복수대상·구 workflow fallback 3그룹 작성. **원본 Node 테스트 미실행**, PR 미병합, 사람 UX/보안 검토 보류. PR #32도 동일 UI 파일 편집 중이므로 병합 전 충돌 점검.
- 코드만으로 실제 고객 화면 노출, 법원 서류 인정, 발급일 유효기간 검증을 입증하지 않으며 `A1-DOC-013 [ ]` 유지.

## A1-LAW-018 — 법원 제출·인가 자동확정 혼동 기존 P0 재현

**원본 경로/sha:** `lib/case-procedure-events.ts` `7c61fdfb6e79becc415a8b1385a1580bd8aa6ab2`, `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378`, `lib/preapproval-stage-audit.ts` `312827df606f148be3b82dcac7bfeb478ca6587d`; 기존 `tests/procedure-events.test.ts` `3429afc231eec2443e28f36009268f22afb91e55`. 5차 영수증·이슈 #11의 기존 공백.

- 독립 기대: `generated`는 문서 생성일 뿐이고 `submitted`·`correction_requested`·`approved` 등은 증빙 **문서 유형과 법원 원문 사실·접수증**에 근거한 담당자/변호사 확인 없이 확정해서는 안 된다. 임의 일반 통장증빙은 법원 보정/인가 원문이 아님.
- **현재 main의 실제 `validateProcedureEvent` 함수본문을 V8 격리 실행**한 6조건:
  1. `generated` + 문서/법원번호 없음: 허용(독립 기대와 일치).
  2. `approved` + 사건에 존재하는 **일반 통장증빙** + 비어있지 않은 합성 courtReference: **허용**(기대 거절, 불일치).
  3. `correction_requested` + 동일 통장증빙: **허용**(기대 거절, 불일치).
  4. `submitted` + 문서 ID 없음: 거절(일치).
  5. `received` + 타 사건 문서 ID: 거절(일치).
  6. `approved` + 법원결정 문서 ID: 허용(법원 문서가 진짜라고 가정한 격리 로직 기대와 일치; 진위 검증은 아님).
  즉 **6개 중 4개 기대일치, 기존 P0 2개 부정 반례 재현**.
- 명령 리듀서는 담당자 역할과 활성 동일 사건 문서를 요구하므로 **비인가 익명 승인이나 실제 법원 인가 발생을 입증하는 것이 아니다**. 그러나 `preapproval-stage-audit`는 저장된 `approved` 이벤트를 사전인가 점검 범위 밖으로 분류할 수 있으므로 가짜 분류가 사용자에게 오해를 줄 수 있다. 자동 법률승인 계약 변경은 사건 문서 종류/전자접수증/변호사·관할 판단 기준 설계 필요. **기존 이슈 #11 유지, 신규 코드 수정 없음, 사람 검토 필수, [ ] 유지.**

## A1-DATA-016 — Drizzle·migration 정합 부분검증

**원본 경로/sha:** `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `drizzle/meta/_journal.json` `45ec213999a1cf35bc65bdaf79f63a053e7d9796`, `drizzle/0016_source_field_coverage.sql` `c5c233909a3eeeaee430aa63c566600734299e20`, `0017_legal_reanalysis_orchestration.sql` `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`, `0020_calculation_poll_fairness.sql` `f4906ad0dcefa4bdce67f00b104540d2266f890d`, `0022_preapproval_court_correction_items.sql` `bec8b19780eaa951c4994530060c916f903a40fe`.

- JS 소스 메타 파서 실제 실행: `drizzle` SQL **23/23** `0000–0022` 파일 이름이 journal의 tag와 순서 대응, SQL의 `CREATE TABLE` 누적 56 테이블 이름과 Drizzle `sqliteTable` 선언 56 이름이 **56/56 일치**, 양쪽 누락/여분 이름 0.
- 실제 source SQL 열 이름↔Drizzle 선언 열 이름 부분 대조: `extraction_field_coverage` 8/8, `case_legal_automation_jobs` 20/20, `case_legal_automation_events` 7/7, `case_calculation_poll_jobs` 11/11, `case_court_correction_item_versions` 12/12, heads 7/7. 선별 6개 신규 테이블 열 이름 불일치 0. **모든 타입/NULL/FK/트리거/기존 배포 스키마가 일치한다고 확장하면 안 된다.**
- Python in-memory **SQLite에 0022 실제 DDL을 합성 `cases/documents` 부모 테이블과 실행**: version 12열/head 7열 `PRAGMA table_info` 일치, `item_no=0` CHECK 거절, 없는 `order_document_id` FK 거절. 단 SQL FK는 `documents(id)`만 참조하므로 서로 **다른 사건에 속한 존재 문서**도 버전행 단독 INSERT 시 받아들임(합성 사례 `case=synthetic-a`, `order_document_id=synthetic-doc-b`). 이는 **DB 단독 교차사건 FK 강제 공백**이며 실제 API 무결성 우회 확인이 아님: `lib/preapproval-correction-item-store.ts` SHA `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`는 실제 저장 전 `SELECT sha256,case_id FROM documents` 비교 후 `actualOrder.caseId===caseId` 가드를 둔다. 다른 직접 DB writer, FK 전체 구성, 실제 D1 적용 여부는 미검증/사람 IT 검토 필요.
- 신규 운영 migration/DDL 또는 원본/법률 상태 변경 없음. `A1-DATA-016 [ ]` 유지.

## 인수 판정과 후속

| ID | 독립 테스트/대조 실제 실행 | 결과 |
| --- | --- | --- |
| `A1-DOC-013` | 원본문과 PR 후보 V8 실제 3건, 서류계약 85종 정적 확인 | 신규 서류안내 누락 P2 재현, PR #65 검토중 |
| `A1-LAW-018` | 절차 검증 원본문 V8 부정/경계 6건 | 기존 P0 2개 부정사례 재현, 법률 설계 보류 |
| `A1-DATA-016` | 23 journal 정합, 56 테이블 집합·6테이블 열명 소스대조, SQLite 0022 CHECK/FK | 부분 기대일치, SQL-only cross-case FK 공백 별도 관찰 |

- 신규 코드 결함 **1건(P2)**, 작성·등록한 **Draft PR #65 1개**, 기존 P0 **1건 재현**, SQL-only FK 설계 공백 **1건(앱의 동일 사건 가드 확인)**, 3 ID 모두 **부분 [ ]**. 제품 최종 인수 **0건**.
- 사이트 운영 배포·운영 DB 마이그레이션·실제 전자제출·인가/확정값 승격 **미수행**. 실제 고객정보, OCR 사실값, 계정정보·키·.env·비공개 정답 Git 기록 없음.
- 다음 A1 회차 역할 **IT / AX / 계산사무장**로 교대. 후속 ID: `A1-IT-003`의 다른 사건 목록·첨부 GET 인가 범위, `A1-AX-016`의 참조 n8n 문서/활성 모듈 구분, `A1-CALC-015`의 기준정보 판본 CAS/P0. 별도 `A1-DOC-014` OCR 정정/원문 보존도 후속 서류 역할 때 처리.


### 17차 사후 추가 검증 (동일 PR 코드)

- GitHub Draft PR #65 HEAD `68f5969dbdbfa00ef49ab28532761bcd77218584`의 실제 `makeCaseRequirement` 후보 본문 blob `d8cd3240b6690df45af0e5ac4d00202ffd57e7d7`를 다시 가져와 **카탈로그 전체 85개 타입**을 독립 합성 입력으로 V8 실행. 발급처, 서류명, 요청기간, 미승인 crosswalk 상태, 자유입력 subjectLabel 미복사 등 **85/85 원본문 격리 기대일치**(불일치 0). UI PR blob `0a3574f5ab7a0aa847551d6ff9318fb6f57d54c8`에서 문서명/발급처/확정된 대상 링크/법원 인정 아님 문구 정적 확인. 원본 프로젝트 Node/브라우저 E2E 실행으로 승격하지 않음.
