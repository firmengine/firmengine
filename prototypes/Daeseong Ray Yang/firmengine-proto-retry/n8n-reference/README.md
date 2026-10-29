# Proto Retry · n8n 설정과 프롬프트 모음

`firmengine-proto-retry`의 워크플로 JSON, 실행 설정, 프롬프트를 함께 확인하기 위한 참조 사본입니다. 실행은 상위 프로젝트에서 합니다. 이 폴더의 사본을 수정해도 실제 앱 설정이나 프롬프트에는 반영되지 않습니다.

Retry의 n8n은 **결정론적 계산**과 **공식 원문 변경 조회**를 담당합니다. 문서 분류·추출 프롬프트는 Python 앱에서 OpenAI Responses API로 호출합니다. n8n JSON 안에는 AI 프롬프트 노드가 없습니다. 호출 관계와 조건은 [NODE_MAP.md](NODE_MAP.md)에 정리했습니다.

## 파일 위치

| 위치 | 내용 |
| --- | --- |
| [workflows/calculations.json](workflows/calculations.json) | 실제 가져오기용 계산 워크플로: Webhook → Code |
| [workflows/law-watch.json](workflows/law-watch.json) | 서울시간 매일 09:00 공식 원문 조회: Schedule → HTTP Request |
| [workflows/calculators.js.txt](workflows/calculators.js.txt) | Code 노드와 로컬 Node 대체 실행이 공유하는 계산 원문 |
| [workflows/build_workflows.py.txt](workflows/build_workflows.py.txt) | 계산 원문으로 두 JSON을 생성하는 코드 사본 |
| [prompts/classify/](prompts/classify/) · [prompts/extract/](prompts/extract/) | 현재 Python 앱이 실제 호출하는 프롬프트 |
| [prompts/validate/](prompts/validate/) · [prompts/judge/](prompts/judge/) · [prompts/draft/](prompts/draft/) · [prompts/law_update/](prompts/law_update/) · [prompts/evaluate/](prompts/evaluate/) | 편집 가능한 역할 정의. 현재 자동 호출 경로는 없음 |
| [settings/](settings/) | 실행기·의존성 설정의 소스 사본 |
| [manifest.json](manifest.json) | 원본 경로·기준 커밋·SHA-256 |

각 프롬프트 폴더에는 `system.md`, `body.md`, `config.json`, `input.schema.json`, `output.schema.json`, `example.json`이 있습니다. 실제 로더는 [app/ai.py](../app/ai.py)의 `read_prompt()`입니다. 예시 파일은 런타임에서 자동으로 프롬프트에 추가되지 않습니다.

## 실행 방법

아래 명령은 `firmengine-proto-retry` 디렉터리에서 실행합니다. Python 3.11 이상과 Node.js 22.16 이상이 필요합니다. 저장소의 [package.json](../package.json)은 선택 의존성으로 n8n `2.39.8`을 지정합니다. 설치된 다른 실행기를 선택하는 경우 실제 버전은 달라질 수 있습니다.

```powershell
python -m pip install -r requirements.txt
npm install
python scripts/run_local.py
```

`npm start`도 같은 로컬 실행기를 호출합니다. 기본 웹 주소는 `http://127.0.0.1:8091`, n8n 편집기는 `http://127.0.0.1:5681`입니다. `Ctrl+C`는 실행기가 만든 자식 프로세스를 종료합니다.

계산용 n8n만 실행하려면 다음 명령을 사용합니다.

```powershell
python scripts/run_n8n.py
```

실행기는 `N8N_BIN` → 프로젝트 `node_modules` → 전역 실행기 → 기존 npm npx 캐시 순서로 실행기를 찾습니다. 워크플로 JSON을 다시 만들고 계산 워크플로 `FirmEngineRetryCalc001`을 가져오기·게시한 뒤 n8n을 시작합니다. 동일 노드가 이미 게시되어 있으면 재사용합니다. [scripts/run_n8n.py](../scripts/run_n8n.py)의 `--prepare-only`는 가져오기·게시까지만 수행하며 서버를 시작하지 않습니다.

