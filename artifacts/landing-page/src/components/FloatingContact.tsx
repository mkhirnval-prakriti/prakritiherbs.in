import { Phone, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

const WA_URL = `https://wa.me/918968122246?text=${encodeURIComponent("Namaste, I want more information about Kamasutra Gold +")}`;

export function FloatingContact() {
  return (
    <>
      <motion.a
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 left-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-white shadow-xl shadow-[#25D366]/40 font-bold text-sm border-0 outline-none"
        aria-label="WhatsApp Us"
      >
        <MessageCircle className="h-5 w-5 shrink-0" />
        <span>WhatsApp Order</span>
      </motion.a>

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
