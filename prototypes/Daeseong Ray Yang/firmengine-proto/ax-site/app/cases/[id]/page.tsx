import Workspace from "../../../components/workspace";
export default async function CasePage({params}:{params:Promise<{id:string}>}){return <Workspace initialTab="overview" initialCaseId={(await params).id}/>;}
