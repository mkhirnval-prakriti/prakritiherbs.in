import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  fetchLeadTracking, exportLeadTracking,
  type LeadEntry, type LeadFilters,
} from "@/lib/adminApi";
import {
  RefreshCw, Phone, MessageCircle, Download, PhoneCall,
  ChevronLeft, ChevronRight, Globe,
} from "lucide-react";

const G = "#1B5E20";

const CALL_STATUSES = ["all", "clicked", "missed", "answered", "called_back"];
const TYPES = ["all", "call", "whatsapp"];
const WEBSITES = [
  { value: "all", label: "All Websites" },
  { value: "PH_IN", label: "PH_IN (prakritiherbs.in)" },
  { value: "PH_COM", label: "PH_COM (prakritiherbs.com)" },
];

function toISTDate(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    clicked: "bg-blue-100 text-blue-700",
    missed: "bg-red-100 text-red-700",
    answered: "bg-green-100 text-green-700",
    called_back: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  if (type === "call") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
      <Phone className="w-3 h-3" /> Call
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
      <MessageCircle className="w-3 h-3" /> WhatsApp
    </span>
  );
}

function WebsiteBadge({ website }: { website: string | null | undefined }) {
  if (!website) return <span className="text-gray-300 text-xs italic">—</span>;
  const color = website === "PH_COM" ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      <Globe className="w-3 h-3" />{website}
    </span>
  );
}

async function downloadExcel(filters: LeadFilters) {
  const result = await exportLeadTracking(filters);
  const rows = result.data;

  function fmtRow(r: LeadEntry) {
    return {
      "DATE": new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      "WEBSITE": (r as LeadEntry & { website?: string }).website ?? "",
      "DOMAIN": (r as LeadEntry & { domain?: string }).domain ?? "",
      "TYPE": r.type.toUpperCase(),
      "STATUS": r.call_status.toUpperCase(),
      "MOBILE": r.customer_phone ?? "",
      "SOURCE": r.source.toUpperCase(),
      "EVENT_ID": r.event_id ?? "",
      "CALL_DURATION": r.call_duration ?? "",
      "PAGE_URL": r.page_url ?? "",
      "LANDING_PAGE": r.landing_page ?? "",
      "CAMPAIGN_NAME": r.campaign_name ?? "",
      "ADSET_NAME": r.adset_name ?? "",
      "AD_NAME": r.ad_name ?? "",
      "DEVICE_TYPE": r.device_type ?? "",
      "BROWSER": r.browser ?? "",
      "IP_ADDRESS": r.ip_address ?? "",
      "REFERRER": r.referrer ?? "",
      "CITY": r.city ?? "",
      "STATE": r.state ?? "",
      "COUNTRY": r.country ?? "India",
      "USER_AGENT": r.user_agent ?? "",
    };
  }

  const allSheet = XLSX.utils.json_to_sheet(rows.map(fmtRow));
  const missedSheet = XLSX.utils.json_to_sheet(rows.filter((r) => r.call_status === "missed").map(fmtRow));
  const waSheet = XLSX.utils.json_to_sheet(rows.filter((r) => r.type === "whatsapp").map(fmtRow));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, allSheet, "All Data");
  XLSX.utils.book_append_sheet(wb, missedSheet, "Missed Calls");
  XLSX.utils.book_append_sheet(wb, waSheet, "WhatsApp Leads");

  const date = new Date().toLocaleDateString("en-CA");
  XLSX.writeFile(wb, `Lead_Tracking_${date}.xlsx`);
}

const LIMIT = 50;

