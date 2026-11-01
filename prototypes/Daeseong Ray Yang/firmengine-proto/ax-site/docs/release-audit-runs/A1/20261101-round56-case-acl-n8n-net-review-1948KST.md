# FirmEngine A1 56차 — 타사건 읽기 인가 · n8n 실행경계 · 사업소득 독립검수

- 기준: 2026-11-01 19:48 KST. 감사 시작 `main` SHA `0ca4c0c08861ffe9126001b452bd6d19ab147303`; 쓰기 직전 `main` HEAD `0ca4c0c08861ffe9126001b452bd6d19ab147303`.
- 역할 순환: 직전 DOC/LAW/DATA → 이번 **IT담당자/AX담당자/계산사무장**. 중앙 보드 **A1-IT-003 / A1-AX-016 / A1-CALC-014**만 처리하며 모두 **[ ] 미완료** 유지.
- 먼저 최신 main·최근 커밋/PR, 55차 영수증, 중앙 보드, `db/schema.ts`, 각 원본 함수·기존 테스트와 Draft PR #64/#66/#55/#85 내용을 읽었다. 실제 고객 문서·개인정보·OCR 정답·비밀/환경변수 사용 없음.
- 증거 수준: **GitHub 원문에서 GET/POST/선택 함수를 추출해 TypeScript 서명만 제거한 JavaScript V8 격리 실행 + 합성 의존성 및 테스트**, JSON 실파일 파싱, 일부 정적 코드 대조. 전체 Node/TypeScript/빌드/CI, 브라우저/Sites, 실제 D1·R2·n8n·Cron, 공식 서식·실무자 승인·배포는 **미실행**. 모의 응답 200/403은 제품의 실제 HTTP 결과가 아니다.

## A1-IT-003 [ ] — 외부 사건 식별자로 조회·원문 열람 차단

