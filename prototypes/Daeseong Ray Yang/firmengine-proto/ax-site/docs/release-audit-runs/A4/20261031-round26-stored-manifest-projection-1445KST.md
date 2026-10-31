# FirmEngine A4 26차 — 영속 ExportManifest 읽기 전용 투영·독립 지문 대조

2026-10-31 14:45 KST 시작 기준. **합성 사건만 사용**; 제품 인수 0건. A4 실행 흐름/예외/동시성/복구 외 변경 없음.

## 시작 근거·역할 순환
- 최초 관찰 GitHub main HEAD: `0fe60bd1362e062b367d908d2b83981a1afb4401` (2026-10-31 A3 감사 커밋). 최신 커밋 및 PR 재조회; 읽기 대상 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`(최초 blob `112ed6f6f9038dd513d5ef2bca3286ba4d85d09b`), A4 25차 영수증(blob `ee1a7f40bad3739ff184dd645a6cffdf124fba10`).
- 직전 과제: 저장되는 `ExportManifest.exportRequestId` / `sourceDataVersionAtExport` / `documentWriter`를 읽기 전용 진단기의 `requestId` / `fingerprint` 투영과 안전하게 연결. D1 원장의 `manifest_fingerprint`를 검증 없이 자기 자신과 비교하는 거짓 일치 금지.
- 관련 실제 코드: main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; main `lib/case-command-contract.ts` blob `4bcae36d910c50db4181f015a952a3060e4189ed`; main `lib/export-recovery-evidence.mjs` blob `306daa4c445766b409b7d1f1d9b8e7f3bb20cffe`; PR #61의 Export route blob `bc3515848261cc0aec509e2c826c714153c5ddf7`, `lib/export-request-ledger.ts` blob `6df547f1b6576a9bd00c50b445885b2b43ce25f7`.
- [Draft PR #61](https://github.com/firmengine/firmengine/pull/61) Open/Draft/미병합, head `e1a10be1e83516fa383d91f08dfdb62c7b530a5b`. 해당 통합 route/migration은 main 운영 경로가 아님.
- 6역할 순환: **서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자**. 이번 4개 직접체크 `A4-DATA-013`, `A4-AX-003`, `A4-IT-005`, `X-047`. 교차 확인(실제 문서·사람 검수 **미실행**) `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`. 7개 모두 `[ ]`.

## 실제 작업
1. 신규 `lib/export-recovery-stored-manifest.mjs` (blob `e41dd7c085de756d4e22aebe3e12271236386cee`, commit `38e84a6e88b1e659b4108941429590fa6c01d2b1`) — 관찰된 `caseData.context`, 저장 `exportManifest`, D1 receipt와 별도로 읽은 SQL/R2/audit 증빙을 **읽기 전용**으로 투영. `exportRequestId`가 없으면 receipt 요청 ID를 주입하지 않고 **inconclusive**; 다른 ID는 **historical**; 무효 0/불량 SHA는 **conflict**; 사건 버전 변화는 **stale**. 누락 writer 영수증은 승인된 것처럼 취급하지 않음.
2. 파일 목록으로 `commandHash({caseId,requestId,mode,caseRevision,sourceDataVersion,referenceSha256,files:[id,kind,name,hash]})`를 **재계산하도록 호출자에게 실제 commandHash 주입을 요구**. 저장된 D1 `manifest_fingerprint`를 투영값으로 복사하지 않음. 전체 재계산 지문이 다르면 conflict. 이미 관측된 R2/SQL 상충은 `uncertain` receipt라도 보존; `claimed/uncertain/failed`를 완료로 격상하지 않음.
3. 신규 `tests/export-recovery-stored-manifest-r26.test.mjs` (blob `36b7eead836ae818f8b0cf7c41eb15b89d44da1d`, commit `d741db7decf1fb72fa78977590cc21bf12ef8572`). **동일 Git blob SHA로 로컬 Node 22 native `node --test` 21/21 PASS**. 테스트의 SHA oracle은 실제 `case-command-contract.ts` canonical JSON 알고리즘을 미러링한 독립 JS·node:crypto 이며 TypeScript 원함수 호출이 아니다.
4. 별도 GitHub **실제 반영 소스**인 신규 어댑터 + 기존 `export-recovery-evidence.mjs` 본문 V8 통합 11/11 기대 일치: 정상 합성증빙→`evidence_consistent_review_required`(승인권한 false), R2 미관찰, R2 바이트 해시 충돌, SQL 행 없음, `uncertain` 증빙 일치/충돌, 타사건, writer 판본 불일치, 파일 archived, source 판본 변경, raw Manifest 미관찰. 이 V8 통합에서는 commandHash의 **사전 독립 계산된 합성 SHA**를 주입했으며 실제 TS commandHash·D1/R2 바이트를 호출한 것은 아님.
5. **부정대조/원리**: 원본 `ExportManifest`에는 `requestId`와 SQL receipt의 `manifestFingerprint`가 직접 저장되지 않음. 제품에서 보이는 `domain.manifestFingerprint`는 SHA가 아니라 JSON 문자열이므로 request receipt의 64자리 `commandHash`와 동일시 금지. 어댑터는 안전하지 않은 임의 지문 대입·자동 판단을 차단.

## 정확한 결과와 미실행 범위
- Node-native 신규 어댑터 합성 **21/21 PASS**; GitHub 반영 두 blob의 SHA를 실제 local git hash-object와 대조. 실제 GitHub 기존 triage 함수 결합 **V8 11/11 PASS**. **서로 다른 검증 수준**, 전체 CI/Next build/TS 전역검사 아님.
- 합성 receipt: case `case-synthetic`, request `request-aaaaaaaa`, revision 3, OCR dataVersion 7, SHA `a×64`, artifact `artifact-aaaaaaaa`; SQL/R2/감사 각 행 **가정 증빙**. 운영 고객원본 없음.
- Cloudflare staging **D1/R2/Cron 미실행**; 실제 두 HTTP 워커 CAS, R2 PUT/실제 바이트 GET/429/503/timeout 주입, 10분 quiet 계산·95 법률·Word 렌더·직원/변호사 승인·실제 법원 보정 이벤트 **미실행**. n8n 설계는 운영 실행 영수증이 아님. 운영 DB migration/배포/전자제출/인가 확정 **실행하지 않음**.
- 어댑터는 **Export route에 연결하지 않은 독립 source-only 진단**이다. `canDelete/canReplay/canMarkCommitted/canApprove`는 모두 false. 환수/정리/재시도/법적 확정은 허용하지 않음.

## 다음 체크 ID
- `A4-DATA-013`+`X-047`: PR #61에서 실제 D1 `artifact_ids_json`, `manifest_fingerprint`, SQL artifact/감사 event의 **읽기 전용 projection query** 연결. 각 R2 GET 실제 바이트 SHA를 계산하고 단계별 실패/응답유실 진입을 staging에서 관찰. `null`/빈 배열/0/비해당/상충 구별.
- `A4-IT-003`+`X-046`: 다른 UUID 두 HTTP 워커 동일 사건 CAS 경쟁과 패자의 orphan SQL/R2 보존 및 요청별 격리, staging 2worker 실행. 실제 검증 없이는 `[x]` 금지.
- `A4-DOC-011`+`A4-CALC-016`+`A4-LAW-013`: 원본 변경·갈음 철회·관할/기준판본 변경에서 10분 quiet 계산→95 법률→Word 재생성·기존 사람 검수 무효화를 실제 계약 기반으로 시험; 법률 승인과 내부 합성 증거 구분.

**출시/제품 인수 통과 0건, 기존 체크 ID [ ] 유지.**
