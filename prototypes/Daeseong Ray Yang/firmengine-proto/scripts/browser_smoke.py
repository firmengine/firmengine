"""Local static UI smoke: all API routes mocked before load, synthetic data only.

python scripts/browser_smoke.py --screenshots
Requires Playwright + Chromium. No real case reads/writes or external AI calls.
Optional screenshots contain only the empty application.
"""
import argparse
import asyncio
from copy import deepcopy
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
SID = 'a' * 32


def fixture():
    return {'id': SID, 'name': '합성 UI 사건', 'income_type': 'wage', 'court_id': 'seoul', 'revision': 1,
        'status': 'ready', 'stage': 'review', 'progress': 100, 'message': '합성 검증', 'updated_at': '2026-10-26T01:00:00Z',
        'documents': [], 'records': [], 'issues': [], 'metrics': {}, 'assets': [], 'notifications': [],
        'objects': [{'id': 'vehicle-1', 'type': 'vehicle', 'label': '합성 차량', 'metadata': {}}],
        'assertions': [{'id': 'fact-1', 'object_id': 'vehicle-1', 'feature_key': 'assets[].gross_value', 'value': '1000',
            'unit': 'won', 'currency': 'KRW', 'state': 'EXTRACTED', 'precision': 'EXACT', 'valid_at': '2026-10-01',
            'accepted_for_filing': False, 'evidence_refs': [{'document_id': 'doc-1', 'page': 1,
                'excerpt': '<script>window.fixtureInjected=true</script>'}]}],
        'requirements': [{'id': 'req-1', 'label': '시가 확인 자료', 'subject_id': 'vehicle-1',
            'period': {'start': '2026-01-01', 'end': '2026-09-30'}, 'purpose_features': ['assets[].gross_value'],
            'alternatives': [{'all_of': ['asset_value']}], 'document_basis': 'CONDITIONAL_ATTACHMENT', 'legal_basis': [], 'status': 'MISSING_EVIDENCE', 'missing_features': ['assets[].gross_value']}],
        'route': 'SUPPLEMENT', 'assessment': {'eligibility': {'status': 'PARTIAL_CHECK_ONLY'}, 'evidence_completeness': {'status': 'MISSING', 'total_requirements': 1, 'satisfied_requirements': 0}, 'repayment_plan': {'status': 'UNDETERMINED'}, 'procedure': {'status': 'OPEN_ACTIONS'}, 'discharge_liability': {'status': 'LEGAL_REVIEW_REQUIRED'}},
        'generation_gate': {'can_generate': False, 'reason': '합성 필수 자료 확인 필요'},
        'risk_checklist': [{'risk_id': 'synthetic-risk', 'title': '합성 자료 위험', 'outcome': 'needs_review', 'blocks_generation': True, 'required_features': ['assets[].gross_value'], 'source_ids': []}],
        'calculation_results': {'case_revision': 1, 'results': [{'rule_id': 'INCOME.MONTHLY_NET', 'rule_version': 'synthetic', 'outcome': 'UNKNOWN', 'values': {}, 'input_assertion_ids': ['fact-1'], 'missing_features': ['assets[].gross_value'], 'notes': []}]},
        'findings': [{'label': '가치 근거 확인', 'result': 'UNKNOWN', 'message': '자료 필요'}],
        'calculations': [{'key': 'value', 'label': '재산 합계', 'value': None, 'unit': 'KRW', 'status': 'pending', 'formula': '검토된 평가액 합계'}],
        'artifacts': [], 'artifact_history': [], 'events': [], 'reviews': {'caseworker': None, 'lawyer': None}, 'template_approved': False}


def artifacts():
    return [{'id': 'synthetic-version-1', 'case_revision': 1, 'name': 'synthetic.docx', 'title': '합성 신청서', 'kind': 'application', 'format': 'DOCX',
             'version_url': f'/api/cases/{SID}/artifact-versions/synthetic-version-1/download',
             'url': f'/api/sessions/{SID}/artifacts/synthetic.docx'}]


