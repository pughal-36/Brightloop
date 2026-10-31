"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { loginAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
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

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    loginAction,
    {}
  );

  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          BrightLoop • Sign In
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Welcome Back
        </CardTitle>
        <CardDescription>
          Enter your credentials to access your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.locked ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
          >
            <Lock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Account Temporarily Locked</p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {state.error || "Too many failed login attempts. Please try again in 15 minutes."}
              </p>
            </div>
          </div>
        ) : state?.error ? (
          <div
            role="alert"
            className="mb-4 rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            {state.error}
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="returnTo" value={returnTo ?? ""} />

          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              disabled={isPending || !!state?.locked}
              aria-invalid={!!state?.fieldErrors?.email}
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="•••••••••"
              required
              disabled={isPending || !!state?.locked}
              aria-invalid={!!state?.fieldErrors?.password}
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-destructive">{state.fieldErrors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !!state?.locked}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        <span>Don&apos;t have an account? </span>
        <Link href="/signup" className="ml-1 font-medium text-primary underline underline-offset-4">
          Sign up
        </Link>
      </CardFooter>
    </Card>
  );
}
