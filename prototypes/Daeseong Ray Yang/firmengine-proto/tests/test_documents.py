"""Logical evidence units preserve source coordinates without touching PDF bytes."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.documents import split_document_units


def bundle():
    return {'id': 'synthetic-case', 'documents': [{
        'id': 'parent', 'name': 'synthetic-mixed.pdf', 'pages': 7,
        'sha256': 'synthetic-sha256', 'storage': {'key': 'immutable-synthetic-reference'},
        '_path': 'not-opened-synthetic-path', 'processing_status': 'classified',
        'document_type': None, 'mapping_status': 'UNMAPPED',
        'evidence_pages': [7, 1, 3, 2, 5], 'excluded_pages': [4, 6],
        'page_roles': [{'document_id': 'parent', 'page': page, 'role': role, 'document_type': kind}
                       for page, role, kind in [(1, 'evidence', 'resident_registration'),
                         (2, 'evidence', 'debt_certificate'), (3, 'evidence', 'debt_certificate'),
                         (4, 'filed_form', 'application'), (5, 'evidence', 'debt_certificate'),
                         (6, 'administrative', 'unknown'), (7, 'evidence', 'unknown')]]}],
        'records': [], 'assertions': []}


class DocumentUnitTests(unittest.TestCase):
    def test_mixed_bundle_splits_contiguous_evidence_by_type_and_retains_immutable_parent(self):
        original = bundle()
        untouched = deepcopy(original)
        result = split_document_units(original)
        self.assertEqual(original, untouched)
        parent, *units = result['documents']
        self.assertEqual(parent['processing_status'], 'bundle')
        self.assertEqual(parent['evidence_pages'], [])
        self.assertEqual(parent['bundle_evidence_pages'], [1, 2, 3, 5, 7])
        self.assertEqual(parent['pages'], 7)
        self.assertEqual([unit['evidence_pages'] for unit in units], [[1], [2, 3], [5], [7]])
        self.assertEqual([unit['document_type'] for unit in units],
                         ['resident_registration', 'debt_certificate', 'debt_certificate', 'unknown'])
        for unit in units:
            self.assertEqual(unit['source_parent_id'], 'parent')
            self.assertEqual(unit['storage'], parent['storage'])
            self.assertEqual(unit['sha256'], parent['sha256'])
            self.assertEqual(unit['_path'], parent['_path'])
            self.assertEqual(unit['_page_map'], {p: p for p in range(1, 8)})
            self.assertEqual(unit['pages'], len(unit['evidence_pages']))
            self.assertEqual(unit['original_total_pages'], 7)
            self.assertEqual(unit['mapping_status'], 'PROPOSED')
            self.assertEqual(unit['processing_status'], 'classified')
            self.assertTrue(unit['_selected'])
            self.assertTrue(all(role['document_id'] == unit['id'] for role in unit['page_roles']))
            self.assertEqual({role['page'] for role in unit['page_roles']}, set(unit['evidence_pages']))
            self.assertFalse({4, 6}.intersection(unit['evidence_pages']))
        self.assertEqual(len(result['evidence_pages_used']), 5)

    def test_repeated_calls_preserve_reviewed_children_and_have_stable_ids(self):
        initial = bundle()
        result = split_document_units(initial)
        child = result['documents'][1]
        child.update(mapping_status='VERIFIED', subject_id='person-primary', processing_status='extracted')
        self.assertEqual(split_document_units(result), result)
        reordered = deepcopy(initial)
        reordered['documents'][0]['page_roles'].reverse()
        reordered['documents'][0]['evidence_pages'].reverse()
        self.assertEqual([row['id'] for row in split_document_units(reordered)['documents']],
                         [row['id'] for row in result['documents']])

    def test_frozen_partition_keeps_original_to_physical_map_and_omits_all_other_pages(self):
        data = bundle()
        doc = data['documents'][0]
        doc.update(pages=3, original_total_pages=10, evidence_pages=[2, 7, 8],
                   excluded_pages=[1, 3, 4, 5, 6, 9, 10], _frozen_evidence_partition=True,
                   _page_map={'2': 1, '7': 2, '8': 3})
        doc['page_roles'] = [{'document_id': 'parent', 'page': p, 'role': 'evidence',
                             'document_type': 'debt_certificate' if p == 2 else 'bank_statement'} for p in (2, 7, 8)]
        result = split_document_units(data)
        units = result['documents'][1:]
        self.assertEqual([unit['evidence_pages'] for unit in units], [[2], [7, 8]])
        for unit in units:
            self.assertTrue(unit['_frozen_evidence_partition'])
            self.assertEqual(unit['_page_map'], {2: 1, 7: 2, 8: 3})
            self.assertEqual(unit['original_total_pages'], 10)
            self.assertEqual(unit['excluded_pages'], [])

    def test_existing_evidence_references_move_to_unit_without_changing_original_page(self):
        data = bundle()
        data['assertions'] = [{'id': 'a1', 'evidence_refs': [{'document_id': 'parent', 'page': 3, 'excerpt': 'synthetic'}]}]
        data['records'] = [{'id': 'r1', 'sources': [{'document_id': 'parent', 'page': 3, 'quote': 'synthetic'}],
                            'candidates': [{'value': '100', 'sources': [{'document_id': 'parent', 'page': 3}]}]}]
        result = split_document_units(data)
        unit = next(row for row in result['documents'] if row.get('evidence_pages') == [2, 3])
        for ref in [result['assertions'][0]['evidence_refs'][0], result['records'][0]['sources'][0],
                    result['records'][0]['candidates'][0]['sources'][0]]:
            self.assertEqual(ref['document_id'], unit['id'])
            self.assertEqual(ref['page'], 3)

    def test_one_complete_homogeneous_document_needs_no_virtual_duplicate(self):
        data = bundle()
        doc = data['documents'][0]
        doc.update(pages=2, evidence_pages=[1, 2], excluded_pages=[])
        doc['page_roles'] = [{'document_id': 'parent', 'page': p, 'role': 'evidence',
                             'document_type': 'debt_certificate'} for p in (1, 2)]
        result = split_document_units(data)
        self.assertEqual(len(result['documents']), 1)
        self.assertEqual(result['documents'][0]['document_type'], 'debt_certificate')
        self.assertEqual(result['documents'][0]['mapping_status'], 'PROPOSED')
        self.assertEqual(result['documents'][0]['processing_status'], 'classified')

    def test_missing_page_type_is_unknown_not_borrowed_from_neighbor(self):
        data = bundle()
        data['documents'][0]['page_roles'] = [r for r in data['documents'][0]['page_roles'] if r['page'] != 3]
        result = split_document_units(data)
        unit = next(row for row in result['documents'] if row.get('evidence_pages') == [3])
        self.assertEqual(unit['document_type'], 'unknown')
        self.assertEqual(unit['mapping_status'], 'PROPOSED')

    def test_invalid_partition_or_incomplete_physical_map_fails_without_mutation(self):
        for changes in ({'evidence_pages': [1, 4]}, {'_page_map': {1: 1}}, {'evidence_pages': [True, 2]}):
            with self.subTest(changes=changes):
                data = bundle()
                data['documents'][0].update(changes)
                before = deepcopy(data)
                with self.assertRaises(ValueError):
                    split_document_units(data)
                self.assertEqual(data, before)

    def test_single_document_human_taxonomy_and_nonreference_structures_are_preserved(self):
        data = bundle()
        doc = data['documents'][0]
        doc.update(pages=1, evidence_pages=[1], excluded_pages=[], document_type='reviewed_certificate',
                   mapping_status='VERIFIED', page_roles=[{'page': 1, 'role': 'evidence', 'document_type': 'unknown'}])
        data['assertions'] = [{'id': 'structured-value', 'value': {'page': [1, 2], 'document_id': {'reported': 'unknown'}}}]
        result = split_document_units(data)
        self.assertEqual(result['documents'][0]['document_type'], 'reviewed_certificate')
        self.assertEqual(result['documents'][0]['mapping_status'], 'VERIFIED')
        self.assertEqual(result['assertions'], data['assertions'])


if __name__ == '__main__':
    unittest.main()
