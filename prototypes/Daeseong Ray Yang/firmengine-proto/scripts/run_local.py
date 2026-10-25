"""Start an isolated local n8n + FastAPI instance (no global n8n config changes)."""
from pathlib import Path
import argparse
import json
import os
import secrets
import shutil
import socket
import sqlite3
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import config


def workflow():
    nodes = [{'id': 'intake', 'name': 'Local document job', 'type': 'n8n-nodes-base.webhook',
              'typeVersion': 2, 'position': [0, 0], 'webhookId': 'firmengine-p0',
              'parameters': {'httpMethod': 'POST', 'path': 'firmengine-p0', 'responseMode': 'onReceived', 'options': {'responseCode': 202}}}]
    names = ['Local document job']
    stages = [('classify', '1. Evidence / submitted-form split'), ('extract', '2. GPT-6 Luna evidence extraction'),
              ('validate', '3. Provenance + deterministic checks'), ('generate', '4. Court DOCX + XLSX drafts')]
    for i, (stage, title) in enumerate(stages):
        payload = '={{ JSON.stringify({session_id: $json.body.session_id, run_token: $json.body.run_token}) }}' if i == 0 else '={{ JSON.stringify({session_id: $json.session_id, run_token: $json.run_token}) }}'
        nodes.append({'id': stage, 'name': title, 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.2,
                      'position': [260 * (i + 1), 0], 'parameters': {'method': 'POST',
                       'url': f'http://127.0.0.1:{config.API_PORT}/internal/stages/{stage}',
                       'sendBody': True, 'specifyBody': 'json', 'jsonBody': payload,
                       'options': {'timeout': 1800000}}})
        names.append(title)
    nodes.append({'id': 'instructions', 'name': 'Local P0 setup', 'type': 'n8n-nodes-base.stickyNote', 'typeVersion': 1,
                  'position': [0, -320], 'parameters': {'width': 1000, 'height': 240, 'content':
                    '## Firm Engine · local P0\nRun scripts/run_local.py to import/publish this workflow and start both services.\nOpen the app at http://127.0.0.1:8010 and upload evidence.\nOnly session_id + short-lived run_token pass through n8n. OpenAI keys and document contents stay in the local API.\nThe extractor uses GPT-6 Luna. Completed court forms are held out for evaluation.\nGenerated files ALWAYS require post-generation caseworker + lawyer review. No court submission node.'}})
    return {'id': 'firmengineLocalP0', 'name': 'Firm Engine P0 · evidence to court forms',
            'active': False, 'nodes': nodes,
            'connections': {a: {'main': [[{'node': b, 'type': 'main', 'index': 0}]]} for a, b in zip(names, names[1:])},
            'settings': {'executionOrder': 'v1', 'saveDataErrorExecution': 'none', 'saveDataSuccessExecution': 'none',
                         'saveManualExecutions': False, 'saveExecutionProgress': False, 'executionTimeout': 3600},
            'pinData': {}}


def make_env():
    local = ROOT / '.runtime'
    local.mkdir(exist_ok=True)
    keyfile = local / 'n8n-encryption-key'
    if not keyfile.exists():
        keyfile.write_text(secrets.token_hex(32), encoding='ascii')
    env = os.environ.copy()
    env.update({'N8N_USER_FOLDER': str(local / 'n8n'), 'N8N_ENCRYPTION_KEY': keyfile.read_text().strip(),
                'N8N_HOST': '127.0.0.1', 'N8N_LISTEN_ADDRESS': '127.0.0.1', 'N8N_PORT': str(config.N8N_PORT),
                'N8N_PROTOCOL': 'http', 'N8N_SECURE_COOKIE': 'false', 'N8N_DIAGNOSTICS_ENABLED': 'false',
                'N8N_VERSION_NOTIFICATIONS_ENABLED': 'false', 'N8N_TEMPLATES_ENABLED': 'false',
                'N8N_RUNNERS_BROKER_PORT': str(config.ENV.get('N8N_RUNNERS_BROKER_PORT') or (config.N8N_PORT + 1)),
                'N8N_LOG_LEVEL': 'info',
                'EXECUTIONS_DATA_SAVE_ON_ERROR': 'none', 'EXECUTIONS_DATA_SAVE_ON_SUCCESS': 'none',
                'EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS': 'false', 'EXECUTIONS_DATA_SAVE_ON_PROGRESS': 'false',
                'N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS': 'true', 'GENERIC_TIMEZONE': 'Asia/Seoul',
                'API_PORT': str(config.API_PORT), 'N8N_PORT': str(config.N8N_PORT), 'PYTHONUTF8': '1'})
    return env


