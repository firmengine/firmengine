# FirmEngine A4 35차 — 법률 워커 lease 상실 후 실패 영수증 CAS

- 회차 시작: 2026-10-31 23:42 KST; 시작 main `8a2963f93329721bcb9f566b61b55e7f8b11b14f`.
- 유일한 인수 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (시작 blob `404ba5c293e350595672f8081c986c1086e48f99`).
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만; 공개용 합성 사건 `case-synthetic`, UUID/키·원본 OCR·고객 정보 없음.
- 역할 순환: **변호사 → 데이터담당자 → AX담당자 → IT담당자 → 서류담당자 → 계산사무장**. 직접 합성 검증은 `A4-IT-003`, `A4-AX-006`, `A4-DATA-004`, `X-046`에 대한 일부 행동. 연관 인계 `A4-DOC-013`, `A4-CALC-004`, `A4-LAW-006`는 기존 코드 정적 확인/종단 미실행. **모든 체크 [ ] 미완료**.
- 원본 코드/DB 기준: `lib/case-legal-automation.ts` 시작 blob `3a816faa42ab7dc82b69ce95da0caf8f6174f490`; `lib/case-data-recompute.ts` blob `c19584f1668b7f4849ac0fc8c910f7c1ce36187d`; `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `db/schema.ts`, `lib/reference-runtime.ts`, 이전 A4 r33/r34 영수증, 기존 poll test 확인.
- 관련 PR: #16 Open/미병합(원본 poll CAS), #61 Open/Draft/미병합(Export 복구), #87·#91 Open/Draft/미병합(구 reference read/preflight). 이 제안은 main 기능으로 계산하지 않음.

## 새로운 P1 후보 — 만료된 법률 워커의 거짓 재시도/확정실패

`processJob` 내부 catch의 실제 원본을 GitHub에서 읽고 TS-only cast 없이 V8 AsyncFunction으로 추출 실행. 독립 기준: `UPDATE ... WHERE id=? AND lease_token=? AND status='running'`에서 `changes===0`이면 해당 워커가 DB 상태를 변경하지 못했으므로 `retry_wait/failed` 저장 성공을 반환하거나 법률 감사 이벤트를 추가하면 안 됨.

| 합성 입력 | 수정 전 실제 관찰 | 독립 기대 |
|---|---|---|
| A lease 만료, B 신규 소유, A 503/1회차 실패, SQL changes=0 | `retry_wait`, 거짓 event 1건 | `superseded`, event 0 |
| 동일 조건 A 429/4회차 | `failed`, 거짓 event 1건 | `superseded`, event 0 |
| A `LEGAL_AUTOMATION_SUPERSEDED` + SQL changes=0 | 반환은 superseded이나 거짓 event 1건 | event 0 |
| A 유효 lease, SQL changes=1, 503/1회차 | `retry_wait`, event 1건 | 유지 |
| A 유효 lease, SQL changes=1, 503/4회차 | `failed`, event 1건 | 유지 |

수정: 오류 상태 CAS 응답이 **정확히 0행**이면 `LEGAL_AUTOMATION_LEASE_LOST`/superseded, 감사 이벤트 0건. 정확히 1행만 기존 retry/failed 및 감사 이벤트를 허용. `meta.changes`가 null/미관찰 또는 2 등 비정상이면 `LEGAL_AUTOMATION_FAILURE_ACK_UNOBSERVED`로 오류 발생; **0/미관찰 혼동 금지**. SQL 계약·법률 판단/95개 항목·계산 산식·D1 스키마는 변경 없음. `lib/case-legal-automation.ts` 수정 blob `6257c1dab33636b87d9f6d4a82e0e6b72c77f9dd`.

## 실행 수준 및 실제 결과

1. **수정 전 GitHub 실제 catch 코드 V8**: 5조건 중 정상 소유 2건 기대 일치; lease 잃은 3조건 거짓 상태/이벤트 직접 재현.
2. **수정 후보 V8 격리**: 정상 소유/lease 상실/0/null/미관찰/다중행 응답 **8/8** 기대 일치.
3. **커밋된 source-extracted 회귀 파일을 수정한 GitHub 원본에 연결하여 V8 재실행**: `tests/case-legal-automation-lease-loss-r35.test.mjs` **9/9** 기대 일치. 처음 mock `note(database,job,kind,payload)` 인수 오류로 6/9였으며 test mock만 정정 후 9/9; 소스 영수증을 가짜 Node-native로 표시하지 않음. 회귀 파일 blob `3946e2ce77953c547031ba02aeb67db44e1b301d`.
4. **독립 Python SQLite WAL 두 연결**: A lease 만료→B 재선점→A 실패 UPDATE 0행→B 작업권 유지/거짓 감사 0→B 실패 UPDATE 1행/감사 1건: **9/9 관찰·기대 일치**. 로컬 스크립트 `round35_legal_lease_error_ack_sqlite.py`. 실 D1 worker 아님.
5. **Node-native 저장소 테스트/전체 CI·tsc·Next build: 미실행.** **Cloudflare staging D1/R2/Cron, 실제 HTTP 두 워커, 실제 n8n 운영 워크플로: 미실행.** n8n 설계 기록은 운영 실행 증거가 아님. 실제 Word/공식 법원서식/직원·변호사 승인/법원 보정 이벤트/배포: **미실행**.

## 남은 위험·다음 검증

- `A4-IT-003 / A4-DATA-004 / X-046`: 기존 poll의 구 dataVersion lease 역전 P1과 기준정보 SHA B→A head 역전은 **여전히 미해결**. PR #16만으로 기준정보 epoch/fence 해결 안 됨. #87/#91은 read/preflight 보호 후보일 뿐 head 쓰기 경합 원자성 미해결.
- `A4-AX-006 / A4-LAW-006`: 법률 작업의 `transition()` 및 POST 법률 실행의 reference/head 변경 사이 경쟁, 95개 항목 완료/부분성공/실제 사람 승인 경계 별도 종단 검증 필요. 법률상 인정값 자동 승격 금지.
- `A4-DOC-013`: 원문/갈음 철회·관할 판본 변경→quiet calculation→법률 재검토→Word 재생성→기존 직원·변호사 승인 무효화 미검증.
- `A4-IT-005 / A4-DATA-013 / X-047`: R2 성공 뒤 D1 실패·ACK 유실은 staging 실제 바이트 SHA/원장 재조회 필요. D1 오류로 ACK가 아예 throw된 경우 본 패치의 0/1 row receipt로 성공을 추정하지 않으며 별도 복구 원장 필요.
- **제품 최종 인수 0건.** 운영 배포/운영 migration/전자제출/법원 인가 확정 없음. 다른 에이전트 코드 덮어쓰기 없음.
