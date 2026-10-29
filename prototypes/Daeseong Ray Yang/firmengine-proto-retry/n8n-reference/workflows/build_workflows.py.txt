"""Generate an n8n workflow with the exact same calculator source as local Node."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORKFLOW_ID = "FirmEngineRetryCalc001"

def build():
    calculator = ROOT / "calculators.js"
    source = calculator.read_text(encoding="utf-8").split("// NODE_ADAPTER_START")[0]
    code_hash = hashlib.sha256(calculator.read_bytes()).hexdigest()
    workflow = {
        "id": WORKFLOW_ID, "name": "Firm Engine Retry · deterministic calculations", "active": False,
        "nodes": [
            {"id":"retry-calc-webhook","name":"Calculation input","type":"n8n-nodes-base.webhook","typeVersion":2,"position":[240,300],"webhookId":"firmengine-retry-calculator","parameters":{"httpMethod":"POST","path":"firmengine-retry/calculate","responseMode":"lastNode","options":{}}},
            {"id":"retry-calc-code","name":"Reviewed deterministic KRW arithmetic","type":"n8n-nodes-base.code","typeVersion":2,"position":[520,300],"parameters":{"jsCode":source+"\nconst input = $input.first().json;\nreturn [{json: {...calculate(input.body || input), engine: 'n8n-code', code_sha256: '"+code_hash+"'}}];"}},
        ],
        "connections":{"Calculation input":{"main":[[{"node":"Reviewed deterministic KRW arithmetic","type":"main","index":0}]]}},
        "settings":{"executionOrder":"v1","timezone":"Asia/Seoul","saveDataSuccessExecution":"none","saveDataErrorExecution":"none","saveManualExecutions":False},
    }
    (ROOT / "calculations.json").write_text(json.dumps(workflow,ensure_ascii=False,indent=2),encoding="utf-8")
    law_watch = {
        "id":"FirmEngineRetryLaw001", "name":"Firm Engine Retry · official source change watch (09:00 Seoul)","active":False,
        "nodes":[
            {"id":"law-schedule","name":"09:00 Asia Seoul","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.2,"position":[200,300],"parameters":{"rule":{"interval":[{"field":"cronExpression","expression":"0 9 * * *"}]}}},
            {"id":"law-refresh","name":"Collect official source hashes","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[480,300],"parameters":{"method":"POST","url":"http://127.0.0.1:8091/api/knowledge/refresh","options":{"timeout":120000}}},
        ],
        "connections":{"09:00 Asia Seoul":{"main":[[{"node":"Collect official source hashes","type":"main","index":0}]]}},
        "settings":{"executionOrder":"v1","timezone":"Asia/Seoul","saveDataSuccessExecution":"none","saveDataErrorExecution":"none"},
    }
    (ROOT/"law-watch.json").write_text(json.dumps(law_watch,ensure_ascii=False,indent=2),encoding="utf-8")
    return workflow

if __name__ == "__main__":
    build()
    print("Built workflows/calculations.json from calculators.js")
