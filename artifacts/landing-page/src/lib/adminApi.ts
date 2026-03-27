import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = "/api";
const TOKEN_KEY = "admin_token";

export function getAdminToken(): string | null { return sessionStorage.getItem(TOKEN_KEY); }
export function setAdminToken(token: string): void { sessionStorage.setItem(TOKEN_KEY, token); }
export function clearAdminToken(): void { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem("admin_user"); }
export function isAdminLoggedIn(): boolean {
  const token = getAdminToken();
  if (!token) return false;
  try { const p = JSON.parse(atob(token.split(".")[1])); return p.exp * 1000 > Date.now(); } catch { return false; }
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) { clearAdminToken(); window.location.href = "/admin/login"; }
  return res;
}

export async function adminLogin(username: string, password: string): Promise<{ token: string; username: string }> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export interface Order {
  id: number; orderId: string; name: string; phone: string; address: string;
  pincode: string; quantity: number; product: string; source: string; status: string;
  paymentMethod: string | null; paymentId: string | null; paymentStatus: string | null;
  trackingId: string | null; courier: string | null; createdAt: string; isRepeat?: boolean;
}

export interface OrderStats {
  total: number; today: number; new: number; confirmed: number;
  shipped: number; cancelled: number; delivered: number;
}

export interface AdminDownload {
  id: number; downloadedBy: string; filename: string;
  recordCount: number; filters: string | null; downloadedAt: string;
}

export interface AnalyticsData {
  ordersByDay: { date: string; count: number }[];
  ordersByHour: { hour: number; count: number }[];
  ordersBySource: { source: string; count: number }[];
  topCities: { city: string; count: number; revenue: number }[];
  visitors: { today: number; yesterday: number; last7: number; last30: number; total: number };
  conversion: {
    last30: { visitors: number; orders: number; rate: number };
    last7: { visitors: number; orders: number; rate: number };
    today: { visitors: number; orders: number; rate: number };
  };
  abandonedStats: { total: number; new: number; called: number; recovered: number };
  repeatCustomers: number;
  paymentStats: { cod: number; razorpay: number; cashfree: number; paid: number };
}

export interface AbandonedCart {
  id: number; name: string; phone: string; address: string | null; pincode: string | null;
  source: string | null; recoveryStatus: string; eventId: string | null; createdAt: string; updatedAt: string;
}

export interface Review {
  id: number; product: string; reviewerName: string; phone: string | null; rating: number;
  reviewText: string; status: string; source: string; verified: boolean | null; city: string | null; createdAt: string;
}

export interface AppSettings { settings: Record<string, string>; exists: Record<string, boolean> }

