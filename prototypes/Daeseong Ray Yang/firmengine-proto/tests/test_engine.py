"""Regressions for evidence scope and human-review completion boundaries."""
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import engine


def record(key, value, *, entity='', period='', state='confirmed', unit=None):
    if unit is None:
        unit = ('months' if key == 'repayment_months' else 'persons' if key == 'household_size'
                else 'KRW' if key in engine.MONEY_KEYS else '')
    return {'id': key + '-' + entity + '-' + period, 'key': key, 'label': key,
            'value': value, 'entity': entity, 'period': period, 'state': state, 'unit': unit,
            'sources': [{'document_id': 'synthetic', 'page': 1, 'quote': 'synthetic evidence'}]}


def complete_session():
    values = {'client_name': '합성사용자', 'resident_id': '900101-*******', 'address': '합성 주소',
              'business_name': '합성상점', 'court_name': '서울회생법원', 'approved_monthly_income': '2500000',
              'recognized_living_cost': '1500000', 'repayment_months': '36', 'monthly_trustee_fee': '0',
              'liquidation_value': '5000000', 'household_size': '1'}
    rows = [record(key, value) for key, value in values.items()]
    rows += [record('creditor_principal', '100000000', entity='합성은행', period='2026-10-01'),
             record('creditor_interest', '500000', entity='합성은행', period='2026-10-01')]
    return {'records': rows, 'template_approved': True}


def calculated(rows):
    return {entry['key']: entry for entry in engine.calculate(rows)}


def fact(value, *, period='2026-10-01', unit='KRW', page=1, confidence='high'):
    return {'key': 'creditor_principal', 'value': value, 'entity': '합성은행', 'period': period,
            'unit': unit, 'document_id': 'synthetic', 'page': page, 'quote': 'synthetic debt quote',
            'confidence': confidence}


