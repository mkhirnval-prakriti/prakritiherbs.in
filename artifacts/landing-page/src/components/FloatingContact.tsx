import { Phone, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cleanMobile, sendLeadToCRM, hasOrderedToday } from "@/lib/crm";

const WA_NUMBER = "918968122246";
const WA_TEXT_DEFAULT = "I want to order KamaSutra Gold+";

function openWA(type: "normal" | "business", msg?: string) {
  const text = encodeURIComponent(msg ?? WA_TEXT_DEFAULT);
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${text}`;
  const deepNormal = `whatsapp://send?phone=${WA_NUMBER}&text=${text}`;
  const deepBusiness = `whatsappbusiness://send?phone=${WA_NUMBER}&text=${text}`;

  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    const link = document.createElement("a");
    link.href = type === "business" ? deepBusiness : deepNormal;
    link.rel = "noopener noreferrer";
    link.click();
    setTimeout(() => {
      window.open(waUrl, "_blank");
    }, 1500);
  } else {
    window.open(waUrl, "_blank");
  }
}

export function WhatsAppChooser({
  message,
  onClose,
}: {
  message?: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div className="fixed bottom-24 left-4 z-[61] bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 min-w-[220px]">
        <p className="text-xs font-semibold text-gray-500 px-1 mb-2">Open WhatsApp in:</p>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => { openWA("normal", message); onClose(); }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-sm transition-colors text-left w-full"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            WhatsApp (Normal)
          </button>
          <button
            onClick={() => { openWA("business", message); onClose(); }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-semibold text-sm transition-colors text-left w-full"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            WhatsApp Business
          </button>
        </div>
      </div>
    </>
  );
}

async function buildMessage(defaultMsg: string): Promise<string> {
  const rawInput = window.prompt("कृपया अपना मोबाइल नंबर दर्ज करें:");
  if (!rawInput) return defaultMsg;

  const mobile = cleanMobile(rawInput);
  if (!mobile) {
    alert("कृपया एक वैध 10-अंकीय मोबाइल नंबर दर्ज करें।");
    return defaultMsg;
  }
  if (hasOrderedToday(mobile)) {
    alert("आप आज इस नंबर से ऑर्डर कर चुके हैं। कृपया कल प्रयास करें।");
    return defaultMsg;
  }
  try {
    await sendLeadToCRM({ name: "WhatsApp Lead", address: "Via WhatsApp", pincode: "000000", Number: mobile });
  } catch (err) {
    console.error("WhatsApp CRM lead error:", err);
  }
  return `I want to order KamaSutra Gold+\nMobile: ${mobile}`;
}

export function FloatingContact() {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<string>(WA_TEXT_DEFAULT);

  async function handleClick() {
    const msg = await buildMessage(WA_TEXT_DEFAULT);
    setPendingMsg(msg);
    setChooserOpen(true);
  }

  return (
    <>
      <AnimatePresence>
        {chooserOpen && (
          <WhatsAppChooser message={pendingMsg} onClose={() => setChooserOpen(false)} />
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => void handleClick()}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 left-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-white shadow-xl shadow-[#25D366]/40 font-bold text-sm cursor-pointer border-0 outline-none"
        aria-label="WhatsApp Us"
      >
        <MessageCircle className="h-5 w-5 shrink-0" />
        <span>WhatsApp Order</span>
      </motion.button>

      <motion.a
        href="tel:8968122246"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-secondary text-secondary-foreground shadow-xl shadow-secondary/30 font-bold text-sm"
        aria-label="Call Us"
      >
        <Phone className="h-5 w-5 shrink-0" />
        <span>Call Now</span>
      </motion.a>
    </>
  );
}
