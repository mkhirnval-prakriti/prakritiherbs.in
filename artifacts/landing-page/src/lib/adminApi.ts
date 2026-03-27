const API_BASE = "/api";
const TOKEN_KEY = "admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem("admin_user");
}

export function isAdminLoggedIn(): boolean {
  const token = getAdminToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearAdminToken();
    window.location.href = "/admin/login";
  }
  return res;
}

export async function adminLogin(username: string, password: string): Promise<{ token: string; username: string }> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error((err as { error: string }).error ?? "Login failed");
  }
  return res.json();
}

export interface Order {
  id: number;
  orderId: string;
  name: string;
  phone: string;
  address: string;
  pincode: string;
  quantity: number;
  product: string;
  source: string;
  status: string;
  createdAt: string;
}

export interface OrderStats {
  total: number;
  today: number;
  new: number;
  confirmed: number;
  shipped: number;
  cancelled: number;
  delivered: number;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  stats: OrderStats;
}

export interface AdminDownload {
  id: number;
  downloadedBy: string;
  filename: string;
  recordCount: number;
  filters: string | null;
  downloadedAt: string;
}

export async function fetchOrders(params: {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<OrdersResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await authFetch(`/admin/orders?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function updateOrderStatus(id: number, status: string): Promise<Order> {
  const res = await authFetch(`/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error((err as { error: string }).error ?? "Update failed");
  }
  const data = await res.json();
  return (data as { order: Order }).order;
}

export async function logDownload(filename: string, recordCount: number, filters: string): Promise<void> {
  await authFetch("/admin/downloads", {
    method: "POST",
    body: JSON.stringify({ filename, recordCount, filters }),
  }).catch(() => {});
}

export async function fetchDownloads(): Promise<AdminDownload[]> {
  const res = await authFetch("/admin/downloads");
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { downloads: AdminDownload[] }).downloads;
}

export function exportOrdersToCSV(orders: Order[], filename: string): void {
  const headers = ["Order ID", "Date", "Name", "Phone", "Address", "Pincode", "Product", "Qty", "Source", "Status"];
  const rows = orders.map((o) => [
    o.orderId,
    new Date(o.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    o.name,
    o.phone,
    `"${o.address.replace(/"/g, '""')}"`,
    o.pincode,
    o.product,
    o.quantity,
    o.source,
    o.status,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
