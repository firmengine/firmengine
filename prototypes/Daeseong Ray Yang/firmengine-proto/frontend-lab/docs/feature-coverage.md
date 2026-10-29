# AX v44 기능 반영표

기준은 [AX v44 기능 목록](../../ax-site/docs/features.md)과 [변경사항](../../ax-site/docs/release-v44.md)입니다. 원본의 19개 항목 중 마지막 ‘권한·복구’를 나누어 20개로 대조했습니다. 이 표는 구현 연결표이며 수동 인수 테스트의 통과 보고서가 아닙니다. 확인 절차의 L 번호는 [수동 테스트 계획](functional-test-plan.md)을 가리킵니다.

아래 AX 소스는 대응 동작을 확인한 원본 위치입니다. 프론트엔드는 AX 업무 엔진을 가져와 실행하지 않고 별도의 합성 상태 모델을 사용합니다. AX API·MCP·OCR·법령 검색·예약 작업·운영 저장소에는 연결하지 않았습니다.

| # | v44 기능·원본 소스 | 실제 화면·로컬 구현 | 수동 확인 | 외부 경계·남은 범위 |
| --- | --- | --- | --- | --- |
| 1 | 사건 관리 · [workflow-state](../../ax-site/lib/case-workflow-state.ts) | 전체 사건에서 검색·사건 선택·새 접수. [App](../src/App.tsx), [model](../src/model.ts)의 사건별 현재값·이력·로컬 보존 | L01·L14·L15 | 다중 사용자 사건 저장·기존 사건 마이그레이션은 미연결 |
| 2 | 상담 · [intake-case-bridge](../../ax-site/lib/intake-case-bridge.ts) | 상담·사건 정보의 텍스트·소득유형 변경이 준비 서류와 검토 상태에 반영. [model](../src/model.ts) | L02·L12 | 자연어 상담 분류·법적 자격 판단은 수행하지 않음 |
| 3 | 서류 목록 · [case-requirements](../../ax-site/lib/case-requirements.ts) | 준비 서류의 필수·조건부·대상·기간, 사유 있는 조건부 제외. [RequirementLinks](../src/RequirementLinks.tsx) | L02·L20 | 5종 데모 자료이며 모든 관할·가구·기간별 요구를 포괄하지 않음 |
| 4 | 자료 연결 · [document-fulfillment](../../ax-site/lib/document-fulfillment.ts) | 같은 자료 ID를 여러 요구에 연결·해제하고 대체 근거 유지. [RequirementLinks](../src/RequirementLinks.tsx), [model](../src/model.ts) | L19 | 서버의 실제 문서·필드 계약과 자동 일치시키지 않음 |
| 5 | 출처 보관 · [observed-source-details](../../ax-site/lib/observed-source-details.ts) | 서류·원문 검토의 문서·쪽·인용 연결, 실제 로컬 PDF 표시·회전·형광 표시·메모·사본 출력. [PdfWorkbench](../src/PdfWorkbench.tsx) | L03·L04·L18 | OCR·텍스트 추출·실물 인용 진위 확인은 없음. PDF 표시는 현재 탭의 파일 바이트를 사용 |
| 6 | 사실 정정 · [fact-object-projection](../../ax-site/lib/fact-object-projection.ts) | 사유를 남겨 값·출처·상태 변경, 충돌 후보를 직접 선택, 안전한 정상 후보만 일괄 확인. [App](../src/App.tsx), [model](../src/model.ts) | L06·L07·L17 | 5개 핵심 금액 대상. 원본의 모든 소득·채권·재산 객체로 자동 투영하지 않음 |
| 7 | 자료 철회 · [source-verification](../../ax-site/lib/source-verification.ts) | 수취 자료 철회·사실 철회 후 후보·남은 자료·연결·변경 이력 보존 및 재검토. [model](../src/model.ts) | L12·L19·L30 | 실제 AX의 복수 객체·출처 간 정합성은 별도 통합 검증 |
| 8 | 소득 계산 · [income-resolution](../../ax-site/lib/income-resolution.ts) | 계산 → 재무 작업실 → 소득원·대상기간에서 행 CRUD·출처·기간 겹침·확인 상태. [FinancialWorkbench](../src/FinancialWorkbench.tsx) | L21 | 월 환산값을 직접 입력. 과세·사업경비 인정·정확한 기간 평균은 법적 산식으로 계산하지 않음 |
| 9 | 채무 계산 · [debt-resolution](../../ax-site/lib/debt-resolution.ts) | 채권 계약별 원금·이자·담보·분류·기준일·출처·합계·중복 경고. [FinancialWorkbench](../src/FinancialWorkbench.tsx) | L22 | 분류는 사용자 입력. 법적 채무한도·우선권을 자동 확정하지 않음 |
| 10 | 재산 계산 · [asset-resolution](../../ax-site/lib/asset-resolution.ts) | 재산별 평가·담보·비용·공제·지분·처분 현금 예시와 0원·누락 구분. [FinancialWorkbench](../src/FinancialWorkbench.tsx) | L22 | 공제의 허용 여부·법적 청산가치 판단은 없음 |
| 11 | 변제계획 · [repayment-plan-model](../../ax-site/lib/repayment-plan-model.ts) | 36·48·60개월, 생계비·비용·우선배분·일반채권 배분·부족·미배분 예시. [FinancialWorkbench](../src/FinancialWorkbench.tsx), [model](../src/model.ts) | L08·L22 | 재무표 저장과 핵심 금액 후보 반영은 구분. 비용·세부 배분표가 보고서의 단순 산식에 자동 합쳐지지는 않음 |
| 12 | 법률 검토 보조 · [legal-check-dispositions](../../ax-site/lib/legal-check-dispositions.ts) | 법률 검토에서 해당·비해당·미확정·충돌, 담당자 제안·변호사 근거·사유 기록. [Operations](../src/Operations.tsx), [operations-model](../src/operations-model.ts) | L23·L30 | 3개 합성 검토 주제. 법령 검색·자동 법률 판단·전문가 승인 아님 |
| 13 | 담당자 작업 · [case-tasks](../../ax-site/lib/case-tasks.ts) | 업무함의 담당자·기한·대기 사유 CRUD·제목 중복 병합·새 근거 후 다시 열기. 자동 보완 작업은 변경 이력에서도 확인. [Operations](../src/Operations.tsx) | L09·L24 | 담당자 이름은 로컬 문자열. 실제 조직 업무 배정·알림은 없음 |
| 14 | 문서 작성 · [document-workflow-gate](../../ax-site/lib/document-workflow-gate.ts) | 문서 작성·검토에서 자료·금액·법률 gate 후 고정 스냅샷, 담당자→변호사 확인, HTML·JSON 보고서. [App](../src/App.tsx), [exports](../src/exports.ts) | L05·L10~L13·L23 | 신청서 등 공식 DOCX·XLSX 5종·별지를 생성하지 않음. 검토용 사건 요약만 출력 |
| 15 | 문서 편집 · [document-edits](../../ax-site/lib/document-edits.ts) | 최신 초안의 문구를 사유와 함께 편집하여 새 판본 생성·이전 문구 비교·과거본 보존. [App](../src/App.tsx)의 DraftEditor | L31 | 텍스트 범위 편집. 공식 서식 직접 편집·병합 충돌·오피스 편집기는 미연결 |
| 16 | 기준정보 · [reference-registry](../../ax-site/lib/reference-registry.ts), [reference-impact](../../ax-site/lib/reference-impact.ts) | 기준정보 관리자 또는 `#/admin`: 6개 스키마의 폼·JSON CRUD·참조 검증·가져오기/내보내기·제안·검토자 적용·영향 기록·새 판본 복원. [ReferenceAdmin](../src/ReferenceAdmin.tsx), [reference-admin-model](../src/reference-admin-model.ts) | L25·L26·L30 | 공개 원본 13,226행 중 54행 부분집합. 관할 2행은 원본 courtIds에서 만든 로컬 확장. 적용은 로컬 판본이며 실제 AX 기준·예시 계산 산식을 변경하지 않음 |
| 17 | 변경 점검 · [legal-monitor-status](../../ax-site/lib/legal-monitor-status.ts) | 기준정보 관리자 하단의 설정·실행·중단·실패·재시도 상태 전이. [Operations](../src/Operations.tsx) | L27 | 사용자가 결과를 주입하는 모의 점검. 법령·서식 수집과 자동 스케줄 실행은 없음 |
| 18 | 절차 기록 · [case-procedure-events](../../ax-site/lib/case-procedure-events.ts) | 절차 기록의 제출·접수·보정·인가·폐지·면책 순서, 자료·쪽·날짜·사유 검증. [operations-model](../src/operations-model.ts) | L28 | 합성 사건이므로 모의 이력만 저장. 실제 제출·승인 전환 버튼은 없음. 문서 생성이 절차를 올리지 않음 |
| 19 | 권한 · [case-command-contract](../../ax-site/lib/case-command-contract.ts) | 상단 역할 전환, 의뢰인 메뉴 제한, 담당자 생성·확인과 변호사 검토 순서·기준 적용 제한. [App](../src/App.tsx), 각 로컬 상태 모델 | L01·L11·L23·L26 | 브라우저 데모 역할이며 인증·세션·보호 사건 ACL·법무법인 이해충돌 검사는 없음 |
| 20 | 복구 · [case-command-store](../../ax-site/lib/case-command-store.ts), [case-execution](../../ax-site/lib/case-execution.ts) | 운영·복구 테스트에서 동일 요청 ID 재사용·내용 충돌·오래된 판본 거부·새 판본 조회·실패·재시도·취소. [operations-model](../src/operations-model.ts) | L14·L15·L29 | 로컬 기록의 상태 전이. 실제 DB 트랜잭션·다중 탭 경합·백업·실패 후 서버 결과 재조회는 검증하지 않음 |