`law-watch.json`은 생성만 됩니다. 로컬 실행기가 이 워크플로를 자동으로 가져오기·게시하지 않으므로, 예약 실행을 사용하려면 별도로 가져오기·게시하고 실제 발화를 확인해야 합니다. JSON의 `active:false`는 저장된 정의의 상태이며 현재 실행 중인 인스턴스의 활성 상태를 보여주지 않습니다.

계산 JS를 수정했다면 기존 n8n을 종료하고 실행기를 다시 시작합니다. [workflows/build_workflows.py](../workflows/build_workflows.py)는 `calculators.js`의 `NODE_ADAPTER_START` 앞부분을 Code 노드에 넣고 전체 JS 파일의 SHA-256을 결과에 포함합니다. 앱은 이 해시가 현재 로컬 JS 파일과 다른 결과를 채택하지 않습니다.

## 포트와 n8n 기본 설정

아래는 소스에 적힌 기본값입니다. 실제 프로세스·환경변수·비밀 설정의 현재 상태는 조회하지 않았습니다. 근거: [scripts/run_local.py](../scripts/run_local.py), [scripts/run_n8n.py](../scripts/run_n8n.py), [app/pipeline.py](../app/pipeline.py).

| 항목 | 기본값 또는 동작 |
| --- | --- |
| 앱 포트 | `FIRMENGINE_PORT=8091`; `run_local.py --port`로 지정 가능 |
| 앱의 n8n 접속 주소 | `FIRMENGINE_N8N_URL=http://127.0.0.1:5681` |
| n8n 실행 포트 | `run_n8n.py --port 5681`; 앱 접속 주소와 별도 설정 |
| JS Task Broker | n8n 포트 + 1, 기본 `5682` |
| 바인딩 | 앱, n8n, Broker 모두 `127.0.0.1` |
| n8n 데이터 폴더 | `N8N_USER_FOLDER=<프로젝트>/.local/n8n`; DB 조회 경로는 `.local/n8n/.n8n/database.sqlite` |
| n8n 주소 | `N8N_HOST=127.0.0.1`, `N8N_PROTOCOL=http`, `N8N_EDITOR_BASE_URL=http://127.0.0.1:<포트>`, `WEBHOOK_URL=http://127.0.0.1:<포트>/` |
| 시간대 | `GENERIC_TIMEZONE=Asia/Seoul`, `TZ=Asia/Seoul`; 두 JSON의 `settings.timezone`도 동일 |
| 실행기 | `N8N_RUNNERS_ENABLED=true`; JS Task Runner 사용 |
| 진단·버전 알림·템플릿 | `N8N_DIAGNOSTICS_ENABLED=false`, `N8N_VERSION_NOTIFICATIONS_ENABLED=false`, `N8N_TEMPLATES_ENABLED=false` |
| 쿠키·로그 | 로컬 HTTP용 `N8N_SECURE_COOKIE=false`; `N8N_LOG_LEVEL` 기본 `info` |
| 실행 데이터 저장 | 성공·실패 `none`, 수동 실행 저장 `false`; JSON에도 저장 정책 명시 |

앱이 n8n 준비 여부를 확인하는 순서는 `/healthz` → `/healthz/readiness` → 빈 입력의 `POST /webhook/firmengine-retry/calculate`입니다. 실제 계산 결과는 `engine=n8n-code`와 코드 해시로 식별합니다. Webhook이 준비되지 않았으면 같은 JS를 로컬 Node로 실행하고 `engine=local-node` 및 경고를 기록합니다. `run_local.py --without-n8n`은 n8n 시작을 생략하며, 이미 접속 가능한 Webhook이 있으면 계속 사용할 수 있습니다.

포트를 바꿀 때는 연결되는 항목도 맞춰야 합니다. `FIRMENGINE_N8N_URL` 변경만으로 n8n 실행기의 포트가 바뀌지는 않습니다. 앱 포트를 변경해도 `law-watch.json`의 HTTP URL은 자동 변경되지 않으며 기본 `http://127.0.0.1:8091/api/knowledge/refresh`를 그대로 사용합니다.

