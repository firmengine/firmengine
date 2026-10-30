# FirmEngine AX 문서 안내

**현재 구현·검증·남은 작업의 단일 기준은 [제품 인수 통합 보드](PRODUCT_RELEASE_INTEGRATION_BOARD.md)입니다.** 과거 감사·병합 문서의 수치나 완료 표기를 최신 제품 합격으로 해석하지 않습니다.

## 실제 사용할 문서

- [제품 인수 통합 보드](PRODUCT_RELEASE_INTEGRATION_BOARD.md): 기능별 구현/충돌, OCR 693개, 법적 계산 18개, 법률위험 95개, 출시 전 테스트와 과거 이력 통합.
- [기능 목록](features.md): 담당자 관점 기능 설명.
- [업무 흐름](workflow.md): 상담 → 서류 요구 → OCR/사실 검증 → 계산 → 법률 검토 → 문서 생성 → 사람 검수.
- [기준정보 관리](reference-data.md): 실무 요건·공식 출처·변경 승인/복구.
- [복구 안내](recovery-runbook.md): 저장/처리/재시도 실패 대응.

## 검증 실행

```bash
cd "prototypes/Daeseong Ray Yang/firmengine-proto/ax-site"
npm ci
npm run check:source
npm run check:product
node scripts/audit-product-contracts.mjs --fields
node scripts/run-preapproval-regressions.mjs --full
```

`check:product`는 **정적 ID·서류·마이그레이션 연결 검사**일 뿐 법적 계산·법원 전자소송 서식의 적합성, 최신 CI 통과 또는 실제 D1/R2 배포를 인증하지 않습니다. 누락/상충/미관찰 값을 0이나 승인으로 치환하지 않습니다.

## 과거 작업 자료

`audit-*.md`, `ax-v35/v43-merge*`, `release-v44.md`, 구 `production-p0-plan-20261030.md`와 합성 시험/manifest JSON은 **읽기 전용 역사·재현 근거**입니다. 과거의 미해결 항목을 현재 작업으로 중복 등록하지 않고, 발견·수정·인수 상태는 [통합 보드](PRODUCT_RELEASE_INTEGRATION_BOARD.md)에 갱신합니다. 이력 원문을 성급히 삭제해 법령 출처·테스트 근거를 유실하지 않습니다.
