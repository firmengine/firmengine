"""Loopback-only web application. Cases survive process restarts."""
from contextlib import asynccontextmanager
from urllib.parse import urlparse
import secrets
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from . import config
from .api import router, service
from .repository import RevisionConflict

def internal_token():
    path=config.RUNTIME/'internal-token'
    if not path.exists():
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(secrets.token_hex(32),encoding='ascii')
    return path.read_text(encoding='ascii').strip()

@asynccontextmanager
async def lifespan(app):
    runtime=service()
    internal_token()
    await runtime.start()
    try:
        yield
    finally:
        await runtime.stop()

app=FastAPI(title='Firm Engine · local case workspace',lifespan=lifespan)

@app.middleware('http')
async def local_boundary(request:Request,call_next):
    host=request.headers.get('host','').split(':')[0]
    if host not in ('127.0.0.1','localhost','testserver'):
        return JSONResponse({'detail':'Local access only'},status_code=403)
    origin=request.headers.get('origin')
    if origin and urlparse(origin).netloc!=request.headers.get('host'):
        return JSONResponse({'detail':'Cross-origin access blocked'},status_code=403)
    response=await call_next(request)
    response.headers['Cache-Control']='no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    return response

@app.exception_handler(RevisionConflict)
async def conflict(request,exc):
    return JSONResponse({'detail':str(exc)},status_code=409)

@app.exception_handler(ValueError)
async def invalid(request,exc):
    return JSONResponse({'detail':str(exc)},status_code=422)

app.include_router(router)
app.mount('/',StaticFiles(directory=config.ROOT/'static',html=True),name='ui')
