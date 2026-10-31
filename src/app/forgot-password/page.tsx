"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { forgotPasswordAction, type ActionState } from "@/app/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState<
    ActionState<{ message: string }>,
    FormData
  >(forgotPasswordAction, {});

  if (state?.success) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center p-6">
        <Card className="w-full max-w-md text-center shadow-md">
          <CardHeader className="space-y-2">
            <div className="mx-auto inline-flex items-center justify-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              BrightLoop • Instructions Sent
            </div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
              <MailCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Check Your Email
            </CardTitle>
            <CardDescription>
              {state.data?.message ||
                "If an account exists with this email, a password reset link has been sent."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please check your inbox and follow the instructions in the email. The link will expire in 30 minutes.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            BrightLoop • Password Reset
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Forgot Password
          </CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
              >
                {state.error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={isPending}
                aria-invalid={!!state?.fieldErrors?.email}
              />
              {state?.fieldErrors?.email && (
                <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary underline underline-offset-4">
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}

