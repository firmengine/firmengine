# FirmEngine AX — P0-02~08 동시작업 통합 보드 (2026-10-30)

> **상태는 GitHub main의 코드 수준이다. 운영 D1/R2·Cloudflare Cron·실제 모델/서식/법원 적합성 검증이 아니다.**
> 사용자 지시: 기존 서비스·DB·API 유지, ax-site 내부만 수정, 변경은 main 직접 반영. 데이터/계산을 다른 작업자가 동시에 수정하므로 **매 항목 시작 및 커밋 전 main head 확인**; 변경된 원본 파일 SHA가 다르면 무단 덮어쓰기 금지.

## 작업 등록 및 인수조건

| 항목 | GitHub | 진행 및 확인된 코드 | 잔여 인수조건 |
|---|---|---|---|
| P0-02 기준정보 통합 | [#3](https://github.com/firmengine/firmengine/issues/3) | 승인·버전형 기준정보에서 갈음 법원정책과 LawGraph 증거계약을 편집 가능한 별도 관리 레코드로 추가. 자동 활성화가 아닌 제안·2인 승인 경로. | 나머지 상담/OCR/계산/서식의 전체 기준 편집성, 관할·시행일·영향/롤백 대조, 운영 DB 검증. |
| P0-03 상담 85종→필수 OCR 계약 | [#4](https://github.com/firmengine/firmengine/issues/4) | 85종/70개 상담 규칙·사건별 fieldPlan 경로 기존 구현 확인. 다른 작업자의 피처 범위/기간 강화 커밋 확인. | 사건별 reviewed source→canonical 그룹 확정·전수 검증. 승인 없는 후보를 법적 충족으로 오인 금지. |
| P0-04 갈음 A←B+C | [#5](https://github.com/firmengine/firmengine/issues/5) | 서울·부산 실무준칙 402 기준 소득 갈음 8개 조합을 승인형 정책으로 외부화. 정확한 문서 집합·기간·사유/서명·원문 필드/사람승인 없으면 복원. | 85종의 검증된 허용/조건부/금지 경로 전수 법률 검토, 실사례·변경복구 E2E. |
| P0-05 693 OCR→DB→계산 피처 | [#6](https://github.com/firmengine/firmengine/issues/6) | 별도 작업자: `cc3646b` material OCR 금액 입력 누락 차단, `388b129` 문서·페이지·기간 scope 엄격화. | 693 전수 소비처 중 필요한 부분의 정확한 계약·데이터 저장 및 실제 추출/SQL E2E. |
| P0-06 계산 18/91 계약 | [#7](https://github.com/firmengine/firmengine/issues/7) | 별도 작업자: `b605f3a` 총계 누락/0 처리 방지, `14801f1` 자동초안까지 미연결 재무 입력 차단. | 남은 객체입력 18종, PV/우선채권/관할예외·시점·수식 원장 검증 및 18모듈 실제 운영 호출. |
| P0-07 LawGraph 95 | [#8](https://github.com/firmengine/firmengine/issues/8) | 승인 가능한 위험ID별 canonical 필드 OR-군·필수 계산값·관할·시행일 계약/관리 API 및 법률 검토 패킷·누락 차단. 초기 95 중 미승인 항목은 자동 통과시키지 않음. | 88개 미정의 항목은 법률전문가가 명시 피처 계약을 작성·승인해야 함. 최종 법적 검토 품질 평가. |
| P0-08 최종 LawGraph→서류 | [#9](https://github.com/firmengine/firmengine/issues/9) | 최신 법률판단 95건·계산 실행·참조기준 해시·사람의 법률 승인 검증; 생성될 서식 토큰별 SQL 스냅샷/계산 출처 저장. 투영 실패 시 검토 보존 및 자동초안 차단. | 전체 서식 출력의 토큰×원천 대응 검증, 법원 전자서식 판본/첨부/출력 검수, 레거시 전환과 CI/E2E 통과. |

## 추가 코드 반영 기록

- `c675b036` : P0-02/04 갈음 정책 기준정보 편입, 정확한 조합 8개, 증빙/법률용 2인 승인.
- `98d905a3` : P0-08 최신 LawGraph 최종 검토 게이트 및 화면 진단.
- `527a260a` : P0-08 직원 검토와 법률 담당자 검토를 구분.
- `53f3b981` : P0-02/07 95 위험항목의 편집·승인형 원문 필드/계산 근거 계약.
- `f95bbcdb` : P0-08 SQL 법률 검토 실행에 실제 서식필드 근거 저장.
- `48f1ba6c` : 문서 필드 원문 인정/누락 출처 강제.
- `787a51ad` : 서식 투영 실패 시에도 기존 법률 검토 보존, 자동초안 차단.

## 통합 계약 (불변)

1. 모든 업데이트는 사건 내부 ID·documentId·page·record ordinal·canonicalFieldId·source hash·source data version·calculationRunId·legalReviewRunId·기준정보 SHA로 추적한다.
2. 누락·마스킹·오인식·미관찰·명시적 비해당·0·충돌을 서로 다른 상태로 보존한다.
3. OCR/계산/AI 판단은 사람의 출처 승인, 법률상 인정 또는 전자소송 적합성의 대체물이 아니다.
4. 법률상 필수·갈음·서식 요구는 관할/시행일/공식 근거/사람승인을 함께 만족할 때만 적용한다.
5. 최신 데이터 변경이 기존 검증·계산·판단·문서 생성을 무효화하고, 10분 안정화 후 재계산한다. 갈음 복구는 10분을 기다리지 않는다.
6. 다른 에이전트가 작업하는 `assessment.ts`, `feature-lineage-audit.ts`, OCR/DB 투영 모듈은 덮어쓰지 않는다. 변경 여부는 main SHA와 개별 파일 SHA로 검사하고 충돌 시 중단한다.
7. CI 통과·운영 동작을 실행하지 않은 상태에서는 절대 완료로 표기하지 않는다.

## 인수 테스트 (실행 및 상태는 별도 기록)

```bash
npm ci
npm run check:source
npm run lint
npm run build
npm run test:intake-pipeline
npm run test:legal-auto
node --experimental-strip-types --test tests/substitution-policy-reference.test.ts tests/legal-evidence-criteria.test.ts tests/final-lawgraph-readiness.test.ts tests/lawgraph-document-field-projection.test.ts
node --experimental-strip-types --test tests/ocr-calculator-input-integration.test.ts tests/calculation-18-output-golden.test.ts tests/feature-lineage-audit.test.ts
```

현재 GitHub head의 Actions 자동 실행 결과가 확인되지 않았으므로 **신규 테스트는 작성되었으나 전체 실행 통과는 미인증**. 운영 적용 시 실제 D1 마이그레이션(0017, 0018 포함), Cron 설정, 각 사건 버전 재계산, 신규 기준정보 활성화·무효화 실측을 별도 수행해야 한다.

## 후속 작업 시 주의

데이터를 담당하는 별도 에이전트가 push할 때마다 해당 커밋이 변경한 파일, 계산/추출 피처 계약 변화, 법률/서식 영향 및 관련 테스트를 각 이슈 댓글에 누적한다. 편집 가능한 정책은 승인형 레지스트리에서만 변경하며, 코드 안전불변식은 변경 승인의 대상이 아니다. 공개 GitHub에 실제 의뢰인 자료, 운영 키, 샘플 원본 추출값을 올리지 않는다.
