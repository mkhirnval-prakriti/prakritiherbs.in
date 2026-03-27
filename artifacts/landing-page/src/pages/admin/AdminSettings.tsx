import { useState, useEffect } from "react";
import { fetchSettings, saveSettings, fetchStaff, createStaff, deleteStaff, isSuperAdmin, type StaffUser } from "@/lib/adminApi";
import { Save, Truck, MessageSquare, CreditCard, Building2, Mail, Clock, ExternalLink, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Zap, Users, UserPlus, Trash2, ShieldCheck, Eye } from "lucide-react";

const G = "#1B5E20";

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: G + "15" }}>
            <div className="text-green-800">{icon}</div>
          </div>
          <h3 className="font-bold text-gray-900">{title}</h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
}

function Field({ label, name, type = "text", placeholder, value, onChange, hint }: {
  label: string; name: string; type?: string; placeholder?: string;
  value: string; onChange: (k: string, v: string) => void; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function TextareaField({ label, name, value, onChange, placeholder, rows = 3 }: { label: string; name: string; value: string; onChange: (k: string, v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</label>
      <textarea value={value} onChange={(e) => onChange(name, e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 resize-none" />
    </div>
  );
}

function StaffManagement() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"order_manager" | "view_only">("order_manager");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchStaff().then(setStaff).finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!newUsername.trim() || !newPassword.trim()) { alert("Username and password are required"); return; }
    if (newPassword.length < 6) { alert("Password must be at least 6 characters"); return; }
    setAdding(true);
    try {
      const created = await createStaff(newUsername.trim(), newPassword, newRole);
      setStaff((p) => [...p, created]);
      setNewUsername(""); setNewPassword(""); setShowForm(false);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to create staff user"); }
    finally { setAdding(false); }
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`Remove staff user "${username}"?`)) return;
    try { await deleteStaff(id); setStaff((p) => p.filter((u) => u.id !== id)); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed to remove user"); }
  }

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center animate-pulse">Loading staff...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        Staff users can log in to the admin panel with limited access. <strong>Order Manager</strong> can view and update orders. <strong>View Only</strong> can only see orders — no changes allowed.
      </div>

      {staff.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No staff users yet.</p>
      ) : (
        <div className="space-y-2">
          {staff.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <div className="flex items-center gap-3">
                {u.role === "order_manager"
                  ? <ShieldCheck className="w-4 h-4 text-green-600" />
                  : <Eye className="w-4 h-4 text-blue-500" />}
                <div>
                  <p className="text-sm font-semibold text-gray-800">{u.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{u.role === "order_manager" ? "Order Manager" : "View Only"}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(u.id, u.username)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700">Add New Staff User</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Username</label>
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. rahul_ops"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Password (min 6 chars)</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as "order_manager" | "view_only")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30">
                <option value="order_manager">Order Manager (full order access)</option>
                <option value="view_only">View Only (read-only)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: G }}>
              <UserPlus className="w-3.5 h-3.5" /> {adding ? "Adding..." : "Add User"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border-2 border-dashed border-gray-300 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors w-full justify-center">
          <UserPlus className="w-4 h-4" /> Add Staff User
        </button>
      )}
    </div>
  );
}

export function AdminSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [exists, setExists] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const superAdmin = isSuperAdmin();

  useEffect(() => {
    fetchSettings().then((s) => { setValues(s.settings); setExists(s.exists); }).finally(() => setLoading(false));
  }, []);

  function setVal(key: string, val: string) { setValues((prev) => ({ ...prev, [key]: val })); }

  async function save(keys: string[], section: string) {
    setSaving(section);
    try {
      const payload: Record<string, string> = {};
      keys.forEach((k) => { if (values[k] && !values[k].includes("•")) payload[k] = values[k]; });
      await saveSettings(payload);
      const s = await fetchSettings();
      setExists(s.exists);
      alert("✅ Settings saved successfully!");
    } catch (err) { alert(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(null); }
  }

  if (loading) return <div className="flex items-center justify-center h-32 text-gray-400"><span className="animate-pulse">Loading settings...</span></div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">Settings & Integrations</h1>

      <Section title="Shadowfax Courier Integration" icon={<Zap className="w-4 h-4" />}>
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              Enter your Shadowfax API credentials. The system will check pincode serviceability before creating each shipment.
              <a href="https://api.shadowfax.in" target="_blank" rel="noopener noreferrer" className="ml-1 underline">Open Shadowfax Dashboard <ExternalLink className="w-3 h-3 inline" /></a>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Client ID" name="shadowfax_client_id" placeholder="e.g. SFX12345" value={values["shadowfax_client_id"] ?? ""} onChange={setVal} />
            <Field label="API Token" name="shadowfax_api_token" type="password" placeholder="••••••••••••" value={values["shadowfax_api_token"] ?? ""} onChange={setVal} />
            <Field label="Store ID (optional)" name="shadowfax_store_id" placeholder="e.g. STORE01" value={values["shadowfax_store_id"] ?? ""} onChange={setVal} />
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-3">Pickup Location (your warehouse/dispatch address)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Pickup Pincode" name="shadowfax_pickup_pincode" placeholder="e.g. 302001" value={values["shadowfax_pickup_pincode"] ?? ""} onChange={setVal} />
              <Field label="Pickup Contact (10-digit)" name="shadowfax_pickup_contact" placeholder="e.g. 8968122246" value={values["shadowfax_pickup_contact"] ?? ""} onChange={setVal} />
              <Field label="Pickup Address" name="shadowfax_pickup_address" placeholder="e.g. Plot 12, Industrial Area, Jaipur" value={values["shadowfax_pickup_address"] ?? ""} onChange={setVal} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {exists["shadowfax_client_id"] && exists["shadowfax_api_token"]
                ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">Shadowfax configured</span></>
                : <><AlertCircle className="w-3.5 h-3.5 text-orange-500" /><span className="text-orange-600">Not configured</span></>}
            </div>
            <button onClick={() => save(["shadowfax_client_id", "shadowfax_api_token", "shadowfax_store_id", "shadowfax_pickup_pincode", "shadowfax_pickup_address", "shadowfax_pickup_contact"], "shadowfax")} disabled={saving === "shadowfax"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
              <Save className="w-3.5 h-3.5" /> {saving === "shadowfax" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Shiprocket Integration" icon={<Truck className="w-4 h-4" />}>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              Enter your Shiprocket account email and password. The system will auto-create shipments and generate AWB numbers when you click "Ship via Shiprocket".
              <a href="https://app.shiprocket.in" target="_blank" rel="noopener noreferrer" className="ml-1 underline">Open Shiprocket Dashboard <ExternalLink className="w-3 h-3 inline" /></a>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Shiprocket Email" name="shiprocket_email" type="email" placeholder="you@example.com" value={values["shiprocket_email"] ?? ""} onChange={setVal} />
            <Field label="Shiprocket Password" name="shiprocket_password" type="password" placeholder="••••••••" value={values["shiprocket_password"] ?? ""} onChange={setVal} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {exists["shiprocket_email"] && exists["shiprocket_password"]
                ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">Credentials saved</span></>
                : <><AlertCircle className="w-3.5 h-3.5 text-orange-500" /><span className="text-orange-600">Not configured</span></>}
            </div>
            <button onClick={() => save(["shiprocket_email", "shiprocket_password"], "shiprocket")} disabled={saving === "shiprocket"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
              <Save className="w-3.5 h-3.5" /> {saving === "shiprocket" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="WhatsApp Integration" icon={<MessageSquare className="w-4 h-4" />}>
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
            Use your WhatsApp API provider (Interakt, Wati, AiSensy, or custom). The system will POST to your API URL with {"{ phone, message }"} in JSON body.
            Use <code className="bg-green-100 px-1 rounded">{"{{name}}"}</code>, <code className="bg-green-100 px-1 rounded">{"{{orderId}}"}</code>, <code className="bg-green-100 px-1 rounded">{"{{amount}}"}</code> in templates.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="API Endpoint URL" name="whatsapp_api_url" placeholder="https://api.yourprovider.com/send" value={values["whatsapp_api_url"] ?? ""} onChange={setVal} />
            <Field label="API Key / Bearer Token" name="whatsapp_api_key" type="password" placeholder="sk_live_..." value={values["whatsapp_api_key"] ?? ""} onChange={setVal} />
          </div>
          <TextareaField label="Order Confirmed Template" name="whatsapp_template_order_confirmed" rows={3}
            placeholder="नमस्ते {{name}} जी! आपका KamaSutra Gold+ ऑर्डर Confirm हो गया। Order ID: {{orderId}}। Amount: ₹{{amount}}। - Prakriti Herbs"
            value={values["whatsapp_template_order_confirmed"] ?? ""} onChange={setVal} />
          <TextareaField label="Abandoned Cart Template" name="whatsapp_template_abandoned_cart" rows={3}
            placeholder="नमस्ते {{name}} जी! आपने KamaSutra Gold+ का ऑर्डर अधूरा छोड़ा। अभी ₹999 में ऑर्डर करें। prakritiherbs.in - Prakriti Herbs"
            value={values["whatsapp_template_abandoned_cart"] ?? ""} onChange={setVal} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {exists["whatsapp_api_url"] && exists["whatsapp_api_key"]
                ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">WhatsApp configured</span></>
                : <><AlertCircle className="w-3.5 h-3.5 text-orange-500" /><span className="text-orange-600">Not configured</span></>}
            </div>
            <button onClick={() => save(["whatsapp_api_url", "whatsapp_api_key", "whatsapp_template_order_confirmed", "whatsapp_template_abandoned_cart"], "whatsapp")} disabled={saving === "whatsapp"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
              <Save className="w-3.5 h-3.5" /> {saving === "whatsapp" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Payment Gateways" icon={<CreditCard className="w-4 h-4" />}>
        <div className="space-y-5">
          <div>
            <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <img src="https://razorpay.com/favicon.ico" className="w-4 h-4" alt="Razorpay" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              Razorpay
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Key ID" name="razorpay_key_id" placeholder="rzp_live_..." value={values["razorpay_key_id"] ?? ""} onChange={setVal} />
              <Field label="Key Secret" name="razorpay_key_secret" type="password" placeholder="••••••••" value={values["razorpay_key_secret"] ?? ""} onChange={setVal} />
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs">
                {exists["razorpay_key_id"] && exists["razorpay_key_secret"]
                  ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">Razorpay active on checkout</span></>
                  : <><AlertCircle className="w-3.5 h-3.5 text-orange-500" /><span className="text-orange-600">Add keys to enable online payment</span></>}
              </div>
              <button onClick={() => save(["razorpay_key_id", "razorpay_key_secret"], "razorpay")} disabled={saving === "razorpay"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
                <Save className="w-3.5 h-3.5" /> {saving === "razorpay" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="font-semibold text-gray-800 text-sm mb-3">Cashfree</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="App ID" name="cashfree_app_id" placeholder="CF_APP_..." value={values["cashfree_app_id"] ?? ""} onChange={setVal} />
              <Field label="Secret Key" name="cashfree_secret_key" type="password" placeholder="••••••••" value={values["cashfree_secret_key"] ?? ""} onChange={setVal} />
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => save(["cashfree_app_id", "cashfree_secret_key"], "cashfree")} disabled={saving === "cashfree"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
                <Save className="w-3.5 h-3.5" /> {saving === "cashfree" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Business & Invoice Info" icon={<Building2 className="w-4 h-4" />}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="GSTIN" name="gst_number" placeholder="e.g. 08AABCP1234A1ZX" value={values["gst_number"] ?? ""} onChange={setVal} hint="Appears on GST invoices" />
            <Field label="Company PAN" name="company_pan" placeholder="e.g. AABCP1234A" value={values["company_pan"] ?? ""} onChange={setVal} />
            <Field label="Director / Authorised Signatory Name" name="director_name" placeholder="e.g. Rajesh Kumar Sharma" value={values["director_name"] ?? ""} onChange={setVal} />
            <Field label="Report Email" name="report_email" type="email" placeholder="contact@prakritiherbs.in" value={values["report_email"] ?? ""} onChange={setVal} hint="Daily sales report destination" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">These details appear on GST invoices generated for each order.</p>
            <button onClick={() => save(["gst_number", "company_pan", "director_name", "report_email"], "business")} disabled={saving === "business"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: G }}>
              <Save className="w-3.5 h-3.5" /> {saving === "business" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Daily Email Report" icon={<Mail className="w-4 h-4" />} defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Clock className="w-4 h-4 text-orange-500" />
            <span>Sent at <strong>11:59 PM IST</strong> every day</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Mail className="w-4 h-4 text-green-600" />
            <span>Default destination: <strong>contact@prakritiherbs.in</strong></span>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
            To enable email delivery, set these environment variables in your deployment:
            <code className="block mt-1 font-mono bg-yellow-100 px-2 py-1 rounded">SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASS</code>
          </div>
        </div>
      </Section>

      {superAdmin && (
        <Section title="Staff Access Management" icon={<Users className="w-4 h-4" />} defaultOpen={false}>
          <StaffManagement />
        </Section>
      )}
    </div>
  );
}
