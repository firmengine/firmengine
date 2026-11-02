# FirmEngine A4 — 76차: 이미 연결된 Word 재생의 별도 `parentArtifactId`/formResults 세대 불일치

- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내 A4 실행 흐름·예외·동시성·복구만. 운영 배포/운영 D1 migration/실제 제출/법원 인가 없음.
- 읽은 main HEAD: `882160bfd3f27d94e7e0680defb9597b436716bd` (2026-11-02 17시 KST 확인). 중앙 보드 blob: `1847b6fb4d4b7d3a99222bc62b2a7a2c22c9fc9a`.
- 실제 main blob: `lib/automatic-draft-handoff.ts` `a525e3c12672966c993f83021d5f169b170bebe9`; `lib/server-store.ts` `32350bd5045da89ea327f3c77fab6d2d19fbac56`; `lib/document-writer.ts` `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`; `lib/document-edits.ts` `1ce63e97def733e7d54b9bab3ab6c9715b95aaca`; `lib/automatic-review-draft.ts` `5ee8860250303ac9ca513b0be22e886f98c8e904`; `lib/office-writer.ts` `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`; `lib/calculator-tools.ts` `13025c1feb8f16d1c52b41ca8de35ac4b2e3c7c0`.
- 이어받음: 75차 영수증 `20261102-round75-1538KST-linked-replay-writer-digest-epoch-regression.md`; [Draft #174](https://github.com/firmengine/firmengine/pull/174)와 stacked [Draft #176](https://github.com/firmengine/firmengine/pull/176), 모두 미병합.
- 역할 순환: **계산사무장 → 변호사 → 데이터 → AX → IT → 사용자·서류**; 직접 부분 검증 ID **5개** `A4-IT-005`, `A4-DOC-011`, `A4-CALC-016`, `A4-LAW-013`, `X-047`. 데이터 `A4-DATA-013`와 AX `A4-AX-013`은 간접 인계검토. **선정 전 ID [ ] 유지**.

## 새로 확인한 별도 반례 — SHA만 해결해도 formResults는 불일치

1. `automatic-review-draft.ts`는 `prepareDocumentWrite`의 **초기 준비 영수증**을 `office-writer.ts`의 `rendered_json.metadata.writer_receipt`로 렌더한다. `finalizeDocumentWriterReceipt`는 그 후 별도로 생성/저장된다. 렌더 JSON 안의 원본 Writer receipt를 새 상태로 다시 만드는 것이 아니다.
2. 첫 생성 전 현재 `exportManifest.files`가 없으면 `document-writer.ts`의 `parentArtifactId`는 `null`. 직원 인계 `automatic-draft-handoff.ts`가 현재 artifact를 `next.exportManifest.files`에 연결하면 동일 form kind의 `parentArtifactId`는 **새 artifact ID**가 된다.
3. `document-edits.ts`의 `computeDocumentIdentity`는 `parentArtifactId`를 `artifactIdentityHash`의 입력으로 사용한다. `automatic-draft-handoff.ts::mustMatchReceipt`는 `inputSha256` 뿐 아니라 **`JSON.stringify(original.formResults) === JSON.stringify(latest.formResults)`**도 강제한다.
4. 따라서 r75에서 발견한 full-JSON 입력 SHA 세대 불일치를 임시로 회피해도, **formResults에 생성된 form이 하나 이상 있고 새 artifact ID가 현재 연결되면** 두 formResults가 달라져 `AUTODRAFT_WRITER_FORM_CONTRACT_CHANGED`를 반환하는 **두 번째 독립적 정상 재요청 차단 후보**가 남는다.
5. 보수적 해결 원칙: 원본 Writer input generation/receipt의 불변성을 지키고, 링크 이후 최신 현재 판본·승인세대·현재 Manifest·SQL artifact·R2 byte SHA·CAS를 별도 인계세대로 확인. 원본 SHA를 덮거나 단순히 formResults 비교를 제거하면 안 됨. 한 단계의 `parentArtifactId` 변화는 새 문서 재생성과 직원/변호사 승인 유효성 판단과 구별해야 함.

## 독립 입력·기대·관찰 — 합성 재현만

- 입력: 실 고객값 없는 `case-SYN-R76`, revision=3, 빈 문서/사실, 기존 `exportManifest` 없음, Word form kind `application`, 새 current artifact `artifact-SYN-R76`, 고정 reference SHA. 두 `node:sqlite` WAL 연결 및 동일 revision의 `storage_token` 교체를 사용.
- 기대: 동일 유효 링크의 ACK 유실 후 재시도는 새 Word 생성·계산 재실행 없이 **SQL/R2/불변 Writer 증빙 + 현재 사건·Head/승인세대/Manifest**가 입증된 경우에만 읽기전용 재사용 가능. 현재 원문/법률 변경은 상충; R2 503·timeout은 **미관찰**, 파일 없음은 **누락**, 실제 바이트 불일치는 **상충**. 법률 승인으로 승격 금지.

| 합성 조건 | 실제 로컬 관찰 | 판단 |
|---|---|---|
| 최초 Writer receipt, 현재 form parent 없음 | `parentArtifactId=null` | 최초 작성세대 |
| 직원 링크 완료, 같은 revision | 저장 JSON SHA 변경; form parent=`artifact-SYN-R76` | 별도 인계세대 |
| 기존 #174/#176 재조회 수작업 전사 | `INPUT_CHANGED:inputSha256` | r75 회귀 재확인 |
| **비교용 inputSha256만 원본과 같게 치환** | **`FORM_CHANGED`** | 새 독립 차단 원인 |
| parent만 변경 | 합성 form identity SHA 달라짐 | form ID 변경 의존 |
| 원본과 동일 영수증 | `MATCH` | 정상 비교 대조 |
| 합성 원본 사실 추가 | Writer 원본 SHA 변경 | 기존 재사용 허용 불가 |
| SQLite 워커 A link COMMIT, ACK 유실 모사 | revision 3 유지·token 변경·Manifest 저장 조회 | 재조회 필요 |
| SQLite 워커 B 구 token CAS | 변경 0행 | 경합 차단 합성 |
| R2 503/NULL/바이트 변경 분류 | `UNOBSERVED/MISSING/CONFLICT` | 실 네트워크 주입 아님 |

- 로컬 Node `22.16.0`, 신규 `linked_replay_parent_artifact_epoch.test.mjs` **13/13 기대관찰 일치**, 이전 r75를 함께 재실행하여 **25/25 기대관찰 일치**, 실패 0·skip 0. 음성 대조 포함하므로 제품 안전성 통과 숫자가 아니다. 신규 시험 SHA-256 `d2ba5f860fd916868d9daaf9b8876e06a5a81ad3f6738839311a3dfaf072331f`, 출력 SHA-256 `fa73e599f629e098cd6d87ae22735df727c910448c3a9656e24aa994aa9a6808`, r75+r76 회귀 출력 SHA `dd474f65fe08fd10b0767335f5a068f1514a18a937af7a0832f569c0795e8b7b`.
- 위 테스트는 실제 GitHub 코드의 관련 표현/분기 순서를 **수작업 전사한 독립 합성시험**이다. `prepareDocumentWrite()`/Next route 자체 import 실행, 실제 DOCX 생성, 저장소 CI, 실제 R2 GET·D1 ACK 유실·HTTP 두 워커·Cron은 **미실행**.

## 분리해야 할 운영 인수 상태

- `0`: 합성 SQL CAS 변경 행 0 및 시험 실패 0 (운영 사건 수가 아님).
- `null/누락`: 영수증/파일/캐시 증빙이 관찰되지 않은 것; `미관찰`: 실제 D1/R2/Cron/HTTP 503/timeout을 실행하지 않은 상태; `상충`: 합성 판본/해시/parent ID의 불일치.
- `source-only`: #174/#176의 미병합 수정 후보. `승인전`: 직원·변호사 승인/공식 서식 적합성 미확인. `비해당`: 법원 인가/전자제출 확정 처리 금지.
- n8n 설계 문서와 실제 운영 workflow 실행은 별개. 이번 실행에서 운영 n8n 확인/호출 **미실행**.
- 상담→서류→OCR→10분 quiet calculation→95법률→Word→직원·변호사 승인→실제 보정 이벤트의 실제 종단 stage·CAS·승인 인계 **미실행**.
- 기타 요구 시나리오(중복 웹훅, 원문 변경, 갈음 철회, 관할판본 변경, 마감 미확정, 429/503/timeout, R2 성공 후 D1 실패)는 이번 회차 운영 검증 **미실행**. 과거 합성 기록을 제품 통과로 승격하지 않음.

## 후속

- **병합 보류:** #174/#176은 기존 input SHA mismatch 외에도 current Manifest parent linkage로 인한 Writer formResults 차이까지 해결해야 함. 본 회차는 고위험 receipt/법률 판본 의미를 직접 변경하지 않음; 두 PR에 리뷰 의견 남기고 별도 설계·실무 승인 필요.
- 우선 다음 ID: `A4-IT-005`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-047`. 원본 출처 판본/현재 인계 세대 분리, 링크 전/후 실제 `prepareDocumentWrite` replay, SQL/R2 증빙 확인, 운영과 분리된 staging D1/R2 복구 시험, HTTP 2-worker, Word 재생성 및 기존 승인 무효화.
- 이번 직접 선정 최종 인수 **0/5**, 전체 최종 인수 **0건**. 공개 Git에 고객정보·원본 OCR·키·비공개 정답 없음.
