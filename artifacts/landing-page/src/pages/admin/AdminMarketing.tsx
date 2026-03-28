import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchReviews, addReview, updateReview, deleteReview,
  fetchAgencies, saveAgency, toggleAgency, deleteAgency,
  testAgencyConnection, pauseAllAgencies,
  fetchCapiLog, clearCapiLog, fetchPendingCapi, retryCapi, dismissPendingCapi,
  downloadAgencyCSV, downloadAgencyExcel, fetchAgencyStats, resetStatsDate, clearStatsResetDate,
  type Review, type AgencyProfile, type CapiLogEntry, type PendingCapiEvent, type AgencyOrderStat,
} from "@/lib/adminApi";
import {
  Star, Plus, RefreshCw, CheckCircle, XCircle, Edit3, Trash2, X,
  Building2, Eye, EyeOff, ToggleLeft, ToggleRight, AlertCircle, Zap, Globe,
  Copy, Check, Wifi, WifiOff, ShieldAlert, ShieldCheck, RotateCcw,
  Activity, Clock, AlertTriangle, Trash, Download, FileSpreadsheet,
  Package, TrendingUp, BarChart2,
} from "lucide-react";

const G = "#1B5E20";
const GOLD = "#C9A14A";
const BASE_URL = "https://prakritiherbs.in";

