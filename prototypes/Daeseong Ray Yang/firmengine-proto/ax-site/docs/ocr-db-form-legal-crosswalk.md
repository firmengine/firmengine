# OCR → DB → 사건 데이터 → 법원서식 → 법적 계산 연결

기준: 2026-10-30 / 변경 검토 브랜치. 실제 OCR 모델 실측이나 법원 전자소송 포털의 필드별 검증 결과가 아닙니다.

## 구조
- 상담 서류 85종과 OCR 패밀리 계약을 그대로 유지합니다.
- 원문 추출 피처 ID는 `canonical_field_id`, 원문키는 `field_key`, 실제 값은 `raw_value_json`에 보존합니다.
- 계산용 별칭 `projection_key`는 `canonical-source-binding/1`의 명시적 매핑만 사용합니다. 이름이 비슷한 피처를 추정해 계산하지 않습니다.
- 서류 내 월별 급여·거래·채권자·가족 각각은 `extraction_records`의 별도 행이며, `extracted_features`가 항목값을 보관합니다.
- `extraction_field_coverage`는 미추출 피처를 **페이지 기준 미관찰**로 표시합니다. '없음', '0', '해당없음'이 아닙니다.
- 사건 데이터 `field_matrix`, `coverage`, `extractions` 조회에서 서류별 OCR·DB·계산 경로를 검토할 수 있습니다.
- 신청서 법정 최소 필수 기재는 법 제589조, 변제계획 검사는 제611조·제614조를 참고합니다. 공식 전자소송 항목별 필수 여부는 계속 미검증으로 남깁니다.

## 시험에서 반드시 확인할 사항
1. 85종의 문서별 실제 이미지 샘플로 피처 존재·추출·누락·오인식·해당없음을 분리합니다.
2. 월별·다건 행과 금액 단위, 날짜, 소유자/채권자 역할이 중복·합산되지 않게 비교합니다.
3. 정상 피처는 DB에 원문값과 피처 ID가 동시에 저장되고 `projection_key`로만 사건 계산에 전달되는지 확인합니다.
4. 근거 없는 법률상 인정·청산가치·현재가치·채권자 동의를 자동으로 만들지 않습니다.
5. 공식 전자소송 포털의 최신 필드명, 필수값, 반복행, 첨부 요구는 법원·서식판본·담당자 서명 검증 후 별도로 승인합니다.

출처:
- 채무자회생법 제589조: https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1018130103
- 제611조: https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=267359
- 제614조: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759
