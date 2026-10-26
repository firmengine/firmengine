"""Physically separate reviewed sample roles. This tool never guesses page roles."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import fitz


def split(source:Path,manifest_path:Path,output:Path):
    raw=source.read_bytes()
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=manifest['source_sha256']:
        raise ValueError('역할 매핑과 원본 파일의 해시가 다릅니다.')
    output.mkdir(parents=True,exist_ok=True)
    groups={role:[] for role in ('evidence','evaluation','administrative','quarantine')}
    with fitz.open(source) as document:
        mappings=manifest['pages']
        if sorted(p['page'] for p in mappings)!=list(range(1,len(document)+1)):
            raise ValueError('모든 원본 페이지를 중복 없이 분류해야 합니다.')
        for page in mappings:
            groups[page['role']].append(page)
        results={}
        for role,pages in groups.items():
            if not pages:
                continue
            sub=fitz.open()
            mapping=[]
            for physical,page in enumerate(pages,1):
                sub.insert_pdf(document,from_page=page['page']-1,to_page=page['page']-1)
                mapping.append(dict(page=physical,original_page=page['page'],role=role,document_type=page.get('document_type','unknown')))
            destination=output/f'{role}.pdf'
            sub.save(destination,garbage=4,deflate=True)
            sub.close()
            record=dict(role=role,path=str(destination.resolve()),source_sha256=digest,sha256=hashlib.sha256(destination.read_bytes()).hexdigest(),pages=mapping,page_count=len(pages))
            (output/f'{role}-manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
            results[role]={'page_count':len(pages),'sha256':record['sha256'],'path':str(destination)}
    (output/'split-summary.json').write_text(json.dumps(dict(source_sha256=digest,roles=results),ensure_ascii=False,indent=2),encoding='utf-8')
    return results


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,default=Path('sample.pdf'))
    parser.add_argument('--manifest',type=Path,default=Path('.local/sample/role_manifest.json'))
    parser.add_argument('--output',type=Path,default=Path('.local/sample/split'))
    args=parser.parse_args()
    print(json.dumps(split(args.source,args.manifest,args.output),ensure_ascii=True,indent=2))


if __name__=='__main__':
    main()