def port_free(port):
    with socket.socket() as sock:
        return sock.connect_ex(('127.0.0.1', port)) != 0


def registered_workflow(env, expected):
    """Inspect our isolated n8n database read-only; preserve existing user edits."""
    database = Path(env['N8N_USER_FOLDER']) / '.n8n' / 'database.sqlite'
    if not database.exists():
        return None
    with sqlite3.connect(f'file:{database.as_posix()}?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        if not db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_entity'").fetchone():
            return None
        row = db.execute('SELECT nodes, connections, settings, activeVersionId, isArchived FROM workflow_entity WHERE id=?', (expected['id'],)).fetchone()
        if row is None:
            return None
        if row['isArchived']:
            raise SystemExit('The local workflow is archived. Restore it in n8n before starting.')

        def matches(nodes, connections):
            stored = {n['id']: n for n in json.loads(nodes)}
            if set(stored) != {n['id'] for n in expected['nodes']}:
                return False
            for node in expected['nodes']:
                if any(stored[node['id']].get(key) != value for key, value in node.items()):
                    return False
            return json.loads(connections) == expected['connections']

        settings = json.loads(row['settings'] or '{}')
        if not matches(row['nodes'], row['connections']) or any(settings.get(k) != v for k, v in expected['settings'].items()):
            raise SystemExit('The existing n8n workflow has different content. Review it in the n8n editor; startup will not overwrite it.')
        if row['activeVersionId']:
            active = db.execute('SELECT nodes, connections FROM workflow_history WHERE versionId=?', (row['activeVersionId'],)).fetchone()
            if active is None or not matches(active['nodes'], active['connections']):
                raise SystemExit('The published workflow differs. Review and publish the intended version in n8n.')
            return 'active'
        return 'inactive'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--write-workflow', action='store_true')
    args = parser.parse_args()
    target = ROOT / 'workflows' / 'firmengine-p0.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(workflow(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.write_workflow:
        print('workflows/firmengine-p0.json generated')
        return
    for port in (config.API_PORT, config.N8N_PORT):
        if not port_free(port):
            raise SystemExit(f'Port {port} is already in use. Stop the existing instance or change .env ports.')
    n8n = ROOT / 'node_modules' / 'n8n' / 'bin' / 'n8n'
    if not n8n.exists():
        raise SystemExit('Run npm.cmd ci (Windows) or npm ci first.')
    env = make_env()
    node = shutil.which('node')
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    log_path = ROOT / '.runtime' / 'services.log'
    children = []
    with log_path.open('w', encoding='utf-8') as log:
        registered = registered_workflow(env, workflow())
        commands = []
        if registered is None:
            commands.append([node, str(n8n), 'import:workflow', '--input', str(target)])
        if registered != 'active':
            commands.append([node, str(n8n), 'publish:workflow', '--id', 'firmengineLocalP0'])
        if registered == 'active':
            print('Reusing the registered, published local workflow.', flush=True)
        for command in commands:
            print('Preparing n8n workflow...', flush=True)
            done = subprocess.run(command, cwd=ROOT, env=env, stdout=log, stderr=log, creationflags=flags)
            if done.returncode:
                raise SystemExit(f'n8n setup failed. See {log_path}')
        try:
            children.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                                               '--port', str(config.API_PORT), '--no-access-log'], cwd=ROOT, env=env,
                                              stdout=log, stderr=log, creationflags=flags))
            children.append(subprocess.Popen([node, str(n8n), 'start'], cwd=ROOT, env=env,
                                              stdout=log, stderr=log, creationflags=flags))
            (ROOT / '.runtime' / 'services.json').write_text(json.dumps({'supervisor_pid': os.getpid(), 'pids': [c.pid for c in children]}))
            print(f'App: http://127.0.0.1:{config.API_PORT}', flush=True)
            print(f'n8n: http://127.0.0.1:{config.N8N_PORT} (first visit: create a local owner account)', flush=True)
            print('Press Ctrl+C to stop both services. Case content is not logged.', flush=True)
            while all(c.poll() is None for c in children):
                time.sleep(1)
            print('A service stopped; see .runtime/services.log', flush=True)
        except KeyboardInterrupt:
            print('Stopping local services...', flush=True)
        finally:
            for child in children:
                if child.poll() is None:
                    child.terminate()
            for child in children:
                try:
                    child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    child.kill()


if __name__ == '__main__':
    main()
