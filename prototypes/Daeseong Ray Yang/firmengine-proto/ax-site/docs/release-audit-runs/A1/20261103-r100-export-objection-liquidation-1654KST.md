# FirmEngine A1 — 100차 코드 완결성·상호 기능충돌 독립 감사 (2026-11-03 KST)

- **허용 경계**: firmengine/firmengine main의 prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/ 안에서만 조회·기록. 99차 서류/변호사/데이터 다음 순환 **IT → AX → 계산사무장**. 항목 **A1-IT-008 / A1-AX-008 / A1-CALC-008**, 모두 **[ ] 미완료**.
- **감사 시작 HEAD**: 0752e24ec86f1696a569c0dc5dca81a0a8479cd1. **영수증 커밋 직전 HEAD**: 0752e24ec86f1696a569c0dc5dca81a0a8479cd1. 중앙 인수 보드 blob 7f1b0506f202f1c3e1bccfe0747a3c4078f5f3e8. 최근 commit 및 열린 PR, A1 99차, 76차, 80차와 4차 영수증, db/schema.ts blob 933f8686845ac14669312dd21bf85e02c62ed5e6, 관련 TS 구현·기존 Node 테스트를 읽음.
- **검증 방법**: GitHub main 및 Draft 소스의 **실제 함수를 타입 표기만 제거**해 JS V8에서 격리 실행. 외부 R2·D1 hook 및 계산 보조함수는 명시적인 합성 adapter로 대체. 사전에 정한 독립 기대와 실제 객체 상태를 비교. **Node 테스트와 CI, D1·R2 실연결, 화면, 법원 공식서식, 법률 승인과 구별**한다.
- **민감자료 제한**: 가상 1개 artifact와 가상 risk, 1000원 이하 임의 합성 자산만 사용. 실제 의뢰인, 원본 PDF, OCR 사실, env/키, 비공개 정답 없음.

## A1-IT-008 [ ] — Export manifest ACK 유실과 R2/SQL 보전

