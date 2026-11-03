# FirmEngine A1 — 97차 문서 감사 원자성·배우자재산·원본 포인터 독립감사 (2026-11-03 13:48 KST 시작)

- **범위:** `firmengine/firmengine` main의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 지난 96차 IT→AX→CALC 이후 이번 **서류담당자 → 변호사 → 데이터담당자**. 오직 **A1-DOC-007 / A1-LAW-008 / A1-DATA-007**, 모두 `[ ]` 유지.
- **감사 시작 main SHA:** `d74c33d7ddf3c04d7b18f9684ee20ea4765329a4`. 영수증 작성 직전 재조회 main SHA: `d74c33d7ddf3c04d7b18f9684ee20ea4765329a4`. 중앙 보드 감사 시작 blob `30994e7deff9881c019c5dd211ac9822a0df0723`. 최신 커밋 A3 97차(`d74c33d`), A2 97차(`fcdfc82`), A1 96차(`013684a`) 순. 공개 Draft #147 문서등록 감사, #23 원본 D1/R2, #66 문서GET인가, 최근 #216 요구기간을 확인. 96차 및 61차 A1 영수증, 중앙 보드의 세 ID, 실제 코드/스키마/기존 테스트/기준정보 조회.
- **검증 수준:** GitHub에서 읽은 **실제 main TypeScript 함수 본문**을 최소 TS 문법 제거 후 JS V8에서 격리 실행, in-memory `getCase/saveCase/event/db/bucket` 합성 의존성 사용. 배우자 자산의 `liquidationContribution` 실제 본문 및 Draft #23 실제 `commitOriginalUploadPointer` helper 실행. 첫 자산 검증 변환에서 `!==`가 `==`로 바뀐 **잘못된 시험은 전량 폐기**했고 연산자 보존 변환으로 다시 전체 12조건 실행. Node/TypeScript/lint/CI/브라우저/D1/R2/staging/Cron/공식 원문 확인/변호사 승인/전체 흐름은 실행하지 않음. 모든 테스트는 **가상 이름·해시·돈·사건**만 사용.

## A1-DOC-007 [ ] — 중복 업로드·감사 이벤트 연결
- 실제 main `app/api/cases/[id]/documents/route.ts` blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`; `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- **8 합성 조건, 독립 기대 6/8 일치.** SHA `a`×64/2쪽 최초 POST→201+감사 1건; 동일 원본 재요청→200 idempotent; 같은 SHA 다른 1쪽→409; SHA `b`×64→201; 독립 두 신규만 이벤트 2건; 잘못된 해시→400, 모두 기대 일치. `event("document.registered")`만 실패 주입: **HTTP 500이나 saveCase로 문서가 이미 커밋되고 감사 0건**, 독립 기대 원자 실패·보류와 불일치. 후속 동일 SHA retry는 **HTTP 200 idempotent·감사 0건 유지**, 누락 복구 기대와 불일치. 임의 이벤트 실패는 실제 운영 장애를 의미하지 않는다.
- 기존 **Draft #147 (미병합)** `lib/document-register-audit.ts` blob `2a47a99f62fc22e3c7e456e5b5db67633d60cb82`, `lib/server-store.ts` PR blob `0b1da3f8db6d47c43ff2f7eafe8f81f775f4f8de`, 테스트 `0eb4815decd4a3170b4799dca1f477bf6630be5f` 조회. D1 같은 batch INSERT 제안이나 **이번 회차 Node·D1 통합 실행 안 함**. 61차 격리 SQLite Node 3/3 영수증은 역사적 결과이며 현회차 패스로 이월하지 않는다. 이벤트 누락 후 다시 등록/수정/철회/교체/동시요청·ACK 불분명 상황 E2E 미검증.

