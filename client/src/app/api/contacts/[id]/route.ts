import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { removeContact } from "@/features/contacts/contact.service";

export const DELETE = withUser(async ({ user, params }) =>
  NextResponse.json(await removeContact(user, params.id)));
