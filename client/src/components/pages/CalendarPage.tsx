import { requireUser } from "@/lib/session";
import { getCalendar } from "@/features/calendar/calendar.service";
import { serialize } from "@/lib/serialize";
import CalendarView, { type CalendarCard } from "@/components/views/CalendarView";

export default async function CalendarPage() {
  const user = await requireUser();
  const { cards } = await getCalendar(user);
  return (
    <CalendarView
      cards={serialize(cards) as unknown as CalendarCard[]}
      basePath={`/${user.role}/projects`}
    />
  );
}
