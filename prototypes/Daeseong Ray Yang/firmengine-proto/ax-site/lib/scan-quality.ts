/** Deterministic, non-generative scan rescue helpers. Quality hints can request
 * another look, but never mark evidence as readable or correct. */
export type NormalizedBox=[number,number,number,number];
export type RescueReason="field_disagreement"|"omitted_rows"|"unreadable"|"incomplete_extraction"|"classification_unknown";
export type RescueRecipeVersion="neutral-v1"|"luma-levels-v2";
export const CLASSIFICATION_RESCUE_RECIPE:RescueRecipeVersion="luma-levels-v2";
export interface RescueSpec {reason:RescueReason;variant:string;bbox:NormalizedBox;rotation:number;contrast:number;tone:"neutral"|"luma-levels-v2";recipeVersion:RescueRecipeVersion;sourceHash:string;baseImageHash:string;}
export const MAX_RESCUE_VARIANTS=4;
const LUMA_BLACK=176,LUMA_WHITE=252,LEVEL_BLACK=32,LEVEL_WHITE=240;
/** Shared fixed monotone grayscale mapping; caps amplification at 208/76 ~= 2.74x. */
export function mapLumaLevelsValue(luma:number):number{
  return Math.max(LEVEL_BLACK,Math.min(LEVEL_WHITE,Math.floor(LEVEL_BLACK+(luma-LUMA_BLACK)*(LEVEL_WHITE-LEVEL_BLACK)/(LUMA_WHITE-LUMA_BLACK)+.5)));
}
export function mapLumaLevelsPixel(r:number,g:number,b:number):[number,number,number]{
  // Same fixed-point BT.601 transform used by Pillow Image.convert("L").
  const luma=(19595*r+38470*g+7471*b+32768)>>16;
  const mapped=mapLumaLevelsValue(luma);
  return [mapped,mapped,mapped];
}
export function validBox(value:unknown):value is NormalizedBox {
  return Array.isArray(value)&&value.length===4&&value.every(x=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=1)&&value[0]<value[2]&&value[1]<value[3];
}
export function expandBox(box:NormalizedBox,pad=.035):NormalizedBox {
  return [Math.max(0,box[0]-pad),Math.max(0,box[1]-pad),Math.min(1,box[2]+pad),Math.min(1,box[3]+pad)];
}
export function rescueSpecs(args:{reason:RescueReason;boxes:unknown[];sourceHash:string;baseImageHash:string;recipeVersion?:RescueRecipeVersion}):RescueSpec[]{
  const valid=args.boxes.filter(validBox).slice(0,MAX_RESCUE_VARIANTS);
  // For row omission, preserve broad table context. A full-width middle band is
  // deliberately conservative because field boxes cannot identify missing rows.
  const boxes:NormalizedBox[]=args.reason==="omitted_rows"?[[0,.08,1,.96]]:valid.length?valid:[[.03,.12,.97,.9]];
  const recipeVersion=args.reason==="classification_unknown"&&args.recipeVersion===CLASSIFICATION_RESCUE_RECIPE?CLASSIFICATION_RESCUE_RECIPE:"neutral-v1";
  if(args.reason==="incomplete_extraction")return [0,1,2,3].map(index=>({reason:args.reason,variant:`rescue-${args.reason}-${index+1}`,bbox:[0,index*.25,1,Math.min(1,(index+1)*.25+.025)] as NormalizedBox,rotation:0,contrast:1,tone:"neutral" as const,recipeVersion:"neutral-v1" as const,sourceHash:args.sourceHash,baseImageHash:args.baseImageHash}));
  if(args.reason==="classification_unknown")return [
    {bbox:[0,0,1,.45] as NormalizedBox,rotation:0},
    {bbox:[0,0,1,1] as NormalizedBox,rotation:90},
  ].map((spec,index)=>({...spec,reason:args.reason,variant:`rescue-${args.reason}-${index+1}`,contrast:1,tone:recipeVersion===CLASSIFICATION_RESCUE_RECIPE&&index===1?"luma-levels-v2" as const:"neutral" as const,recipeVersion,sourceHash:args.sourceHash,baseImageHash:args.baseImageHash}));
  if(args.reason==="unreadable"){
    // Keep every candidate inside the upload API's [-180, 180] contract.
    const box=expandBox(boxes[0]);return [0,90,180,-90].map((rotation,index)=>({reason:args.reason,variant:`rescue-${args.reason}-${index+1}`,bbox:box,rotation,contrast:1,tone:"neutral" as const,recipeVersion:"neutral-v1" as const,sourceHash:args.sourceHash,baseImageHash:args.baseImageHash}));
  }
  const unique=new Map<string,NormalizedBox>();for(const box of boxes)unique.set(box.join(","),expandBox(box));
  return [...unique.values()].slice(0,MAX_RESCUE_VARIANTS).map((bbox,index)=>({reason:args.reason,variant:`rescue-${args.reason}-${index+1}`,bbox,rotation:0,contrast:1,tone:"neutral" as const,recipeVersion:"neutral-v1" as const,sourceHash:args.sourceHash,baseImageHash:args.baseImageHash}));
}
export function transformCanvas(source:CanvasImageSource,bbox:NormalizedBox,rotation:number,contrast=1,tone:"neutral"|"luma-levels-v2"="neutral"):HTMLCanvasElement{
  const dims=source instanceof HTMLVideoElement?{width:source.videoWidth,height:source.videoHeight}:source instanceof HTMLImageElement?{width:source.naturalWidth,height:source.naturalHeight}:source instanceof HTMLCanvasElement?{width:source.width,height:source.height}:{width:(source as ImageBitmap).width,height:(source as ImageBitmap).height};
  const sx=Math.max(0,Math.min(dims.width-1,Math.floor(bbox[0]*dims.width))),sy=Math.max(0,Math.min(dims.height-1,Math.floor(bbox[1]*dims.height))),sw=Math.max(1,Math.min(dims.width-sx,Math.ceil((bbox[2]-bbox[0])*dims.width))),sh=Math.max(1,Math.min(dims.height-sy,Math.ceil((bbox[3]-bbox[1])*dims.height)));
  const radians=rotation*Math.PI/180,cos=Math.abs(Math.cos(radians)),sin=Math.abs(Math.sin(radians)),rawWidth=Math.ceil(sw*cos+sh*sin),rawHeight=Math.ceil(sw*sin+sh*cos),scale=Math.min(1,3600/Math.max(rawWidth,rawHeight),Math.sqrt(12_000_000/(rawWidth*rawHeight))),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.floor(rawWidth*scale));canvas.height=Math.max(1,Math.floor(rawHeight*scale));
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("페이지 후보 이미지를 만들 수 없습니다.");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.scale(scale,scale);ctx.rotate(radians);ctx.filter=`contrast(${Math.max(.75,Math.min(1.35,contrast))})`;ctx.drawImage(source,sx,sy,sw,sh,-sw/2,-sh/2,sw,sh);ctx.filter="none";
  if(tone==="luma-levels-v2"){
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
    // Reuse a tiny lookup table instead of allocating an RGB array per pixel.
    const levels=Uint8Array.from({length:256},(_,value)=>mapLumaLevelsValue(value));
    for(let i=0;i<data.length;i+=4){const luma=(19595*data[i]+38470*data[i+1]+7471*data[i+2]+32768)>>16,mapped=levels[luma];data[i]=mapped;data[i+1]=mapped;data[i+2]=mapped;}
    ctx.putImageData(pixels,0,0);
  }
  return canvas;
}
export async function canvasJpeg(canvas:HTMLCanvasElement):Promise<Blob>{return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("페이지 후보 이미지 변환에 실패했습니다.")),"image/jpeg",.92));}
