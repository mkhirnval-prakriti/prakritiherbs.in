import { Leaf, Phone } from "lucide-react";

export function Header() {
  const scrollToOrder = () => {
    document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Prakriti Herbs Logo"
              className="h-12 md:h-14 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }}
            />
            <div className="hidden items-center gap-2 text-secondary" style={{ display: "none" }}>
              <Leaf className="w-7 h-7" />
              <span className="text-xl font-bold font-display tracking-wide">Prakriti Herbs</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:+918968122246"
              className="hidden sm:flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary transition-colors"
            >
              <Phone className="w-4 h-4" />
              +91 89681 22246
            </a>
            <button
              onClick={scrollToOrder}
              className="px-4 py-2 md:px-6 md:py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-lg shadow hover:brightness-110 active:scale-95 transition-all"
            >
              Order Now
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