async def run(base_url, screenshots):
    if urlparse(base_url).hostname not in {'127.0.0.1', 'localhost'}:
        raise ValueError('Only localhost URLs are allowed.')
    state = None; calls = []; errors = []; images = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 1050})
        page.on('pageerror', lambda error: errors.append(str(error)))

        async def mock(route):
            nonlocal state
            request = route.request; path = urlparse(request.url).path; method = request.method
            calls.append((method, path))
            body = request.post_data_json if 'application/json' in request.headers.get('content-type', '') else {}
            result = {}; status = 200
            if path == '/api/health':
                result = {'api_key_configured': True, 'n8n_ready': True, 'model': 'gpt-6-luna'}
            elif path == '/api/catalog':
                result = {'features': [{'key': 'assets[].gross_value', 'label': '평가액', 'type': 'money'},
                                       {'key': 'person.name', 'label': '성명', 'type': 'text'},
                                       {'key': 'claims.total_present_value', 'label': '현재가치', 'type': 'money'}],
                          'document_types': [{'id': 'asset_value', 'label': '시가 확인 자료'}], 'rule_sources': [],
                          'rule_release': {'id': 'synthetic-review-release', 'status': 'REVIEW_REQUIRED'}}
            elif path == '/api/cases' and method == 'GET': result = {'cases': [state] if state else []}
            elif path == '/api/cases' and method == 'POST': state = fixture(); state.update(body); result = state
            elif path == f'/api/cases/{SID}' and method == 'DELETE': state = None; result = {'deleted': True}
            elif path == f'/api/cases/{SID}' and method == 'PATCH': state.update(body); result = state
            elif path in {f'/api/cases/{SID}', f'/api/sessions/{SID}'}: result = state
            elif '/documents' in path:
                if method == 'POST': state['documents'].append({'id': 'doc-1', 'name': 'synthetic-ui.pdf', 'pages': 1, 'evidence_pages': [1], 'excluded_pages': []})
                elif method == 'PATCH': state['documents'][0].update(body); state['requirements'][0]['status'] = 'satisfied'
                elif method == 'DELETE': state['documents'] = []
                result = state
            elif '/assertions' in path:
                if method == 'POST': state['assertions'].append({**body, 'id': f"fact-new-{len(state['assertions'])}"})
                elif method == 'PATCH':
                    old = next(item for item in state['assertions'] if item['id'] == path.rsplit('/', 1)[-1])
                    state['assertions'].append({**body, 'id': old['id'] + '-v2', 'supersedes': old['id']})
                elif method == 'DELETE': next(item for item in state['assertions'] if item['id'] == path.rsplit('/', 1)[-1])['state'] = 'RETRACTED'
                state['artifacts'] = []; result = state
            elif path.endswith('/assess'): state['route'] = 'DRAFT'; state['generation_gate'] = {'can_generate': True, 'reason': '합성 조건 확인'}; result = state
            elif path.endswith('/rule-release/review'):
                if method == 'GET':
                    result = {'release': {'id': 'synthetic-rule-release', 'status': 'REVIEW_REQUIRED'}, 'can_review': True, 'missing_sources': [],
                        'required_rule_ids': ['KR.579.DEBT_LIMITS', 'SEOUL.405.BASIC_LIVING_2026', 'KR.614.MINIMUM_REPAYMENT', 'KR.614.LIQUIDATION_COMPARISON', 'SEOUL.405.ADDITIONAL_HOUSING', 'INCOME.MONTHLY_NET', 'PLAN.NOMINAL_PAYMENTS'],
                        'source_versions': [{'source_id': 'synthetic-official-source', 'version_id': 'synthetic-v1', 'content_hash': '0' * 64, 'effective_from': '2026-01-01'}]}
                else:
                    assert len(body['reviewed_rule_ids']) == 7 and body['reviewer'] and body['review_note']
                    assert body['source_versions'][0]['content_hash'] == '0' * 64
                    state['rule_release'] = {'id': 'synthetic-rule-release', 'status': 'VERIFIED'}; result = state
            elif path.endswith('/run'): result = state
            elif path.endswith('/objects') and method == 'POST': state['objects'].append({**body, 'id': 'vehicle-new'}); result = state
            elif '/objects/' in path: next(item for item in state['objects'] if item['id'] == path.rsplit('/', 1)[-1]).update(body); result = state
            elif path.endswith('/valuation'):
                state['objects'][0]['valuations'] = [{'status': 'human_auth_required', 'provider': body['provider'], 'as_of': body['parameters']['as_of'], 'price': None, 'reason': '합성 본인 인증 자료 필요'}]; result = state
            elif path.endswith('/disposition'): state['objects'][0]['scenarios'] = [{'summary': '합성 시나리오 · 잔여대금 유지'}]; result = state
            elif '/forms/' in path and method == 'GET':
                result = {'kind': 'application', 'title': '합성 신청서', 'fields': [
                    {'key': 'name', 'label': '성명', 'feature_key': 'person.name', 'value': '합성인', 'editable': True, 'derived': False, 'sources': []},
                    {'key': 'sum', 'label': '계산 합계', 'feature_key': 'assets[].gross_value', 'value': '1000', 'editable': False, 'derived': True, 'sources': []}]}
            elif '/forms/' in path and method == 'PATCH': state['artifacts'] = []; result = state
            elif path.endswith('/generate'): state['artifacts'] = artifacts(); result = state
            elif '/artifacts/' in path and method == 'DELETE': state['artifact_history'] = [{**artifact, 'status': 'archived'} for artifact in state['artifacts']]; state['artifacts'] = []; result = state
            elif path.endswith('/review'):
                state['reviews'][body['role']] = {'name': body['name'], 'at': '2026-10-26T01:00:00Z', 'revision': state['revision']}; state['template_approved'] = True; result = state
            elif path.startswith('/api/knowledge/'):
                if path.endswith('/search'): result = {'results': [{'title': '합성 근거', 'excerpt': '<script>window.fixtureInjected=true</script>', 'version': 'test', 'authority_type': 'FIRM_POLICY'}]}
                else: result = {'sources': [{'title': '합성 근거', 'status': 'active'}], 'releases': [{'version': 'test', 'status': 'approved'}], 'last_check': {'at': '2026-10-26T01:00:00Z', 'status': 'completed'}, 'changes': [], 'notifications': []}
            elif path.endswith('/heartbeat'): result = {'ok': True}
            else: status = 404; result = {'detail': 'Unknown synthetic route: ' + path}
            if state and method != 'GET':
                state['revision'] += 1; state['events'].append({'type': 'assertion.recorded', 'message': '합성 변경 기록', 'revision': state['revision']})
            await route.fulfill(status=status, content_type='application/json', body=json.dumps(result, ensure_ascii=False))

        await page.route('**/api/**', mock)
        try:
            response = await page.goto(base_url.rstrip('/') + '/', wait_until='networkidle')
            assert response.status == 200 and await page.locator('#case-new').is_enabled()
            assert await page.locator('#upload-button').is_disabled()
            if screenshots:
                folder = ROOT / '.runtime' / 'screenshots'; folder.mkdir(parents=True, exist_ok=True)
                for name, width, height in [('empty-desktop.png', 1440, 1050), ('empty-mobile.png', 390, 844)]:
                    await page.set_viewport_size({'width': width, 'height': height}); await page.screenshot(path=str(folder / name), full_page=True); images.append(str(folder / name))
                await page.set_viewport_size({'width': 1440, 'height': 1050})

            async def view(name): await page.locator(f'.workspace-tabs [data-view="{name}"]').click()
            async def save():
                await page.locator('#editor-save').click(); await page.wait_for_function("!document.getElementById('editor-dialog').open")

            await page.locator('#case-new').click(); await page.locator('#edit-case-name').fill('합성 UI 사건')
            await page.locator('#edit-income-type').select_option('wage'); await save()
            assert '급여' in await page.locator('#income-type-caption').inner_text()
            assert await page.locator('#assessment-axes .axis-card').count() == 5
            assert 'REVIEW_REQUIRED' in await page.locator('#case-rule-status').inner_text()
            state['status'] = 'running'; await page.evaluate('refreshSession()')
            assert await page.locator('#case-edit').is_enabled()
            assert await page.locator('#file-input').is_enabled()
            assert await page.locator('#assertion-new').is_enabled()
            assert '처리 중' in await page.locator('#session-status').inner_text()
            await page.locator('#case-edit').click(); await page.locator('#edit-case-name').fill('합성 UI 사건'); await save()
            state['status'] = 'queued'; await page.evaluate('refreshSession()')
            assert await page.locator('#session-status').inner_text() == '처리 대기'
            assert await page.locator('#file-input').is_enabled()
            state['status'] = 'needs_action'; await page.evaluate('refreshSession()')
            assert await page.locator('#session-status').inner_text() == '자료·검토 보완 필요'
            state['status'] = 'ready'; await page.evaluate('refreshSession()')
            await view('outputs'); assert await page.locator('#generate-case').is_disabled()
            await view('documents')
            await page.locator('#file-input').set_input_files({'name': 'synthetic-ui.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 synthetic mocked upload'})
            await page.locator('#upload-button').click(); await page.wait_for_function("document.getElementById('metric-documents').textContent === '1'")
            assert (await page.locator('#document-register').get_by_role('link', name='원본 내려받기').get_attribute('href')).endswith('/documents/doc-1/download')
            await page.locator('#document-register').get_by_role('button', name='종류 · 대상 · 기간 수정').click()
            await page.locator('#edit-document-type').select_option('asset_value'); await save()
            await page.locator('#run-button').click()
            await view('assertions'); await page.locator('#assertion-grid summary').first.click()
            assert '<script>' in await page.locator('#assertion-grid blockquote').first.inner_text()
            assert await page.evaluate('window.fixtureInjected') is None
            await page.locator('#assertion-grid').get_by_role('button', name='정정 · 채택').first.click()
            await page.locator('#edit-fact-value').fill('2500'); await page.locator('#edit-fact-state').select_option('VERIFIED')
            await page.locator('#edit-measurement-period').select_option('MONTHLY')
            await page.locator('#edit-fact-period-start').fill('2026-01-01'); await page.locator('#edit-fact-period-end').fill('2026-09-30')
            await page.locator('#edit-accepted').check(); await page.locator('#edit-fact-reason').fill('합성 근거 확인'); await save()
            assert state['assertions'][-1]['measurement_period'] == 'MONTHLY'
            assert state['assertions'][-1]['period_start'] == '2026-01-01'
            assert '작성에 채택' in await page.locator('#assertion-grid').inner_text()
            await page.locator('#assertion-filter').select_option('all'); assert '이전 버전' in await page.locator('#assertion-grid').inner_text()
            await page.locator('#assertion-filter').select_option('current')
            await page.locator('#assertion-new').click(); await page.locator('#edit-feature-key').select_option('person.name')
            await page.locator('#edit-fact-value').fill('합성 추가인'); await page.locator('#edit-fact-reason').fill('합성 입력'); await save()
            page.once('dialog', lambda dialog: dialog.accept())
            await page.locator('#assertion-grid .workspace-row').filter(has_text='합성 추가인').get_by_role('button', name='철회', exact=True).click()
            await page.wait_for_function("!document.getElementById('assertion-grid').textContent.includes('합성 추가인')")
            await page.locator('#assertion-new').click(); await page.locator('#edit-feature-key').select_option('claims.total_present_value')
            assert await page.locator('#pv-review-fields').is_visible()
            assert not await page.locator('#edit-normalized').is_checked()
            await page.locator('#edit-fact-value').fill('2500'); await page.locator('#edit-normalized').check()
            await page.locator('#edit-fact-reason').fill('합성 현재가치 근거 확인')
            await page.locator('#editor-save').click(); await page.wait_for_function("!document.getElementById('editor-error').hidden")
            assert '평가 기준일' in await page.locator('#editor-error').inner_text()
            await page.locator('#edit-valuation-date').fill('2026-10-01'); await page.locator('#edit-basis-id').fill('synthetic-reviewed-basis'); await save()
            assert state['assertions'][-1]['normalized'] is True
            assert state['assertions'][-1]['basis_id'] == 'synthetic-reviewed-basis'
            await view('documents'); await page.locator('#requirement-list').get_by_role('button', name='받은 자료 연결').click()
            await page.locator('#edit-document-id').select_option('doc-1'); await save()
            await view('overview'); await page.locator('#assess-button').click()
            await page.wait_for_function("document.getElementById('case-route').textContent.includes('초안 작성 단계')")
            await view('calculations'); assert '합성 자료 위험' in await page.locator('#risk-checklist').inner_text()
            assert '계산에 사용한 사실' in await page.locator('#calculation-list').inner_text()
            await view('assets'); await page.locator('#asset-list').get_by_role('button', name='시세 · 평가 근거').first.click()
            await page.locator('#edit-valuation-date').fill('2026-10-26'); await save()
            assert '본인 인증 자료 필요' in await page.locator('#asset-list').inner_text()
            assert '확정된 조회 금액 없음' in await page.locator('#asset-list').inner_text()
            await page.locator('#asset-list').get_by_role('button', name='처분 가정 비교').first.click()
            for key, value in [('sale-amount', '10000'), ('payoff', '3000'), ('costs', '500'), ('scenario-reason', '합성 가정')]: await page.locator('#edit-' + key).fill(value)
            await save(); assert '합성 시나리오' in await page.locator('#asset-list').inner_text()
            await view('outputs'); await page.locator('#generate-case').click()
            await page.locator('#artifact-list').get_by_role('button', name='미리보기 · 수정').click()
            assert await page.locator('#edit-form-1').is_disabled()
            await page.locator('#edit-form-0').fill('합성 수정인'); await page.locator('#edit-form-reason').fill('합성 정정'); await save()
            assert await page.locator('#artifact-empty').is_visible()
            await page.locator('#generate-case').click(); assert await page.locator('#artifact-list .artifact-download').count() == 1
            await page.locator('#template-approved').check(); await page.locator('#caseworker-name').fill('합성 담당자')
            await page.locator('#caseworker-button').click(); await page.locator('#lawyer-name').fill('합성 변호사')
            await page.locator('#lawyer-button').click(); await page.wait_for_function("document.getElementById('lawyer-result').textContent.includes('합성 변호사')")
            page.once('dialog', lambda dialog: dialog.accept())
            await page.locator('#artifact-list').get_by_role('button', name='현재 생성본 삭제').click()
            await page.wait_for_function("!document.getElementById('artifact-empty').hidden")
            await view('history'); assert '합성 변경 기록' in await page.locator('#event-list').inner_text()
            assert '이전 생성 버전' in await page.locator('#event-list').inner_text()
            assert (await page.locator('#event-list').get_by_role('link', name='이전 생성본 내려받기').get_attribute('href')).endswith('/artifact-versions/synthetic-version-1/download')
            await view('knowledge'); await page.locator('#knowledge-query').fill('소득'); await page.locator('#knowledge-search button').click()
            await page.wait_for_function("document.getElementById('knowledge-results').textContent.includes('<script>')")
            assert await page.evaluate('window.fixtureInjected') is None
            await page.locator('#knowledge-check').click()
            before_review = calls.count(('POST', f'/api/cases/{SID}/rule-release/review'))
            await page.locator('#rule-release-review').click(); await page.wait_for_function("document.getElementById('editor-dialog').open")
            assert await page.locator('[data-rule-id]').count() == 7
            assert await page.locator('[data-rule-id]:checked').count() == 0
            assert not await page.locator('#edit-rule-confirmation').is_checked()
            await page.set_viewport_size({'width': 390, 'height': 844})
            assert await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth')
            assert await page.locator('#editor-dialog').evaluate('(element) => element.scrollWidth <= element.clientWidth')
            await page.set_viewport_size({'width': 1440, 'height': 1050})
            assert calls.count(('POST', f'/api/cases/{SID}/rule-release/review')) == before_review
            await page.locator('#edit-rule-reviewer').fill('합성 검토자'); await page.locator('#edit-rule-review-note').fill('합성 테스트에서만 명시 확인')
            await page.locator('#editor-save').click(); await page.wait_for_function("!document.getElementById('editor-error').hidden")
            assert calls.count(('POST', f'/api/cases/{SID}/rule-release/review')) == before_review
            for check in await page.locator('[data-rule-id]').all(): await check.check()
            await page.locator('#edit-rule-confirmation').check(); await save()
            assert calls.count(('POST', f'/api/cases/{SID}/rule-release/review')) == before_review + 1
            before = calls.count(('DELETE', f'/api/cases/{SID}')); await page.locator('#end-session').click()
            assert calls.count(('DELETE', f'/api/cases/{SID}')) == before
            await page.locator('#case-select').select_option(SID)
            await page.wait_for_function("document.getElementById('workspace-title').textContent === '합성 UI 사건'")
            await page.set_viewport_size({'width': 390, 'height': 844})
            for name in ['overview', 'documents', 'assertions', 'assets', 'outputs', 'knowledge']:
                await view(name); assert await page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), name
            page.once('dialog', lambda dialog: dialog.accept()); await page.locator('#case-delete').click()
            await page.wait_for_function("document.getElementById('case-select').options.length === 1")
            assert state is None and not errors, errors
            return {'checks': ['case CRUD/reopen', 'additional upload', 'document mapping', 'assertion version/adopt/retract',
                'XSS-safe evidence', 'requirements', 'assessment route', 'valuation unavailable state', 'disposition simulation',
                'form preview/edit/read-only calculation', 'regeneration/archive', 'two-stage review', 'history',
                'knowledge search/check', 'edit while running', 'queued/needs_action states',
                'measurement periods', 'explicit PV normalization review', 'release review gate',
                'explicit seven-rule/source-version review', 'original and immutable historical downloads', '390px all-view and review-modal layout'], 'javascript_errors': errors,
                'real_case_reads_or_mutations': 0, 'external_ai_calls': 0, 'screenshots': images}
        finally: await browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8010')
    parser.add_argument('--screenshots', action='store_true')
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.base_url, args.screenshots)), ensure_ascii=False, indent=2))
