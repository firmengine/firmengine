"""Run the real sample through n8n, export private outputs for independent scoring."""
from pathlib import Path
import argparse
import json
import time
import httpx

ROOT = Path(__file__).resolve().parents[1]


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--base', default='http://127.0.0.1:8010')
    args = p.parse_args()
    private = ROOT / '.runtime' / 'evaluation'
    private.mkdir(parents=True, exist_ok=True)
    with httpx.Client(base_url=args.base, timeout=60) as client:
        response = client.post('/api/sessions/sample')
        response.raise_for_status()
        session = response.json()
        sid = session['id']
        (private / 'session-id.txt').write_text(sid)
        start = time.monotonic()
        result = client.post(f'/api/sessions/{sid}/run')
        result.raise_for_status()
        last = None
        while time.monotonic() - start < 1800:
            response = client.get(f'/api/sessions/{sid}')
            response.raise_for_status()
            session = response.json()
            mark = (session['stage'], session['progress'])
            if mark != last:
                print(json.dumps({'stage': mark[0], 'progress': mark[1], 'seconds': round(time.monotonic() - start)}, ensure_ascii=True), flush=True)
                last = mark
            if session['status'] == 'failed':
                raise SystemExit('Workflow failed: ' + session['message'])
            if session['status'] in ('ready', 'reviewed') and session['artifacts']:
                break
            time.sleep(3)
        else:
            raise SystemExit('Workflow timeout')
        artifacts = private / 'artifacts'
        artifacts.mkdir(exist_ok=True)
        for item in session['artifacts']:
            data = client.get(item['url'])
            data.raise_for_status()
            name = Path(item['name']).name
            if name != item['name']:
                raise ValueError('Invalid artifact filename')
            (artifacts / name).write_bytes(data.content)
        session['artifact_dir'] = str(artifacts)
        (private / 'generated.json').write_text(json.dumps(session, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'status': session['status'], 'records': len(session['records']), 'artifacts': len(session['artifacts']),
                          'metrics': session['metrics'], 'export': '.runtime/evaluation/generated.json'}, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    main()
