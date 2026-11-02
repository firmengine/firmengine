# FirmEngine A1 — 79차 코드 완결성·상호 기능충돌 감사 (2026-11-02 19:50 KST)

- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 직전 78차 IT/AX/CALC 다음 **서류담당자 → 변호사 → 데이터담당자** 순환.
- 시작 main SHA: `da0b2523b0d67bd1b6b3ec393abace80fa141506`; 쓰기 직전 재조회 SHA: `f451040208b2ac6469914f03e0ee249b5fb4394e` (다른 에이전트가 동시에 문서 갱신). 최근 커밋/PR, 중앙 인수 보드, 78차 영수증, 각 소스, 0022 SQL, Drizzle schema, 기존 Draft PR 테스트를 읽음.
- **검증 방식:** GitHub 원본 TypeScript 함수의 일부 타입만 제거하여 V8 `Function`에서 실제 함수 본문 실행. 화면/API/역할·저장소 의존성은 합성 객체·stub. 별도로 SQL 0022 DDL을 복기한 로컬 Python sqlite3 in-memory 3.46.1 검사. **전체 Node 테스트/CI, D1 운영/스테이징, R2/Cron, 브라우저, 실제 법원 문서 또는 사람 승인 아님.**
- 운영 배포·D1 운영 migration·법원 전자제출·인가 확정은 수행하지 않음. 실제 고객 문서·OCR 사실·개인정보·비밀키 기록 없음.

## A1-DOC-016 [ ] — 직원 검수와 독립 변호사 검수 분리

