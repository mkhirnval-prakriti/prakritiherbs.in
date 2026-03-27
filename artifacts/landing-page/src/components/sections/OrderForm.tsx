import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ShieldCheck, Truck, Package, X, Loader2 } from "lucide-react";
import { cleanMobile, sendLeadToCRM, DuplicateOrderError, hasOrderedToday } from "@/lib/crm";
import { fireLead, fireInitiateCheckout, markPaymentInitiated, generateEventId, getCookie } from "@/lib/pixel";

function captureAbandonedCart(name: string, phone: string, address: string, pincode: string) {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length < 10) return;
  fetch("/api/abandoned-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), phone: cleanPhone, address: address.trim() || null, pincode: pincode.trim() || null, source: "COD" }),
    keepalive: true,
  }).catch(() => {});
}

const GOOGLE_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbyh89OCWVJJePou7B73Q0H2mJBzlWewT4YORz0QF0U2AVb1QvkKLp-h0_MjveBxc_2Txw/exec";

const CASHFREE_URL = "https://payments.cashfree.com/forms/kama";

function getEnglishDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function sendToSheet(name: string, mobile: string, address: string, pincode: string, source: string) {
  const payload = JSON.stringify({
    date: getEnglishDate(),
    name,
    mobile,
    address,
    pincode,
    source,
  });
  fetch(GOOGLE_SHEET_URL, {
    method: "POST",
    mode: "no-cors",
    body: payload,
  }).catch(() => {});
}

function SuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl max-w-md w-full text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
          className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5"
        >
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>

        <h2 className="text-2xl font-bold mb-4 font-display" style={{ color: "#1B5E20" }}>
          ऑर्डर कन्फर्म! 🎉
        </h2>

        <p className="text-base text-gray-700 leading-relaxed mb-5">
          धन्यवाद! आपका COD ऑर्डर सफलतापूर्वक बुक हो गया है।
          <br />
          हमारी टीम जल्द ही आपसे संपर्क करेगी।
          <br />
          <span className="font-semibold mt-2 block" style={{ color: "#1B5E20" }}>
            📦 100% गोपनीय पैकिंग की गारंटी है।
          </span>
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 font-bold rounded-xl text-[#1B5E20] text-lg"
          style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)" }}
        >
          बंद करें ✓
        </button>
      </motion.div>
    </motion.div>
  );
}

