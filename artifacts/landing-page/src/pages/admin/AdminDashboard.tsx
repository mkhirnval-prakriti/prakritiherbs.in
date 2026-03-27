import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  fetchOrders, updateOrderStatus, fetchDownloads, exportOrdersToXLSX,
  exportSingleOrderToXLSX, exportSingleOrderToPDF, exportOrdersToPDF,
  exportOrdersToCSV, logDownload, clearAdminToken, isAdminLoggedIn,
  fetchAnalytics, fetchAbandonedCarts, updateAbandonedCartStatus, bulkUpdateOrderStatus,
  type Order, type OrderStats, type AdminDownload, type AnalyticsData, type AbandonedCart,
} from "@/lib/adminApi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Search, RefreshCw, Download, LogOut, Package,
  ChevronLeft, ChevronRight, BarChart3, History, Filter,
  FileSpreadsheet, FileText, TrendingUp, Users, Eye, ArrowUpRight,
  ShoppingCart, Clock, Globe, Home, Settings, AlertTriangle,
  CheckSquare, Square, MapPin, Phone, Star, Menu, X, Mail,
  Printer, AlertCircle,
} from "lucide-react";

const G = "#1B5E20";
const GOLD = "#C9A14A";
const PIE_COLORS = [G, GOLD, "#2196F3", "#FF5722", "#9C27B0", "#00BCD4", "#4CAF50", "#FF9800"];

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Confirmed: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Shipped: "bg-purple-100 text-purple-700 border-purple-200",
  Delivered: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};
const RECOVERY_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Called: "bg-yellow-100 text-yellow-700",
  "Follow-up": "bg-orange-100 text-orange-700",
  Recovered: "bg-green-100 text-green-700",
  "Not Interested": "bg-red-100 text-red-700",
};
const ALL_STATUSES = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];
const RECOVERY_STATUSES = ["New", "Called", "Follow-up", "Recovered", "Not Interested"];

type Page = "home" | "orders" | "abandoned" | "analytics" | "settings" | "downloads";

