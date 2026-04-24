import type {
  User,
  TenantPortalSettings,
  RouterDevice,
  Package,
  Voucher,
  Transaction,
  Peer,
  Notification,
  Tenant,
  Invoice,
  HotspotSession,
  GatewayConfig,
  ReportSummary,
  PPPoEUser,
} from "@/lib/types";

export const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4010/v1";

// Token storage keys
const TOKEN_KEY = "netbill_token";
const REMEMBER_KEY = "netbill_remember";

/**
 * Secure token management using sessionStorage by default,
 * with localStorage option for "remember me" functionality.
 *
 * Security best practices:
 * - Tokens stored in memory as primary source (most secure)
 * - sessionStorage used for tab persistence (cleared when browser closes)
 * - localStorage only used when "remember me" is explicitly chosen
 * - Automatic token refresh handled server-side via JWT expiry
 */
class TokenManager {
  private memoryToken: string | null = null;
  private initialized = false;

  private initialize(): void {
    // Only initialize once, and only on client-side
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.memoryToken = this.getStoredToken();
  }

  private getStoredToken(): string | null {
    if (typeof window === "undefined") return null;

    // Check if user chose "remember me" - use localStorage
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered === "true") {
      return localStorage.getItem(TOKEN_KEY);
    }
    // Otherwise use sessionStorage (cleared when browser closes)
    return sessionStorage.getItem(TOKEN_KEY);
  }

  getToken(): string | null {
    // Lazy initialization - ensures we're on client-side
    this.initialize();
    return this.memoryToken;
  }

  setToken(token: string | null, rememberMe: boolean = false): void {
    this.memoryToken = token;
    this.initialized = true; // Mark as initialized so getToken doesn't re-read from storage

    if (typeof window === "undefined") return;

    if (token === null) {
      // Clear from both storages
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REMEMBER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } else if (rememberMe) {
      // Store in localStorage for persistence across browser sessions
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_KEY, "true");
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      // Store in sessionStorage for current session only (more secure)
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }
  }

  isRemembered(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(REMEMBER_KEY) === "true";
  }
}

const tokenManager = new TokenManager();

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenManager.getToken();

  const headers: Record<string, string> = {
    ...(options.body && typeof options.body === "string"
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Handle 401 unauthorized - clear token and redirect to login
    if (res.status === 401) {
      tokenManager.setToken(null);
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes("/login")
      ) {
        window.location.href = "/login";
      }
    }
    throw new Error(data?.error ?? data?.message ?? "Request failed");
  }

  return data;
}

