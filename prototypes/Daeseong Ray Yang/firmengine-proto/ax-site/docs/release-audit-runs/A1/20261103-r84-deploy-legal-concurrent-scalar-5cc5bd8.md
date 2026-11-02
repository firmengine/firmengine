# FirmEngine A1 — 84차 코드 완결성·기능충돌 감사 (2026-11-03 KST)

- **범위:** firmengine/firmengine main 내 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 83차 다음 ID인 A1-IT-017 / A1-AX-012 / A1-CALC-010, 역할 IT → AX → 계산사무장 순환.
- **읽기 시작과 작성 전 main HEAD:** `5cc5bd83948461cbdfb0289531e5de4c57bbd0b9`. 중앙 보드 blob `7126ef0642a2ffcb2cff62d800e7730279bcb6c5`, 972줄. 최근 A4/A3/A2 r84 커밋 8건 및 열려 있는 Draft PR #42/#121/#191 등 조회.
- **소스:** `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `package.json` `8129160e33af3ae250c757a6a8195a29674ad031`; `lib/pipeline.ts` `79dce5f9822cf2debe1f886ab93ece4a256659e6`; `lib/luna.ts` `e8ad1246888e42087cf94ef792c8285cae2541d1`; `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`.
- **기존 영수증/테스트:** A1 8·28·48·83차 영수증, `tests/case-calculation-feature-store.test.ts` blob `844525d8633442d571ced2c48ed5bd00ba7bb5a0`, 기존 PR #42 `pipeline.ts` blob `f9489b3c413158bd773f7124c382277b8460946c` 및 helper blob `811c2841b68012a024c99b806e7ab6febeae97cd`, PR #121 `case-calculation-feature-store.ts` blob `aa9a1f53519831c5bc571cdaa9cd3a53267bcea6` / 테스트 blob `8e91f437b303f438cad6eaa92446058bbb8b2b69`. 세 PR 상태는 조회 시 Draft·미병합.

## A1-IT-017 [ ] — 2026-10-29 v43 보관본과 현 main 소스 비교

**독립 기대:** 과거 v43 snapshot, 현 Git main, **현재 실제 배포판**, 운영 DB 스키마와 활성 기준정보 SHA가 모두 동일한 판본임을 입증하기 전에는 일치·배포 합격 판정하지 않는다.

- 원본 `docs/releases/ax-v43/deployment-receipt.json` blob `5cf3179d2ff429bbda8b879d8aa1f8bbbc31ff51`, `captured_at_utc=2026-10-29T03:13:08.337Z`, 과거 `source_commit=72b23f2c3faee5656caeeb1e6e6afce9a65de3cb`, `version_number=43`. 보관된 과거 영수증의 배포 성공은 **현 배포의 검증이 아님**.
- 528개 파일의 `source-file-manifest.json` blob `dec7460fd44424ba462618af1a215fc12b5c5230`를 파싱하고, 지정된 10개 경로의 `source/` Git blob을 **현재 main 개별 fetch_file SHA**와 비교.
- **실제 관찰 10건:** 일치 **2** (`lib/reference-release.json` blob `5537e47c163fb87447f51560e1433866d67faf76`, `app/api/cases/[id]/documents/route.ts` blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`); 불일치 **6** (`db/schema.ts`, `package.json`, `lib/pipeline.ts`, `lib/luna.ts`, `lib/domain.ts`, `lib/assessment.ts`); v43 보관 목록에 없던 현 main 파일 **2** (`app/api/cases/[id]/commands/route.ts`, `lib/case-calculation-feature-store.ts`).
- **판정:** 당시 v43 snapshot과 현 main은 위 10개 기준 동일판본 **아님**. 하지만 **현 사이트가 여전히 v43인지 자체 미관찰**, 현재 운영 배포 소스 SHA, staging/운영 D1/R2 기준정보·스키마 SHA를 조회하지 않았으므로 운영 배포 불일치나 장애로 단정하지 않음. 코드 변경 없음. **[ ]**.

## A1-AX-012 [ ] — 법률 모델 이벤트 오류·동시 요청의 재호출

**방법:** GitHub 실제 `reviewLegal` TypeScript 함수 **본문**을 분리해 타입 문법만 제거하고 V8에서 실행. 외부 모델, `db().prepare`, `event`, sourceVersion, 정책, 스냅샷 해시, 모델 사용량은 개인정보 없는 합성 stub. 동일 사건 ID / revision 2 / source dataVersion 4 / 동일 input·reference SHA / 위험 ID 1개 고정. 의존성 stubbing과 실제 제품 Node·D1·모델 호출은 구분.

