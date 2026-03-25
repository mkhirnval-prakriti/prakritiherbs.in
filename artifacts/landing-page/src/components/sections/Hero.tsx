import { motion } from "framer-motion";
import { CheckCircle, Leaf, ShieldCheck, ArrowRight } from "lucide-react";

export function Hero() {
  const scrollToOrder = () => {
    document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-secondary text-secondary-foreground min-h-[90vh] flex items-center">
      {/* Texture Overlay */}
      <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none mix-blend-overlay"></div>
      
      {/* Decorative Gradient */}
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-start text-left"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-6">
              <Leaf className="w-4 h-4" />
              <span className="text-sm font-semibold tracking-wide uppercase">Prakriti Herbs</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6 text-white font-display">
              Rediscover Your <br />
              <span className="text-primary">Inner Vitality</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-secondary-foreground/80 mb-8 max-w-xl font-sans">
              KamaSutra Gold+ is a premium Ayurvedic formulation crafted to naturally enhance stamina, strength, and overall wellness. 100% natural, clinically tested, and trusted by thousands.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-10">
              <button 
                onClick={scrollToOrder}
                className="group relative flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl text-lg overflow-hidden shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Order Now - Cash on Delivery
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </div>

            <div className="flex flex-wrap gap-6 text-sm font-medium text-secondary-foreground/90">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                <span>100% Natural</span>
              </div>
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-primary" />
                <span>Ayurvedic Formula</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <span>Clinically Tested</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="relative lg:ml-auto w-full max-w-md mx-auto lg:max-w-none"
          >
            <div className="aspect-[3/4] relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-primary/20">
              <img 
                src={`${import.meta.env.BASE_URL}images/product1.jpg`} 
                alt="KamaSutra Gold+ Premium Ayurvedic Bottle" 
                className="object-cover w-full h-full"
                onError={(e) => { (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/hero-bottle.png`; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            </div>
            
            {/* Floating Trust Badge */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -bottom-6 -left-6 bg-card text-card-foreground p-4 rounded-xl shadow-xl border border-border flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm">GMP Certified</p>
                <p className="text-xs text-muted-foreground">Premium Quality</p>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
