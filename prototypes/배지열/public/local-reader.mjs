let pdfModulePromise;
let ocrModulePromise;

function pdfModule(){return pdfModulePromise??=(async()=>{const pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';return pdfjs;})();}

async function koreanWorker(logger){
 ocrModulePromise??=import('/vendor/tesseract.esm.min.js');
 const {createWorker}= (await ocrModulePromise).default;
 return createWorker('kor',1,{workerPath:'/vendor/tesseract-worker.min.js',corePath:'/vendor/tesseract-core',langPath:'/vendor/tessdata/kor/4.0.0',gzip:true,logger});
}

function textFromItems(items){
 const rows=[];
 for(const item of items){const value=String(item.str||'').trim();if(!value)continue;const y=Number(item.transform?.[5]||0);let row=rows.findLast(x=>Math.abs(x.y-y)<2.5);if(!row){row={y,parts:[]};rows.push(row);}row.parts.push({x:Number(item.transform?.[4]||0),value});}
 return rows.sort((a,b)=>b.y-a.y).map(row=>row.parts.sort((a,b)=>a.x-b.x).map(x=>x.value).join(' ')).join('\n').trim();
}
function pageNumbersIn(range,total){if(!range)return Array.from({length:total},(_,i)=>i+1);const pages=new Set();for(const match of String(range).matchAll(/(\d+)\s*(?:[-–—]\s*(\d+))?/g)){const start=Number(match[1]),end=Number(match[2]||match[1]);for(let page=start;page<=Math.min(end,total);page++)if(page>0)pages.add(page);}return pages.size?[...pages].sort((a,b)=>a-b):Array.from({length:total},(_,i)=>i+1);}

async function recognizeCanvas(worker,page,scale=1.7){
 const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 await page.render({canvasContext:canvas.getContext('2d',{willReadFrequently:true}),viewport}).promise;
 try{return await worker.recognize(canvas);}finally{canvas.width=canvas.height=0;}
}

export function createLocalReader(onProgress=()=>{}){
 let workerPromise=null,stopped=false,currentProgress=null;
 const worker=()=>workerPromise??=(koreanWorker(message=>{if(currentProgress)currentProgress({phase:`한글 OCR ${Math.round((message.progress||0)*100)}%`,detail:'현재 쪽을 읽는 중'});}));
 return {
  async read(record,fileIndex,totalFiles,pageRange=''){
   const pages=[];
   const progress=(page,total,phase,detail='')=>{if(typeof page==='object'){onProgress({...progress.meta,...page});return;}onProgress({fileIndex,totalFiles,fileName:record.name,page,total,phase,detail});};
   progress.meta={fileIndex,totalFiles,fileName:record.name,page:1,total:record.type==='application/pdf'?0:1};currentProgress=progress;
   const report=(page,total,phase,detail='')=>{progress.meta={fileIndex,totalFiles,fileName:record.name,page,total};progress(page,total,phase,detail);};
   if(record.type==='application/pdf'){
    const pdfjs=await pdfModule();const task=pdfjs.getDocument({data:new Uint8Array(await record.blob.arrayBuffer()),cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/',isEvalSupported:false});
    task.onPassword=()=>{throw Error('암호가 설정된 PDF입니다. 암호를 해제한 파일을 첨부하세요.');};
    const pdf=await task.promise,pageNumbers=pageNumbersIn(pageRange,pdf.numPages);
    for(let pageIndex=0;pageIndex<pageNumbers.length;pageIndex++){
     if(stopped)throw Error('처리가 중단됐습니다.');
     const pageNo=pageNumbers[pageIndex];report(pageIndex+1,pageNumbers.length,'텍스트 확인',`원문 ${pageNo}쪽`);const page=await pdf.getPage(pageNo);let text=textFromItems((await page.getTextContent()).items),confidence=100,method='PDF 텍스트';
     if(text.replace(/\s/g,'').length<45){
      report(pageIndex+1,pageNumbers.length,'한글 OCR 준비',`원문 ${pageNo}쪽`);const ocr=await worker();
      const result=await recognizeCanvas(ocr,page);text=String(result.data.text||'').trim();confidence=Math.round(result.data.confidence||0);method='로컬 한글 OCR';
     }
     pages.push({page:pageNo,text,confidence,method});report(pageIndex+1,pageNumbers.length,'페이지 완료',`원문 ${pageNo}쪽 · ${method} · ${text.length}자`);
    }
    await task.destroy();
   }else{
    report(1,1,'한글 OCR 준비');const ocr=await worker(),url=URL.createObjectURL(record.blob);
    try{const result=await ocr.recognize(url);pages.push({page:1,text:String(result.data.text||'').trim(),confidence:Math.round(result.data.confidence||0),method:'로컬 한글 OCR'});}
    finally{URL.revokeObjectURL(url);}
    report(1,1,'페이지 완료',`로컬 한글 OCR · ${pages[0].text.length}자`);
   }
   return pages;
  },
  stop(){stopped=true;},
  async close(){stopped=true;if(workerPromise){const instance=await workerPromise.catch(()=>null);await instance?.terminate().catch(()=>{});workerPromise=null;}}
 };
}
