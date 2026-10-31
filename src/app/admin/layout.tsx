import { redirect } from "next/navigation";
import { getSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import { logoutAction } from "@/app/actions/auth";
import { AdminSidebar } from "./admin-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";
import { env } from "@/server/env";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login?returnTo=/admin");
  }

  if (session.user.role === Role.CUSTOMER) {
    redirect("/forbidden");
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="w-56 lg:w-64 border-r bg-card flex flex-col justify-between shrink-0">
        <div>
          <div className="flex h-14 items-center border-b px-4 gap-2">
            <span className="font-bold text-lg tracking-tight text-primary">
              BrightLoop
            </span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              Ops
            </Badge>
          </div>
          <AdminSidebar userRole={session.user.role} />
        </div>

        {/* User Card & Logout */}
        <div className="border-t p-3 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-sm font-medium leading-none truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {session.user.email}
              </p>
            </div>
            <Badge
              variant={session.user.role === Role.ADMIN ? "default" : "secondary"}
              className="text-[10px] font-semibold uppercase tracking-wider ml-1"
            >
              {session.user.role}
            </Badge>
          </div>

          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign Out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl flex-1">{children}</div>
        {env.DEMO_MODE && (
          <footer className="border-t py-2 px-6 text-center text-xs text-muted-foreground font-mono bg-muted/30">
            DEMO_MODE • Server Render Time: {new Date().toISOString()} (Asia/Kolkata)
          </footer>
        )}
      </main>
    </div>
  );
}

