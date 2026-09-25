import { requireUser } from "@/lib/session";
import { listOfferings } from "@/features/catalog/catalog.service";
import { can } from "@/lib/rbac";
import { serialize } from "@/lib/serialize";
import CatalogView, { type OfferingRow } from "@/components/views/CatalogView";

export default async function CatalogPage() {
  const user = await requireUser();
  const rows = await listOfferings(user);
  return (
    <CatalogView
      rows={serialize(rows) as unknown as OfferingRow[]}
      editable={!!can(user.role, "catalog", "update")}
    />
  );
}
