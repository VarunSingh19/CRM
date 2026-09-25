import DashboardPage from "@/components/pages/DashboardPage";

export default async function Page(
  { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  return <DashboardPage searchParams={await searchParams} />;
}
