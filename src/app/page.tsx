import { redirect } from "next/navigation";
import { getSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === Role.ADMIN || session.user.role === Role.STAFF) {
    redirect("/admin");
  }

  if (session.user.role === Role.CUSTOMER) {
    redirect("/portal");
  }

  redirect("/login");
}
