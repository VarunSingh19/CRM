import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { getCalendar } from "@/features/calendar/calendar.service";
export const GET = withUser(async ({ user }) => NextResponse.json(await getCalendar(user)));