- 현재 `main`: `app/api/cases/[id]/workflow/route.ts` blob `5d4a0508513ca063e7f7d5486b73d7ed71066022`, `requirements/route.ts` blob `64eb0d2c6a12dfdf7f6f2889eaecdfc1fb417b2e`, `app/api/cases/[id]/route.ts` blob `a8eedd2f6109ba9a9994ee8f7fd26e08219731d5`. 합성 타사건 `case-B`, 역할 없음, 독립 기대 **403 및 case read 0**. 원본 GET 함수에 합성 서비스/응답을 연결하여 **세 경로 모두 200, 내부 읽기 1, 사건별 guard 호출 0**을 관찰. 기존 P1 재현이며 실제 외부 인증/자료 유출을 입증하지 않음.
- [기존 Draft PR #64](https://github.com/firmengine/firmengine/pull/64) `fb958528e9c2fab0eb0dab64d96c33bc00120098`의 동일 GET 함수 격리 검증에서는 역할 없는 합성 접근 **세 경로 모두 403, guard 1, 데이터 읽기 0**. 소스 blobs: workflow `8b67f34c9765cf1987c9dc22d7c8d25547ec1699`; requirements `4a5cee3092b1cd177e8ff96257bf1aa133b15699`; case `13fef255694e0857cdb7a862f2df95796f86dab7`. 해당 PR helper의 실제 권한 부여 체계는 이번에 E2E 실행하지 않음.
- `app/api/cases/[id]/documents/[doc]/route.ts` main blob `db20b9248e68d3ec412b5d3f4254254e0ffc8412`: 사건 읽기권 없는 합성 actor, `kind=original` 및 `kind=page` 각각 **기대 403/R2 read 0** 대비 **실제 격리 200/R2 read 1**, 사전 actor/role 호출 0. 페이지는 합성 DB read 1. 권한이 있는 시뮬레이션에서도 각각 200이나 본선에 권한판정 자체가 없어 승인 경계를 증명하지 못함.
- [기존 Draft PR #66](https://github.com/firmengine/firmengine/pull/66) `533440c88cde71deb22dbe4fceadaa76d1d814d0`, 문서 GET blob `8af324a14f58562e2bf8104ae2be811cbbca45e5`: 거절된 원본/페이지 각각 **403, case/DB/R2 read 0, role scope=case-B**; 허용된 원본/페이지 각각 **200, case/R2 read 1**, 총 **4/4 독립 기대 일치**. 문서 GET 8개 main·PR 조건 중 main 무인가 2개 불일치, PR 4개 모두 일치.
- `app/api/workspace/route.ts` main blob `58c8d7ba27a68f5914c07f34e2e9bb81f63b9e5f`에는 전체 사건 목록과 총건수 SQL이 존재하며 사건별 사람 인가 조건이 없음(정적). #66의 목록/총건수 SQL 사건 grant 필터는 diff 확인만 했으며 **이번에는 workspace GET/SQL을 실행하지 않음**.
- 결론: **기존 고위험 P1 경계가 main에 남음**, #64와 #66은 Draft·미병합. 두 PR 통합, 모든 사건별 GET/POST/원문/목록, 실제 권한 철회·테넌트·D1/R2/브라우저 검증 전 **인수 금지**. 중복 패치하지 않음.

## A1-AX-016 [ ] — 실제 TS API와 참고 n8n 구별

- 현재 `app/api/cases/[id]/process/route.ts` blob `e153bdb44ec7614de4cd9a9adfaf76e5e7fc4b64`, `lib/pipeline.ts` blob `79dce5f9822cf2debe1f886ab93ece4a256659e6`: POST 함수에서 TS `processNext`/`processNextBatch`/`reviewLegal`/`reconcileCase`를 직접 호출. 실제 라우트 POST 함수와 합성 current case/서비스를 연결: next, scoped next, scoped next_batch, legal, reconcile은 해당 TS handler 호출 후 200; next_batch에서 jobIds 누락 400; 합성 reference-test 사건에서 next 409 및 handler 미호출. **7/7 사전 독립 기대 일치**. 프로덕션 큐·n8n·Cloudflare 동작의 증거 아님.
- 참고 `n8n-reference/workflows/firmengine-p0.json` blob `37e7833bc3612638adb01b97e811a566e9b26e6b` 실제 JSON 파싱: `active:false`, 9노드, 기존 `127.0.0.1:8010/internal/stages/...` 6 HTTP endpoint. `law-watch.json` blob `fd63f035483a55c49ebb6ec6198bd17277c3b2cf`: `active:false`, 2노드, 예전 `127.0.0.1:8010/internal/knowledge/check`. `n8n-reference/NODE_MAP.md` blob `9573aba2351bf0f12d92a9169bd6700c96f55a93`는 이를 참고 설계로 표시.
- **현재 ax-site 직접 TypeScript 경로와 n8n 참조 JSON은 구별됨**. JSON의 `active:false`만으로 외부 라이브 n8n 상태를 확정하지 않음; n8n 접속·실행 영수증·Cron 확인 **0건**. source-only / 미관찰 상태.

## A1-CALC-014 [ ] — 사업소득 제안 금액과 승인자 독립성

- `lib/business-net-reconciliation.ts` main blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`; `tests/business-net-review-lifecycle.test.ts` blob `dc089bd14f4c07f204cde7ca4038fe49ca08410c` 확인. `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` 읽음.
- 기존 저장 승인 기록 `validBusinessNetReview` 실제 함수본문, 합성 `exactReview=true` (원천 정합성 자체는 검사 안 함), 사전 기대 7조건: 정상 독립제안/승인 허용; 동일인·공백동치 동일인·제안자 없음·승인자 없음·proposed·승인사유 없음 거절. **main 4/7**, 동일인/공백동치/제안자누락 3건 잘못 승인으로 인식. [Draft #55](https://github.com/firmengine/firmengine/pull/55) blob `7a5552d23ce2324b9238b328e8287c100b38f724`에서는 **7/7**.
- 신규 승인의 `adoptBusinessNet` 실제 함수본문, 합성 원천 검증 stub + 사업소득 월별 금액 문자열(100/10/90) + 이유/날짜, 사전 기대 5조건: 다른 actor 허용, 같은 actor·앞뒤 공백 동치·제안자 누락·승인자 공백 거절. **main 3/5**(공백동치와 제안자 누락 허용), [Draft #85](https://github.com/firmengine/firmengine/pull/85) blob `98ebec78633b93980f08ed50c508e5b12fc331b4`에서 **5/5**. #85 단독의 기존 승인 유효성 함수는 **4/7**이므로 #55와 #85 **둘 다** 필요하며 병합/결합 실행은 안 함.
- 이는 12·30·48차에 보고된 **기존 P1**, 신규 결함으로 중복 집계하지 않음. 소득 인정·세무/법률 의미에 영향 가능하므로 사람 검토·원천 Fact·현재 head·18계산·D5103/D5110·실 D1 종단 검증이 선행되어야 함. 금액 또는 법률 확정값 변경 **없음**.

## 범위와 후속

- **이번 회차 신규 코드 변경 0, 신규 PR 0, 새 확정 결함 0**. 기존 P1: 타사건 읽기 경계 및 소득 승인 독립성 재현. 기존 Draft PR #64/#66/#55/#85를 중복으로 덮어쓰지 않음.
- 정적/실행/사람승인 분리: 추출된 실제 GET/POST/함수식의 **V8 합성 테스트만 실행**. 새 프로젝트 Node 회귀 테스트 작성/실행 0, CI/TS/build 0, staging D1·R2·Cron 0, 라이브 n8n 0, 브라우저 0, 서식·변호사 승인 0. 제품 완결 승인 **0건**.
- 운영 배포·운영 D1 migration·실제 법원 전자제출·법원 인가 확정 금지 유지. 추론 모드 Extra High 실제 설정 미확인.
- **57차 순환: 서류담당자/변호사/데이터담당자**. 우선 **A1-DOC-005**(가족관계/주소/혼인/부양 변경 서류), **A1-LAW-006**(소송·압류·전부명령 출처), **A1-DATA-005**(신청인/배우자/채권자/사업자/계좌 ID 혼합 차단).
