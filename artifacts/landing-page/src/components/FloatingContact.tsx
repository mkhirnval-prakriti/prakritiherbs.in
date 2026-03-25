import { Phone, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export function FloatingContact() {
  const phoneNumber = "+919876543210";
  const whatsappLink = `https://wa.me/919876543210?text=${encodeURIComponent("I want to order KamaSutra Gold+")}`;
  const callLink = `tel:${phoneNumber}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4">
      <motion.a
        href={callLink}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.3 }}
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg shadow-secondary/30 ring-4 ring-background hover:bg-secondary/90 transition-colors"
        aria-label="Call Us"
      >
        <Phone className="h-6 w-6" />
      </motion.a>
      
      <motion.a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.1, duration: 0.3 }}
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 ring-4 ring-background hover:bg-[#20bd5a] transition-colors"
        aria-label="WhatsApp Us"
      >
        <MessageCircle className="h-7 w-7" />
      </motion.a>
    </div>
  );
}
