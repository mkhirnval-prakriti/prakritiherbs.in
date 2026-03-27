import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchOrders, updateOrderStatus, exportOrdersToXLSX, exportSingleOrderToXLSX,
  exportSingleOrderToPDF, exportOrdersToPDF, exportOrdersToCSV, logDownload,
  bulkUpdateOrderStatus, shipViaShinprocket, updateIndiaPostTracking,
  sendWhatsAppToOrder,
  type Order, type OrderStats,
} from "@/lib/adminApi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Search, RefreshCw, Download, Filter, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Package, CheckSquare, Square, AlertCircle,
  Printer, Truck, MessageSquare, BadgeCheck, Star, X,
} from "lucide-react";

const G = "#1B5E20";
const GOLD = "#C9A14A";
const ALL_STATUSES = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];
const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Confirmed: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Shipped: "bg-purple-100 text-purple-700 border-purple-200",
  Delivered: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};

function fmtIST(d: string) {
  const dt = new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return dt.replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s/, "$3-$2-$1 ");
}
function fmtShort(d: string) {
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

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

function IndiaPostModal({ orderId, onClose, onSave }: { orderId: number; onClose: () => void; onSave: (id: number, track: string) => void }) {
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!val.trim()) return;
    setSaving(true);
    try { await updateIndiaPostTracking(orderId, val.trim()); onSave(orderId, val.trim()); onClose(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">India Post Tracking</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Enter the India Post consignment number for this order.</p>
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. EM123456789IN"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Cancel</button>
          <button onClick={save} disabled={saving || !val.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: G }}>
            {saving ? "Saving..." : "Save Tracking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const defaultMsg = `नमस्ते ${order.name} जी! आपका KamaSutra Gold+ ऑर्डर #${order.orderId} ${order.status} है। - Prakriti Herbs`;
  const [msg, setMsg] = useState(defaultMsg);
  const [sending, setSending] = useState(false);
  async function send() {
    setSending(true);
    try { await sendWhatsAppToOrder(order.id, msg); alert("✅ WhatsApp message sent!"); onClose(); }
    catch (err) { alert(err instanceof Error ? err.message : "WhatsApp send failed"); }
    finally { setSending(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-green-600" /> Send WhatsApp</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-1">To: <strong>+91{order.phone}</strong> ({order.name})</p>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 mb-4 resize-none" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Cancel</button>
          <button onClick={send} disabled={sending}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#25D366" }}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function printGSTInvoice(order: Order, settings: Record<string, string>) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFillColor(27, 94, 32); doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(201, 161, 74); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("PRAKRITI HERBS PRIVATE LIMITED", 105, 12, { align: "center" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(255, 255, 255);
  doc.text(`GSTIN: ${settings["gst_number"] ?? "[GSTIN Not Set]"} | PAN: ${settings["company_pan"] ?? "[PAN Not Set]"}`, 105, 19, { align: "center" });
  doc.text("contact@prakritiherbs.in | +91 89681 22246 | prakritiherbs.in", 105, 25, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", 105, 44, { align: "center" });

  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const d = new Date(order.createdAt);
  const invoiceDate = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric" });
  const invoiceTime = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
  doc.text(`Invoice No: INV-${order.orderId}`, 14, 54);
  doc.text(`Date: ${invoiceDate} ${invoiceTime} (IST)`, 14, 60);
  doc.text(`Order ID: ${order.orderId}`, 14, 66);
  if (order.paymentId) doc.text(`Payment ID: ${order.paymentId}`, 14, 72);
  if (order.paymentMethod) doc.text(`Payment Mode: ${order.paymentMethod}`, 14, 78);

  doc.setFont("helvetica", "bold"); doc.text("Bill To:", 120, 54);
  doc.setFont("helvetica", "normal");
  doc.text(order.name, 120, 60);
  doc.text(`Ph: ${order.phone}`, 120, 66);
  const addrLines = doc.splitTextToSize(order.address, 70);
  doc.text(addrLines, 120, 72);
  doc.text(`PIN: ${order.pincode}`, 120, 72 + addrLines.length * 5);

  const amt = 999 * order.quantity;
  const gstAmt = Math.round(amt * 18 / 118);
  const baseAmt = amt - gstAmt;
  const igstAmt = gstAmt;

  autoTable(doc, {
    startY: 100,
    head: [["#", "Description", "HSN", "Qty", "Base Rate (₹)", "IGST 18% (₹)", "Total (₹)"]],
    body: [[
      "1", "KamaSutra Gold+ (Ayurvedic)\nPrakriti Herbs", "3004",
      String(order.quantity), `₹${baseAmt.toLocaleString()}`,
      `₹${igstAmt.toLocaleString()}`, `₹${amt.toLocaleString()}`,
    ]],
    foot: [
      ["", "", "", "", "Subtotal", "", `₹${baseAmt.toLocaleString()}`],
      ["", "", "", "", "IGST @ 18%", "", `₹${igstAmt.toLocaleString()}`],
      ["", "", "", "", "TOTAL (COD)", "", `₹${amt.toLocaleString()}`],
    ],
    headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: [245, 250, 245], textColor: [27, 94, 32], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 3 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? 160;
  doc.setFontSize(8);
  doc.text("Amount in Words: " + toWords(amt), 14, finalY + 10);
  doc.setFontSize(8); doc.setTextColor(100, 100, 100);
  doc.text("Bank Details: [Add your bank details here]", 14, finalY + 18);
  doc.text("Terms: Goods once sold will not be taken back or exchanged.", 14, finalY + 24);

  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", 150, finalY + 40);
  doc.text(`${settings["director_name"] ?? "Director"}`, 150, finalY + 47);
  doc.text("Prakriti Herbs Private Limited", 150, finalY + 53);
  doc.line(135, finalY + 36, 200, finalY + 36);

  doc.setFontSize(7); doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated invoice. | Subject to Jaipur, Rajasthan Jurisdiction.", 105, 287, { align: "center" });
  doc.save(`invoice_${order.orderId}.pdf`);
}

function toWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n === 0) return "Zero";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + toWords(n % 100) : "");
  if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
  return n.toLocaleString();
}

function RowActions({ order, onShipped, settings }: { order: Order; onShipped: (id: number) => void; settings: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [shipLoading, setShipLoading] = useState(false);
  const [showIndiaPost, setShowIndiaPost] = useState(false);
  const [showWA, setShowWA] = useState(false);

  async function handleShiprocket() {
    setOpen(false); setShipLoading(true);
    try {
      const r = await shipViaShinprocket(order.id);
      alert(`✅ Shipped via ${r.courier}!\nAWB: ${r.awb}\n🔗 ${r.trackingUrl}`);
      onShipped(order.id);
    } catch (err) { alert(err instanceof Error ? err.message : "Shiprocket failed"); }
    finally { setShipLoading(false); }
  }

  return (
    <>
      {showIndiaPost && <IndiaPostModal orderId={order.id} onClose={() => setShowIndiaPost(false)} onSave={(_, t) => { alert(`✅ India Post tracking saved: ${t}`); onShipped(order.id); }} />}
      {showWA && <WhatsAppModal order={order} onClose={() => setShowWA(false)} />}

      <div className="flex items-center gap-1">
        <button onClick={() => setShowWA(true)} title="Send WhatsApp"
          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors">
          <MessageSquare className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <button onClick={() => setOpen((v) => !v)} disabled={shipLoading} title="Download / Ship"
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
            {shipLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-[200px]">
                <div className="px-3 py-1.5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Download</p>
                </div>
                <button onClick={() => { exportSingleOrderToXLSX(order); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-green-50">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> Excel (.xlsx)
                </button>
                <button onClick={() => { exportSingleOrderToPDF(order); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-red-50">
                  <FileText className="w-3.5 h-3.5 text-red-600" /> PDF
                </button>
                <button onClick={() => { printGSTInvoice(order, settings); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-purple-50">
                  <Printer className="w-3.5 h-3.5 text-purple-600" /> GST Invoice
                </button>
                <div className="px-3 py-1.5 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Ship</p>
                </div>
                <button onClick={handleShiprocket}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-blue-50">
                  <Truck className="w-3.5 h-3.5 text-blue-600" /> Shiprocket
                </button>
                <button onClick={() => { setShowIndiaPost(true); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-orange-50">
                  <Package className="w-3.5 h-3.5 text-orange-600" /> India Post (Manual)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function AdminOrders({ globalSearch, settings }: { globalSearch: string; settings: Record<string, string> }) {
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
    setLoading(true); setSelected(new Set());
    try {
      const r = await fetchOrders({ search, status: statusFilter, dateFrom, dateTo, page: pg, limit: LIMIT });
      setOrders(r.orders); setStats(r.stats); setTotal(r.total); setPage(pg);
    } catch { alert("Failed to load orders"); }
    finally { setLoading(false); }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { void loadOrders(1); }, [loadOrders]);
  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  function toggleSelect(id: number) { setSelected((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
  function toggleAll() { setSelected((p) => p.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))); }

  async function handleBulkUpdate() {
    if (selected.size === 0) return;
    if (!confirm(`Mark ${selected.size} orders as "${bulkStatus}"?`)) return;
    setBulkLoading(true);
    try { const r = await bulkUpdateOrderStatus([...selected], bulkStatus); alert(`✅ ${r.updated} orders updated`); void loadOrders(page); }
    catch { alert("Bulk update failed"); }
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
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          {stats && <p className="text-xs text-gray-500">{stats.total.toLocaleString()} total · {stats.today} today · {stats.new} new</p>}
        </div>
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
                {(["xlsx", "pdf", "csv"] as const).map((t) => (
                  <button key={t} onClick={() => handleExport(t)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <FileSpreadsheet className="w-4 h-4 text-green-600" /> {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {[["Total", stats.total, "text-gray-800 bg-white border-gray-200"], ["Today", stats.today, "text-blue-800 bg-blue-50 border-blue-200"], ["New", stats.new, "text-blue-700 bg-blue-50 border-blue-100"], ["Confirmed", stats.confirmed, "text-yellow-700 bg-yellow-50 border-yellow-100"], ["Shipped", stats.shipped, "text-purple-700 bg-purple-50 border-purple-100"], ["Delivered", stats.delivered, "text-green-700 bg-green-50 border-green-100"], ["Cancelled", stats.cancelled, "text-red-700 bg-red-50 border-red-100"]].map(([label, value, cls]) => (
            <div key={label as string} className={`rounded-xl border px-3 py-2 ${cls as string}`}>
              <p className="text-xs opacity-60 uppercase font-semibold">{label as string}</p>
              <p className="text-lg font-bold">{(value as number).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

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
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
          <span className="text-gray-400 text-sm self-center">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
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

        {selected.size > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-600">{selected.size} selected</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none">
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleBulkUpdate} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60" style={{ background: G }}>
              {bulkLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />} Apply
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">{orders.length} of {total} orders</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && orders.length === 0 ? <div className="flex items-center justify-center h-32 gap-2 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin" /> Loading...</div>
          : orders.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-gray-400"><Package className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">No orders found</p></div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#f8f9fa" }}>
                    <tr>
                      <th className="px-3 py-3 text-left">
                        <button onClick={toggleAll} className="text-gray-400 hover:text-gray-700">
                          {selected.size === orders.length ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      {["Date", "Name", "Mobile", "Address", "PIN", "Qty/Amt", "Payment", "Status", "Tracking", "Actions"].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
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
                          <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtShort(order.createdAt)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-900">{order.name}</span>
                              {order.isRepeat && <span title="Repeat Customer" className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><Star className="w-2.5 h-2.5" /> Repeat</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-700 font-mono text-xs">{order.phone}</td>
                          <td className="px-3 py-3 text-gray-600 max-w-[160px] truncate text-xs" title={order.address}>{order.address}</td>
                          <td className={`px-3 py-3 text-xs font-mono ${badPin ? "text-red-600 font-bold" : "text-gray-600"}`}>
                            <div className="flex items-center gap-0.5">
                              {order.pincode}
                              {badPin && <AlertCircle className="w-3 h-3 text-red-500" />}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <div className="text-gray-700 font-medium">×{order.quantity}</div>
                            <div className="text-green-700 font-bold">₹{(999 * order.quantity).toLocaleString()}</div>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <div className="font-medium text-gray-700">{order.paymentMethod ?? "COD"}</div>
                            {order.paymentId && <div className="text-gray-400 font-mono text-xs truncate max-w-[80px]" title={order.paymentId ?? ""}>{order.paymentId}</div>}
                            <div className={`text-xs font-semibold ${order.paymentStatus === "success" ? "text-green-600" : "text-orange-500"}`}>{order.paymentStatus ?? "pending"}</div>
                          </td>
                          <td className="px-3 py-3">
                            <StatusSelect orderId={order.id} currentStatus={order.status} onUpdate={(id, s) => setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: s } : o))} />
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {order.trackingId ? (
                              <div>
                                <div className="text-gray-500 text-xs">{order.courier}</div>
                                <a href={order.courier === "India Post" ? `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx` : `https://shiprocket.co/tracking/${order.trackingId}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline font-mono text-xs">{order.trackingId}</a>
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <RowActions order={order} settings={settings} onShipped={() => void loadOrders(page)} />
                          </td>
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
