import AuditPage from "@/components/pages/AuditPage";

export default async function Page(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  return <AuditPage searchParams={await searchParams} />;
}
