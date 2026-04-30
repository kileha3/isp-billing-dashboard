export type UserRole = "super_admin" | "tenant_admin" | "operator";
export type RouterStatus = "online" | "offline" | "pending";
export type VoucherStatus = "unused" | "used" | "expired";
export type TransactionStatus = "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED";
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
  currency: string;
  language: string;
}

export interface PPPoEUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  location?: string;
  packageId: Package | string;
  status: "active" | "suspended" | "unpaid" | "offline";
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface Tenant {
  _id: string;
  name: string;
  branding: TenantPortalSettings["branding"];
  support: TenantPortalSettings["support"];
  portalSettings: TenantPortalSettings["portalSettings"];
  settings: { currency: string; timezone: string; language: string };
  paymentPref: any;
  paymentGateway: { gateway: string };
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export interface RouterInfo {
  model: string;
  version: string;
  platform: string;
  uptime: string;
  availableInterfaces: Array<{ name: string; isRunning: boolean }>;
}

export interface ReportSummary {
  data: Array<{ date: string; amount: number }>;
  summary: { growthPercentage: string; isPositiveGrowth: boolean };
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type:
    | "router_offline"
    | "router_online"
    | "user_joined"
    | "session_expired"
    | "payment_success"
    | "payment_failed";
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DevicePortalInterface {
  type: string;
  interfaces: Array<string>;
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
  portalInterface?: DevicePortalInterface;
  uptime: string;
  script?: string;
  info: RouterInfo;
}

// ─── Package ──────────────────────────────────────────────────────────────────

export interface Package {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  maxUsers: number;
  maxReconnects: number;
  duration: number;
  durationUnit: string;
  dataLimit: number;
  dataLimitUnit: string;
  speedLimit: number;
  status: "active" | "inactive";
  isPublic: boolean;
  isFree: boolean;
  isPpPoe: boolean;
  currency: string;
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
  usedBy?: { ipAddress: string; macAddress: string };
  usedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  _id: string;
  tenantName: string;
  status: "pending" | "paid" | "overdue" | "expired";
  type: string;
  description: string;
  amount: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export interface Transaction {
  _id: string;
  tenant: { id: string; name: string } | null;
  router: { id: string; name: string; location: string } | null;
  package: {
    id: string;
    name: string;
    duration: number;
    durationUnit?: string;
    dataLimit?: number;
    dataLimitUnit?: string;
  } | null;
  customer: string;
  amount: number;
  status: TransactionStatus;
  voucherApplied: string;
  source: string;
  currency: string;
  paymentMethod: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}


export interface HotspotSession {
  _id: string;
  createdAt: Date;
  lastUpdateAt: Date;
  nas: { ip: string; name: string; location: string };
  network: { ip: string; mac: string };
  package: { id: string; name: string; price: number };
  session: {
    id: string;
    start: Date;
    stop: null;
    duration: number;
  };
  isPPPoE: boolean;
  sessions: number;
  status: "active" | "expired" | "offline";
  tenant: { id: string; name: string };
  timeLapse: string;
  updatedAt: Date;
  usage: { input: number; output: number };
  username: string;
}


export interface GatewayField {
  name: string;
  placeholder: string;
}

export interface Gateway {
  id: string;
  name: string;
}

export interface GatewayConfig {
  gateway: Gateway;
  fields: GatewayField[];
}

export interface OfferCriteria {
  minUsageDays: {
    enabled: boolean;
    operator: ">" | ">=" | "=" | "<" | "<=";
    value: number;
  };
  totalSpent: {
    enabled: boolean;
    operator: ">" | ">=" | "=" | "<" | "<=";
    value: number;
  };
  lastPurchaseDays: {
    enabled: boolean;
    operator: ">" | ">=" | "=" | "<" | "<=";
    value: number;
  };
}

export interface OfferQualifiedUser {
  userId: string;
  name?: string;
  email?: string;
  totalSpent: number;
  lastPurchaseDate: string;
  usageDays: number;
}

export interface Offer {
  _id: string;
  name: string;
  packageId: string;
  criteria: OfferCriteria;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  qualified: number;
  totalJoined?: number;
}