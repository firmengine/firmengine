import json
import unittest
from unittest.mock import Mock

from app.valuation import evaluate_valuation, MOLIT_ENDPOINT


XML = '''<response><header><resultCode>000</resultCode></header><body><items>
<item><aptNm>Synthetic Apt</aptNm><dealAmount>12,345</dealAmount><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>3</dealDay><excluUseAr>59.9</excluUseAr><floor>3</floor><buildYear>2005</buildYear></item>
<item><aptNm>Cancelled Apt</aptNm><dealAmount>99,999</dealAmount><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>5</dealDay><cdealType>O</cdealType></item>
</items><totalCount>2</totalCount></body></response>'''


class ValuationTests(unittest.TestCase):
    def test_manual_requires_provenance_and_does_not_trust_input_verified(self):
        missing = evaluate_valuation('manual_evidence', {'price': '1000', 'as_of': '2026-10-26'})
        self.assertIn('source_url_or_document_id', missing['missing_inputs'])
        self.assertIsNone(missing['value'])
        result = evaluate_valuation('manual_evidence', {'price': '1,000', 'as_of': '2026-10-26',
            'document_id': 'synthetic-doc', 'page': 2, 'verified': True})
        self.assertEqual(result['value'], '1000')
        self.assertFalse(result['human_verified'])
        self.assertFalse(result['legal_valuation_approved'])
        self.assertEqual(result['evidence_refs'][0]['document_id'], 'synthetic-doc')
        citation = evaluate_valuation('manual_evidence', {'price': '1000', 'as_of': '2026-10-26',
            'source_url': 'https://example.test/document?document_id=123&token=hidden'})
        self.assertEqual(citation['source_url'], 'https://example.test/document?document_id=123')

    def test_zero_is_explicit_and_missing_or_float_never_becomes_zero(self):
        base = {'as_of': '2026-10-26', 'document_id': 'synthetic-doc'}
        self.assertEqual(evaluate_valuation('manual_evidence', dict(base, price='0'))['value'], '0')
        for value in [None, True, 1.5, '1e3', '-1', '0.5']:
            self.assertIsNone(evaluate_valuation('manual_evidence', dict(base, price=value))['value'])

    def test_car365_never_fetches_from_plate_or_user_url(self):
        fetch = Mock()
        result = evaluate_valuation('car365_reference', {'vehicle_number': '12test3456', 'url': 'https://evil.invalid'}, fetch=fetch)
        self.assertEqual(result['status'], 'human_auth_required')
        self.assertIsNone(result['price'])
        fetch.assert_not_called()

    def test_molit_requires_query_and_credential_without_fake_data(self):
        fetch = Mock()
        result = evaluate_valuation('molit_apartment', {'lawd_cd': '11110', 'deal_ymd': '202609'}, env={}, fetch=fetch)
        self.assertEqual(result['status'], 'credential_required')
        self.assertIsNone(result['value'])
        result = evaluate_valuation('molit_apartment', {'lawd_cd': '1111', 'deal_ymd': '202613'}, env={'MOLIT_API_KEY': 'test-secret'}, fetch=fetch)
        self.assertEqual(set(result['missing_inputs']), {'lawd_cd', 'deal_ymd'})
        fetch.assert_not_called()

    def test_molit_unit_conversion_selection_and_cancelled_trade_exclusion(self):
        fetch = Mock(return_value={'status_code': 200, 'content': XML})
        inputs = {'lawd_cd': '11110', 'deal_ymd': '202609', 'url': 'https://evil.invalid'}
        result = evaluate_valuation('molit_apartment', inputs, env={'MOLIT_API_KEY': 'test-secret'}, fetch=fetch)
        self.assertEqual(fetch.call_args.args[0], MOLIT_ENDPOINT)
        self.assertEqual(result['status'], 'comparables_found')
        self.assertIsNone(result['price'])
        self.assertEqual(len(result['comparables']), 1)
        self.assertEqual(result['raw_reference']['cancelled_records_excluded'], 1)
        self.assertEqual(result['comparables'][0]['price_won'], '123450000')
        inputs['selected_reference'] = result['comparables'][0]['reference_id']
        selected = evaluate_valuation('molit_apartment', inputs, env={'MOLIT_API_KEY': 'test-secret'}, fetch=fetch)
        self.assertEqual(selected['value'], '123450000')
        self.assertEqual(selected['as_of'], '2026-09-03')
        self.assertFalse(selected['human_verified'])
        self.assertNotIn('test-secret', json.dumps(selected))
        self.assertNotIn('serviceKey', json.dumps(selected))

    def test_provider_failure_does_not_echo_error_body_or_key(self):
        fetch = Mock(return_value={'status_code': 403, 'content': 'test-secret rejected'})
        result = evaluate_valuation('molit_apartment', {'lawd_cd': '11110', 'deal_ymd': '202609'},
            env={'MOLIT_API_KEY': 'test-secret'}, fetch=fetch)
        self.assertEqual(result['status'], 'provider_error')
        self.assertNotIn('test-secret', json.dumps(result))
        self.assertIsNone(result['value'])

    def test_vehicle_api_uses_only_trusted_configuration_and_preserves_provenance(self):
        response = {'value': '100', 'unit': 'manwon', 'currency': 'KRW', 'as_of': '2026-10-25',
                    'reference_id': 'synthetic-vendor-1', 'source_url': 'https://vendor.example/quote?token=private'}
        fetch = Mock(return_value={'status_code': 200, 'content': json.dumps(response)})
        result = evaluate_valuation('configured_vehicle_api', {'vehicle_number': '12ABC3456', 'url': 'https://evil.invalid'},
            env={'VEHICLE_VALUATION_API_URL': 'https://vendor.example/api', 'VEHICLE_VALUATION_API_KEY': 'test-secret'}, fetch=fetch)
        self.assertEqual(fetch.call_args.args[0], 'https://vendor.example/api')
        self.assertEqual(result['value'], '1000000')
        self.assertEqual(result['source_url'], 'https://vendor.example/quote')
        self.assertFalse(result['verified'])
        self.assertNotIn('test-secret', json.dumps(result))
        self.assertNotIn('private', json.dumps(result))

    def test_vehicle_requires_explicit_unit_currency_date_and_configuration(self):
        fetch = Mock(return_value={'status_code': 200, 'content': '{"value":"100"}'})
        result = evaluate_valuation('configured_vehicle_api', {'vehicle_number': '12ABC3456'}, env={}, fetch=fetch)
        self.assertEqual(result['status'], 'not_configured')
        fetch.assert_not_called()
        result = evaluate_valuation('configured_vehicle_api', {'vehicle_number': '12ABC3456'},
            env={'VEHICLE_VALUATION_API_URL': 'https://vendor.example/api'}, fetch=fetch)
        self.assertEqual(result['status'], 'provider_mapping_required')
        self.assertIsNone(result['value'])

    def test_timeout_is_a_nonvalue_with_next_action(self):
        result = evaluate_valuation('configured_vehicle_api', {'vehicle_number': '12ABC3456'},
            env={'VEHICLE_VALUATION_API_URL': 'https://vendor.example/api'}, fetch=Mock(side_effect=TimeoutError()))
        self.assertEqual(result['status'], 'provider_unavailable')
        self.assertIsNone(result['value'])
        self.assertTrue(result['next_action'])


if __name__ == '__main__':
    unittest.main()
