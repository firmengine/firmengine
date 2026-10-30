# FirmEngine A1 12차 — export 재시도·증빙 역질문·사업소득 독립 승인

- 날짜: 2026-10-30 KST. 역할 순환: 직전 DOC/LAW/DATA → **IT `A1-IT-014` / AX `A1-AX-013` / 계산사무장 `A1-CALC-014`**.
- 최초 확인 `main`: `e40bee642a77c556b7459365c665231d7594925b`. 수정 분기 기준: `fd1381c44c63c1731ee6c7e38c5c89107b1d730d`. 영수증 직전 main: `fd1381c44c63c1731ee6c7e38c5c89107b1d730d`.
- 기존 11차 영수증·중앙보드·최근 커밋 및 다수 Draft PR(#24/#28/#32/#49/#52/#53/#54), Drizzle `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, 실제 명령 `lib/case-commands.ts` `d18c555f04f65687c509a8e8d35aba4bb3597378`, 계산 `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, 관련 단위 테스트 및 화면 코드를 확인. 기존 A1 11차에서 이관된 3 ID를 모두 후속 검토.
- 세 ID 모두 **[ ] 부분검증**, 제품 인수 완료 0. 공개 Git에 가상 사건/가상 값과 코드 테스트 기술만 사용. 실제 고객 문서·개인정보·키·원문 OCR 적재 없음.

## A1-IT-014 — 생성·timeout·재시도 중 artifact 보존 (기존 P0 재현)

- 실제 main 소스: `lib/export-artifact-transaction.ts` blob `a114235e5b5de57b5ae58b41026f939ee8543174`, 일반 Export API `app/api/cases/[id]/export/route.ts` blob `4f9384e840517455cdec25f0fa734b593d31e533`, 자동초안 `lib/automatic-review-draft.ts` blob `5ee8860250303ac9ca513b0be22e886f98c8e904`. 같은 helper 호출 경로를 확인.
- 실제 main helper 함수 본문에서 TypeScript 타입 구문만 제거해 V8 실행, 합성 record `synth-art-1`, object key `cases/synth/artifacts/synth-art-1`, bytes `[1,2]`. 독립 기대: 정상 commit 보존; 업로드가 기록 후 오류면 회수; manifest **커밋 후 ACK가 유실되면 이미 참조된 원본과 행을 삭제하지 말아야 함**; commit 후 감사 로그 실패 시 보존.
- 관찰 **5조건 실제 실행**: 정상 커밋→SQL 1/R2 1/manifest 1; 업로드 후 예외→0/0/0; SQL 기록 후 영속화 실패(실제 DB 커밋하지 않았다는 합성 가정)→0/0/0; **manifest ACK 유실→SQL 0/R2 0/manifest 1 [P0 불일치]**; commit 후 이벤트 오류→SQL 1/R2 1/manifest 1. **실제 네트워크 abort/Cloudflare D1/R2가 아니라 합성 장애 주입**임을 명시.
- 4차에서 이미 발견된 **같은 P0**이므로 신규 집계하지 않음. [기존 Draft PR #24](https://github.com/firmengine/firmengine/pull/24)는 ACK 불확실 때 삭제 대신 보존하도록 제안 중, 아직 main 미병합. 충돌 방지를 위해 같은 파일 재수정 없음. 확정 실패 후 임시 고아 파일의 reconciliation/retention, 요청 취소/중복 idempotency 영수증 E2E 여전히 필요.

## A1-AX-013 — 누락 증빙 → 사람 질문 및 서류요청 연결

- main `lib/approval-issue-graph.ts` blob `53df46fa1fcf34e19d8e9a192da1a8f87bf897cd`, `lib/intake-engine.ts` blob `82ddba689ea6d107ba587235205feef45e058527`, `lib/intake-types.ts` blob `24788d5edc77d7af97e105992d381d44064cf8e2`, `components/consultation-checklist.tsx` blob `7748c02bf64c5162efe213939ce24cd20a74a923`.
- 실제 `buildApprovalIssueGraph` 함수에서 TS 문법만 제거하고 V8 실행. 독립 합성 계약 `R-syn`, 승인된 canonical `CANONICAL-A`, 계산 출력 `monthlyIncomeWon`. **4/4 기대일치:** 원문 미관찰+null 계산→사람 질문 2·계산 누락 1; 원문 있으나 미인정+계산값 0→증빙 검토 질문 1·계산 누락 0; 증빙 인정+계산값 0→질문 0; 승인되지 않은 증거계약→법률상 필수 요청으로 승격하지 않음(질문 0, route unmapped).
- `intake-engine`에는 상담 상태 unknown/conflict/legal_review 질문 생성, `consultation-checklist`에는 질문 표시·복사(새 상담으로 재분류 안내), `case-requirement-monitor`는 workflow 서류 요청을 별도 투영. **그러나 이번 실행은 이 세 모듈 간 실 API/DB 명령·자동 추가요청 연결 E2E를 확인하지 못했음**. 질문 생성 코드 존재를 실제 발급 요청·고객 전송과 동의어로 표시 금지. 법률상 필수 증빙 확정 없음.

## A1-CALC-014 — 직원 제안/출처/변호사 승인 독립성 (새 P1 수정 Draft)

- 실제 main `lib/business-net-reconciliation.ts` blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`, 테스트 `tests/business-net-review-lifecycle.test.ts` blob `dc089bd14f4c07f204cde7ca4038fe49ca08410c`. 코드에서 `adoptBusinessNet`는 `record.proposer===actor`를 거절하지만, 이미 영속된 기록을 판정하는 `validBusinessNetReview`는 reviewer 존재/검토 사유/시간/exactReview만 검사하고 **proposer!=reviewer는 재검증하지 않음**. `reviewedBusinessIncomeIds`가 이를 소비하고 `assessment.ts`가 계산에서 사용.
- 독립 기대: 자기 제안+자기 승인 과거 기록·공백 변형 이름은 **현재 승인으로 인정하지 않음**. 서로 다른 직원/변호사 승인만 현재 계산 인식 후보. `exactReview`를 항상 true로 제공하여 **인적 승인 경계만 분리**한 실제 main 함수 본문 V8 6조건: 기존 **3/6 기대 일치**, 자기승인/공백 동일인/제안자 누락 **3 false-accept**; 수정 후보는 **6/6 기대 일치**(정상 독립 승인 유지).
- 수정: [Draft PR #55](https://github.com/firmengine/firmengine/pull/55), 브랜치 `audit/a1-r12-business-review-independent-20261030-2350`, 코드 commit `b695452578f7659b176db46d83153eebeef11356`, 테스트 commit `c886e591c4d9ee4dc65acd391cdea97a3bc57f64`. 과거 검토 기록 삭제 없이 `validBusinessNetReview`에서 정규화 actor 독립성 검사, 합성 테스트에서 같은 제안자/승인자와 공백 alias의 인정 차단 및 서로 다른 actor 정상 유지 검증 시나리오 추가.
- **실제 원본 프로젝트 Node 회귀/CI/타입/빌드/SQLite/D1, 계산→D5103/D5110 공식서식 E2E는 이번 실행 없음**. 새로운 Node 테스트는 **작성만**, 함수 경계 V8 검증만 실제 실행. 금액·법률 인정 의미에 영향이 있으므로 별도 Draft PR, 변호사·계산사무장 실무 검수와 전체 회귀 전 main 병합 금지.

## 실행층 구분 및 다음

| 계층 | 결과 |
|---|---|
| 최신 main/코드/blob·스키마·기존 테스트/최근 PR | 확인 |
| 실제 main 함수 V8 합성 | IT 5조건(ACK 유실 P0 재현), AX 4/4, CALC 수정전 3/6·수정안 6/6 |
| GitHub 코드 변경 | Draft PR #55 2파일, 지정 ax-site/ 경로만; main 제품 코드 미변경 |
| 전체 Node/CI/build·브라우저·staging D1/R2/Cron | 미실행·미인증 |
| 실제 고객 서류·공식 법원서식·변호사 승인·사이트 배포 | 미실행·미인증 |

다음 A1 역할 순환: **서류담당 `A1-DOC-011` 갈음 A←B+C의 B만 제출 / 변호사 `A1-LAW-014` 50규칙·46예외 상충 / 데이터담당 `A1-DATA-004` 동일 OCR ID 복수행 last-wins**. 문서 역할을 변환하지 말고, 화면→API→D1→후속 계산/서식까지 합성/실행 가능한 경계마다 별도 영수증. PR #55의 병합/운영 반영 승인 금지.