| 합성 실행 | 독립 기대 | main 실제 관찰 | 기존 Draft PR #42 실제 관찰 |
|---|---|---|---|
| 모델 응답 후 첫 `model.call` 이벤트 기록 실패, 같은 판본 재호출 | 이미 완성된 모델 결과를 보존하여 재호출 경로 막기 | **모델 호출경로 2회 / 분석 INSERT 1회 / 최초 오류 1회** | **호출 1회 / INSERT 1회 / usageEventWriteFailed=true** |
| 정상 첫 응답·저장 이후 같은 판본 재요청 | 모델 추가 호출 0회 | 전체 **1회 호출 / 1회 INSERT**, 재요청 `legal_complete` | 동일 |
| 동시 요청 2개가 모두 기존 분석 0건을 읽고 모델 응답 전에 겹침 | 단일 원천·revision·입력 지문에 중복 요청 차단 또는 비용 사용 대기 상태 | **모델 호출경로 2회 / 분석 INSERT 2회** | **2회 / 2회** |

동시 실행은 두 모델 stub의 barrier로 **두 요청 모두 SELECT 후 INSERT 이전**에 진입하도록 강제해 재현. sourceRevision/sourceVersion/release hash는 변하지 않았으며 각 요청의 `analysis`가 별개 저장됨. **PR #42는 보조 로그 이벤트 실패에는 유효하지만 동시 요청 lease/outbox/원장 unique-key를 보장하지 않음.** 두 번 유료 응답을 받을 수 있는 **P1 경로 후보**, 실제 OpenAI 과금이나 운영 중복 저장의 증거는 아님. 외부 통신 timeout 응답 유실, 재시작, worker lease 및 분석 INSERT ACK 불명은 미검증. 새 위험 설계/병합은 하지 않고 별도 Draft 설계·IT/AX 전문가 검토 필요. **[ ]**.

## A1-CALC-010 [ ] — computed/missing/blocked 구분 및 비유한 수

**방법:** GitHub 실제 `statusOf`와 `conflict` 함수 본문을 V8 격리 실행. `engineStatus`/`reasons`/`value`를 20개 합성 조건으로 제공하고, 독립 기대 상태와 개별 대조.

- **20개 조건:** 0(숫자/문자), 음수 -12(숫자/문자), 양수, null, undefined, unknown, blocked+null, source CONFLICT+0, DISPUTED+0, not_applicable+0, provisional+숫자, NaN, +Infinity, -Infinity, 빈 문자, 공백 문자, blocked+빈 문자, blocked+음수 값.
- **main 14/20 기대일치**. 반례 **6건**: NaN/+Infinity/-Infinity는 computed(기대 blocked), `""` / 공백 문자는 computed(기대 missing), `engineStatus=blocked` + `value=""`는 provisional(기대 blocked).
- **기존 PR #121 20/20 기대일치.** 명시적 0·음수는 측정 또는 산식 값으로 남기되 **법률 승인 의미는 아님**; null/unknown=missing, conflict와 not_applicable은 서로 독립 상태. `JSON.stringify(NaN)`와 `JSON.stringify(Infinity)`가 모두 `null`이므로 main이 computed라 기록하면 직렬화 시 상태/값 의미가 어긋날 수 있음.
- 이번에 실계산 엔진 18개 전체나 `persistCaseCalculationFeatures`의 실제 D1 batch/서식 저장 경로를 실행한 것은 **아님**. 기존 Draft PR #121과 신규 P2 패치 중복 작성 없음. **[ ]**.

## 조치·인수 경계

- 이 회차 제품 코드 수정 **0건**, 신규 PR **0건**, 운영 배포/D1 운영 마이그레이션/전자제출/법원 인가 확정 **0건**. 기존 Draft PR #42 / #121 유지. 새로 확인된 동시 법률 review **P1 경로 후보**는 별도 설계·review 필요.
- 실제 고객 문서/개인정보/원본 OCR 내용/.env/키/비공개 정답 **미사용·미기록**. 모델 호출은 합성 stub이므로 실제 중복 청구액 산정 불가.
- GitHub에서 읽은 **실제 원본문 V8 합성 실행**, **과거 보관본/현 main SHA 비교**, **코드 존재**, **전체 Node/TS/lint/build/CI**, **실제 staging D1/R2/Cron**, **공식 법원 서식·변호사 승인**, **사이트 배포**는 독립 판정. 전체 종단 인수 **0건**.
- 모든 체크 ID `[ ]` 유지. 다음 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**, 보드의 미완료 ID `A1-DOC-001 / A1-LAW-002 / A1-DATA-001`. 상담→서류→OCR→18계산→95법률→법원보정 전체 E2E, 85서류/갈음 A←B+C/복수행/C01-C02-C04/동시 사건은 이번 회차 **미실행**. Extra High 모드의 실제 설정 여부 확인 없음.
