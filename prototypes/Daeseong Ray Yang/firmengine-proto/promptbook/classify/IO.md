# 분류 에이전트 입력·출력

`system.md`는 역할·데이터 취급 지시이고 `body.md`는 문서를 분류하는 작업 본문입니다. `input.example.json`과 `output.example.json`은 합성 예시입니다. 실제 사건 입력·출력은 `.runtime/sessions/<세션ID>/promptbook/classify/<호출ID>/`에서 확인합니다.

| 입력 필드 | 뜻 | 본문에서 사용하는 방식 |
| --- | --- | --- |
| `pages[].document_id` | 세션 안에서 원문을 식별하는 ID | `{{pages_json}}`에 포함 |
| `pages[].page` | 원본 PDF의 1부터 시작하는 페이지 번호 | `{{pages_json}}`에 포함 |
| `document_types` | 문서별 추출에 사용할 상세 유형과 뜻 | `{{document_types_json}}` |
| 이미지 첨부 | 위 목록의 각 페이지를 렌더링한 이미지 | 본문 뒤에 ID·페이지 라벨과 이미지가 순서대로 첨부됨 |

이미지 데이터 자체는 논리 입력 JSON이나 실행 기록에 복사하지 않습니다. 증빙 분리 PDF에서는 물리 페이지가 원본 페이지와 다를 수 있습니다. 출력은 원본 번호를 사용합니다.

| 출력 필드 | 뜻 |
| --- | --- |
| `pages[].document_id`, `pages[].page` | 분류 대상 원문의 ID와 원본 페이지 |
| `pages[].role` | `evidence`: 고객 증빙, `filed_form`: 작성 완료 제출양식, `administrative`: 위임·선임 등 행정서류, `unknown`: 판독 곤란·불명 |
| `pages[].title` | 개인 성명·금액 등을 포함하지 않는 일반 문서 제목 |
| `pages[].document_type` | 해당 페이지의 상세 문서 유형. 불명 자료는 `unknown` |

실행 기록의 `input.json`은 `logical_input`에 위 입력을, `sources`에 원래 파일명·원본/물리 페이지·이미지 라벨을 담습니다. `output.json`은 검증된 구조화 출력입니다. `meta.json`에서 사용한 프롬프트 버전·해시·모델·사용량을 확인할 수 있습니다. 요청이 실패하면 출력 파일이 없을 수 있습니다.
