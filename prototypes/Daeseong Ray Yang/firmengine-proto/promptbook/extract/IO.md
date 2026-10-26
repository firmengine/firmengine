# 추출 에이전트 입력·출력

1.2.0은 모든 입력 페이지를 전사한 뒤 문서별 허용 키에 맞는 사실을 원문 근거와 함께 추출합니다. 누락 feature만 제한적으로 다시 확인합니다. 편집할 파일은 `system.md`, `body.md`, `config.json`입니다. 실제 호출 데이터는 `.runtime/sessions/<사건ID>/promptbook/extract/<호출ID>/`에만 저장합니다. 이 디렉터리의 JSON 예시는 합성 데이터입니다.

| 입력 필드 | 뜻 | 본문 자리표시자 |
| --- | --- | --- |
| `pages[]` | `document_id`와 원본의 1부터 시작하는 `page` | `{{pages_json}}` |
| `allowed_key_labels` | 로컬 문서 매핑과 feature catalog에서 골라낸 작업별 키와 의미 | `{{allowed_keys_json}}` |
| `review_only_keys` | 인간의 검토·정책 선택이 필요한 키. `config.REVIEW_ONLY_KEYS`에서 제공 | `{{review_only_keys_json}}` |
| `document_type` | 이 작업에서 다루는 상세 문서 종류 | `{{document_type_json}}` |
| `reference_context` | 용어 해석용 검색 결과 최대 3개. 사건 사실의 증거가 아님 | `{{reference_context_json}}` |
| `extraction_pass` | `initial` 또는 `missing_features` | `{{extraction_pass_json}}` |

각 페이지 이미지가 본문 뒤에 라벨과 함께 첨부됩니다. 이전 제출서류의 값을 정답으로 제공하지 않습니다. 페이지별 이미지 전체는 실행 기록에 중복 저장하지 않습니다.

출력은 세 부분입니다.

| 출력 | 내용 |
| --- | --- |
| `pages[]` | 모든 입력 페이지를 정확히 한 번씩 전사한 목록 |
| `facts[]` | 자료에서 확인한 개별 사실과 짧은 원문 근거 |
| `warnings[]` | 읽기 어려운 부분이나 추출의 한계 |

`pages[]`의 필드는 다음과 같습니다.

| 필드 | 뜻 |
| --- | --- |
| `document_id`, `page` | 원문 ID와 원본 페이지 번호 |
| `title` | 일반 문서 제목 |
| `kind` | 소득증명·채무증명·계좌내역 등 보이는 문서 유형 |
| `transcript` | 제목·본문·표의 행/열·주석·판독 가능한 수기 등을 포함한 전체 전사문. 판독 불가 부분은 그 사실을 표시 |

`facts[]`의 필드는 다음과 같습니다.

| 필드 | 뜻 |
| --- | --- |
| `key` | 허용 목록에 있는 필드 키 |
| `entity` | 채권자·사업체·계좌·자산 등 사실의 대상. 신청인 식별 필드는 빈 문자열 |
| `value` | 확인한 값의 문자열 또는 `null`. 금액은 명시된 단위를 환산한 정확한 원화 정수 문자열 |
| `unit` | 금액의 `KRW` 등 원문 값의 단위 |
| `period` | 해당 사실의 기준일·귀속연도·월 등. 서로 다른 기간을 합치지 않음 |
| `document_id`, `page` | 사실을 뒷받침하는 원문 ID와 원본 페이지 |
| `quote` | 값을 직접 입증하는 원문의 짧은 인용 |
| `confidence` | `high`, `medium`, `low` |

전사문에 법률 선택이나 과거 계획이 등장하더라도 현재의 승인 값으로 확정하지 않습니다. 발급기관과 실제 채권자, 신청인과 대표자, 계좌명의자와 담보소유자도 구분해야 합니다. `review_only_keys`의 값은 사실 추출 결과에서 제외합니다.

실제 `output.json`은 스키마 검증을 통과한 원출력 전체입니다. 이후 앱은 금지 키·범위를 벗어난 출처·근거 없는 사실을 필터링합니다. `extract` 반환값은 목록처럼 사용하는 `ExtractedFacts`이며, `.pages`에는 페이지 전사문 목록이 있습니다. 입력 페이지 누락·중복·다른 번호·빈 전사문은 작업 실패로 처리합니다.

편집 결과를 비교할 때는 호출 기록의 `system.md`, 치환된 `body.md`, `input.json`, `output.json`, `meta.json`, `usage.jsonl`을 함께 확인하세요. 사건 닫기와 재시작은 저장된 사건을 삭제하지 않습니다. 명시적으로 사건을 삭제한 뒤에는 늦은 응답이 기록을 재생성하지 않습니다. [실행 한도와 반환값 설명](RUNTIME.md)에서 범위·한계를 확인할 수 있습니다.
