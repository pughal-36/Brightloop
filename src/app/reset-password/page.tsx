import { Suspense } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

async function ResetPasswordContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const resolvedParams = await searchParams;
  const token = resolvedParams.token?.trim();

  if (!token) {
    return (
      <Card className="w-full max-w-md text-center shadow-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive">
            BrightLoop • Invalid Link
          </div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Invalid or Expired Link
          </CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired. Password reset links are valid for 30 minutes and can only be used once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please request a new password reset link to continue.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-3">
          <Link
            href="/forgot-password"
            className={buttonVariants({ variant: "default" })}
          >
            Request New Link
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
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
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