export function OrderForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const abandonedFired = useRef(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = "Please enter your full name";
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) e.phone = "Please enter a valid 10-digit mobile number";
    if (!address.trim() || address.trim().length < 10) e.address = "Please enter your complete address";
    if (!pincode.trim() || pincode.replace(/\D/g, "").length < 6) e.pincode = "Please enter a valid 6-digit pincode";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCODSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const mobile = cleanMobile(phone);
    if (!mobile) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    // Client-side duplicate guard (non-blocking check via localStorage)
    if (hasOrderedToday(mobile)) {
      alert("आप आज इस नंबर से ऑर्डर कर चुके हैं। कृपया कल प्रयास करें।");
      return;
    }

    setLoading(true);

    // Fire CRM in background — never block the order confirmation
    sendLeadToCRM({
      name:    name.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
      Number:  mobile,
    }).then(() => {
      console.log("[COD] CRM lead saved successfully.");
    }).catch((err) => {
      if (err instanceof DuplicateOrderError) return;
      console.error("[COD] CRM failed (non-blocking):", err instanceof Error ? err.message : err);
    });

    // Generate unique event ID for client+server deduplication with Meta CAPI
    const leadEventId = generateEventId();

    // Save to local DB + trigger server-side CAPI Lead event (background, non-blocking)
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(), phone: mobile, address: address.trim(),
        pincode: pincode.trim(), quantity: parseInt(quantity, 10), product: "KamaSutra Gold+", source: "COD",
        // CAPI deduplication + matching fields (not validated by Zod, read separately in route)
        eventId: leadEventId,
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        userAgent: navigator.userAgent,
        sourceUrl: window.location.href,
      }),
    }).catch(() => {});

    // Always confirm order via Google Sheets + WhatsApp
    sendToSheet(name.trim(), mobile, address.trim(), pincode.trim(), "COD");
    const msg = encodeURIComponent(
      `*New COD Order:*\n*Product:* KamaSutra Gold+\n*Name:* ${name}\n*Mobile:* ${mobile}\n*Address:* ${address}\n*Pincode:* ${pincode}\n*Qty:* ${quantity} bottle(s)`
    );
    window.open(`https://wa.me/918968122246?text=${msg}`, "_blank");

    // Fire client-side Meta Pixel Lead event with same eventId for deduplication
    fireLead({ name: name.trim(), phone: mobile, eventId: leadEventId });

    setLoading(false);
    setShowSuccess(true);
  }

  function handlePayNowClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!validate()) return;

    const mobile = cleanMobile(phone);
    if (!mobile) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (hasOrderedToday(mobile)) {
      alert("आप आज इस नंबर से ऑर्डर कर चुके हैं। कृपया कल प्रयास करें।");
      return;
    }

    console.log("[PayNow] Validation passed. Initiating payment redirect…");
    console.log("[PayNow] Customer:", { name: name.trim(), mobile, pincode: pincode.trim() });

    // Fire CRM + Google Sheets in the background — never block the payment redirect
    sendLeadToCRM({
      name:    name.trim(),
      address: address.trim(),
      pincode: pincode.trim(),
      Number:  mobile,
    }).then(() => {
      console.log("[PayNow] CRM lead saved successfully.");
    }).catch((err) => {
      if (err instanceof DuplicateOrderError) return;
      console.error("[PayNow] CRM failed (non-blocking):", err instanceof Error ? err.message : err);
    });

    sendToSheet(name.trim(), mobile, address.trim(), pincode.trim(), "Online Attempt");

    // Fire Meta Pixel InitiateCheckout + mark payment intent for Purchase detection on return
    fireInitiateCheckout({ quantity: parseInt(quantity, 10) });
    markPaymentInitiated();

    // Open payment gateway synchronously within the click handler (avoids popup blockers)
    console.log("[PayNow] Opening Cashfree URL →", CASHFREE_URL);
    try {
      window.open(CASHFREE_URL, "_parent");
      console.log("[PayNow] window.open called successfully.");
    } catch (openErr) {
      console.error("[PayNow] window.open failed:", openErr);
      window.location.href = CASHFREE_URL;
    }
  }

  function handleClose() {
    setShowSuccess(false);
    setName("");
    setPhone("");
    setAddress("");
    setPincode("");
    setQuantity("1");
    setErrors({});
  }

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors[field] ? "border-red-500" : "border-border"}`;

  return (
    <>
      <AnimatePresence>
        {showSuccess && <SuccessModal onClose={handleClose} />}
      </AnimatePresence>

      <section id="order-form" className="py-16 md:py-24 bg-muted/30 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto bg-card rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col lg:flex-row">

            <div className="lg:w-2/5 bg-secondary text-secondary-foreground p-8 md:p-12 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold mb-6 font-display text-white">
                  Secure Your <span className="text-primary">Order</span> Today
                </h2>
                <p className="text-secondary-foreground/80 mb-8 text-lg">
                  Pay only when the product reaches your doorstep. 100% secure and discreet packaging.
                </p>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">Free Delivery</h4>
                      <p className="text-secondary-foreground/70 text-sm">3–5 days delivery across India</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">Discreet Packaging</h4>
                      <p className="text-secondary-foreground/70 text-sm">No branding on the outer box</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">📦 100% Secret Packaging</h4>
                      <p className="text-secondary-foreground/70 text-sm">No product name on outer box — complete privacy</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative z-10 mt-12 pt-8 border-t border-secondary-foreground/20">
                <div className="flex items-center gap-4">
                  <div className="font-display">
                    <p className="text-sm text-secondary-foreground/70 uppercase tracking-widest font-bold">Total Price</p>
                    <p className="text-3xl font-bold text-white">
                      ₹999{" "}
                      <span className="text-sm font-sans font-normal text-secondary-foreground/70 line-through">₹1,999</span>
                    </p>
                  </div>
                  <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase">
                    50% OFF
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-3/5 p-8 md:p-12">
              <h3 className="text-2xl font-bold mb-1">Cash on Delivery (COD) Form</h3>
              <p className="text-sm text-muted-foreground mb-6">
                नीचे फॉर्म भरें — कोई एडवांस पेमेंट नहीं, डिलीवरी पर ही भुगतान करें।
              </p>

              <form onSubmit={handleCODSubmit} noValidate className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">Full Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass("name")}
                      placeholder="e.g. Rahul Sharma"
                    />
                    {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">Mobile Number *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-muted-foreground text-sm">+91</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onBlur={() => {
                          if (!abandonedFired.current && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10) {
                            abandonedFired.current = true;
                            captureAbandonedCart(name, phone, address, pincode);
                          }
                        }}
                        className={`${inputClass("phone")} pl-12`}
                        placeholder="98765 43210"
                        maxLength={10}
                      />
                    </div>
                    {errors.phone && <p className="text-red-500 text-xs">{errors.phone}</p>}
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-semibold text-foreground">Complete Address *</label>
                    <textarea
                      rows={3}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className={`${inputClass("address")} resize-none`}
                      placeholder="House/Flat No., Street, Area, City, State"
                    />
                    {errors.address && <p className="text-red-500 text-xs">{errors.address}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">Pincode *</label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className={inputClass("pincode")}
                      placeholder="e.g. 110001"
                      maxLength={6}
                    />
                    {errors.pincode && <p className="text-red-500 text-xs">{errors.pincode}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">Quantity</label>
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                    >
                      <option value="1">1 Bottle – ₹999</option>
                      <option value="2">2 Bottles – ₹1,899 (Save ₹99)</option>
                      <option value="3">3 Bottles – ₹2,699 (Best Value)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-4 px-8 font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)", color: "#1B5E20" }}
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                  ) : (
                    <>🛒 Place Order Now (COD)</>
                  )}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  By placing an order, you agree to our terms. No advance payment required.
                </p>
              </form>

              <div className="mt-8 pt-8 border-t border-border">
                <p className="text-red-600 font-bold text-center text-base mb-1">
                  ऑनलाइन पेमेंट करें और 10% की छूट पाएं!
                </p>
                <p className="text-center text-sm text-muted-foreground mb-5">
                  ऊपर फॉर्म भरने के बाद नीचे Pay Now दबाएं — UPI / Card / Net Banking
                </p>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handlePayNowClick}
                    style={{
                      background: "#000",
                      border: "1px solid gold",
                      borderRadius: "15px",
                      display: "flex",
                      alignItems: "center",
                      padding: "10px 16px",
                      cursor: "pointer",
                      gap: "0",
                    }}
                  >
                    <img
                      src="https://cashfree-checkoutcartimages-prod.cashfree.com/Prakriti Herbs (1)Ea4uq7u9fiug_prod.png"
                      alt="Prakriti Herbs"
                      style={{ width: "40px", height: "40px", borderRadius: "4px" }}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        marginLeft: "10px",
                        marginRight: "10px",
                      }}
                    >
                      <div style={{ fontFamily: "Arial", color: "#fff", marginBottom: "5px", fontSize: "16px", fontWeight: "bold" }}>
                        Pay Now (Get 10% OFF)
                      </div>
                      <div style={{ fontFamily: "Arial", color: "#fff", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span>Powered By Cashfree</span>
                        <img
                          src="https://cashfreelogo.cashfree.com/cashfreepayments/logosvgs/Group_4355.svg"
                          alt="Cashfree"
                          style={{ width: "16px", height: "16px", verticalAlign: "middle" }}
                        />
                      </div>
                    </div>
                  </button>
                </div>

                <p className="text-center text-xs text-muted-foreground mt-4">
                  🔒 Secured by Cashfree • UPI, Cards, Net Banking accepted
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
