import Workspace from "../../../../components/workspace";
export default async function DocumentsPage({params}:{params:Promise<{id:string}>}){return <Workspace initialTab="documents" initialCaseId={(await params).id}/>;}
