"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, Settings, Bell, CheckCheck, WifiOff, Router, CreditCard, Package, AlertCircle, SettingsIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { Notification } from "@/lib/types";


const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/routers": "Routers",
  "/dashboard/packages": "Packages",
  "/dashboard/vouchers": "Vouchers",
  "/dashboard/transactions": "Transactions",
  "/dashboard/sessions": "Sessions",
  "/dashboard/tenants": "Tenants",
  "/dashboard/users": "Users",
  "/dashboard/settings": "Settings",
  "/dashboard/portal": "Portal Design",
};

const notificationIconMap = {
  router_offline: <WifiOff />,
  router_online: <Router />,
  user_joined: <Package />,
  session_expired: <AlertCircle />,
  payment_success: <CreditCard />,
  payment_failed: <AlertCircle />,
  setup_complete: <SettingsIcon/>
}

export function AdminHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const load = useCallback(async () => {
      try {
        const { data } = await apiClient.notifications.list();
        setNotifications(data);
      } catch {
        setNotifications([]);
      }
    }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  async function markAllRead() {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    await apiClient.notifications.markAllRead();
    load();
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const roleLabel = user?.role?.replace(/_/g, " ") ?? "";

  // Derive page title from pathname
  const pageTitle = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([key]) => pathname?.startsWith(key))?.[1] ?? "Dashboard";

   useEffect(() => { load(); }, [load]);
   
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />

      {/* Page title */}
      <span className="text-sm font-semibold text-foreground hidden sm:block">{pageTitle}</span>

      <div className="flex-1" />

      {/* Notifications */}
      <Popover open={notifOpen} onOpenChange={setNotifOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 relative rounded-full">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0 shadow-lg" sideOffset={8}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
          <ScrollArea className="h-[360px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {notifications.map((n) => (
                  <button
                    key={n._id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 w-full",
                      !n.read && "bg-primary/[0.03]"
                    )}
                    onClick={() => setNotifications(ns => ns.map(x => x._id === n._id ? { ...x, read: true } : x))}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                      {notificationIconMap[n.type] || <Bell className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={cn("text-sm truncate", !n.read ? "font-semibold text-foreground" : "font-normal text-foreground/80")}>{n.title}</p>
                        {!n.read && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">{n.createdAt}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex flex-col items-end gap-0 leading-none">
              <span className="text-sm font-semibold text-foreground">{user?.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{roleLabel}</span>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm">{user?.name}</span>
              <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
            </div>
          </DropdownMenuLabel>
          {/*<DropdownMenuSeparator />
           <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem> */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
