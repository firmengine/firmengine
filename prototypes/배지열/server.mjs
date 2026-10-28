import http from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('./public/',import.meta.url);
const allowed={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/domain.mjs':'domain.mjs','/catalog.mjs':'catalog.mjs','/review.mjs':'review.mjs','/local-analysis.mjs':'local-analysis.mjs','/local-reader.mjs':'local-reader.mjs','/consultations.mjs':'consultations.mjs','/style.css':'style.css','/vendor/pdf.mjs':'../node_modules/pdfjs-dist/legacy/build/pdf.min.mjs','/vendor/pdf.worker.mjs':'../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs','/vendor/tesseract.esm.min.js':'../node_modules/tesseract.js/dist/tesseract.esm.min.js','/vendor/tesseract-worker.min.js':'../node_modules/tesseract.js/dist/worker.min.js','/vendor/tessdata/kor/4.0.0/kor.traineddata.gz':'../node_modules/@tesseract.js-data/kor/4.0.0/kor.traineddata.gz'};
http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const asset=path.match(/^\/vendor\/(cmaps|standard_fonts|wasm)\/([A-Za-z0-9_.-]+)$/);
 const core=path.match(/^\/vendor\/tesseract-core\/(tesseract-core(?:-[a-z]+)*\.wasm(?:\.js)?)$/);
 const file=allowed[path]||(asset&&!asset[2].includes('..')?`../node_modules/pdfjs-dist/${asset[1]}/${asset[2]}`:core?`../node_modules/tesseract.js-core/${core[1]}`:null);
 if(!file){res.writeHead(404);return res.end('Not found');}
 try{const data=await readFile(new URL(file,root));const mime=file.endsWith('.css')?'text/css':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.gz')?'application/gzip':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(500);res.end('Unable to load page');}
}).listen(Number(process.env.PORT||8092),'127.0.0.1',()=>console.log('빚오프 배지열 플랫폼: http://127.0.0.1:'+(process.env.PORT||8092)));
