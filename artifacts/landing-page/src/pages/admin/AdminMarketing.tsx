import { useState, useEffect, useCallback } from "react";
import {
  fetchReviews, addReview, updateReview, deleteReview,
  fetchAgencies, saveAgency, toggleAgency, deleteAgency,
  type Review, type AgencyProfile,
} from "@/lib/adminApi";
import {
  Star, Plus, RefreshCw, CheckCircle, XCircle, Edit3, Trash2, X,
  Building2, Eye, EyeOff, ToggleLeft, ToggleRight, AlertCircle, Zap, Globe,
} from "lucide-react";

const G = "#1B5E20";
const GOLD = "#C9A14A";

/* ──────────────────────────────────────────────
   Shared helpers
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

function MaskedField({ value, placeholder }: { value: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  const masked = value ? "••••••••" + value.slice(-4) : "";
  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-xs font-mono text-gray-600">{show ? value : masked || <span className="text-gray-400">{placeholder ?? "—"}</span>}</code>
      {value && (
        <button type="button" onClick={() => setShow((s) => !s)} className="text-gray-400 hover:text-gray-600 ml-1">
          {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      )}
    </span>
  );
}

/* ──────────────────────────────────────────────
   Review modals (unchanged)
────────────────────────────────────────────── */
function AddReviewModal({ onClose, onAdded }: { onClose: () => void; onAdded: (r: Review) => void }) {
  const [form, setForm] = useState({ reviewerName: "", rating: 5, reviewText: "", phone: "", city: "", status: "approved", verified: true });
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.reviewerName || !form.reviewText) return;
    setSaving(true);
    try { const r = await addReview(form); onAdded(r); onClose(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Add Review</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Customer Name *</label>
            <input value={form.reviewerName} onChange={(e) => setForm({ ...form, reviewerName: e.target.value })} required placeholder="e.g. Rajesh Kumar"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">City</label>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Jaipur"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Rating *</label>
            <StarRating rating={form.rating} onChange={(r) => setForm({ ...form, rating: r })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Review Text *</label>
            <textarea value={form.reviewText} onChange={(e) => setForm({ ...form, reviewText: e.target.value })} required rows={3}
              placeholder="What the customer said about KamaSutra Gold+..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="w-4 h-4 accent-green-700" />
                <span className="text-xs font-semibold text-gray-600">Verified Purchase</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
              {saving ? "Adding..." : "Add Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditReviewModal({ review, onClose, onSaved }: { review: Review; onClose: () => void; onSaved: (r: Review) => void }) {
  const [form, setForm] = useState({ reviewerName: review.reviewerName, rating: review.rating, reviewText: review.reviewText, city: review.city ?? "", verified: review.verified ?? false });
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { const r = await updateReview(review.id, form); onSaved(r); onClose(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Edit Review</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Customer Name</label>
            <input value={form.reviewerName} onChange={(e) => setForm({ ...form, reviewerName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="w-4 h-4 accent-green-700" />
                <span className="text-xs font-semibold text-gray-600">Verified</span>
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Rating</label>
            <StarRating rating={form.rating} onChange={(r) => setForm({ ...form, rating: r })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Review Text</label>
            <textarea value={form.reviewText} onChange={(e) => setForm({ ...form, reviewText: e.target.value })} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Agency modal
────────────────────────────────────────────── */
const BLANK_AGENCY: Omit<AgencyProfile, "id" | "createdAt"> = {
  name: "", sourceName: "", pixelId: "", businessManagerId: "", capiToken: "",
  googleAdsConversionId: "", googleAdsConversionLabel: "", ga4MeasurementId: "",
  googleSheetWebhookUrl: "", active: true,
};

function AgencyModal({ agency, onClose, onSaved }: { agency: AgencyProfile | null; onClose: () => void; onSaved: (a: AgencyProfile) => void }) {
  const isEdit = !!agency;
  const [form, setForm] = useState<Omit<AgencyProfile, "id" | "createdAt">>(
    agency ? {
      name: agency.name, sourceName: agency.sourceName, pixelId: agency.pixelId,
      businessManagerId: agency.businessManagerId, capiToken: "",
      googleAdsConversionId: agency.googleAdsConversionId,
      googleAdsConversionLabel: agency.googleAdsConversionLabel,
      ga4MeasurementId: agency.ga4MeasurementId,
      googleSheetWebhookUrl: agency.googleSheetWebhookUrl, active: agency.active,
    } : { ...BLANK_AGENCY },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function F(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.sourceName.trim()) { setErr("Agency Name and Source Name are required."); return; }
    setErr(""); setSaving(true);
    try {
      const payload = isEdit ? { id: agency!.id, ...form } : form;
      const saved = await saveAgency(payload);
      onSaved(saved);
      onClose();
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
            <p className="text-xs text-gray-500 mt-0.5">Configure tracking pixels and webhooks for this agency</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-5">

          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Agency Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Agency Name *</label>
                <input value={form.name} onChange={F("name")} required placeholder="e.g. Agency A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Source Tag * <span className="text-gray-400 font-normal">(unique)</span></label>
                <input value={form.sourceName} onChange={F("sourceName")} required placeholder="e.g. FB-Agency-A"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Meta / Facebook</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Pixel ID / Dataset ID</label>
                <input value={form.pixelId} onChange={F("pixelId")} placeholder="e.g. 1188710012812588"
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
                CAPI Access Token {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep existing)</span>}
              </label>
              <input value={form.capiToken} onChange={F("capiToken")} type="password"
                placeholder={isEdit ? "Enter new token to replace ••••••••" : "EAAxxxxxxx..."}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Google</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Google Ads Conversion ID</label>
                <input value={form.googleAdsConversionId} onChange={F("googleAdsConversionId")} placeholder="AW-123456789"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Conversion Label</label>
                <input value={form.googleAdsConversionLabel} onChange={F("googleAdsConversionLabel")} placeholder="AbCdEfGhIjK"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">GA4 Measurement ID</label>
              <input value={form.ga4MeasurementId} onChange={F("ga4MeasurementId")} placeholder="G-XXXXXXXXXX"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono" />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Google Sheet Webhook</p>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Webhook URL <span className="text-gray-400 font-normal">(agency-specific sheet)</span></label>
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
   Marketing Hub tab (agency management)
────────────────────────────────────────────── */
function MarketingHub() {
  const [agencies, setAgencies] = useState<AgencyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<AgencyProfile | null | "new">(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAgencies(await fetchAgencies()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

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

  function handleSaved(updated: AgencyProfile) {
    setAgencies((prev) => {
      const idx = prev.findIndex((a) => a.id === updated.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
  }

  const activeCount = agencies.filter((a) => a.active).length;

  return (
    <div className="space-y-5">
      {modal !== null && (
        <AgencyModal
          agency={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={(a) => { handleSaved(a); setModal(null); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Marketing Hub</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage agency tracking profiles — each gets its own pixel, CAPI, and Google Sheet</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setModal("new")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-110" style={{ background: G }}>
            <Plus className="w-3.5 h-3.5" /> Add Agency
          </button>
        </div>
      </div>

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

      {loading && agencies.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
      ) : agencies.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center py-12 text-gray-400">
          <Building2 className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No agencies yet</p>
          <p className="text-xs mt-1 opacity-60">Click "Add Agency" to create your first tracking profile</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agencies.map((agency) => (
            <div key={agency.id} className={`bg-white rounded-xl border p-4 transition-all ${agency.active ? "border-green-200" : "border-gray-200 opacity-70"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-bold text-gray-900">{agency.name}</span>
                    <code className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: GOLD + "22", color: GOLD }}>
                      source: {agency.sourceName}
                    </code>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${agency.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {agency.active ? <><Zap className="w-3 h-3" /> Active</> : "Paused"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-500">
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
                    {agency.googleAdsConversionId && (
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-gray-400 w-16 flex-shrink-0">Ads ID</span>
                        <code className="font-mono text-gray-600">{agency.googleAdsConversionId}</code>
                      </div>
                    )}
                    {agency.googleSheetWebhookUrl && (
                      <div className="flex items-center gap-1 col-span-2">
                        <Globe className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <a href={agency.googleSheetWebhookUrl} target="_blank" rel="noreferrer"
                          className="text-blue-500 hover:underline truncate max-w-xs">Sheet Webhook ↗</a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(agency.id)}
                    disabled={toggling === agency.id}
                    title={agency.active ? "Pause agency" : "Activate agency"}
                    className="p-1.5 rounded-lg transition-colors hover:bg-gray-100">
                    {agency.active
                      ? <ToggleRight className="w-5 h-5 text-green-600" />
                      : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                  <button onClick={() => setModal(agency)} title="Edit"
                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(agency.id, agency.name)} disabled={deleting === agency.id}
                    title="Delete" className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
        <p className="font-semibold">How it works</p>
        <ul className="list-disc list-inside space-y-0.5 opacity-80">
          <li>When an order arrives with a matching <strong>source tag</strong> (UTM / referrer), that agency's pixel CAPI fires.</li>
          <li>If multiple agencies are <strong>Active</strong>, the server fires all their CAPI tokens simultaneously.</li>
          <li>Each agency can send data to its own <strong>Google Sheet</strong> via the webhook URL.</li>
          <li>CAPI tokens are <strong>masked</strong> — staff cannot copy or view the full value.</li>
          <li>Pausing an agency stops its pixel from firing without deleting the profile.</li>
        </ul>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Reviews tab (original, unchanged)
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

  async function handleReject(id: number) {
    await updateReview(id, { status: "rejected" });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this review?")) return;
    await deleteReview(id);
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-5">
      {showAdd && <AddReviewModal onClose={() => setShowAdd(false)} onAdded={(r) => { setReviews((prev) => [r, ...prev]); setShowAdd(false); }} />}
      {editReview && <EditReviewModal review={editReview} onClose={() => setEditReview(null)} onSaved={(r) => { setReviews((prev) => prev.map((x) => x.id === r.id ? r : x)); setEditReview(null); }} />}

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
            {[["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"]].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v as string)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === v ? "bg-green-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {l as string}
              </button>
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
            <p className="text-sm">No reviews</p>
            <p className="text-xs mt-1 opacity-60">Add reviews manually or wait for customers</p>
          </div>
        ) : reviews.map((review) => (
          <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900">{review.reviewerName}</span>
                  {review.city && <span className="text-xs text-gray-500">• {review.city}</span>}
                  {review.verified && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> Verified</span>}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${review.status === "approved" ? "bg-green-100 text-green-700" : review.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                    {review.status}
                  </span>
                  {review.source === "manual" && <span className="text-xs text-gray-400">(manual)</span>}
                </div>
                <StarRating rating={review.rating} />
                <p className="text-sm text-gray-700 mt-2 leading-relaxed">{review.reviewText}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(review.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {review.status === "pending" && (
                  <button onClick={() => handleApprove(review.id)} title="Approve" className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                {review.status === "pending" && (
                  <button onClick={() => handleReject(review.id)} title="Reject" className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                {review.status === "approved" && (
                  <button onClick={() => updateReview(review.id, { status: "rejected" }).then(() => setReviews((prev) => prev.filter((r) => r.id !== review.id)))} title="Unapprove"
                    className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setEditReview(review)} title="Edit" className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(review.id)} title="Delete" className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main export — two-tab Marketing page
────────────────────────────────────────────── */
export function AdminMarketing() {
  const [tab, setTab] = useState<"hub" | "reviews">("hub");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Marketing</h1>
        <p className="text-xs text-gray-500 mt-0.5">Agency tracking profiles and customer reviews</p>
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
