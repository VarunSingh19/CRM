import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { listContacts } from "@/features/contacts/contact.service";

export const GET = withUser(async ({ user }) => NextResponse.json(await listContacts(user)));
