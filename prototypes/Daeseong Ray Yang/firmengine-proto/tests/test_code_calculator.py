"""Execute the actual n8n Code source in Node with synthetic JSON inputs."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


def calculate(snapshot):
    process = subprocess.run([shutil.which('node'), '-e',
        "const c=require('./workflows/calculators.js');process.stdout.write(JSON.stringify(c.calculateCase(JSON.parse(process.argv[1]))));",
        json.dumps(snapshot)], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(process.stdout)


def assertion(key, value, object_id=None, **extra):
    return {'id': key + '-' + str(object_id), 'feature_key': key, 'value': value,
            'object_id': object_id, 'state': 'VERIFIED', 'currency': 'KRW', 'unit': 'won', **extra}


def run_rule(rule, assertions, **extra):
    data = {'revision': 1, 'application_date': '2026-10-26', 'assertions': assertions, **extra}
    return next(row for row in calculate(data)['results'] if row['rule_id'] == rule)


class CodeCalculatorTests(unittest.TestCase):
    def test_unknown_inputs_stay_unknown_in_actual_code_module(self):
        result = calculate({'id': 'synthetic', 'revision': 2, 'assertions': []})
        self.assertEqual(result['computed_by'], 'n8n-code')
        self.assertEqual(len(result['results']), 7)
        self.assertTrue(all(row['outcome'] == 'UNKNOWN' for row in result['results']))
        self.assertTrue(all(not row['values'] for row in result['results']))

    def test_debt_limit_keeps_exact_decimal_and_requires_balance_date(self):
        rows = [assertion('coverage.debt_inventory', 'COMPLETE'),
                assertion('debts[].principal', '1000000000', 'loan1', valid_at='2026-10-26'),
                assertion('debts[].interest', '0.01', 'loan1', valid_at='2026-10-26'),
                assertion('debts[].security_status', 'UNSECURED', 'loan1'),
                assertion('debts[].amount_as_of', '2026-10-26', 'loan1')]
        result = run_rule('KR.579.DEBT_LIMITS', rows)
        self.assertEqual(result['outcome'], 'FAIL')
        self.assertEqual(result['values']['other'], '1000000000.01')
        self.assertEqual(run_rule('KR.579.DEBT_LIMITS', rows[:-1])['outcome'], 'UNKNOWN')

    def test_big_integer_amounts_do_not_round_to_javascript_safe_integer(self):
        rows = [assertion('coverage.debt_inventory', 'COMPLETE'),
                assertion('debts[].principal', '9007199254740993', 'loan1', valid_at='2026-10-26'),
                assertion('debts[].interest', '0', 'loan1', valid_at='2026-10-26'),
                assertion('debts[].security_status', 'UNSECURED', 'loan1'),
                assertion('debts[].amount_as_of', '2026-10-26', 'loan1')]
        self.assertEqual(run_rule('KR.579.DEBT_LIMITS', rows)['values']['other'], '9007199254740993')

    def test_median_is_exact_and_unsupported_year_unknown(self):
        rows = [assertion('household.recognized_count', '1')]
        self.assertEqual(run_rule('SEOUL.405.BASIC_LIVING_2026', rows)['values']['basic_living_expense'], '1538542.8')
        self.assertEqual(run_rule('SEOUL.405.BASIC_LIVING_2026', rows, application_date='2027-01-01')['outcome'], 'UNKNOWN')

    def test_nominal_total_is_never_substituted_for_present_value(self):
        rows = [assertion('income.recognized_monthly_net', '3000000'), assertion('living.recognized_total', '1500000'),
                assertion('plan.monthly_trustee_fee', '0'), assertion('plan.term_months', '24')]
        result = run_rule('PLAN.NOMINAL_PAYMENTS', rows)
        self.assertEqual(result['values']['total_nominal_repayment'], '36000000')
        self.assertNotIn('total_present_value', result['values'])
        self.assertEqual(run_rule('KR.614.LIQUIDATION_COMPARISON', rows)['outcome'], 'UNKNOWN')
        self.assertEqual(run_rule('PLAN.NOMINAL_PAYMENTS', rows[:-1])['outcome'], 'UNKNOWN')
        self.assertEqual(run_rule('PLAN.NOMINAL_PAYMENTS', rows[:2] + rows[3:])['outcome'], 'UNKNOWN')

    def test_pv_requires_same_normalization_date_and_basis(self):
        rows = [assertion('plan.total_present_value', '100', normalized=True, valuation_date='2026-10-26', basis_id='A'),
                assertion('plan.liquidation_floor', '90', normalized=True, valuation_date='2026-10-26', basis_id='B')]
        self.assertEqual(run_rule('KR.614.LIQUIDATION_COMPARISON', rows)['outcome'], 'UNKNOWN')
        rows[1]['basis_id'] = 'A'
        self.assertEqual(run_rule('KR.614.LIQUIDATION_COMPARISON', rows)['values']['margin_pv'], '10')

    def test_no_objection_is_not_applicable_not_zero_repayment(self):
        result = run_rule('KR.614.MINIMUM_REPAYMENT', [assertion('court.objection_status', False)])
        self.assertEqual(result['outcome'], 'NOT_APPLICABLE')
        self.assertEqual(result['values'], {})

    def test_multiple_sources_sum_only_verified_matching_months_and_exclude_loans(self):
        rows = [assertion('coverage.income_sources', 'COMPLETE')]
        for oid, kind, amount in [('s1', 'wage', '2000000'), ('s2', 'rent', '500000'), ('s3', 'loan', '10000000')]:
            rows += [assertion('income_source.kind', kind, oid),
                     assertion('income_source.net', amount, oid, measurement_period='MONTHLY', source_period='2026-09')]
        self.assertEqual(run_rule('INCOME.MONTHLY_NET', rows)['values']['monthly_net'], '2500000')
        rows[4]['source_period'] = '2026-08'
        self.assertEqual(run_rule('INCOME.MONTHLY_NET', rows)['outcome'], 'UNKNOWN')

    def test_annual_or_unreviewed_income_is_not_treated_as_confirmed_monthly(self):
        rows = [assertion('income.monthly_net', '12000000', measurement_period='ANNUAL')]
        self.assertEqual(run_rule('INCOME.MONTHLY_NET', rows)['outcome'], 'UNKNOWN')
        rows[0].update(measurement_period='MONTHLY', state='EXTRACTED')
        self.assertEqual(run_rule('INCOME.MONTHLY_NET', rows)['outcome'], 'UNKNOWN')

    def test_unknown_rule_release_cannot_run_as_known_legal_rules(self):
        rows = [assertion('household.recognized_count', '1')]
        self.assertEqual(run_rule('SEOUL.405.BASIC_LIVING_2026', rows, rule_release_id='unknown-release')['outcome'], 'UNKNOWN')

    def test_reviewed_no_additional_housing_request_is_not_applicable_not_zero(self):
        result=run_rule('SEOUL.405.ADDITIONAL_HOUSING',[assertion('living.additional_housing_requested',False)])
        self.assertEqual(result['outcome'],'NOT_APPLICABLE')
        self.assertEqual(result['values'],{})

    def test_same_value_from_different_currencies_does_not_silently_choose_first(self):
        rows=[assertion('income.monthly_net','1000',measurement_period='MONTHLY',source_period='2026-09'),
              assertion('income.monthly_net','1000',measurement_period='MONTHLY',source_period='2026-09',currency='USD')]
        rows[1]['id']='different-currency'
        self.assertEqual(run_rule('INCOME.MONTHLY_NET',rows)['outcome'],'UNKNOWN')

    def test_bound_official_parameter_version_changes_only_debt_cap_comparison(self):
        rows=[assertion('coverage.debt_inventory','COMPLETE'),
              assertion('debts[].principal','1500','loan',valid_at='2026-10-26'),
              assertion('debts[].interest','0','loan',valid_at='2026-10-26'),
              assertion('debts[].security_status','UNSECURED','loan'),assertion('debts[].amount_as_of','2026-10-26','loan')]
        parameter={'rule_id':'KR.579.DEBT_LIMITS','version_id':'synthetic-law-v2','source_id':'K01',
            'content_hash':'a'*64,'effective_from':'2026-10-01','validator_version':'debt-limits-v1',
            'params':{'secured_cap':'2000','unsecured_cap':'1000'},
            'validation':{'boundary_cases_passed':5,'semantic_template':'unchanged_or_reviewed_initial_caps'}}
        release={'id':'seoul-blueprint-arithmetic-v1','status':'REVIEW_REQUIRED','parameters':{'KR.579.DEBT_LIMITS':parameter}}
        result=run_rule('KR.579.DEBT_LIMITS',rows,rule_release=release)
        self.assertEqual(result['outcome'],'FAIL')
        self.assertEqual(result['values']['other_limit'],'1000')
        self.assertEqual(result['parameter_version_id'],'synthetic-law-v2')
        parameter['effective_from']='2027-01-01'
        self.assertEqual(run_rule('KR.579.DEBT_LIMITS',rows,rule_release=release)['outcome'],'UNKNOWN')
        parameter['effective_from']='2026-10-01'
        parameter['params']['unsecured_cap']=None
        self.assertEqual(run_rule('KR.579.DEBT_LIMITS',rows,rule_release=release)['outcome'],'UNKNOWN')


if __name__ == '__main__':
    unittest.main()
