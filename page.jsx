import { useState } from "react";

const plans = [
  {
    category: "Adults — Private Tutoring",
    items: [
      {
        name: "Standard",
        subtitle: "Up to 3 classes/week",
        base: 199,
        current: { three: 499, six: 799 },
        proposed: { three: 539, six: 959 },
      },
      {
        name: "Plus",
        subtitle: "Up to 5 classes/week",
        base: 299,
        current: { three: 749, six: 1249 },
        proposed: { three: 809, six: 1439 },
      },
    ],
  },
  {
    category: "Adults — Group Classes",
    items: [
      {
        name: "Unlimited",
        subtitle: "Unlimited classes",
        base: 149,
        current: { three: 349, six: 599 },
        proposed: { three: 399, six: 719 },
      },
      {
        name: "Lite",
        subtitle: "Up to 10 classes/mo",
        base: 99,
        current: { three: 249, six: 399 },
        proposed: { three: 269, six: 479 },
      },
    ],
  },
  {
    category: "Kids — Private Tutoring",
    items: [
      {
        name: "Standard",
        subtitle: "Kids private",
        base: 249,
        current: { three: 629, six: 1049 },
        proposed: { three: 669, six: 1199 },
      },
      {
        name: "Plus",
        subtitle: "Kids private plus",
        base: 349,
        current: { three: 799, six: 1399 },
        proposed: { three: 939, six: 1679 },
      },
    ],
  },
];

function pct(base, pkg, months) {
  const monthly = pkg / months;
  return Math.round((1 - monthly / base) * 100);
}

function monthly(pkg, months) {
  return (pkg / months).toFixed(2);
}

function delta(proposed, current) {
  return proposed - current;
}

export default function PricingComparison() {
  const [view, setView] = useState("proposed");

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#F8FAFC", minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            SpanishVIP — Proposed Pricing Restructure
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
            Base prices unchanged · 3-month → ~10% off · 6-month → ~20% off
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 28, background: "#E2E8F0", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {[
            { key: "proposed", label: "Proposed Pricing" },
            { key: "comparison", label: "Current vs Proposed" },
            { key: "revenue", label: "Revenue Impact" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: view === t.key ? "#fff" : "transparent",
                color: view === t.key ? "#0F172A" : "#64748B",
                boxShadow: view === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {plans.map((cat, ci) => (
          <div key={ci} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px 0" }}>
              {cat.category}
            </h2>

            {cat.items.map((plan, pi) => (
              <div
                key={pi}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{plan.name}</span>
                    <span style={{ fontSize: 13, color: "#94A3B8", marginLeft: 10 }}>{plan.subtitle}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>${plan.base}/mo base</span>
                </div>

                {view === "proposed" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                    {[
                      { label: "1 Month", price: plan.base, mo: plan.base, disc: 0 },
                      { label: "3 Months", price: plan.proposed.three, mo: monthly(plan.proposed.three, 3), disc: pct(plan.base, plan.proposed.three, 3) },
                      { label: "6 Months", price: plan.proposed.six, mo: monthly(plan.proposed.six, 6), disc: pct(plan.base, plan.proposed.six, 6) },
                    ].map((col, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "16px 20px",
                          borderRight: i < 2 ? "1px solid #F1F5F9" : "none",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                          {col.label}
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
                          ${col.price.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                          ${col.mo}/mo
                        </div>
                        {col.disc > 0 && (
                          <div style={{
                            display: "inline-block",
                            marginTop: 6,
                            padding: "2px 10px",
                            borderRadius: 20,
                            background: "#DCFCE7",
                            color: "#166534",
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            Save {col.disc}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {view === "comparison" && (
                  <div style={{ padding: "12px 20px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                          <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}></th>
                          <th style={{ textAlign: "center", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}>Current</th>
                          <th style={{ textAlign: "center", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}>Proposed</th>
                          <th style={{ textAlign: "center", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}>Disc. Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            period: "3 Months",
                            cur: plan.current.three,
                            prop: plan.proposed.three,
                            curDisc: pct(plan.base, plan.current.three, 3),
                            propDisc: pct(plan.base, plan.proposed.three, 3),
                          },
                          {
                            period: "6 Months",
                            cur: plan.current.six,
                            prop: plan.proposed.six,
                            curDisc: pct(plan.base, plan.current.six, 6),
                            propDisc: pct(plan.base, plan.proposed.six, 6),
                          },
                        ].map((row, ri) => (
                          <tr key={ri} style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "10px 8px", fontWeight: 600, color: "#334155" }}>{row.period}</td>
                            <td style={{ padding: "10px 8px", textAlign: "center", color: "#64748B" }}>
                              ${row.cur.toLocaleString()}
                              <span style={{ display: "block", fontSize: 11, color: "#94A3B8" }}>{row.curDisc}% off</span>
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "center", color: "#0F172A", fontWeight: 700 }}>
                              ${row.prop.toLocaleString()}
                              <span style={{ display: "block", fontSize: 11, color: "#166534", fontWeight: 600 }}>{row.propDisc}% off</span>
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "center" }}>
                              <span style={{
                                display: "inline-block",
                                padding: "2px 10px",
                                borderRadius: 20,
                                background: "#FEF3C7",
                                color: "#92400E",
                                fontSize: 12,
                                fontWeight: 700,
                              }}>
                                {row.curDisc}% → {row.propDisc}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {view === "revenue" && (
                  <div style={{ padding: "12px 20px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                          <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}></th>
                          <th style={{ textAlign: "center", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}>Per Subscriber</th>
                          <th style={{ textAlign: "center", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}>Per 50 Subs</th>
                          <th style={{ textAlign: "center", padding: "6px 8px", color: "#64748B", fontWeight: 600 }}>Per 100 Subs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { period: "3-Month", d: delta(plan.proposed.three, plan.current.three) },
                          { period: "6-Month", d: delta(plan.proposed.six, plan.current.six) },
                        ].map((row, ri) => (
                          <tr key={ri} style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "10px 8px", fontWeight: 600, color: "#334155" }}>{row.period}</td>
                            <td style={{ padding: "10px 8px", textAlign: "center" }}>
                              <span style={{ color: "#166534", fontWeight: 700 }}>+${row.d.toLocaleString()}</span>
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "center" }}>
                              <span style={{ color: "#166534", fontWeight: 700 }}>+${(row.d * 50).toLocaleString()}</span>
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "center" }}>
                              <span style={{ color: "#166534", fontWeight: 700 }}>+${(row.d * 100).toLocaleString()}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <div style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)",
          borderRadius: 12,
          padding: "24px 28px",
          color: "#fff",
          marginTop: 8,
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700 }}>Restructure Summary</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 4 }}>1 Month</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>No change</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>Full price, no discount</div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 4 }}>3 Months</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>~10% off</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>Down from 16–24%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8", marginBottom: 4 }}>6 Months</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>~20% off</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>Down from 30–33%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}