from pathlib import Path
import hashlib
import json
import tempfile
import unittest

import pymupdf

from app.sample import evidence_bundle, validate_manifest


class SampleSplitTests(unittest.TestCase):
    def test_moved_sample_resolves_and_only_evidence_enters_generator(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / '.runtime/evaluation').mkdir(parents=True)
            with pymupdf.open() as source:
                for text in ('evidence_alpha', 'heldout_secret_answer', 'evidence_beta', 'admin_not_input'):
                    source.new_page().insert_text((50, 50), text)
                data = source.tobytes()
            (root / '.runtime/evaluation/source.pdf').write_bytes(data)
            manifest = {'source_sha256': hashlib.sha256(data).hexdigest(), 'total_pages': 4,
                        'evidence_pages': [1, 3], 'holdout_pages': [2], 'administrative_excluded_pages': [4]}
            (root / '.runtime/evaluation/sample_manifest.json').write_text(json.dumps(manifest))
            content, actual, filename = evidence_bundle(root)
            self.assertEqual(filename, 'source.pdf')
            self.assertEqual(actual['evidence_pages'], [1, 3])
            with pymupdf.open(stream=content, filetype='pdf') as result:
                self.assertEqual(len(result), 2)
                text = '\n'.join(p.get_text() for p in result)
            self.assertIn('evidence_alpha', text)
            self.assertIn('evidence_beta', text)
            self.assertNotIn('heldout_secret_answer', text)
            self.assertNotIn('admin_not_input', text)

    def test_overlapping_reference_cannot_be_used_as_evidence(self):
        with self.assertRaises(ValueError):
            validate_manifest({'total_pages': 3, 'evidence_pages': [1, 2], 'holdout_pages': [2], 'administrative_excluded_pages': [3]})


if __name__ == '__main__':
    unittest.main()
