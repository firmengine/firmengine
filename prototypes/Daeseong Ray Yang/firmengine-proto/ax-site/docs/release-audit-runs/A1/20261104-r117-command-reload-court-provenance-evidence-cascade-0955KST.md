# FirmEngine A1 117차 — 명령 재방문·관할 미확정·증빙 철회 전파 (2026-11-04 09:55 KST)

## 범위·선행 읽기와 증거 수준
- 저장소 `firmengine/firmengine`, `main`, 허용 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 이번 조회 시작 `main` HEAD **387f52c9fb71717c2e6436deeb9d5b552ba83ac0**; 영수증 작성 직전 재조회 HEAD **387f52c9fb71717c2e6436deeb9d5b552ba83ac0**.
- 116차 A1 영수증(도구 조회 blob `1711277cb6676660ffcf356c3eadedbdc8a777eb`), 중앙 보드(읽기 시 blob `5795382e31363058ad0166646b7593ed09c59e8e`), 최근 A2/A3 커밋, `db/schema.ts` (blob `933f8686845ac14669312dd21bf85e02c62ed5e6`), `tests/case-commands.test.ts` (blob `a388177e8120174ee57c683264292b86faf76f2b`), `tests/case-workflow-view.test.ts` (blob `d8e2ce43f46c82b2389f523b9d9af3403ec5f761`), 명령 API `app/api/cases/[id]/commands/route.ts` (blob `44c267951751d280d0f1c27ac6b3362bd7f9b9d6`) 및 `lib/case-command-store.ts` (blob `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01`)를 확인.
- 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**. 중앙 보드의 기존 미인증 ID **A1-DOC-018 / A1-LAW-003 / A1-DATA-017** 선택.
- 관련 변경은 미병합 **Draft #32** (UI 명령 확인), **Draft #128** (법원 미확정), **Draft #20** (증빙 철회 계보). 각 PR 본문과 diff를 읽었으나 **이번 회차에서 수정안 자체를 실행하거나 병합하지 않았다**.
- **실행 등급:** GitHub `main`에서 조회한 실제 함수 본문에서 TypeScript 타입 구문만 제거한 Code Mode V8 `new Function` 실행; UI 응답/DB/crypto/외부 스토어는 synthetic stub. `currentFacts`, `touchCase`, `retractDocument` 실함수 본문을 사용하고 `invalidateExports`만 no-op stub. 테스트 수는 기술적 계약에 대한 독립 기대와 관찰의 일치 수이며 제품 전체 합격률이 아니다.
- **미실행:** 프로젝트 Node 22 테스트·TS/lint/build/CI, 실제 인증 HTTP/브라우저 새로고침, D1/R2/Cron, 문서85·계산18·법률95 전체 흐름, 법원 서식·전문가 인수·운영 배포. 추출원본, 고객/개인정보, 키, .env, 비공개 정답은 사용하지 않았다.

## A1-DOC-018 [ ] — 네트워크 단절과 UI 명령 상태·영수증 복구
- 원본 `components/case-workflow.tsx` blob **2ec797958726b99a4358ec46ef35f78f90bfd927**; 원본 `send` 함수 전체(명령 ID/HTTP 응답/성공·불확정 상태)를 타입 구문만 제거해 V8에서 실행. GET `/api/cases/{id}/commands?commandId=`는 서버에 구현돼 있지만 `send`의 재방문 자동조회 경로는 발견되지 않았다. 서버 실제 처리 함수는 `committed:true`와 저장 후 평가 `pending:true`를 별도 반환할 수 있다.
- **독립 기대:** 커밋 영수증 확인 시에만 UI 성공/미해결 ID 해제, 200/202가 와도 `committed:false`, `{}`, 응답 JSON 파손이면 미확정/동일 ID 유지; 409 명시적 거부만 ID 해제; 네트워크/5xx는 동일 마운트 명령 ID 재사용; 새 마운트는 영수증 확인 없이 새 요청을 재전송하지 않음.
- **V8 실제 입력/관찰 11개 중 6개 기대 일치:**
  1. HTTP 200 `{committed:true,receipt:{status:"committed"}}`: 성공/대기 해제 (통과).
  2. HTTP 202 `{committed:true,pending:true,receipt:{status:"committed"}}`: 저장 성공/평가 별도 진행 (저장 ACK 수준 통과).
  3. HTTP 200 `{committed:false,receipt:{status:"pending"}}`: **성공으로 오판하고 pending 삭제** (불일치).
  4. HTTP 200 `{}`: **성공으로 오판하고 pending 삭제** (불일치).
  5. HTTP 202 `{pending:true}`: **성공으로 오판하고 pending 삭제** (불일치).
  6. HTTP 200 JSON 파싱 오류: **`{}` fallback으로 성공 처리** (불일치).
  7. HTTP 503: 오류·pending 유지 (통과).
  8. HTTP 409: 거부·pending 해제 (통과).
  9. 네트워크 예외: 오류·pending 유지 (통과).
  10. 같은 마운트 네트워크 오류 후 `retry=true`: 동일 commandId 재사용 (통과).
  11. 새 마운트 후 동일 의도 재시도: 이전 ID `cmd-11` 대신 신규 `cmd-12` 발급, GET 영수증 조회 0회 (불일치; 실제 서버 이중 커밋 아님).
