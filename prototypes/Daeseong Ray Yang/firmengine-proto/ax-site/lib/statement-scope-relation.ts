/** Strict wire format for an independently verified authored-statement group. */
export type StatementScopeRelation = {
  version: 1;
  openingQuote: string;
  closingQuote: string;
  signatureQuote: string;
  members: { quote: string }[];
};

const quoteKey=(value:string)=>value.normalize("NFKC").replace(/\s+/g," ").trim().toLocaleLowerCase();
const isPlainObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const hasExactKeys=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

/** Parse only the v1 JSON string contract. Malformed or extended variants fail closed. */
export function parseStatementScopeRelation(value:unknown):StatementScopeRelation|null{
  if(typeof value!=="string"||value.length>20_000)return null;
  let parsed:unknown;try{parsed=JSON.parse(value);}catch{return null;}
  if(!isPlainObject(parsed)||!hasExactKeys(parsed,["version","openingQuote","closingQuote","signatureQuote","members"])||parsed.version!==1)return null;
  const strings=[parsed.openingQuote,parsed.closingQuote,parsed.signatureQuote];
  if(strings.some(item=>typeof item!=="string"||item.length===0||item.trim()!==item||item.length>4_000))return null;
  if(!Array.isArray(parsed.members)||parsed.members.length===0||parsed.members.length>64)return null;
  const members:{quote:string}[]=[];
  for(const item of parsed.members){
    if(!isPlainObject(item)||!hasExactKeys(item,["quote"])||typeof item.quote!=="string"||!item.quote.trim()||item.quote.trim()!==item.quote||item.quote.length>4_000)return null;
    members.push({quote:item.quote});
  }
  const memberKeys=members.map(item=>quoteKey(item.quote));
  if(memberKeys.some(key=>!key)||new Set(memberKeys).size!==memberKeys.length)return null;
  return {version:1,openingQuote:parsed.openingQuote as string,closingQuote:parsed.closingQuote as string,signatureQuote:parsed.signatureQuote as string,members};
}

export function sameSourceQuote(a:string,b:string):boolean{return quoteKey(a)===quoteKey(b);}

/** Count normalized quote occurrences. Used only when the saved page text exists. */
export function sourceQuoteOccurrenceCount(pageText:string,quote:string):number{
  const page=pageText.normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase();
  const needle=quote.normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase();
  if(!needle)return 0;
  let count=0,from=0;while((from=page.indexOf(needle,from))!==-1){count++;from++;}
  return count;
}
