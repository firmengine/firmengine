# 독립 평가

프로젝트의 `sample_masking.pdf`는 제출본과 의뢰인 증빙이 함께 묶인 118페이지 스캔 PDF입니다. 파일명이 변경되었지만 최초 검토한 `sample.pdf`와 SHA256이 같습니다. `sample_manifest.json`은 페이지 제목을 별도로 확인해 만든 분리표이며 개인정보·정답 금액을 포함하지 않습니다.

- 생성 입력: 증빙 92페이지.
- 평가 정답용 holdout: 작성된 법원 서류·요약표 24페이지.
- 행정문서 제외: 위임·경유확인 2페이지.

생성기에 holdout 이미지, OCR, 목표값, 목표값을 포함한 요약을 전달하지 않습니다. `.runtime/evaluation/split/`에는 증빙·제출본·행정문서를 각각 분리한 PDF와 원본 페이지 대응표가 있습니다.

평가는 두 층으로 구성됩니다. `evaluate_sample.py`는 11페이지에서 추출한 21개 scalar와 채권자 10행을 진단합니다. `submission_quality.py`는 **제출본 24페이지 전부에서 동결한 227개 체크(비교 가능 212개)**를 6종 DOCX의 실제 본문과 비교합니다. 부록이나 원본 인용에 값이 있거나, XLSX 추출값 시트에 데이터가 있다는 이유로 서류 본문 작성을 통과시키지 않습니다.

같은 `gpt-6-luna`를 사용하므로 모델 간 완전한 독립성이나 전문가 검증을 의미하지 않습니다. 평가 요청·프롬프트와 생성 요청을 분리하고, 공개된 fingerprint로 정답과 기준을 고정합니다.

## 실행

프로젝트 루트에서 실행합니다. API 키는 상위 폴더 또는 프로젝트의 `.env`에 있는 `OPENAI_API_KEY` / `OPEN_AI_API_KEY`로 읽으며 출력하지 않습니다.

```powershell
# 최초 1회: OpenAI API 유료 호출, store:false.
python evaluation/evaluate_sample.py --extract-gold
python evaluation/submission_quality.py --freeze-golden

# n8n 생성 결과를 .runtime/evaluation/generated.json으로 내보낸 뒤 비교.
python evaluation/evaluate_sample.py
python evaluation/submission_quality.py --generated .runtime/evaluation/generated.json

# 합성 데이터 회귀검사. API를 호출하지 않음.
python -m unittest discover -s evaluation -p "test_*.py" -v
```

정답 캐시는 `.runtime/evaluation/gold_*.json`과 `golden.json`에 저장됩니다. 재실행 시 기존 캐시를 사용합니다. `--force`는 모든 정답 요청을 다시 호출하며, `--refresh-batch creditors`처럼 특정 묶음만 갱신할 수도 있습니다. 샘플 SHA256이 분리표와 다르면 실행을 중단합니다.

본문 완성도 정답은 `.runtime/evaluation/golden_submission.json`, 그 fingerprint와 분모는 `submission_target_manifest.json`에 있습니다. 이를 반복 평가 중에 자동 갱신하지 않습니다. 결과 파일·채점 프롬프트가 같으면 private 채점 캐시를 재사용합니다. 파일이 바뀌면 동일 정답으로 다시 평가합니다.

평가 프롬프트는 `promptbook/evaluate-gold`와 `promptbook/evaluate-forms`의 system/body/config/schema 파일로 분리했습니다. 예시는 합성 데이터입니다. 정답 프롬프트를 편집해도 기존 동결된 정답을 자동 변경하지 않습니다. 재기준화가 필요하면 새 버전과 변경 사유를 명시하고 기존 기준을 보존해야 합니다.

## 생성 결과 계약

`generated.json`은 다음 정보를 포함합니다.

- `records`: `key`, `entity`, `label`, `value`, `state`, `sources[{document_id,page,...}]`.
- `calculations`: `key`, `label`, `value`, `status`, `sources`.
- `artifacts`: 실제 DOCX/XLSX의 `name`과 형식 등 메타데이터.
- `artifact_dir`: 산출물 파일이 있는 프로젝트 내부 경로.
- `evidence_pages_used`: 생성에 사용한 원본 PDF의 1부터 시작하는 페이지 번호 목록.

개별 채권은 `key=creditor_principal` / `creditor_interest`, `entity=채권자명`으로 비교합니다. 기관명은 공백·주식회사 표기 등을 제거한 정확 일치로 연결합니다. 모호한 유사 이름을 임의로 매칭하지 않습니다.

## 결과 해석

`report.json`·`REPORT.md`는 필드 진단이며, `submission_report.json`·`SUBMISSION_REPORT.md`가 실제 문서 본문 완성도 평가입니다. 모두 개인정보와 실제 목표·생성 금액을 제외합니다.

- 전체 목표 수, 비교 가능 수, 생성값이 있는 수를 각각 제시합니다.
- 일치, 차이, 보류·미생성, 정답 판독 불가를 구분합니다.
- 실제 DOCX의 본문과 부록을 구분하고 필드·반복행·진술·변제표가 해당 문서의 본문에 채워졌는지 검사합니다. 파일명 존재만으로 성공 처리하지 않습니다.
- 본문 채점의 일치 판정에는 실제 줄 번호와 정확한 발췌가 필요하며, 금액이 다르거나 미확인 자리표시자가 남으면 일치 판정을 취소합니다.
- 원본의 마스킹·공란, 법적 인정 판단 때문에 보류한 값, 계산 또는 문서 반영 오류를 구분합니다. 보류가 안전한 처리여도 실제 제출서류 완성도에서는 미완성입니다.
- 입력 페이지 목록과 결과 출처에 holdout 페이지가 들어갔는지 검사합니다.
- 채무 합계는 중복 채권 행을 합산하지 않으며, 충돌·누락된 원금/이자로 합계를 만들어내지 않습니다.

제출본과 다른 소득·생계비·청산가치·변제계획 값에는 법적 인정 판단이나 기준기간 차이가 있을 수 있습니다. 이 평가는 원본 추출·작성 상태를 드러내기 위한 것이며, 단일 사건 결과로 전체 정확도, 실제 법원 제출 적합성, 업무시간 20% 단축을 주장하지 않습니다.

검증용 상세값과 결과 파일은 Git에서 제외된 `.runtime/evaluation/`에만 보관합니다. 제품의 사건 세션 보관 정책과 별도로 사용자가 요청한 평가 실행의 로컬 산출물이며, 생성기 입력으로 재사용하지 않습니다.
