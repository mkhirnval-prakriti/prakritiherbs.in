const themeGreen = "#39593d";
const font = "'Playpen Sans', cursive";

export function NewFooter() {
  return (
    <footer
      style={{
        background: themeGreen,
        color: "#ddd",
        padding: "60px 0 15px",
        fontFamily: font,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 32,
            marginBottom: 30,
          }}
        >
          {/* Left section */}
          <div style={{ flex: "1 1 280px" }}>
            <img
              src="/new-images/logo.png"
              alt="Prakriti Herbs"
              style={{
                maxWidth: 100,
                marginBottom: 14,
                filter: "brightness(0) invert(1)",
                opacity: 0.9,
              }}
            />
            <h4
              style={{
                color: "#fff",
                fontWeight: "bold",
                marginBottom: 10,
                fontSize: 15,
              }}
            >
              PRAKRITI HERBS PRIVATE LIMITED
            </h4>
            {[
              "A Amer, Jaipur - 302028 (Raj.)",
              "Customer support: 8234852859",
              "Email: praktitherbs2@gmail.com",
              "CIN No.: U46497RJ2025PTC109202",
            ].map((line) => (
              <p key={line} style={{ margin: "0 0 4px", fontSize: "0.95em", color: "#ddd" }}>
                {line}
              </p>
            ))}
          </div>

          {/* Right section */}
          <div style={{ flex: "1 1 200px" }}>
            <h4
              style={{
                color: "#fff",
                fontWeight: "bold",
                marginBottom: 10,
                fontSize: 15,
              }}
            >
              MENU
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["Home", "Shop", "Our Story", "Contact us"].map((item) => (
                <a
                  key={item}
                  href="#"
                  style={{
                    color: "#ddd",
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                >
                  {item}
                </a>
              ))}
            </div>

            <h4
              style={{
                color: "#fff",
                fontWeight: "bold",
                marginBottom: 10,
                marginTop: 20,
                fontSize: 15,
              }}
            >
              OUR POLICY
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Privacy Policy",
                "Return & Refund Policy",
                "Shipping & Delivery Policy",
                "Terms & Conditions",
              ].map((item) => (
                <a
                  key={item}
                  href="#"
                  style={{
                    color: "#ddd",
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            textAlign: "center",
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <p style={{ color: "#ddd", fontSize: 12, margin: 0 }}>
            © 2026, PRAKRITI HERBS PRIVATE LIMITED
          </p>
        </div>
      </div>
    </footer>
  );
}
