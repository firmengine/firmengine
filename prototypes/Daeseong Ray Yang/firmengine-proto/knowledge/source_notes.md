# 공식 자료 확인 기록

확인일: 2026-10-26. 현행 원문 조회와 설계 예시를 구분하며, 아래 요약은 개별 사건의 법률판단을 자동으로 승인하지 않는다. 실제 수집본의 해시·기록일·유효일은 SQLite의 불변 버전과 `verified_source_manifest.json`에 기록한다.

- [채무자회생법 제579조](https://www.law.go.kr/lsLinkProc.do?joNo=057900&lsClsCd=L&lsNm=채무자회생및파산에관한법률&mode=11): 신청일의 담보·기타 채무 상한을 각각 평가한다. 소득원, 법정 공제, 인정생계비, 사업 필요비를 구분한다.
- [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710773): 이의 여부, 인가일 평가액, 청산가치 비교를 별도로 다룬다. 명목상 월액×기간을 현재가치로 대체하지 않는다.
- [개인회생사건 처리지침](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2200000108651): 2026-07-01 시행본. 관공서 서류의 발급시점, 자료송부청구 대체 경로, 소득 산정기간과 법원의 추가·면제 요구를 확인했다.
- [서울회생법원 실무준칙](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2): 제402호의 급여·영업 소득자료, 기본 첨부와 추가명령을 구분한다. 제424호 2026-10-01 개정의 신규 접수 적용을 과거 인가된 계획에 소급해 적용하지 않는다. 최신 PDF 전체는 기본 자동 점검에서 내려받지 않는다.

판례 관찰은 출처·전제 사실을 유지하며 일반 산식으로 승격하지 않는다.

| 공식 판례 | 필요한 추가 사실·업무 처리 |
|---|---|
| [2013마668, 2013-07-12](https://www.law.go.kr/LSW/precInfoP.do?evtNo=2013%EB%A7%88668) | 보정에 응했으나 부족한 경우와 미응답을 구분. 응답 기록만으로 보정 해소 처리하지 않음 |
| [2013마101, 2013-03-15](https://www.law.go.kr/LSW/precInfoP.do?precSeq=171784) | 최근 채무 비율 외에 실제 사용처·대환 흐름 확인. 비율만으로 자동 기각하지 않음 |
| [2010마1179, 2010-11-30](https://www.law.go.kr/LSW/precInfoP.do?precSeq=150036) | 편파변제, 부인권에 의한 회복, 계획수정·청산가치를 분리. 당시 기간 기준을 현행 기본값으로 복사하지 않음 |
| [2024다221042, 2025-10-16](https://www.law.go.kr/LSW/precInfoP.do?precSeq=612877) | 원채권 목록 기재·인가일·전액 대위변제일·면책과 특별사정 확인. 누락 보증채무 전부의 일반 면책 규칙이 아님 |

차량 시세와 부동산 실거래는 평가 근거다. 소유권·본인 지분·실제 담보잔액·보호/면제 판단과 분리한다.

- [Car365 평균매매가](https://www.car365.go.kr/ccpt/schdcar/avrg/schdAvrgTrddView.do): 번호 입력이 있어도 소유자 본인 로그인·확인이 필요하다. 같은 형식·연식의 과거 평균이고 사고·주행거리·옵션은 반영하지 않는다. 현재 안내의 자료기간은 2024.3~2025.2다.
- [Car365 모델별 시세](https://www.car365.go.kr/ccpt/schdcar/mkprc/schdMkprcView.do?_menuId=M630101000): 전월 승용차 거래 참고자료이며 열람 외 제공 제한을 명시한다. 자유로운 시세 API라고 가정하지 않는다.
- [국토부 아파트 매매 상세 API](https://www.data.go.kr/data/15126468/openapi.do): 무료·활용신청·인증키 필요. 법정동 앞 5자리와 계약년월로 조회한다. 소유자 조회가 아니다.
- [국토부 공식 Excel/CSV](https://rt.molit.go.kr/pt/xls/xls.do?mobileAt=): 신고 수정·해제 및 제공시점 차이를 보존하고 조회조건·수집일을 함께 기록한다. 비슷한 거래의 선택 이유와 실제 자산의 권리관계는 별도 검토한다.
- [법제처 API 안내](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsEfYdListGuide): 신청한 인증값으로 현행·시행예정 목록을 확인한다. 게시·공포·시행·적용일을 구분하며 API 인증값을 스냅샷과 로그에 보존하지 않는다.