/* ─── Small helpers ─── */
function fmtIST(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
}
function hourLabel(h: number) { return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`; }

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{children}</span>;
}

function StatCard({ label, value, color, icon, sub }: { label: string; value: string | number; color: string; icon?: React.ReactNode; sub?: string }) {
  return (
    <div className={`rounded-xl p-4 border ${color} flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
        {icon && <div className="opacity-40">{icon}</div>}
      </div>
      <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

/* ─── StatusSelect ─── */
function StatusSelect({ orderId, currentStatus, onUpdate }: { orderId: number; currentStatus: string; onUpdate: (id: number, s: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value; if (s === currentStatus) return;
    setLoading(true);
    try { await updateOrderStatus(orderId, s); onUpdate(orderId, s); }
    catch (err) { alert(err instanceof Error ? err.message : "Update failed"); }
    finally { setLoading(false); }
  }
  const cls = STATUS_COLORS[currentStatus] ?? "bg-gray-100 text-gray-700";
  return (
    <select value={currentStatus} onChange={handleChange} disabled={loading}
      className={`text-xs font-semibold border rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${cls}`}>
      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

/* ─── RecoverySelect ─── */
function RecoverySelect({ cartId, current, onUpdate }: { cartId: number; current: string; onUpdate: (id: number, s: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value; if (s === current) return;
    setLoading(true);
    try { await updateAbandonedCartStatus(cartId, s); onUpdate(cartId, s); }
    catch { alert("Update failed"); }
    finally { setLoading(false); }
  }
  const cls = RECOVERY_COLORS[current] ?? "bg-gray-100 text-gray-600";
  return (
    <select value={current} onChange={handleChange} disabled={loading}
      className={`text-xs font-semibold border-0 rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${cls}`}>
      {RECOVERY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

/* ─── RowActions (per-row download + invoice) ─── */
function RowActions({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);

  function printInvoice() {
    setOpen(false);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFillColor(27, 94, 32);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(201, 161, 74);
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("PRAKRITI HERBS PRIVATE LIMITED", 105, 13, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(255, 255, 255);
    doc.text("GST Invoice | GSTIN: [Your GSTIN] | PAN: [Your PAN]", 105, 20, { align: "center" });
    doc.text("contact@prakritiherbs.in | +91 89681 22246 | prakritiherbs.in", 105, 26, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE", 105, 42, { align: "center" });

    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Invoice No: INV-${order.orderId}`, 14, 52);
    doc.text(`Date: ${fmtDate(order.createdAt)}`, 14, 58);
    doc.text(`Order ID: ${order.orderId}`, 14, 64);

    doc.setFont("helvetica", "bold"); doc.text("Bill To:", 14, 76);
    doc.setFont("helvetica", "normal");
    doc.text(order.name, 14, 82);
    doc.text(order.phone, 14, 88);
    const addrLines = doc.splitTextToSize(order.address, 80);
    doc.text(addrLines, 14, 94);
    doc.text(`Pincode: ${order.pincode}`, 14, 94 + addrLines.length * 5);

    const amt = 999 * order.quantity;
    const gst = Math.round(amt * 0.18);
    const base = amt - gst;
    autoTable(doc, {
      startY: 118,
      head: [["#", "Description", "HSN", "Qty", "Rate (₹)", "GST 18%", "Amount (₹)"]],
      body: [[
        "1",
        "KamaSutra Gold+ (Ayurvedic Supplement)",
        "3004",
        String(order.quantity),
        `₹${base.toLocaleString()}`,
        `₹${gst.toLocaleString()}`,
        `₹${amt.toLocaleString()}`,
      ]],
      foot: [["", "", "", "", "", "Total", `₹${amt.toLocaleString()}`]],
      headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      footStyles: { fillColor: [245, 250, 245], textColor: [27, 94, 32], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 3 },
    });
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text("This is a computer-generated invoice. No signature required.", 105, 270, { align: "center" });
    doc.text("Thank you for your order! | Prakriti Herbs Private Limited", 105, 276, { align: "center" });
    doc.save(`invoice_${order.orderId}.pdf`);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
        <Download className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-[170px]">
            <button onClick={() => { exportSingleOrderToXLSX(order); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-green-50">
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> Excel (.xlsx)
            </button>
            <button onClick={() => { exportSingleOrderToPDF(order); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-red-50">
              <FileText className="w-3.5 h-3.5 text-red-600" /> PDF Download
            </button>
            <button onClick={printInvoice}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-purple-50">
              <Printer className="w-3.5 h-3.5 text-purple-600" /> GST Invoice
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Sidebar Nav ─── */
function Sidebar({ page, setPage, sidebarOpen, setSidebarOpen, adminUser, onLogout, stats }: {
  page: Page; setPage: (p: Page) => void; sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void; adminUser: string; onLogout: () => void;
  stats: { abandoned: number };
}) {
  const navItems: { id: Page; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: "home", icon: <Home className="w-4 h-4" />, label: "Home" },
    { id: "orders", icon: <Package className="w-4 h-4" />, label: "Orders" },
    { id: "abandoned", icon: <AlertTriangle className="w-4 h-4" />, label: "Abandoned Carts", badge: stats.abandoned > 0 ? stats.abandoned : undefined },
    { id: "analytics", icon: <BarChart3 className="w-4 h-4" />, label: "Analytics" },
    { id: "downloads", icon: <History className="w-4 h-4" />, label: "Download History" },
    { id: "settings", icon: <Settings className="w-4 h-4" />, label: "Settings" },
  ];

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        w-56 bg-white border-r border-gray-200 shadow-lg`}>
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100" style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}>
          <div className="w-8 h-8 rounded-full border-2 overflow-hidden flex-shrink-0" style={{ borderColor: GOLD }}>
            <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-xs leading-tight">Prakriti Herbs</p>
            <p className="text-xs" style={{ color: GOLD }}>Admin Panel</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors relative
                ${page === item.id
                  ? "text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
              style={page === item.id ? { background: `linear-gradient(135deg, ${G}, #2E7D32)` } : {}}>
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
              {adminUser[0]?.toUpperCase() ?? "A"}
            </div>
            <span className="text-xs font-medium text-gray-700 truncate">{adminUser}</span>
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─── HOME PAGE ─── */
function HomePage({ stats, analytics, loading }: { stats: OrderStats | null; analytics: AnalyticsData | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <StatCard label="Total Orders" value={stats.total} color="bg-white border-gray-200 text-gray-800" icon={<Package className="w-4 h-4" />} />
          <StatCard label="Today" value={stats.today} color="bg-blue-50 border-blue-200 text-blue-800" icon={<ShoppingCart className="w-4 h-4" />} />
          <StatCard label="New" value={stats.new} color="bg-blue-50 border-blue-200 text-blue-800" />
          <StatCard label="Confirmed" value={stats.confirmed} color="bg-yellow-50 border-yellow-200 text-yellow-800" />
          <StatCard label="Shipped" value={stats.shipped} color="bg-purple-50 border-purple-200 text-purple-800" />
          <StatCard label="Delivered" value={stats.delivered} color="bg-green-50 border-green-200 text-green-800" />
          <StatCard label="Cancelled" value={stats.cancelled} color="bg-red-50 border-red-200 text-red-800" />
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" /> Orders — Last 30 Days
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={analytics.ordersByDay} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={G} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v} orders`]} />
                <Area type="monotone" dataKey="count" stroke={G} strokeWidth={2} fill="url(#g1)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" /> Top Cities
            </h3>
            {analytics.topCities.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Not enough data yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.topCities.slice(0, 8).map((c, i) => {
                  const max = analytics.topCities[0]?.count ?? 1;
                  return (
                    <div key={c.city} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4 font-bold">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-gray-700 truncate">{c.city}</span>
                          <span className="text-xs font-bold text-gray-900 ml-2">{c.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-green-600" /> Conversion Today
            </h3>
            <div className="text-center py-2">
              <p className="text-4xl font-black" style={{ color: G }}>{analytics.conversion.today.rate}%</p>
              <p className="text-xs text-gray-500 mt-1">conversion rate</p>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, analytics.conversion.today.rate * 5)}%`, background: `linear-gradient(to right, ${G}, ${GOLD})` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{analytics.conversion.today.visitors} visitors</span>
              <span>{analytics.conversion.today.orders} orders</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Order Sources
            </h3>
            {analytics.ordersBySource.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={analytics.ordersBySource} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                    {analytics.ordersBySource.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> Abandoned Carts
            </h3>
            <div className="space-y-2">
              {[
                ["Total", analytics.abandonedStats.total, "text-gray-900"],
                ["New (Uncontacted)", analytics.abandonedStats.new, "text-blue-700"],
                ["Called", analytics.abandonedStats.called, "text-yellow-700"],
                ["Recovered", analytics.abandonedStats.recovered, "text-green-700"],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{label as string}</span>
                  <span className={`text-sm font-bold ${cls as string}`}>{(value as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ORDERS PAGE ─── */
function OrdersPage({ globalSearch }: { globalSearch: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(globalSearch);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("Confirmed");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const LIMIT = 25;

  const loadOrders = useCallback(async (pg = 1) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const r = await fetchOrders({ search, status: statusFilter, dateFrom, dateTo, page: pg, limit: LIMIT });
      setOrders(r.orders); setStats(r.stats); setTotal(r.total); setPage(pg);
    } catch { alert("Failed to load orders"); }
    finally { setLoading(false); }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { void loadOrders(1); }, [loadOrders]);
  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  function toggleSelect(id: number) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleAll() {
    setSelected((prev) => prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)));
  }

  async function handleBulkUpdate() {
    if (selected.size === 0) return;
    if (!confirm(`Mark ${selected.size} orders as "${bulkStatus}"?`)) return;
    setBulkLoading(true);
    try {
      const r = await bulkUpdateOrderStatus([...selected], bulkStatus);
      alert(`✅ ${r.updated} orders updated to "${bulkStatus}"`);
      void loadOrders(page);
    } catch { alert("Bulk update failed"); }
    finally { setBulkLoading(false); }
  }

  async function handleExport(type: "xlsx" | "pdf" | "csv") {
    setExportOpen(false); setLoading(true);
    try {
      const r = await fetchOrders({ search, status: statusFilter, dateFrom, dateTo, page: 1, limit: 10000 });
      const now = new Date().toISOString().slice(0, 10);
      const filters = [search && `search=${search}`, statusFilter !== "all" && `status=${statusFilter}`, dateFrom && `from=${dateFrom}`, dateTo && `to=${dateTo}`].filter(Boolean).join(", ") || "all";
      if (type === "xlsx") { const fn = `prakriti_orders_${now}.xlsx`; exportOrdersToXLSX(r.orders, fn); await logDownload(fn, r.orders.length, filters); }
      else if (type === "pdf") { const fn = `prakriti_orders_${now}.pdf`; exportOrdersToPDF(r.orders, fn); await logDownload(fn, r.orders.length, filters); }
      else { const fn = `prakriti_orders_${now}.csv`; exportOrdersToCSV(r.orders, fn); await logDownload(fn, r.orders.length, filters); }
    } catch { alert("Export failed"); }
    finally { setLoading(false); }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <div className="relative">
          <button onClick={() => setExportOpen((v) => !v)} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #e8c96a)`, color: G }}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-[170px]">
                {[["xlsx", <FileSpreadsheet className="w-4 h-4 text-green-600" />, "Excel (.xlsx)"], ["pdf", <FileText className="w-4 h-4 text-red-600" />, "PDF"], ["csv", <FileText className="w-4 h-4 text-blue-600" />, "CSV"]].map(([t, icon, label]) => (
                  <button key={t as string} onClick={() => handleExport(t as "xlsx" | "pdf" | "csv")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {icon as React.ReactNode} {label as string}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <form onSubmit={(e) => { e.preventDefault(); void loadOrders(1); }} className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, address..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none">
            <option value="all">All Status</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
          <span className="text-gray-400 text-sm self-center">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
          <div className="flex gap-2">
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-110" style={{ background: G }}>
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
            <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); void loadOrders(1); }}
              className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Clear</button>
            <button type="button" onClick={() => void loadOrders(page)} disabled={loading}
              className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </form>

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-600">{selected.size} selected</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none">
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleBulkUpdate} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              style={{ background: G }}>
              {bulkLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
              Apply Bulk
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">{orders.length} of {total} orders</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center h-32 gap-2 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" /> Loading...
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Package className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#f8f9fa" }}>
                <tr>
                  <th className="px-3 py-3 text-left">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-gray-700">
                      {selected.size === orders.length ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  {["Date (IST)", "Name", "Mobile", "Address", "Pincode", "Source", "Status", "Order ID", "DL"].map((h) => (
                    <th key={h} className={`px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap ${["Address"].includes(h) ? "hidden lg:table-cell" : ["Pincode"].includes(h) ? "hidden md:table-cell" : ["Source", "Order ID"].includes(h) ? "hidden sm:table-cell" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order, idx) => {
                  const badPin = order.pincode.replace(/\D/g, "").length !== 6;
                  return (
                    <tr key={order.id} className={`hover:bg-green-50/40 transition-colors ${selected.has(order.id) ? "bg-green-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-3 py-3">
                        <button onClick={() => toggleSelect(order.id)} className="text-gray-400 hover:text-gray-700">
                          {selected.has(order.id) ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{fmtIST(order.createdAt)}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{order.name}</td>
                      <td className="px-3 py-3 text-gray-700 font-mono text-xs">{order.phone}</td>
                      <td className="px-3 py-3 text-gray-600 max-w-[180px] truncate hidden lg:table-cell text-xs" title={order.address}>{order.address}</td>
                      <td className={`px-3 py-3 hidden md:table-cell text-xs font-mono ${badPin ? "text-red-600 font-bold" : "text-gray-600"}`}>
                        {order.pincode}
                        {badPin && <AlertCircle className="inline w-3 h-3 ml-1 text-red-500" />}
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{order.source}</span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusSelect orderId={order.id} currentStatus={order.status} onUpdate={(id, s) => setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: s } : o))} />
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs font-mono hidden sm:table-cell">{order.orderId}</td>
                      <td className="px-3 py-3"><RowActions order={order} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => void loadOrders(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button onClick={() => void loadOrders(page + 1)} disabled={page >= totalPages || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ABANDONED CARTS PAGE ─── */
function AbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const LIMIT = 25;

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const r = await fetchAbandonedCarts({ search, status: statusFilter, page: pg, limit: LIMIT });
      setCarts(r.carts); setTotal(r.total); setPage(pg);
    } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { void load(1); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Abandoned Carts</h1>
          <p className="text-xs text-gray-500 mt-0.5">Customers who filled name/phone but didn't complete the order</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Total", total, "bg-white border-gray-200 text-gray-800"],
          ["New", carts.filter((c) => c.recoveryStatus === "New").length, "bg-blue-50 border-blue-200 text-blue-800"],
          ["Called", carts.filter((c) => c.recoveryStatus === "Called").length, "bg-yellow-50 border-yellow-200 text-yellow-800"],
          ["Recovered", carts.filter((c) => c.recoveryStatus === "Recovered").length, "bg-green-50 border-green-200 text-green-800"],
        ].map(([label, value, cls]) => (
          <StatCard key={label as string} label={label as string} value={value as number} color={cls as string} />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or mobile..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
              onKeyDown={(e) => e.key === "Enter" && void load(1)} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">All Status</option>
            {RECOVERY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => void load(1)} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-110" style={{ background: G }}>
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button onClick={() => void load(page)} disabled={loading}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">{carts.length} of {total} leads</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && carts.length === 0 ? (
          <div className="flex items-center justify-center h-32 gap-2 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" /> Loading...
          </div>
        ) : carts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No abandoned carts</p>
            <p className="text-xs mt-1 opacity-70">Customers who start filling the form will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#f8f9fa" }}>
                <tr>
                  {["Date", "Name", "Mobile", "Address", "Pincode", "Recovery Status", "Action"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carts.map((cart, idx) => (
                  <tr key={cart.id} className={`hover:bg-orange-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtIST(cart.createdAt)}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{cart.name}</td>
                    <td className="px-3 py-3">
                      <a href={`tel:+91${cart.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-mono">
                        <Phone className="w-3 h-3" /> {cart.phone}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs max-w-[160px] truncate">{cart.address ?? "—"}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{cart.pincode ?? "—"}</td>
                    <td className="px-3 py-3">
                      <RecoverySelect cartId={cart.id} current={cart.recoveryStatus}
                        onUpdate={(id, s) => setCarts((prev) => prev.map((c) => c.id === id ? { ...c, recoveryStatus: s } : c))} />
                    </td>
                    <td className="px-3 py-3">
                      <a href={`https://wa.me/91${cart.phone}?text=${encodeURIComponent(`नमस्ते ${cart.name} जी! आपने KamaSutra Gold+ का ऑर्डर अधूरा छोड़ा था। क्या हम आपकी मदद कर सकते हैं?`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">
                        💬 WhatsApp
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => void load(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button onClick={() => void load(page + 1)} disabled={page >= totalPages || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ANALYTICS PAGE ─── */
function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchAnalytics().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data) return <div className="text-center text-gray-400 py-16"><AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Could not load analytics</p></div>;

  const hourlyData = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourLabel(h), count: data.ordersByHour.find((x) => x.hour === h)?.count ?? 0 }));
  const peakHour = [...hourlyData].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Visitors Today" value={data.visitors.today} color="bg-blue-50 border-blue-200 text-blue-800" icon={<Eye className="w-4 h-4" />} sub="page views" />
        <StatCard label="Yesterday" value={data.visitors.yesterday} color="bg-indigo-50 border-indigo-200 text-indigo-800" icon={<Eye className="w-4 h-4" />} sub="page views" />
        <StatCard label="Last 7 Days" value={data.visitors.last7} color="bg-purple-50 border-purple-200 text-purple-800" icon={<TrendingUp className="w-4 h-4" />} sub="page views" />
        <StatCard label="Last 30 Days" value={data.visitors.last30} color="bg-violet-50 border-violet-200 text-violet-800" icon={<Globe className="w-4 h-4" />} sub="page views" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{ label: "Today", d: data.conversion.today }, { label: "Last 7 Days", d: data.conversion.last7 }, { label: "Last 30 Days", d: data.conversion.last30 }].map(({ label, d }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{label}</p>
            <div className="flex items-end justify-between">
              <div><p className="text-2xl font-bold text-gray-900">{d.rate}%</p><p className="text-xs text-gray-500">conversion</p></div>
              <div className="text-right text-xs text-gray-500">
                <p><span className="font-semibold text-gray-700">{d.visitors.toLocaleString()}</span> visitors</p>
                <p><span className="font-semibold text-green-700">{d.orders.toLocaleString()}</span> orders</p>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.rate * 5)}%`, background: `linear-gradient(to right, ${G}, ${GOLD})` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-green-600" /> Daily Orders — Last 30 Days</h3>
        {data.ordersByDay.length === 0 ? <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data yet</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.ordersByDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={G} stopOpacity={0.2} /><stop offset="95%" stopColor={G} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v} orders`]} />
              <Area type="monotone" dataKey="count" stroke={G} strokeWidth={2} fill="url(#ag)" dot={false} activeDot={{ r: 4, fill: G }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> Orders by Hour</h3>
          {peakHour && peakHour.count > 0 && <p className="text-xs text-gray-500 mb-3">Peak: <span className="font-semibold text-orange-600">{hourLabel(peakHour.hour)}</span> ({peakHour.count} orders)</p>}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyData} margin={{ top: 0, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="count" name="Orders" fill={GOLD} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> Top Cities</h3>
          {data.topCities.length === 0 ? <p className="text-xs text-gray-400 text-center py-12">Not enough data</p> : (
            <div className="space-y-2">
              {data.topCities.map((c, i) => {
                const max = data.topCities[0]?.count ?? 1;
                return (
                  <div key={c.city} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-4 font-bold text-center">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-700 truncate">{c.city}</span>
                        <span className="text-xs font-bold text-gray-900 ml-2">{c.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Orders by Source</h3>
        {data.ordersBySource.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">No data yet</p> : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={data.ordersBySource} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={2}>
                  {data.ordersBySource.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {data.ordersBySource.map((s, i) => {
                const total = data.ordersBySource.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : "0";
                return (
                  <div key={s.source} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-gray-600 flex-1">{s.source}</span>
                    <span className="text-xs font-bold text-gray-800">{s.count}</span>
                    <span className="text-xs text-gray-400">({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── DOWNLOADS PAGE ─── */
function DownloadsPage() {
  const [downloads, setDownloads] = useState<AdminDownload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDownloads().then(setDownloads).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Download History</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-500">All Excel, PDF and CSV exports from this panel</p>
        </div>
        {loading ? <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
          : downloads.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-gray-400"><History className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">No exports yet</p></div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#f8f9fa" }}>
                    <tr>
                      {["Date & Time", "Filename", "Records", "Filters"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {downloads.map((dl) => (
                      <tr key={dl.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(dl.downloadedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-mono ${dl.filename.endsWith(".pdf") ? "text-red-600" : dl.filename.endsWith(".xlsx") ? "text-green-700" : "text-blue-600"}`}>
                            {dl.filename.endsWith(".pdf") ? <FileText className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                            {dl.filename}
                          </span>
                        </td>
                        <td className="px-4 py-3"><Badge cls="bg-green-100 text-green-700">{dl.recordCount} rows</Badge></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{dl.filters ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>
    </div>
  );
}

/* ─── SETTINGS PAGE ─── */
function SettingsPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Daily Email Report</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Mail className="w-4 h-4 text-green-600" />
            <span>Reports sent to: <span className="font-semibold">contact@prakritiherbs.in</span></span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Clock className="w-4 h-4 text-orange-500" />
            <span>Schedule: <span className="font-semibold">11:59 PM IST daily</span></span>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
          <strong>To activate email reports:</strong> Set environment variables <code className="bg-yellow-100 px-1 rounded">SMTP_HOST</code>, <code className="bg-yellow-100 px-1 rounded">SMTP_PORT</code>, <code className="bg-yellow-100 px-1 rounded">SMTP_USER</code>, and <code className="bg-yellow-100 px-1 rounded">SMTP_PASS</code> in your deployment environment.
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Admin Credentials</h3>
        <p className="text-xs text-gray-500">Change via environment variables: <code className="bg-gray-100 px-1 rounded">ADMIN_USERNAME</code> and <code className="bg-gray-100 px-1 rounded">ADMIN_PASSWORD</code></p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          Current: <strong>{sessionStorage.getItem("admin_user") ?? "admin"}</strong> — All sessions expire in 8 hours.
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Business Info</h3>
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Company:</strong> Prakriti Herbs Private Limited</p>
          <p><strong>Product:</strong> KamaSutra Gold+ @ ₹999</p>
          <p><strong>Contact 1:</strong> +91 89681 22246</p>
          <p><strong>Contact 2:</strong> +91 89681 22276</p>
          <p><strong>Email:</strong> contact@prakritiherbs.in</p>
          <p><strong>Website:</strong> prakritiherbs.in</p>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN DASHBOARD ─── */
export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState<Page>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [abandonedCount, setAbandonedCount] = useState(0);
  const adminUser = sessionStorage.getItem("admin_user") ?? "Admin";

  useEffect(() => {
    if (!isAdminLoggedIn()) { setLocation("/admin/login"); return; }
    fetchOrders({ page: 1, limit: 1 }).then((r) => setStats(r.stats)).catch(() => {});
    fetchAnalytics().then((a) => { setAnalytics(a); setAbandonedCount(a.abandonedStats.new); }).catch(() => {}).finally(() => setHomeLoading(false));
  }, [setLocation]);

  function handleLogout() { clearAdminToken(); setLocation("/admin/login"); }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalSearch(searchInput);
    setPage("orders");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar page={page} setPage={setPage} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        adminUser={adminUser} onLogout={handleLogout} stats={{ abandoned: abandonedCount }} />

      <div className="flex-1 flex flex-col lg:ml-56 min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700 flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search orders by name or mobile..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:bg-white transition-colors"
              />
            </div>
          </form>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500 hidden md:block">Welcome, {adminUser}</span>
          </div>
        </header>

        {/* Gold accent bar */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(to right, transparent, ${GOLD} 30%, #e8c96a 50%, ${GOLD} 70%, transparent)` }} />

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {page === "home" && <HomePage stats={stats} analytics={analytics} loading={homeLoading} />}
          {page === "orders" && <OrdersPage globalSearch={globalSearch} />}
          {page === "abandoned" && <AbandonedCartsPage />}
          {page === "analytics" && <AnalyticsPage />}
          {page === "downloads" && <DownloadsPage />}
          {page === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
