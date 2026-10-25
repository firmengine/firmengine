import asyncio
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import fitz
import httpx
from fastapi.testclient import TestClient

from app import main, config


def fixture_pdf():
    doc = fitz.open()
    doc.new_page().insert_text((50, 50), 'Synthetic evidence only')
    doc.new_page().insert_text((50, 50), 'Held-out answer - do not use')
    data = doc.tobytes()
    doc.close()
    return data


class APITests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patched = patch.object(config, 'RUNTIME', Path(self.tmp.name))
        self.patched.start()
        self.client = TestClient(main.app)
        self.client.__enter__()
        response = self.client.post('/api/sessions', files={'files': ('fixture.pdf', fixture_pdf(), 'application/pdf')}, data={'evidence_pages': '1'})
        self.assertEqual(response.status_code, 200)
        self.sid = response.json()['id']
        self.s = main.SESSIONS[self.sid]

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.patched.stop()
        self.tmp.cleanup()

    def test_holdout_preview_and_public_token_boundary(self):
        did = self.s['documents'][0]['id']
        self.s['_token'] = 'private-run-token'
        response = self.client.get(f'/api/sessions/{self.sid}')
        self.assertNotIn('private-run-token', response.text)
        self.assertNotIn('_path', response.text)
        self.assertEqual(self.client.get(f'/api/sessions/{self.sid}/pages/{did}/1').status_code, 200)
        self.assertEqual(self.client.get(f'/api/sessions/{self.sid}/pages/{did}/2').status_code, 404)

    def test_cross_origin_and_expiry(self):
        path = main.session_dir(self.sid)
        denied = self.client.post(f'/api/sessions/{self.sid}/heartbeat', headers={'Origin': 'https://untrusted.example'})
        self.assertEqual(denied.status_code, 403)
        before = self.s['_last_activity']
        self.client.get(f'/api/sessions/{self.sid}')
        self.assertEqual(before, self.s['_last_activity'])
        self.s['_last_activity'] = time.monotonic() - config.TTL - 1
        self.assertEqual(self.client.get(f'/api/sessions/{self.sid}').status_code, 410)
        self.assertFalse(path.exists())

    def test_no_silent_bypass_when_n8n_unavailable(self):
        with patch.object(config, 'API_KEY', 'synthetic-not-a-key'), patch('app.main.httpx.AsyncClient', side_effect=httpx.ConnectError('offline')):
            response = self.client.post(f'/api/sessions/{self.sid}/run')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.s['status'], 'failed')
        self.assertEqual(self.s['records'], [])

    def seed_record(self):
        self.s['records'] = [{'id': 'record1', 'key': 'client_name', 'label': 'Synthetic name', 'entity': '',
                              'value': 'Synthetic Person', 'unit': '', 'period': '', 'confidence': 'high',
                              'state': 'unreviewed', 'sources': [], 'candidates': []}]
        self.s['status'] = 'ready'

    def test_edit_invalidates_files_and_reviews(self):
        self.seed_record()
        self.s['reviews'] = {'caseworker': {'name': 'Test reviewer', 'revision': 1}, 'lawyer': {'name': 'Test lawyer', 'revision': 1}}
        folder = main.session_dir(self.sid) / 'artifacts'
        folder.mkdir()
        (folder / 'old.docx').write_bytes(b'outdated')
        self.s['artifacts'] = [{'name': 'old.docx'}]
        response = self.client.patch(f'/api/sessions/{self.sid}/records/record1', json={'value': 'Synthetic Changed', 'confirmed': True, 'reason': 'synthetic evidence checked'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['revision'], 2)
        self.assertEqual(data['artifacts'], [])
        self.assertIsNone(data['reviews']['lawyer'])
        self.assertFalse(folder.exists())
        self.assertEqual(self.client.get(f'/api/sessions/{self.sid}/artifacts/old.docx').status_code, 404)

    def test_review_requires_actual_generation_and_resolved_fields(self):
        self.seed_record()
        response = self.client.post(f'/api/sessions/{self.sid}/review', json={'role': 'caseworker', 'name': 'Reviewer', 'template_approved': True})
        self.assertEqual(response.status_code, 409)
        self.s['artifacts'] = [{'name': 'draft.docx'}]
        response = self.client.post(f'/api/sessions/{self.sid}/review', json={'role': 'lawyer', 'name': 'Reviewer', 'template_approved': True})
        self.assertEqual(response.status_code, 409)
        self.assertIsNone(self.s['reviews']['lawyer'])
        self.assertEqual(self.client.post(f'/api/sessions/{self.sid}/review', json={'role': 'caseworker', 'name': '  '}).status_code, 422)

    def test_mutations_block_while_renderer_holds_lock(self):
        self.seed_record()
        asyncio.run(self.s['_lock'].acquire())
        try:
            self.assertEqual(self.client.patch(f'/api/sessions/{self.sid}/records/record1', json={'value': 'Race', 'confirmed': True, 'reason': 'racing change'}).status_code, 409)
            self.assertEqual(self.client.post(f'/api/sessions/{self.sid}/generate').status_code, 409)
            self.assertEqual(self.s['revision'], 1)
        finally:
            self.s['_lock'].release()

    def test_stage_requires_token_and_predecessors(self):
        self.s['_token'] = 'valid-synthetic-token'
        wrong = self.client.post('/internal/stages/generate', json={'session_id': self.sid, 'run_token': 'wrong'})
        self.assertEqual(wrong.status_code, 403)
        premature = self.client.post('/internal/stages/generate', json={'session_id': self.sid, 'run_token': 'valid-synthetic-token'})
        self.assertEqual(premature.status_code, 409)


if __name__ == '__main__':
    unittest.main()
