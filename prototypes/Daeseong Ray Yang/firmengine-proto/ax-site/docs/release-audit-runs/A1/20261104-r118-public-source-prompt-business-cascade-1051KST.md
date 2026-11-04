# FirmEngine A1 118차 — 공개 소스·활성 프롬프트·사업소득 승인 후 법률 입력 재평가
- **기준 main HEAD:** `72f1c9e16560e76fcda9f1a75a787ce72f028566`. 이전 A1 117차 완료 SHA `fb6023ba284f1193a3bd00c15e3dfb0448fe786b`; 사이 A2/A3 문서 커밋 4건 반영 후 읽음. A1-IT-018 / A1-AX-018 / A1-CALC-018 모두 **[ ] 인수 미완료**.
- **역할 순환:** IT → AX → 계산사무장. 이전 회차 DOC → LAW → DATA. 중앙 원장 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 우선 대조.
- **자료 및 범위:** GitHub main ref·최근 6개 커밋·open PR 목록·Draft #74/#55/#85 상태, `package.json`, `lib/business-income-policy.ts` 규칙 계약, `lib/reference-runtime.ts`, `lib/reference-prompts.ts`, `lib/reference-prompt-policies.json`, `lib/case-commands.ts`, `lib/domain.ts`, `lib/legal-review-identity.ts`, 기존 `tests/reference-prompts.test.ts`·`tests/legal-review-identity.test.ts`, 기존 A1 22·117차 영수증 및 n8n 참조 manifest 읽음. 공개 Git에 개인 상담 자료·원본 OCR·키·비공개 정답은 기록하지 않음.
- **실행등급:** 실제 GitHub TS 함수 본문에서 타입 구문만 제거하여 Code Mode V8 격리 실행. 합성 사건·가상 reference override만 이용. `structuredClone`과 `commandHash` 및 `currentFacts` / `invalidateExports` 외부 의존성은 명시된 synthetic 대체 구현 사용. 실제 프로젝트 Node/CI, 인증, 브라우저, D1/R2/Cron, 실제 법원 서식·변호사 승인·사이트 배포 미실행. 첫 실험용 추출 하네스는 JS/TS 경계 때문에 실행 오류가 있었으며 이후 **고친 하네스로 재실행한 결과만** 아래에 기재.
  
## A1-IT-018 [ ] — 공개 Git 추적 경로/제한적 텍스트 비밀신호 검사
- `git/trees/72f1c9e16560e76fcda9f1a75a787ce72f028566?recursive=1` 실제 트리 `truncated=false`; ax-site 대상 1,401개 경로, `public/` 22개 blob(템플릿 DOCX 18개, SVG/README/JSON 합계 4개), 추적 `private/release-review/` 파일 3개를 확인.
- **독립 기대:** 추적 경로에 `.env/.pem/.key/credentials.json/secrets.json` 계열이 없어야 하고, 선택 텍스트에서 예시가 아닌 실제 API 키·PEM·토큰·이메일·전화번호 패턴 신호가 없어야 함. 빌드 산출물과 운영 환경은 별도 검사 필요.
- **실제 관찰:** 경로명 패턴 해당 **0**, 추적 `.next/dist/build` JS·map **0**. 공개 JSON/README/SVG와 `private/release-review` 3개 등 **텍스트 7개 파일 직접 읽어 정규식 검사 7/7 성공, 지정 5종 패턴 신호 0**. DOCX 18개 **바이너리 본문은 검사하지 않음**, JS/TS 전체 원문·공개 URL 응답·실제 브라우저 번들/네트워크/R2/사이트는 **미검증**. 따라서 `public bundle에 비밀정보가 없다`는 최종 판정 금지.
  
