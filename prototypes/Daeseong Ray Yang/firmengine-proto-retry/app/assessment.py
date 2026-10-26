"""Explainable preparation checks. No probability of approval or legal suitability verdict."""
from __future__ import annotations

from datetime import date


def issue(identifier, title, reason, action, required=True, status='확인 필요', **extra):
    return dict(id=identifier, title=title, reason=reason, next_action=action, required=required, status=status, **extra)


async def assess(case):
    from .pipeline import calculate
    blockers, warnings, requirements, risks = [], [], [], []
    for field, label in [('applicant_name','신청인 이름'), ('address','주소'), ('birth_date','생년월일'),
                         ('filing_date','신청 기준일'), ('period_start','자료 대상기간 시작'), ('period_end','자료 대상기간 끝'),
                         ('debt_cause','채무 발생 경위'), ('statement','신청인 진술')]:
        if not case.get(field):
            blockers.append(issue('fact.'+field, label+' 확인', '신청서 본문에 사용할 사실이 없습니다.', '상담 정보에서 원문에 근거한 사실을 입력하세요.'))
    if case.get('court') != '서울회생법원':
        blockers.append(issue('court.unsupported','관할 규칙 확인','현재 서식 매핑은 서울회생법원 참고 서식입니다.','관할에 맞는 규칙·서식의 검토 후 적용 범위를 추가하세요.'))
    if not case.get('assets_declared'):
        blockers.append(issue('assets.declaration','재산 내역 확인','재산 없음과 아직 확인하지 않은 상태를 구분해야 합니다.','재산 항목을 입력하거나 상담 정보의 재산 조사 완료를 확인하세요.'))
    for flag, label in [('rule_approved','적용 산식·매개변수'),('template_approved','출력 서식 매핑')]:
        if not case.get(flag):
            blockers.append(issue(flag, label+' 검토 필요', '공개 원문이나 코드의 존재는 전문가 검토 완료를 의미하지 않습니다.', '적용 시점·관할·수치·서식을 검토하고 해당 판본을 확인하세요.'))
    if not case.get('incomes'):
        blockers.append(issue('income.missing','소득원 누락','사업·근로·기타 소득의 계산 입력이 없습니다.','소득원별 기간·매출·인정경비와 근거를 입력하세요.'))
    if not case.get('creditors'):
        blockers.append(issue('creditor.missing','채권 내역 누락','채권자목록을 작성할 계약이 없습니다.','금융기관별 계약을 서로 다른 항목으로 입력하세요.'))
    for collection in ('incomes','creditors','assets'):
        for row in case.get(collection, []):
            label = row.get('label') or row.get('name') or row['id']
            if not row.get('confirmed'):
                blockers.append(issue(f"{collection}.{row['id']}.confirm", label+' 확인', '추출 후보와 법원 서류에 사용할 인정값이 아직 구분되어 있습니다.', '금액·대상·기간·출처와 법적 분류를 확인한 뒤 확정하세요.', object_id=row['id']))
            if not case.get('is_demo') and not (row.get('source_document_id') or row.get('valuation_source') or row.get('reason')):
                blockers.append(issue(f"{collection}.{row['id']}.source", label+' 근거', '수기 확정의 출처 또는 확인 사유가 없습니다.', '원본 증빙이나 구체적인 확인 사유를 연결하세요.', object_id=row['id']))
    for row in case.get('incomes', []):
        if not row.get('period_start') or not row.get('period_end'):
            blockers.append(issue('income.period.'+row['id'], '소득 대상기간', '월평균 수치의 귀속기간이 없습니다.', '소득원별 증빙 대상기간을 입력하세요.'))
        elif case.get('period_start') and (row['period_start'] > case['period_start'] or row['period_end'] < case.get('period_end', '')):
            blockers.append(issue('income.period_mismatch.'+row['id'], '소득 증빙 기간 확인', '소득원의 기간이 사건 자료 대상기간 전체를 포함하지 않습니다.', '대상기간을 정정하거나 부족한 기간의 증빙과 소득원을 보완하세요.'))
    for row in case.get('facts', []):
        if row.get('status') == 'disputed':
            blockers.append(issue('conflict.'+row['id'], row.get('label','사실')+' 불일치', row.get('reason') or '서로 다른 후보값이 확인되었습니다.', '원본 양쪽을 확인하고 사실을 정정·확정하거나 철회하세요.', object_id=row['id']))
    active_docs = [d for d in case.get('documents', []) if not d.get('deleted')]
    has_evidence = any(d.get('role') == 'evidence' for d in active_docs)
    requirements.append(issue('evidence', '의뢰인 원본 증빙', '파일 보유와 필요한 사실 입증을 구분합니다.', 'PDF/JPG/PNG를 업로드하고 역할·유형·대상기간을 매핑하세요.', status='수취' if has_evidence else '추가 제출', required=True))
    if not case.get('is_demo') and not has_evidence:
        blockers.append(issue('evidence.missing','원본 증빙 필요','실제 사건의 원본 파일이 연결되지 않았습니다.','제출본 정답을 제외한 의뢰인 증빙을 업로드하세요.'))
    kinds = {i.get('kind') for i in case.get('incomes', [])}
    types = []
    if 'business' in kinds or case.get('income_type') in ('business','mixed'):
        types += [('사업자등록·사업장 자료','business_registration'),('매출·인정경비·세무 자료','business_income')]
    if 'salary' in kinds or case.get('income_type') in ('salary','mixed'):
        types += [('재직·급여·원천징수 자료','salary')]
    types += [('채무 계약별 잔액 증빙','debt'),('재산·권리·평가 증빙','asset')]
    for label, dtype in types:
        matched = [d for d in active_docs if d.get('role') == 'evidence' and d.get('document_type') == dtype]
        requirements.append(issue('doc.'+dtype,label,'현재 사건 유형의 사실·대상·기간 확인 자료입니다.','해당 증빙을 준비하거나 대체 증빙과 확인 사유를 연결하세요.', status='수취·내용 확인 필요' if matched else '추가 제출', required=False, document_type=dtype))
    for d in active_docs:
        if d.get('role') != 'evidence':
            warnings.append(issue('excluded.'+d['id'],d['name']+' 생성 입력 제외','평가 전용·행정·미분류 페이지는 생성기에 전달하지 않습니다.','잘못 매핑한 경우 자료 역할과 페이지 지정을 정정하세요.',False,status='입력 제외'))
        elif d.get('status') in ('unreadable','failed'):
            risks.append(issue('unreadable.'+d['id'],d['name']+' 재확인','읽지 못한 값은 없는 값이나 0으로 인정하지 않습니다.','선명한 원본을 추가하거나 원문 근거를 확인하세요.',False))
    for tx in case.get('transactions', []):
        if tx.get('direction') == 'withdrawal' and int(tx.get('amount') or 0) >= 500000:
            risks.append(issue('withdrawal.'+tx['id'],'50만원 이상 개별 출금',f"{tx.get('date','')} {tx.get('counterparty','')} {int(tx['amount']):,}원. 사무소 확인 정책이며 법정 기각 기준이 아닙니다.",'용도·수취인과 영수증·계약·대금 흐름을 확인하세요.',False,status='해소됨' if tx.get('resolved') else '확인 필요',transaction_id=tx['id']))
    for c in case.get('creditors', []):
        if c.get('priority') == 'tax':
            risks.append(issue('tax.'+c['id'],'조세·공과금 분류 검토','세목·납기·우선권·재단채권 성격에 따라 계획 처리가 달라집니다.','세목·과세기간·징수/유예·압류 증빙을 확인하고 변제순위를 검토하세요.',False,status='전문가 검토'))
        if c.get('disputed'):
            risks.append(issue('disputed.'+c['id'],'다툼 채권 유보·배분','금액 확인과 권리의 법적 인정은 별개입니다.','확정/미확정 및 유보 배분을 검토하세요.',True))
    risks += [issue('manual.history','과거 절차·관할·부양·면제·권리 성격','이 프로토타입은 모든 예외를 자동 판정하지 않습니다.','전문가가 관련 증빙과 적용 시점의 규칙을 확인하세요.',False,status='현재 자동 판단 불가'),
              issue('manual.signature','서명·편철·첨부 확인','파일 생성 이후 수행하는 제출 준비 항목입니다.','실제 생성 문서 검수 후 서명·첨부 상태를 확인하세요.',False,status='후속 확인')]
    try:
        calc = await calculate(case)
    except Exception as exc:
        calc = dict(blocked=[f'계산 엔진 연결 실패 ({type(exc).__name__})'], engine='unavailable', warnings=[])
    for index, value in enumerate(calc.get('blocked') or []):
        message = value if isinstance(value,str) else value.get('reason',str(value))
        blockers.append(issue(f'calculation.{index}','계산 확인',message,'관련 소득·재산·채권 분류·생계비·기간을 정정한 뒤 다시 계산하세요.'))
    for risk in risks:
        if risk['required'] and risk['status'] != '해소됨':
            blockers.append(risk)
    warnings += [r for r in risks if not r['required'] and r['status'] != '해소됨']
    return dict(requirements=requirements,risks=risks,blockers=blockers,warnings=warnings,calculations=calc,
                can_generate=not blockers,case_revision=case['revision'],rule_version=calc.get('rule_version','retry-v1'),
                coverage=dict(automatic=['입력 누락','확정 여부','대상기간','50만원 이상 출금','생성본 무효화'],manual=['법적 인정','부양·면제','과거절차','새 예외','서명·편철']))


