"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Role } from "@/generated/prisma/enums";
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Layers,
  UserCog,
  FileCheck2,
  FileText,
  CreditCard,
  Percent,
} from "lucide-react";

interface AdminSidebarProps {
  userRole: Role;
}

export function AdminSidebar({ userRole }: AdminSidebarProps) {
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    { name: "Customers", href: "/admin/customers", icon: Users },
    { name: "Products", href: "/admin/products", icon: Package },
    { name: "Taxes", href: "/admin/taxes", icon: Receipt },
    { name: "Plans", href: "/admin/plans", icon: Layers },
    ...(userRole === Role.ADMIN
      ? [{ name: "Staff", href: "/admin/staff", icon: UserCog }]
      : []),
    { name: "Subscriptions", href: "/admin/subscriptions", icon: FileCheck2 },
    { name: "Invoices", href: "/admin/invoices", icon: FileText },
    { name: "Billing", href: "/admin/billing", icon: CreditCard },
    { name: "Discounts", href: "/admin/discounts", icon: Percent },
  ];

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="mr-3 h-4 w-4 shrink-0" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

