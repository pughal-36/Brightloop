"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { resetPasswordAction, type ActionState } from "@/app/actions/auth";
import { PasswordChecklist } from "@/components/auth/password-checklist";
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

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<
    ActionState<{ message: string }>,
    FormData
  >(resetPasswordAction, {});
  const [password, setPassword] = useState("");

  const isInvalidTokenError =
    state?.error?.toLowerCase().includes("invalid or expired") ||
    state?.fieldErrors?.token;

  if (isInvalidTokenError) {
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

  if (state?.success) {
    return (
      <Card className="w-full max-w-md text-center shadow-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            BrightLoop • Success
          </div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Password Reset Complete
          </CardTitle>
          <CardDescription>
            {state.data?.message || "Your password has been reset successfully."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All other active sessions have been signed out for your security. You may now sign in with your new password.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" className={buttonVariants({ variant: "default" })}>
            Sign In with New Password
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          BrightLoop • New Password
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Reset Your Password
        </CardTitle>
        <CardDescription>
          Enter a new secure password for your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          {state?.error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
            >
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="•••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isPending}
              aria-invalid={!!state?.fieldErrors?.password}
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-destructive">{state.fieldErrors.password}</p>
            )}
          </div>

          <PasswordChecklist password={password} />

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating password...
              </>
            ) : (
              "Set New Password"
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
  );
}

