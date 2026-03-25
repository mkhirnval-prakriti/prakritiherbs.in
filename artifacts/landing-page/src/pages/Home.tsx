import { Header } from "@/components/Header";
import { Hero } from "@/components/sections/Hero";
import { Gallery } from "@/components/sections/Gallery";
import { Ingredients } from "@/components/sections/Ingredients";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Reviews } from "@/components/sections/Reviews";
import { OrderForm } from "@/components/sections/OrderForm";
import { Footer } from "@/components/sections/Footer";
import { FloatingContact } from "@/components/FloatingContact";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background font-sans overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <Gallery />
        <Ingredients />
        <HowItWorks />
        <Reviews />
        <OrderForm />
      </main>
      <Footer />
      <FloatingContact />
    </div>
  );
}
