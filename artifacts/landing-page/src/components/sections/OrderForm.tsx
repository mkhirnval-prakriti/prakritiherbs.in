import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateOrder } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, ShieldCheck, Truck, Package, X } from "lucide-react";

const GOOGLE_SHEET_URL =
  "https://script.google.com/macros/s/AKfycibxibQaJfdsJvwdra6wgF6HPX1h4DhkoNOXOxAcgIuw4GnHyuvdGZoyLOeT42rvmiCnDEQ/exec";

const CASHFREE_URL = "CASHFREE_URL_PLACEHOLDER";

function sendToGoogleSheet(
  data: { name: string; phone: string; address: string; pincode: string; quantity: number; product: string },
  source: "COD" | "Online Attempt"
) {
  const params = new URLSearchParams({
    date: new Date().toLocaleString("en-GB"),
    name: data.name,
    mobile: data.phone,
    address: data.address,
    pincode: data.pincode || "111111",
    source,
  });
  fetch(`${GOOGLE_SHEET_URL}?${params.toString()}`, {
    method: "GET",
    mode: "no-cors",
  }).catch(() => {});
}

const orderSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().min(10, "Please enter a valid phone number").max(15),
  address: z.string().min(10, "Please enter your complete address").max(500),
  pincode: z.string().min(6, "Please enter a valid 6-digit pincode").max(10),
  quantity: z.coerce.number().min(1).max(5),
  product: z.string(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

function SuccessModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
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
          transition={{ delay: 0.15, type: "spring", stiffness: 400 }}
          className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5"
        >
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>

        <h2 className="text-2xl font-bold mb-4 font-display" style={{ color: "#1B5E20" }}>
          ऑर्डर कन्फर्म! 🎉
        </h2>

        <p className="text-base text-gray-700 leading-relaxed mb-5">
          धन्यवाद! आपका ऑर्डर सफलतापूर्वक बुक हो गया है।
          <br />
          हमारी टीम जल्द ही आपसे संपर्क करेगी।
          <br />
          <span className="font-semibold" style={{ color: "#1B5E20" }}>
            📦 100% गोपनीय पैकिंग की गारंटी है।
          </span>
        </p>

        <div className="bg-gray-50 rounded-xl px-5 py-3 inline-block mb-6 border border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Your Order ID</p>
          <p className="text-xl font-mono font-bold" style={{ color: "#C9A14A" }}>{orderId}</p>
        </div>

        <p className="text-xs text-gray-400 mb-5">
          WhatsApp पर आपके ऑर्डर की जानकारी भेजी जा रही है।
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 font-bold rounded-xl text-[#1B5E20]"
          style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)" }}
        >
          बंद करें ✓
        </button>
      </motion.div>
    </motion.div>
  );
}

