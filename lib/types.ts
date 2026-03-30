export type UserRole = "super_admin" | "tenant_admin" | "operator";
export type RouterStatus = "online" | "offline" | "pending";
export type VoucherStatus = "unused" | "redeemed" | "expired";
export type TransactionStatus = "paid" | "pending" | "failed" | "refunded";
export type SessionStatus = "active" | "disconnected" | "expired";
export type PortalDisplayMode = "packages_only" | "vouchers_only" | "both";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  createdAt?: string;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export interface TenantPortalSettings {
  branding: {
    logo: string;
    primaryColor: string;
    secondaryColor: string;
    businessName: string;
  };
  support: {
    phone: string;
    email: string;
    whatsapp: string;
    showOnPortal: boolean;
  };
  portalSettings: {
    displayMode: PortalDisplayMode;
    welcomeMessage: string;
    termsUrl: string;
    showPoweredBy: boolean;
  };
}

export interface Tenant {
  _id: string;
  name: string;
  branding: TenantPortalSettings["branding"];
  support: TenantPortalSettings["support"];
  portalSettings: TenantPortalSettings["portalSettings"];
  settings: { currency: string; timezone: string };
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export interface RouterInfo {
  model: string;
  version: string;
  cpuLoad: string;
  uptime: string;
  availableInterfaces: Array<{name: string, isRunning: boolean}>
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: "router_offline" | "router_online" | "user_joined" | "session_expired" | "payment_success" | "payment_failed";
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface RouterDevice {
  _id: string;
  tenantId: string;
  name: string;
  location?: string;
  ipAddress?: string;
  status: RouterStatus;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  portalInterfaces?: Array<{type: string, interfaces: Array<string>}>
  uptime: string;
  script?: string;
  info: RouterInfo
}

// ─── Package ──────────────────────────────────────────────────────────────────

export interface Package {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  durationUnit: string;
  dataLimit: number;
  speedLimit: number;
  status: "active" | "inactive";
  isPublic: boolean;
  isFree: boolean;
  routerIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Voucher ──────────────────────────────────────────────────────────────────

export interface Voucher {
  _id: string;
  tenantId: string;
  code: string;
  packageId: string | { _id: string; name: string };
  status: VoucherStatus;
  duration: number;
  dataLimit: number;
  speedLimit: number;
  batchId?: string;
  usedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export interface Transaction {
  _id: string;
  tenantId: string;
  routerId: string;
  packageId: string | { _id: string; name: string };
  amount: number;
  status: TransactionStatus;
  customerPhone?: string;
  paymentMethod: "mpesa" | "airtel" | "voucher";
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface HotspotSession {
  _id: string;
  tenantId: string;
  routerId: string | { _id: string; name: string };
  packageId?: string | { _id: string; name: string };
  macAddress: string;
  ipAddress?: string;
  status: SessionStatus;
  startTime: string;
  endTime?: string;
  dataUsed: number;
  createdAt: string;
  updatedAt: string;
}

// ─── IP Manager ───────────────────────────────────────────────────────────────

export type PeerStatus = "assigned" | "available" | "reserved" | "blocked";

export interface Peer {
  /** UUID v4 */
  _id: string;
  /** Tenant UUID */
  tenantId: string;
  /** MAC address in colon-hex notation, e.g. aa:bb:cc:dd:ee:ff */
  mac: string;
  /** Assigned IPv4 address, e.g. 10.10.0.5 */
  ip: string;
  status: PeerStatus;
  /** Optional human-readable label */
  hostname?: string;
  /** Router UUID this peer is associated with */
  routerId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  routers: { total: number; online: number; offline: number };
  packages: { total: number };
  vouchers: { total: number; unused: number };
  transactions: { total: number; revenue: number; todayRevenue: number };
  sessions: { active: number };
  revenueChart: { date: string; amount: number }[];
  sessionChart: { date: string; count: number }[];
  recentTransactions: {
    _id: string;
    amount: number;
    status: string;
    customerPhone: string;
    createdAt: string;
    packageId?: { name: string };
  }[];
}
