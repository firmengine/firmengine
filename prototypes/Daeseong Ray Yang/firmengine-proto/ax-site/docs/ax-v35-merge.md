# FirmEngine AX v35 로컬 병합 기록

2026-10-29 기준, 저장소 루트의 `FirmEngine_AX_v35/`를 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`에 병합했습니다. 입력 디렉터리는 그대로 보존했습니다.

## 주요 변경점

| 영역 | 이전 AX와 비교한 v35 변경 |
| --- | --- |
| 상담·체크리스트 | 상담 기록·정정·revision·분류 실행 이력, 상황별 필요서류와 체크리스트 카탈로그 관리 API·화면 추가 |
| 기준자료 관리 | `/reference-data`와 기준자료 저장·조회·변경 경로 추가. 법령·필드 계약·산식·문서·프롬프트 등을 종류별로 조회하고 release와 해시로 관리 |
| 프롬프트 | 코드 내부 문자열을 `reference-prompt-policies.json`과 renderer로 이동. OCR 버전 `luna-evidence-3.20.0` → `3.21.0`; 상담 분류·법령 변경 점검용 정책 추가. 기본 seed와 실행 중 기준자료의 override를 구분 |
| 법령 변경 점검 | 원문 수집 provider, 관찰·변경 후보·알림·잠금·검토 상태 저장, 수동 실행 API와 MCP 연결 추가. 이 소스 병합이 예약 작업의 연결·발화를 설정한 것은 아님 |
| 계산기·MCP | 읽기 전용 계산 도구와 사건 계산 API, `/mcp`, 로컬 stdio MCP 실행 스크립트 추가. MCP server/client SDK와 `zod-mcp` 의존성 추가 |
| 계산·작성 흐름 | case-agent·계산 실행 계약·문서 작성 모듈 추가. 현재 사건·입력·기준자료 해시에 맞는 저장된 파생 평가를 출력 조건과 연결 |
| 평가 입력 | 구조화된 합성 사건과 참고 사건 가져오기·투영 경로, 관련 검증과 회귀 테스트 추가 |
| 서버·DB | 요청별 기준자료 context를 연결하는 `worker/index.ts` 추가. 상담·기준자료·법령 관찰 저장을 위한 마이그레이션 `0004`~`0006` 추가 |
| 정적 자료 | 공식 빈 HWP/PDF 템플릿 원본, PDF worker, 소스 검토 메모가 입력 디렉터리에 추가됨 |

새 기능과 관련된 대표 파일은 `lib/intake-*`, `lib/reference-*`, `lib/legal-monitor-*`, `lib/calculator-tools.ts`, `lib/case-agent.ts`, `lib/document-writer.ts`입니다. 계산·문서 작성은 결정론적 코드 경로이며 별도의 생성형 AI 노드가 아닙니다.

## 병합 방법과 보존한 내용

- 입력에만 있는 파일 113개와 내용이 달라진 파일 70개를 반영했습니다. 줄바꿈만 다른 기존 파일 225개는 기존 바이트를 유지했습니다. 삭제할 기존 애플리케이션 파일은 확인되지 않았습니다.
- 기존 `.gitignore`의 로컬 환경·개인 자료·산출물 제외 규칙을 유지했습니다. 공식 빈 서식과 생성 worker도 로컬에는 복사되지만 기존 제외 규칙을 따릅니다.
- `.openai/hosting.json`은 기존 `DB`·`BUCKET` 바인딩을 보존하고 `mcp` capability를 추가했습니다. 입력 디렉터리의 배포 프로젝트 ID는 가져오지 않았습니다.
- 기존 `n8n-reference/`를 보존하고 v35 정책·조합 방식에 맞게 다시 정리했습니다. 현재 AX에는 n8n 직접 호출 경로가 없습니다.
- README의 프롬프트 버전·페이지 목록·마이그레이션 범위를 실제 코드와 맞췄습니다.
- Windows에서 소스 검사에 UTF-8을 명시하고, 심볼릭 링크 생성 권한이 없는 환경에서만 관련 Python 테스트를 건너뛰도록 조정했습니다.
- Node 테스트 4개가 전역 기준정보 provider를 교체해 뒤의 테스트에 영향을 주던 문제를 고쳤습니다. 같은 `runWithReferenceSnapshot` 경계를 사용하도록 통일했으며, 기존 assertion 143개와 동시성 검증은 유지했습니다. 제품 코드는 이 수정으로 바꾸지 않았습니다.
- 다른 프로토타입의 기존 평가 수정 파일과 미추적 보고서는 변경하지 않았습니다.

푸시 전 원격 `2ee7f4d`까지의 새 커밋 5개를 통합했습니다. v35 구조를 유지하면서 원격의 보호 사건 ID 해시화와 비동기 상담 보호 검사, 대응 합성 테스트를 보존했습니다. 공개 소스의 샘플 설정·평가 설명도 원격의 일반화된 상태를 유지합니다. 비공개 원본에 연결된 `scripts/run-sample-evaluation.py`는 로컬에 보존하고 Git 추적에서 제외했습니다. n8n 참조 사본도 최종 통합 소스로 갱신했습니다.

병합 전 원본 백업은 저장소의 `.local/backups/ax-site-pre-v35-20261029T012840Z.zip`이며, 초기 파일 변경 목록은 같은 폴더의 `ax-site-v35-merge-20261029T012840Z.json`입니다. 현재 파일과 입력 원본의 해시는 [병합 manifest](ax-v35-merge-manifest.json)에 기록합니다.

기존 `SOURCE_MANIFEST.json`은 이전의 공개 소스 내보내기 이력으로 표시해 보존했습니다. 현재 로컬 소스 전체나 배포용으로 정제된 새 export를 나타내는 파일은 아닙니다.

## 검증

| 검사 | 결과 |
| --- | --- |
| 잠금 파일 기준 의존성 설치 | 완료. 저장소 내부 npm 캐시 사용 |
| TypeScript `tsc --noEmit --pretty false` | 통과 |
| 전체 Node 테스트 `node --experimental-strip-types --test --test-isolation=none tests/*.test.ts` | **751개 통과**, 실패·생략 0개 |
| Python `python -X utf8 -m unittest discover -s tests -p 'test_*.py' -v` | **12개 통과**, Windows 심볼릭 링크 권한 테스트 1개 생략 |
| `npm run build` | 프로덕션 빌드 통과. 신규 API·상담·기준자료·MCP 경로 포함 |
| SQLite 마이그레이션 | `0000`~`0006`을 메모리 DB에 순서대로 적용, 21개 테이블 확인 |
| 입력 원본 대비 파일 검사 | 430개 모두 로컬에 보존. 설정·문서·테스트 보정과 원격 보호 로직·공유용 샘플 설정을 통합 |
| 프롬프트 정리 자료 | 원본 사본 118개 SHA-256·JSON·상대 링크 검사, 정적 프롬프트 10개 독립 비교 통과 |
| 기존 로컬 작업 | 기존 평가 관련 파일 3개의 SHA-256 동일 |
| 변경 파일 공백 검사 | `git diff --check` 통과 |

Python 합성 PDF 테스트에는 Pillow·PyMuPDF·reportlab이 필요하며, 이번 실행은 누락된 reportlab만 저장소의 `.local/python-test-deps`에 설치해 사용했습니다.

빌드는 일부 클라이언트 chunk가 압축 전 500 kB를 넘는다는 경고를 남깁니다. 빌드 실패는 아니며, 이번 병합에서는 v35의 번들 구성을 별도로 바꾸지 않았습니다. 브라우저 화면과 API 키를 사용하는 실제 OCR은 실행하지 않았습니다.

## 실행 환경에 반영할 때

기존 DB에 `0003`까지 적용했다면 `0004_broken_gorgon.sql`, `0005_sudden_the_twelve.sql`, `0006_legal_reference_monitor.sql`을 순서대로 추가 적용해야 합니다. 이번 작업에서는 실제 D1·운영 데이터·배포 상태를 변경하지 않았습니다.

기준자료는 약 20 MB의 정적 seed와 실행 중 저장된 override를 사용합니다. 원문 관찰·AI 확인·검토 승인·법적 판단은 별도 상태입니다. API 키를 사용한 실제 OCR 실행과 운영 환경의 예약 점검은 이번 로컬 병합 검증 범위에 포함하지 않았습니다.
