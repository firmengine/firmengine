import type { CaseData } from "./domain.ts";
import type { ExecutionSnapshot } from "./reactive-evaluation.ts";
import type { FormBindings } from "./form-mapping.ts";
import { FORM_CONTRACTS } from "./form-contracts.ts";
import { stableFormRowIds } from "./document-writer.ts";
import { commandHash } from "./case-command-contract.ts";

export type DocumentFieldBase={artifactId:string;artifactHash:string;formCode:string;fieldId:string;rowId:string|null;kind:"prose"|"layout";value:string;baseValueHash:string};
type GeneratedArtifact={id:string;hash:string;kind:string};
type WriterForm={artifactKind:string;formCode:string};

/** Builds edit authority only from the exact generated form, template contract, and stable source row IDs. */
export async function buildDocumentFieldBases(input:{data:CaseData;execution:ExecutionSnapshot;formResults:readonly WriterForm[];artifacts:readonly GeneratedArtifact[]}):Promise<DocumentFieldBase[]>{
  const bindings=input.execution.formBindings as FormBindings|undefined;if(!bindings)return [];
  const results:DocumentFieldBase[]=[];
  for(const artifact of input.artifacts){
    const form=input.formResults.find(item=>item.artifactKind===artifact.kind),contract=form?FORM_CONTRACTS[form.formCode]:undefined;if(!form||!contract)continue;
    for(const field of contract.fields){
      if(field.kind!=="prose"&&field.kind!=="layout")continue;
      const dot=field.token.indexOf(".");
      if(dot<0){const value=bindings.scalars[field.token];if(value===undefined)continue;const rowId=null,baseValueHash=await commandHash({artifactId:artifact.id,fieldId:field.token,rowId,value});results.push({artifactId:artifact.id,artifactHash:artifact.hash,formCode:form.formCode,fieldId:field.token,rowId,kind:field.kind,value,baseValueHash});continue;}
      const group=field.token.slice(0,dot),column=field.token.slice(dot+1),rows=bindings.rows[group]??[],ids=stableFormRowIds(group,input.data,input.execution,bindings);if(!ids)continue;
      for(let index=0;index<rows.length;index++){
        const rowId=ids[index],value=rows[index]?.[column];if(!rowId||value===undefined)continue;
        const baseValueHash=await commandHash({artifactId:artifact.id,fieldId:field.token,rowId,value});
        results.push({artifactId:artifact.id,artifactHash:artifact.hash,formCode:form.formCode,fieldId:field.token,rowId,kind:field.kind,value,baseValueHash});
      }
    }
  }
  return results;
}
