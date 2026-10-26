"""Fresh original-workflow evaluation; evidence only, frozen code, private exports.

This harness does not import evaluator answers, modify prompts, approve facts, or
change generation gates. Existing application/services and old runs are retained.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import time

import httpx

ROOT = Path(__file__).resolve().parents[1]


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def save(path, value):
    temporary = path.with_suffix(path.suffix+'.writing')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
    temporary.replace(path)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def freeze(run_dir, health):
    manifest=json.loads((ROOT/'evaluation'/'sample_manifest.json').read_text(encoding='utf-8'))
    source=ROOT/'sample.pdf'
    if digest(source)!=manifest['source_sha256']:
        raise ValueError('sample.pdf hash differs from reviewed page partition')
    evidence=manifest['evidence_pages'];holdout=manifest['holdout_pages'];admin=manifest['administrative_excluded_pages']
    if set(evidence)&set(holdout) or sorted(evidence+holdout+admin)!=list(range(1,manifest['total_pages']+1)):
        raise ValueError('Page partition overlaps or is incomplete')
    paths=[]
    for folder in ('app','rules','workflows','promptbook','templates'):
        paths += [p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix not in ('.pyc',)]
    paths += [ROOT/'scripts'/'run_local.py',Path(__file__)]
    code={p.relative_to(ROOT).as_posix():digest(p) for p in sorted(paths)}
    git=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,capture_output=True,text=True,check=False)
    frozen=dict(created_at=stamp(),source_file='sample.pdf',source_sha256=digest(source),
                source_pages=manifest['total_pages'],evidence_pages=evidence,holdout_pages=holdout,administrative_pages=admin,
                expected_truth_sha256='b38d63264c24eda8848d4611c5ad25b188980d2273a579c75f73ba4ee7291a65',
                benchmark_comparator='strict-body-and-row-coverage-2-label-only-fix',
                independent_criteria=442,comparable_criteria=405,model=health.get('model'),
                git_head=git.stdout.strip(),source_hashes=code,application_modified_for_run=False,
                evaluator_answers_read_by_generator=False)
    target=run_dir/'generation-manifest.json'
    if target.exists():
        old=json.loads(target.read_text(encoding='utf-8'))
        if old['source_hashes']!=frozen['source_hashes'] or old['source_sha256']!=frozen['source_sha256']:
            raise ValueError('Frozen source changed; create a separate run id')
        return old
    save(target,frozen)
    return frozen


def export(client, session, run_dir, outcome, elapsed, error_type=None):
    directory=run_dir/'artifacts'
    directory.mkdir(exist_ok=True)
    exported=[]
    for artifact in session.get('artifacts',[]):
        name=artifact.get('name','')
        if not name or Path(name).name!=name:
            raise ValueError('Invalid generated filename')
        response=client.get(artifact['url'])
        response.raise_for_status()
        (directory/name).write_bytes(response.content)
        exported.append(dict(name=name,sha256=hashlib.sha256(response.content).hexdigest(),bytes=len(response.content)))
    session=dict(session,artifact_dir=str(directory),evaluation_run=run_dir.name)
    save(run_dir/'generated.json',session)
    gate=session.get('generation_gate') or {}
    summary=dict(run_id=run_dir.name,case_id=session.get('id'),workflow_outcome=outcome,
                 application_status=session.get('status'),stage=session.get('stage'),progress=session.get('progress'),
                 records=len(session.get('records',[])),assertions=len(session.get('assertions',[])),
                 objects=len(session.get('objects',[])),artifacts=len(exported),artifact_hashes=exported,
                 generation_allowed=bool(gate.get('can_generate')),generation_gate_keys=list(gate),
                 elapsed_seconds=round(elapsed,2),error_type=error_type,exported_at=stamp(),
                 metrics=session.get('metrics',{}),normal_generation_success=bool(exported) and outcome=='completed')
    save(run_dir/'run-summary.json',summary)
    print(json.dumps({key:value for key,value in summary.items() if key not in ('metrics','artifact_hashes')},ensure_ascii=True),flush=True)
    return summary


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base',default='http://127.0.0.1:8010')
    parser.add_argument('--run-name',default='original-independent-20261026-001')
    parser.add_argument('--timeout',type=int,default=1800)
    args=parser.parse_args()
    if not args.run_name.replace('-','').replace('_','').isalnum():
        raise ValueError('Invalid run name')
    run_dir=ROOT/'.runtime'/'evaluation'/'runs'/args.run_name
    run_dir.mkdir(parents=True,exist_ok=True)
    started=time.monotonic()
    with httpx.Client(base_url=args.base,timeout=60,trust_env=False) as client:
        health_response=client.get('/api/health');health_response.raise_for_status()
        health=health_response.json()
        if not health.get('n8n_ready') or not health.get('api_key_configured'):
            raise RuntimeError('Configured API and ready n8n required')
        frozen=freeze(run_dir,health)
        identity=run_dir/'case-id.txt'
        if identity.exists():
            case_id=identity.read_text(encoding='utf-8').strip()
            response=client.get('/api/sessions/'+case_id);response.raise_for_status();session=response.json()
        else:
            response=client.post('/api/sessions/sample');response.raise_for_status();session=response.json()
            split=session.get('sample_split') or {}
            if split.get('source_sha256')!=frozen['source_sha256'] or not split.get('physical_evidence_only') or split.get('evidence_pages')!=92 or session.get('records') or session.get('artifacts'):
                raise RuntimeError('Initial sample isolation or empty state check failed')
            case_id=session['id']
            identity.write_text(case_id,encoding='utf-8')
            save(run_dir/'initial-session.json',session)
        launch=run_dir/'launch.json'
        if not launch.exists():
            response=client.post('/api/sessions/'+case_id+'/run');response.raise_for_status()
            save(launch,dict(case_id=case_id,launched_at=stamp(),http_status=response.status_code))
        last=None
        try:
            while time.monotonic()-started<args.timeout:
                response=client.get('/api/sessions/'+case_id);response.raise_for_status();session=response.json()
                jobs=session.get('jobs',[])
                pending=any(job.get('status') in ('QUEUED','RUNNING','RETRYING') for job in jobs)
                job_mark=tuple((job.get('status'),job.get('attempts')) for job in jobs)
                mark=(session.get('status'),session.get('stage'),session.get('progress'),job_mark)
                if mark!=last:
                    progress=dict(status=mark[0],stage=mark[1],progress=mark[2],records=len(session.get('records',[])),
                                  jobs=[{k:job.get(k) for k in ('status','attempts','max_attempts')} for job in jobs],
                                  elapsed_seconds=round(time.monotonic()-started),updated_at=stamp())
                    save(run_dir/'progress.json',progress)
                    print(json.dumps(progress,ensure_ascii=True),flush=True)
                    last=mark
                if session.get('status')=='failed' and not pending:
                    export(client,session,run_dir,'technical_failure',time.monotonic()-started)
                    return 2
                if session.get('status')=='needs_action' and not pending:
                    export(client,session,run_dir,'blocked',time.monotonic()-started)
                    return 0
                if session.get('status') in ('ready','reviewed') and session.get('artifacts') and not pending:
                    export(client,session,run_dir,'completed',time.monotonic()-started)
                    return 0
                time.sleep(3)
            export(client,session,run_dir,'timeout',time.monotonic()-started,'TimeoutError')
            return 3
        except Exception as exc:
            export(client,session,run_dir,'technical_failure',time.monotonic()-started,type(exc).__name__)
            return 2


if __name__=='__main__':
    raise SystemExit(main())
