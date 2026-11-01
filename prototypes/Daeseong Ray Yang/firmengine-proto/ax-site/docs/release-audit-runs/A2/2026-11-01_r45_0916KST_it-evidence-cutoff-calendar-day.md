# FirmEngine A2 r45 — IT담당자 / 증빙 cutoff 월중 경계와 D5103 승인서식 데이터 분리

- 일시: 2026-11-01 KST, r44 AX→**r45 IT**→r46 사용자·서류담당자.
- 시작 main HEAD: `e820b3341eec2b8b83057cc4f4f07cbf3801fb3f`; 영수증 쓰기 직전 HEAD: `e820b3341eec2b8b83057cc4f4f07cbf3801fb3f`.
- 유일 허용 작업 루트: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. A2-IT-004/007/016/017 **모두 [ ] 부분검증·미인수**, 나머지 ID 불변.
- 선행 읽음: 보드 단일본, r44/r43 영수증, main 현재 커밋/PR #108/#113/#106/#98/#102/#97/#96, 실 코드 `form-mapping.ts`, `document-writer.ts`, `document-preflight.ts`, `context-validation.ts`, `domain.ts`, SQL 0011, feature store, 기존 r41/r44 테스트.
- main 읽은 주요 blob: 보드 `13128d0fe5cf72d8eabf4153687b1308ce13ed31`; form `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; feature store `bb5f88b26e68f5ae2234741063ac9301a927e27a`; SQL 0011 `0caa359d250dce45765d269d271ad63170ec3efa`.
- 코드 변경은 별도 **Draft PR #115**: https://github.com/firmengine/firmengine/pull/115 (base는 PR #113, 그 base는 PR #108). main 제품 코드는 수정하지 않음. PR 변경파일 **두 개 모두 허용 디렉터리**이며 테스트 소스는 합성값만 포함.

## 실제 실행, 독립 기대값과 관찰

- **부모 소스 정확성:** PR #113 blob `0ba7e7bdace572bad849e56e0b5752c153a3a96d`를 GitHub에서 가져와 로컬 Node v22.16.0에 저장하고 `git hash-object`가 같은 SHA임을 확인. r44 테스트 blob `6eb6d5ee7f5e0fbc39e67d35c751d30443d891ee`, r41 테스트 blob `6c2a1ddf6da21a0cf10507ef5afbd7e816ffeb70`도 로컬 hash 일치.
- **새 반례:** 11개 합성 시나리오에서 부모 helper **7/11** 독립 기대와 일치, **4건 오류**. PR #115 수정 후 신규 반례 **11/11**, 이전 테스트 r41=15/15·r44=8/8 포함 격리 Node **34/34** 통과. GitHub PR #115 수정 소스 blob `8d038ca99d33a129dd155417aeae9737195eb0f4`를 재다운로드하여 로컬 `git hash-object`와 동일함을 확인. 이는 GitHub에서 작성한 신규 테스트 파일의 전체 프로젝트 Node 실행이나 CI 성공이 아님.
- 독립 기대는 **자료 관측 완료 여부**만 다룸. 변호사 승인·국세청 과세소득·법원 인정소득의 기대값이 아님.

| 합성 입력(원천 관측 월) | 독립 기대 | 부모 #113 관찰 | PR #115 관찰 |
|---|---|---|---|
| selected 2026-10-01~10-31, 월행 `{period:"2026-10",net_income:"2,400,000"}`, cutoff=2026-10-01 | Oct 미관측 완료, review_required | **complete** | review_required; futureMonths=[2026-10] |
| 같은 월, cutoff=2026-10-30 | review_required | **complete** | review_required |
| 같은 월, cutoff=2026-10-31 | complete | complete | complete |
| selected 2028-02-01~02-29, `2028-02`, cutoff=02-28 | 윤년 2월 미완료 | **complete** | review_required |
| 2028-02 cutoff=02-29 / 2026-02 cutoff=02-28 | 각 달 완료 | complete | complete |
| 2026-09~11 관측 3행, cutoff=2026-10-10 | Oct·Nov 보류 | Nov만 보류 | Oct·Nov 보류 |
| 문자열 명시 0원·월말 cutoff | 금액 0 관측 보존 | complete | complete |
| cutoff=null | **시점 미관찰, 법률확정 금지** | **helper complete** | **helper complete (미해결)** |

독립 산술: 합성 급여 2,400,000원×12=28,800,000원, 11개월=26,400,000원, 차이 2,400,000원. 급여 12개월+사업소득 11개월은 전체 월 union 만으로는 소득원별 누락을 증명할 수 없으며, 월 2,400,000+1,000,000=3,400,000원을 **승인된 사건 소득으로 합산하지 않음**. 이 부분은 기존 r42~r44 발견 상태 유지.

## 원문→Fact→typed→SQL→서식 계약, 범위의 정직한 한계

- `domain.ts`는 IncomeSource의 kind/payerIdentityId/factIds/기간/recognition/aggregation과 CaseContext의 filingPeriod/evidence_cutoff를 분리한다. `form-mapping.ts`의 `rows.month`은 `entity,period,revenue,expense,net_income`만 포함하여 **소득원 ID·Fact ID·증빙 종료일·승인 메타를 전달하지 않음**. PR #108 writer는 투영된 월행으로만 선택기간을 비교하므로 **복수 소득원 12+11개월 union false-complete 위험은 미해결**. 실제 상위 `calculateCase()` 및 최종 DOCX에서 방어하는지 미검증.
- SQL 0011은 `value_json` / `value_won` / `status` / `source_fact_ids_json`을 별도 보존. 스키마 확인만 수행. **이번 r45 실제 D1/SQLite 저장·재조회 미실행**. 값 `null`/0/비해당/상충/source-only/승인전은 의미를 통합하지 않음.
- `reference-decision-tables.json` 정적 재파싱 **18 계산모듈, 91 입력선언(고유 78), 42 출력선언(고유 40), 42 resultPaths**. `template-token-catalog.json` **D5103 37 / D5110 55 / D5111 82**. `public/templates/catalog.json` mapped_tokens 35/53/80 및 approval_status=`reviewer_pending`. 등록·매핑 존재 ≠ Word 생성 ≠ 공식 서식 승인.
- #106 D5103·D5110/11 사전검사와 #108/#113/#115 월행 경계, #96/#97/#98/#102 소득합산 승인·충돌은 서로 다른 Draft를 아직 결합하지 않음. **전체 `prepareDocumentWrite`/Node 통합/CI/staging D1·R2·Cron/실제 Word·법원 parity 모두 미실행**.

## 공식 원문: 관할·날짜·적용 경계

- 국가법령정보센터 **채무자 회생 및 파산에 관한 법률 [시행 2026-10-02, 법률 제21490호] 제611조·제614조** (2026-11-01 재열람): https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 , https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 내부 D5103 소득자료 완결 표시가 법원 인가요건을 뜻하지 않음.
- **서울회생법원** 2026-10-01 보도자료 **실무준칙 제424호 제2조 제2항 제7호 신설**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 . 첨부 개정전문 부칙·경과조치, 사건별 적용일 미확인. 공지일≠실제 사건 자동 적용일. 전국법원 공통 규칙 추가 안 함.
- **국세청 공식 안내**(2026-11-01 재열람) 일반과세자 반기, 간이과세자 원칙 연간 VAT/종합소득세 신고 구분: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480 . VAT 매출·비용/종합소득세 신고액·법원 인정소득의 자동 동일시 금지.

## 선택 ID / 상태 / 다음

- **A2-IT-004 [ ]:** 문자열 `"0"` vs `null`·숫자형 0 비정상 입력. #113 실제 r44 8/8 + r45 Node 재실행 8/8; 원문/SQL/문서 end-to-end 미인증.
- **A2-IT-007 [ ]:** 2026-10-01, 10-30, 10-31 / 윤년 2028-02 월말 경계. PR #115 Node 격리 11/11. 실제 시간대/서버 Date, 사건별 근거일 미인증.
- **A2-IT-016 [ ]:** 월별 소득원천 2,400,000원·명시적0과 D5103 출력 월행 정적 필드 대조. 서식 자체 D1/API/Word 금액 대조 미인증.
- **A2-IT-017 [ ]:** `document-writer.ts`의 #108 월단위 cutoff 게이트 및 #106 사전검사 정적 검토. PR #115는 #113 스택에서만 시험, 최종본 승인 차단 통합 미인증.

**다음 r46 사용자·서류담당자:** PR #115 스택을 #106 통합 document-writer에서 재현하여 D5103 최종본/초안 경고 구분; 소득원별 fact/payer/관측 종료시점 보존 내부 계약; cutoff=null 및 source-only 검토보류; D5110·D5111 연계 / 금융·채권·VAT 중복 대조. P0 이전 계산 기준정보판본 덮어쓰기와 실제 D1 null/value_won/status 상충 검증도 계속.

**제품 인수 0.** 고객 개인정보/실 OCR/키/비공개 정답 미사용. 운영 배포, D1 운영 migration, 전자제출, 법원 인가 확정 실행 없음. 법률·회계 적합성은 실무자/변호사 승인 전 미인증.
