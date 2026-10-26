# 시간·출처가 보존되는 지식 모듈

`app/knowledge.py`는 공통 SQLite의 `knowledge_*` 테이블과 `.runtime/vector-db`의 Qdrant local 저장소를 사용한다. `seed_defaults()`는 이 디렉터리의 bootstrap만 읽는다. 이전 설계 디렉터리는 실행 의존성이 아니다.

원문 버전에는 내용 해시, 유효 시작·종료일, 기록일, 권한 범위, 테넌트, 출처 사건, 출처 묶음 해시를 보존한다. `as_of`는 법적 적용 시점이며 `known_at`은 당시 수집되어 있던 지식으로 재현할 때 사용하는 별도 조건이다. 시행일을 확인하지 못한 원문은 수집일부터 참고용으로만 검색한다. 기존 버전을 덮어쓰지 않는다.

`search(query, as_of, case_id, exclude_bundle_hashes, tenant_id, limit=3)`는 SQL에서 시간·권한·같은 사건/원본묶음 제외와 최신 적용 버전을 먼저 선택하고, 그 버전 ID를 Qdrant 필터에 넣은 뒤 유사도를 계산한다. 최대 1,200자 청크의 필요한 결과만 반환한다. 현재 샘플 묶음은 공통 검색에서 상시 제외하며 평가 정답 종류의 입력은 거부한다. `register_case_bundle()`로 추가 사건의 원본 해시도 등록한다.

컬렉션은 `legal_norms`, `practice_rules`, `case_observations`, `fewshot_success`다. 임베딩은 실제 OpenAI `text-embedding-3-small`, 변경 요약은 `gpt-6-luna`를 사용한다. `EMBEDDING_MODEL`과 `EMBEDDING_DIMENSIONS`로 임베딩 설정을 바꿀 수 있다. 모델 변경 후에는 새 임베딩 인덱스가 필요하다. Qdrant 또는 API가 준비되지 않으면 `vector_ready=false`이며 진단용 어휘 검색 결과에도 `retrieval_status=vector_unavailable`을 붙인다. 가짜 벡터를 만들지 않는다. 초기 few-shot은 **가상 처리 예시**이며 실제 성공사례라고 표시하지 않는다. 검토된 성공사례는 추후 별도 출처·유효기간·묶음 해시를 지정해 등록한다.

Qdrant local은 단일 앱 프로세스에서 사용한다. 같은 경로를 여러 프로세스가 동시에 여는 배포는 지원하지 않는다. 같은 프로세스에서는 경로별 싱글턴과 잠금을 사용하고 종료 시 `close_vector_client()`를 호출한다.

`check_updates()`는 기본적으로 작은 공식 페이지 4개를 제한 시간과 캐시 헤더로 검사한다. API 인증값이 있으면 공식 법령 목록 API도 검사한다. 큰 PDF는 기본 자동 요청에서 제외한다. 새 공식 원문은 불변 버전과 로컬 알림으로 남고 벡터 인덱스에 추가된다. n8n의 매일 09:00 Asia/Seoul 트리거는 이 메서드를 호출하는 API를 실행한다. 원문 갱신은 계산 승인과 별개다.

자동 계산 반영은 현재 `KR.579.DEBT_LIMITS`의 검토된 두 개별 상한 비교만 지원한다. 명시적 시행일, 공식 출처, 기존과 같은 의미의 문장 구조, 허용 숫자 형식·범위, 경계 회귀검사를 통과해야 한다. 미래 시행 버전은 예약 상태로 보존하며 `active_parameters(as_of=...)`에서 시행 전 선택하지 않는다. 새 예외·의미 변경·현재가치·인정생계비 같은 미구현 법적 판단은 `review_required`다. LLM 프리뷰는 실행 권한이 없고 임의 코드를 평가하지 않는다. 각 사건의 이미 생성된 산출물과 이전 지식 스냅샷을 수정하지 않는다.

`bootstrap/correction_catalog.json`은 공통 서류 22, 조건부 증빙 28, 추가명령 12, 누락 탐지 24와 제품 정책·판례 관찰을 포함한 95개 항목이다. 실행 가능한 검사와 수동 검토가 구분된다. 이는 확인한 자료의 범위이며 모든 법률·세무·거래 예외를 망라한다는 의미가 아니다. 50만원 거래 기준은 사용자 업무정책이다.

검증: `python -m unittest tests.test_knowledge -v`. 공식 출처와 원문 적용 경계는 [source_notes.md](source_notes.md)에 정리했다. 실제 벡터 준비 여부와 각 컬렉션의 청크 수는 `status()`로 확인한다.
