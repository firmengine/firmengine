# Firm Engine — 개인회생 사건 워크스페이스

개인회생 증빙을 페이지별로 분류·추출·재검증하고, 출처를 보존한 사건 데이터와 법률 검토 항목을 바탕으로 검토용 DOCX/XLSX/ZIP을 생성하는 비공개 Sites 앱입니다.

원형: [firmengine/firmengine](https://github.com/firmengine/firmengine), `prototypes/Daeseong Ray Yang/firmengine-proto` 및 `firmengine-proto-retry`. 원형의 서류·리스크 분류, 거래 검토와 감사 추적 구조를 참고하여 보완했습니다.

## 버전 메모

- 추출·검증 prompt `luna-evidence-3.21.0`은 기준자료의 프롬프트 정책을 렌더링하고 공통 record category 상태를 추출 및 독립 검증에 포함합니다. typed projection과 source receipt는 record 단위 category consensus가 지원될 때만 새 검증 경로에서 진행됩니다.
- 페이지 재투영 계약은 `source-projection-2026-10-28.17`입니다.
- 현재 소스는 `FirmEngine_AX_v43_source_20261029/source/`의 배포 소스 커밋 `72b23f2c3faee5656caeeb1e6e6afce9a65de3cb`를 병합한 버전입니다. [v43 병합 기록](docs/ax-v43-merge.md)과 [원본 배포·파일 증빙](docs/releases/ax-v43/README.md)을 함께 보관합니다.
- 이전 [v35 병합 기록](docs/ax-v35-merge.md)은 이력으로 유지합니다. 현재 프롬프트와 기존 n8n 연결 관계는 [별도 정리](n8n-reference/README.md)에서 확인할 수 있습니다.

## 현재 검증 범위

- 실제 출력 파일을 만드는 구현입니다. 합성 사건으로 DOCX 표·XLSX 셀·해시를 독립 검사했습니다.
- **사용자 제공 실제 샘플의 정확도는 독립 비교 결과로만 표시합니다. 합성 테스트 통과로 99% 달성을 주장하지 않습니다.** 실제 실행에는 서버 비밀 환경변수의 API 연결이 필요합니다.
- 공개 소스에는 실제 의뢰인 샘플·원본 식별자·정답·실행별 평가 결과를 포함하지 않습니다. 실제 정확도는 별도로 보관한 입력·정답·출력의 독립 비교로 확인해야 합니다.
- 페이지 역할은 증빙·기존 제출본·관리용 자료로 구분합니다. 기존 제출본은 생성 입력과 모델 호출에서 제외합니다. 이 체크아웃의 샘플 설정은 원격과 같은 일반화된 미측정 상태를 사용합니다.
- 법령 확인, 서류의 내용 확인, 법적 인정, 법원의 인가 결과를 서로 다른 상태로 관리합니다. 자동 사전 검토 결과는 법원의 인가 확률이 아닙니다.
- 공식 빈 서식의 출처와 파일 해시를 보존합니다. 원형 서식의 검수 상태, 미해결 토큰, 개별 법적 판단이 남아 있으면 검토용 표시와 확정 차단 사유가 유지됩니다.

## 페이지

| 경로 | 기능 |
| --- | --- |
| `/` | 사건 목록·연결 상태 |
| `/cases/:id/documents` | 원본·페이지 역할·추출 작업 |
| `/cases/:id/facts` | 원문 근거·추출값·충돌·검증 |
| `/cases/:id/review` | 상황별 체크리스트·법적 판단·이상거래 검토 |
| `/cases/:id/consultation` | 상담 기록·상황 분류·필요서류 체크리스트 |
| `/cases/:id/exports` | 출력·파일별 검수·보관·다운로드 |
| `/data?caseId=...` | 소득·채무·자산·거래의 별도 CRUD |
| `/data/context?caseId=...` | 가구·생계비·비용·변제계획·확정 상태의 별도 편집 |
| `/data/checklist` | 상담 체크리스트 카탈로그 관리 |
| `/reference-data` | 기준자료·산식·프롬프트 정책·변경 점검 관리 |
| `/evaluation` | 평가 기준과 실제 측정 여부 |
| `/settings` | 모델·비밀키 연결 여부·운영 설정 안내 |

## 실행 흐름

1. 원본 해시와 페이지 역할을 저장합니다. 원본과 페이지 이미지는 불변 객체로 보관합니다.
2. `gpt-6-luna`가 페이지 이미지를 보고 분류 → 구조화 추출 → 별도 원문 대조 → 불일치 부분 재독해를 수행합니다. 작업 단계와 결과를 저장하여 중단 후 재개합니다.
3. 값, 단위, 기간, 원문 인용, 페이지, 사실 ID와 버전을 별도로 관리합니다. 불명확한 수치나 누락값을 0원으로 채우지 않습니다.
4. 상황별 필요 서류·추출 피처·교차 검증·법령·출력 위치·추가 요청자료를 연결합니다. 기존 95개 리스크 카탈로그와 거래 검토 항목을 유지합니다. 카탈로그 수는 자동 판정 완료 수를 의미하지 않습니다.
5. 금액 계산은 BigInt 기반 코드로 처리하고, 원문 확인과 법적 인정을 구분합니다. 불완전한 목록·출처·산식·배분·법률 검토는 제출본 확정 차단 사유가 됩니다.

### AI OCR과 코드의 역할

현재 OCR은 `gpt-6-luna`의 이미지 판독입니다. 일반 OCR 엔진이 뽑은 텍스트를 AI가 정리하는 경로가 아니며, PDF의 텍스트 레이어를 결합하는 경로도 아직 사용하지 않습니다. 분류기, 추출기, 원문 대조기, 재판독기는 같은 모델을 서로 다른 호출과 역할로 사용합니다. 코드는 페이지 렌더링·영역 확대·호출 순서·재시도 한도·체크포인트·구조 및 수치 검증을 제어합니다. 작업을 무제한으로 반복하는 자율 에이전트는 아닙니다.

원문 대조기는 이미지와 앞선 추출 결과를 함께 봅니다. 별도 호출이라는 사실이 독립적인 정답 평가나 정확도 보장을 뜻하지 않습니다. 이 호출의 확인 기록은 원문·페이지·인용·값·단위와 연결되며, 금액 계산이나 법적 인정과 구분됩니다. OCR 필드 일치율, 페이지 완독률, 최종 제출 서류 일치율은 서로 다른 지표입니다.

3.11.0부터 같은 대조 호출에서 원문의 열·문맥이 항목의 의미도 뒷받침하는지 확인합니다. 값과 단위가 맞아도 보장금액을 해약환급금으로 분류한 경우처럼 의미가 틀리거나 불명확하면 새 검증 기록을 발급하지 않습니다. 새 기록에는 의미 확인 범위가 표시되고, 과거의 값·단위 대조 이력은 의미 검증을 새로 받은 것으로 바꾸지 않습니다. 입출금 문서를 채무 증빙으로 잘못 분류한 행은 원문 사실과 오류 사유를 보존하고 계산용 채무에서 제외합니다.
6. 신청서·채권자목록·재산목록·수입지출목록·진술서·변제계획안·증거목록 DOCX, XLSX, 인쇄용 HTML, 실제 출력 재독해 JSON, ZIP을 생성합니다.
7. 파일 검수는 사건 revision과 파일 manifest 지문에 묶입니다. 자료 수정·보관·재생성 뒤 과거 검수 승인을 재사용하지 않습니다.

## 서버 설정

- 모델: **`gpt-6-luna` 고정**. 다른 모델 fallback 없음.
- 비밀 환경변수: `OPENAI_API_KEY`. 클라이언트 입력·번들·로그에 키를 넣지 않습니다.
- 저장소: Sites D1 `DB`, R2 `BUCKET`.
- 이 로컬 체크아웃의 `.openai/hosting.json`은 `DB`·`BUCKET` 바인딩과 MCP capability를 선언합니다. 입력 디렉터리의 배포 프로젝트 ID는 가져오지 않았습니다. 실제 배포 시 기존 프로젝트와 비공개 owner-only 접근 범위를 연결합니다.
- D1 마이그레이션은 `drizzle/0000_chunky_cardiac.sql`부터 `drizzle/0006_legal_reference_monitor.sql`까지 번호 순서로 전부 적용합니다. 이미 `0003`까지 적용한 환경에는 `0004`·`0005`·`0006`이 추가로 필요합니다. 적용한 마이그레이션을 수정하거나 재실행하지 않습니다.
- 원본·페이지 업로드와 저장 충돌 검사는 서버에서 수행합니다. 데이터 수정은 사실 이력과 출력 무효화를 함께 처리합니다.
- 500KB 이상의 사건 원장은 불변 R2 상태 객체에 보관하며 D1에는 해시·revision·목록 요약 포인터를 저장합니다. 저장 실패한 요청의 객체만 정리하고 이전에 확정한 상태는 보존합니다.

## 파일별 재감사

- [추출·재검증 감사](docs/audit-extraction.md): 단위 재판독, 인용 없는 이름, 불완전 응답, 페이지별 재판독
- [계산·출력 감사](docs/audit-calculation.md): 음수·잘못된 변제액, 보증/연대·조건부 채무, 현재가치 확인 경계
- [법률·예외 감사](docs/audit-legal-exceptions.md): 공식 원문 확인 수준과 46개 상황의 증빙·판단·출력·보완 요구 매핑
- [대용량 저장소 감사](docs/audit-storage.md): D1 행 크기 제한, 불변 상태 객체, 동시 저장과 무결성
- [전송·재개 감사](docs/audit-transport-reliability.md): 작은 단계 응답, gzip, 읽기 재시도와 서버 진행 상태 복구

서버는 업로드·분류·추출·독립 대조가 끝나지 않은 증빙을 최종 출력의 차단 조건으로 별도 확인합니다. 목록 완료 체크박스로 이 조건을 우회할 수 없습니다. 재판독은 해당 쪽만 선택해 실행하며, 같은 파일 재업로드는 기존 문서에서 미완료 업로드를 이어갈 수 있습니다.

실제 샘플용 평가 실행기는 비공개 평가 환경에서 별도로 관리합니다. 증빙과 제출 완료본을 미리 분리하고, 검토 상태를 수동 승인하지 않은 실제 출력 ZIP을 동결된 정답과 독립 비교합니다. 특정 비공개 원본에 연결된 로컬 평가 스크립트는 이 저장소의 커밋 대상에서 제외합니다.

실행에는 정확한 배포 커밋을 `--source-commit`으로 지정합니다. `--resume-state`로 이전 사건을 이어갈 때는 새 출력 폴더를 사용하고, 서버의 원본·페이지 저장 상태를 먼저 대조합니다. 생성 `rendered.json`에는 원본 해시, 서버에 판독 결과가 저장된 페이지, 독립 대조 완료·보완 상태를 기록합니다. 업로드만 된 페이지를 처리 완료로 표시하지 않습니다.

## 주요 모듈

| 모듈 | 역할 |
| --- | --- |
| `lib/domain.ts` | 출처·사실 버전·정정/철회·검수 지문 |
| `lib/extraction.ts`, `lib/pipeline.ts` | 이미지 판독 스키마·단계별 재개·별도 원문 대조·holdout 차단 |
| `lib/workflow-rules.ts` | 상황 → 서류 → 피처 → 법적 판단 → 서식 → 보완 자료 |
| `lib/legal-rules.ts`, `lib/legal-catalog.json` | 법령·실무준칙·적용 범위·확인 상태 |
| `lib/transaction-review.ts` | 거래 범위·금액/잔액 검증·이상거래 및 내부이체 후보 |
| `lib/assessment.ts` | 코드 계산·필수 입력·사전 검토·출력 확정 조건 |
| `lib/form-mapping.ts`, `lib/office-writer.ts` | 원형 서식 매핑·실제 DOCX/XLSX·출력 재독해 |
| `lib/server-store.ts` | 사건 소유권·revision/token 동시성 제어·감사 이벤트 |

법령 기준은 출처·시행일·법원 적용 범위를 함께 저장합니다. 거래 금액 경보 기준은 업무 정책이며 법률상 위법 기준으로 사용하지 않습니다. 주거비·생계비·재산 평가·처분 필요성 등 개별 판단이 필요한 항목은 근거와 검토 상태를 별도로 요구합니다.

## 검증과 개발

```sh
npx tsc --noEmit --pretty false
node --test --test-isolation=none tests/*.test.ts
```

테스트는 금액 단위·누락·다중 기간, 삭제/정정 전파, 출처 및 사실 충돌, 음수·배분 잔액·출력 확정 조건, 거래 전수 검사, 실제 Office 구조, 업로드 불변성·동시 저장·반복 출력을 다룹니다. 합성 테스트의 통과율을 실제 서류 추출 정확도로 표시하지 않습니다.

개인정보가 포함될 수 있는 실샘플, 정답 데이터, API 키는 저장소에 커밋하지 않습니다. 동결된 정답은 독립 평가 영역에서 관리하며, 제출본의 정답값을 생성기 입력에 주입하지 않습니다.

Sites의 공식 설치·빌드·미리보기·배포 절차는 [runtime-reference.md](docs/runtime-reference.md)를 참고합니다.


### Explicit page refresh

The document preview offers **이 페이지 새로 판독** for completed evidence pages. `POST /api/cases/:id/process` with `action: "refresh_page"` and the selected `jobId` queues one new Luna read. It does not turn historical receipts into new verification. The exact prior result is archived by content hash in private case storage before resetting its active checkpoint. Historical readings and proof metadata remain linked, while nested old checkpoints do not accumulate in the active job. Source facts, human decisions, and separate CRUD records remain intact until the normal extraction reconciliation runs. In-flight, leased, withdrawn, administrative, and held-out pages cannot enter this path. The existing `retry_page` action remains limited to failed or review-required pages.
