import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const resolvedParams = await searchParams;

  return <LoginForm returnTo={resolvedParams.returnTo} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <Suspense
        fallback={
          <Card className="w-full max-w-md text-center shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Loading...
              </CardTitle>
            </CardHeader>
          </Card>
        }
      >
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