/* ──────────────────────────────────────────────
   Utility Components
────────────────────────────────────────────── */
function StarRating({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`w-4 h-4 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const el = document.createElement("textarea");
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" onClick={copy}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${copied ? "bg-green-100 text-green-700" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}>
      {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> {label ?? "Copy"}</>}
    </button>
  );
}

function MaskedField({ value, placeholder }: { value: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  const masked = value ? "••••••••" + value.slice(-4) : "";
  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-xs font-mono text-gray-600">
        {show ? value : (masked || <span className="text-gray-400">{placeholder ?? "—"}</span>)}
      </code>
      {value && (
        <button type="button" onClick={() => setShow((s) => !s)} className="text-gray-400 hover:text-gray-600 ml-1">
          {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      )}
    </span>
  );
}

function MarketingUrlBox({ sourceName }: { sourceName: string }) {
  if (!sourceName) return null;
  const url = `${BASE_URL}/?source=${sourceName}`;
  return (
    <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
      <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      <code className="text-xs text-blue-700 font-mono flex-1 min-w-0 truncate">{url}</code>
      <CopyButton text={url} label="Copy Link" />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Agency Modal
────────────────────────────────────────────── */
const BLANK: Omit<AgencyProfile, "id" | "createdAt"> = {
  name: "", sourceName: "", pixelId: "", businessManagerId: "", capiToken: "",
  googleAdsConversionId: "", googleAdsConversionLabel: "", ga4MeasurementId: "",
  googleSheetWebhookUrl: "", active: true,
};

function AgencyModal({ agency, onClose, onSaved }: { agency: AgencyProfile | null; onClose: () => void; onSaved: (a: AgencyProfile) => void }) {
  const isEdit = !!agency;
  const [form, setForm] = useState<Omit<AgencyProfile, "id" | "createdAt">>(
    agency
      ? { name: agency.name, sourceName: agency.sourceName, pixelId: agency.pixelId,
          businessManagerId: agency.businessManagerId, capiToken: "",
          googleAdsConversionId: agency.googleAdsConversionId,
          googleAdsConversionLabel: agency.googleAdsConversionLabel,
          ga4MeasurementId: agency.ga4MeasurementId,
          googleSheetWebhookUrl: agency.googleSheetWebhookUrl, active: agency.active }
      : { ...BLANK },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const tokenRef = useRef<HTMLInputElement>(null);

  function F(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handlePaste(key: "capiToken" | "pixelId") {
    return (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const raw = e.clipboardData.getData("text");
      // Auto-clean: strip whitespace, invisible chars, zero-width spaces
      const cleaned = raw.replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, "").trim();
      setForm((prev) => ({ ...prev, [key]: cleaned }));
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.sourceName.trim()) { setErr("Agency Name and Source Tag are required."); return; }
    setErr(""); setSaving(true);
    try {
      const payload = isEdit ? { id: agency!.id, ...form } : form;
      const saved = await saveAgency(payload);
      onSaved(saved); onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{isEdit ? "Edit Agency Profile" : "Add New Agency Profile"}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Token and Pixel ID are auto-cleaned when pasted</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-5">

          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Agency Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Agency Name *</label>
                <input value={form.name} onChange={F("name")} required placeholder="e.g. SARTAJ"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Source Tag * <span className="text-gray-400 font-normal">(unique, lowercase)</span></label>
                <input value={form.sourceName} onChange={F("sourceName")} required placeholder="e.g. sartaj"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                {form.sourceName && (
                  <p className="text-xs text-blue-600 mt-1 font-mono">{BASE_URL}/?source={form.sourceName}</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Meta / Facebook</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Pixel ID / Dataset ID</label>
                <input value={form.pixelId} onChange={F("pixelId")} onPaste={handlePaste("pixelId")}
                  placeholder="e.g. 755500930920207"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Business Manager ID</label>
                <input value={form.businessManagerId} onChange={F("businessManagerId")} placeholder="optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                CAPI Access Token {isEdit && <span className="text-gray-400 font-normal">(blank = keep existing)</span>}
                <span className="ml-1 text-green-600 font-normal">— auto-cleaned on paste</span>
              </label>
              <input ref={tokenRef} value={form.capiToken} onChange={F("capiToken")} onPaste={handlePaste("capiToken")}
                type="text" placeholder={isEdit ? "Paste new token to replace existing" : "EAAxxxxxxx..."}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                style={{ wordBreak: "break-all" }} />
              {form.capiToken && (
                <p className="text-xs text-green-600 mt-1">✓ Token length: {form.capiToken.length} chars</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Google (Optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Google Ads Conversion ID</label>
                <input value={form.googleAdsConversionId} onChange={F("googleAdsConversionId")} placeholder="AW-123456789"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">GA4 Measurement ID</label>
                <input value={form.ga4MeasurementId} onChange={F("ga4MeasurementId")} placeholder="G-XXXXXXXXXX"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Google Sheet Webhook URL</label>
              <input value={form.googleSheetWebhookUrl} onChange={F("googleSheetWebhookUrl")} type="url"
                placeholder="https://script.google.com/macros/s/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </section>

          {err && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {err}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Agency"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Marketing Hub Tab
────────────────────────────────────────────── */
type TestStatus = "idle" | "testing" | "ok" | "fail";

function MarketingHub() {
  const [agencies, setAgencies] = useState<AgencyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<AgencyProfile | null | "new">(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [agencyStats, setAgencyStats] = useState<AgencyOrderStat[]>([]);
  const [statsResetDate, setStatsResetDate] = useState<string | null>(null);
  const [statsResetting, setStatsResetting] = useState(false);
  const [resetStatsConfirm, setResetStatsConfirm] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});
  const [pausingAll, setPausingAll] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  // System Health
  const [log, setLog] = useState<CapiLogEntry[]>([]);
  const [pending, setPending] = useState<PendingCapiEvent[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAgencies(await fetchAgencies()); }
    finally { setLoading(false); }
  }, []);

  const loadHealth = useCallback(async () => {
    setLogLoading(true);
    try {
      const [l, p] = await Promise.all([fetchCapiLog(), fetchPendingCapi()]);
      setLog(l); setPending(p);
    } finally { setLogLoading(false); }
  }, []);

  const loadStats = useCallback(async () => {
    const r = await fetchAgencyStats();
    setAgencyStats(r.rows);
    setStatsResetDate(r.resetDate);
  }, []);

  useEffect(() => {
    void load();
    void loadHealth();
    void loadStats();
  }, [load, loadHealth, loadStats]);

  async function handleToggle(id: string) {
    setToggling(id);
    try {
      const { active } = await toggleAgency(id);
      setAgencies((prev) => prev.map((a) => a.id === id ? { ...a, active } : a));
    } catch (ex) { alert(ex instanceof Error ? ex.message : "Failed"); }
    finally { setToggling(null); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try { await deleteAgency(id); setAgencies((prev) => prev.filter((a) => a.id !== id)); }
    catch (ex) { alert(ex instanceof Error ? ex.message : "Failed"); }
    finally { setDeleting(null); }
  }

  async function handleResetStats() {
    setResetStatsConfirm(false); setStatsResetting(true);
    try {
      const r = await resetStatsDate();
      setStatsResetDate(r.resetDate);
      setAgencyStats([]);
      void loadStats();
    } catch (e) { alert(e instanceof Error ? e.message : "Reset failed"); }
    finally { setStatsResetting(false); }
  }

  async function handleClearStatsReset() {
    setStatsResetting(true);
    try {
      await clearStatsResetDate();
      setStatsResetDate(null);
      void loadStats();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to clear reset"); }
    finally { setStatsResetting(false); }
  }

  function handleSaved(updated: AgencyProfile) {
    setAgencies((prev) => {
      const idx = prev.findIndex((a) => a.id === updated.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
  }

  async function handleDownload(source: string, name: string) {
    setDownloading(source);
    try { await downloadAgencyCSV(source, name); }
    catch { alert("Download failed. Please try again."); }
    finally { setDownloading(null); }
  }

  async function handleDownloadExcel(source: string, name: string) {
    setDownloading(`${source}_xlsx`);
    try { await downloadAgencyExcel(source, name); }
    catch { alert("Excel export failed. Please try again."); }
    finally { setDownloading(null); }
  }

  async function handleDownloadAll() {
    setDownloading("__all__");
    try { await downloadAgencyCSV(); }
    catch { alert("Download failed. Please try again."); }
    finally { setDownloading(null); }
  }

  async function handleDownloadAllExcel() {
    setDownloading("__all_xlsx__");
    try { await downloadAgencyExcel(); }
    catch { alert("Excel export failed. Please try again."); }
    finally { setDownloading(null); }
  }

  async function handleTest(id: string) {
    setTestStatus((s) => ({ ...s, [id]: "testing" }));
    setTestMsg((s) => ({ ...s, [id]: "" }));
    try {
      const result = await testAgencyConnection(id);
      setTestStatus((s) => ({ ...s, [id]: result.ok ? "ok" : "fail" }));
      setTestMsg((s) => ({ ...s, [id]: result.message }));
      void loadHealth();
    } catch {
      setTestStatus((s) => ({ ...s, [id]: "fail" }));
      setTestMsg((s) => ({ ...s, [id]: "Network error — check connection" }));
    }
  }

  async function handlePauseAll() {
    if (!confirm("Pause ALL agencies? Their pixels will stop firing until you re-activate them.")) return;
    setPausingAll(true);
    try {
      const { paused } = await pauseAllAgencies();
      setAgencies((prev) => prev.map((a) => ({ ...a, active: false })));
      alert(`Emergency Reset complete — ${paused} agenc${paused === 1 ? "y" : "ies"} paused.`);
    } catch { alert("Failed to pause agencies"); }
    finally { setPausingAll(false); }
  }

  function handleClearCache() {
    sessionStorage.clear();
    localStorage.removeItem("admin_token");
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
    window.location.reload();
  }

  async function handleRetry(id: string) {
    setRetrying(id);
    try {
      const result = await retryCapi(id);
      if (result.ok) {
        setPending((prev) => prev.filter((e) => e.id !== id));
        alert("✅ Event resent successfully to Facebook.");
      } else {
        alert(`❌ Retry failed: ${result.message ?? "Unknown error"}`);
      }
      void loadHealth();
    } catch { alert("Retry failed"); }
    finally { setRetrying(null); }
  }

  async function handleDismiss(id: string) {
    await dismissPendingCapi(id);
    setPending((prev) => prev.filter((e) => e.id !== id));
  }

  const activeCount = agencies.filter((a) => a.active).length;

  return (
    <div className="space-y-6">
      {modal !== null && (
        <AgencyModal
          agency={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={(a) => { handleSaved(a); setModal(null); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Marketing Hub</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage agency tracking profiles, pixels, and CAPI connections</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={!!downloading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-50">
            {downloading === "__all__" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            All CSV
          </button>
          <button
            onClick={handleDownloadAllExcel}
            disabled={!!downloading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-50">
            {downloading === "__all_xlsx__" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            All Excel
          </button>
          <button onClick={() => setModal("new")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-110" style={{ background: G }}>
            <Plus className="w-3.5 h-3.5" /> Add Agency
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Total Agencies", agencies.length, "bg-white border-gray-200 text-gray-800"],
          ["Active", activeCount, "bg-green-50 border-green-200 text-green-800"],
          ["Paused", agencies.length - activeCount, "bg-gray-50 border-gray-200 text-gray-600"],
        ].map(([label, value, cls]) => (
          <div key={label as string} className={`rounded-xl border px-4 py-3 ${cls as string}`}>
            <p className="text-xs opacity-60 uppercase font-semibold">{label as string}</p>
            <p className="text-2xl font-bold">{value as number}</p>
          </div>
        ))}
      </div>

      {/* Agency Cards */}
      {loading && agencies.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
      ) : agencies.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center py-12 text-gray-400">
          <Building2 className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No agencies yet</p>
          <p className="text-xs mt-1 opacity-60">Click "Add Agency" to create your first tracking profile</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agencies.map((agency) => {
            const ts = testStatus[agency.id] ?? "idle";
            const tm = testMsg[agency.id] ?? "";
            return (
              <div key={agency.id} className={`bg-white rounded-xl border p-4 transition-all ${agency.active ? "border-green-200" : "border-gray-200 opacity-75"}`}>
                {/* Top row: name + status + actions */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-bold text-gray-900 text-base">{agency.name}</span>
                      <code className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: GOLD + "22", color: GOLD }}>
                        source: {agency.sourceName}
                      </code>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${agency.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {agency.active ? <><Zap className="w-3 h-3" /> Active</> : "Paused"}
                      </span>
                    </div>

                    {/* Tracking fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-500 mb-2">
                      {agency.pixelId && (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-gray-400 w-16 flex-shrink-0">Pixel ID</span>
                          <MaskedField value={agency.pixelId} />
                        </div>
                      )}
                      {agency.capiToken && (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-gray-400 w-16 flex-shrink-0">CAPI</span>
                          <MaskedField value={agency.capiToken} />
                        </div>
                      )}
                      {agency.ga4MeasurementId && (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-gray-400 w-16 flex-shrink-0">GA4</span>
                          <code className="font-mono text-gray-600">{agency.ga4MeasurementId}</code>
                        </div>
                      )}
                    </div>

                    {/* Marketing URL box */}
                    <MarketingUrlBox sourceName={agency.sourceName} />

                    {/* Test result */}
                    {ts !== "idle" && (
                      <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${ts === "ok" ? "bg-green-50 text-green-700" : ts === "fail" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-600"}`}>
                        {ts === "testing" ? <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0 mt-0.5" /> :
                          ts === "ok" ? <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                        <span>{ts === "testing" ? "Testing connection to Facebook..." : tm}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggle(agency.id)} disabled={toggling === agency.id}
                        title={agency.active ? "Pause agency" : "Activate agency"}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        {agency.active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                      </button>
                      <button onClick={() => setModal(agency)} title="Edit" className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(agency.id, agency.name)} disabled={deleting === agency.id}
                        title="Delete" className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleTest(agency.id)}
                      disabled={ts === "testing"}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${ts === "testing" ? "bg-gray-100 text-gray-400" : ts === "ok" ? "bg-green-100 text-green-700" : ts === "fail" ? "bg-red-100 text-red-700" : "bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700"}`}>
                      {ts === "testing" ? <><RefreshCw className="w-3 h-3 animate-spin" /> Testing...</> :
                        ts === "ok" ? <><Wifi className="w-3 h-3" /> Connected</> :
                        ts === "fail" ? <><WifiOff className="w-3 h-3" /> Failed</> :
                        <><Wifi className="w-3 h-3" /> Test Connection</>}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDownload(agency.sourceName, agency.name)}
                        disabled={!!downloading}
                        title="Download CSV"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-50">
                        {downloading === agency.sourceName
                          ? <><RefreshCw className="w-3 h-3 animate-spin" /> CSV...</>
                          : <><Download className="w-3 h-3" /> CSV</>}
                      </button>
                      <button
                        onClick={() => handleDownloadExcel(agency.sourceName, agency.name)}
                        disabled={!!downloading}
                        title="Download Excel (.xlsx)"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-50">
                        {downloading === `${agency.sourceName}_xlsx`
                          ? <><RefreshCw className="w-3 h-3 animate-spin" /> Excel...</>
                          : <><FileSpreadsheet className="w-3 h-3" /> Excel</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* System Health */}
      <div className="border-t border-gray-200 pt-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <h3 className="font-bold text-gray-800">System Health</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearCache}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${cacheCleared ? "bg-green-100 text-green-700" : "bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700"}`}>
              <RotateCcw className="w-3.5 h-3.5" />
              {cacheCleared ? "Cache Cleared! Reloading..." : "Clear Cache & Reload"}
            </button>
            <button
              onClick={handlePauseAll}
              disabled={pausingAll || agencies.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50">
              <AlertTriangle className="w-3.5 h-3.5" />
              {pausingAll ? "Pausing..." : "Emergency Reset — Pause All"}
            </button>
          </div>
        </div>

        {/* Reset Stats Confirmation Modal */}
        {resetStatsConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Stats Reset करें?</h3>
                  <p className="text-xs text-gray-500">डेटा delete नहीं होगा — सिर्फ view बदलेगा</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-5">
                आज से नई tracking शुरू होगी। पुराने orders का data safe रहेगा, सिर्फ
                <strong> "Orders by Source"</strong> आज की date से show करेगा।
              </p>
              <div className="flex gap-2">
                <button onClick={() => setResetStatsConfirm(false)} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">रद्द करें</button>
                <button onClick={() => void handleResetStats()} disabled={statsResetting}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60">
                  {statsResetting ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : "हाँ, Reset करें"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Agency Order Stats */}
        {(agencyStats.length > 0 || statsResetDate) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-sm text-gray-800">Orders by Source</span>
                {statsResetDate ? (
                  <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    📅 {new Date(statsResetDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })} से
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 ml-1">— सभी समय</span>
                )}
                {statsResetDate && (
                  <button onClick={() => void handleClearStatsReset()} disabled={statsResetting}
                    className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50">
                    All Time दिखाएं
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResetStatsConfirm(true)}
                  disabled={statsResetting}
                  title="आज से नई tracking शुरू करें"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 disabled:opacity-50">
                  {statsResetting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Reset Stats
                </button>
                <button
                  onClick={handleDownloadAll}
                  disabled={!!downloading}
                  className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-50">
                  {downloading === "__all__" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
                  Export All
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {agencyStats.map((s) => {
                const agency = agencies.find((a) => a.sourceName.toLowerCase() === s.source.toLowerCase());
                const pct = s.total_orders > 0 ? Math.round((s.delivered / s.total_orders) * 100) : 0;
                return (
                  <div key={s.source} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-36 shrink-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{agency?.name || s.source}</p>
                      <p className="text-xs text-gray-400 font-mono">?source={s.source}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                        <Package className="w-3 h-3" /> {s.total_orders} total
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" /> {s.delivered} delivered
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
                        <TrendingUp className="w-3 h-3" /> {pct}% conv.
                      </span>
                      {s.cancelled > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs">
                          <XCircle className="w-3 h-3" /> {s.cancelled} cancelled
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={() => handleDownload(s.source, agency?.name || s.source)}
                        disabled={!!downloading}
                        title="Download CSV"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-50">
                        {downloading === s.source
                          ? <><RefreshCw className="w-3 h-3 animate-spin" /> CSV...</>
                          : <><Download className="w-3 h-3" /> CSV</>}
                      </button>
                      <button
                        onClick={() => handleDownloadExcel(s.source, agency?.name || s.source)}
                        disabled={!!downloading}
                        title="Download Excel (.xlsx)"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-50">
                        {downloading === `${s.source}_xlsx`
                          ? <><RefreshCw className="w-3 h-3 animate-spin" /> Excel...</>
                          : <><FileSpreadsheet className="w-3 h-3" /> Excel</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">CAPI Activity Log</span>
              <span className="text-xs text-gray-400">— last {log.length} events</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadHealth} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" title="Refresh log">
                <RefreshCw className={`w-3.5 h-3.5 ${logLoading ? "animate-spin" : ""}`} />
              </button>
              {log.length > 0 && (
                <button onClick={async () => { await clearCapiLog(); setLog([]); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors">
                  <Trash className="w-3 h-3" />
                  Clear Log
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {log.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-gray-400 text-xs">No activity yet — use "Test Connection" to generate entries</div>
            ) : log.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="mt-0.5 flex-shrink-0">
                  {entry.status === "success"
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">{entry.agencyName}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{entry.event}</span>
                    <span className={`text-xs font-semibold ${entry.status === "success" ? "text-green-600" : "text-red-600"}`}>
                      {entry.status === "success" ? "✅ Success" : "❌ Failed"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.message}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending CAPI Events */}
        {pending.length > 0 && (
          <div className="bg-orange-50 rounded-xl border border-orange-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-sm font-semibold text-orange-800">Failed Events — Pending Retry ({pending.length})</span>
              </div>
            </div>
            <div className="divide-y divide-orange-100 max-h-48 overflow-y-auto">
              {pending.map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-orange-800">{event.agencyName}</span>
                      <span className="text-xs text-orange-600">· {event.event ?? "Lead"}</span>
                    </div>
                    <p className="text-xs text-orange-600 mt-0.5">
                      {new Date(event.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleRetry(event.id)} disabled={retrying === event.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-100 hover:bg-orange-200 text-orange-700 disabled:opacity-50">
                      <RotateCcw className={`w-3 h-3 ${retrying === event.id ? "animate-spin" : ""}`} />
                      {retrying === event.id ? "Retrying..." : "Retry"}
                    </button>
                    <button onClick={() => handleDismiss(event.id)} className="p-1 rounded text-gray-400 hover:text-red-500" title="Dismiss">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">How Multi-Agency CAPI works</p>
          <ul className="list-disc list-inside space-y-0.5 opacity-80">
            <li><strong>Main pixel always fires</strong> — regardless of source, every order reaches your primary Meta pixel.</li>
            <li><strong>Agency pixel fires</strong> only when URL has <code>?source=sartaj</code> (or matching source tag).</li>
            <li><strong>Test Connection</strong> sends a test event to Facebook and shows ✅ or ❌ with the exact error.</li>
            <li><strong>Emergency Reset</strong> pauses all agency pixels instantly — use if site becomes slow.</li>
            <li><strong>CAPI tokens</strong> are masked for staff — only last 4 chars visible.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Reviews Tab
────────────────────────────────────────────── */
function ReviewsTab() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, avgRating: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editReview, setEditReview] = useState<Review | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchReviews({ status: statusFilter });
      setReviews(r.reviews); setTotal(r.total); setStats(r.stats);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function handleApprove(id: number) {
    await updateReview(id, { status: "approved" });
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status: "approved" } : r));
  }
  async function handleDelete(id: number) {
    if (!confirm("Delete this review?")) return;
    await deleteReview(id);
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-5">
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Add Review</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const r = await addReview({ reviewerName: fd.get("name") as string, rating: Number(fd.get("rating")), reviewText: fd.get("text") as string, city: fd.get("city") as string, status: "approved", verified: true });
              setReviews((prev) => [r, ...prev]); setShowAdd(false);
            }} className="p-5 space-y-4">
              <input name="name" required placeholder="Customer Name *" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input name="city" placeholder="City" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select name="rating" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                {[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} Star{n > 1 ? "s" : ""}</option>)}
              </select>
              <textarea name="text" required rows={3} placeholder="Review text *" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: G }}>Add Review</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Edit Review</h3>
              <button onClick={() => setEditReview(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const r = await updateReview(editReview.id, { reviewerName: fd.get("name") as string, reviewText: fd.get("text") as string, city: fd.get("city") as string, rating: Number(fd.get("rating")) });
              setReviews((prev) => prev.map((x) => x.id === r.id ? r : x)); setEditReview(null);
            }} className="p-5 space-y-4">
              <input name="name" defaultValue={editReview.reviewerName} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input name="city" defaultValue={editReview.city ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select name="rating" defaultValue={editReview.rating} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                {[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} Star{n > 1 ? "s" : ""}</option>)}
              </select>
              <textarea name="text" defaultValue={editReview.reviewText} required rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditReview(null)} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: G }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Customer Reviews</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage reviews shown on the landing page</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-110" style={{ background: G }}>
          <Plus className="w-3.5 h-3.5" /> Add Review
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Total Reviews", stats.total, "bg-white border-gray-200 text-gray-800"],
          ["Pending", stats.pending, "bg-yellow-50 border-yellow-200 text-yellow-800"],
          ["Approved", stats.approved, "bg-green-50 border-green-200 text-green-800"],
          ["Avg Rating", stats.avgRating.toFixed(1) + " ★", "bg-amber-50 border-amber-200 text-amber-800"],
        ].map(([label, value, cls]) => (
          <div key={label as string} className={`rounded-xl border px-4 py-3 ${cls as string}`}>
            <p className="text-xs opacity-60 uppercase font-semibold">{label as string}</p>
            <p className="text-2xl font-bold">{typeof value === "number" ? value : String(value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {[["all","All"],["pending","Pending"],["approved","Approved"],["rejected","Rejected"]].map(([v,l]) => (
              <button key={v} onClick={() => setStatusFilter(v as string)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === v ? "bg-green-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{l as string}</button>
            ))}
          </div>
          <button onClick={load} disabled={loading} className="px-2 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className="text-xs text-gray-400">{total} reviews</span>
        </div>
      </div>

      <div className="space-y-3">
        {loading && reviews.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-32 text-gray-400">
            <Star className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No reviews found</p>
          </div>
        ) : reviews.map((review) => (
          <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900">{review.reviewerName}</span>
                  {review.city && <span className="text-xs text-gray-500">• {review.city}</span>}
                  {review.verified && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> Verified</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${review.status === "approved" ? "bg-green-100 text-green-700" : review.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                    {review.status}
                  </span>
                </div>
                <StarRating rating={review.rating} />
                <p className="text-sm text-gray-700 mt-2 leading-relaxed">{review.reviewText}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {review.status === "pending" && (
                  <button onClick={() => handleApprove(review.id)} className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600"><CheckCircle className="w-4 h-4" /></button>
                )}
                <button onClick={() => setEditReview(review)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(review.id)} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main Export
────────────────────────────────────────────── */
export function AdminMarketing() {
  const [tab, setTab] = useState<"hub" | "reviews">("hub");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Marketing</h1>
        <p className="text-xs text-gray-500 mt-0.5">Agency tracking profiles, health monitoring, and customer reviews</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab("hub")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === "hub" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Marketing Hub</span>
        </button>
        <button onClick={() => setTab("reviews")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === "reviews" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> Reviews</span>
        </button>
      </div>

      {tab === "hub" ? <MarketingHub /> : <ReviewsTab />}
    </div>
  );
}
