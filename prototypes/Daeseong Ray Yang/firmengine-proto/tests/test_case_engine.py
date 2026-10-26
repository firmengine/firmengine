"""Blueprint contracts exercised with synthetic cases, never filed answers."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest
import json

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.case_engine import evaluate_case, flat_to_assertions

ROOT = Path(__file__).resolve().parents[1]


def verified(key, value='verified', object_id=None, **extra):
    return {'id': key + '-' + str(object_id), 'feature_key': key, 'value': value,
            'object_id': object_id, 'state': 'VERIFIED',
            'evidence_refs': [{'document_id': 'synthetic-proof', 'page': 1, 'excerpt': 'synthetic'}], **extra}


def complete_case():
    data = case('wage')
    data.update(rule_release_id='synthetic-approved', rule_release={'id': 'synthetic-approved',
        'status': 'APPROVED', 'effective_from': '2026-01-01', 'effective_to': '2026-12-31'},
        income_evidence_period={'start': '2026-01-01', 'end': '2026-09-30'})
    mappings = json.loads((ROOT/'rules/document_feature_mappings.json').read_text(encoding='utf-8'))
    for rule in mappings['requirements']:
        if rule['scope'] != 'case' or 'wage' not in rule.get('income_types', []):
            continue
        for key in rule['purpose_features']:
            data['assertions'].append(verified(key))
        for group in rule['alternatives']:
            for kind in group.get('all_of', []):
                data['documents'].append({'id': kind, 'document_type': kind, 'mapping_status': 'VERIFIED',
                    'period_start': '2026-01-01', 'period_end': '2026-12-31'})
    data['assertions'] += [verified('coverage.debt_inventory', 'COMPLETE'), verified('coverage.asset_inventory', 'COMPLETE'),
                           verified('income_source.employer', 'Synthetic employer')]
    data['documents'].append({'id': 'synthetic-proof', 'document_type': 'review_evidence', 'mapping_status': 'VERIFIED',
        'period_start': '2026-01-01', 'period_end': '2026-12-31'})
    release = json.loads((ROOT/'rules/release.json').read_text(encoding='utf-8'))
    data['calculation_results'] = {'case_revision': 1, 'rule_release_id': 'synthetic-approved', 'computed_by': 'n8n-code',
        'results': [{'rule_id': key, 'outcome': 'PASS'} for key in release['implemented_numeric_rules']]}
    return data


def case(income_type='business'):
    return {'id': 'synthetic-case', 'revision': 1, 'court_id': 'seoul',
            'income_type': income_type, 'application_date': '2026-10-26',
            'objects': [], 'assertions': [], 'documents': [], 'records': []}


class CaseEngineTests(unittest.TestCase):
    def test_missing_business_evidence_is_a_supplement_request_not_ineligibility(self):
        result = evaluate_case(case())
        self.assertEqual(result['route'], 'SUPPLEMENT')
        self.assertEqual(set(result['assessment']), {'eligibility', 'evidence_completeness',
                         'repayment_plan', 'procedure', 'discharge_liability'})
        purposes = {row['id'] for row in result['requirements']}
        self.assertIn('business_income', purposes)
        self.assertNotIn('salary_income', purposes)
        self.assertTrue(all(row['outcome'] != 'FAIL' for row in result['findings']))
        self.assertNotIn('approval_probability', result)

    def test_every_catalog_entry_is_reported_without_claiming_manual_checks_clear(self):
        result = evaluate_case(case())
        catalog = json.loads((ROOT/'knowledge/bootstrap/correction_catalog.json').read_text(encoding='utf-8'))
        self.assertEqual({row['risk_id'] for row in result['risk_checklist']}, {row['id'] for row in catalog['entries']})
        self.assertEqual(next(row for row in result['risk_checklist'] if row['risk_id'] == 'DOC-01')['outcome'], 'needs_review')

    def test_mandatory_missing_employer_blocks_even_when_other_requirements_satisfied(self):
        data = complete_case()
        data['assertions'] = [row for row in data['assertions'] if row['feature_key'] != 'income_source.employer']
        result = evaluate_case(data)
        check = next(row for row in result['risk_checklist'] if row['risk_id'] == 'DOC-14')
        self.assertTrue(check['blocks_generation'])
        self.assertFalse(result['generation_gate']['can_generate'])
        self.assertEqual(result['route'], 'SUPPLEMENT')

    def test_large_outflow_is_warning_and_does_not_prevent_otherwise_ready_draft(self):
        data = complete_case()
        data['objects'].append({'id': 'tx1', 'type': 'transaction'})
        data['assertions'].append(verified('transactions[].outflow', '500000', 'tx1', state='EXTRACTED'))
        result = evaluate_case(data)
        flag = next(row for row in result['findings'] if row['code'] == 'LARGE_OUTFLOW_INQUIRY')
        self.assertFalse(flag['blocks_generation'])
        self.assertTrue(result['generation_gate']['can_generate'], result['generation_gate'])
        self.assertEqual(result['route'], 'DRAFT')
        self.assertIn(flag['id'], result['generation_gate']['warning_issue_ids'])

    def test_existing_document_missing_feature_requests_verification_not_duplicate_upload(self):
        data = complete_case()
        data['assertions'] = [row for row in data['assertions'] if row['feature_key'] != 'jurisdiction.residence']
        result = evaluate_case(data)
        requirement = next(row for row in result['requirements'] if row['id'] == 'identity')
        self.assertEqual(requirement['status'], 'NEEDS_VERIFICATION')
        self.assertFalse(requirement['request_again'])

    def test_disposal_preserves_asset_and_requests_successor_proceeds_trace(self):
        data = case()
        data['objects'] = [{'id': 'car1', 'type': 'vehicle', 'metadata': {'disposal_proposed': True}}]
        before = deepcopy(data)
        result = evaluate_case(data)
        action = next(row for row in result['actions'] if row['type'] == 'DISPOSAL_STRATEGY_REVIEW')
        self.assertIn('successor_asset_ids', action['required_details'])
        self.assertIn('net_proceeds', action['required_details'])
        self.assertEqual(data, before)

    def test_flat_adapter_preserves_canonical_source_fields_and_contract_identity(self):
        rows = [{'id': 'r1', 'key': 'income_source.net', 'entity': 'Employer', 'value': '1000', 'state': 'unreviewed'},
                {'id': 'r2', 'key': 'creditor_principal', 'entity': 'Same bank', 'contract_id': 'A', 'value': '100', 'state': 'confirmed'},
                {'id': 'r3', 'key': 'creditor_principal', 'entity': 'Same bank', 'contract_id': 'B', 'value': '200', 'state': 'confirmed'}]
        result = flat_to_assertions(rows, [])
        self.assertEqual(result[0]['feature_key'], 'income_source.net')
        debts = [row for row in result if row['feature_key'] == 'debts[].principal']
        self.assertNotEqual(debts[0]['object_id'], debts[1]['object_id'])
        self.assertEqual(result, flat_to_assertions(rows, []))

    def test_partial_or_stale_calculation_cannot_open_gate(self):
        for change in ({'case_revision': 0}, {'results': [{'rule_id': 'KR.579.DEBT_LIMITS', 'outcome': 'PASS'}]}):
            data = complete_case()
            data['calculation_results'].update(change)
            self.assertFalse(evaluate_case(data)['generation_gate']['can_generate'])

    def test_mixed_sources_get_individual_wage_business_and_passive_requirements(self):
        data = case('mixed')
        for oid, kind in [('job1', 'wage'), ('job2', 'wage'), ('shop', 'business'), ('rental', 'rent')]:
            data['objects'].append({'id': oid, 'type': 'income_source'})
            data['assertions'].append(verified('income_source.kind', kind, oid))
        result = evaluate_case(data)
        found = {(row['id'], row['subject_id']) for row in result['requirements']}
        self.assertIn(('salary_income', 'job1'), found)
        self.assertIn(('salary_income', 'job2'), found)
        self.assertIn(('business_income', 'shop'), found)
        self.assertIn(('passive_income_rent', 'rental'), found)
        self.assertNotIn(('salary_income', 'shop'), found)

    def test_tax_deferral_proof_is_conditional_and_no_blanket_denial(self):
        data = case()
        data['objects'] = [{'id': 'tax1', 'type': 'tax_arrears'}]
        data['assertions'] = [verified('tax_arrears.deferral_status', 'APPROVED', 'tax1')]
        result = evaluate_case(data)
        req = next(row for row in result['requirements'] if row['id'] == 'tax_arrears')
        self.assertIn('tax_deferral_decision', req['alternatives'][0]['all_of'])
        self.assertFalse(result['generation_gate']['can_generate'])
        self.assertTrue(all(row['outcome'] != 'FAIL' for row in result['findings']))

    def test_reviewed_transaction_explanation_resolves_warning_without_changing_amount(self):
        data = complete_case()
        data['objects'] = [{'id': 'tx1', 'type': 'transaction'}]
        data['assertions'] += [verified('transactions[].outflow', '500000', 'tx1', state='EXTRACTED'),
            verified('transactions[].counterparty', 'Synthetic recipient', 'tx1'), verified('transactions[].purpose', 'Verified purpose', 'tx1')]
        data['risk_history'] = [{'risk_id': 'POLICY-OUTFLOW-500K', 'outcome': 'risk'}]
        result = evaluate_case(data)
        self.assertFalse(any(row['code'] == 'LARGE_OUTFLOW_INQUIRY' for row in result['findings']))
        self.assertEqual(next(row for row in result['risk_checklist'] if row['risk_id'] == 'POLICY-OUTFLOW-500K')['outcome'], 'resolved')

    def test_verified_feature_with_nonexistent_source_is_still_evidence_gap(self):
        data = complete_case()
        next(row for row in data['assertions'] if row['feature_key'] == 'jurisdiction.residence')['evidence_refs'] = [{'document_id': 'not-a-case-document', 'page': 1}]
        result = evaluate_case(data)
        requirement = next(row for row in result['requirements'] if row['id'] == 'identity')
        self.assertIn('jurisdiction.residence', requirement['features_without_evidence'])
        self.assertFalse(result['generation_gate']['can_generate'])

    def test_flat_assertion_record_identity_survives_confirmation_for_database_supersession(self):
        row = {'id':'r1','key':'creditor_principal','entity':'Synthetic bank','value':'100','period':'2026-10-26','state':'unreviewed'}
        before=flat_to_assertions([row], [])
        row['state']='confirmed'
        after=flat_to_assertions([row], [])
        self.assertEqual([item['record_id'] for item in before], [item['record_id'] for item in after])
        self.assertNotEqual(before[0]['id'], after[0]['id'])
        self.assertEqual(len({item['record_id'] for item in before}), len(before))

    def test_calculation_referencing_superseded_or_other_case_assertion_is_blocked(self):
        data=complete_case()
        data['calculation_results']['results'][0]['input_assertion_ids']=['not-a-current-assertion']
        result=evaluate_case(data)
        self.assertFalse(result['generation_gate']['can_generate'])
        self.assertTrue(any(row['code']=='CALCULATION_SOURCE_STALE' for row in result['findings']))

    def test_same_counterparty_transactions_keep_row_identity_and_separate_inquiries(self):
        records = []
        for index, (day, amount) in enumerate([('2026-10-01', '500000'), ('2026-10-02', '700000')], 1):
            for key, value in [('outflow', amount), ('counterparty', 'Same recipient')]:
                records.append({'id': f'tx-{index}-{key}', 'key': 'transactions[].' + key,
                    'entity': 'Same recipient', 'source_row': str(index), 'period': day,
                    'value': value, 'state': 'unreviewed',
                    'sources': [{'document_id': 'statement', 'page': 2, 'quote': 'synthetic row'}]})
        objects = [{'id': 'old-recipient-object', 'type': 'transaction', 'label': 'Same recipient'}]
        assertions = flat_to_assertions(records, [], objects)
        outflows = [row for row in assertions if row['feature_key'] == 'transactions[].outflow']
        self.assertEqual(len({row['object_id'] for row in outflows}), 2)
        for index in (1, 2):
            self.assertEqual(len({row['object_id'] for row in assertions if row['legacy_record_id'].startswith(f'tx-{index}-')}), 1)
        self.assertEqual({row['legacy_record_id']: row['object_id'] for row in assertions},
                         {row['legacy_record_id']: row['object_id'] for row in flat_to_assertions(list(reversed(records)), [], objects)})
        data = case()
        data['assertions'] = assertions
        inquiries = [row for row in evaluate_case(data)['findings'] if row['code'] == 'LARGE_OUTFLOW_INQUIRY']
        self.assertEqual(len(inquiries), 2)
        self.assertEqual(len({row['id'] for row in inquiries}), 2)

    def test_unidentified_same_bank_loans_from_different_rows_are_not_label_merged(self):
        rows = [{'id': f'loan-{page}', 'key': 'creditor_principal', 'entity': 'Same bank',
                 'value': str(page * 1000), 'period': '2026-10-26', 'state': 'confirmed',
                 'sources': [{'document_id': 'debt-proof', 'page': page, 'quote': 'synthetic loan'}]}
                for page in (1, 2)]
        assertions = flat_to_assertions(rows, [], [{'id': 'old-bank-object', 'type': 'debt', 'label': 'Same bank'}])
        principals = [row for row in assertions if row['feature_key'] == 'debts[].principal']
        self.assertEqual(len({row['object_id'] for row in principals}), 2)
        data = case()
        data['assertions'] = assertions
        gaps = [row for row in evaluate_case(data)['findings'] if row['code'] == 'REPEATED_ENTITY_IDENTITY_UNKNOWN']
        self.assertEqual(len(gaps), 2)
        self.assertTrue(all(row['kind'] == 'RuleGap' and row['blocks_generation'] for row in gaps))

    def test_contract_identifiers_are_scoped_to_creditor_not_globally_merged(self):
        records = [{'id': bank, 'key': 'creditor_principal', 'entity': bank,
                    'contract_id': '****1234', 'value': '1000', 'state': 'confirmed'}
                   for bank in ('Synthetic bank A', 'Synthetic bank B')]
        principals = [row for row in flat_to_assertions(records, []) if row['feature_key'] == 'debts[].principal']
        self.assertEqual(len({row['object_id'] for row in principals}), 2)

    def test_ambiguous_same_page_transactions_preserve_each_amount_and_require_identity_review(self):
        rows = [{'id': f'outflow-{index}', 'key': 'transactions[].outflow', 'entity': 'Same recipient',
                 'value': '500000', 'period': '2026-10-01', 'state': 'unreviewed',
                 'sources': [{'document_id': 'statement', 'page': 1, 'quote': 'same visible amount'}]}
                for index in (1, 2)]
        assertions = flat_to_assertions(rows, [])
        self.assertEqual(len({row['object_id'] for row in assertions}), 2)
        data = case()
        data['assertions'] = assertions
        result = evaluate_case(data)
        self.assertEqual(len([row for row in result['findings'] if row['code'] == 'REPEATED_ENTITY_IDENTITY_UNKNOWN']), 2)
        self.assertEqual(len({row['id'] for row in result['findings'] if row['code'] == 'LARGE_OUTFLOW_INQUIRY'}), 2)

    def test_editable_entity_contract_survives_legacy_merge_without_polluting_creditor_name(self):
        from app.engine import merge_facts
        facts = []
        for contract in ('****1111', '****2222'):
            for key, value in [('creditor_principal', '1000'), ('creditor_interest', '0')]:
                facts.append({'key': key, 'entity': f'debt|creditor=Same bank|contract={contract}',
                    'value': value, 'unit': 'KRW', 'period': '2026-10-26',
                    'document_id': 'proof', 'page': 1, 'quote': 'synthetic loan', 'confidence': 'high'})
        assertions = flat_to_assertions(merge_facts(facts), [])
        principals = [row for row in assertions if row['feature_key'] == 'debts[].principal']
        self.assertEqual(len({row['object_id'] for row in principals}), 2)
        self.assertTrue(all(row['identity_resolution'] == 'EXPLICIT_CONTRACT' for row in principals))
        names = [row['value'] for row in assertions if row['feature_key'] == 'debts[].current_creditor_id']
        self.assertEqual(set(names), {'Same bank'})

    def test_structured_transaction_entity_pairs_fields_across_distinct_period_labels(self):
        rows = [{'id': key, 'key': 'transactions[].' + key,
                 'entity': 'tx|doc=statement|page=1|row=3|account=***1234|at=2026-10-01 10:30',
                 'value': value, 'period': period, 'state': 'unreviewed',
                 'sources': [{'document_id': 'statement', 'page': 1, 'quote': 'synthetic row'}]}
                for key, value, period in [('outflow', '500000', '2026-10-01'), ('source_row', '3', '')]]
        result = flat_to_assertions(rows, [])
        self.assertEqual(len({row['object_id'] for row in result}), 1)
        self.assertTrue(all(row['identity_resolution'] == 'SOURCE_ROW' for row in result))


if __name__ == '__main__':
    unittest.main()
