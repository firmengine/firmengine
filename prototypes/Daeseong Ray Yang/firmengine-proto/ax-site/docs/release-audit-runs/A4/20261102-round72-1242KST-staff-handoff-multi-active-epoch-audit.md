# FirmEngine A4 — 72차 직원 Word 인계: 다중 활성 기준정보 / 감사 원자성 교차 진단

- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. **합성 사건만 사용**, 고객 데이터·원본 OCR·키·비공개 정답 없음.
- 감사 시점 `main`: `adf2d058bfcf37436f019094314380a538065c97`. 기존 71차 기록 `20261102-round71-staff-handoff-audit-event-atomicity.md`에서 이어짐.
- 중앙 보드 시작 blob: `c55ae02eea1ce786927217d44869c26ee64cef3a`.
- 읽은 실제 코드 및 blob: `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`; `lib/automatic-draft-handoff-contract.ts` `43cd0e0245bb74d396879880161654cf80a2978e`; `lib/reference-context.ts` `537a231c915445cf7ed5481fa5b35e63612229a7`; `lib/reference-store.ts` `16164f17d4a5d849d586a1b094922b020b57103a`; `drizzle/0006_legal_reference_monitor.sql` `fc2eeb9e336b2275440064a6b88bf90fbc939187`, `drizzle/0017_legal_reanalysis_orchestration.sql` `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`, `tests/automatic-draft-handoff-contract.test.ts` `01724a1f0e214701fdc89458ef776c2606c0f1ee`.
- 관련 기존 별도 후보: [Draft #167](https://github.com/firmengine/firmengine/pull/167) 승인세대 CAS (HEAD `7b08e7fb8282bf707983e100f10a8fad027079b1`); [Draft #170](https://github.com/firmengine/firmengine/pull/170) 이벤트 atomic batch (HEAD `b127f6c99894f1dfbe047a1eb94843fb98079095`); 둘 다 **main 미병합**. 두 PR의 **SQL 조각을 합성 결합했을 뿐** 전체 코드 통합/컴파일은 하지 않았다.

## 신규 P1 조건부 후보: 여러 active release 행이 공존할 때의 CAS 불일치

1. 실제 `reference-context.ts`의 읽기 계약은 `WHERE status='active' ORDER BY revision DESC LIMIT 1`이므로 A(rev10)와 B(rev11)가 둘 다 active이면 **B**가 현재 기준정보이다. `drizzle/0006`은 PK(id)는 있으나 **활성 release의 단일성 UNIQUE 제약이 없다**. 정상 `reference-store.ts` 승인/복원 루틴은 동일 batch에서 옛 release를 supersede하므로 **정상 성공 경로에서 다중 active 상태가 발생했다고 주장하지 않는다**. 본 합성은 DB 이상/레거시/부분복구 조건의 fail-closed 검증이다.
2. Draft #167의 최종 CAS는 `EXISTS(SELECT 1 FROM legal_reference_releases WHERE status='active' AND id=? AND revision=? AND sha256=?)`이다. 두 active가 존재하면 과거 A도 여전히 매칭되어, 조회 기준 B와 달리 **오래된 A 인계 UPDATE 1행**이 발생할 수 있다.
3. #170의 guarded 이벤트를 동일 SQLite 트랜잭션에 결합하면 이때 직원 인계 audit도 **1행**이다. 즉 **감사 원자성 개선이 잘못된 기준판본의 링크를 승인해 주는 것은 아니지만, 구판본 링크와 audit이 함께 저장되는 부정대조**가 된다. 사람의 법률 승인/법원 인가가 아니라 초안 인계 이벤트뿐이다.
4. 독립 비교용 `COUNT(active)=1` 조건을 더하면 다중 active에서는 UPDATE 0 / audit 0; 정상 단일 active에서는 1/1. **이는 정책·운영 스키마 검토 전 설명용 후보일 뿐 제품 수정본은 아니다**. 다른 가능한 해결은 로더/쓰기 공통 단일 active 불변식 또는 원자 CAS 최상위 revision 비교이다.

## 실제 실행한 재현·독립 기대·관찰

- Node v22.16.0 / `node:sqlite` WAL, 두 독립 연결, 가상 case/revision3/source-v7/calc-A/legal-A/ref-A1(rev10,SHA A). 고유 로컬 테스트 `/mnt/data/firmengine-a4/round72_pr167_pr170_multi_active_reference_audit.test.mjs`, SHA-256 `99bc63bc512c1a841dd3837c06fe533ff2ce7dcb02d94465410f976533373057`.
- 신규 테스트 최종 **16/16 예상 관찰 일치**. 첫 실행은 SQLite Row의 null-prototype vs 일반 객체 `deepStrictEqual` 타입 차이로 15/16이었으며 오라클 자료형을 정정한 뒤 **16/16 재실행**; 실제 SQL 결과 불일치는 아니었다.
- 분리된 기대/관찰: 정상 release → **1 link/1 event**; A→B / A→B→A / active 없음 / source v8 / calc·legal Head drift / 타 워커 token 소유 → **0/0**; 두 active A10+B11 및 A10+A12(SHA 동일) → Draft #167/#170 합성은 **1/1**, 독립 기대는 **차단 0/0**; 단일성 추가 비교 후보는 **0/0**; 두 워커 동일 출처는 승 1/1 패 0/0; audit INSERT NULL 강제 실패 후 rollback은 0/0; COMMIT 직후 ACK 유실은 타 연결에서 1/1 관찰. **부정대조를 포함하므로 16건 제품 합격이 아니다.**
- 이전 70·71차 로컬 SQLite 테스트도 **19/19 기대 관찰 일치** 재실행(12+7, 위험 부정대조 포함). 총 35건은 합성 관찰 수이지 운영 인수 수가 아님.
- `main` 실행 코드에는 #167/#170 패치가 없으므로 **현 운영 코드에서 두 패치의 통합 동작을 실행한 것이 아님**. 외부 R2/D1 네트워크, DB schema full migration, CI, Cloudflare staging, 실제 두 HTTP 워커, n8n 운영 흐름은 **미실행**.

## 6역할 순환 및 선택한 5개 체크 (모두 [ ] 유지)

순서 **데이터 → AX → IT → 사용자·서류 → 계산사무장 → 변호사**. 5개는 직접 합성·소스 대조에 따른 부분검증, 나머지 2역할은 인계 조건만 검토했다.

- `A4-IT-005` [ ]: 두 CAS 후보의 결합에서 active release 다중 존재 시 오래된 A의 UPDATE 1 / guarded event 1; 정상/만료/ACK 경쟁 부정대조. D1 staging 미실행.
- `A4-DOC-012` [ ]: 직원 인계 linked/event와 법률 기준 활성 최신 판본의 불일치를 재현. 독립 변호사 후속 인계 미실행.
- `A4-LAW-013` [ ]: 구판본 초안 인계 감사 이벤트를 변호사 승인·최종 Word byte·법원 인가로 승격 금지. 실제 법률 인정/공식 서식 미실행.
- `A4-DATA-012` [ ]: active 2행(동일·상이 SHA) 시 read-latest vs write-EXISTS 정책 상충, 권장 진단은 active-count/최신 revision 동시비교. 실제 D1 corrupt 행 존재 관찰 없음.
- `X-046` [ ]: DB 두 연결 claim/release drift/승자-패자 및 뒤늦은 응답유실 합성 재현. 실 HTTP 병렬/Cron 미실행.
- 간접: `A4-CALC-016` [ ] 실제 10분 quiet 계산 lease/재산출 미실행; `A4-AX-013` [ ] Word 재생성/사람 승인·보정 이벤트 E2E 미실행.

## 단계 상태·실무자 검토·복구

- 상담 → 서류 → OCR → 10분 quiet 계산 → 법률 95개 → Word 초안 → 직원/변호사 검수 → 실제 보정 이벤트의 종단 단계별 관찰은 **미실행**. A4 이번 건은 **Word 직원 인계 CAS·감사 이벤트** 경계에만 한정.
- **상충**: active release 2행과 read/write 정책; **0**: 조건 충족 실패 UPDATE/event 수; **null**: 실제 운영 DB/R2 영수증 미확보, 값이 0이라는 뜻 아님; **미관찰**: 실제 운영 429/503/timeout·R2/D1 결과; **source-only**: Draft patch 및 n8n 문서; **비해당**: 법원 최종 인가 단정; **승인전**: 모든 법률 인정·실무자 승인.
- n8n 참조 `docs/ax-n8n-e2e-scenario-matrix-20261030.md`는 설계/인수 시나리오이고 운영 워크플로 실행 영수증이 아님.
- 다음 체크: `A4-IT-005`, `A4-DATA-012`, `A4-DOC-012`, `A4-LAW-013`, `X-046` 중 새 미검증 경계(두 active repair, 기존 already_linked 증빙 503 vs missing, R2-D1 ack, Word 재생성 재승인) 순서대로. PR #167/#170의 실제 코드 병합·Node/TS 전체 회귀·staging D1 실행과 기준정보 관리자/변호사 결정 없이는 merged 또는 PASS 금지. 이미 기록된 실제로 불완전한 event를 근거 없이 복구/backfill하지 않는다.
- **신규 최종 인수 0/5; 전체 최종 인수 0**. 운영 배포, 운영 D1 migration, 전자제출, 법원 인가 확정 **실행하지 않음**.
