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

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center shadow-md">
        <CardHeader className="space-y-2">
          <div className="mx-auto inline-flex items-center justify-center rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            BrightLoop • 404
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Page Not Found
          </CardTitle>
          <CardDescription>
            The page you are looking for does not exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please check the URL or head back to the main BrightLoop dashboard.
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

