# FirmEngine A1 61차 — 문서등록 감사 일관성 · 배우자 재산 · 원본 포인터

- 기준 시각: 2026-11-02 KST. 60차 IT/AX/CALC에서 이번 회차 **서류담당자 / 변호사 / 데이터담당자**로 전환.
- 시작 main HEAD: `4b21ca61a50aac808313f667c73ab7675fb382bb`. 이 회차가 읽은 단일 보드 blob: `72178121bf5f5394301c71e2d907d23e7b19ac8f`.
- 작업 범위: 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. A1 **DOC-007 / LAW-008 / DATA-007**, 모두 **[ ] 미인수**. 이전 60차·25차(A1 DATA)와 A4 원본 업로드 감사 및 최근 커밋/PR, 관련 소스/스키마/기존 테스트를 실제 조회.
- 분리 기준: 코드 존재, 원본문 V8 합성, Git blob과 동일한 Node SQLite 테스트, 전체 CI, staging D1/R2/Cron, 브라우저, 실제 법원 서식, 변호사 승인 및 배포는 각각 별도 단계. 이번 회차는 앞의 격리 검증까지만 수행.

## A1-DOC-007 — 동일 파일 중복·철회·재업로드 및 감사 누락

**원본 main 소스/해시:** `app/api/cases/[id]/documents/route.ts` blob `274f7a6e73988ca254607422d2ff2cddd1326ac0`; `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`. 실제 POST/retractDocument 함수의 TypeScript 선언만 제거해 V8에서 **합성 D1/saveCase/event 어댑터**에 주입하여 실행. 데이터는 SHA 'a'×64/'b'×64/'c'×64, `case-synthetic`, 페이지 2/1, 임의 `synthetic-doc-*`만 사용.

| 합성 사건 | 독립 기대/관찰 | 판정 |
|---|---|---|
| A 신규 2페이지 등록 | HTTP 201, 신규 문서·2 page_jobs·감사 이벤트 1건 | 기대 일치 |
| 동일 A/2페이지 재등록 | HTTP 200 idempotent, 원본 문서ID 유지, 새 event 없음 | 기대 일치 |
| 동일 SHA지만 1페이지 신고 | HTTP 409 | 기대 일치 |
| 다른 SHA B 등록 | HTTP 201, 독립 문서 ID | 기대 일치 |
| `retractDocument(A)` 후 동일 SHA A 재등록 | 철회된 A는 deleted 유지, HTTP 201 새 문서ID | 기대 일치 |
| C 등록 후 `document.registered` 이벤트 INSERT 합성 실패 | **HTTP 500인데 C 문서 및 page_jobs는 이미 저장, 감사 이벤트 0개** | **P1 후보 재현** |
| 실패 뒤 동일 C/1페이지 재시도 | HTTP 200 idempotent, C 문서 유지, 누락 감사 이벤트 여전히 0개 | **P1 후속 재현** |

7개 경로는 원본 코드 예상동작과 일치했지만, 마지막 두 경로는 **제품 인수 실패**이다. 법률 기록의 사실 인정이나 운영 장애 발생을 의미하지 않는다. 서로 다른 사건 ID 간 공유 SHA의 전역 중복 차단 여부, 실제 D1 동시 요청·문서 삭제/복원·R2 원본 교체는 미검증.

