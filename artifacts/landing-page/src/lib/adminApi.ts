import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export interface AnalyticsData {
  ordersByDay: { date: string; count: number }[];
  ordersByHour: { hour: number; count: number }[];
  ordersBySource: { source: string; count: number }[];
  visitors: {
    today: number;
    yesterday: number;
    last7: number;
    last30: number;
    total: number;
  };
  conversion: {
    last30: { visitors: number; orders: number; rate: number };
    last7: { visitors: number; orders: number; rate: number };
    today: { visitors: number; orders: number; rate: number };
  };
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

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await authFetch("/admin/analytics");
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

function formatIST(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ordersToSheetRows(orders: Order[]) {
  return orders.map((o) => ({
    "Date (IST)": formatIST(o.createdAt),
    "Order ID": o.orderId,
    "Name": o.name,
    "Mobile": o.phone,
    "Address": o.address,
    "Pincode": o.pincode,
    "Product": o.product,
    "Qty": o.quantity,
    "Source": o.source,
    "Status": o.status,
  }));
}

function applyXlsxStyle(ws: XLSX.WorkSheet, numCols: number) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  ws["!cols"] = [
    { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    { wch: 36 }, { wch: 10 }, { wch: 18 }, { wch: 5 },
    { wch: 12 }, { wch: 12 },
  ].slice(0, numCols);
  return ws;
}

export function exportOrdersToXLSX(orders: Order[], filename: string): void {
  const rows = ordersToSheetRows(orders);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  applyXlsxStyle(ws, 10);
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, filename);
}

export function exportSingleOrderToXLSX(order: Order): void {
  const rows = ordersToSheetRows([order]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  applyXlsxStyle(ws, 10);
  XLSX.utils.book_append_sheet(wb, ws, "Order");
  XLSX.writeFile(wb, `order_${order.orderId}.xlsx`);
}

export function exportSingleOrderToPDF(order: Order): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });

  doc.setFillColor(27, 94, 32);
  doc.rect(0, 0, 148, 20, "F");
  doc.setTextColor(201, 161, 74);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Prakriti Herbs — Order Details", 74, 13, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, 74, 25, { align: "center" });

  autoTable(doc, {
    startY: 30,
    head: [["Field", "Value"]],
    body: [
      ["Order ID", order.orderId],
      ["Date (IST)", formatIST(order.createdAt)],
      ["Name", order.name],
      ["Mobile", order.phone],
      ["Address", order.address],
      ["Pincode", order.pincode],
      ["Product", order.product],
      ["Quantity", String(order.quantity)],
      ["Source", order.source],
      ["Status", order.status],
    ],
    headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 }, 1: { cellWidth: 90 } },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`order_${order.orderId}.pdf`);
}

export function exportOrdersToPDF(orders: Order[], filename: string): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(27, 94, 32);
  doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(201, 161, 74);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Prakriti Herbs — Orders Export", 148.5, 12, { align: "center" });

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} | Total: ${orders.length} orders`, 148.5, 22, { align: "center" });

  autoTable(doc, {
    startY: 26,
    head: [["Date (IST)", "Order ID", "Name", "Mobile", "Address", "Pincode", "Source", "Status"]],
    body: orders.map((o) => [
      formatIST(o.createdAt),
      o.orderId,
      o.name,
      o.phone,
      o.address.substring(0, 40) + (o.address.length > 40 ? "..." : ""),
      o.pincode,
      o.source,
      o.status,
    ]),
    headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 252, 248] },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: 22 },
      4: { cellWidth: 65 },
      5: { cellWidth: 16 },
      6: { cellWidth: 20 },
      7: { cellWidth: 18 },
    },
  });

  doc.save(filename);
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
