"""Prompt edits change real request payloads without an API call or restart."""
from copy import deepcopy
import asyncio
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import ai, promptbook


class PromptbookTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'promptbook'
        # Copy runtime files/examples only. Never touch sample evidence or an active run's files.
        for name in ('classify', 'extract'):
            shutil.copytree(promptbook.PROMPTBOOK_ROOT / name, self.root / name)
        self.root_patch = patch.object(promptbook, 'PROMPTBOOK_ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.runtime = Path(self.temp.name) / 'runtime'
        (self.runtime / 'sessions').mkdir(parents=True)
        self.runtime_patch = patch.object(ai.config, 'RUNTIME', self.runtime)
        self.runtime_patch.start()
        self.addCleanup(self.runtime_patch.stop)

    def example(self, agent, kind='input'):
        return json.loads((self.root / agent / f'{kind}.example.json').read_text(encoding='utf-8'))

    def test_examples_match_documented_and_runtime_contracts(self):
        for agent, output_model in [('classify', ai.Classification), ('extract', ai.Extraction)]:
            bundle = promptbook.load_prompt(agent, self.example(agent), output_model)
            self.assertEqual(bundle.output_schema, output_model.model_json_schema())
            output_model.model_validate(self.example(agent, 'output'))

    def test_missing_placeholder_fails_with_file_and_name(self):
        (self.root / 'classify' / 'body.md').write_text('{{wrong_name}}', encoding='utf-8')
        with self.assertRaisesRegex(promptbook.PromptbookError, r'classify/body.md.*wrong_name'):
            promptbook.load_prompt('classify', self.example('classify'), ai.Classification)

    def test_required_input_cannot_be_accidentally_removed(self):
        (self.root / 'classify' / 'body.md').write_text('Classify these images.', encoding='utf-8')
        with self.assertRaisesRegex(promptbook.PromptbookError, r'body.md.*pages_json'):
            promptbook.load_prompt('classify', self.example('classify'), ai.Classification)

    def test_malformed_template_fails_before_request(self):
        (self.root / 'classify' / 'body.md').write_text('{{pages_json}', encoding='utf-8')
        with self.assertRaisesRegex(promptbook.PromptbookError, r'classify/body.md'):
            promptbook.load_prompt('classify', self.example('classify'), ai.Classification)

    def test_literal_json_and_inserted_braces_are_not_templates(self):
        data = {'pages': [{'document_id': '{{not_a_placeholder}}', 'page': 6}]}
        (self.root / 'classify' / 'body.md').write_text(
            'Example: {"pages": []}\n{{pages_json}}\n{{document_types_json}}', encoding='utf-8')
        bundle = promptbook.load_prompt('classify', data, ai.Classification)
        self.assertIn('{"pages": []}', bundle.body)
        self.assertIn('{{not_a_placeholder}}', bundle.body)

    def test_malformed_schema_reports_location(self):
        (self.root / 'classify' / 'input.schema.json').write_text('{broken', encoding='utf-8')
        with self.assertRaisesRegex(promptbook.PromptbookError, r'input.schema.json.*JSON'):
            promptbook.load_prompt('classify', self.example('classify'), ai.Classification)

    def test_output_schema_drift_is_rejected_before_request(self):
        path = self.root / 'extract' / 'output.schema.json'
        schema = json.loads(path.read_text(encoding='utf-8'))
        schema['additionalProperties'] = True
        path.write_text(json.dumps(schema), encoding='utf-8')
        with self.assertRaisesRegex(promptbook.PromptbookError, r'extract/output.schema.json.*Extraction'):
            promptbook.load_prompt('extract', self.example('extract'), ai.Extraction)

    def test_invalid_input_error_does_not_include_customer_value(self):
        private = 'synthetic-private-value-do-not-log'
        with self.assertRaises(promptbook.PromptbookError) as caught:
            promptbook.load_prompt('classify', {'pages': [{'document_id': private, 'page': private}]},
                                   ai.Classification)
        self.assertIn('pages.0.page', str(caught.exception))
        self.assertNotIn(private, str(caught.exception))

    def test_original_page_labels_use_physical_page_image(self):
        doc = {'id': 'synthetic-document', '_path': 'synthetic-split.pdf', '_page_map': {42: 2}}
        with patch.object(ai, 'page_image', return_value=b'synthetic-jpeg') as render:
            parts = ai.content_for_pages([(doc, 42)], 950)
        render.assert_called_once_with('synthetic-split.pdf', 2, 950)
        self.assertEqual(parts[0]['text'], 'DOCUMENT_ID=synthetic-document PAGE=42')

    async def test_edits_change_actual_api_payload_on_next_call(self):
        payloads = []
        response_data = self.example('classify', 'output')
        response_data['pages'] = [{**response_data['pages'][0], 'document_id': 'synthetic-private-marker', 'page': 6}]

        class FakeClient:
            def __init__(self, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def post(self, url, *, headers, json):
                payloads.append(deepcopy(json))
                return httpx.Response(200, json={
                    'status': 'completed',
                    'output': [{'content': [{'type': 'output_text',
                                             'text': __import__('json').dumps(response_data)}]}],
                    'usage': {'input_tokens': 10, 'output_tokens': 4},
                })

        metrics = {}
        items = [({'id': 'synthetic-private-marker', '_path': 'unused.pdf'}, 6)]
        images = [{'type': 'input_image', 'image_url': 'data:image/jpeg;base64,c3ludGhldGlj', 'detail': 'high'}]
        with patch.object(ai.config, 'API_KEY', 'synthetic-key-not-for-logs'), \
                patch.object(ai.httpx, 'AsyncClient', FakeClient), \
                patch.object(ai, 'content_for_pages', return_value=images) as render:
            await ai.classify(items, metrics)
            system = self.root / 'classify' / 'system.md'
            system.write_text('Edited system instructions.', encoding='utf-8')
            body = self.root / 'classify' / 'body.md'
            body.write_text('Edited body with literal JSON {"pages": []}: {{pages_json}}\n{{document_types_json}}', encoding='utf-8')
            settings_path = self.root / 'classify' / 'config.json'
            settings = json.loads(settings_path.read_text(encoding='utf-8'))
            settings.update(version='test-edited', model='synthetic-test-model',
                            reasoning_effort='medium', max_output_tokens=1024, image_long_edge=1200)
            settings_path.write_text(json.dumps(settings), encoding='utf-8')
            await ai.classify(items, metrics)
        self.assertEqual(len(payloads), 2)
        self.assertNotEqual(payloads[0]['instructions'], payloads[1]['instructions'])
        self.assertEqual(payloads[1]['instructions'], 'Edited system instructions.')
        self.assertIn('Edited body', payloads[1]['input'][0]['content'][0]['text'])
        self.assertEqual(payloads[1]['input'][0]['content'][1], images[0])
        self.assertEqual(payloads[1]['model'], 'synthetic-test-model')
        self.assertEqual(payloads[1]['max_output_tokens'], 1024)
        self.assertEqual(payloads[1]['reasoning']['effort'], 'medium')
        self.assertFalse(payloads[1]['store'])
        self.assertEqual(payloads[1]['text']['format']['schema'], ai.Classification.model_json_schema())
        self.assertEqual(render.call_args_list[1].args[1], 1200)
        self.assertEqual(metrics['api_calls'], 2)
        self.assertEqual(len(metrics['promptbook']), 2)
        self.assertNotEqual(metrics['promptbook'][0]['sha256'], metrics['promptbook'][1]['sha256'])
        self.assertEqual(metrics['promptbook'][1]['version'], 'test-edited')
        self.assertNotIn('synthetic-private-marker', json.dumps(metrics))
        self.assertNotIn('synthetic-key-not-for-logs', json.dumps(metrics))
        self.assertNotIn('Edited system instructions.', json.dumps(metrics))

    def session_items(self, sid='a' * 32, document_id='synthetic-private-id', page=42):
        directory = self.runtime / 'sessions' / sid
        directory.mkdir(exist_ok=True)
        source = directory / 'synthetic.pdf'
        source.write_bytes(b'synthetic-placeholder-never-rendered')
        return [({'id': document_id, 'name': '합성자료.pdf', '_path': str(source), '_page_map': {42: 1}}, page)]

    def prepared_call(self, items, agent='classify'):
        model = ai.Classification if agent == 'classify' else ai.Extraction
        data = {'pages': [{'document_id': doc['id'], 'page': page} for doc, page in items]}
        if agent == 'extract':
            data.update(allowed_key_labels=ai.config.LABELS, review_only_keys=sorted(ai.config.REVIEW_ONLY_KEYS))
        bundle = promptbook.load_prompt(agent, data, model)
        content = promptbook.PromptContent(bundle, [
            {'type': 'input_image', 'image_url': 'data:image/jpeg;base64,SYNTHETIC_IMAGE_NOT_FOR_TRACE'}
        ], promptbook.trace_context(items))
        return bundle, content, model

    async def mock_request(self, prepared, output, *, http_status=200, callback=None):
        body = json.dumps(output)

        class FakeClient:
            def __init__(self, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def post(self, *args, **kwargs):
                if callback:
                    callback()
                return httpx.Response(http_status, json={
                    'status': 'completed',
                    'output': [{'content': [{'type': 'output_text', 'text': body}]}],
                    'usage': {'input_tokens': 12, 'output_tokens': 8, 'total_tokens': 20},
                    'private_provider_error': 'SYNTHETIC_SECRET_RESPONSE_NOT_FOR_TRACE',
                })

        bundle, content, model = prepared
        with patch.object(ai.config, 'API_KEY', 'SYNTHETIC_API_KEY_NOT_FOR_TRACE'), \
                patch.object(ai.httpx, 'AsyncClient', FakeClient):
            return await ai.ask_json(bundle.instructions, content, model, {})

    async def test_private_trace_records_effective_input_and_validated_output(self):
        items = self.session_items()
        prepared = self.prepared_call(items)
        output = {'pages': [{'document_id': 'synthetic-private-id', 'page': 42,
                             'role': 'evidence', 'title': '합성 증빙', 'document_type': 'unknown'}]}
        await self.mock_request(prepared, output)
        traces = list((self.runtime / 'sessions' / ('a' * 32) / 'promptbook' / 'classify').iterdir())
        self.assertEqual(len(traces), 1)
        directory = traces[0]
        self.assertEqual({p.name for p in directory.iterdir()},
                         {'system.md', 'body.md', 'input.json', 'output.json', 'meta.json', 'usage.jsonl'})
        self.assertEqual((directory / 'system.md').read_text(encoding='utf-8'), prepared[0].instructions)
        self.assertEqual((directory / 'body.md').read_text(encoding='utf-8'), prepared[0].body)
        actual_input = json.loads((directory / 'input.json').read_text(encoding='utf-8'))
        self.assertEqual(actual_input['logical_input']['pages'][0]['page'], 42)
        self.assertEqual(actual_input['sources'][0]['physical_page'], 1)
        self.assertEqual(actual_input['sources'][0]['label'], 'DOCUMENT_ID=synthetic-private-id PAGE=42')
        self.assertEqual(json.loads((directory / 'output.json').read_text(encoding='utf-8')), output)
        meta = json.loads((directory / 'meta.json').read_text(encoding='utf-8'))
        self.assertEqual(meta['status'], 'completed')
        self.assertEqual(meta['usage'], {'input_tokens': 12, 'output_tokens': 8, 'total_tokens': 20})
        combined = '\n'.join(p.read_text(encoding='utf-8') for p in directory.iterdir())
        for forbidden in ('SYNTHETIC_API_KEY_NOT_FOR_TRACE', 'SYNTHETIC_IMAGE_NOT_FOR_TRACE',
                          'SYNTHETIC_SECRET_RESPONSE_NOT_FOR_TRACE', str(self.runtime), 'Authorization'):
            self.assertNotIn(forbidden, combined)

    async def test_deleted_session_is_not_recreated_by_delayed_response(self):
        items = self.session_items()
        prepared = self.prepared_call(items)
        directory = Path(items[0][0]['_path']).parent.resolve()

        def delete_session():
            self.assertEqual(directory.parent, (self.runtime / 'sessions').resolve())
            shutil.rmtree(directory)

        await self.mock_request(prepared, self.example('classify', 'output'), callback=delete_session)
        self.assertFalse(directory.exists())
        self.assertIsNone(promptbook.start_trace(prepared[0], prepared[1].trace_context, prepared[0].instructions))
        self.assertFalse(directory.exists())

    def test_trace_rejects_outside_mixed_and_invalid_session_paths(self):
        outside = Path(self.temp.name) / 'outside.pdf'
        outside.write_bytes(b'synthetic')
        self.assertIsNone(promptbook.trace_context([({'id': 'x', '_path': str(outside)}, 1)]))
        self.assertIsNone(promptbook.trace_context(self.session_items(sid='not-a-session-id')))
        first = self.session_items()
        second = self.session_items(sid='b' * 32)
        self.assertIsNone(promptbook.trace_context(first + second))

    async def test_failed_request_records_safe_status_without_response_or_key(self):
        prepared = self.prepared_call(self.session_items())
        with self.assertRaisesRegex(RuntimeError, 'HTTP 401'):
            await self.mock_request(prepared, self.example('classify', 'output'), http_status=401)
        directory = next((self.runtime / 'sessions' / ('a' * 32) / 'promptbook' / 'classify').iterdir())
        self.assertFalse((directory / 'output.json').exists())
        meta = json.loads((directory / 'meta.json').read_text(encoding='utf-8'))
        self.assertEqual(meta['status'], 'failed')
        self.assertEqual(meta['error_code'], 'http_error')
        self.assertEqual(meta['http_status'], 401)
        combined = '\n'.join(p.read_text(encoding='utf-8') for p in directory.iterdir())
        self.assertNotIn('SYNTHETIC_SECRET_RESPONSE_NOT_FOR_TRACE', combined)
        self.assertNotIn('SYNTHETIC_API_KEY_NOT_FOR_TRACE', combined)

    async def test_invalid_output_is_not_saved_or_exposed_in_exception(self):
        prepared = self.prepared_call(self.session_items())
        with self.assertRaises(RuntimeError) as caught:
            await self.mock_request(prepared, {'pages': 'SYNTHETIC_INVALID_CUSTOMER_DATA'})
        self.assertNotIn('SYNTHETIC_INVALID_CUSTOMER_DATA', str(caught.exception))
        directory = next((self.runtime / 'sessions' / ('a' * 32) / 'promptbook' / 'classify').iterdir())
        self.assertFalse((directory / 'output.json').exists())
        meta = json.loads((directory / 'meta.json').read_text(encoding='utf-8'))
        self.assertEqual(meta['error_code'], 'output_schema_mismatch')

    async def test_concurrent_calls_keep_independent_frozen_snapshots(self):
        first = self.prepared_call(self.session_items(document_id='synthetic-first'))
        (self.root / 'classify' / 'system.md').write_text('Synthetic second system.', encoding='utf-8')
        second = self.prepared_call(self.session_items(document_id='synthetic-second'))
        started = 0
        both_started = asyncio.Event()

        class FakeClient:
            def __init__(self, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def post(self, *args, **kwargs):
                nonlocal started
                started += 1
                if started == 2:
                    both_started.set()
                await asyncio.wait_for(both_started.wait(), timeout=2)
                return httpx.Response(200, json={'status': 'completed',
                    'output': [{'content': [{'type': 'output_text', 'text': '{"pages": []}'}]}]})

        with patch.object(ai.config, 'API_KEY', 'synthetic-key'), patch.object(ai.httpx, 'AsyncClient', FakeClient):
            await asyncio.gather(*(ai.ask_json(bundle.instructions, content, model, {})
                                   for bundle, content, model in (first, second)))
        directories = list((self.runtime / 'sessions' / ('a' * 32) / 'promptbook' / 'classify').iterdir())
        self.assertEqual(len(directories), 2)
        seen = {}
        for directory in directories:
            logical = json.loads((directory / 'input.json').read_text(encoding='utf-8'))['logical_input']
            seen[logical['pages'][0]['document_id']] = (directory / 'system.md').read_text(encoding='utf-8').rstrip()
        self.assertEqual(seen['synthetic-first'], first[0].instructions.rstrip())
        self.assertEqual(seen['synthetic-second'], second[0].instructions.rstrip())
        self.assertNotEqual(seen['synthetic-first'], seen['synthetic-second'])

    def test_custom_input_model_loads_declared_field_placeholders(self):
        class SynthesisInput(promptbook.StrictInput):
            facts: list[str]
            pages: list[str]

        directory = self.root / 'synthesize'
        shutil.copytree(self.root / 'classify', directory)
        (directory / 'input.schema.json').write_text(json.dumps(SynthesisInput.model_json_schema()), encoding='utf-8')
        (directory / 'body.md').write_text('Facts: {{facts_json}}\nPages: {{pages_json}}', encoding='utf-8')
        bundle = promptbook.load_prompt('synthesize', {'facts': ['synthetic fact'], 'pages': ['synthetic OCR']},
                                        ai.Classification, input_model=SynthesisInput)
        self.assertIn('synthetic fact', bundle.body)
        self.assertIn('synthetic OCR', bundle.body)
        with self.assertRaises(promptbook.PromptbookError):
            promptbook.load_prompt('../synthesize', {}, ai.Classification, input_model=SynthesisInput)

    async def test_extract_retains_every_transcript_and_excludes_all_review_only_keys(self):
        items = self.session_items(document_id='synthetic-document', page=6)
        output = self.example('extract', 'output')
        forbidden = deepcopy(output['facts'][0])
        forbidden['key'] = 'repayment_day'
        output['facts'].append(forbidden)
        response = ai.Extraction.model_validate(output)
        with patch.object(ai, 'content_for_pages', return_value=[]), \
                patch.object(ai, 'ask_json', AsyncMock(return_value=response)) as ask:
            result = await ai.extract(items, {}, required_features=['annual_business_income'])
        self.assertIsInstance(result, list)
        self.assertIsInstance(result, ai.ExtractedFacts)
        self.assertEqual(result.pages, output['pages'])
        self.assertEqual([row['key'] for row in result], ['annual_business_income'])
        bundle = ask.call_args.args[1].promptbook
        self.assertTrue(ai.config.REVIEW_ONLY_KEYS <= set(json.loads(bundle.input_json)['review_only_keys']))
        self.assertEqual(bundle.version, '1.2.0')

    async def test_extract_rejects_missing_duplicate_wrong_or_empty_transcript_pages(self):
        items = self.session_items(document_id='synthetic-document', page=6)
        good = self.example('extract', 'output')
        wrong = deepcopy(good['pages'][0])
        wrong['page'] = 100
        empty = deepcopy(good['pages'][0])
        empty['transcript'] = ' '
        for pages in ([], good['pages'] * 2, [wrong], [empty]):
            with self.subTest(pages=len(pages)):
                response = ai.Extraction.model_validate({**good, 'pages': pages})
                with patch.object(ai, 'content_for_pages', return_value=[]), \
                        patch.object(ai, 'ask_json', AsyncMock(return_value=response)):
                    with self.assertRaisesRegex(RuntimeError, '전사'):
                        await ai.extract(items, {})


if __name__ == '__main__':
    unittest.main()
