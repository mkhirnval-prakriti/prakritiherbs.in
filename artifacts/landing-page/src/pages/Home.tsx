import { UrgencyBar } from "@/components/UrgencyBar";
import { Header } from "@/components/Header";
import { Hero } from "@/components/sections/Hero";
import { TrustBadges } from "@/components/sections/TrustBadges";
import { Gallery } from "@/components/sections/Gallery";
import { Ingredients } from "@/components/sections/Ingredients";
import { HowToUse } from "@/components/sections/HowToUse";
import { BeforeAfter } from "@/components/sections/BeforeAfter";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Reviews } from "@/components/sections/Reviews";
import { OrderForm } from "@/components/sections/OrderForm";
import { CashfreePayment } from "@/components/sections/CashfreePayment";
import { ExpertCTA } from "@/components/sections/ExpertCTA";
import { LegalSection } from "@/components/sections/LegalSection";
import { Footer } from "@/components/sections/Footer";
import { FloatingContact } from "@/components/FloatingContact";
import { LiveOrderPopup } from "@/components/LiveOrderPopup";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background font-sans overflow-x-hidden">
      <UrgencyBar />
      <Header />
      <main>
        <Hero />
        <TrustBadges />
        <Gallery />
        <Ingredients />
        <HowToUse />
        <BeforeAfter />
        <HowItWorks />
        <Reviews />
        <OrderForm />
        <CashfreePayment />
        <ExpertCTA />
        <LegalSection />
      </main>
      <Footer />
      <FloatingContact />
      <LiveOrderPopup />
    </div>
  );
}
