# 독립 문서 평가

`evaluate.py`는 실제 DOCX의 본문·표와 XLSX의 셀을 읽어 별도로 작성한 기준답과 비교합니다. 생성기의 내부 content model이나 추출 목록에 값이 있다는 이유로 법원 본문 작성 성공을 인정하지 않습니다. 동일 이름의 복수 계약도 반복 행 단위로 평가합니다.

프로젝트 폴더에서 실행합니다.

```powershell
python evaluation/smoke_documents.py
python evaluation/evaluate.py --output-dir .local/실행별생성폴더 --truth 비공개독립기준답.json --report .local/평가결과.json
```

`synthetic_truth.json`은 실제 사건이 아닌 가상 사건의 예상값을 생성 실행 전에 작성한 고정 기준입니다. 표 헤더와 기대 반복 행을 모두 비교하며 XLSX 수치·개별 파일 SHA-256도 검사합니다. 가려진 항목·확인할 수 없는 항목은 `unscorable`로 남깁니다. 합성 실행에 성공해도 실제 사건 품질, 법적 판단 정확도, 전문가 기준값 일치나 시간 단축을 검증한 것은 아닙니다.

실제 평가에서는 입력 묶음의 지문을 먼저 정하고 증빙·제출본·행정자료 페이지를 분리해야 합니다. 생성기에는 증빙 분리본만 전달합니다. 제출본에서 정한 독립 기준답은 비공개 평가 디렉터리에 두고 생성·RAG·few-shot·promptbook 예시에 넣지 않습니다. 생성 결과를 본 뒤 기준을 낮추지 않습니다.

실제 샘플의 분리 내역·기준답·결과는 공개 저장소에서 제거했습니다. 평가에는 별도로 승인된 비공개 입력과 독립 기준이 필요합니다.

`evaluate_actual.py`는 그 고정 기준답을 실제 DOCX 본문 필드와 반복행에 대조합니다. 기준답의 해시가 달라지면 중단하며 계산근거 부록에만 있는 값을 법원 본문 작성 성공으로 인정하지 않습니다. 엄격한 정규화 기재범위 비교이므로 다른 표현이 법적으로 동등한지, 법적 판단이 적절한지까지 자동 인증하는 지표는 아닙니다.

```powershell
python evaluation/evaluate_actual.py --output-dir .local/evaluation/runs/example-run/diagnostic --truth .local/evaluation/truth/truth.json --report .local/evaluation/runs/example-run/diagnostic-report.json --mode diagnostic --workflow-status blocked
```

정상 경로의 기술 오류·필수 조건 미충족에 따른 생성 보류·문서 기재범위 부족은 별도로 기록합니다. 생성 보류 사건을 `diagnostic_mode`로 렌더링하면 모든 DOCX·XLSX에 진단 전용 표식을 넣습니다. 이 파일의 기재범위를 채점하더라도 정상 워크플로 생성 성공이나 HITL 완료로 계산하지 않습니다.

`smoke_vectors.py`는 실제 OpenAI 임베딩과 SQLite 코사인 검색, 동일 자료 묶음 제외·시점 필터를 개인정보 없는 합성 문장으로 확인합니다. 합성 검증 자료는 확인 후 삭제하고 API 사용량·연결 확인만 비공개 영역에 남깁니다. 실제 성공사례가 적재된 것처럼 시연 자료를 남기지 않습니다.

