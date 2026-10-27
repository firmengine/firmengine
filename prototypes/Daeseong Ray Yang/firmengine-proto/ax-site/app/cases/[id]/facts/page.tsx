import Workspace from "../../../../components/workspace";
export default async function FactsPage({params}:{params:Promise<{id:string}>}){return <Workspace initialTab="facts" initialCaseId={(await params).id}/>;}