## AI 설정의 기본값

근거는 [app/ai.py](../app/ai.py)의 `settings()`와 `call_agent()`, [app/pipeline.py](../app/pipeline.py)의 `extract_document()`입니다. 여기에는 환경변수 이름과 코드 기본값만 정리했습니다.

| 환경변수 | 기본값·적용 범위 |
| --- | --- |
| `OPENAI_API_KEY` / `OPEN_AI_API_KEY` | 키 값은 포함하지 않음. 앞 이름 우선; 미설정이면 AI 추출 대신 수동 확인 상태 |
| `OPENAI_MODEL` / `OPEN_AI_MODEL` | `gpt-6-luna`; 앞 이름 우선 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `FIRMENGINE_AI_TIMEOUT` | `90`초 |
| `FIRMENGINE_AI_RETRIES` | `1`, 허용 범위 `0~3`; 재시도 가능한 HTTP·연결 오류에 적용 |
| `FIRMENGINE_AI_CONCURRENCY` | `3`, 허용 범위 `1~8` |
| `FIRMENGINE_EXTRACT_OUTPUT_TOKENS` | `12000`, 허용 범위 `1000~24000`; 추출 호출 출력 예산 |
| `FIRMENGINE_PAGE_CONCURRENCY` | `2`, 허용 범위 `1~8` |
| `FIRMENGINE_DOCUMENT_CONCURRENCY` | `2`; 문서 작업 병렬 수, `app/main.py`에서 읽음 |
| `FIRMENGINE_MAX_PAGES` | `200`, 최소 `1`; 문서 실행당 물리 페이지 한도 |
| `FIRMENGINE_REEXTRACT_MISSING` | `1`; 누락 키에 한정한 추가 추출 허용 |

AI 설정 로더는 상위 디렉터리부터 프로젝트까지 `.env`를 읽어 가까운 파일을 우선하고, 마지막으로 실제 환경변수를 덮어씁니다. 이 정리 작업에서는 해당 파일이나 키 값을 읽지 않았습니다. 실행기 포트·n8n 주소 등은 `os.environ`에서 직접 읽으므로 AI 로더의 `.env` 탐색과 구분해야 합니다.

현재 `classify/config.json`과 `extract/config.json`의 버전은 `retry-prompt-1.0.0`입니다. 분류 출력 예산은 config의 `1800`을 사용합니다. 추출 config의 `6000` 대신 `FIRMENGINE_EXTRACT_OUTPUT_TOKENS`가 적용됩니다. config의 `retries`가 아니라 런타임 `FIRMENGINE_AI_RETRIES`가 실제 요청 재시도를 제어합니다.

요청마다 원본 `promptbook/`의 파일을 다시 읽고 `system.md`를 `instructions`에, `body.md`와 JSON 입력을 사용자 텍스트에 넣습니다. 출력 schema 파일에 `properties`가 있으면 호출자가 넘긴 schema보다 우선합니다. 요청은 `store:false`이며, 완료되지 않은 응답은 성공으로 채택하지 않습니다.

## 확인 범위

소스와 JSON을 읽어 설정·호출 관계를 정리했습니다. n8n·웹 서버·OpenAI API·예약 작업은 실행하지 않았습니다. 실제 운영 상태 확인은 이 참조 사본 생성과 별개입니다.

AX 기준 묶음은 [별도 정리 폴더](../../firmengine-proto/ax-site/n8n-reference/README.md)에 있습니다. 사본을 갱신하려면 그 폴더의 `python refresh.py`를 실행합니다. 두 프로젝트의 원본을 읽어 함께 갱신하며, 이 폴더의 안내 문서는 유지합니다. 소스 사본은 `.txt`로 보관했습니다. 환경파일·키·n8n 데이터·실제 사건과 실행 기록은 복사하지 않았습니다.