class EvidenceEngineTests(unittest.TestCase):
    def test_missing_legal_inputs_are_explicit_placeholders(self):
        rows = engine.merge_facts([])
        by_key = {row['key']: row for row in rows}
        for key in ['approved_monthly_income', 'household_size', 'monthly_trustee_fee', 'repayment_months', 'court_name']:
            self.assertIsNone(by_key[key]['value'])
            self.assertEqual(by_key[key]['state'], 'missing')
        self.assertEqual(by_key['household_size']['unit'], 'persons')

    def test_equivalent_amounts_and_explicit_dates_merge_with_all_evidence(self):
        rows = engine.merge_facts([fact('1,000원', period='2026. 10. 1.', page=1),
                                   fact('1000.00', period='2026-10-01', page=2, confidence='medium')])
        debts = [row for row in rows if row['key'] == 'creditor_principal']
        self.assertEqual(len(debts), 1)
        self.assertEqual(debts[0]['state'], 'unreviewed')
        self.assertEqual(debts[0]['confidence'], 'medium')
        self.assertEqual(len(debts[0]['sources']), 2)

    def test_conflicting_amounts_are_not_silently_selected(self):
        rows = engine.merge_facts([fact('1000'), fact('2000', page=2)])
        debt = next(row for row in rows if row['key'] == 'creditor_principal')
        self.assertEqual(debt['state'], 'conflict')
        self.assertIsNone(debt['value'])
        self.assertEqual(len(debt['candidates']), 2)

    def test_period_snapshots_stay_separate_until_explicit_exclusion(self):
        rows = [record('creditor_principal', '1000', entity='합성은행', period='2026-09-01'),
                record('creditor_principal', '900', entity='합성은행', period='2026-10-01'),
                record('creditor_interest', '0', entity='합성은행', period='2026-10-01')]
        self.assertEqual(calculated(rows)['debt_principal_total']['status'], 'pending')
        rows[0]['state'] = 'excluded'
        self.assertEqual(calculated(rows)['debt_principal_total']['value'], '900')

    def test_different_currencies_do_not_merge_or_become_won(self):
        rows = engine.merge_facts([fact('1000', unit='KRW'), fact('1000', unit='USD', page=2)])
        debts = [row for row in rows if row['key'] == 'creditor_principal']
        self.assertEqual(len(debts), 2)
        usd = next(row for row in debts if row['unit'] == 'USD')
        usd['state'] = 'confirmed'
        self.assertEqual(calculated([usd])['debt_principal_total']['status'], 'pending')

    def test_confirmed_complete_inputs_calculate_without_legal_defaults(self):
        session = engine.validate(complete_session())
        self.assertEqual(session['issues'], [])
        values = {row['key']: row['value'] for row in session['calculations']}
        self.assertEqual(values['monthly_payment'], '1000000')
        self.assertEqual(values['total_repayment'], '36000000')
        self.assertEqual(values['repayment_rate'], '36.00')

    def test_unconfirmed_inputs_and_missing_fee_do_not_calculate(self):
        session = complete_session()
        for row in session['records']:
            row['state'] = 'unreviewed'
        self.assertTrue(all(row['status'] == 'pending' for row in engine.calculate(session['records'])))
        session = complete_session()
        session['records'] = [row for row in session['records'] if row['key'] != 'monthly_trustee_fee']
        self.assertEqual(calculated(session['records'])['monthly_payment']['status'], 'pending')

    def test_excluding_required_identity_or_household_does_not_clear_gate(self):
        for key in ['client_name', 'resident_id', 'address', 'business_name', 'court_name', 'household_size']:
            with self.subTest(key=key):
                session = complete_session()
                next(row for row in session['records'] if row['key'] == key)['state'] = 'excluded'
                self.assertIn('REQUIRED_MISSING', [issue['code'] for issue in engine.validate(session)['issues']])

    def test_confirmed_household_must_be_positive_integer_even_with_empty_unit(self):
        for value in ['abc', '0', '-1', '1.5', '1000원', None]:
            with self.subTest(value=value):
                session = complete_session()
                household = next(row for row in session['records'] if row['key'] == 'household_size')
                household.update(value=value, unit='')
                codes = [issue['code'] for issue in engine.validate(session)['issues']]
                self.assertTrue('INVALID_NUMBER' in codes or 'INVALID_VALUE' in codes)

    def test_confirmed_empty_values_cannot_bypass_validation(self):
        session = complete_session()
        next(row for row in session['records'] if row['key'] == 'address')['value'] = '   '
        self.assertIn('INVALID_VALUE', [issue['code'] for issue in engine.validate(session)['issues']])

    def test_interest_total_requires_same_creditor_coverage_as_principal(self):
        session = complete_session()
        session['records'].append(record('creditor_principal', '30000000', entity='합성은행2', period='2026-10-01'))
        result = engine.validate(session)
        self.assertIn('CREDITOR_SCOPE', [issue['code'] for issue in result['issues']])
        self.assertEqual(calculated(session['records'])['debt_interest_total']['status'], 'pending')
        session['records'].append(record('creditor_interest', '0', entity='합성은행2', period='2026-10-01'))
        self.assertEqual(calculated(session['records'])['debt_interest_total']['value'], '500000')

    def test_principal_and_interest_different_dates_block_completion(self):
        session = complete_session()
        next(row for row in session['records'] if row['key'] == 'creditor_interest')['period'] = '2025-10-01'
        self.assertIn('CREDITOR_SCOPE', [issue['code'] for issue in engine.validate(session)['issues']])

    def test_unidentified_creditor_does_not_form_a_valid_total(self):
        rows = [record('creditor_principal', '1000'), record('creditor_interest', '0')]
        self.assertEqual(calculated(rows)['debt_principal_total']['status'], 'pending')

    def test_fractional_or_negative_repayment_period_is_not_replaced_with_36(self):
        for value in ['1.5', '0', '-36', None]:
            session = complete_session()
            next(row for row in session['records'] if row['key'] == 'repayment_months')['value'] = value
            self.assertIsNone(calculated(session['records'])['total_repayment']['value'])

    def test_arithmetic_retains_more_than_default_decimal_context_precision(self):
        session = complete_session()
        income, living = 10**45 + 123, 10**20 + 7
        for row in session['records']:
            if row['key'] == 'approved_monthly_income': row['value'] = str(income)
            if row['key'] == 'recognized_living_cost': row['value'] = str(living)
            if row['key'] == 'monthly_trustee_fee': row['value'] = '1'
            if row['key'] == 'creditor_principal': row['value'] = str(10**60)
        self.assertEqual(calculated(session['records'])['total_repayment']['value'], str((income - living - 1) * 36))

    def test_percentage_uses_explicit_display_rounding(self):
        session = complete_session()
        override = {'approved_monthly_income': '1.005', 'recognized_living_cost': '0',
                    'monthly_trustee_fee': '0', 'repayment_months': '1', 'creditor_principal': '100'}
        for row in session['records']:
            if row['key'] in override: row['value'] = override[row['key']]
        rate = calculated(session['records'])['repayment_rate']
        self.assertEqual(rate['value'], '1.01')
        self.assertIn('ROUND_HALF_UP', rate['formula'])

    def test_zero_principal_does_not_divide_by_zero(self):
        session = complete_session()
        next(row for row in session['records'] if row['key'] == 'creditor_principal')['value'] = '0'
        self.assertEqual(calculated(session['records'])['repayment_rate']['status'], 'pending')

    def test_large_supported_ratio_is_finite_and_still_blocks_excess_payment(self):
        session = complete_session()
        override = {'approved_monthly_income': '9' * 63, 'recognized_living_cost': '0',
                    'monthly_trustee_fee': '0', 'repayment_months': '9' * 63,
                    'creditor_principal': '0.' + '0' * 60 + '1'}
        for row in session['records']:
            if row['key'] in override: row['value'] = override[row['key']]
        result = engine.validate(session)
        self.assertIn('REPAYMENT_REVIEW', [issue['code'] for issue in result['issues']])

    def test_numeric_parser_rejects_ambiguous_or_unbounded_values(self):
        for value in ['NaN', 'Infinity', '1e1000000', '1,2', True, 1.1, '1' * 65]:
            with self.subTest(value=value):
                self.assertIsNone(engine.number(value))
        self.assertEqual(engine.number('1,234원'), Decimal('1234'))
        self.assertEqual(engine.number('0'), Decimal('0'))

    def test_multiple_confirmed_required_scalar_values_are_not_arbitrarily_chosen(self):
        session = complete_session()
        session['records'].append(record('approved_monthly_income', '3000000', period='2025'))
        self.assertIn('REQUIRED_AMBIGUOUS', [issue['code'] for issue in engine.validate(session)['issues']])
        self.assertEqual(calculated(session['records'])['monthly_payment']['status'], 'pending')


if __name__ == '__main__':
    unittest.main()
