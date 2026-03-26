import { Phone, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cleanMobile, sendLeadToCRM, hasOrderedToday } from "@/lib/crm";

const WA_NUMBER = "918968122246";
const DEFAULT_WA_MSG = encodeURIComponent("I want to order KamaSutra Gold+");

async function handleWhatsAppClick(e: React.MouseEvent<HTMLButtonElement>) {
  e.preventDefault();

  const rawInput = window.prompt("Please enter your mobile number to continue:");
  if (!rawInput) {
    window.open(`https://wa.me/${WA_NUMBER}?text=${DEFAULT_WA_MSG}`, "_blank");
    return;
  }

  const mobile = cleanMobile(rawInput);
  if (!mobile) {
    alert("Please enter a valid 10-digit mobile number.");
    window.open(`https://wa.me/${WA_NUMBER}?text=${DEFAULT_WA_MSG}`, "_blank");
    return;
  }

  if (hasOrderedToday(mobile)) {
    alert("आप आज इस नंबर से ऑर्डर कर चुके हैं। कृपया कल प्रयास करें।");
    window.open(`https://wa.me/${WA_NUMBER}?text=${DEFAULT_WA_MSG}`, "_blank");
    return;
  }

  try {
    await sendLeadToCRM({
      name:    "WhatsApp Lead",
      address: "Via WhatsApp",
      pincode: "000000",
      Number:  mobile,
    });
  } catch (err) {
    console.error("WhatsApp CRM lead error:", err);
  }

  const msg = encodeURIComponent(`I want to order KamaSutra Gold+\nMobile: ${mobile}`);
  window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, "_blank");
}

export function FloatingContact() {
  return (
    <>
      <motion.button
        type="button"
        onClick={handleWhatsAppClick}
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
