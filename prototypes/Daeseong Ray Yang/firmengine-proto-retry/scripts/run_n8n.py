"""Run this prototype's isolated n8n instance; never touch other n8n data.

Uses local npm dependency, N8N_BIN, a global install, or an already-installed npm
npx cache. It does not silently install packages or overwrite another instance.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"workflows"))
from build_workflows import WORKFLOW_ID, build


def resolve_binary() -> list[str]:
    explicit = os.environ.get("N8N_BIN")
    if explicit and Path(explicit).is_file():
        return ["node", explicit] if explicit.endswith((".js", "/n8n", "\\n8n")) else [explicit]
    local = ROOT/"node_modules"/"n8n"/"bin"/"n8n"
    if local.is_file():
        return ["node",str(local)]
    executable = shutil.which("n8n.cmd") or shutil.which("n8n")
    if executable:
        return [executable]
    # Cached executable dependencies are reusable, while all runtime data stays here.
    caches = [Path(os.environ.get("LOCALAPPDATA", ""))/"npm-cache"/"_npx", Path.home()/".npm"/"_npx"]
    candidates = []
    for cache in caches:
        if cache.is_dir():
            for path in cache.glob("*/node_modules/n8n/bin/n8n"):
                metadata = path.parent.parent/"package.json"
                try:
                    version = json.loads(metadata.read_text(encoding="utf-8"))["version"]
                    if int(version.split(".")[0]) >= 2:
                        candidates.append((tuple(int(n) for n in version.split(".")[:3]),path))
                except (ValueError, KeyError, OSError):
                    pass
    if candidates:
        return ["node",str(max(candidates)[1])]
    raise SystemExit("n8n 미설치: 이 폴더에서 npm install 을 실행하거나 N8N_BIN에 n8n 실행 경로를 지정하세요.")


def environment(port: int) -> dict[str,str]:
    private = ROOT/".local"/"n8n"
    private.mkdir(parents=True,exist_ok=True)
    return {**os.environ,"N8N_USER_FOLDER":str(private),"N8N_PORT":str(port),"N8N_LISTEN_ADDRESS":"127.0.0.1",
            "N8N_HOST":"127.0.0.1","N8N_PROTOCOL":"http","N8N_EDITOR_BASE_URL":f"http://127.0.0.1:{port}",
            "WEBHOOK_URL":f"http://127.0.0.1:{port}/","GENERIC_TIMEZONE":"Asia/Seoul","TZ":"Asia/Seoul",
            "N8N_DIAGNOSTICS_ENABLED":"false","N8N_VERSION_NOTIFICATIONS_ENABLED":"false",
            "N8N_TEMPLATES_ENABLED":"false","N8N_SECURE_COOKIE":"false",
            "N8N_RUNNERS_ENABLED":"true","N8N_RUNNERS_BROKER_PORT":str(port+1),"N8N_RUNNERS_BROKER_LISTEN_ADDRESS":"127.0.0.1","N8N_LOG_LEVEL":os.getenv("N8N_LOG_LEVEL","info"),"EXECUTIONS_DATA_SAVE_ON_ERROR":"none",
            "EXECUTIONS_DATA_SAVE_ON_SUCCESS":"none","EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS":"false"}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--port",type=int,default=5681)
    parser.add_argument("--prepare-only",action="store_true")
    args=parser.parse_args()
    binary=resolve_binary(); env=environment(args.port)
    # Avoid mutating runtime DB belonging to a currently running instance.
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{args.port}/healthz",timeout=1) as response:
            if response.status==200:
                raise SystemExit(f"{args.port} 포트의 n8n이 이미 실행 중입니다. 기존 인스턴스를 중지한 뒤 다시 실행하세요.")
    except OSError:
        pass
    workflow=build()
    common={"cwd":str(ROOT),"env":env,"check":True,"timeout":180}
    existing=None
    database=ROOT/".local"/"n8n"/".n8n"/"database.sqlite"
    if database.is_file():
        with sqlite3.connect(f"file:{database.as_posix()}?mode=ro",uri=True) as connection:
            existing=connection.execute("SELECT active,nodes FROM workflow_entity WHERE id=?",(WORKFLOW_ID,)).fetchone()
    matches=bool(existing and json.loads(existing[1])==workflow["nodes"])
    if not (matches and existing[0]):
        if existing and existing[0]:
            # Importing an already-active CLI-created workflow without owner setup
            # may fail a deactivation permission check. Explicit server CLI unpublish
            # is the supported administrative transition before re-import.
            subprocess.run([*binary,"unpublish:workflow",f"--id={WORKFLOW_ID}"],**common)
        subprocess.run([*binary,"import:workflow",f"--input={ROOT/'workflows'/'calculations.json'}"],**common)
        subprocess.run([*binary,"publish:workflow",f"--id={WORKFLOW_ID}"],**common)
    if args.prepare_only:
        print("워크플로 가져오기·게시 완료. 다음 시작 시 production Webhook이 등록됩니다.")
        return
    print(f"n8n: http://127.0.0.1:{args.port} (isolated .local/n8n)",flush=True)
    process=subprocess.Popen([*binary,"start"],cwd=ROOT,env=env)
    try:
        raise SystemExit(process.wait())
    except KeyboardInterrupt:
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()

if __name__ == "__main__":
    main()
