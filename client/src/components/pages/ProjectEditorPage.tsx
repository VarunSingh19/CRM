import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProject } from "@/features/projects/project.service";
import { listOfferings } from "@/features/catalog/catalog.service";
import { listPartners } from "@/features/partners/partner.service";
import { listContacts } from "@/features/contacts/contact.service";
import { listLineItems } from "@/features/line-items/line-item.service";
import { listAssignableUsers } from "@/features/users/user.service";
import { can } from "@/lib/rbac";
import { serialize } from "@/lib/serialize";
import ProjectEditor from "@/components/views/ProjectEditor";
import type { ContactRow, Item, Offering, PartnerRow, StaffRow } from "@/components/project/types";

/**
 * Every dependency is fetched in parallel on the server and shipped inside the
 * HTML. The old editor made three sequential browser requests before it could
 * paint anything.
 */
export default async function ProjectEditorPage({ id }: { id: string }) {
  const user = await requireUser();

  const canReadPartners = !!can(user.role, "partner", "read");
  const [record, offerings, partners, contacts, items, staff] = await Promise.all([
    getProject(user, id),
    listOfferings(user),
    canReadPartners ? listPartners(user) : Promise.resolve([]),
    canReadPartners ? listContacts(user) : Promise.resolve([]),
    listLineItems(user, id),
    listAssignableUsers(user),
  ]);

  if (!record) notFound();

  return (
    <ProjectEditor
      id={id}
      role={user.role}
      initialProject={serialize(record.project) as Record<string, unknown>}
      initialItems={serialize(items) as unknown as Item[]}
      offerings={serialize(offerings) as unknown as Offering[]}
      initialPartners={serialize(partners) as unknown as PartnerRow[]}
      initialContacts={serialize(contacts) as unknown as ContactRow[]}
      staff={serialize(staff) as unknown as StaffRow[]}
      canEditProject={user.role !== "ops"}
    />
  );
}
