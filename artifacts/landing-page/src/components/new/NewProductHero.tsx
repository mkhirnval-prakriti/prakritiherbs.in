import { useState, useEffect } from "react";
import { openOrderModal } from "@/lib/orderModalUtils";

function useCountdown(hours = 24) {
  const [time, setTime] = useState(() => {
    const key = "ks_timer_end";
    const stored = localStorage.getItem(key);
    const end = stored ? Number(stored) : Date.now() + hours * 60 * 60 * 1000;
    if (!stored) localStorage.setItem(key, String(end));
    return Math.max(0, end - Date.now());
  });

  useEffect(() => {
    const id = setInterval(() => {
      setTime((prev) => {
        const next = prev - 1000;
        if (next <= 0) { clearInterval(id); return 0; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const h = Math.floor(time / 3600000).toString().padStart(2, "0");
  const m = Math.floor((time % 3600000) / 60000).toString().padStart(2, "0");
  const s = Math.floor((time % 60000) / 1000).toString().padStart(2, "0");
  return { h, m, s };
}

const th = (style: React.CSSProperties): React.CSSProperties => style;

export function NewProductHero() {
  const { h, m, s } = useCountdown(24);
  const [saveBtnActive, setSaveBtnActive] = useState(false);

  const scrollToOrder = () => {
    openOrderModal();
  };

  const handleSaveBtn = () => {
    setSaveBtnActive(true);
    setTimeout(() => setSaveBtnActive(false), 1400);
  };

  const section: React.CSSProperties = {
    padding: "40px 0",
  };

  const container: React.CSSProperties = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 16px",
  };

  const row: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
  };

  const font = "'Playpen Sans', cursive";

  return (
    <section style={section}>
      <div style={container}>
        <div style={row}>

          {/* LEFT: Sticky image */}
          <div className="product-left-col">
            <div className="sticky-product-img">
              <img
                src="/new-images/1.jpg"
                alt="KamaSutra Gold+"
                style={{ width: "100%", borderRadius: 12, display: "block" }}
              />
            </div>
          </div>

          {/* RIGHT: Content */}
          <div className="product-right-col">

            {/* Product Title */}
            <h2
              style={th({
                fontFamily: font,
                textAlign: "center",
                marginBottom: 16,
                fontSize: "clamp(20px, 5vw, 28px)",
                color: "#000",
                lineHeight: 1.4,
              })}
            >
              Kama Sutra — 30 दिन में आपके लिंग का आकार 8 इंच हो जाएगा
            </h2>

            {/* Price */}
            <div style={{ textAlign: "center", marginBottom: 4 }}>
              <span
                style={{
                  fontFamily: font,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#000",
                  marginRight: 10,
                }}
              >
                Rs. 999.00
              </span>
              <span
                style={{
                  fontFamily: font,
                  fontSize: 17,
                  textDecoration: "line-through",
                  color: "#bbb",
                }}
              >
                Rs. 2,499.00
              </span>
            </div>
            <p
              style={{
                textAlign: "center",
                color: "#777",
                fontSize: 12,
                letterSpacing: 1,
                fontFamily: font,
                marginBottom: 20,
              }}
            >
              Taxes included.
            </p>

            {/* Order Button */}
            <div style={{ marginBottom: 24 }}>
              <button
                onClick={scrollToOrder}
                style={th({
                  fontFamily: "Arial, Helvetica, sans-serif",
                  background: "#000",
                  color: "#fff",
                  padding: "16px 20px",
                  width: "100%",
                  border: "none",
                  borderRadius: 100,
                  boxShadow: "rgba(0,0,0,0.3) 0 2px 7px",
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  transition: "transform 0.2s",
                  position: "relative",
                })}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                  style={{ width: 26, height: 26, flexShrink: 0 }}>
                  <path fill="currentColor"
                    d="M15.55 13c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.37-.66-.11-1.48-.87-1.48H5.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7l1.1-2h7.45zM6.16 6h12.15l-2.76 5H8.53L6.16 6zM7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z">
                  </path>
                </svg>
                Order Now — Cash on Delivery
              </button>
            </div>

            {/* Countdown Timer */}
            <div
              style={th({
                textAlign: "center",
                padding: "24px 16px",
                color: "#000",
                marginBottom: 8,
              })}
            >
              <h4
                style={{
                  fontFamily: font,
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                Hurry up! Sale Ends in
              </h4>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                {[{ val: h, label: "hours" }, { val: m, label: "mins" }, { val: s, label: "secs" }].flatMap(
                  ({ val, label }, i) => {
                    const items = [
                      <div key={label} style={{ textAlign: "center", lineHeight: 1 }}>
                        <span style={{ display: "block", fontSize: 36, fontWeight: 700, fontFamily: font, lineHeight: 1 }}>
                          {val}
                        </span>
                        <span style={{ fontSize: 12, color: "#555", fontFamily: font }}>{label}</span>
                      </div>,
                    ];
                    if (i < 2) {
                      items.push(
                        <span key={`colon-${i}`} style={{ fontSize: 28, fontWeight: 600, marginTop: -10, fontFamily: font }}>
                          :
                        </span>
                      );
                    }
                    return items;
                  }
                )}
              </div>

              {/* Save 35% Button */}
              <button
                onClick={handleSaveBtn}
                style={th({
                  display: "inline-flex",
                  justifyContent: "center",
                  alignItems: "center",
                  position: "relative",
                  background: saveBtnActive ? "#000" : "transparent",
                  border: `1px dashed ${saveBtnActive ? "#000" : "#bbb"}`,
                  padding: "10px 25px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: font,
                  cursor: "pointer",
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                  minWidth: 140,
                })}
              >
                {saveBtnActive ? (
                  <span style={{ color: "#fff", fontFamily: font }}>✓ Applied!</span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img
                      src="/new-images/badge-percent-filled.svg"
                      alt=""
                      style={{ width: 18, height: 18 }}
                    />
                    Save 35%
                  </span>
                )}
              </button>
            </div>

            {/* Benefits Section */}
            <h3
              style={{
                fontFamily: font,
                fontSize: 22,
                fontWeight: 700,
                color: "#000",
                marginTop: 8,
                marginBottom: 12,
              }}
            >
              Benefits
            </h3>
            <p style={{ fontFamily: font, color: "#444", lineHeight: 1.8, marginBottom: 12 }}>
              जब मैंने पहली बार गोली ली थी तो मैं और मेरी बीवी एक घंटे तक सेक्स करते रहे थे। मेरा पहले
              इतना खड़ा नहीं हुआ — मेरा पत्थर जैसा सख्ती से खड़ा था।
            </p>
            <p style={{ fontFamily: font, color: "#444", lineHeight: 1.8, marginBottom: 16 }}>
              दो हफ्ते बाद मैंने अपनी बीवी को सेक्स के समय आहें भरते सुना। मैंने उससे पूछा कि उसे दर्द
              तो नहीं हो रहा। ऐसा नहीं था, उसे असल में पहली बार ओरगाज़्म मिला था। उसे दो-दो बार ओरगाज़्म
              आया और उसमें बहुत मजा भी आया।
            </p>

            <img src="/new-images/2.png" alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 16 }} />
            <img src="/new-images/3.png" alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 16 }} />

            <p style={{ fontFamily: font, color: "#444", lineHeight: 1.8, marginBottom: 16 }}>
              हालाँकि मैं देख सकता था कि मेरा लिंग दिन-ब-दिन बड़ा होता जा रहा है, फिर भी मुझे ऐसे परिणामों
              की उम्मीद नहीं थी। छह सेंटीमीटर जितना! अब मेरा लिंग सिर्फ एक लिंग नहीं था, बल्कि एक चुदाई का दैत्य था।
            </p>

            <img src="/new-images/4.png" alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 16 }} />

            <p style={{ fontFamily: font, color: "#444", lineHeight: 1.8, marginBottom: 16 }}>
              इसलिए दोस्तों, मैं तो आपको यही सलाह दूँगा। यदि आपको लग रहा है कि आपकी बीवी या प्रेमी
              ओरगाज़्म आने का नाटक करते हैं तो — कभी सीधे उनसे न पूछें। यदि आप औरत को सच में ओरगाज़्म
              दे सकेंगे तो आप चेक कर सकते हैं कि वह कितना सच बोल रही है।
            </p>

            <img src="/new-images/5.jpg" alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 24 }} />

            {/* Government Approved */}
            <h2
              style={{
                fontFamily: font,
                fontSize: 24,
                fontWeight: 700,
                color: "#000",
                marginBottom: 16,
              }}
            >
              Government Approved
            </h2>
            <img src="/new-images/6.png" alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 16 }} />
            <img src="/new-images/7.png" alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 16 }} />
            <img src="/new-images/8.png" alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 24 }} />

            {/* Bottom Order CTA */}
            <button
              onClick={scrollToOrder}
              style={th({
                fontFamily: "Arial, Helvetica, sans-serif",
                background: "#000",
                color: "#fff",
                padding: "16px 20px",
                width: "100%",
                border: "none",
                borderRadius: 100,
                boxShadow: "rgba(0,0,0,0.3) 0 2px 7px",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 8,
              })}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                style={{ width: 24, height: 24, flexShrink: 0 }}>
                <path fill="currentColor"
                  d="M19.5 8H17V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2 0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h1c.55 0 1-.45 1-1v-3.33c0-.43-.14-.85-.4-1.2L20.3 8.4c-.19-.25-.49-.4-.8-.4zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13.5-8.5l1.96 2.5H17V9.5h2.5zM18 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z">
                </path>
              </svg>
              COMPLETE ORDER — Rs. 999.00
            </button>

          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        .product-left-col {
          width: 100%;
          min-width: 0;
        }
        .product-right-col {
          width: 100%;
          min-width: 0;
        }
        @media (min-width: 992px) {
          .product-left-col {
            width: 58%;
            flex: 0 0 58%;
          }
          .product-right-col {
            width: 42%;
            flex: 0 0 42%;
            padding-left: 24px;
          }
          .sticky-product-img {
            position: sticky;
            top: 80px;
          }
        }
      `}</style>
    </section>
  );
}
