"""Resolve the configured mixed sample and isolate generator evidence physically."""
import hashlib
import json
from pathlib import Path

import pymupdf

from . import config


def validate_manifest(manifest):
    expected = set(range(1, manifest['total_pages'] + 1))
    partitions = []
    for key in ('evidence_pages', 'holdout_pages', 'administrative_excluded_pages'):
        values = manifest[key]
        if len(values) != len(set(values)) or any(type(p) is not int for p in values):
            raise ValueError('분리표에 중복 또는 잘못된 페이지 번호가 있습니다.')
        pages = set(values)
        if not pages <= expected or any(pages & other for other in partitions):
            raise ValueError('증빙과 평가 제출본 페이지가 겹치거나 범위를 벗어났습니다.')
        partitions.append(pages)
    if set().union(*partitions) != expected or not partitions[0] or not partitions[1]:
        raise ValueError('분리표가 원본의 모든 페이지를 구분하지 못했습니다.')


def resolve_source(root=None):
    root = Path(root or config.ROOT)
    manifest = json.loads((root / '.runtime' / 'evaluation' / 'sample_manifest.json').read_text(encoding='utf-8'))
    validate_manifest(manifest)
    configured = config.ENV.get('SAMPLE_PDF_PATH')
    candidates = ([Path(configured)] if configured else []) + [root / '.runtime' / 'evaluation' / 'source.pdf']
    existing = []
    for candidate in candidates:
        if not candidate.is_file():
            continue
        existing.append(candidate)
        with candidate.open('rb') as handle:
            digest = hashlib.file_digest(handle, 'sha256').hexdigest()
        if digest == manifest['source_sha256']:
            return candidate, manifest
    if existing:
        raise ValueError('샘플 해시가 분리표와 다릅니다. 해당 PDF의 페이지 분리를 다시 검토해야 합니다.')
    raise FileNotFoundError('비공개 작업 폴더의 source.pdf와 검토된 분리표가 필요합니다.')


def evidence_bundle(root=None):
    source, manifest = resolve_source(root)
    pages = list(manifest['evidence_pages'])
    with pymupdf.open(source) as original, pymupdf.open() as evidence:
        if len(original) != manifest['total_pages']:
            raise ValueError('원본 페이지 수가 분리표와 다릅니다.')
        for page in pages:
            evidence.insert_pdf(original, from_page=page - 1, to_page=page - 1, links=False)
        content = evidence.tobytes(garbage=4, deflate=True)
    return content, manifest, source.name
