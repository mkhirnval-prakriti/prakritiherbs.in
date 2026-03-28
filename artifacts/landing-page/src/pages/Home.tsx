import { NewTopbar } from "@/components/new/NewTopbar";
import { NewNavbar } from "@/components/new/NewNavbar";
import { NewProductHero } from "@/components/new/NewProductHero";
import { NewFooter } from "@/components/new/NewFooter";
import { OrderForm } from "@/components/sections/OrderForm";
import { Reviews } from "@/components/sections/Reviews";
import { FloatingContact } from "@/components/FloatingContact";
import { LiveOrderPopup } from "@/components/LiveOrderPopup";

export default function Home() {
  return (
    <div
      style={{
        fontFamily: "'Playpen Sans', cursive",
        overflowX: "hidden",
      }}
    >
      {/* Top announcement bar */}
      <NewTopbar />

      {/* Sticky navbar with mobile sidebar */}
      <NewNavbar />

      <main>
        {/* New Shopify-style product hero section */}
        <NewProductHero />

        {/* Customer reviews — kept from existing design */}
        <Reviews />

        {/* Order form — all Pixel + CAPI + tracking logic fully intact */}
        <div id="order-form">
          <OrderForm />
        </div>
      </main>

      {/* New dark-green footer */}
      <NewFooter />

      {/* Floating WhatsApp button — kept intact */}
      <FloatingContact />

      {/* Live order social proof popup — kept intact */}
      <LiveOrderPopup />
    </div>
  );
}