def synthetic_case():
    from .store import uid
    return dict(title='[합성] 양서준 · 별빛카페',applicant_name='양서준 (합성)',address='서울특별시 가상구 예시로 10 (가상 주소)',
                birth_date='1987-04-12',court='서울회생법원',filing_date='2026-10-26',income_type='business',tax_type='general',
                period_start='2026-01-01',period_end='2026-09-30',repayment_months=36,living_cost=1800000,deductions=0,
                statement='이 사건의 인물·기관·금액은 모두 화면과 생성 흐름 확인을 위한 합성 자료입니다. 카페를 운영하면서 매출 감소로 채무가 누적되었고 현재 영업을 지속하고 있습니다.',
                debt_cause='합성 시나리오: 창업 시설비 대출과 영업자금 차입. 실제 제출자료나 평가 정답에서 가져오지 않았습니다.',
                assets_declared=True,rule_approved=True,template_approved=True,is_demo=True,
                incomes=[dict(id=uid(),label='별빛카페 (합성)',kind='business',period_start='2026-01-01',period_end='2026-09-30',monthly_gross=9000000,monthly_expense=5500000,confirmed=True,reason='합성 검증용 고정 입력')],
                creditors=[dict(id=uid(),name='가상은행',contract_id='DEMO-LOAN-01',principal=60000000,interest=2500000,security='unsecured',priority='ordinary',disputed=False,confirmed=True,reason='합성 검증용'),
                           dict(id=uid(),name='가상은행',contract_id='DEMO-LOAN-02',principal=25000000,interest=1000000,security='unsecured',priority='ordinary',disputed=False,confirmed=True,reason='동일 은행의 별도 계약 유지')],
                assets=[dict(id=uid(),label='합성 임차보증금',kind='deposit',market_value=10000000,secured_balance=0,exempt_amount=0,confirmed=True,valuation_source='합성 검증용 고정 입력',valuation_date='2026-10-01')],
                transactions=[dict(id=uid(),date='2026-09-25',account='DEMO-001',amount=700000,direction='withdrawal',counterparty='합성 거래처',purpose='재료비',resolved=False)],facts=[])
