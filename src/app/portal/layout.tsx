import { redirect } from "next/navigation";
import { getSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?returnTo=/portal");
  }

  if (session.user.role !== Role.CUSTOMER) {
    redirect("/forbidden");
  }

  return <>{children}</>;
}
