"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Router,
  Package,
  Ticket,
  CreditCard,
  Activity,
  Settings,
  Wifi,
  Building2,
  Users,
  Palette,
  Network,
  DollarSignIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { appName } from "@/lib/utils";

const navMain = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Routers", href: "/dashboard/routers", icon: Router },
  { label: "Transactions", href: "/dashboard/transactions", icon: CreditCard },
  { label: "Sessions", href: "/dashboard/sessions", icon: Activity },
  { label: "Invoices", href: "/dashboard/invoices", icon: DollarSignIcon },
];

// Shown only to tenant admins/operators (not super admin)
const navTenantConfig = [
  { label: "Portal Design", href: "/dashboard/portal", icon: Palette },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

// Shown only to super admin
const navAdmin = [
  { label: "Tenants", href: "/dashboard/tenants", icon: Building2 },
  { label: "Users", href: "/dashboard/users", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, isRole } = useAuth();
  const isSuperAdmin = isRole("super_admin");

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                  <img className="h-8 w-8 text-primary-foreground" src={"../icon.svg"} />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-sidebar-foreground">{appName}</span>
                  <span className="text-xs text-sidebar-foreground/60 truncate max-w-[120px]">
                    {user?.tenantId ? "ISP Dashboard" : "Super Admin"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarMenu>
            {(isSuperAdmin ? navMain : navMain.toSpliced(2, 0, { label: "Packages", href: "/dashboard/packages", icon: Package },
              { label: "Vouchers", href: "/dashboard/vouchers", icon: Ticket })).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarGroup>

        {!isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Configuration</SidebarGroupLabel>
            <SidebarMenu>
              {navTenantConfig.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarMenu>
              {navAdmin.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/*  <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
              <span className="mt-1 inline-block rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                {user?.role?.replace("_", " ")}
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter> */}
    </Sidebar>
  );
}
