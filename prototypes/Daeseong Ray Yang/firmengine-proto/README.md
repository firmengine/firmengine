# Firm Engine · 개인회생 사건 작업공간

의뢰인 증빙을 사건별로 보관하고, 문서유형별로 사실과 원문 근거를 추출한다. n8n Code의 결정론적 계산과 필요증빙·위험 체크를 거쳐 필수 조건이 해결된 경우 편집형 법원 서류를 생성한다. 생성 후 담당자·변호사 검수를 별도로 기록한다.

현재 데이터 모델·흐름도·구현 한계는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)에 있다. 합성 검증과 실제 제출본 품질 평가는 구별한다. 법원 인가확률을 수치로 예측하지 않는다.

## 로컬 실행

Python 3.11+, Node.js 20.19~24.x. 현재 n8n 2.45.3을 사용한다.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd ci --no-audit --no-fund
.venv\Scripts\python.exe scripts/run_local.py
```

설치 후에는 `start-local.cmd`로 실행할 수 있다.

- 웹 작업공간: <http://localhost:8010>
- n8n 편집기: <http://localhost:5679>
- API 문서: <http://localhost:8010/docs>

최초 n8n 접속 때 로컬 소유자 계정을 설정한다. 실행기는 기존에 같은 내용으로 게시된 워크플로를 재사용한다. 구현을 변경해 관리형 워크플로를 갱신할 때는 `python scripts/run_local.py --upgrade-workflows`를 사용한다. 기존 정의를 `.runtime/workflow-backup-*.json`으로 백업한 뒤 가져와 게시한다. 실행 터미널의 `Ctrl+C`로 서버를 종료해도 사건·원본·생성물은 유지된다.

## 환경과 에이전트 설정

상위 `../.env`, 프로젝트 `.env`, 환경변수 순으로 읽는다. `OPENAI_API_KEY`와 `OPEN_AI_API_KEY` 별칭을 지원한다. 키는 UI와 워크플로 JSON에 넣지 않는다.

```dotenv
OPENAI_MODEL=gpt-6-luna
CASE_CONCURRENCY=2
OCR_CONCURRENCY=3
OCR_BATCH_PAGES=4
API_PORT=8010
N8N_PORT=5679
```

실제 모델은 GPT-6 Luna이며 `store:false`로 호출한다. 원본 PDF 전체를 Files API에 올리지 않고 의뢰인 증빙 페이지 이미지를 보낸다. 임베딩은 `text-embedding-3-small`을 사용한다.

[promptbook/README.md](promptbook/README.md)와 에이전트별 `system.md`, `body.md`, 입력·출력 스키마·예시·`config.json`을 편집하면 다음 호출부터 적용된다. 배치 크기, 입력/출력 토큰 예산, 전역·에이전트 동시성, 타임아웃, 재시도 한도도 설정한다. 실제 호출의 입력·출력·시스템 지시·본문·사용량은 Git 제외 경로 `.runtime/sessions/{case_id}/promptbook/`에 남는다. 프롬프트 본문에는 실제 사건 자료를 복사하지 않는다.

## 사건 처리

1. 사건을 생성하고 소득유형·신청 기준일을 지정한다. 사업·근로·혼합 소득과 개별 소득원을 구분한다.
2. 의뢰인 자료를 업로드한다. 페이지 역할·서류유형 분류와 문서별 최소 필수 피처 추출을 병렬 처리한다. 법원 제출 완료본은 생성 입력에서 제외한다.
3. 문서 종류·증명 대상·자료 기간과 추출값·원문 근거를 확인한다. 값 정정·채택·철회는 이전 버전을 보존한다.
4. 계산 근거, 95개 위험 항목의 해당성·확인 상태, 대체 증빙과 추가 준비 요청을 확인한다. 변경마다 같은 사건을 다시 평가하고 이전 실행 결과는 최신 버전을 덮어쓰지 않는다.
5. 자산 시세를 별도 평가 후보로 조회하고 근거·기준일을 검토한다. 처분 가정은 매각대금·담보상환·비용·잔여 현금을 추적한다.
6. 필수 조건이 해결되면 적용되는 DOCX와 계산·검토 XLSX를 생성한다. 미해결 경고는 위험 이력과 함께 제공한다. 필수 조건 미해결이면 생성하지 않고 추가 자료·준비 사항을 안내한다.
7. 생성된 필드의 원본 사실을 수정하고 재생성할 수 있다. 계산 항목은 원본 값을 수정해 재계산한다. 현재 생성본 삭제는 이력을 보존하는 보관 처리다.
8. 실제 생성본의 해시에 묶인 담당자 검수, 변호사 최종 검수를 진행한다. 검수 후 값·생성물이 바뀌면 이전 검수는 무효화된다. 법원 제출 노드는 없다.

기본 규칙 판본은 `REVIEW_REQUIRED`다. 공식 원문·시행일·예외와 적용 산식을 확인하는 명시적 검토가 필요하며, AI가 이를 자동 승인하지 않는다. 로컬 확인자 이름 입력은 운영용 사용자 인증·권한을 대신하지 않는다.

## 저장·법령·자산 연결

SQLite 원장: `.runtime/firmengine.sqlite3`. 의뢰인 보관함과 법원 생성물 보관함은 `.runtime/storage/cases/{case_id}/incoming|outgoing/`으로 분리한다. 저장소 참조는 provider·namespace·key·version·sha256으로 구성하며 Google Drive/GCS 어댑터를 추가할 수 있다. 실제 Google Workspace 연동과 다중 사용자 권한은 아직 구현하지 않았다.

Qdrant는 법령·준칙·사례 관찰·검토된 성공사례 컬렉션을 분리한다. 검색 전에 적용일·권한·테넌트·동일 사건 및 동일 자료 묶음을 걸러내고 최대 3개 근거만 전달한다. 실제 검토된 성공사례 컬렉션은 아직 비어 있다. n8n 일일 09:00 법령 갱신 스케줄은 로컬 서버 실행 중 동작한다. 검증된 채무한도 수치 변경만 자동 계산에 연결하며 새 의미·예외는 검토 대상으로 남긴다.

자산 조회는 다음을 구분한다.

- `manual_evidence`: 문서/출처·기준일이 있는 수동 평가 후보.
- `car365_reference`: 소유자 인증 조회 안내. 차량번호만으로 조회 성공을 가장하지 않는다.
- `molit_apartment`: `MOLIT_API_KEY` 또는 공공데이터 키와 `lawd_cd`, `deal_ymd`가 필요한 실거래 비교. 거래가격을 자동 감정가로 채택하지 않는다.
- `configured_vehicle_api`: 신뢰한 환경 설정 URL과 선택적인 `VEHICLE_VALUATION_API_KEY`로 연결하는 차량 시세 제공자.

## 양식과 평가

`templates/`에는 공개 빈 양식을 바탕으로 한 편집형 템플릿이 있습니다. 실제 제출 전에는 해당 법원의 항목·배치·첨부 요건을 검토해야 합니다.

실제 샘플 PDF와 그 자료에서 나온 페이지 목록·사례 정보·평가 결과는 공개 저장소에서 제거했습니다. 평가 도구는 별도로 승인된 비공개 입력을 준비한 경우에만 실행할 수 있습니다. [평가 자료 관리](evaluation/README.md)를 참고하세요.

## 검증

```powershell
python -m unittest discover -s tests -q
python -m compileall -q app scripts evaluation
node --check static/app.js
node --check static/workspace.js
python scripts/browser_smoke.py
```

합성 검증은 실제 모델 호출 없이 버전·자료 분리·계산·생성 차단·파일 해시·검수와 UI 계약을 확인한다. 실제 제출 문서 품질은 별도 독립평가로 판단한다.
