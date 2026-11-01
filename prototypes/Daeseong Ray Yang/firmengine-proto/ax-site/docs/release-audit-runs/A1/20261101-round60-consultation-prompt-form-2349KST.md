# FirmEngine A1 60차 — 상담 판본 · 활성 프롬프트 · 법원 서식 금액 경계

- 실행 시점: 2026-11-01 KST, 59차(DOC/LAW/DATA)에서 **IT/AX/CALC** 순환. 최신 조회 시작 main HEAD `81d18e243819396f46b44532bebcd734eebf5bc4`, 중앙 보드 blob `7d48aa78557daff7da2343a1b52a5d086daad97a`. 작업 범위: 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`.
- 단일 인수보드 체크 **A1-IT-005 / A1-AX-018 / A1-CALC-016**. 모두 **[ ] 미완료** 유지. 최신 main 최근 A4/A3/A2 커밋, 59차 [영수증](20261101-round59-multidoc-disposal-triple-numeric-2252KST.md), 기존 테스트 및 관련 Draft PR #74/#53/#58 내용을 읽음.
- 검증 방식: GitHub **실제 소스 함수 본문**에서 TS 타입 표기만 제거하여 JS V8으로 직접 실행. 독립 합성 입력과 사전 기대값 비교. 형식 계약/DB 스키마는 정적 조회. D5110에서 `moneyValue`만 합성 숫자/미관찰 stub 사용. **Node 프로젝트 테스트·전체 CI·타입/빌드·staging D1/R2/Cron·브라우저·실제 OCR/DOCX·공식 서식 원문 대조·변호사 승인 미실행**. 기존 테스트 파일을 읽은 것이 테스트 통과를 의미하지 않음.

## A1-IT-005 [ ] — 상담 수정과 활성 요구서류/원천 판본

- `lib/intake-store.ts` main blob `c0bdea9443a018a46c080a8e39a74a0daf62759f` 실제 `activeConsultationNotes` V8 **6/6**: 첫 메모 A→[A], A+B→[A,B], A를 B가 정정→[B], A→B→C 연속 정정→[C], B와 C 병행 유효→[B,C], 빈 상담→[]. 기대/관찰 전부 일치.
- 원문 소스 경로 정적 확인 **5/5**: `appendConsultation`은 `consultation_heads.active_run_id=NULL`로 무효화; `analyzeConsultation`은 사건 revision/storage_token/상담 revision/카탈로그 판본 확인 뒤 현재 run을 갱신; `consultationHistorySha256` 및 v2 semantic fingerprint는 역사 변경/기준정보/관할·기준일을 구분; run별 요구서류는 immutable `prepareCaseDocumentRequirementWrites`로 구성.
- `lib/case-document-requirement-store.ts` blob `a670cb4e6a38aa6e782e898b5ed30aad80619c6d`의 조회는 `consultation_heads.active_run_id`와 동일 사건의 complete run만 join; 비활성 head는 과거 요구서류를 반환하지 않고 `pendingReanalysis`를 구분(**코드 경로 정적 확인**, 이번 회차 SQL/D1 실행 아님).
- 스키마 `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`; 기존 `tests/intake-store.test.ts` blob `6665cca7659ee4bfae5a474bfc1d2873b46c03a2`, `tests/consultation-revision-watch.test.ts` blob `966ab4f60651f52bc6214c0f3a534b53ff4b87cb` 읽음. 이번 회차는 이 Node 테스트 실행 안 함. 상담 메모→85문서 요청→OCR/계산/법률의 실제 D1·UI 종단 미인증.

## A1-AX-018 [ ] — 프롬프트 활성본/사본 중복 및 공백 정책

- 활성 `lib/reference-prompt-policies.json`와 `n8n-reference/ax-site-prompts/source/reference-prompt-policies.json` blob 모두 `9a347833b96e6a67081cd6aa2968ddbc6806584b` (일치). 카탈로그 파싱 84개 정책 / 84개 고유 ID / placeholder 계약 불일치 0 / 기본 template 공백 0 / 법률 지침 changePolicy=`human_review_required`: 정적 독립 체크 **6/6**. 동일 바이트 사본은 실행 활성본과 별개의 문서·참고 원본이며 실제 n8n/배포 사용 여부 미관찰.
- `lib/reference-prompts.ts` main blob `5311133cb3d35f00b599fcbbe3786c533f8b76b0`의 실제 `renderPromptPolicy` V8 합성: 기본 템플릿 정상, 검토된 비공백 override 정상, 미등록 placeholder 거부는 통과. 그러나 **빈 문자열 `""` 및 공백 `"  \\n\\t"` override가 오류 없이 반환됨**(독립 기대 `REFERENCE_PROMPT_TEMPLATE_BLANK`), main **3/5**.
- 기존 미병합 [Draft PR #74](https://github.com/firmengine/firmengine/pull/74) HEAD `3266ea41b9a20a50409a94a8d38991008707e39c`, 수정 blob `2ff9aebd91f3e77c7297dd3e632011c9f15eae9c` 재독·원본 함수 V8 합성: 위 5조건 **5/5** 기대 일치. 신규 결함 중복 신고/새 패치 없이 해당 PR의 통합·실무자 승인 인계. 요청 범위에서 법률 효력 인정이나 기준정보 임의 수정을 하지 않음.

## A1-CALC-016 [ ] — 내부 저장 계산값→공개 서식 원단위 경계

- `lib/form-mapping.ts` main blob `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`: 실제 `exactSourceCalendarMonth` V8 **8/8** (완전월 2월·윤년·10월·4월 허용 / 연간·부분월·2월30일·unknown 배제); 실제 `amount` V8 **6/6** (원단위 정수 0/10,000/음수/2^53 초과 문자열 정확 표기, null/소수 미확정).
- 같은 파일의 D5110 **실제 `beforeFee`→`afterFee`→`form_total_available_after_trustee` 수식**을 그대로 V8 격리 실행, `moneyValue`만 합성 stub: **7/7**. 예: 월소득 3,000,000원, 생계비 2,000,000원, 보수 100,000원, 36회 → 사전 1,000,000원 / 보수후 900,000원 / 36개월 32,400,000원. 명시적 보수 0→36,000,000원, 미관찰 보수 null→후속 두 값 `[확인 필요]`, 월수 0→합계 미확정, 월소득 null→전부 미확정, 음수 부족액 표기, 큰 정수 계산 정확성도 기대 일치.
- **중요한 의미 분리**: D5110 표의 ③=①−②, ⑤=③−④는 별도로 검토된 일반채권 월변제 `monthlyPaymentWon`/총변제 `planTotalWon`과 동일 수치라는 법적 결론을 만들지 않음. 예컨대 가용 900,000원 vs 별도 검토 일반변제 800,000원은 서로 다른 기능·계정. 실제 저장 `case_calculation_features`→R2 Word D5110/11 출력 원단위 대조·법원 공식 채택은 미실행.
- `lib/document-preflight.ts` main blob `dc771c0ff0497d24df19478b0366ebbb397bfbf2`의 실제 `numeric` V8: 독립 9조건 **6/9**. `"1,000"` 1000, `"0"` 0, null 차단, 소수 차단 등 일치. 그러나 `"1,00"`→100, `"1,,000"`→1000, `"1 0"`→10은 **부적합 구분자를 잘못 허용**. 기존 동일 원인 [Draft PR #53](https://github.com/firmengine/firmengine/pull/53) HEAD `dd481b05274358f2f14f7e3ae60fc314404b8101`의 실제 수정 blob `fb60cc2b737d4244867933f8b41211aa78d377af`에서 동일 9조건 **9/9**. [Draft #58](https://github.com/firmengine/firmengine/pull/58)은 동일 파일 추가 수정하므로 병합 전 충돌·전 회귀 확인 필요.
- 위 결과는 **실제 서식 Word 출력의 숫자 일치나 법원 승인**이 아닌 코드-수식/정수 파서 격리 검증이며, 공식 D5103/D5110/D5111 전체 입력 의미·서식 토큰별 출처 비교 및 법률 검수는 남음.

## 결함 관리 / 다음 회차

- 신규 확정 결함 **0건**, 중복 수정 **0건**, 신규 PR **0건**. 기존 미병합 프롬프트 공백 P2(#74), 잘못된 천단위 그룹 P1(#53/#58) **독립 재현**. 제품 실행 코드는 변경하지 않음. **A1 세 ID [ ] 유지·제품 전체 인수 완료 0건**.
- A1 61차는 **서류담당자·변호사·데이터담당자** 관점: `A1-DOC-007`(같은 파일 재업로드/교체 이력), `A1-LAW-008`(배우자 재산·명의신탁·면제재산 예외), `A1-DATA-007`(R2 해시·D1 문서 포인터 동등성). PR #74/#53/#58는 실제 전체 Node/타입/브라우저/staging D1·R2 검증, 공식 원문·사람 검토 전 병합하지 말 것.
- 고객 문서/개인정보/원본 OCR 사실·비공개 정답·키/.env 미기록. 관측 0/null/미관찰/비해당/상충/source-only/승인전 별도 유지. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 미실행. Extra High 실제 실행기 설정은 확인되지 않아 주장하지 않음.