## A1-LAW-008 [ ] — 배우자·명의/면제 재산의 산술과 승인 차단
- 실제 main `lib/assessment.ts::liquidationContribution` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5` V8 **12/12** 합성 기대 일치: 소유지분 100%, 시가 1억원·담보상환 2000만원·처분비용 500만원·가상 보호액 1000만원 → **6500만원** 산술. 보호액 명시 0원 → 7500만원, 보호액 미관찰/null·음수·기준일 오류·평가기준 공백·지분 누락은 null/사유 반환; 지분 50%에 담보 귀속 미정/원천 미연결은 null, 원천만 연결은 **1500만원+REVIEW_REQUIRED**, 별도 검토 인자 true이면 1500만원 및 해당 사유 제거. 보호액 가상 2억원이면 산술 0원·오류 사유 없음: **법정 인정이나 면제 승인이라고 해석 금지**.
- 기준정보 `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`의 **WF-29**는 배우자 소유·자금·이전증빙 두 종류와 `legalReviewRequired=true`, 일괄 절반 자동합산 금지를 명시. `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c` **EL-37**은 면제 신청/결정·공식 한도 검증 부재를 명시. 위 검사는 **산술 계약 및 JSON 구조**이지 명의신탁 판단·면제 인정 근거·법원 승인 검증 아님. 보호액 수기 금액과 법적 면제 승인 사이 source-only / approval-pending 경계 정책 검토 필요. 법률 의미 변경 코드 수정 없음.

## A1-DATA-007 [ ] — D1 원본 포인터와 R2 bytes 생존
- 실제 main `app/api/cases/[id]/documents/[doc]/route.ts` blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`의 **CAS UPDATE/재조회/cleanup 원문**을 합성 DB/R2로 실행: 안전 독립 기대 **2/3**. 정상 UPDATE(1 row)→포인터/R2 보존 일치. zero-row no-owner→임시 R2 삭제·409 일치. **D1 UPDATE 커밋 직후 ACK만 예외** → D1 포인터는 new-key, `finally`가 **동일 new-key R2 삭제**, 독립 안전 기대 불일치(P0 기존 결함 재현).
- 기존 Draft **#23 (미병합)** `lib/original-upload-commit.ts` blob `7bd20c41dbc33f182f7b15839a6d2dac4f7b9893`, 테스트 `08d40c473e76ff246f05f65f57aa6da0d1778567`. 실제 helper 본문 V8 **9/9** 합성 기대 일치: 정상 CAS 유지, ACK 유실+현재 key 재조회 recovery, 경쟁 승자 key 분리, 재조회 오류/ready0 시 불확실 객체 보존, CAS 0·충돌·해시 불일치·읽기 실패. PR의 helper만 시험했으며 **PUT 전체 스트림/R2 바이트 SHA 검증이나 Cloudflare D1/R2 연동/권한 확인은 미실행**. 보수적 readback 경로를 이행 전까지 법적 원천 확정 금지.
- **코드조치:** 새 main 제품 코드 수정·새 PR 없음. 이미 #147/#23에 수정안이 있고 범위 중첩·법률적 의미 변경 위험으로 Draft 유지. 그 대신 정확히 3 ID의 근거를 영수증/중앙 보드에 추가.

## 판정·다음 순환
- 97차 main 합성 검증: DOC **6/8**, LAW **12/12**, DATA **2/3** (합계 **20/23 독립 기대 일치**). #23 Draft helper **9/9**은 별도 비교이며 main 통과 수치에 포함하지 않음. **모두 [ ]**; 코드 존재≠단위/합성≠프로젝트 CI≠staging D1/R2/Cron≠공식서식·변호사 승인≠배포.
- **다음 역할:** IT→AX→계산사무장. 다음 미검증 ID **A1-IT-007**(OCR 작업 CAS·동시 수정), **A1-AX-007**(추론 결과 판본·출처결속), **A1-CALC-007**(재산별 청산가치 source/approval 경계) — ID 표제·순서는 반드시 최신 보드에서 재확인 후 적용할 것.
- 이번 회차 고객 정보/원본 OCR 값/비공개 데이터/키/.env 저장 없음. 85종 OCR·복수행·갈음 A←B+C/C01-C02-C04·18계산·95법률·직원 문안·보정명령과 동시 사건 전체 종단은 **미검증**. 운영 배포·운영 D1 migration·전자제출·인가 확정 실행하지 않음. Extra High 모드 실제 설정 확인 불가.