export function OrderForm() {
  const [showSuccess, setShowSuccess] = useState<{ orderId: string } | null>(null);
  const { mutate, isPending } = useCreateOrder();

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      product: "KamaSutra Gold+",
      quantity: 1,
    },
  });

  const onSubmit = (data: OrderFormValues) => {
    sendToGoogleSheet(data, "COD");

    const tempOrderId = `KG${Date.now().toString().slice(-6)}`;
    const msg = encodeURIComponent(
      `*New COD Order:*\n*Product:* ${data.product}\n*Name:* ${data.name}\n*Mobile:* ${data.phone}\n*Address:* ${data.address}\n*Pincode:* ${data.pincode}\n*Qty:* ${data.quantity}`
    );
    window.open(`https://wa.me/918968122246?text=${msg}`, "_blank");
    setShowSuccess({ orderId: tempOrderId });

    mutate({ data }, { onSuccess: () => {}, onError: () => {} });
  };

  const handleCashfreeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const values = getValues();
    if (values.name && values.phone) {
      sendToGoogleSheet(
        { ...values, quantity: values.quantity || 1, product: "KamaSutra Gold+" },
        "Online Attempt"
      );
    }
    if (CASHFREE_URL === "CASHFREE_URL_PLACEHOLDER") {
      e.preventDefault();
      alert("Cashfree payment link not configured yet. Please contact us on WhatsApp.");
    }
  };

  return (
    <>
      <AnimatePresence>
        {showSuccess && (
          <SuccessModal
            orderId={showSuccess.orderId}
            onClose={() => {
              setShowSuccess(null);
              reset();
            }}
          />
        )}
      </AnimatePresence>

      <section id="order-form" className="py-24 bg-muted/30 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto bg-card rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col lg:flex-row">

            <div className="lg:w-2/5 bg-secondary text-secondary-foreground p-8 md:p-12 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute inset-0 bg-noise opacity-20 mix-blend-overlay"></div>
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>

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
                      <p className="text-secondary-foreground/70 text-sm">No product name on the outer box — complete privacy</p>
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
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                Cash on Delivery (COD) Form
              </h3>
              <p className="text-sm text-muted-foreground mb-8">
                नीचे फॉर्म भरें — कोई एडवांस पेमेंट नहीं, डिलीवरी पर ही भुगतान करें।
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-semibold text-foreground">Full Name *</label>
                    <input
                      id="name"
                      type="text"
                      {...register("name")}
                      className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors.name ? "border-destructive" : "border-border"}`}
                      placeholder="e.g. Rahul Sharma"
                    />
                    {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-semibold text-foreground">Phone Number *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-muted-foreground">+91</span>
                      <input
                        id="phone"
                        type="tel"
                        {...register("phone")}
                        className={`w-full pl-12 pr-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors.phone ? "border-destructive" : "border-border"}`}
                        placeholder="98765 43210"
                      />
                    </div>
                    {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone.message}</p>}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="address" className="text-sm font-semibold text-foreground">Complete Address *</label>
                    <textarea
                      id="address"
                      rows={3}
                      {...register("address")}
                      className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors resize-none ${errors.address ? "border-destructive" : "border-border"}`}
                      placeholder="House/Flat No., Street, Area, City"
                    />
                    {errors.address && <p className="text-destructive text-sm mt-1">{errors.address.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="pincode" className="text-sm font-semibold text-foreground">Pincode *</label>
                    <input
                      id="pincode"
                      type="text"
                      {...register("pincode")}
                      className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors.pincode ? "border-destructive" : "border-border"}`}
                      placeholder="e.g. 110001"
                    />
                    {errors.pincode && <p className="text-destructive text-sm mt-1">{errors.pincode.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="quantity" className="text-sm font-semibold text-foreground">Quantity (Bottles) *</label>
                    <select
                      id="quantity"
                      {...register("quantity")}
                      className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors.quantity ? "border-destructive" : "border-border"}`}
                    >
                      <option value="1">1 Bottle – ₹999</option>
                      <option value="2">2 Bottles – ₹1,899 (Save ₹99)</option>
                      <option value="3">3 Bottles – ₹2,699 (Best Value)</option>
                    </select>
                    {errors.quantity && <p className="text-destructive text-sm mt-1">{errors.quantity.message}</p>}
                  </div>

                  <input type="hidden" {...register("product")} />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-4 px-8 bg-gradient-to-r from-primary to-yellow-600 text-primary-foreground font-bold text-lg rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Processing Order...
                    </>
                  ) : (
                    <>Place Order Now (COD)</>
                  )}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  By placing an order, you agree to our terms. No advance payment required.
                </p>
              </form>

              <div className="mt-8 pt-8 border-t border-border">
                <p className="text-red-600 font-bold text-center text-lg mb-1">
                  ऑनलाइन पेमेंट करें और 10% की छूट पाएं!
                </p>
                <p className="text-center text-sm text-muted-foreground mb-5">
                  ऑनलाइन पेमेंट करने पर आपका पार्सल जल्दी पहुंचेगा और 100% सुरक्षा की गारंटी है।
                </p>

                <div className="flex justify-center">
                  <a
                    href={CASHFREE_URL}
                    target="_parent"
                    rel="noopener noreferrer"
                    onClick={handleCashfreeClick}
                  >
                    <div
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
                          justifyContent: "center",
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
                    </div>
                  </a>
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
