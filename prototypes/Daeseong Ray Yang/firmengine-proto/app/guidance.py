"""Small RAG tasks propose evidence requests; deterministic gates retain authority."""
import asyncio
from pydantic import BaseModel, ConfigDict
from . import ai, promptbook

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')

class GuidanceInput(Strict):
    application_date: str | None
    questions: list[dict]
    facts: list[dict]
    references: list[dict]

class Suggestion(Strict):
    finding_id: str
    request: str
    strategy: str
    assertion_ids: list[str]
    source_ids: list[str]

class Guidance(Strict):
    suggestions: list[Suggestion]
    warnings: list[str]

async def propose(snapshot, knowledge):
    """At most four independent small tasks. Never set legal facts or gate flags."""
    findings = snapshot.get('findings', [])
    tasks = []
    for start in range(0, min(len(findings), 12), 3):
        group = findings[start:start+3]
        keys = {key for f in group for key in f.get('feature_keys', [])}
        facts = [{k:a.get(k) for k in ('id','object_id','feature_key','value','state','valid_at','unit')}
                 for a in snapshot['assertions'] if a['feature_key'] in keys][:16]
        questions = [{k:f.get(k) for k in ('id','code','message','feature_keys','blocks_generation')} for f in group]
        query = ' '.join(f.get('message','') for f in group)[:600]
        async def task(questions=questions, facts=facts, query=query):
            references = await asyncio.to_thread(knowledge.search, query, as_of=snapshot.get('application_date'),case_id=snapshot['id'],limit=3)
            refs = [{k:r.get(k) for k in ('source_id','version_id','title','url','authority','valid_from','text')} for r in references]
            for ref in refs:
                ref['text'] = (ref.get('text') or '')[:900]
            data = {'application_date':snapshot.get('application_date'),'questions':questions,'facts':facts,'references':refs}
            bundle = promptbook.load_prompt('judge',data,Guidance,input_model=GuidanceInput)
            doc = next((d for d in snapshot['documents'] if d.get('evidence_pages')),None)
            trace = promptbook.trace_context([(doc,doc['evidence_pages'][0])]) if doc else None
            result = await ai.ask_json(bundle.instructions,promptbook.PromptContent(bundle,[],trace),Guidance,snapshot['metrics'])
            allowed_findings={q['id'] for q in questions}
            allowed_assertions={a['id'] for a in facts}
            allowed_sources={r.get('source_id') for r in refs}
            return [s.model_dump() for s in result.suggestions if s.finding_id in allowed_findings
                    and set(s.assertion_ids)<=allowed_assertions and set(s.source_ids)<=allowed_sources]
        tasks.append(task())
    results = await asyncio.gather(*tasks,return_exceptions=True)
    snapshot['metrics']['guidance_tasks'] = len(tasks)
    snapshot['metrics']['guidance_failed_tasks'] = sum(isinstance(result,BaseException) for result in results)
    return [dict(row,type='AGENT_EVIDENCE_GUIDANCE',status='PROPOSED',requires_review=True)
            for result in results if isinstance(result,list) for row in result]
