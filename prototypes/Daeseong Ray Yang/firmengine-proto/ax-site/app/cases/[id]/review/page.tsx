import Workspace from "../../../../components/workspace";
export default async function ReviewPage({params}:{params:Promise<{id:string}>}){return <Workspace initialTab="review" initialCaseId={(await params).id}/>;}
