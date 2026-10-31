"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import {
  LayoutDashboard,
  FileCheck2,
  FileText,
  CreditCard,
} from "lucide-react";

export function PortalNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/portal", icon: LayoutDashboard, exact: true },
    { name: "My Subscriptions", href: "/portal/subscriptions", icon: FileCheck2 },
    { name: "My Invoices", href: "/portal/invoices", icon: FileText },
    { name: "Payment History", href: "/portal/payments", icon: CreditCard },
  ];

  return (
    <nav className="flex items-center space-x-1 sm:space-x-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
