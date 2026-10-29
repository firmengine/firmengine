"""Synthetic SQLite regression for the receipt projection used by D1 export."""
import json
from pathlib import Path
import re
import sqlite3
import unittest

ROUTE = Path(__file__).resolve().parents[1] / "app/api/cases/[id]/export/route.ts"


class ReceiptProjectionTests(unittest.TestCase):
    def test_sql_projection_matches_previous_shape_check(self):
        source = ROUTE.read_text(encoding="utf-8")
        match = re.search(r"CASE WHEN json_valid\(result\) THEN CASE WHEN .*? END ELSE 0 END AS has_stored_read", source)
        self.assertIsNotNone(match)
        query = "SELECT " + match.group(0) + " FROM (SELECT ? AS result)"
        cases = [
            (None, False), ("not-json", False), ("null", False), ("[]", False),
            (json.dumps({"read": {"records": [], "documentType": "invoice"}}), True),
            (json.dumps({"read": {"records": {}, "documentType": "invoice"}}), False),
            (json.dumps({"read": {"records": [], "documentType": 2}}), False),
            (json.dumps({"read": {"records": []}}), False),
        ]
        connection = sqlite3.connect(":memory:")
        for result, expected in cases:
            with self.subTest(expected=expected, bytes=len(result or "")):
                projected = bool(connection.execute(query, (result,)).fetchone()[0])
                previous = False
                try:
                    saved = json.loads(result) if result else None
                    previous = bool(saved and isinstance(saved.get("read", {}).get("records"), list) and isinstance(saved.get("read", {}).get("documentType"), str))
                except (ValueError, AttributeError, TypeError):
                    pass
                self.assertEqual(projected, expected)
                self.assertEqual(projected, previous)


if __name__ == "__main__":
    unittest.main()