**코드조치:** 별도 브랜치 `audit/a1-r61-document-registration-audit-20261102`, [Draft PR #147](https://github.com/firmengine/firmengine/pull/147) (미병합). `lib/document-register-audit.ts`를 추가해 사건 revision/storage_token과 등록된 문서ID·SHA·페이지 수의 조건부 `document.registered` INSERT를 만들고, `lib/server-store.ts::saveCase`의 기존 D1 batch에 사건 UPDATE와 함께 삽입. 문서 등록 POST의 독립 `event()` 호출 제거. 문서 등록과 감사 이벤트가 동일 D1 transaction에서 성패를 같이 하도록 제안함. 이 경로의 법률 판단·산식 내용 변경 없음.

**실제 회귀:** GitHub 브랜치에서 읽은 `lib/document-register-audit.ts` blob `2a47a99f62fc22e3c7e456e5b5db67633d60cb82`와 `tests/document-registration-audit-r61.test.ts` blob `0eb4815decd4a3170b4799dca1f477bf6630be5f`를 로컬 테스트 복제본 `git hash-object`로 **각각 정확히 동일 확인**. Node v22.16 `node --experimental-strip-types --experimental-sqlite --test tests/document-registration-audit-r61.test.ts` 실행 **3/3 PASS**: 정상 사건/head/doc 일치, 구 revision·token·다른 문서·SHA·페이지수 5부정 조건, 단일 SQLite transaction의 이벤트 중복키 실패에 따른 사건UPDATE rollback. **실제 API POST→saveCase 통합 실행/Cloudflare D1 batch/전체 프로젝트 Node/tsc/CI/빌드/브라우저는 실행하지 않았다.** 따라서 PR은 Draft 유지.

**Draft PR HEAD:** `ca700a3370362a2d46720d4ff535ffbe6dbeca0a` (4 files, 모두 ax-site 내부). 코드 blob: POST `2690943d47e759619ad8e1b4e905adf02155adab`, server-store `0b1da3f8db6d47c43ff2f7eafe8f81f775f4f8de`, helper `2a47a99f`, 테스트 `0eb4815d`. HEAD와 mergeability는 실제 리뷰 및 CI 전 별도 점검 필요. 최근 동시 에이전트의 `server-store.ts`/document route 변경 덮어쓰기 금지.

## A1-LAW-008 — 배우자 재산·명의신탁·면제재산의 조사와 확정 분리

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: JSON 실제 파싱, `WF-29` 배우자 재산 원천 문서/이전경위 문서 별도 요구, `legalReviewRequired=true`, 배우자 재산 절반 자동 합산 금지. `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`: `EL-37`의 면제재산 신청·결정·법정근거 필요 및 `protectedValue` 수기값만으로 면제 법적 인정 불가 명시. 위 정적 조건 **6/6** 기대 일치.
- `lib/assessment.ts::liquidationContribution` main blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`의 실제 계산 함수본문(TypeScript 타입/nonnull 표기만 제거, 의미 보존) V8 격리 **7/7** 독립 산술/경계 기대 일치. 합성 1억 자산/2천만 담보상환/5백만 비용/1천만 보호값/100% 지분 → 잔여 6,500만원. 평가근거 공백/보호액 null은 결과 null; 공동 50% 지분 담보 귀속범위 unknown 또는 원천 미연결은 null; 원천만 연결/미승인 시 잔여 1,500만원은 provisional 이유 포함; 원천 검토 완료 조건은 산술 1,500만원(법률 승인 아님).
- 위 `protectedValue=1000만원`은 **가상 숫자 입력이자 산술 예시**, 법원이 법정 면제액으로 인정했다는 뜻이 아님. `EL-37`도 지역/권리유형/신청·결정/적용일 자동 대조 미구현을 명시한다. 법률상 명의신탁/면제 인정·변호사 승인·법원 확정·실제 D5101/D5110 종단 전부 미검증. **[ ] 유지**.

## A1-DATA-007 — 원본SHA / D1 문서 행 / R2 객체 포인터

- `app/api/cases/[id]/documents/[doc]/route.ts` main blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`. 원본 PUT의 실제 CAS/update/재조회/cleanup 소스 조각(TypeScript generic만 제거)을 합성 D1/R2 어댑터에 연결해 V8 실행.
- **4/4 코드 분기 실제 관찰:** 정상 ACK → D1 포인터 새 key/R2 보존; 다른 업로드 선승자 동일 SHA → idempotent/이번 임시 key 삭제/승자 보존; **D1 COMMIT 후 driver ACK만 유실** → API 500, **D1 pointer=new key인 채 R2 new key 삭제**; 다른 SHA 선승자 →409/임시키 삭제. 세번째는 독립 안전 기대인 '승자 객체 보존'에 **불일치/P0**.
- 이미 [Draft PR #23](https://github.com/firmengine/firmengine/pull/23)에서 보수적 readback 및 불확실 키 보존을 제안했고, A4 3차(2026-10-30)에서 같은 원인을 별도 재현했으므로 **신규 결함/신규 패치로 중복 집계하지 않음**. 기존 A1 25차는 D1 pointer CAS 단독 SQLite 5/5였다. 이번에도 **실제 R2 bytes==SHA==D1 pointer E2E 미실행**, 원본 GET 인가 [Draft #66](https://github.com/firmengine/firmengine/pull/66) 미병합. 감사와 원본 SHA는 법률상 사실값·개인정보 확인과 별개다.

## 종합/인수/차회

- 신규 P1 후보 **1영역**(문서 등록+이벤트 원자성) / 신규 Draft PR **#147** (미병합), 기존 P0 **1영역 재현**(#23), 3개 ID 모두 **미완료([ ])**.
- 현재 결과는 문서 등록·원본 upload·자산 산술 등 개별 경계의 합성 검증이고, 상담→85문서·갈음 A←B+C→OCR 복수행→정규화→18계산→95법률→직원 문안→변호사→보정명령 전체 플로우는 실행하지 않음. 단계별 원문 미관찰/null/0/비해당/상충/source-only/승인전 별도 유지. 어떠한 값도 사람 승인 없이 확정하지 않음.
- 새 PR은 Node/TypeScript 전체 빌드·CI/테스트, staging D1 원자 rollback/동시 등록/ACK 유실 및 R2 포인터 정합성, 다른 Draft PR과 파일 충돌·실무자 리뷰 후 판단. 운영 배포/운영 D1 migration/실제 전자제출/법원 인가 없음.
- 다음 A1: **IT담당자·AX담당자·계산사무장**로 전환하여 **A1-IT-006**(상하위 문서 철회/85종 상태), **A1-AX-001**(모델 라우팅), **A1-CALC-017**(계산 실패 후 문서/법률 모델 오시작 차단)을 각 축 중 미검증 체크로 우선 조사. 실제 추론 실행 모드가 Extra High로 제어되었다는 증거 없음.
