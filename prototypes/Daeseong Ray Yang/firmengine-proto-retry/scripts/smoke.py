"""Synthetic integration verification, never a real submission-quality score."""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def main():
    # The check owns its storage, so it cannot change cases in the interactive app.
    with tempfile.TemporaryDirectory(prefix='firmengine-retry-smoke-') as directory:
        os.environ['FIRMENGINE_DATA_DIR'] = directory
        from fastapi.testclient import TestClient
        from app.main import app
        checks = []
        with TestClient(app) as client:
            def ok(condition,label):
                if not condition:
                    raise AssertionError(label)
                checks.append(label)

            response = client.post('/api/demo')
            ok(response.status_code==201,'합성 사건 생성')
            case = response.json()
            identifier, revision = case['id'],case['revision']
            ok(case['assessment']['can_generate'],'비필수 50만원 출금 경고가 생성 전체를 차단하지 않음')
            ok(len(case['creditors'])==2 and case['creditors'][0]['contract_id']!=case['creditors'][1]['contract_id'],'같은 은행의 복수 계약 유지')
            calc = case['assessment']['calculations']
            ok(calc['net_income']==3500000 and calc['disposable_income']==1700000,'결정론적 소득·가용소득 계산')
            response = client.post(f'/api/cases/{identifier}/generate',json={'expected_revision':revision})
            ok(response.status_code==200,'필수 조건 충족 시 실제 파일 생성')
            generated = response.json()
            artifacts = generated['artifacts']
            ok(sum(a['kind'].lower()=='docx' for a in artifacts)>=6,'기본 6종 이상 DOCX 생성')
            ok(any(a['kind'].lower()=='xlsx' for a in artifacts),'XLSX 계산근거표 생성')
            for artifact in artifacts:
                downloaded = client.get(artifact['url'])
                ok(downloaded.status_code==200 and hashlib.sha256(downloaded.content).hexdigest()==artifact['sha256'],f"생성본 바이트·해시 일치: {artifact['title']}")
            first = next(a for a in artifacts if a['kind'].lower()=='docx')
            body = dict(expected_revision=revision,artifact_id=first['id'],reviewer='합성 검수자',role='lawyer')
            ok(client.post(f'/api/cases/{identifier}/reviews',json=body).status_code==409,'담당자 확인 전 변호사 최종 확인 차단')
            body['role']='staff'
            ok(client.post(f'/api/cases/{identifier}/reviews',json=body).status_code==200,'실제 생성본 담당자 확인')
            body['role']='lawyer'
            ok(client.post(f'/api/cases/{identifier}/reviews',json=body).status_code==200,'동일 해시 생성본 변호사 최종 확인')
            response=client.patch(f'/api/cases/{identifier}',json={'expected_revision':revision,'living_cost':1900000,'reason':'합성 입력 수정'})
            ok(response.status_code==200,'입력 정정 후 재평가')
            changed=response.json()
            ok(all(not r['valid'] for r in changed['reviews']),'입력 변경 시 기존 검수 유효성 해제')
            ok(all(a['status']=='과거본·재검수 필요' for a in changed['artifacts']),'과거 생성물 보존·현재본 구분')
            ok(client.patch(f'/api/cases/{identifier}',json={'expected_revision':revision,'title':'오래된 수정'}).status_code==409,'동시 편집 버전 충돌 차단')
            response=client.post('/api/cases',json={'title':'필수 입력 누락 합성'})
            empty=response.json()
            ok(client.post(f"/api/cases/{empty['id']}/generate",json={'expected_revision':empty['revision']}).status_code==409,'필수 미해결 사건 생성 보류')
            # The independent check never contacts an AI service or uses evaluation answers.
            import fitz
            pdf=fitz.open();p=pdf.new_page();p.insert_text((72,72),'EVALUATION ANSWER EXCLUDED');raw=pdf.tobytes();pdf.close()
            upload=client.post(f'/api/cases/{identifier}/documents',files={'file':('evaluation.pdf',raw,'application/pdf')},data={'role':'evaluation','document_type':'statement','expected_revision':changed['revision']})
            ok(upload.status_code==201,'평가 전용 PDF 역할 지정 업로드')
            from app.pipeline import _page_records
            from app import store
            doc=store.get_case(identifier)['documents'][0]
            records=_page_records(store.OBJECTS/doc['object_key'],doc)
            ok(all(not p.get('text') and not p.get('image_url') for p in records),'평가 페이지를 생성 입력 버퍼로 읽지 않음')
            report=client.get(f'/api/cases/{identifier}/review-report')
            ok(report.status_code==200 and report.content[:2]==b'PK','검수 버전·해시 기록 별도 DOCX 내려받기')
            owned_cache=store.LOCAL/'extraction_cache'/hashlib.sha256(empty['id'].encode()).hexdigest()[:24]
            owned_cache.mkdir(parents=True,exist_ok=True)
            (owned_cache/'synthetic-cache.json').write_text('{"synthetic":true}',encoding='utf-8')
            ok(client.delete(f'/api/cases/{empty["id"]}').status_code==200,'사건 삭제')
            ok(not owned_cache.exists(),'사건 삭제 시 비공개 추출 캐시 제거')
            try:
                store.record_calls(empty['id'],'deleted-synthetic',[{'synthetic':True}])
                delayed_blocked=False
            except KeyError:
                delayed_blocked=True
            ok(delayed_blocked,'삭제된 사건의 지연 호출 기록 저장 차단')
            store.initialize()
            ok(store.get_case(identifier)['title']==changed['title'],'저장소 재초기화 후 사건 복구')
            generated_folders={str((store.OBJECTS/a['object_key']).parent) for a in store.rows('artifacts',identifier)}
            client.delete(f'/api/cases/{identifier}')
            ok(all(not Path(folder).exists() for folder in generated_folders),'사건 삭제 시 생성물·내용 모델·패키지 매니페스트 함께 제거')
        print(json.dumps({'kind':'synthetic integration only','checks':len(checks),'passed':checks,'real_sample_evaluation':'not performed'},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