## 화면 위치와 확인 범위

데스크톱은 빚오프 스타일의 고정 사이드바에서 전체 사건·선택한 사건·업무함·기준정보 관리자·운영 복구로 이동합니다. 선택한 사건의 상단 단계와 하위 탭에서 준비 서류·원문·재무·법률·문서·절차를 엽니다. 모바일은 상단 메뉴 버튼과 닫기 영역을 사용합니다. [styles.css](../src/styles.css)에 메뉴 전환과 버튼 효과, `prefers-reduced-motion` 처리가 있습니다. 애니메이션과 화면 크기는 L32의 수동 확인 대상입니다.

사이드바의 점심 메뉴·날씨·시세·뉴스는 v44 사건 기능과 별도입니다. 공개 정보 조회와 명시적 허용 후 현재 위치 사용, 실패·캐시·순환 중지는 L33으로 확인합니다. 공개 중계는 로컬 Vite 개발·미리보기 서버를 사용하며 사건 처리 API에는 연결하지 않습니다. 출처와 정적 배포 제한은 [README](../README.md#화면과-일상-정보)를 참조합니다.

값 확인, 법적 판단, 생성본 확인은 별개 상태입니다. 상담·자료·소득유형·요구 연결·예외·재무 저장·기준 판본이 바뀌면 이전 생성본을 재사용하지 않으며, 법률 화면을 다시 방문하기 전에도 저장된 근거 서명과 비교해 재검토를 요구합니다. 법률 판단이나 검토 이력만 추가한 경우에는 근거 변경으로 다시 처리하지 않습니다.

실제 AX 연동이 필요하면 위 원본 모듈과 API·MCP의 계약을 따로 연결하고 저장·권한·출력까지 검증해야 합니다. 이 표의 로컬 동작이 실제 업무의 법적 정확성이나 v44의 950개 원본 테스트를 대신하지 않습니다.
