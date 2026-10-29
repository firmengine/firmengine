# FirmEngine AX 문서

**현재 안내 기준: v44 · 2026-10-29**

처음 확인할 때는 아래 네 문서만 읽으면 됩니다.

1. [기능 목록](features.md): 어떤 일을 할 수 있고 어디에서 사람이 확인해야 하는지
2. [업무 흐름](workflow.md): 상담 → 자료 확인 → 계산 → 검토 → 문서 작성
3. [v44 변경사항](release-v44.md): 이번에 수정한 문제와 남은 일
4. [검증 결과](verification.md): 실제 실행한 검사와 미검증 범위

업무 중 필요한 안내입니다.

| 상황 | 안내 |
| --- | --- |
| 상담 결과를 준비 서류에 연결 | [상담·서류 목록](consultation-checklist.md) |
| 최종 문서를 만들 수 있는지 확인 | [문서 작성 조건](document-filing-readiness.md) |
| 적용 기준을 검토하거나 복원 | [기준정보 관리](reference-data.md) |
| 법원·법령 변경 점검 상태 확인 | [변경 점검 안내](legal-monitor-runbook.md) |
| 저장 지연·실패·재시도 처리 | [복구 안내](recovery-runbook.md) |

`audit-*.md`, `ax-v35-merge.md` 등은 이전 판본의 조사·수정 이력입니다. 현재 완료 여부는 위의 v44 안내와 검증표를 기준으로 봅니다.

개발 검토가 필요한 경우에만 `release-acceptance.json`, `feature-inventory.json`, `eform-parity-matrix.json`을 확인하세요. 파일이 존재한다는 이유만으로 기능이 검증된 것으로 표시하지 않습니다.

- [공개 사례 자료 정리](public-data-cleanup.md): 삭제 범위와 재유입 방지.