- 명령 ID는 브라우저 `crypto.randomUUID`의 synthetic 대체 값이므로 실제 `parseCaseCommand` 검증까지 통과했다고 주장하지 않는다. 기존 Draft #32는 성공 오판을 다루지만 **새로고침 후 안전한 영수증 복원**은 여전히 미검증. 미병합/실제 브라우저·D1 미실행.

## A1-LAW-003 [ ] — 법원 관할 미확정을 서울로 암묵 승격 금지
- 원본 `app/api/cases/route.ts` blob **75beaa0f74abd4e23a3c5623efa1d526f2ff3290**. 실제 `POST` 본문을 타입 제거 후 합성 `createCase`·DB `prepare/bind/run`·`Response.json`에 연결해 저장 payload `courtId` 관찰. 응답 201 자체는 확정 증거가 아니다.
- **독립 기대(업무 판정 아닌 입력 기술계약):** 미입력/null/빈 문자열/공백은 `unknown`, 명시적 `seoul`/`incheon`/`unknown`은 보존, `" seoul "`은 공백 정규화 후 `seoul`.
- **8개 입력 중 3개 기대 일치**: 누락→`seoul`(불일치), null→`seoul`(불일치), 빈 문자열→`""`(불일치), 공백 `"  "`→그대로(불일치), 명시 `seoul`→`seoul`(일치), `" seoul "`→그대로(불일치), 명시 `incheon`→`incheon`(일치), 명시 `unknown`→`unknown`(일치).
- 서울 우선 개발·초기 업무 기준과 **해당 사건의 법원 관할 확정**을 구분한다. 기존 역사적 `seoul`을 자동 소급변환하지 않는다. Draft #128 미병합; 법률상 관할 판정은 변호사 승인 전 확정하지 않음.

## A1-DATA-017 [ ] — 문서 철회 시 현재 Fact와 typed 인정 간 상태 불일치
- 원본 `lib/domain.ts` blob **39ab41856f6d7a379aca7217d24b28f7f5f7616a**에서 `currentFacts`, `touchCase`, `retractDocument` 3개 실제 함수 본문을 타입 문법/Map 제네릭만 제거하여 합성 실행. `invalidateExports`는 no-op stub이므로 **export 무효화는 검증하지 않았다**.
- 합성 사건 `case-S`: 활성 문서 A/B, A 원문 Fact `fact-A` verified+accepted 및 소득/채무/가계 typed 참조, B Fact `fact-B`와 무관 asset. 문서 A만 철회.
- **독립 기대:** A 삭제, A Fact 최신판 철회와 currentFacts 제외, 연관 typed `factIds` 해제·recognition/legalReview `unreviewed`, B 자산·사실·이전 원문 이력 보존, revision만 증가.
- **12개 조건 중 7개 기대 일치**: A deleted(통과), A latest Fact 제외(통과), 철회 tombstone 기록(통과), **소득 recognition 여전히 accepted**(실패), **소득 factIds 1개 잔존**(실패), **채무 legalReview accepted 유지**(실패), **채무 factIds 잔존**(실패), **가계 recognition accepted 유지**(실패), 무관 asset 승인 유지(통과), revision 3→4(통과), B Fact 유지(통과), 원본 snapshot 불변(통과). 실제 하위 계산/95법률 실행에서 최종 승인 우회가 발생했다는 입증은 아니다.
- `lib/case-commands.ts` blob **d18c555f04f65687c509a8e8d35aba4bb3597378**의 `document.retract`·`document.role`은 전역 review reset/문서 매칭 stale은 수행하나 연관 typed `legalReview`의 명시적 해제는 보이지 않는다. 기존 Draft #20의 보완이 미병합이며 이번 회차에서 PR 수정 helper를 재실행하지 않았다. 법률인정·계산 소비처 통합 회귀 전 실제 인정값의 자동 승격·소급 변경 금지.

## 실제 조치·분리된 인수 게이트
- 이번 **선택 원본 함수 합성 합계 16/31** (DOC 6/11, LAW 3/8, DATA 7/12). 기존 결함을 재확인했고 신규 제품 실행 코드 변경 0; 기존 Draft #20/#32/#128와 겹치는 파일 및 법률 승인 정책을 중복 편집하지 않는다. 코드 부재/합성검증/CI/staging/법원 공식서식/변호사 승인은 각기 다르다.
- 다음 순환 **IT → AX → 계산사무장**. 중앙 보드 미완료 후보 `A1-IT-018`(공개 번들/비밀), `A1-AX-018`(참조 프롬프트와 활성판본), `A1-CALC-018`(사업소득 승인 뒤 법률검토 재평가). 각각 최신 코드와 PR, 이전 이력을 먼저 확인.
- 본 회차는 보고용 영수증과 중앙 보드 해당 3 ID만 갱신. 모든 ID `[ ]`, 제품 종단 인수 **0건**. 운영 배포/D1 운영 migration/실제 법원 제출·인가 확정 미실행. Extra High 설정 확인되지 않았으므로 사용을 주장하지 않는다.
