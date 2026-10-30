# FirmEngine A1 11차 — 발급일/기간·독립 검수·대량 OCR read-head race

- 감사일: 2026-10-30 KST. 직전 10차 IT/AX/CALC → **11차 서류담당자 A1-DOC-010, 변호사 A1-LAW-015, 데이터담당자 A1-DATA-013**.
- 최초 확인 main: `31edfb5f00b585cba8068abfb55edfed930925fd`; 코드 수정 Draft 브랜치 생성 기준 main: `882e978a05f4cfff9e9e09f384dc237fe869f76d`; 본 영수증 쓰기 직전 main: `964314990515bf0bd79ed533cdf378a85aa01ea8`.
- 먼저 main/최근 커밋·PR #28/#49 및 이전 A1 10차 영수증·중앙 보드·관련 source/schema/test를 읽었다. 모든 변경은 지정된 ax-site 내부만. 개인자료·원본 OCR 사실값·키·실제 문서 없음.
- **인수 결론: 3 ID 모두 [ ] 부분/미검증.** 전체 제품 인수 0. 코드 존재, 격리 V8, 전체 Node/CI, 운영 D1/R2/Cron, 법원 서식·변호사 승인 및 운영 배포를 구별한다.

## A1-DOC-010 — 발급일·기간·신청일 유효성

- 코드와 데이터: `lib/reference-intake-catalog.json`의 제출요청 period 문구(신청 예정일 기준 2개월 발급 원칙 **안내**) 및 `lib/intake-court-coverage.ts`의 발급일·대상기간 질문은 존재. `lib/case-document-requirement-store.ts`는 `required_period`를 자유 텍스트로 저장. `lib/domain.ts::EvidenceDocument`는 `uploadedAt`은 가지지만 발급일/원문 내용 기준일의 typed 필드는 없음. `lib/case-requirement-monitor.ts`는 `subjectAndPeriodVerified:false`, `requirementFulfilledInferred:false`로 보수적으로 표시함.
- **정적 경계 대조**: 합성 문서의 발급일 2026-08-01, 적용기간 2026-06~07, 신청일 2026-10-30의 자동 유효성 판단을 요청하더라도, 현재 저장 타입에는 세 날짜의 독립 검증값·법원별 승인기준을 연결할 인터페이스가 없어 실제 판정을 **미관찰/미구현**으로 남긴다. 2개월 규칙을 임의 하드코딩하지 않음. 제출가능/법률상 유효 판정 금지.
- 실제 API/UI/DB 날짜 E2E **미실행**. 발급일/조회기준일/사실 발생기간/신청일의 독립 구조화·관리형 기준·담당자 검토가 후속 과제.

## A1-LAW-015 — 독립 문서 검수

- 원본 `lib/domain.ts` blob SHA `39ab41856f6d7a379aca7217d24b28f7f5f7616a`의 `currentExportReviews`, `reviewExport` 실제 함수 본문을 타입표기만 제거해 격리 V8 실행. Manifest 관련 외부 함수는 합성 해시·issues 없음으로 주입; 실제 사용자 ID/DB/HTTP 없음.
- 독립 오라클: 같은 actor의 직원 승인+변호사 승인은 **거절/현재 승인 아님**, 서로 다른 actor는 현재 승인 **가능**. historical same-actor도 현재로 재승격하면 안 됨.
- 본문 V8 6조건: **main** 동일 actor 연속 승인 허용, 기존 동일인 승인도 current(2 false accept), 서로 다른 actor current 정상(1); **Draft PR #28 후보** 동일 actor 거절, 기존 동일인 current false, 다른 actor current 정상(3 기대일치). 이미 발견된 결함으로 **중복 신규 결함 집계 금지**.
- `PR #28`은 확인 시 **open/unmerged**. C02 실인증·전체 Node/실제 문서 검수는 **미검증**. 동일인 승인 흔적은 삭제하지 않고 판본/인적 승인 단계 구분 필요.

## A1-DATA-013 — 2,000 OCR/5,000 계산 대량 조회 및 OCR head 교체

- 코드 SHA: main `lib/extraction-row-store.ts` `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`, 기존 테스트 `adbb896c5bc69716e34ee82c5bfedc5555f677a2`. SQL `case_extraction_heads`와 `extraction_records`/`extracted_features` 관계, `lib/case-schema-services.ts`, `app/api/cases/[id]/data/route.ts` 조회 경계 확인.
- 현재 원본은 한 페이지 최대 500 record / 5,000 field(쓰기); 조회는 50 record / 응답, 500 field씩 청크·10,000 field 상한, `featuresTruncated:false`와 불일치시 예외. 기존 `tests/extraction-row-store.test.ts`에 **2,200 cells 비잘림 테스트가 존재**하지만 이번 실행은 **아님**. 계산 저장 5,000 feature 상한 / 조회 페이지 제한 500(스토어), 50(API). 5,000행 E2E 미실행.
- **신규 P1 실제 함수 원본 V8 반례:** 합성 case revision=1, page documentId=doc, current committed OCR run A를 SELECT 후, field SELECT 직전 head를 B로 교체(사건 revision 그대로). 기대=기존 A 응답 거절/최신 재조회, 실제 main=A 반환·sourceOnly=true·caseRevision=1로 성공. afterSelect, duringFeatures 2개 전이 모두 **false accept**; stable은 정상(총 기존 함수 3조건).
- 원인: `listCaseExtractionRows`의 마지막 체크는 `cases.revision`뿐, `case_extraction_heads.run_id` 변경을 보지 않음. 10차 계산 run read 판본 오류(PR #49)와 유사하지만 **독립 OCR 소스** 경로.
- **[Draft PR #52](https://github.com/firmengine/firmengine/pull/52)**, branch `audit/a1-r11-ocr-head-read-cas-20261030`, code commit `d6a455aa46b807318c16894138d5c46ebe77d772`. 반환 직전 선택된 유일한 (문서,page,run)을 현 head와 bounded count SQL로 다시 비교, 불일치시 기존 `CASE_REVISION_MISMATCH` (HTTP 409 처리 경계)로 거절. 활성 source의 법률 인정값 변경 없음. 코드 파일 2개만 수정.
- **실제 후보 함수 본문 V8 3/3 기대일치**: stable A 승인, afterSelect A→B 차단, duringFeatures A→B 차단. 원본 V8 3개와 비교하여 총 6조건 실행. 새로운 동일 revision head race용 Node SQLite 회귀 1개를 기존 `tests/extraction-row-store.test.ts`에 추가했으나 **실제 원본 Node는 실행하지 않음**. Cloudflare D1/HTTP/전체 CI 미검증.
- 남은 이슈: 요청 **중간** CAS 보호만 제안; 서로 다른 **페이지 요청 간** 동일 OCR-head 집합을 고정하는 token, count/offset 안정성, 2,000·5,000 성능/누락 E2E는 아직 미인증. PR #49 계산 페이지 token 변경과 혼합 수정·병합하지 않음.

## 다음 A1 순환

IT `A1-IT-014` 문서 실패·retry artifact 보존, AX `A1-AX-013` 증빙 누락→자료요청/사람 역질문, 계산 `A1-CALC-014` 제안/출처/승인 금액 경계. 기존 PR #24/#32/#49/#52 충돌을 확인하고 중복 편집하지 말 것. API/DB/정식 Node 테스트·공식 서식·변호사 승인 없이 체크박스 통과 금지. 운영 배포·운영 마이그레이션·법원 제출 금지.
