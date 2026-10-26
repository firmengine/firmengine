"""Editable annexes built only from local public blanks and package specifications."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re

from build_templates import start, section, fields, table, sign, plan

ROOT = Path(__file__).resolve().parent
VERSION = 'court-package-editable-v1'


def allocation(doc):
    doc.add_heading('1. 기초 사항', level=1)
    fields(doc, [('월 평균 가용소득', 'monthly_disposable_income'), ('월 회생위원 보수', 'monthly_trustee_fee'),
                 ('월 실제 가용소득', 'monthly_payment'), ('변제 횟수', 'repayment_months'), ('총 실제 가용소득', 'total_repayment')])
    doc.add_heading('2. 채권자별 변제예정액의 산정 내역 · 별표(1)', level=1)
    table(doc, ['채권번호 / 채권자', '확정 원금 / 미확정 원금', '월 변제액 / 월 유보액', '총 변제액 / 총 유보액', '기준·상태'], [[
        '{{allocation.number}} / {{allocation.creditor_name}}', '{{allocation.claim_confirmed}} / {{allocation.claim_unconfirmed}}',
        '{{allocation.monthly_confirmed}} / {{allocation.monthly_reserved}}', '{{allocation.total_confirmed}} / {{allocation.total_reserved}}',
        '{{allocation.basis}} / {{allocation.status}}']])
    doc.add_heading('3. 재산처분에 의한 변제내역 · 별표(2)', level=1)
    table(doc, ['채권번호 / 채권자', '확정 원금 / 미확정 원금', '처분대금 배분 / 유보', '변제기한·출처'], [[
        '{{allocation.number}} / {{allocation.creditor_name}}', '{{allocation.claim_confirmed}} / {{allocation.claim_unconfirmed}}',
        '{{allocation.disposal_confirmed}} / {{allocation.disposal_reserved}}', '{{allocation.disposal_due_date}} / {{allocation.source_ids}}']])
    doc.add_heading('4. 청산가치와의 비교', level=1)
    fields(doc, [('청산가치', 'liquidation_value'), ('가용소득 총 변제예정액', 'total_repayment'),
                 ('총 변제액 현재가치', 'present_value'), ('현재가치 산정 기준일·방법', 'present_value_basis'),
                 ('재산처분 총 변제투입액', 'disposal_payment_total'), ('재산처분 변제액 현재가치', 'disposal_present_value')])
    doc.add_paragraph('확정·미확정 구분, 안분 대상, 우선권, 유보, 원 단위 처리와 잔액 조정은 검토된 계산 결과만 기재합니다. 명목합계를 현재가치로 대체하지 않습니다. 누락 배분값은 임의의 0으로 채우지 않습니다.')


def payment():
    doc = start('PAYMENT_SCHEDULE', '개인회생채권 변제예정액표')
    fields(doc, [('사건번호', 'case_number'), ('채무자', 'client_name'), ('안분 기준', 'allocation_basis')])
    allocation(doc)
    return doc


def creditor_annex(prefix, code, title, headings, values):
    doc = start(code, title)
    fields(doc, [('사건번호', 'case_number'), ('채무자', 'client_name'), ('채무 기준일', 'debt_as_of')])
    table(doc, headings, [values])
    doc.add_paragraph('채권번호는 본문 채권자목록과 일치시켜야 합니다. 담보·확정성·전부명령의 법적 효과는 별도로 검토하며 채권자 이름만으로 선택하지 않습니다.')
    return doc


def valuation():
    doc = start('ASSET_VALUATION', '재산별 평가·청산가치 산정 부속명세')
    doc.add_paragraph('사건별 평가근거를 정리하는 보조 서식입니다. 독립된 공식 전산양식으로 표시하지 않으며 제출 범위는 법원 양식·보정명령과 대조합니다.')
    fields(doc, [('사건번호', 'case_number'), ('채무자', 'client_name')])
    table(doc, ['재산·소유자·지분', '기준일·평가방법', '총가액 / 담보잔액', '보호·공제 근거 / 청산 반영액', '증빙'], [[
        '{{valuation.label}} / {{valuation.owner}} / {{valuation.share}}', '{{valuation.as_of}} / {{valuation.method}}',
        '{{valuation.gross}} / {{valuation.secured_balance}}', '{{valuation.protection_basis}} / {{valuation.liquidation_contribution}}', '{{valuation.evidence}}']])
    doc.add_heading('처분 전후 자산과 대금 추적', level=1)
    table(doc, ['재산', '처분가 / 담보상환 / 비용', '순처분대금', '대체재산·입금계좌 / 변제투입', '기준·출처'], [[
        '{{disposal.label}}', '{{disposal.sale_price}} / {{disposal.secured_debt_paid}} / {{disposal.costs}}',
        '{{disposal.net_proceeds}}', '{{disposal.successor_asset_ids}} / {{disposal.payment_amount}}', '{{disposal.source_ids}}']])
    doc.add_paragraph('처분된 재산을 삭제하는 것만으로 청산가치를 줄이지 않습니다. 처분대금·남은 권리·대체재산과 변제투입액을 함께 대조합니다.')
    return doc


def evidence_index():
    doc = start('EVIDENCE_INDEX', '제출 증빙목록·편철 대조표')
    doc.add_paragraph('업로드된 고객자료 전체 목록과 구분하여, 실제 법원 제출 패키지에 포함하기로 확인한 자료만 편철합니다. 이 문서는 내부 대조표이며 법원의 자료제출목록을 대체하지 않습니다.')
    table(doc, ['번호·자료명', '제출 목적·대상', '대상기간', '포함 여부·쪽', '원본 ID·출처'], [[
        '{{attachment.number}} / {{attachment.title}}', '{{attachment.purpose}} / {{attachment.subject}}',
        '{{attachment.period}}', '{{attachment.included}} / {{attachment.pages}}', '{{attachment.document_id}}']])
    return doc


def protected():
    doc = start('D5108', '개인회생재단에 속하지 않는 재산목록 제출서')
    fields(doc, [('사건번호', 'case_number'), ('신청인(채무자)', 'client_name')])
    doc.add_paragraph('신청인은 채무자 회생 및 파산에 관한 법률 제580조제3항, 제1항제1호, 제383조제1항에 관한 재산목록을 다음과 같이 제출합니다. 적용 조문·재산의 보호 범위는 개별 검토합니다.')
    table(doc, ['순번·재산의 대상과 명칭', '소재지', '추정가액', '압류금지 근거 조문', '소명자료'], [[
        '{{protected.number}} / {{protected.label}}', '{{protected.address}}', '{{protected.value}}', '{{protected.legal_basis}}', '{{protected.evidence}}']])
    sign(doc)
    return doc


def exemption():
    doc = start('D5109', '면제재산 결정신청서')
    fields(doc, [('사건번호', 'case_number'), ('신청인(채무자)', 'client_name')])
    doc.add_paragraph('채무자 회생 및 파산에 관한 법률 제580조제3항, 제1항제1호, 제383조제2항에 따라 별지 목록 기재 재산을 면제재산으로 정하는 결정을 구합니다. 신청액을 확정된 면제가액으로 취급하지 않습니다.')
    doc.add_paragraph('□ 주거용건물 임차보증금반환청구권에 대한 신청   □ 6개월간의 생계비에 사용할 특정재산에 대한 신청 (선택·법적 요건 별도 확인)')
    section(doc, '별지 면제재산목록', [('신청 재산의 특정·사유', 'exempt_details'), ('면제재산 신청금액', 'exempt_value'),
        ('임대차계약일자', 'lease_contract_date'), ('임대차기간', 'lease_period'), ('임차목적물 소재지', 'address'),
        ('임차보증금', 'housing_deposit'), ('임료·연체기간', 'housing_arrears'), ('임대인 성명', 'housing_owner'),
        ('주민등록일자', 'residence_registration_date'), ('확정일자', 'lease_fixed_date')])
    doc.add_paragraph('첨부: 별지 재산목록 및 해당 소명자료. 임차보증금 신청의 경우 임대차계약서·주민등록등본 등 해당 자료와 신청기한·관할 기준을 확인합니다.')
    sign(doc)
    return doc


def asset_plan():
    doc = plan()
    doc.paragraphs[0].text = '변제계획안 · 가용소득과 재산처분'
    doc.sections[0].header.paragraphs[0].text = 'D5111 | {{review_status}} | 버전 {{revision}}'
    doc.add_heading('재산처분에 의한 변제 · 재원별 별지', level=1)
    fields(doc, [('재산처분 계획·대체 조달방안', 'asset_disposal_plan'), ('재산처분 기한', 'disposal_due_date'),
        ('재산처분 변제투입예정액', 'disposal_payment_total'), ('관련 허가·집행 효력 검토', 'disposal_legal_review')])
    table(doc, ['처분재산', '변제기한', '처분대금·비용·담보상환', '실제 변제투입액', '대체재산·출처'], [[
        '{{disposal.label}}', '{{disposal.due_date}}', '{{disposal.sale_price}} / {{disposal.costs}} / {{disposal.secured_debt_paid}}',
        '{{disposal.payment_amount}}', '{{disposal.successor_asset_ids}} / {{disposal.source_ids}}']])
    doc.add_paragraph('처분대금 부족·처분 지연 시 대체재원과 변제기한을 별도로 검토합니다. 대체재산 및 남은 순처분대금은 재산목록과 대조하여 이중계상·누락을 확인합니다.')
    allocation(doc)
    return doc


def stay_or_prohibition(stay):
    code, key, title = ('D5113', 'stay', '중지명령 신청서') if stay else ('D5114', 'prohibition', '금지명령 신청서')
    doc = start(code, title)
    fields(doc, [('사건번호', 'case_number'), ('신청인(채무자)', 'client_name'), ('주민등록번호', 'resident_id'), ('주소', 'address')])
    if stay:
        section(doc, '상대방 및 대상 집행사건', [('상대방 성명', 'stay_counterparty'), ('상대방 주소', 'stay_counterparty_address'),
            ('집행법원', 'enforcement_court'), ('집행사건번호', 'enforcement_case_number'), ('집행 종류·대상', 'enforcement_kind')])
    section(doc, '신청취지', [('검토된 신청취지', key+'_request')])
    section(doc, '신청원인', [('사건별 사실·필요성·법적 근거', key+'_reason')])
    doc.add_paragraph('공개 원본의 급여·집행 유무 사례 문장을 사실로 복사하지 않습니다. 제593조제1항 등 적용 근거·대상·범위와 사건 단계는 법률 검토 후 기재합니다.')
    fields(doc, [('소명방법·첨부서류', key+'_evidence'), ('연락 가능한 전화번호', 'phone')])
    sign(doc)
    return doc


def build_additional(catalog):
    sources = json.loads((ROOT/'additional_sources.json').read_text(encoding='utf-8'))['sources']
    by_code = {form['code']: form for form in catalog['forms']}
    constructors = [
        ('ANNEX_SECURED','secured_annex','별제권부채권 부속명세',lambda: creditor_annex('secured','ANNEX_SECURED','채권자목록 부속서류 1 · 별제권부채권',
            ['채권번호·채권자','① 원금 / ② 이자','③ 예상 변제액 / ④ 담보부족액','⑤ 담보부 회생채권액','⑥ 별제권의 내용·목적물'],['{{secured.number}} / {{secured.entity}}','{{secured.principal}} / {{secured.interest}}','{{secured.secured_recovery}} / {{secured.shortfall}}','{{secured.secured_amount}}','{{secured.collateral}}']),'D5106'),
        ('ANNEX_DISPUTED','disputed_annex','다툼 있는 채권 부속명세',lambda: creditor_annex('disputed','ANNEX_DISPUTED','채권자목록 부속서류 2 · 다툼 있는 채권',
            ['채권번호·채권자','① 목록 원금 / 이자','② 채권자 주장 원금 / 이자','③ 다툼 없는 원금 / 이자','④ 차이 원금 / 이자','⑤ 다툼 원인 / ⑥ 소송'],['{{disputed.number}} / {{disputed.entity}}','{{disputed.principal}} / {{disputed.interest}}','{{disputed.claimed_principal}} / {{disputed.claimed_interest}}','{{disputed.undisputed_amount}} / {{disputed.undisputed_interest}}','{{disputed.disputed_amount}} / {{disputed.disputed_interest}}','{{disputed.dispute_reason}} / {{disputed.litigation}}']),'D5106'),
        ('ANNEX_ASSIGNMENT','assignment_annex','전부명령 부속명세',lambda: creditor_annex('assignment','ANNEX_ASSIGNMENT','채권자목록 부속서류 3 · 전부명령',
            ['채권번호·채권자','채권액 원금 / 이자','전부명령의 내용·효력'],['{{assignment.number}} / {{assignment.entity}}','{{assignment.principal}} / {{assignment.interest}}','{{assignment.assignment_order}}']),'D5106'),
        ('ANNEX_OTHER','other_claim_annex','기타 채권 부속명세',lambda: creditor_annex('other_claim','ANNEX_OTHER','채권자목록 부속서류 4 · 기타',
            ['채권번호·채권자','보증·물상보증 등 관계와 채권 내용','추가 소명·권리관계'],['{{other_claim.number}} / {{other_claim.entity}}','{{other_claim.content}}','{{other_claim.other_details}}']),'D5106'),
        ('PAYMENT_SCHEDULE','payment_schedule','개인회생채권 변제예정액표',payment,'D5110'),
        ('ASSET_VALUATION','asset_valuation','재산 평가·청산가치 부속명세',valuation,'D5101'),
        ('EVIDENCE_INDEX','evidence_index','제출 증빙목록·편철 대조표',evidence_index,'D5100'),
        ('D5108','protected_assets','개인회생재단에 속하지 않는 재산목록 제출서',protected,'D5108'),
        ('D5109','exemption_application','면제재산 결정신청서',exemption,'D5109'),
        ('D5111','repayment_plan','변제계획안(가용소득과 재산처분)',asset_plan,'D5111'),
        ('D5113','stay_application','중지명령 신청서',lambda: stay_or_prohibition(True),'D5113'),
        ('D5114','prohibition_application','금지명령 신청서',lambda: stay_or_prohibition(False),'D5114'),
    ]
    for code,kind,title,constructor,original_code in constructors:
        originals = deepcopy(by_code[original_code]['originals']) if original_code in by_code else [deepcopy(row) for row in sources if row['code']==original_code]
        for source in originals:
            if hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest() != source['sha256']:
                raise ValueError('Public source hash mismatch: '+source['path'])
        doc=constructor()
        filename=code+'.docx'
        doc.save(ROOT/filename)
        texts=[p.text for p in doc.paragraphs]+[c.text for t in doc.tables for r in t.rows for c in r.cells]
        tokens=sorted(set(re.findall(r'\{\{([a-zA-Z0-9_.-]+)\}\}', '\n'.join(texts))))
        record_keys=[key for key in tokens if '.' not in key]
        for key in tokens:
            if key.split('.', 1)[0] in ('secured','disputed','assignment','other_claim'):
                suffix=key.split('.', 1)[1]
                if suffix not in ('entity','period'):
                    record_keys.append('creditor_'+suffix)
        catalog['forms'].append({'code':code,'kind':kind,'title':title,'template_version':VERSION,
            'template':{'path':filename,'sha256':hashlib.sha256((ROOT/filename).read_bytes()).hexdigest()},
            'originals':originals,'record_keys':sorted(set(record_keys)),
            'calculation_keys':by_code['D5110']['calculation_keys'],'mapped_tokens':tokens,'approval_status':'reviewer_pending',
            'reconstruction':True,'standalone_official_form':code.startswith('D'),
            'limitations':'Editable section reconstruction; conditional legal choices and signatures require review. ASSET_VALUATION/EVIDENCE_INDEX are supplemental indexes, not independently prescribed official forms. D5111 expands the shared plan body and requires comparison against all original clauses.'})
    return catalog
