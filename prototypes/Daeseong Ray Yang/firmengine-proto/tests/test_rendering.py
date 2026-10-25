"""Synthetic artifact tests: no sample.pdf or submitted reference answers used."""
from copy import deepcopy
from pathlib import Path
import sys
import tempfile
import unittest

from docx import Document
from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.rendering import render_bundle, review_status


def record(identifier, key, value, *, entity="", period="", state="unreviewed"):
    return {"id": identifier, "key": key, "entity": entity, "label": key,
            "value": value, "unit": "KRW", "period": period, "confidence": 0.9,
            "state": state, "sources": [{"document_id": "synthetic-source", "page": 4,
                                           "quote": "합성 원문 근거"}]}


def text_of(document):
    texts = [paragraph.text for paragraph in document.paragraphs]
    texts.extend(cell.text for table in document.tables for row in table.rows for cell in row.cells)
    texts.extend(paragraph.text for section in document.sections for paragraph in section.header.paragraphs)
    return "\n".join(texts)


class RenderingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        cls.session = {"id": "synthetic-render-test", "revision": 3, "template_approved": False,
            "reviews": {}, "records": [
                record("r-name", "client_name", "합성사용자"),
                record("r-2024", "annual_revenue", "12345678901234567890", period="2024", state="confirmed"),
                record("r-2025", "annual_revenue", "40000000", period="2025", state="confirmed"),
                record("r-c1", "creditor_principal", "1000000", entity="합성은행", period="2026-10"),
                record("r-c2", "creditor_interest", None, entity="합성은행", period="2026-10", state="missing"),
                record("r-c3", "creditor_principal", "2000000", entity="합성은행", period="2026-09"),
                record("r-injection", "creditor_address", '=HYPERLINK("https://invalid.test","x")',
                       entity="합성은행", period="2026-10"),
                record("r-address", "address", "충돌주소", state="conflict"),
                record("r-token", "asset_description", "증빙 문자 {{client_name}} 보존", entity="합성재산"),
            ], "calculations": [
                {"key": "monthly_payment", "label": "월 변제액", "value": None,
                 "unit": "KRW", "formula": "income - living - fee", "status": "pending", "sources": []},
                {"key": "debt_principal_total", "label": "검토된 원금 합계", "value": "1000000",
                 "unit": "KRW", "formula": "confirmed principal", "status": "calculated", "sources": ["r-c1"]},
            ]}
        cls.artifacts = render_bundle(cls.session, Path(cls.folder.name))

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def artifact(self, kind):
        return Path(self.folder.name) / next(item["name"] for item in self.artifacts if item["kind"] == kind)

    def test_six_editable_documents_and_workbook_with_actual_form_sections(self):
        self.assertEqual(len(self.artifacts), 7)
        self.assertEqual(sum(item["format"] == "docx" for item in self.artifacts), 6)
        for item in self.artifacts:
            self.assertTrue((Path(self.folder.name) / item["name"]).is_file())
        plan = text_of(Document(self.artifact("repayment_plan")))
        self.assertIn("7. 미확정 개인회생채권", plan)
        self.assertIn("개인회생채권 변제예정액표", plan)
        self.assertIn("편집형", plan)
        self.assertIn("미검토 초안", plan)

    def test_missing_and_conflicting_fields_do_not_become_zero_or_default_months(self):
        application = Document(self.artifact("application"))
        rows = {row.cells[0].text: row.cells[1].text for table in application.tables
                for row in table.rows if len(row.cells) == 2}
        self.assertEqual(rows["현주소"], "[불일치·확인 필요]")
        self.assertEqual(rows["변제기간(개월)"], "[확인 필요]")
        self.assertEqual(rows["월 변제예정액"], "[계산 보류]")

    def test_different_periods_are_retained_not_summed(self):
        creditors = text_of(Document(self.artifact("creditors")))
        self.assertIn("2026-10", creditors)
        self.assertIn("2026-09", creditors)
        self.assertIn("1,000,000", creditors)
        self.assertIn("2,000,000", creditors)
        income = Document(self.artifact("income_expense"))
        rows = {row.cells[0].text: row.cells[1].text for table in income.tables
                for row in table.rows if len(row.cells) == 2}
        self.assertEqual(rows["연간 매출(증빙)"], "[기간 선택 필요]")

    def test_provenance_and_literal_evidence_tokens_are_preserved(self):
        assets = text_of(Document(self.artifact("assets")))
        self.assertIn("증빙 문자 {{client_name}} 보존", assets)
        self.assertIn("synthetic-source / 4쪽", assets)
        self.assertIn("SHA-256:", assets)
        self.assertIn("합성 원문 근거", assets)

    def test_workbook_does_not_execute_source_formulas_or_lose_integer_precision(self):
        workbook = load_workbook(self.artifact("workbook"), data_only=False)
        formula_like = [cell for sheet in workbook for row in sheet for cell in row
                        if isinstance(cell.value, str) and cell.value.startswith("=HYPERLINK")]
        self.assertTrue(formula_like)
        self.assertTrue(all(cell.data_type == "s" for cell in formula_like))
        self.assertFalse(any(cell.data_type == "f" for sheet in workbook for row in sheet for cell in row))
        self.assertTrue(any(cell.value == "12345678901234567890" for row in workbook["추출값"] for cell in row))
        workbook.close()

    def test_review_is_bound_to_current_revision_and_template_confirmation(self):
        session = deepcopy(self.session)
        session["reviews"] = {"caseworker": {"name": "직원", "at": "test", "revision": 3},
                              "lawyer": {"name": "변호사", "at": "test", "revision": 3}}
        self.assertIn("미검토", review_status(session))
        session["template_approved"] = True
        self.assertIn("검토 완료본", review_status(session))
        session["revision"] = 4
        self.assertIn("미검토", review_status(session))

    def test_excluded_values_are_not_filled_but_remain_in_evidence_workbook(self):
        session = deepcopy(self.session)
        session['records'] = [record('excluded-name', 'client_name', '제외성명', state='excluded'),
                              record('current-name', 'client_name', '적용성명', state='confirmed'),
                              record('excluded-creditor', 'creditor_principal', '9999999', entity='제외은행', state='excluded')]
        with tempfile.TemporaryDirectory() as directory:
            files = render_bundle(session, Path(directory))
            for artifact in files:
                if artifact['format'] == 'docx':
                    text = text_of(Document(Path(directory) / artifact['name']))
                    self.assertNotIn('제외성명', text)
                    self.assertNotIn('제외은행', text)
            workbook_path = Path(directory) / next(item['name'] for item in files if item['format'] == 'xlsx')
            workbook = load_workbook(workbook_path)
            values = [cell.value for row in workbook['추출값'] for cell in row]
            self.assertIn('제외성명', values)
            self.assertIn('검토 제외', values)
            workbook.close()


if __name__ == "__main__":
    unittest.main()
