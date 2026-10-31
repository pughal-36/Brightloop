import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function AdminContent() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login?returnTo=/admin");
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center shadow-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            BrightLoop • Administration
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Admin Dashboard
          </CardTitle>
          <CardDescription>
            Welcome, {session.user.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Role: <span className="font-semibold uppercase">{session.user.role}</span>
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              Sign Out
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[80vh] items-center justify-center p-6">
          <Card className="w-full max-w-md text-center shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Loading...
              </CardTitle>
            </CardHeader>
          </Card>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
