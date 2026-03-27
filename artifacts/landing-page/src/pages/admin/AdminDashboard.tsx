import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  fetchOrders, updateOrderStatus, fetchDownloads, exportOrdersToCSV, logDownload,
  clearAdminToken, isAdminLoggedIn,
  type Order, type OrderStats, type AdminDownload,
} from "@/lib/adminApi";
import {
  Search, RefreshCw, Download, LogOut, Package,
  ChevronLeft, ChevronRight, BarChart3, History, Filter,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Confirmed: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Shipped: "bg-purple-100 text-purple-700 border-purple-200",
  Delivered: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-gray-100 text-gray-700 border-gray-200",
};
const ALL_STATUSES = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];

type Tab = "orders" | "downloads";

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 border ${color} flex flex-col gap-1`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

function StatusSelect({ orderId, currentStatus, onUpdate }: {
  orderId: number;
  currentStatus: string;
  onUpdate: (id: number, status: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;
    setLoading(true);
    try {
      await updateOrderStatus(orderId, newStatus);
      onUpdate(orderId, newStatus);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  }
  const cls = STATUS_COLORS[currentStatus] ?? "bg-gray-100 text-gray-700";
  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={loading}
      className={`text-xs font-semibold border rounded-full px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-1 ${cls}`}
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloads, setDownloads] = useState<AdminDownload[]>([]);
  const [dlLoading, setDlLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const LIMIT = 25;

  const adminUser = sessionStorage.getItem("admin_user") ?? "Admin";

  useEffect(() => {
    if (!isAdminLoggedIn()) {
      setLocation("/admin/login");
    }
  }, [setLocation]);

  const loadOrders = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const result = await fetchOrders({ search, status: statusFilter, dateFrom, dateTo, page: pg, limit: LIMIT });
      setOrders(result.orders);
      setStats(result.stats);
      setTotal(result.total);
      setPage(pg);
    } catch {
      alert("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    void loadOrders(1);
  }, [loadOrders]);

  useEffect(() => {
    if (tab === "downloads") {
      setDlLoading(true);
      fetchDownloads().then(setDownloads).finally(() => setDlLoading(false));
    }
  }, [tab]);

  function handleLogout() {
    clearAdminToken();
    setLocation("/admin/login");
  }

  async function handleExport() {
    setLoading(true);
    try {
      const result = await fetchOrders({ search, status: statusFilter, dateFrom, dateTo, page: 1, limit: 10000 });
      const now = new Date().toISOString().slice(0, 10);
      const filename = `prakriti_orders_${now}.csv`;
      exportOrdersToCSV(result.orders, filename);
      const filterSummary = [
        search && `search=${search}`,
        statusFilter !== "all" && `status=${statusFilter}`,
        dateFrom && `from=${dateFrom}`,
        dateTo && `to=${dateTo}`,
      ].filter(Boolean).join(", ") || "all orders";
      await logDownload(filename, result.orders.length, filterSummary);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleStatusUpdate(id: number, status: string) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    if (stats) {
      void loadOrders(page);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void loadOrders(1);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%)" }} className="shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2" style={{ borderColor: "#C9A14A" }}>
                <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Prakriti Herbs</p>
                <p className="text-xs" style={{ color: "#C9A14A" }}>Admin Panel</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white text-xs hidden sm:block opacity-75">Welcome, {adminUser}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </div>
        </div>
        {/* Gold underline */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(to right, transparent, #C9A14A 30%, #e8c96a 50%, #C9A14A 70%, transparent)" }} />
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <StatCard label="Total Orders" value={stats.total} color="bg-white border-gray-200 text-gray-800" />
            <StatCard label="Today" value={stats.today} color="bg-blue-50 border-blue-200 text-blue-800" />
            <StatCard label="New" value={stats.new} color="bg-blue-50 border-blue-200 text-blue-800" />
            <StatCard label="Confirmed" value={stats.confirmed} color="bg-yellow-50 border-yellow-200 text-yellow-800" />
            <StatCard label="Shipped" value={stats.shipped} color="bg-purple-50 border-purple-200 text-purple-800" />
            <StatCard label="Delivered" value={stats.delivered} color="bg-green-50 border-green-200 text-green-800" />
            <StatCard label="Cancelled" value={stats.cancelled} color="bg-red-50 border-red-200 text-red-800" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-5">
          <button
            onClick={() => setTab("orders")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "orders" ? "border-green-700 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Package className="w-4 h-4" /> Orders
          </button>
          <button
            onClick={() => setTab("downloads")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "downloads" ? "border-green-700 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <History className="w-4 h-4" /> Download History
          </button>
        </div>

        {tab === "orders" && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px] relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or mobile..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 bg-white"
                >
                  <option value="all">All Status</option>
                  {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
                    style={{ background: "#1B5E20" }}
                  >
                    <Filter className="w-3.5 h-3.5" /> Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); void loadOrders(1); }}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadOrders(page)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, #C9A14A, #e8c96a)", color: "#1B5E20" }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>
                </div>
              </form>
              <p className="text-xs text-gray-500 mt-2">
                Showing {orders.length} of {total} orders
              </p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loading && orders.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <div className="flex items-center gap-2 text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading orders...</span>
                  </div>
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">No orders found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ background: "#f8f9fa" }}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Date (IST)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Mobile</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden lg:table-cell">Address</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">Pincode</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden sm:table-cell">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">Order ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map((order, idx) => (
                        <tr
                          key={order.id}
                          className={`hover:bg-green-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                        >
                          <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{order.name}</td>
                          <td className="px-4 py-3 text-gray-700 font-mono">{order.phone}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate hidden lg:table-cell" title={order.address}>{order.address}</td>
                          <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{order.pincode}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {order.source}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusSelect
                              orderId={order.id}
                              currentStatus={order.status}
                              onUpdate={handleStatusUpdate}
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono hidden md:table-cell">{order.orderId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void loadOrders(page - 1)}
                      disabled={page <= 1 || loading}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    <button
                      onClick={() => void loadOrders(page + 1)}
                      disabled={page >= totalPages || loading}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "downloads" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Export Download History</h3>
              <p className="text-xs text-gray-500 mt-0.5">Track all CSV exports from this panel</p>
            </div>
            {dlLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : downloads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <History className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No exports yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#f8f9fa" }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Filename</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Records</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Filters Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {downloads.map((dl) => (
                      <tr key={dl.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {new Date(dl.downloadedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{dl.filename}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            {dl.recordCount} rows
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{dl.filters ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
