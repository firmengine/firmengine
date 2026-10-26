# Promptbook

`classify`, `extract`는 실제 Responses API 호출에 연결되어 있습니다. 나머지 다섯 역할은 편집 가능한 역할 정의이며 현재 API 호출 자동화가 연결되었다는 뜻은 아닙니다. 생성 문서의 값·산술은 결정론적 템플릿과 Code 계산으로 작성합니다.

각 호출은 디스크의 `system.md`, `body.md`, `config.json`을 다시 읽습니다. 프롬프트 해시·버전, 최소 입력, 출력·사용량·시도 수를 호출자가 비공개 사건 DB에 저장합니다. API 키와 원본 이미지 base64, 내부 사고과정은 감사 기록에 넣지 않습니다. 이미지 근거는 원본 문서·페이지와 이미지 해시로 연결합니다.

거래 반복 행이 많은 페이지의 추출 출력은 `FIRMENGINE_EXTRACT_OUTPUT_TOKENS`(기본 12,000, 최대 24,000)로 제한합니다. 잘린 응답은 성공으로 채택하지 않으며 미완료 사유와 실제 사용량을 남깁니다. 실행 출력 예산 변경만으로 성공한 페이지의 의미상 동일 추출 결과를 다시 호출하지 않습니다.

프로젝트/상위 `.env`의 `OPENAI_API_KEY` 또는 `OPEN_AI_API_KEY`를 사용합니다. 모델은 `OPENAI_MODEL`/`OPEN_AI_MODEL` 또는 기본 `gpt-6-luna`입니다. 키는 화면·워크플로 JSON에 기록하지 않습니다. Responses 요청은 `store:false`이며 이 설정을 외부 서비스 전체 보관 정책 검증으로 간주하지 않습니다.

현재 데이터 흐름은 페이지 역할 허용 → 미분류 증빙 분류 → 문서별 feature 추출 → 문자층 인용 대응 확인 → 담당자 후보 채택입니다. evaluation/administrative/unknown으로 명시한 페이지는 읽기·API 입력에서 제외합니다. AI 추출 후보는 법적 인정 확정값이 아닙니다. 없는 값과 판독 불가를 별도로 보고합니다.

공식 참고: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [이미지 입력](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses), [구조화 출력](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
