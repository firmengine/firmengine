# Local workflow boundary

`npm run n8n` 또는 `python scripts/run_n8n.py`가 이 프로토타입만의 `.local/n8n` DB를 준비하고 계산 workflow를 가져오기·게시한 뒤 실행합니다. 앱은 `http://127.0.0.1:5681`, JS Task Broker는 `5682`입니다. 기존 n8n의 기본 저장소·워크플로·포트를 변경하지 않습니다. 로컬 npm 의존성, `N8N_BIN`, 전역 설치 또는 이미 설치된 npm npx cache 순서로 실행파일을 찾습니다. 없으면 `npm install`로 설치합니다.

`calculators.js`의 같은 원문을 `build_workflows.py`가 Code 노드에 넣습니다. 파일 수정 후에는 n8n을 종료하고 runner를 다시 실행하세요. 현재 판본을 다시 가져오기·게시하고 시작합니다. 실행 결과의 코드 SHA가 로컬 파일과 다르면 API는 결과 채택을 거부합니다. JSON만 변경해 원본 JS와 분기시키지 마세요.

생존(`/healthz`), 준비(`/healthz/readiness`), 실제 production Webhook 등록(`/webhook/firmengine-retry/calculate`)을 따로 확인합니다. n8n이 준비되지 않았을 때에는 같은 JS를 로컬 Node로 실행하고 `engine=local-node`와 경고를 남깁니다. 이를 n8n 실행 성공으로 표시하지 않습니다. 시작 지연이 사건 추출 재시도 예산을 소진하지 않습니다.

계산 범위는 확정한 월별 소득·경비, 기간 평균, 사용자 검토 생계비·공제, 재산 순가치, 명목 변제총액, 우선채권 확인 후 일반채권 배분입니다. 원·월 단위를 유지하고 정수/BigInt 산술을 사용합니다. 미확인값을 0으로 채우지 않습니다. 담보·다툼·재단·비면책 채권 및 별도 법적 예외는 개별 검토로 보류합니다. 현재가치 할인·청산가치 법적 예외의 전체 자동화가 완료되었다는 뜻은 아닙니다.

`law-watch.json`은 Asia/Seoul 09:00에 로컬 API의 공식 원문 지문 갱신을 호출하는 **비활성** workflow 정의입니다. n8n에서 가져오기·게시한 경우에만 발화합니다. 원문 변경 검출은 법적 의미·산식의 자동 승인과 다릅니다. 실제 일일 발화 여부는 별도 확인이 필요합니다.

이번 로컬 검증은 n8n 2.39.8과 JS Task Runner로 수행했습니다. Python runner는 사용하지 않습니다. 공식 CLI의 가져오기·게시와 내부 runner 구성은 [CLI](https://docs.n8n.io/hosting/cli-commands/), [Task Runner 설정](https://docs.n8n.io/hosting/configuration/environment-variables/task-runners/)을 참고하세요.