- main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; 기존 [Draft #28](https://github.com/firmengine/firmengine/pull/28) blob `2c71536f0a89ab2e97158ca90cde99b761caf415`.
- `manifestFingerprint`, `manifestIssues`, `currentExportReviews`, `reviewExport`, `archiveExport`의 원본 함수 본문을 함께 격리 실행. 파일 `application` 1개가 current이며 해시가 일치하는 **합성 final manifest**; `requiredKindsForCase`만 fixture에 맞춰 []로 주입. 실제 생산물/필수 서식 계약 아님.
- 독립 기대/관찰: (1) 직원 A→변호사 B current=true 양쪽 일치, (2) A→A 승인 거절 **main 허용/#28 차단**, (3) 공백이 다른 `staff`/` staff ` 동일인 승인 거절 **main 허용/#28 차단**, (4) 직원 없이 변호사 검수 금지 양쪽 일치, (5) 해시 변동 시 current=false, (6) 사건 revision 변경 시 false, (7) draft 금지, (8) archive 후 lawyer=false, (9) private-site-service 금지 양쪽 일치, (10) 과거 같은 actor 두 검수 기록의 current lawyer=false **main true/#28 false**.
- **실행 main 7/10, Draft #28 10/10 기대 일치.** 기존 P0 후보 재현, 신규 결함 집계하지 않음. 원본 기록 불변 및 실제 권한 토큰/HTTP/서명 자격 인증은 별도 미검증. #28 미병합이며 기존 소스와 통합 회귀 필요.

## A1-LAW-017 [ ] — 법원 보정명령 원본·기한·접수증 관계

- main `lib/preapproval-correction-item-store.ts` blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`; [Draft #68](https://github.com/firmengine/firmengine/pull/68) blob `81268a54216b1b7b6f40acda8510d09edcfae44c`. 기존 GET 사건 권한 수정안 [Draft #36](https://github.com/firmengine/firmengine/pull/36) 별도.
- `validateCorrectionItemDraft` 원본 본문·`linkedFact`의 타입만 제거해 실행, known canonical set/Fact 참조만 합성 대체. 가상 사건 `CASE-1`, 명령 `ORDER` 2026-10-30, 활성 원본 문서 `ORDER-DOC`, 가상 답변/접수증 `RESPONSE-DOC`/`RECEIPT-DOC`; **실제 법원 발령/접수와 무관**.
- 독립 기대/관찰 12조건: 정상 사후답변, 명령보다 앞선 답변, 당일, 다른 courtReference, 접수증이 event에 없음, 없는 event, 응답 없는 초안, event 없이 문서만, 철회된 명령 원본, 잘못된 원본 페이지, 문서가 활성이어도 이전 접수 이벤트, 날짜 문법 오류.
- **main 9/12, Draft #68 12/12 기대 일치.** 실패 세 조건은 `2026-10-20`/더 이른 답변을 `2026-10-30` 명령에 연결 허용, `occurredAt=not-a-date` 허용. `#68`은 시간 순서/유효 날짜 확인. 기존 알려진 P1/P2 관련 경계로 분류; 신규 확정 결함 집계 안 함.
- `readCourtCorrectionItems`의 동일 경계는 코드상 정적 확인했으며 이번 실행 미포함. 승인/법원충족 추론 금지. 실제 원본·기한 확정·접수증 식별/관할·변호사 승인과 D1 쓰기·동시성 E2E 미검증.

## A1-DATA-016 [ ] — Drizzle와 SQL 0022 제약 일치

- main `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; 실제 배포 대상 SQL `drizzle/0022_preapproval_court_correction_items.sql` blob `bec8b19780eaa951c4994530060c916f903a40fe`; journal `drizzle/meta/_journal.json` blob `45ec213999a1cf35bc65bdaf79f63a053e7d9796`.
- 독립 정적 대조: SQL은 `item_no CHECK(item_no>=1 AND item_no<=500)`, **현재 Drizzle에는 해당 CHECK 선언 없음**; 기존 [Draft #107](https://github.com/firmengine/firmengine/pull/107) `db/schema.ts` blob `53972a70d8a27dffaf9acb5d20632c0aec72acfe`는 CHECK 1..500 및 FK 경로 일치. DB SQL과 ORM 선언 불일치 기존 P2 후보 유지.
- GitHub SQL 0022의 테이블·index 정의를 복기한 **로컬 sqlite3 in-memory**에서 11조건 실제 실행, **11/11 기대 일치**: 1/500 허용; 0/501/-1/null 거절; 미존재 사건/문서 FK 거절; cross-case 문서 ID는 단독 FK만으로는 허용됨(애플리케이션 저장 함수는 사건 ID 대조를 별도 수행); 동일 item head 키 중복/미존재 version ID 거절. cross-case 허용은 SQL 단독의 관찰이며 운영 경로의 접근 위반을 뜻하지 않음.
- **신규 migration 생성하지 않음.** 기존 0022와 PR #107의 스키마 parity 테스트 파일 확인; 이번 sqlite 실험은 배포된 D1에 0022를 적용한 결과가 아님. 0000~0022 전체 rebuild/전체 컬럼·제약·trigger parity/CI 미검증.

## 범위·인계

- 선택한 세 ID `A1-DOC-016`, `A1-LAW-017`, `A1-DATA-016` 모두 **[ ] 미완료**. 기존 문제 3축 재현, **새 제품 코드 변경 0 / 신규 PR 0 / 신규 확정 결함 0**.
- 기존 Draft #28/#68/#107 각각의 수정 효과는 **격리 검증**; 병합·staging·실제 사람 승인으로 승격 금지. 다른 에이전트 변경과 동일 파일 충돌 가능성 때문에 재패치하지 않음.
- 다음 역할: **IT담당자 → AX담당자 → 계산사무장**, 우선 `A1-IT-015`, `A1-AX-010`, `A1-CALC-008`의 실제 제목과 미검증 상태를 최신 보드에서 재확인하여 처리.
- **미실행:** 전체 Node/TypeScript/빌드/CI, staging D1·R2·Cron, 실제 OCR, 85서류/18계산/95법률/자동초안/법원 보정 종단, 실제 법원 서식·변호사 승인·사이트 배포. Extra High 추론 모드 설정 검증 불가. 제품 전체 E2E 인수 완료 **0건**.
