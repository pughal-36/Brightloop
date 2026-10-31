"use client";

import { Check, Circle } from "lucide-react";
import { checkPasswordRules } from "@/lib/password";

export function PasswordChecklist({ password }: { password: string }) {
  const rules = checkPasswordRules(password);

  const items = [
    { label: "At least 9 characters", passed: rules.minLength },
    { label: "At least one uppercase letter", passed: rules.hasUppercase },
    { label: "At least one lowercase letter", passed: rules.hasLowercase },
    { label: "At least one special character", passed: rules.hasSpecialChar },
  ];

  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5">
      <p className="font-medium text-foreground">Password requirements:</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-1.5 transition-colors ${
              item.passed
                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                : "text-muted-foreground"
            }`}
          >
            {item.passed ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Circle className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            )}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