export async function fetchOrders(params: { search?: string; status?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}): Promise<{ orders: Order[]; total: number; page: number; limit: number; stats: OrderStats }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await authFetch(`/admin/orders?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function updateOrderStatus(id: number, status: string): Promise<void> {
  const res = await authFetch(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error("Failed to update status");
}

export async function bulkUpdateOrderStatus(ids: number[], status: string): Promise<{ updated: number }> {
  const res = await authFetch("/admin/orders/bulk-status", { method: "POST", body: JSON.stringify({ ids, status }) });
  if (!res.ok) throw new Error("Bulk update failed");
  return res.json();
}

export async function shipViaShinprocket(id: number): Promise<{ awb: string; courier: string; trackingUrl: string }> {
  const res = await authFetch(`/admin/orders/${id}/ship-shiprocket`, { method: "POST" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function updateIndiaPostTracking(id: number, trackingId: string): Promise<void> {
  const res = await authFetch(`/admin/orders/${id}/ship-indiapost`, { method: "POST", body: JSON.stringify({ trackingId }) });
  if (!res.ok) throw new Error("Failed to update tracking");
}

export async function sendWhatsAppToOrder(id: number, message?: string): Promise<void> {
  const res = await authFetch(`/admin/orders/${id}/whatsapp`, { method: "POST", body: JSON.stringify({ message }) });
  const data = await res.json() as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "WhatsApp failed");
}

export async function sendWhatsAppToCart(id: number): Promise<void> {
  const res = await authFetch(`/admin/abandoned-carts/${id}/whatsapp`, { method: "POST" });
  const data = await res.json() as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "WhatsApp failed");
}

export async function fetchAbandonedCarts(params: { search?: string; status?: string; page?: number; limit?: number } = {}): Promise<{ carts: AbandonedCart[]; total: number; page: number }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await authFetch(`/admin/abandoned-carts?${qs}`);
  if (!res.ok) return { carts: [], total: 0, page: 1 };
  return res.json();
}

export async function updateAbandonedCartStatus(id: number, status: string): Promise<void> {
  await authFetch(`/admin/abandoned-carts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await authFetch("/admin/analytics");
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function fetchReviews(params: { status?: string; page?: number } = {}): Promise<{ reviews: Review[]; total: number; stats: { total: number; pending: number; approved: number; avgRating: number } }> {
  const qs = new URLSearchParams();
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  const res = await authFetch(`/admin/reviews?${qs}`);
  if (!res.ok) return { reviews: [], total: 0, stats: { total: 0, pending: 0, approved: 0, avgRating: 0 } };
  return res.json();
}

export async function addReview(data: { reviewerName: string; rating: number; reviewText: string; phone?: string; city?: string; status?: string; verified?: boolean }): Promise<Review> {
  const res = await authFetch("/admin/reviews", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to add review");
  const d = await res.json() as { review: Review };
  return d.review;
}

export async function updateReview(id: number, data: Partial<{ status: string; reviewerName: string; reviewText: string; rating: number; verified: boolean; city: string }>): Promise<Review> {
  const res = await authFetch(`/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to update review");
  const d = await res.json() as { review: Review };
  return d.review;
}

export async function deleteReview(id: number): Promise<void> {
  await authFetch(`/admin/reviews/${id}`, { method: "DELETE" });
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await authFetch("/admin/settings");
  if (!res.ok) return { settings: {}, exists: {} };
  return res.json();
}

export async function saveSettings(data: Record<string, string>): Promise<void> {
  const res = await authFetch("/admin/settings", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to save settings");
}

export async function fetchDownloads(): Promise<AdminDownload[]> {
  const res = await authFetch("/admin/downloads");
  if (!res.ok) return [];
  const data = await res.json() as { downloads: AdminDownload[] };
  return data.downloads;
}

export async function logDownload(filename: string, recordCount: number, filters: string): Promise<void> {
  await authFetch("/admin/downloads", { method: "POST", body: JSON.stringify({ filename, recordCount, filters }) });
}

function fmtISTForExport(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s/, "$3-$2-$1 ");
}

export function exportOrdersToXLSX(orders: Order[], filename = "orders.xlsx"): void {
  const rows = orders.map((o) => ({
    "Order ID": o.orderId, "Date (IST)": fmtISTForExport(o.createdAt),
    "Name": o.name, "Mobile": o.phone, "Address": o.address, "Pincode": o.pincode,
    "Qty": o.quantity, "Amount (₹)": 999 * o.quantity, "Source": o.source,
    "Payment": o.paymentMethod ?? "COD", "Pay Status": o.paymentStatus ?? "pending",
    "Status": o.status, "Tracking": o.trackingId ?? "", "Courier": o.courier ?? "",
    "Repeat": o.isRepeat ? "Yes" : "No",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, filename);
}

export function exportSingleOrderToXLSX(order: Order): void {
  exportOrdersToXLSX([order], `order_${order.orderId}.xlsx`);
}

export function exportOrdersToPDF(orders: Order[], filename = "orders.pdf"): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFillColor(27, 94, 32); doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(201, 161, 74); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Prakriti Herbs — Orders Export", 148, 11, { align: "center" });
  doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, 148, 16, { align: "center" });
  autoTable(doc, {
    startY: 22,
    head: [["Date (IST)", "Order ID", "Name", "Mobile", "Address", "Pincode", "Qty", "Amount", "Source", "Payment", "Status", "Tracking"]],
    body: orders.map((o) => [
      fmtISTForExport(o.createdAt), o.orderId, o.name, o.phone,
      o.address.substring(0, 30), o.pincode, o.quantity,
      `₹${(999 * o.quantity).toLocaleString()}`, o.source, o.paymentMethod ?? "COD", o.status, o.trackingId ?? "",
    ]),
    headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 248] },
  });
  doc.save(filename);
}

export function exportSingleOrderToPDF(order: Order): void {
  exportOrdersToPDF([order], `order_${order.orderId}.pdf`);
}

export function exportOrdersToCSV(orders: Order[], filename = "orders.csv"): void {
  const headers = ["Order ID", "Date (IST)", "Name", "Mobile", "Address", "Pincode", "Qty", "Amount (₹)", "Source", "Payment", "Pay Status", "Status", "Tracking", "Courier", "Repeat"];
  const rows = orders.map((o) => [
    o.orderId, fmtISTForExport(o.createdAt), `"${o.name}"`, o.phone, `"${o.address}"`,
    o.pincode, o.quantity, 999 * o.quantity, o.source, o.paymentMethod ?? "COD",
    o.paymentStatus ?? "pending", o.status, o.trackingId ?? "", o.courier ?? "", o.isRepeat ? "Yes" : "No",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