## A1-AX-018 [ ] — 활성 프롬프트 공백 override
- 실제 소스 blob: `lib/reference-prompts.ts` **5311133cb3d35f00b599fcbbe3786c533f8b76b0**, 정책 JSON **9a347833b96e6a67081cd6aa2968ddbc6806584b**; 84 ID 고유(중복 0), placeholder 계약 불일치 0, 83개 잠금·1개 법률 검토 지침은 사람이 수정 가능. `n8n-reference/manifest.json` **4fe5204d0fc3399e7b8add9333ecdea4296e4128**는 스스로 `not a live n8n export` 명시.
- **독립 기대/합성 입력/실제 관찰:** 실제 `renderPromptPolicy` 본문 V8 10조건 중 **8개 기대 일치**. seed legal 텍스트, 정상 검토 문구, `null` 및 숫자 0 타입거부, 잠금 동일값, 잠금 무단변경 거부, 미등록 ID 거부, 미선언 매개변수 거부는 일치. 그러나 법률검토 지침 override가 `""` → **길이 0 문자열 정상 반환** 및 `"  \\n\\t"` → **공백 4문자 정상 반환**되어 독립 기대(명시적 오류)에 2건 불일치. 출처와 승인 상태는 source-only/합성 데이터로 취급. 기존 미병합 **[Draft PR #74](https://github.com/firmengine/firmengine/pull/74)** 존재: 코드 중복수정·검증 없는 병합 없음.
  
## A1-CALC-018 [ ] — 사업소득 승인 뒤 이전 검토 입력 무효화
- 실제 소스 blob: `lib/case-commands.ts` **d18c555f04f65687c509a8e8d35aba4bb3597378**, `lib/domain.ts` **39ab41856f6d7a379aca7217d24b28f7f5f7616a**, `lib/legal-review-identity.ts` **be300beef76f2ca130293763a28932d9046dcf59**, `lib/business-net-reconciliation.ts` **60a4fc295943dce404a7f99efffe88f58dd2d4ff**.
- `business.net.adopt` 분기에서 `adoptBusinessNet(previous,...)` → `work.businessNetReviews[index]=approved.review` → `data.incomes.push(approved.income)` → `resetReviews(data,impact)` 연결을 실제 원본 정적 확인. `touchCase`·`resetReviews`·`legalReviewInputFingerprint` 실제 함수 본문을 위 명시한 합성 의존성으로 V8 실행.
- **합성 입력:** revision=8, 일반 소득 100원·승인된 각 context review·활성 export/서명·미처리 decision이 있는 가상 사건에서 사업소득 1,000원 1건 추가, reference SHA `ref-A` vs `ref-B`, 계약 버전 `v1` vs `v2`. 실무 인정액·사건 사실로 취급하지 않음.
- **독립 기대/관찰:** 20/20 조건 일치. revision 8→9·입력불변, 새 소득 추가, rule/incomePeriod/PV/asset/allocation review false, referenceReviewSha 삭제, 단축기간 review 제거, schedule.reviewed=false, 제안 decision stale(기존 채택 decision은 보존), export current invalidated·직원/변호사 signoff null, audit reviewInvalidation 적재. 법률 입력 fingerprint는 **새 소득·reference 변경·계약 버전 변경 각각 달라졌고** revision만 변경할 때는 동일.
- **한계:** `adoptBusinessNet` 전체 함수·실제 reviewer/sourceFact 승인·D1 쓰기·active 법률 Run 전환·95 법률 검토 실행·Word 서식·동시 사건은 미실행. 현재 main의 다른 PR #55/#85(동일인 승인 경계) 미병합. `currentLegalDispositionOutcome`는 원본 읽기만 했고 호출하지 않음. 결과는 **국소 무효화 함수의 합성 성공**이지 법률 승인/서식 종단 재평가 인수 아님.

## 조치·다음 검증
- 세 ID 모두 인수 **[ ]**, 제품 실행 코드 변경 0; 기존 검토 PR #74/#55/#85의 실제 완전 통합을 확인하지 못해 병합 안 함. CI/staging/법원 서식/변호사 승인/운영 배포 모두 구분.
- 다음 순환 **서류담당자 → 변호사 → 데이터담당자**, 중앙 보드 미완료 **A1-DOC-011** (갈음 A←B+C에서 B만 제출), **A1-LAW-013** (95 법률위험의 미승인 근거 차단), **A1-DATA-018** (합성/실사건 분리). 다음 회차 최신 HEAD·블롭·연결 테스트 재조회 후 진행.
- 실행하지 않은 항목을 통과로 표시하지 않았으며 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 실행 없음. Extra High 실제 모델 설정 여부 미확인.
