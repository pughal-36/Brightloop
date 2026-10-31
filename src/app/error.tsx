"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error.message);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center shadow-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive">
            BrightLoop • Error
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Something went wrong
          </CardTitle>
          <CardDescription>
            An unexpected error occurred while processing your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            An unexpected issue occurred. You can retry the action or return to the main dashboard.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => reset()}>
            Try Again
          </Button>
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Back to Home
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}

