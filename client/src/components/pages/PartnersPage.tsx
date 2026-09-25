import { requireUser } from "@/lib/session";
import { listPartners } from "@/features/partners/partner.service";
import { listContacts } from "@/features/contacts/contact.service";
import { can } from "@/lib/rbac";
import { serialize } from "@/lib/serialize";
import PartnersView, { type PartnerRow } from "@/components/views/PartnersView";
import type { ContactRow } from "@/components/project/types";

export default async function PartnersPage() {
  const user = await requireUser();
  const [rows, contacts] = await Promise.all([listPartners(user), listContacts(user)]);
  return (
    <PartnersView
      rows={serialize(rows) as unknown as PartnerRow[]}
      contacts={serialize(contacts) as unknown as ContactRow[]}
      canCreate={!!can(user.role, "partner", "create")}
      canEdit={!!can(user.role, "partner", "update")}
    />
  );
}