export function AdminLeadTracking() {
  const now = new Date();
  const [entries, setEntries] = useState<LeadEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(toISTDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(toISTDate(now));

  const filters: LeadFilters = {
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    source: sourceFilter.trim() || undefined,
    phone: phoneFilter.trim() || undefined,
    website: websiteFilter !== "all" ? websiteFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const r = await fetchLeadTracking({ ...filters, page: pg, limit: LIMIT });
      setEntries(r.data);
      setTotal(r.total);
      setPage(pg);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [typeFilter, statusFilter, sourceFilter, phoneFilter, websiteFilter, dateFrom, dateTo]); // eslint-disable-line

  useEffect(() => { void load(1); }, [load]);

  async function handleCallBack(id: number) {
    setUpdatingId(id);
    try {
      await fetch(`/api/admin/lead-tracking/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}`,
        },
        body: JSON.stringify({ callStatus: "called_back" }),
      });
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, call_status: "called_back" } : e));
    } catch { /* ignore */ }
    finally { setUpdatingId(null); }
  }

  async function handleExport() {
    setExporting(true);
    try { await downloadExcel(filters); } catch { alert("Export failed"); }
    finally { setExporting(false); }
  }

  function handleReset() {
    setTypeFilter("all");
    setStatusFilter("all");
    setSourceFilter("");
    setPhoneFilter("");
    setWebsiteFilter("all");
    const n = new Date();
    setDateFrom(toISTDate(new Date(n.getFullYear(), n.getMonth(), 1)));
    setDateTo(toISTDate(n));
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const callCount = entries.filter((e) => e.type === "call").length;
  const waCount = entries.filter((e) => e.type === "whatsapp").length;
  const missedCount = entries.filter((e) => e.call_status === "missed").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PhoneCall className="w-5 h-5" style={{ color: G }} />
            Lead Tracking
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Call + WhatsApp interactions — full data capture</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load(1)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting…" : "Download Excel"}
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Calls</p>
          <p className="text-3xl font-black text-orange-700 mt-1">{callCount}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">WhatsApp</p>
          <p className="text-3xl font-black text-green-700 mt-1">{waCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Missed</p>
          <p className="text-3xl font-black text-red-700 mt-1">{missedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Website filter — highlighted */}
          <div>
            <label className="text-xs font-semibold text-teal-600 block mb-1 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Website
            </label>
            <select value={websiteFilter} onChange={(e) => setWebsiteFilter(e.target.value)}
              className="border border-teal-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-teal-50">
              {WEBSITES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500">
              {TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "All Types" : t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500">
              {CALL_STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All Status" : s.replace("_", " ").toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Source</label>
            <input type="text" placeholder="taj, direct…" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 w-28 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Phone</label>
            <input type="text" placeholder="10-digit…" value={phoneFilter} onChange={(e) => setPhoneFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 w-32 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <PhoneCall className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No lead interactions found</p>
            <p className="text-xs mt-1">Leads will appear when users click Call or WhatsApp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-600 uppercase tracking-wider">Website</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => {
                  const e = entry as LeadEntry & { website?: string };
                  return (
                    <tr key={entry.id}
                      className={`hover:bg-gray-50 transition-colors ${entry.call_status === "missed" ? "bg-red-50/40" : entry.type === "whatsapp" ? "bg-green-50/30" : ""}`}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDT(entry.created_at)}</td>
                      <td className="px-4 py-3"><WebsiteBadge website={e.website} /></td>
                      <td className="px-4 py-3"><TypeBadge type={entry.type} /></td>
                      <td className="px-4 py-3 font-semibold text-gray-700">
                        {entry.customer_phone ? `+91 ${entry.customer_phone}` : <span className="text-gray-400 italic text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 uppercase">
                          {entry.source}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={entry.call_status} /></td>
                      <td className="px-4 py-3">
                        {entry.type === "call" && entry.call_status !== "called_back" && entry.call_status !== "answered" ? (
                          <button
                            onClick={() => void handleCallBack(entry.id)}
                            disabled={updatingId === entry.id}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white rounded-lg disabled:opacity-50 transition-all"
                            style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}
                          >
                            <Phone className="w-3 h-3" />
                            {updatingId === entry.id ? "…" : "Call Back"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => void load(page - 1)} disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-xs font-semibold text-gray-700">{page} / {totalPages}</span>
              <button onClick={() => void load(page + 1)} disabled={page >= totalPages || loading}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}

        {entries.length > 0 && total <= LIMIT && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
            {total} lead{total !== 1 ? "s" : ""}
            {loading && " · Refreshing…"}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-700 mb-1">Multi-Website Support Active</p>
        <p className="text-xs text-blue-600">
          Filter by Website (PH_IN / PH_COM) · Excel export includes WEBSITE + DOMAIN columns · 22 columns total
        </p>
        <p className="text-xs text-blue-500 mt-1">
          2nd website se data aane ke liye use karo: <code className="bg-blue-100 px-1 rounded">website: "PH_COM"</code> in the tracking payload.
        </p>
      </div>
    </div>
  );
}
