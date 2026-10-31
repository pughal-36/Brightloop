"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button
      type="button"
      size="sm"
      onClick={() => window.print()}
      className="gap-1.5"
    >
      <Printer className="h-4 w-4" />
      Print / Save PDF
    </Button>
  );
}

