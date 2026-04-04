import type {
  User,
  TenantPortalSettings,
  DashboardStats,
  RouterDevice,
  Package,
  Voucher,
  Transaction,
  HotspotSession,
  Peer,
  Notification,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4010/v1";

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
    getStats: () => req<DashboardStats>("/dashboard"),
  },

  notifications: {
    list: () => req<{ data: Array<Notification> }>("/notifications"),
    markAllRead: () => req<any>("/notifications/mark-all-read", { method: "PATCH" }),
  },

  routers: {
    list: (params?: Record<string, string>) =>
      req<{ data: RouterDevice[] }>(
        `/routers${params ? "?" + new URLSearchParams(params) : ""}`,
      ),

    create: (data: Partial<RouterDevice>) =>
      req<{ data: RouterDevice  }>("/routers", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    checkStatus: (id: string) =>
      req<any>("/routers/status", {
        method: "POST",
        body: JSON.stringify({ id }),
      }),

    update: (id: string, data: Partial<RouterDevice>) =>
      req<{ data: RouterDevice  }>(`/routers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      req<{ message: string }>(`/routers/${id}`, { method: "DELETE" }),

    getScript: (id: string) =>
      req<{ data: { script: string } }>(`/routers/${id}/script`),

    getInfo: (id: string) => req<{ data: RouterDevice }>(`/routers?id=${id}`),
  },

  packages: {
    list: () => req<{ data: Package[] }>("/packages"),

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
      req<{ message: string }>(`/packages/${id}`, { method: "DELETE" }),
  },

  vouchers: {
    list: (params?: Record<string, string>) =>
      req<{ vouchers: Voucher[] }>(
        `/vouchers${params ? "?" + new URLSearchParams(params) : ""}`,
      ),

    generate: (data: {
      packageId: string;
      quantity: number;
      prefix?: string;
    }) =>
      req<{ vouchers: Voucher[] }>("/vouchers/generate", {
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
      return req<{ transactions: Transaction[] }>(
        `/transactions${Object.keys(clean).length ? "?" + new URLSearchParams(clean) : ""}`,
      );
    },
  },

  sessions: {
    list: (params?: Record<string, string>) =>
      req<{ sessions: HotspotSession[] }>(
        `/sessions${params ? "?" + new URLSearchParams(params) : ""}`,
      ),

    disconnect: (id: string) =>
      req<{ message: string }>(`/sessions/${id}/disconnect`, {
        method: "POST",
      }),

    clearMac: (id: string) =>
      req<{ message: string }>(`/sessions/${id}/clear-mac`, { method: "POST" }),

    changePackage: (id: string, packageId: string) =>
      req<{ message: string }>(`/sessions/${id}/change-package`, {
        method: "POST",
        body: JSON.stringify({ packageId }),
      }),
  },

  tenant: {
    get: (tenantId?: string) =>
      req<{ data: import("@/lib/types").Tenant }>(
        `/tenants/${tenantId || "current"}`,
      ),

    getPortalSettings: (tenantId?: string) =>
      req<{ data: TenantPortalSettings }>(
        tenantId ? `/tenants/${tenantId}/portal` : "/tenant/portal",
      ),

    updatePortalSettings: (data: TenantPortalSettings, tenantId?: string) =>
      req<TenantPortalSettings>(
        tenantId ? `/tenants/${tenantId}/portal` : "/tenant/portal",
        { method: "PATCH", body: JSON.stringify(data) },
      ),

    uploadLogo: (formData: FormData, tenantId?: string) => {
      const token = tokenManager.getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = tenantId
        ? `${BASE}/tenants/${tenantId}/portal/logo`
        : `${BASE}/tenant/portal/logo`;
      return fetch(url, { method: "POST", headers, body: formData }).then((r) =>
        r.json(),
      ) as Promise<{ url: string }>;
    },

    updateSettings: (data: { currency?: string; timezone?: string }) =>
      req<{ message: string }>("/tenant/settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  tenants: {
    list: () => req<{ data: import("@/lib/types").Tenant[] }>("/tenants"),

    create: (data: { name: string; adminName: string; adminEmail: string }) =>
      req<{ data: import("@/lib/types").Tenant }>("/tenants", {
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

  peers: {
    list: (params?: Record<string, string>) =>
      req<{ peers: Peer[] }>(
        `/peers${params ? "?" + new URLSearchParams(params) : ""}`,
      ),

    create: (
      data: Pick<Peer, "mac" | "ip" | "tenantId"> & {
        hostname?: string;
        routerId?: string;
        status?: Peer["status"];
      },
    ) =>
      req<{ peer: Peer }>("/peers", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (
      id: string,
      data: Partial<Omit<Peer, "_id" | "createdAt" | "updatedAt">>,
    ) =>
      req<{ peer: Peer }>(`/peers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      req<{ message: string }>(`/peers/${id}`, { method: "DELETE" }),

    release: (id: string) =>
      req<{ peer: Peer }>(`/peers/${id}/release`, { method: "POST" }),
  },

  portal: {
    getConfig: (routerId: string) =>
      req<TenantPortalSettings>(`/portal/config?router=${routerId}`),

    getPackages: (routerId: string) =>
      req<{ packages: Package[] }>(`/portal/packages?router=${routerId}`),

    redeemVoucher: (data: { code: string; routerId: string; mac: string }) =>
      req<{ package?: Package; session: object }>("/portal/voucher", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    initiatePayment: (data: {
      packageId: string;
      routerId: string;
      mac: string;
      phone: string;
      paymentMethod: string;
    }) =>
      req<{ transactionId: string; message: string }>("/portal/payment", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
