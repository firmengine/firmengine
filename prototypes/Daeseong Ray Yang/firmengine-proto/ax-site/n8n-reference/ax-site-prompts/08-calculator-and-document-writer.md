# 계산·문서작성 경로

현재 `case-agent.ts`의 `runCaseCalculatorNode()`와 `document-writer.ts`의 `prepareDocumentWrite()`에는 모델 호출이나 별도 AI 프롬프트가 없습니다. 공통 계산 dispatcher와 저장된 계산·문서 기재값 검증을 사용합니다. 이름에 agent 또는 writer가 있어도 AI가 금액을 계산하거나 서류 본문을 자유 생성하는 단계로 표시하지 않습니다.

- [case-agent.ts](source/case-agent.ts.txt): snapshot·revision·해시를 확인하는 계산 호출과 영수증.
- [case-execution.ts](source/case-execution.ts.txt): 실행 노드와 계산·문서 입력 연결.
- [calculator-tools.ts](source/calculator-tools.ts.txt): 읽기 전용 공통 계산 dispatcher.
- [document-writer.ts](source/document-writer.ts.txt): 저장된 evaluation·출력 모드·기준 판본 검증.
- [reactive-evaluation.ts](source/reactive-evaluation.ts.txt): 사건 변경과 계산 결과 갱신.

v43의 문서작성은 저장된 계산·바인딩을 분리된 스냅샷으로 읽고, 실제 출력의 산식·제출 준비 상태를 [document-filing-readiness.ts](source/document-filing-readiness.ts.txt)로 검사합니다. 계산 일치와 공식 전자양식 일치는 별도이며 제출 준비 상태를 자동 승인하지 않습니다. [export-artifact-transaction.ts](source/export-artifact-transaction.ts.txt)는 manifest 저장 전 실패 시 해당 출력 요청이 만든 객체·행만 정리하고, 저장 완료 후 로그 실패로 정상 생성물을 삭제하지 않습니다.

법적 체크 AI에 전달하는 executionContext는 [법적 검토 프롬프트](04-legal-reviewer.md)와 [legal-review-packet.ts](source/legal-review-packet.ts.txt)를 함께 확인하세요.