export const apiClient = {
  setToken(token: string | null, rememberMe: boolean = false) {
    tokenManager.setToken(token, rememberMe);
  },

  getToken() {
    return tokenManager.getToken();
  },

  isRemembered() {
    return tokenManager.isRemembered();
  },

  auth: {
    login: async (
      email: string,
      password: string,
      rememberMe: boolean = false,
    ) => {
      const { data } = await req<{ data: { token: string; user: User } }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password, rememberMe }),
        },
      );
      // Store token with remember preference
      tokenManager.setToken(data.token, rememberMe);
      return data;
    },

    me: async (): Promise<User> => {
      const res = await req<{ data: { user: User } }>("/auth/me");
      return res.data.user;
    },

    logout: () => {
      tokenManager.setToken(null);
    },

    updateProfile: (data: {
      name?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    }) =>
      req<{ user: User }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  dashboard: {
    getStats: () =>
      req<{
        routers: any;
        vouchers: any;
        packages: any;
        payments: any;
        sessions: any;
      }>("/dashboard"),
    getReports: (data: { startDate: string; endDate: string }) =>
      req<{ payment: ReportSummary; session: ReportSummary }>(
        `/dashboard/report?startDate=${data.startDate}&endDate=${data.endDate}`,
      ),
  },

  notifications: {
    list: () => req<{ data: Array<Notification> }>("/notifications"),
    markAllRead: () =>
      req<any>("/notifications/mark-all-read", { method: "PATCH" }),
  },

  routers: {
    list: (params?: Record<string, string>) =>
      req<{ data: RouterDevice[] }>(
        `/routers${params ? "?" + new URLSearchParams(params) : ""}`,
      ),

    services: () => req<Array<string>>(`/routers/services`),

    create: (data: Partial<RouterDevice>) =>
      req<{ message: string; router: RouterDevice; success: boolean }>(
        "/routers",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),

    whileListAp: (data: { routerId: string; name: string; mac: string }) =>
      req<{ data: RouterDevice }>("/routers/whitelist", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    checkStatus: (id: string) =>
      req<any>("/routers/status", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),

    resetDevice: (routerId: string) =>
      req<{ success: boolean }>("/routers/reset", {
        method: "POST",
        body: JSON.stringify({ routerId }),
      }),

    update: (id: string, data: Partial<RouterDevice>) =>
      req<{ message: string; routerId: string; success: boolean }>(
        `/routers/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),

    delete: (id: string) =>
      req<{ message: string }>(`/routers/${id}`, { method: "DELETE" }),

    getScript: (id: string) =>
      req<{ data: { script: string } }>(`/routers/${id}/script`),

    getInfo: (id: string) => req<{ data: RouterDevice }>(`/routers?id=${id}`),
  },

  pppoe: {
    list: () => req<PPPoEUser[]>("/pppoe"),
    create: (data: Partial<PPPoEUser>) =>
      req<{ success: boolean; message: string }>("/pppoe", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<PPPoEUser>) =>
      req<{ success: boolean; message: string }>(`/pppoe/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      req<{ message: string }>(`/pppoe/${id}`, { method: "DELETE" }),
  },

  packages: {
    list: (type?: string) => req<{ data: Package[] }>(`/packages?type=${type ? type : "all"}`),

    create: (data: Partial<Package>) =>
      req<{ package: Package }>("/packages", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Package>) =>
      req<{ package: Package }>(`/packages/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      req<{ message: string, success: boolean }>(`/packages/${id}`, { method: "DELETE" }),
  },

  invoices: {
    list: (params?: Record<string, string>) =>
      req<{ data: Invoice[] }>(
        `/invoices${params ? "?" + new URLSearchParams(params) : ""}`,
      ),
    update: (id: string, status: string) =>
      req<{ success: boolean; message: string }>(`/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    pay: (id: string, phoneNumber: string) =>
      req<{ success: boolean; message: string }>(`/invoices/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      }),
  },

  vouchers: {
    list: (params?: Record<string, string>) =>
      req<{ data: Voucher[] }>(
        `/vouchers${params ? "?" + new URLSearchParams(params) : ""}`,
      ),

    delete: (id: string) =>
      req<{ message: string }>(`/vouchers/${id}`, { method: "DELETE" }),

    revoke: (id: string) =>
      req<{ message: string }>(`/vouchers/${id}/revoke`, { method: "PATCH" }),

    generate: (data: {
      packageId: string;
      quantity: number;
      prefix?: string;
    }) =>
      req<{ vouchers: Voucher[] }>("/vouchers", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    export: () => {
      const token = tokenManager.getToken();
      return fetch(`${BASE}/vouchers/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.text());
    },
  },

  transactions: {
    list: (params?: Record<string, string | undefined>) => {
      const clean = Object.fromEntries(
        Object.entries(params ?? {}).filter(([, v]) => v !== undefined),
      ) as Record<string, string>;
      return req<{ data: Transaction[] }>(
        `/payments${Object.keys(clean).length ? "?" + new URLSearchParams(clean) : ""}`,
      );
    },

    recent: () => {
      return req<{ data: Transaction[] }>(`/payments/recent`);
    },

    gateways: () => {
      return req<Array<GatewayConfig>>(`/payments/gateways`);
    },
  },

  sessions: {
    list: (params?: Record<string, string>) =>
      req<Array<HotspotSession>>(
        `/sessions${params ? "?" + new URLSearchParams(params) : ""}`,
      ),

    disconnect: (id: string) =>
      req<{ success: boolean }>(`/sessions/${id}/disconnect`, {
        method: "POST",
      }),

    clearMac: (id: string) =>
      req<{ success: boolean }>(`/sessions/${id}/clearmac`, { method: "POST" }),

    changePackage: (id: string, packageId: string) =>
      req<{ success: boolean }>(`/sessions/${id}/changepackage`, {
        method: "POST",
        body: JSON.stringify({ packageId }),
      }),
  },

  tenant: {
    get: (tenantId?: string) =>
      req<{ data: Tenant }>(`/tenants/${tenantId || "current"}`),

    getPortalSettings: (tenantId?: string) =>
      req<{ data: TenantPortalSettings }>(
        tenantId ? `/tenants/${tenantId}/portal` : "/tenants/portal",
      ),

    updatePortalSettings: (data: TenantPortalSettings, tenantId: string) =>
      req<TenantPortalSettings>(`/tenants/${tenantId}/portal`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    uploadLogo: (formData: FormData, tenantId: string) => {
      const token = tokenManager.getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = `${BASE}/tenants/${tenantId}/portal/logo`;
      return fetch(url, { method: "POST", headers, body: formData }).then((r) =>
        r.json(),
      ) as Promise<{ url: string }>;
    },

    updateSettings: (data: any, tenantId: string) =>
      req<{ message: string }>(`/tenants/${tenantId}/settings`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  tenants: {
    list: () => req<{ data: import("@/lib/types").Tenant[] }>("/tenants"),

    create: (data: { name: string; adminName: string; adminEmail: string }) =>
      req<{ message: string; success: boolean; tenantId: string }>("/tenants", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<import("@/lib/types").Tenant>) =>
      req<{ tenant: import("@/lib/types").Tenant }>(`/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    updateStatus: (id: string, status: "active" | "suspended") =>
      req<{ tenant: import("@/lib/types").Tenant }>(`/tenants/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),

    delete: (id: string) =>
      req<{ message: string }>(`/tenants/${id}`, { method: "DELETE" }),
  },

  user: {
    get: (userId?: string) =>
      req<{ data: import("@/lib/types").User }>(
        `/users/${userId || "current"}`,
      ),
  },

  users: {
    list: async (params?: Record<string, string>): Promise<User[]> => {
      const res = await req<{ data: User[] }>(
        `/users${params ? "?" + new URLSearchParams(params) : ""}`,
      );
      return res.data;
    },

    update: (id: string, data: Partial<import("@/lib/types").User>) =>
      req<{ user: import("@/lib/types").User }>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      req<{ message: string }>(`/users/${id}`, { method: "DELETE" }),

    resetPassword: (id: string, password: string) =>
      req<{ message: string }>(`/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
  },

  portal: {
    getConfig: (nasname: string, token: string) =>
      req<{ data: TenantPortalSettings }>(
        `/tenants/config?nasname=${nasname}&token=${token}`,
      ),

    getPackages: (nasname: string, token: string) =>
      req<{ data: Package[] }>(
        `/packages/portal?nasname=${nasname}&token=${token}`,
      ),

    redeemVoucher: (data: {
      code: string;
      deviceIp: string;
      deviceMac: string;
      nasName: string;
      authToken: string;
    }) =>
      req<{ success: boolean; message: string; appliedVoucher: string }>(
        `/payments/voucher?nasname=${data.nasName}&token=${data.authToken}`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),

    connectFreePackage: (data: {
      deviceIp: string;
      deviceMac: string;
      packageId: string;
      nasName: string;
      authToken: string;
    }) =>
      req<{ success: boolean; message: string; appliedVoucher: string }>(
        `/payments/trial?nasname=${data.nasName}&token=${data.authToken}`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),

    checkSession: (data: {
      deviceMac: string;
      nasName: string;
      authToken: string;
    }) =>
      req<{ success: boolean; message: string; voucher: string | null }>(
        `/payments/session?nasname=${data.nasName}&token=${data.authToken}&deviceMac=${data.deviceMac}`,
      ),

    checkStatus: (data: {
      transactionId: string;
      nasName: string;
      authToken: string;
    }) =>
      req<{ success: boolean; message: string; voucher: string | null }>(
        `/payments/${data.transactionId}/status?nasname=${data.nasName}&token=${data.authToken}`,
      ),

    initiatePayment: (data: {
      packageId: string;
      deviceIp: string;
      deviceMac: string;
      nasName: string;
      authToken: string;
      phoneNumber: string;
    }) =>
      req<{ transactionId: string; message: string; success: boolean }>(
        `/payments/mno?nasname=${data.nasName}&token=${data.authToken}`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
  },
};
