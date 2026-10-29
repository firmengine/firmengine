# 갈음서류 감시·자동 비활성화·변경복구 (2026-10-30)

## 구현 상태
GitHub `main`의 코드 반영. 배포·운영 DB D1 마이그레이션 실행 및 실제 추출·검수 통합 검증은 별도입니다. 모든 85종의 요청/갈음 역할을 감사하는 표: `substitution-coverage-matrix.json`.

## 업무 동작
1. 상담 규칙대로 원본 요청을 보존하고 등록된 대체자료 후보를 표시합니다. 등록되지 않은 임의의 대체서류는 자동 인정하지 않습니다.
2. 담당자가 원본의 필수 증명 항목 각각에 실제 사건 사실을 연결하고, **원본의 필드 매핑도 별도 승인**한 뒤 갈음 검토를 기록합니다.
3. 매 평가 때 등록 후보인지, 서울·부산회생법원 제402호상 명시적 대체 경로인지, 원본 채권/소득/기간/신청인/출처/페이지/서류 종류가 맞는지, 실제 인정·검증된 사실의 SHA-256 지문이 바뀌지 않았는지 확인합니다.
4. 조건을 전부 충족한 경우 `inactive_by_substitution`으로 **사건의 활성 요청 목록에서만 숨깁니다.** `case_document_requirements`, `consultation_runs`, 추출 원문, 페이지 이력은 삭제하지 않습니다.
5. 근거 철회/정정, 원본 해시 변경, 페이지·자료 유형 불명확, 신청인·관할 변경, 최근 공식 법원 변경 알림, 요구기간·필수 필드 누락, 상담 재분석/새 카탈로그 적용 시 **즉시 원본 요청 복구**합니다. 미확인 상태는 제출 완료/해당 없음이 아닙니다.

## 연결 지점
- `lib/document-substitution.ts`: 사전 정책과 모든 증명항목 평가
- `lib/approve-document-substitution.ts`: 담당자 승인과 출처 사실 지문 결속
- `lib/case-workflow-view.ts`: 읽기 시 재평가, 상태/누락 피처 반환
- `lib/case-substitution-watch.ts`: 사건 단위 DB 감시, 변경 이벤트와 상태 저장, 중복 처리 방지
- `lib/case-agent-scheduler.ts` / `POST /api/case-data`: 기존 소스 변경감시 작업과 같이 실행. 계산의 10분 안정 대기와 무관하게 **갈음 복구는 바로 검사**.
- `worker/index.ts`: Cloudflare Cron 이벤트 핸들러 추가. **호스팅 Worker에 실제 Cron Trigger 설정 전에는 자동 주기실행을 보증하지 않습니다.**
- 사건 업무 흐름/요구서류 API: 일반 요청과 갈음 충족으로 숨겨진 원본 요청을 분리 표시
- `drizzle/0014_case_substitution_watch.sql`: 사례별 현재 판정·조회 헤드·상태전이 감사로그. 실제 서비스 반영 시 0014와 후속 마이그레이션을 기존 순서대로 적용.

## 법원 실무준칙 범위 및 누락 방지
- 서울회생법원 [제402호 원문](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf), 부산회생법원 [제402호 원문](https://bsb.scourt.go.kr/bsb/info/info_01/practice_rule_bsb.pdf). 제2조의 제출·갈음과 제3조의 추가제출 가능 자료는 구분합니다.
- 현재 승인된 자동 비활성화 대상은 **소득증빙의 명시적 대체 경로만**입니다. 원천징수영수증은 불가피한 발급 곤란 및 사용자 확인/급여계좌 6개월 조건, 영업소득 수입내역은 손익계산서 대체 조건을 확인합니다.
- 재직증명서↔근로계약서, 부채증명↔자료송부청구서 등은 법원별 명시적 대체 자격 또는 필드 요건이 검증되지 않은 경우 **절대 자동 제외하지 않습니다**.
- 85종은 각각 `primary_required`, `review_only`, `alternative_only`, `conditionally_reviewed` 등으로 점검. 서류를 많이 자동 면제하는 것이 아니라 **누락 없이 그대로 보존하는 것이 기본 상태**입니다.

## 실서비스 검증 순서
1. D1 백업 및 `0014_case_substitution_watch.sql` 적용 후 `PRAGMA foreign_key_check` 확인.
2. `node --experimental-strip-types --test tests/document-substitution.test.ts tests/case-substitution-watch.test.ts` 실행.
3. 사건별 원본 필요 → 대체 1개/여러 개 제출 → 원문 OCR 추출/검수 → 모든 피처 대조 → 담당자 승인 → 자동 비활성화 순서 E2E.
4. 필드 1개 삭제, 내용 정정, 원본 해시 교체, 적용기간 변경, 타인 명의, 문서 유형 미확정, 신규 법원 알림, 상담 갱신 등마다 원본 요청 복구 검증.
5. 기존 `POST /api/case-data` 정기 호출과 호스팅 Cron Trigger 연결 확인. 백그라운드 스캔이 실패해도 웹 조회는 미검증 갈음을 인정하지 않습니다.

**검증 주장 범위:** 코드 및 시험 시나리오가 GitHub에 등록되었다는 사실과 운영 실행·배포 성공은 다릅니다. 실운영 DB 행 삭제와 기존 샘플/개인정보 업로드는 수행하지 않습니다.
