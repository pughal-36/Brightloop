import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center shadow-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive">
            BrightLoop • 403
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Access Forbidden
          </CardTitle>
          <CardDescription>
            You do not have the required permissions to view or perform actions on this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you believe this is an error, please reach out to your administrator for access.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            Back to Home
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}

