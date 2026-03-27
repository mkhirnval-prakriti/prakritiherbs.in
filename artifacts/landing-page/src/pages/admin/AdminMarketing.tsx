import { useState, useEffect, useCallback } from "react";
import { fetchReviews, addReview, updateReview, deleteReview, type Review } from "@/lib/adminApi";
import { Star, Plus, RefreshCw, CheckCircle, XCircle, Edit3, Trash2, X, AlertCircle } from "lucide-react";

const G = "#1B5E20";
const GOLD = "#C9A14A";

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
            <input value={form.reviewerName} onChange={(e) => setForm({ ...form, reviewerName: e.target.value })} required
              placeholder="e.g. Rajesh Kumar" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
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
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: G }}>
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

export function AdminMarketing() {
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
          <h1 className="text-xl font-bold text-gray-900">Marketing</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage customer reviews for KamaSutra Gold+</p>
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
                  <button onClick={() => handleApprove(review.id)} title="Approve"
                    className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                {review.status === "pending" && (
                  <button onClick={() => handleReject(review.id)} title="Reject"
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                {review.status === "approved" && (
                  <button onClick={() => updateReview(review.id, { status: "rejected" }).then(() => setReviews((prev) => prev.filter((r) => r.id !== review.id)))} title="Unapprove"
                    className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setEditReview(review)} title="Edit"
                  className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(review.id)} title="Delete"
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">
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
