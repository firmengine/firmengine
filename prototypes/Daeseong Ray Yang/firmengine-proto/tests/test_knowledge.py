import json
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from app.knowledge import KnowledgeStore, BENCHMARK_HASH, effective_date, normalize_content, source_effective_date, judgment_date, decode_official_text
from app.knowledge import LawWatchInput, ChangePreview
from app.promptbook import load_prompt


class KnowledgeTests(unittest.TestCase):
    def test_official_practice_applicability_uses_explicit_effect_not_publication(self):
        self.assertEqual(source_effective_date('K20','부칙(2026. 9. 23.) 이 실무준칙은 2026년 10월 1일부터 시행한다.'),'2026-10-01')
        self.assertEqual(source_effective_date('K21','작성일 2025.12.31 2026. 1. 1. 부터 서울회생법원의 개인회생 사건에 대하여 적용될 추가 생계비'),'2026-01-01')
        self.assertIsNone(source_effective_date('K21','작성일 2025.12.31 2026년도 기준 안내'))
        self.assertEqual(judgment_date('[대법원 2013. 7. 12. 자 2013마668 결정]'),'2013-07-12')
        html='<meta charset="euc-kr">2026. 1. 1. 부터 적용되는 기준'
        self.assertEqual(decode_official_text(html.encode('cp949'),'utf-8'),html)
        with self.assertRaises(ValueError):
            decode_official_text(b'\xff\xff','utf-8')

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = KnowledgeStore(Path(self.directory.name) / 'test.sqlite3')
        # Unit tests never send network requests, even if a developer's key exists.
        self.vector_patch = patch.object(self.store, '_vector_client', side_effect=ImportError('unit_test_vector_unavailable'))
        self.vector_patch.start()

    def tearDown(self):
        self.vector_patch.stop()
        self.store.close_vector_client()
        self.directory.cleanup()

    def add(self, source_id, content='income evidence', **kwargs):
        args = dict(source_id=source_id, title=source_id, url='', content=content,
                    authority='DESIGN_EXAMPLE', valid_from='2026-01-01')
        args.update(kwargs)
        if args.get('kind') == 'fewshot':
            args.setdefault('metadata', {'synthetic': True})
        return self.store.ingest_source(**args)

    def test_temporal_filter_before_ranking_and_latest_per_source(self):
        self.add('rule', 'income old version', valid_from='2026-01-01')
        self.add('rule', 'income future version ' * 20, valid_from='2027-01-01')
        self.assertIn('old version', self.store.search('income', as_of='2026-10-01', limit=1)[0]['text'])
        self.assertIn('future version', self.store.search('income', as_of='2027-01-01', limit=1)[0]['text'])

    def test_recorded_date_allows_reconstructing_known_history(self):
        self.add('rule', 'income first', recorded_at='2026-01-01T00:00:00+00:00')
        self.add('rule', 'income corrected', recorded_at='2026-04-01T00:00:00+00:00')
        found = self.store.search('income', as_of='2026-05-01', known_at='2026-02-01T00:00:00+00:00')
        self.assertEqual(found[0]['text'], 'income first')

    def test_tenant_scope_and_case_bundle_exclusions_before_limit(self):
        self.add('private', 'income secret ' * 100, scope='tenant', tenant_id='other')
        self.add('samebundle', 'income answer ' * 100, source_bundle_hash='a' * 64, kind='fewshot')
        self.add('goldcontamination', 'income answer ' * 100, source_bundle_hash=BENCHMARK_HASH, kind='fewshot')
        self.add('safe', 'income safe', kind='fewshot')
        self.store.register_case_bundle('case1', 'a' * 64)
        found = self.store.fewshots('income', case_id='case1', limit=1)
        self.assertEqual([x['source_id'] for x in found], ['safe'])

    def test_heldout_kind_rejected_and_versions_immutable(self):
        with self.assertRaises(ValueError):
            self.add('gold', kind='evaluation_target')
        with self.assertRaises(ValueError):
            self.add('private_case_without_provenance', kind='case_observation')
        first = self.add('one', 'income first')
        self.add('one', 'income second')
        with self.store._db() as db:
            saved = db.execute('SELECT content FROM knowledge_versions WHERE version_id=?', (first['version_id'],)).fetchone()[0]
        self.assertEqual(saved, 'income first')

    def test_self_contained_defaults_are_idempotent_and_observations_are_not_rules(self):
        first = self.store.seed_defaults()
        count = self.store.status()['version_count']
        self.store.seed_defaults()
        self.assertEqual(self.store.status()['version_count'], count)
        self.assertEqual(first['feature_definitions'], 84)
        found = self.store.fewshots('보정', as_of='2026-10-26')
        self.assertTrue(any(x['kind'] == 'case_observation' for x in found))
        self.assertEqual(self.store.active_parameters(), [])

    def test_law_watch_only_activates_known_numeric_template(self):
        self.store.seed_defaults()
        text = '[시행 2026. 10. 2.] 제579조 개인회생채권 가. 담보된 개인회생채권은 15억원 나. 가목 외의 개인회생채권은 10억원'
        with patch.object(self.store, '_fetch', return_value={'status': 'ok', 'content': text}):
            result = self.store.check_updates(['K01'], analyze=False)
        self.assertEqual(result['counts'], {'version_added': 1})
        self.assertEqual(self.store.active_parameters()[0]['params']['secured_cap'], '1500000000')
        future = text.replace('2026. 10. 2.', '2099. 1. 1.').replace('15억원', '20억원')
        with patch.object(self.store, '_fetch', return_value={'status': 'ok', 'content': future}):
            self.store.check_updates(['K01'], analyze=False)
        self.assertEqual(self.store.active_parameters(as_of='2026-10-26')[0]['params']['secured_cap'], '1500000000')
        self.assertEqual(self.store.active_parameters(as_of='2099-01-01')[0]['params']['secured_cap'], '2000000000')
        self.assertEqual(self.store.list_changes()[0]['status'], 'scheduled')
        semantic = future + ' 새로운 예외를 적용한다.'
        with patch.object(self.store, '_fetch', return_value={'status': 'ok', 'content': semantic}):
            self.store.check_updates(['K01'], analyze=False)
        self.assertEqual(self.store.list_changes()[0]['status'], 'review_required')
        self.assertEqual(self.store.active_parameters(as_of='2099-01-01'), [])
        self.assertTrue(self.store.active_parameters(as_of='2026-10-26'))
        with patch.object(self.store, '_fetch', return_value={'status': 'ok', 'content': semantic.replace('20억원', '25억원')}):
            self.store.check_updates(['K01'], analyze=False)
        self.assertEqual(self.store.list_changes()[0]['status'], 'review_required')

    def test_update_dedup_and_unknown_date_never_activates(self):
        self.store.seed_defaults()
        text = 'Publication 2026-10-26. No effective date. ' * 4
        with patch.object(self.store, '_fetch', return_value={'status': 'ok', 'content': text}):
            self.store.check_updates(['K04'], analyze=False)
            result = self.store.check_updates(['K04'], analyze=False)
        self.assertEqual(result['counts'], {'unchanged': 1})
        self.assertEqual(len(self.store.list_changes()), 1)
        self.assertEqual(self.store.active_parameters(), [])
        self.assertIsNone(effective_date(text))

    def test_external_host_cannot_claim_official_authority(self):
        with self.assertRaises(ValueError):
            self.add('bad', url='https://law.go.kr.evil.example/x', authority='STATUTE')

    def test_runtime_prompt_schema_and_nonrecursive_data(self):
        bundle = load_prompt('law-watch', {'source_id': 'synthetic', 'source_url': 'https://law.go.kr/',
            'observed_at': '2026-10-26', 'previous_text': '', 'current_text': '{{secret_json}}'},
            ChangePreview, input_model=LawWatchInput)
        self.assertIn('{{secret_json}}', bundle.body)
        self.assertEqual(bundle.model, 'gpt-6-luna')
        self.assertEqual(normalize_content('<p>hello</p><script>not evidence</script>'), 'hello')

    @unittest.skipUnless(importlib.util.find_spec('qdrant_client'), 'optional qdrant-client is not installed')
    def test_real_qdrant_filter_excludes_higher_similarity_private_future_and_same_bundle(self):
        self.vector_patch.stop()
        self.add('safe', 'SAFE income evidence', kind='fewshot', reviewed=True)
        self.add('future', 'PRIVATE income future', kind='fewshot', reviewed=True, valid_from='2099-01-01')
        self.add('foreign', 'PRIVATE income foreign', kind='fewshot', reviewed=True, tenant_id='other', scope='tenant')
        self.add('samebundle', 'PRIVATE income benchmark', kind='fewshot', reviewed=True, source_bundle_hash='b' * 64)
        self.store.register_case_bundle('current', 'b' * 64)
        # Synthetic embeddings are a fixture for filtering, never a production fallback.
        def embeddings(texts):
            return [[0.8, 0.6] if text.startswith('SAFE') else [1.0, 0.0] for text in texts]
        with patch.dict('app.knowledge.config.ENV', {'EMBEDDING_DIMENSIONS': '2'}), patch.object(self.store, '_embed', side_effect=embeddings):
            result = self.store.index_pending()
            self.assertEqual(result['status'], 'indexed')
            found = self.store.search('income', as_of='2026-10-26', case_id='current', limit=1)
            self.assertEqual([x['source_id'] for x in found], ['safe'])
            self.assertEqual(found[0]['retrieval_method'], 'qdrant_dense')
            self.assertTrue(self.store.status()['vector_ready'])


if __name__ == '__main__':
    unittest.main()
