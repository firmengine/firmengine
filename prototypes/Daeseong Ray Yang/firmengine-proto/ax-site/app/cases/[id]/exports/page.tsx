import Workspace from "../../../../components/workspace";
export default async function ExportsPage({params}:{params:Promise<{id:string}>}){return <Workspace initialTab="exports" initialCaseId={(await params).id}/>;}
