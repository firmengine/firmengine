"""Pure logical document splitting; original blobs and frozen page limits stay intact.

Logical units point at the parent's immutable blob. Consumers must use each
unit's evidence_pages and original-to-physical _page_map when extracting or
downloading it; the blob itself is not a unit-specific PDF.
"""
from collections import defaultdict
from copy import deepcopy
import hashlib
import json
from pathlib import PurePath


def _pages(values, total):
    if any(type(page) is not int or page < 1 or page > total for page in values):
        raise ValueError('문서 단위의 원본 페이지 번호가 올바르지 않습니다.')
    if len(values) != len(set(values)):
        raise ValueError('문서 단위의 원본 페이지 번호가 중복되었습니다.')
    return sorted(values)


def _physical_map(document, evidence):
    count = document['pages']
    original = document.get('_page_map')
    mapping = {int(key): value for key, value in original.items()} if original is not None else {p: p for p in range(1, count + 1)}
    if not set(evidence) <= set(mapping) or any(type(value) is not int or value < 1 or value > count for value in mapping.values()):
        raise ValueError('증빙 원본 페이지와 보관 PDF 페이지의 연결이 누락되거나 올바르지 않습니다.')
    return mapping


def _unit_id(parent_id, pages, document_type):
    raw = json.dumps([parent_id, pages, document_type], ensure_ascii=False, separators=(',', ':'))
    return 'unit-' + hashlib.sha256(raw.encode('utf-8')).hexdigest()[:24]


def _groups(document, evidence):
    roles = defaultdict(list)
    for role in document.get('page_roles', []):
        if role.get('page') in evidence:
            roles[role['page']].append(role)
    groups = []
    for page in evidence:
        types = {str(row.get('document_type') or 'unknown').strip() or 'unknown' for row in roles[page]}
        # Missing or contradictory classifier rows remain unknown, never inherit
        # the neighboring page's type or an old whole-bundle type.
        kind = next(iter(types)) if len(types) == 1 else 'unknown'
        if groups and groups[-1][0] == kind and groups[-1][1][-1] + 1 == page:
            groups[-1][1].append(page)
        else:
            groups.append((kind, [page]))
    return groups, roles


def _rewrite_refs(value, owners):
    if isinstance(value, list):
        for item in value:
            _rewrite_refs(item, owners)
    elif isinstance(value, dict):
        key = (value.get('document_id'), value.get('page'))
        if isinstance(key[0], str) and type(key[1]) is int and key in owners:
            value['document_id'] = owners[key]
        for item in value.values():
            _rewrite_refs(item, owners)


def split_document_units(snapshot: dict) -> dict:
    """Return an independent updated snapshot; perform no I/O or classification.

    Only already selected evidence pages become leaves. Parents remain in the
    cabinet as bundles, existing child review state survives retries, and raw
    extraction assertions are linked to the new logical document IDs. Mapping
    is still PROPOSED and does not satisfy a verified-document requirement.
    """
    result = deepcopy(snapshot)
    documents = result.get('documents', [])
    by_id = {document['id']: document for document in documents}
    children = defaultdict(list)
    for document in documents:
        if document.get('source_parent_id'):
            children[document['source_parent_id']].append(document)
    output, owners = [], {}
    for parent in documents:
        if parent.get('source_parent_id') and parent['source_parent_id'] in by_id:
            continue
        output.append(parent)
        existing = children.get(parent['id'], [])
        if parent.get('processing_status') == 'bundle':
            # A retry must not overwrite manually verified taxonomy, subjects,
            # periods, extraction progress, or a tombstoned child.
            output.extend(existing)
            for child in existing:
                for page in child.get('evidence_pages', []):
                    owners[(parent['id'], page)] = child['id']
            continue
        if parent.get('processing_status') not in ('classified', 'extracted') or parent.get('deleted_at'):
            output.extend(existing)
            continue
        total = parent.get('original_total_pages', parent['pages'])
        evidence = _pages(parent.get('evidence_pages', []), total)
        if set(evidence).intersection(parent.get('excluded_pages', [])):
            raise ValueError('증빙 페이지와 제외 페이지가 겹쳐 문서 단위를 생성할 수 없습니다.')
        if not evidence:
            output.extend(existing)
            continue
        page_map = _physical_map(parent, evidence)
        groups, roles = _groups(parent, evidence)
        complete_single_document = (len(groups) == 1 and evidence == list(range(1, total + 1))
                                    and total == parent['pages'] and not parent.get('excluded_pages'))
        if complete_single_document and not existing:
            kind = groups[0][0]
            if parent.get('mapping_status') not in ('VERIFIED', 'MAPPED', 'REVIEWED'):
                parent.update(document_type=kind, mapping_status='PROPOSED')
            parent['evidence_pages'] = evidence
            continue
        unit_ids = []
        for kind, pages in groups:
            identifier = _unit_id(parent['id'], pages, kind)
            unit_ids.append(identifier)
            child = by_id.get(identifier)
            if child is None:
                inherited = ('sha256', 'storage', '_ocr_storage', '_path', '_case_id', '_journal_root',
                             '_frozen_evidence_partition', 'uploaded_at', 'mime_type', 'source_sha256')
                child = {key: deepcopy(parent[key]) for key in inherited if key in parent}
                locator = str(pages[0]) if len(pages) == 1 else f'{pages[0]}-{pages[-1]}'
                child.update(id=identifier, source_parent_id=parent['id'], source_name=parent.get('name'),
                    name=f"{PurePath(parent.get('name') or 'document.pdf').stem} — {kind} — p{locator}.pdf",
                    pages=len(pages), original_total_pages=total, evidence_pages=pages, excluded_pages=[],
                    document_type=kind, mapping_status='PROPOSED', processing_status='classified',
                    subject_id=None, period_start=None, period_end=None, _selected=True,
                    _page_map=deepcopy(page_map), page_roles=[])
                for page in pages:
                    page_roles = roles[page] or [{'page': page, 'role': 'evidence', 'document_type': 'unknown'}]
                    child['page_roles'].extend({**deepcopy(role), 'document_id': identifier,
                                                'source_document_id': parent['id']} for role in page_roles)
                transcripts = {str(page): deepcopy(parent.get('_transcripts', {}).get(str(page))) for page in pages
                               if str(page) in parent.get('_transcripts', {})}
                if transcripts:
                    child['_transcripts'] = transcripts
                    _rewrite_refs(child['_transcripts'], {(parent['id'], page): identifier for page in pages})
            output.append(child)
            for page in pages:
                owners[(parent['id'], page)] = identifier
        parent.update(processing_status='bundle', bundle_evidence_pages=evidence,
                      evidence_pages=[], child_document_ids=unit_ids)
        # Preserve older children/history rather than silently removing rows.
        output.extend(child for child in existing if child['id'] not in unit_ids)
    result['documents'] = output
    for field in ('records', 'assertions', 'draft_fields', 'draft_creditors'):
        _rewrite_refs(result.get(field, []), owners)
    result['evidence_pages_used'] = [{'document_id': document['id'], 'page': page}
        for document in output if document.get('processing_status') != 'bundle' and not document.get('deleted_at')
        for page in document.get('evidence_pages', [])]
    return result
