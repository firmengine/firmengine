"""Synthetic-only tests for targeted extraction, queue limits and private journals."""
import asyncio
from dataclasses import replace
import json
from pathlib import Path
import shutil
import tempfile
import threading
import time
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app import ai, promptbook


class AIRuntimeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'promptbook'
        for name in ('classify', 'extract'):
            shutil.copytree(promptbook.PROMPTBOOK_ROOT / name, self.root / name)
        change = patch.object(promptbook, 'PROMPTBOOK_ROOT', self.root)
        change.start()
        self.addCleanup(change.stop)
        self.runtime = Path(self.temp.name) / 'runtime'
        (self.runtime / 'sessions').mkdir(parents=True)
        change = patch.object(ai.config, 'RUNTIME', self.runtime)
        change.start()
        self.addCleanup(change.stop)

    def settings(self, agent='extract', **values):
        path = self.root / agent / 'config.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data.update(values)
        path.write_text(json.dumps(data), encoding='utf-8')
        return promptbook.runtime_config(agent)

    def document(self, kind='debt_certificate', pages=(42,)):
        return {'id': 'synthetic', '_path': 'never-opened.pdf', 'evidence_pages': list(pages),
                'page_roles': [{'document_id': 'synthetic', 'page': page, 'document_type': kind}
                               for page in pages], '_page_map': {page: i + 1 for i, page in enumerate(pages)}}

    def output(self, data, keys=(), transcript='Principal 100 KRW. Interest 5 KRW.'):
        page = data['pages'][0]
        facts = []
        for key in keys:
            interest = key.endswith('interest')
            facts.append({'key': key, 'entity': 'Synthetic Lender / loan 1',
                          'value': '5' if interest else '100', 'unit': 'KRW', 'period': '2026-01-01',
                          **page, 'quote': 'Interest 5 KRW.' if interest else 'Principal 100 KRW.',
                          'confidence': 'high'})
        return ai.Extraction(facts=facts, warnings=[], pages=[
            {**row, 'title': 'Synthetic evidence', 'kind': data['document_type'], 'transcript': transcript}
            for row in data['pages']])

    async def test_only_missing_features_are_retried_once(self):
        calls = []

        async def fake(instructions, content, model, metrics):
            data = json.loads(content.promptbook.input_json)
            calls.append(data)
            return self.output(data, ['debts[].principal'] if len(calls) == 1 else ['debts[].interest'])

        with patch.object(ai, 'content_for_pages', return_value=[]), patch.object(ai, 'ask_json', fake):
            result = await ai.extract_document(self.document(), {},
                required_features=['debts[].principal', 'debts[].interest'])
        self.assertEqual(len(calls), 2)
        self.assertEqual(set(calls[0]['allowed_key_labels']), {'debts[].principal', 'debts[].interest'})
        self.assertEqual(set(calls[1]['allowed_key_labels']), {'debts[].interest'})
        self.assertEqual(calls[1]['extraction_pass'], 'missing_features')
        self.assertEqual(result.missing_features, [])
        self.assertEqual(len(result), 2)
        self.assertEqual(result.pages[0]['page'], 42)

    async def test_source_mismatch_remains_missing_never_becomes_zero(self):
        calls = []

        async def fake(instructions, content, model, metrics):
            data = json.loads(content.promptbook.input_json)
            calls.append(data)
            output = self.output(data, ['debts[].principal'])
            output.facts[0].quote = 'Made up quote absent from page'
            return output

        metrics = {}
        with patch.object(ai, 'content_for_pages', return_value=[]), patch.object(ai, 'ask_json', fake):
            result = await ai.extract_document(self.document(), metrics, required_features=['debts[].principal'])
        self.assertEqual(len(calls), 2)
        self.assertEqual(result, [])
        self.assertEqual(result.missing_features, ['debts[].principal'])
        self.assertEqual(metrics['rejected_source_facts'], 2)

    async def test_retry_cannot_replace_preserved_transcript_to_invent_support(self):
        calls = 0

        async def fake(instructions, content, model, metrics):
            nonlocal calls
            calls += 1
            data = json.loads(content.promptbook.input_json)
            return self.output(data, [] if calls == 1 else ['debts[].principal'],
                               transcript='Unreadable synthetic page' if calls == 1 else 'Principal 100 KRW.')

        with patch.object(ai, 'content_for_pages', return_value=[]), patch.object(ai, 'ask_json', fake):
            result = await ai.extract_document(self.document(), {}, required_features=['debts[].principal'])
        self.assertEqual(result, [])
        self.assertEqual(result.pages[0]['transcript'], 'Unreadable synthetic page')

    async def test_mixed_document_routes_numeric_features_by_original_page(self):
        self.settings(missing_feature_retries=0)
        doc = self.document('resident_registration', (6, 42))
        doc['page_roles'][1]['document_type'] = 'debt_certificate'
        calls = []

        async def fake(instructions, content, model, metrics):
            data = json.loads(content.promptbook.input_json)
            calls.append(data)
            return self.output(data)

        with patch.object(ai, 'content_for_pages', return_value=[]), patch.object(ai, 'ask_json', fake):
            result = await ai.extract_document(doc, {})
        self.assertEqual([c['pages'][0]['page'] for c in calls], [6, 42])
        self.assertNotIn('debts[].principal', calls[0]['allowed_key_labels'])
        self.assertIn('debts[].principal', calls[1]['allowed_key_labels'])
        self.assertNotIn('plan.term_months', calls[1]['allowed_key_labels'])
        self.assertTrue(all(len(c['allowed_key_labels']) <= 48 for c in calls))
        self.assertEqual([p['page'] for p in result.pages], [6, 42])

    async def test_unknown_fallback_retains_numeric_scope_and_warns(self):
        self.settings(missing_feature_retries=0)
        calls = []

        async def fake(instructions, content, model, metrics):
            data = json.loads(content.promptbook.input_json)
            calls.append(data)
            return self.output(data)

        with patch.object(ai, 'content_for_pages', return_value=[]), patch.object(ai, 'ask_json', fake):
            result = await ai.extract_document(self.document('unknown'), {})
        self.assertIn('assets[].gross_value', calls[0]['allowed_key_labels'])
        self.assertIn('debts[].principal', calls[0]['allowed_key_labels'])
        self.assertLess(len(calls[0]['allowed_key_labels']), 30)
        self.assertIn('document_mapping_gap', result.warnings[0])

    def test_document_details_use_existing_form_keys(self):
        labels, types, mapping = ai.extraction_catalog()
        business = ai._type_features('business_registration', labels, mapping)
        assets = ai._type_features('insurance_surrender_certificate', labels, mapping)
        debt = ai._type_features('debt_certificate', labels, mapping)
        self.assertIn('business_registration', business)
        self.assertIn('opening_date', business)
        self.assertIn('asset_account_number', assets)
        self.assertIn('asset_description', assets)
        self.assertIn('creditor_collateral', debt)
        self.assertTrue(all(not ai.forbidden_feature(key) for key in business + assets + debt))

    async def test_rag_is_bounded_to_three_short_contexts(self):
        self.settings(missing_feature_retries=0, rag_chars_per_hit=100)
        calls = []

        async def fake(instructions, content, model, metrics):
            data = json.loads(content.promptbook.input_json)
            calls.append(data)
            return self.output(data)

        with patch.object(ai, 'content_for_pages', return_value=[]), patch.object(ai, 'ask_json', fake):
            await ai.extract_document(self.document(), {}, required_features=['debts[].principal'],
                rag_context=[{'text': 'x' * 500, 'secret': 'not-forwarded'} for _ in range(7)])
        context = calls[0]['reference_context']
        self.assertEqual(len(context), 3)
        self.assertTrue(all(len(row['text']) == 100 and 'secret' not in row for row in context))

    async def test_input_budget_shrinks_classify_batch_and_checks_coverage(self):
        self.settings('classify', batch_pages=4, image_token_estimate=9000, max_input_tokens=18000)
        calls = []

        async def fake(instructions, content, model, metrics):
            data = json.loads(content.promptbook.input_json)
            calls.append(data)
            return ai.Classification(pages=[{**row, 'role': 'evidence', 'title': 'Synthetic',
                'document_type': 'debt_certificate'} for row in data['pages']])

        doc = self.document(pages=(6, 42))
        with patch.object(ai, 'content_for_pages', return_value=[]), patch.object(ai, 'ask_json', fake):
            result = await ai.classify([(doc, 6), (doc, 42)], {})
        self.assertEqual(len(calls), 2)
        self.assertEqual([row.page for row in result.pages], [6, 42])
        with patch.object(ai, 'content_for_pages', return_value=[]), \
                patch.object(ai, 'ask_json', AsyncMock(return_value=ai.Classification(pages=[]))):
            with self.assertRaises(RuntimeError):
                await ai.classify([(doc, 6)], {})

    async def test_global_and_agent_caps_include_sync_callers(self):
        limits = self.settings(global_concurrency=2, agent_concurrency=1)
        lock = threading.Lock()
        current = {'all': 0, 'a': 0, 'b': 0}
        maximum = dict(current)

        def change(agent, amount):
            with lock:
                current['all'] += amount
                current[agent] += amount
                for key in current:
                    maximum[key] = max(maximum[key], current[key])

        async def async_work(agent):
            async with ai.provider_slot(agent, limits):
                change(agent, 1)
                await asyncio.sleep(0.05)
                change(agent, -1)

        def sync_work():
            with ai.provider_slot_sync('b', limits):
                change('b', 1)
                time.sleep(0.05)
                change('b', -1)

        await asyncio.gather(async_work('a'), async_work('a'), async_work('b'), asyncio.to_thread(sync_work))
        self.assertEqual(maximum, {'all': 2, 'a': 1, 'b': 1})
        self.assertEqual(ai.CALL_SEMAPHORE.tickets, {})

    async def test_cancelling_waiter_releases_ticket_without_leaking_capacity(self):
        limits = self.settings(global_concurrency=1, agent_concurrency=1)

        async def wait():
            async with ai.provider_slot('extract', limits):
                self.fail('Waiting task must not acquire the occupied slot.')

        async with ai.provider_slot('extract', limits):
            task = asyncio.create_task(wait())
            await asyncio.sleep(0.03)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.assertEqual(len(ai.CALL_SEMAPHORE.tickets), 1)
        self.assertEqual(ai.CALL_SEMAPHORE.tickets, {})

    async def test_oversize_input_fails_before_http(self):
        bundle = promptbook.load_prompt('classify', {'pages': [{'document_id': 'synthetic', 'page': 1}]}, ai.Classification)
        bundle = replace(bundle, runtime=bundle.runtime.model_copy(update={'max_input_tokens': 512}))
        content = promptbook.PromptContent(bundle, [{'type': 'input_text', 'text': 'x' * 5000}])
        with patch.object(ai.httpx, 'AsyncClient') as client:
            with self.assertRaises(RuntimeError):
                await ai.ask_json(bundle.instructions, content, ai.Classification, {})
        client.assert_not_called()

    def test_persisted_storage_uses_only_matching_existing_journal_root(self):
        sid = 'a' * 32
        journal = self.runtime / 'sessions' / sid
        journal.mkdir()
        source = self.runtime / 'storage' / 'cases' / sid / 'incoming' / 'v1' / 'original.pdf'
        source.parent.mkdir(parents=True)
        source.write_bytes(b'synthetic-only')
        doc = {'id': 'synthetic', '_path': str(source), '_case_id': sid, '_journal_root': str(journal)}
        context = promptbook.trace_context([(doc, 42)])
        self.assertEqual(context.session_directory, journal.resolve())
        self.assertIsNone(promptbook.trace_context([({**doc, '_case_id': 'b' * 32}, 42)]))
        self.assertIsNone(promptbook.trace_context([({**doc, '_journal_root': str(source.parent)}, 42)]))
        journal.rmdir()
        self.assertIsNone(promptbook.trace_context([(doc, 42)]))
        self.assertFalse(journal.exists())

    async def test_transient_http_retry_is_bounded_and_timeout_is_configured(self):
        self.settings('classify', http_retries=1, retry_backoff_seconds=0, request_timeout_seconds=12, connect_timeout_seconds=5)
        bundle = promptbook.load_prompt('classify', {'pages': [{'document_id': 'synthetic', 'page': 1}]}, ai.Classification)
        calls, timeouts = [], []

        class Client:
            def __init__(self, **kwargs):
                timeouts.append(kwargs['timeout'])
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def post(self, *args, **kwargs):
                calls.append(kwargs)
                return httpx.Response(429, json={'error': 'synthetic-private-provider-data'})

        with patch.object(ai.config, 'API_KEY', 'synthetic-key'), patch.object(ai.httpx, 'AsyncClient', Client):
            with self.assertRaisesRegex(RuntimeError, 'HTTP 429'):
                await ai.ask_json(bundle.instructions, promptbook.PromptContent(bundle, []), ai.Classification, {})
        self.assertEqual(len(calls), 2)
        self.assertEqual(timeouts[0].read, 12)
        self.assertEqual(timeouts[0].connect, 5)
        self.assertEqual(ai.CALL_SEMAPHORE.tickets, {})


if __name__ == '__main__':
    unittest.main()
