import { redirect } from "next/navigation";
import { getSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import { logoutAction } from "@/app/actions/auth";
import { PortalNav } from "./portal-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";
import { env } from "@/server/env";

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

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b bg-card shadow-xs">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-primary">
                BrightLoop
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                Portal
              </Badge>
            </div>
            <div className="hidden md:block">
              <PortalNav />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-semibold leading-none">{session.user.name}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{session.user.email}</span>
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="border-t px-4 py-2 md:hidden overflow-x-auto">
          <PortalNav />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-6">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6">{children}</div>
      </main>

      {/* Footer */}
      {env.DEMO_MODE && (
        <footer className="border-t py-2 px-6 text-center text-xs text-muted-foreground font-mono bg-muted/30">
          DEMO_MODE • Server Render Time: {new Date().toISOString()} (Asia/Kolkata)
        </footer>
      )}
    </div>
  );
}
