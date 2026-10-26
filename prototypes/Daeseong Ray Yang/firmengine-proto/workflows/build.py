"""Managed n8n definitions; calculation code runs inside the real JS Code node."""
from app import config
from app.case_engine import n8n_code_source

def workflow():
    nodes=[{'id':'intake','name':'Case update','type':'n8n-nodes-base.webhook','typeVersion':2,'position':[0,0],'webhookId':'firmengine-p0',
            'parameters':{'httpMethod':'POST','path':'firmengine-p0','responseMode':'onReceived','options':{'responseCode':202}}}]
    connections={}
    previous='Case update'
    steps=[('classify','1. Document roles and types'),('extract','2. Parallel scoped extraction'),('prepare','3. Versioned calculation inputs'),
           ('code','4. Exact legal arithmetic'),('validate','5. Requirements risks and generation gate'),('generate','6. Generate or inform'),('complete','7. Finish durable job')]
    for i,(stage,title) in enumerate(steps):
        if stage=='code':
            node={'id':stage,'name':title,'type':'n8n-nodes-base.code','typeVersion':2,'position':[280*(i+1),0],
                  'parameters':{'mode':'runOnceForAllItems','jsCode':n8n_code_source()}}
        else:
            source='$json.body' if i==0 else '$json'
            body='={{ JSON.stringify({session_id: '+source+'.session_id, run_id: '+source+'.run_id, run_token: '+source+'.run_token'+(', calculation_results: $json.calculation_results' if stage=='validate' else '')+'}) }}'
            node={'id':stage,'name':title,'type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[280*(i+1),0],
                  'parameters':{'method':'POST','url':f'http://127.0.0.1:{config.API_PORT}/internal/stages/{stage}',
                                'sendBody':True,'specifyBody':'json','jsonBody':body,'options':{'timeout':1800000}}}
        nodes.append(node)
        connections[previous]={'main':[[{'node':title,'type':'main','index':0}]]}
        previous=title
    nodes.append({'id':'note','name':'Case engine architecture','type':'n8n-nodes-base.stickyNote','typeVersion':1,'position':[0,-300],
                  'parameters':{'width':1100,'height':240,'content':'## Firm Engine persistent cases\nUploads, edits, valuations and legal updates enqueue revision-bound jobs.\nDocument extraction is bounded and cached. The actual Code node performs exact arithmetic.\nThe API blocks court document generation when mandatory evidence or rules are unresolved.\nWarnings accompany permitted drafts. Final artifacts require caseworker and lawyer HITL.\nNo court submission node. OCR/keys stay in the local API; only calculation inputs enter Code.\nSuccessful/error/manual execution contents are not saved by n8n.'}})
    return {'id':'firmengineLocalP0','name':'Firm Engine · persistent case engine','active':False,'nodes':nodes,'connections':connections,
            'settings':{'executionOrder':'v1','saveDataErrorExecution':'none','saveDataSuccessExecution':'none','saveManualExecutions':False,'saveExecutionProgress':False,'executionTimeout':3600},'pinData':{}}

def law_watch():
    return {'id':'firmengineLawWatch','name':'Firm Engine · official law watch','active':False,
            'nodes':[{'id':'schedule','name':'Daily 09:00 Seoul','type':'n8n-nodes-base.scheduleTrigger','typeVersion':1.2,'position':[0,0],
                      'parameters':{'rule':{'interval':[{'field':'cronExpression','expression':'0 9 * * *'}]}}},
                     {'id':'check','name':'Fetch compare validate inform','type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[300,0],
                      'parameters':{'method':'POST','url':f'http://127.0.0.1:{config.API_PORT}/internal/knowledge/check','sendBody':True,'specifyBody':'json',
                                    'jsonBody':'={{ JSON.stringify({token: $env.FIRMENGINE_INTERNAL_TOKEN}) }}','options':{'timeout':1800000}}}],
            'connections':{'Daily 09:00 Seoul':{'main':[[{'node':'Fetch compare validate inform','type':'main','index':0}]]}},
            'settings':{'timezone':'Asia/Seoul','saveDataErrorExecution':'none','saveDataSuccessExecution':'none','saveManualExecutions':False,'saveExecutionProgress':False},'pinData':{}}