- 실제 구현 **lib/export-artifact-transaction.ts** main blob **a114235e5b5de57b5ae58b41026f939ee8543174**, 기존 [Draft PR #24](https://github.com/firmengine/firmengine/pull/24) 해당 blob **10dc79b9ec9dcf29ff74901af6a621a17d880573**. [Draft #61](https://github.com/firmengine/firmengine/pull/61) 역시 관련 통합안(이번 독립 실행 안 함). 기존 **tests/export-artifact-transaction.test.ts** blob **a684612f61234a9fb0ac30261684733ba749eefc** 조회.
- 합성 adapter: 업로드 성공 시 objects Set에 objectKey를 생성, persist 시 rows Set에 id 생성, commit 시 manifest Set에 id 추가. delete hook은 해당 id/key만 삭제. ACK 소실은 **manifest에 반영한 뒤** 오류 throw. 후처리 실패는 정상 commit 뒤 오류 throw. 목표는 이미 참조된 바이트/행 삭제 금지이며, **확실히 commit되지 않은 충돌에서는 orphan 정리도 필요**하다.

| 시나리오 / 독립 기대 (rows/objects/manifest, error) | main 실제 | #24 실제 |
|---|---|---|
| 정상 1 artifact: 1/1/1, 오류 없음 | 1/1/1, 없음 — 일치 | 1/1/1, 없음 — 일치 |
| upload 중 기록 후 실패: 0/0/0, upload | 0/0/0, upload — 일치 | 동일 — 일치 |
| persist 후 실패: 0/0/0, persist | 0/0/0, persist — 일치 | 동일 — 일치 |
| commit 이전 명시 conflict: 0/0/0, conflict | 0/0/0, conflict — 일치 | **1/1/0, conflict**, uncertain report — 보수적 잔존 |
| manifest commit 뒤 ACK 유실: **1/1/1**, lost_ACK | **0/0/1**, lost_ACK — **P0 불일치** | 1/1/1, lost_ACK, uncertain report — 일치 |
| afterCommit 실패: 1/1/1, afterCommit | 1/1/1, afterCommit — 일치 | 동일 — 일치 |
| 중복 record id: 0/0/0 + DUPLICATE | 일치 | 일치 |
| 중복 object key: 0/0/0 + DUPLICATE | 일치 | 일치 |

- **확정 관찰 범위**: 함수 단위 main **7/8**, Draft #24 **7/8** (확정 충돌에서도 잔존 1건은 별도 운영 회수 정책상 미인수). ACK 불명확과 명시 conflict가 실제 R2/D1에서 구별되는 증거는 없음. Draft의 안전 우선 보전에는 orphan 재조정/보존기간·중복 업로드 재시도 설계가 필요. **기존 P0, 새 결함 중복 집계 아님**, 현재 main에 미반영. 신규 제품 코드 패치 없음.

## A1-AX-008 [ ] — 법률 의견·반론·미해결 질문의 분리

- 실제 **lib/approval-issue-graph.ts** blob **53df46fa1fcf34e19d8e9a192da1a8f87bf897cd**, 기존 **tests/approval-issue-graph.test.ts** blob **0fffa4548046c8efd67639446526b8f0d8dd9d4d**. 동일 함수 본문을 V8 실행, 합성 R1/LAW1, Fact F1, 계산 totalWon=100, 승인된 증거경로 1개, legalCheck 1개 사용.
- 12조건 / 독립 기대와 관찰: 수용 원천 supported, 불수용 observed_not_accepted, 미관측 not_observed, **문자열 0은 유효 계산값**, null은 missing, 키 자체 누락은 undeclared_output, 구판 법률판단 stale → not_currently_reviewed, 승인전 계약은 필수 증거 생성 안 함, conflict 사유 보존, courtApprovalInferred=false가 **각각 일치(10개)**.
- **불일치 2개**: 모든 증거 및 계산이 충족되고 legalCheck.status=conflict인 상태에서 **questions=[]** (독립 기대: 인적 반론 해소 질문 남음); 별도 사람 작성 근거·법률 의견·반론 상태 계약은 **legalOpinion=null** (독립 기대: 출처/작성자/검토 상태의 구조화 보전). V8 **10/12**.
- 그래프의 현재 체크는 conflict를 legal PASS나 법원 인가로 바꾸지 않음. 다른 법률 의견 저장 경로가 없다는 전체 제품 부재 주장은 하지 않음. 별도 법률 의사결정 및 실무자 동의가 필요한 계약이므로 **코드 수정 보류**, 변호사·AX 검토·E2E 필요. 기존 36/76차와 같은 미완 경계, 새 결함으로 중복 집계 안 함.

## A1-CALC-008 [ ] — 재산 종별·소유지분·면제·담보 부족 금액

- 실제 **lib/assessment.ts** blob **ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5**의 **liquidationContribution** 함수 본문만 V8 격리 실행. 비음수 NumericInput 변환, shareBasisPoints=10000, 달력 날짜 문법, 양수 bigint 올림나눗셈은 **합성 스텁**이며 전체 calculateCase는 실행하지 않음. 자산종별 법적 인정 분기는 함수의 직접 계약이 아님.

| 입력(전부 가상), 독립 기대 | V8 실제 |
|---|---|
| 보증금 1000, 담보 300, 비용 100 → 600 | 600, 사유 없음 |
| 보험 1000, 면제 200 → 800 | 800 |
| 퇴직금 1000, 면제 500 → 500 | 500 |
| 명시적 0 자산, 기타 0 → 0 | 0 |
| 면제액 null → null + COMPONENTS_MISSING | null + ASSET_COMPONENTS_MISSING |
| 면제액 -100 → null + COMPONENTS_MISSING | 동일 |
| 지분 10001bp → null + OWNERSHIP_MISSING | 동일 |
| 지분 3333bp, 가치 1000 → 334 (ceil) | 334 |
| 공유지분 5000bp, 담보100, 귀속범위 없음 → null + SCOPE_UNRESOLVED | 동일 |
| 공유지분 5000bp, 담보100, 귀속범위 applicant_interest, 원천 미연결 → null + SOURCE_REQUIRED | 동일 |
| 담보 1500 > 평가 1000 → 0 + SHORTFALL 검토 이유 | 0 + COLLATERAL_SHORTFALL_REQUIRES_CLASSIFICATION |
| 평가 기준일 누락 → null + DATE_MISSING | 동일 |
| 평가 사유 공백 → null + BASIS_MISSING | 동일 |

- 선택한 13조건 **13/13 기대 일치**. 다만 **calculateCase** 소비처에서 ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_REVIEW_REQUIRED 외 담보부족액 SHORTFALL 이유는 자산 trace의 **provisional 명시 조건에 포함되지 않음(정적 확인만)**. value=0 / 이유 남음 / trace=calculated 조합이 가능할 수 있음. 44·80차 기존 검토 후보이며 **전체 계산/서식 출력 재현되지 않아 확정 결함 아님**. 담보부족액 분류·면제액·배우자 재산·지분 법률 인정 기준은 계산사무장·변호사 검토 필요. 임의 산식 수정 없음.

## 판정·코드 조치·다음

- **제품 코드 조치: 없음**. IT 동일 결함은 #24·#61 기존 Draft, AX와 CALC는 법률 판단/계산 영수증 의미가 바뀔 수 있어 부주의한 패치 금지. 이 영수증과 단일 보드 세 ID만 갱신, **[ ] 유지**.
- 실제 합성 검사 IT main **7/8** (#24 후보 7/8, ACK 보전 대가 orphan 위험), AX **10/12**, CALC **13/13**. 숫자들은 개별 함수 테스트만이며 18계산/95법률/85서류의 통합 합격률 아님.
- **다음 순환**: 사용자·서류담당자 **A1-DOC-009**(문서 재분류→하위 계산 무효화), 변호사 **A1-LAW-010**(가구원·추가생계비의 법원 재량 근거), 데이터담당자 **A1-DATA-009**(기간·기준일·발급일 분리).
- E2E 보류: 상담→85서류→OCR→정규화→18계산→95법률→직원문안검수→법원 보정, 복수행·갈음 A←B+C/C01-C02-C04/동시 사건, 전체 Node·TS·CI·브라우저·staging D1/R2/Cron·공식서식·변호사 승인·사이트 배포 **미관찰**. **제품 전체 종단 인수 0건**. 운영 배포/운영 migration/전자제출/법원 인가 확정 **실행 안 함**. Extra High 실제 추론 모드 미확인.
