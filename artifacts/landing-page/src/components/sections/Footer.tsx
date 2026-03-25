import { Leaf } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16 border-t-4 border-primary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-white/10 pb-12 mb-8">
          
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 text-primary mb-4">
              <Leaf className="w-8 h-8" />
              <span className="text-2xl font-bold font-display tracking-wide text-white">Prakriti Herbs</span>
            </div>
            <p className="text-white/60 max-w-sm text-center md:text-left">
              Authentic Ayurvedic formulations crafted with ancient wisdom for the modern world.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2 text-white/80 text-center md:text-right">
            <p className="font-semibold text-white">Contact Us</p>
            <a href="tel:+918968122246" className="hover:text-primary transition-colors">Call: +91 89681 22246</a>
            <a href="https://wa.me/918968122246" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">WhatsApp: +91 89681 22246</a>
            <p className="text-sm mt-2 text-white/50">Support Hours: 9 AM to 7 PM</p>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-white/50">
          <p>© {new Date().getFullYear()} Prakriti Herbs Private Limited. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Refund Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
