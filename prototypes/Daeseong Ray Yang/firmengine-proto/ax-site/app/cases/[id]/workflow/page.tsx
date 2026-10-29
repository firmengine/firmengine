import CaseWorkflow from "../../../../components/case-workflow";

export default async function CaseWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  return <CaseWorkflow caseId={(await params).id} />;
}
