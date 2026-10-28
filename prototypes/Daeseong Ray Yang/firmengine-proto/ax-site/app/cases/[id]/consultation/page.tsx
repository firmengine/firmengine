import ConsultationChecklist from "../../../../components/consultation-checklist";

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  return <ConsultationChecklist caseId={(await params).id} />;
}
