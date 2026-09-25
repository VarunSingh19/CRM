import ProjectEditorPage from "@/components/pages/ProjectEditorPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectEditorPage id={id} />;
}
