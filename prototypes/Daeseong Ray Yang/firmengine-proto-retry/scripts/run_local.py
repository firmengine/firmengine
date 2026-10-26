"""One command starts the isolated local prototype. Ctrl+C stops owned processes."""
from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def free_port(port):
    with socket.socket() as sock:
        return sock.connect_ex(('127.0.0.1',port)) != 0


def main():
    parser = argparse.ArgumentParser(description='Firm Engine retry local prototype')
    parser.add_argument('--port',type=int,default=int(os.getenv('FIRMENGINE_PORT','8091')))
    parser.add_argument('--without-n8n',action='store_true',help='Skip starting n8n; use a reachable webhook or the identical local Node calculator')
    options = parser.parse_args()
    if not free_port(options.port):
        print(f'Port {options.port} is in use. Choose --port or stop the existing owner.',flush=True)
        return 1
    processes = []
    environment = dict(os.environ,PYTHONUTF8='1',FIRMENGINE_PORT=str(options.port))
    environment.setdefault('FIRMENGINE_N8N_URL','http://127.0.0.1:5681')
    try:
        if not options.without_n8n:
            processes.append(subprocess.Popen([sys.executable,str(ROOT/'scripts'/'run_n8n.py')],cwd=ROOT,env=environment))
        print(f'Firm Engine Retry: http://127.0.0.1:{options.port}',flush=True)
        print('Local prototype. Cases persist in ignored .local/. Ctrl+C stops the owned services.',flush=True)
        processes.append(subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(options.port),'--no-access-log'],cwd=ROOT,env=environment))
        while all(process.poll() is None for process in processes):
            time.sleep(.5)
        exits = [p.returncode for p in processes if p.poll() is not None]
        return next((code for code in exits if code),0)
    except KeyboardInterrupt:
        return 0
    finally:
        # Only terminate processes this runner created; never kill unrelated listeners.
        for process in reversed(processes):
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
                else:
                    process.terminate()


if __name__ == '__main__':
    raise SystemExit(main())
