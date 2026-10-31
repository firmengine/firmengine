# FirmEngine A1 30차 — 공개 소스 경계·사람 승인·사업소득 독립 채택

- 감사일: 2026-10-31 KST. 착수 `main` HEAD: `ad7cbf45310c1af0a9909ef7b0495548540908e9`; 영수증 작성 직전 HEAD `ad7cbf45310c1af0a9909ef7b0495548540908e9`. 본 영수증은 현재 배포판 인증이 아님.
- 검토 ID: `A1-IT-018`, `A1-AX-011`, `A1-CALC-014`. 전회 서류/법률/데이터 → 이번 IT/AX/계산사무장 역할 순환. **모두 [ ] 미완료**.
- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만 조회·수정. 공개 저장소에는 실제 고객정보·문서/원본 OCR·정답·키/.env를 추가하지 않음.

## 최신 main·관련 PR·스키마·영수증 확인

- GitHub `main` branch 조회, 최근 커밋 및 열려 있는 PR #84/#83/#82/#81/#80과 기존 #55 확인. A1 29차 영수증과 단일 보드, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6` 읽음.
- 원본 `lib/business-net-reconciliation.ts` blob `60a4fc295943dce404a7f99efffe88f58dd2d4ff`, `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`, `lib/case-command-contract.ts` blob `4bcae36d910c50db4181f015a952a3060e4189ed`; 기존 `tests/business-net-review-lifecycle.test.ts` blob `dc089bd14f4c07f204cde7ca4038fe49ca08410c` 읽음.
- 관련 저장구조: 사건/영수증/이벤트/원천 및 계산 구조는 스키마에 선언됨. 이번 테스트는 DB를 실행하지 않음.

## A1-IT-018 — 공개 번들 및 비공개 자료: source/tree-only 부분검증

- 현재 `main`의 `ax-site` Git tree SHA `767f7fc9122069c12ec2be26832e354a1d70986d`를 recursive 조회: tracked blob **954개**, `truncated=false`. `public/`에는 favicon, 18개 DOCX 템플릿, 설명 및 공개 목록 JSON이 있음.
- Tracked path 기준 .env/.pem/원본 PDF/실제 추출 결과·개인 키 파일명 없음; `.gitignore` blob `a5f4c151c0cb1a60a2ecb18f5fbb2b86b3066054`에 .env*, .dev.vars*, *.pem, 비공개 평가/샘플/업로드 경로 제외 확인. **이 결과는 파일명·선택 소스 범위만의 음성 신호이지 무유출 증명은 아님.**
- `private/release-review/` 아래 리뷰 문서 3개는 **공개 Git에 추적 중**이며 `.gitignore`의 `/private/` 전역 제외는 없음. 3파일 전체에 한정한 이메일/휴대전화 형태·private key 블록·선택된 env key 이름/비공개 정답 키워드 검사에서 검출 0건. 실제 개인정보 또는 비공개 정답의 노출 **확정 아님**. 폴더의 'private'라는 이름만으로 민감 파일이라고 단정하지 않음.
- 실제 컴파일된 `.next`/`dist` 또는 운영 사이트의 JS chunk, 브라우저 network payload, R2 서류 다운로드 응답, DOCX 바이너리 내 숨은 값은 검사하지 않음. **[ ] 유지**.

## A1-AX-011 — 독립 사람 승인 경계: 기존 문제 + 신규 정규화 반례

- `case-command-contract.ts`는 클라이언트 actor/role 입력을 금지하고, `case-commands.ts`에서 `business.net.adopt`는 `lawyer_review` 서버 권한을 요구함. 이는 정적 코드 연결 확인이며 실제 인증 토큰/브라우저/API E2E 검증이 아님.
- 하지만 채택 함수 원문 `adoptBusinessNet`는 `record.proposer===actor` 문자열 그대로 비교함. 합성 제안자 `A`와 법률검수 actor `" A "`가 동일인 공백 동치임에도 승인 객체가 만들어짐. 프로포저 빈 문자열을 가진 구판본 입력도 승인 단계로 진입 가능함(내부 원본 검증은 결정적 stub).
- 실제 `adoptBusinessNet` 함수 **본문**을 GitHub `main`에서 추출, TypeScript 국소 선언만 JS로 변환하고 `exactReview`/index/date/money helper를 명시적인 결정적 stub로 대체하여 V8 실행. 합성 5조건의 기대/관찰:
  1. proposer A / actor A: 거절 / main 거절 / 수정 거절.
  2. proposer A / actor 공백 포함 A: 거절 / **main 허용** / 수정 거절.
  3. proposer A / actor B: 허용 / main 허용 / 수정 허용.
  4. actor 공백만: 거절 / main 거절 / 수정 거절.
  5. proposer 빈 값 / actor B: 거절 / **main 허용** / 수정 거절.
- **main 3/5, 후보 5/5** 독립 기대 일치. `validBusinessNetReview` 원본 본문 별도 4조건: 동일인 원문/공백 동치 2건이 과거 승인으로 간주되는 **기존 P1 재현**, 기존 Draft PR #55에서 별도 수정 중. 신규로 중복 집계하지 않음.
- 권한 계층이 정상이라도 현재 함수의 공백 동치로 독립인증을 확정할 수 없으므로 아래 Draft PR 분리. **[ ] 유지**.

## A1-CALC-014 — 계산 소득 제안/승인 분리: Draft PR #85

- 변경 내용: `adoptBusinessNet`에 `proposer`의 빈/공백 검사와 `proposer.trim()===actor.trim()` 거부를 추가. `lib/business-net-reconciliation.ts` 후보 blob `98ebec78633b93980f08ed50c508e5b12fc331b4`.
- 변경 PR: [Draft PR #85](https://github.com/firmengine/firmengine/pull/85), branch `audit/a1-r30-business-actor-whitespace-20261031`, HEAD `6f98834ba6bf1840da46c739246654f3e21ee951`. 변경 파일 2개 모두 허용 경로 내부.
- 회귀: `tests/a1-r30-business-actor-boundary.test.ts` blob `c124e79771911b6383ff9bed65166c463b5e9def`, 동일인 exact/공백 양방향·제안자 빈/공백 5개 합성 Node 테스트 **작성·커밋만 함. Node 실행하지 않음**.
- 제안 승인 기록의 과거 current 재검증은 기존 Draft PR #55 범위이며 #85만으로 해결 안 됨. 두 PR은 같은 소스에 변경 있으므로 병합 전 통합 충돌·회귀, 변호사 및 계산사무장 검토 필요. 값/산식의 법적 의미는 수정하지 않음. **[ ] 유지**.

## 코드 변경·범위·제한·다음

- `main`에는 본 영수증과 해당 세 ID의 보드 기록만 변경 예정. 실행 코드 변경은 **Draft PR #85에만 있음**, 미병합. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 미수행.
- 금번 실측은 실제 원본문 V8 격리 5조건 및 current 승인함수 4조건, Git tree 954파일 이름·공개 정적 파일 구조, 3개 공개 추적 리뷰 문서 패턴 검사. 테스트 작성·코드 존재·V8 합성 통과와 Node CI/실 D1/R2/Cron/브라우저/공식 법원 서식/변호사 승인을 동일시하지 않음.
- 다음 역할은 **서류담당자/변호사/데이터담당자**: `A1-DOC-012`(갈음 승인 후 철회/변경), `A1-LAW-014`(50법률·46예외의 미적용·상충), `A1-DATA-010`(금액 단위·VAT 혼용) 우선.
