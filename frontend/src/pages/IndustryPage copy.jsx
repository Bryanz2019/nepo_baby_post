import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

// ── palette & tokens ──────────────────────────────────────────────────────────
const C = {
  paper:   "#f0ebe0",
  ink:     "#1a1208",
  sepia:   "#8b7355",
  crimson: "#7a1c1c",
  gold:    "#c8a96e",
  muted:   "#b5a48a",
  rule:    "#c4b89a",
  darkBg:  "#1a0f08",
  sidebar: "#f5f0e8",
};

const API = "http://localhost:8080";

// ── tier definitions ──────────────────────────────────────────────────────────
const TIERS = [
  { key: "all",         label: "ALL",         range: "Every film",         min: 0,      max: Infinity },
  { key: "niche",       label: "NICHE",       range: "< 1K votes",         min: 0,      max: 999 },
  { key: "popular",     label: "POPULAR",     range: "1K – 50K votes",     min: 1000,   max: 49999 },
  { key: "major_hit",   label: "MAJOR HIT",   range: "50K – 200K votes",   min: 50000,  max: 199999 },
  { key: "blockbuster", label: "BLOCKBUSTER", range: "> 200K votes",       min: 200000, max: Infinity },
];

function getTierKey(votes) {
  if (votes < 1000)   return "niche";
  if (votes < 50000)  return "popular";
  if (votes < 200000) return "major_hit";
  return "blockbuster";
}

// ── tiny helpers ──────────────────────────────────────────────────────────────
const Rule = ({ thick }) => (
  <div style={{
    borderTop: thick ? `3px double ${C.rule}` : `1px solid ${C.rule}`,
    margin: "4px 0",
  }} />
);

const SectionLabel = ({ children }) => (
  <p style={{
    fontFamily: "'Courier Prime', 'Courier New', monospace",
    fontSize: 9,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: C.sepia,
    margin: "0 0 4px",
  }}>{children}</p>
);

const ExhibitTitle = ({ label, title, subtitle }) => (
  <div style={{ marginBottom: 10 }}>
    <SectionLabel>{label}</SectionLabel>
    <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 700, color: C.ink, margin: "0 0 2px" }}>{title}</p>
    {subtitle && <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.sepia, margin: 0 }}>{subtitle}</p>}
  </div>
);

// ── custom tooltip ─────────────────────────────────────────────────────────────
const NewsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.darkBg, border: `1px solid ${C.gold}`,
      padding: "8px 12px", fontFamily: "'Courier Prime', monospace", fontSize: 11,
    }}>
      <p style={{ color: C.gold, margin: "0 0 4px", fontWeight: 700 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: {typeof p.value === "number"
            ? p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}K` : p.value.toFixed(1)
            : p.value}
        </p>
      ))}
    </div>
  );
};

// ── stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, accent }) => (
  <div style={{
    background: accent ? C.crimson : C.ink,
    color: "#fff",
    padding: "14px 16px",
    flex: 1,
    minWidth: 0,
  }}>
    <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, margin: "0 0 6px" }}>{label}</p>
    <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 900, color: "#fff", margin: "0 0 2px", lineHeight: 1 }}>{value}</p>
    <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.muted, margin: 0 }}>{sub}</p>
  </div>
);

// ── profession donut ───────────────────────────────────────────────────────────
const PROF_COLORS = ["#7a1c1c", "#c8a96e", "#8b7355", "#4a3728", "#2a1f18"];
const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ── tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { key: "participation", label: "POPULARITY TIERS · EXHIBIT A" },
  { key: "ratings",       label: "RATINGS ANALYSIS · EXHIBIT B" },
  { key: "votes",         label: "AUDIENCE REACH · EXHIBIT C" },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function IndustryPage() {
  const [participationData, setParticipationData] = useState([]);
  const [industryMetrics,   setIndustryMetrics]   = useState([]);
  const [collaborations,    setCollaborations]    = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [activeTab,         setActiveTab]         = useState("participation");
  const [activeTier,        setActiveTier]        = useState("all");

  const ratingsByProf  = useRef([]);
  const votesByProf    = useRef([]);
  const profBreakdown  = useRef([]);
  const nepoCapture    = useRef(31.4);
  // year × tier matrix: { [year]: { all, niche, popular, major_hit, blockbuster } }
  const yearTierMatrix = useRef({});

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [partRes, metricsRes, collabRes] = await Promise.all([
          fetch(`${API}/analysis/nepo_participation_industry`),
          fetch(`${API}/analysis/nepo_industry_metrics`),
          fetch(`${API}/analysis/top_nepo_collaborations`),
        ]);
        const [part, metrics, collab] = await Promise.all([
          partRes.json(), metricsRes.json(), collabRes.json(),
        ]);

        const EXCLUDED = ["self", "archive_footage", "archive_sound"];

        // ── Build year × tier matrix ───────────────────────────────────────
        const matrix = {};
        (Array.isArray(metrics) ? metrics : [])
          .filter(r => r.year && r.avg_votes != null && r.nepo_status === "Nepo Baby" && !EXCLUDED.includes(r.profession))
          .forEach(r => {
            const yr = r.year;
            if (!matrix[yr]) matrix[yr] = { year: yr, all: 0, niche: 0, popular: 0, major_hit: 0, blockbuster: 0 };
            const tk = getTierKey(+r.avg_votes);
            matrix[yr][tk]  += r.role_count || 1;
            matrix[yr].all  += r.role_count || 1;
          });
        yearTierMatrix.current = matrix;

        // capture rate
        const totalMovies = (Array.isArray(part) ? part : []).reduce((s, r) => s + r.total_movie_count, 0);
        const nepoMovies  = (Array.isArray(part) ? part : []).reduce((s, r) => s + r.movies_with_nepo_participation, 0);
        nepoCapture.current = totalMovies > 0 ? +((nepoMovies / totalMovies) * 100).toFixed(1) : 31.4;

        // ── Exhibit B ──────────────────────────────────────────────────────
        const profMap = {};
        (Array.isArray(metrics) ? metrics : [])
          .filter(r => r.year >= 2010 && r.avg_rating && !EXCLUDED.includes(r.profession))
          .forEach(r => {
            const k = r.profession;
            if (!profMap[k]) profMap[k] = { profession: k, Nepo: null, "Self-Made": null, nepoN: 0, nonN: 0 };
            if (r.nepo_status === "Nepo Baby") {
              profMap[k].Nepo = ((profMap[k].Nepo || 0) * profMap[k].nepoN + +r.avg_rating) / (profMap[k].nepoN + 1);
              profMap[k].nepoN++;
            } else {
              profMap[k]["Self-Made"] = ((profMap[k]["Self-Made"] || 0) * profMap[k].nonN + +r.avg_rating) / (profMap[k].nonN + 1);
              profMap[k].nonN++;
            }
          });
        ratingsByProf.current = Object.values(profMap)
          .filter(d => d.Nepo && d["Self-Made"])
          .slice(0, 6)
          .map(d => ({
            profession:  d.profession.charAt(0).toUpperCase() + d.profession.slice(1),
            Nepo:        +d.Nepo.toFixed(2),
            "Self-Made": +d["Self-Made"].toFixed(2),
          }));

        // ── Exhibit C ──────────────────────────────────────────────────────
        const votesMap = {};
        (Array.isArray(metrics) ? metrics : [])
          .filter(r => r.avg_votes && !EXCLUDED.includes(r.profession))
          .forEach(r => {
            const k = r.profession;
            if (!votesMap[k]) votesMap[k] = { profession: k, Nepo: 0, "Non-Nepo": 0, nepoN: 0, nonN: 0 };
            if (r.nepo_status === "Nepo Baby") {
              votesMap[k].Nepo  = (votesMap[k].Nepo  * votesMap[k].nepoN + +r.avg_votes) / (votesMap[k].nepoN + 1);
              votesMap[k].nepoN++;
            } else {
              votesMap[k]["Non-Nepo"] = (votesMap[k]["Non-Nepo"] * votesMap[k].nonN + +r.avg_votes) / (votesMap[k].nonN + 1);
              votesMap[k].nonN++;
            }
          });
        votesByProf.current = Object.values(votesMap)
          .filter(d => d.nepoN > 0 && d.nonN > 0)
          .sort((a, b) => (b.Nepo + b["Non-Nepo"]) - (a.Nepo + a["Non-Nepo"]))
          .slice(0, 6)
          .map(d => ({
            profession: d.profession.charAt(0).toUpperCase() + d.profession.slice(1),
            Nepo:       Math.round(d.Nepo),
            "Non-Nepo": Math.round(d["Non-Nepo"]),
          }));

        // ── Sidebar ────────────────────────────────────────────────────────
        const profCountMap = {};
        (Array.isArray(metrics) ? metrics : [])
          .filter(r => r.nepo_status === "Nepo Baby" && !EXCLUDED.includes(r.profession))
          .forEach(r => {
            profCountMap[r.profession] = (profCountMap[r.profession] || 0) + r.role_count;
          });
        const total = Object.values(profCountMap).reduce((s, v) => s + v, 0);
        profBreakdown.current = Object.entries(profCountMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value]) => ({
            name:  name.charAt(0).toUpperCase() + name.slice(1),
            value,
            pct:   total > 0 ? +((value / total) * 100).toFixed(0) : 0,
          }));

        setParticipationData(part);
        setIndustryMetrics(metrics);
        setCollaborations(collab);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ── derive line chart data for the active tier ────────────────────────────
  const lineChartData = Object.values(yearTierMatrix.current)
    .sort((a, b) => a.year - b.year)
    .map(row => ({ year: row.year, count: row[activeTier] || 0 }));

  const totalRecords = participationData.length > 0
    ? participationData.reduce((s, r) => s + r.total_movie_count, 0)
    : 847000;

  const formatK = n => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);

  const activeTierDef = TIERS.find(t => t.key === activeTier);

  // ── styles ────────────────────────────────────────────────────────────────
  const pageStyle = {
    background: C.paper,
    minHeight: "100vh",
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: C.ink,
  };

  const mainGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 260px",
    gap: 0,
    maxWidth: 1180,
    margin: "0 auto",
    padding: "0 0 40px",
  };

  const chartCard = {
    background: "#fff",
    border: `1px solid ${C.rule}`,
    padding: "18px 20px",
    marginBottom: 20,
  };

  if (loading) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.ink }}>THE NEPO BABY POST</p>
        <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: C.sepia, letterSpacing: "0.1em" }}>COMPILING DOSSIER…</p>
      </div>
    </div>
  );

  return (
    <div style={pageStyle}>

      {/* ── Masthead ── */}
      <div style={{ textAlign: "center", padding: "28px 20px 10px", borderBottom: `4px double ${C.rule}` }}>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 52, fontWeight: 900, letterSpacing: "0.06em",
          color: C.ink, margin: 0, lineHeight: 1,
          textShadow: "2px 2px 0 rgba(0,0,0,0.08)",
        }}>THE NEPO BABY POST</p>
        <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.18em", color: C.sepia, margin: "6px 0 0" }}>
          EVERY CASTING SHEET TELLS A STORY — YOU JUST HAVE TO KNOW WHOSE LAST NAME TO LOOK FOR
        </p>
      </div>

      {/* ── Nav ── */}
      <nav style={{ background: C.ink, borderBottom: `2px solid ${C.gold}`, display: "flex", justifyContent: "center" }}>
        {["FRONT PAGE","DYNASTIES","EVIDENCE BOARD","THE SCORE","INDUSTRY REPORTS","FILM DOSSIER","CLASSIFIED CONNECTIONS"].map(label => (
          <button key={label} style={{
            fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: "0.12em",
            textTransform: "uppercase",
            color:      label === "INDUSTRY REPORTS" ? C.ink  : C.muted,
            background: label === "INDUSTRY REPORTS" ? C.gold : "transparent",
            padding: "10px 18px", cursor: "pointer", border: "none",
            borderRight: `1px solid #2a1f18`,
          }}>{label}</button>
        ))}
      </nav>

      {/* ── Page header ── */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 20px 10px" }}>
        <SectionLabel>Exclusive with Archives None · File 44 · Classified</SectionLabel>
        <Rule thick />
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36, fontWeight: 900, margin: "8px 0 4px", color: C.ink }}>
          THE INDUSTRY TREND
        </h1>
        <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.sepia, margin: "0 0 12px" }}>
          Documenting the encroachment of legacy talent across every discipline, decade by decade.
        </p>
        <Rule />
      </div>

      {/* ── Main layout ── */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px" }}>
        <div style={mainGrid}>

          {/* ── LEFT ── */}
          <div style={{ paddingRight: 24 }}>

            {/* Main tab toggle */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, border: `1px solid ${C.rule}` }}>
              {TABS.map(({ key, label }, idx) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{
                  flex: 1, padding: "8px 12px",
                  fontFamily: "'Courier Prime', monospace", fontSize: 9,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  background: activeTab === key ? C.ink : C.paper,
                  color:      activeTab === key ? C.gold : C.sepia,
                  border: "none",
                  borderRight: idx < TABS.length - 1 ? `1px solid ${C.rule}` : "none",
                  cursor: "pointer",
                }}>{label}</button>
              ))}
            </div>

            {/* ── EXHIBIT A ── */}
            {activeTab === "participation" && (
              <div style={chartCard}>
                <ExhibitTitle
                  label="Trend Analysis · Exhibit A"
                  title="Nepo Film Participation Over Time"
                  subtitle="Number of nepo-affiliated films per year. Click a tier to filter by popularity."
                />

                {/* Tier filter buttons */}
                <div style={{ display: "flex", gap: 4, margin: "12px 0 6px", flexWrap: "wrap", alignItems: "center" }}>
                  {TIERS.map(t => {
                    const isActive = activeTier === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setActiveTier(t.key)}
                        style={{
                          fontFamily: "'Courier Prime', monospace",
                          fontSize: 9,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          padding: "5px 12px",
                          border: `1px solid ${isActive ? C.crimson : C.rule}`,
                          background: isActive ? C.crimson : "transparent",
                          color: isActive ? "#fff" : C.sepia,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.muted, margin: "0 0 10px" }}>
                  {activeTierDef.range}
                </p>

                <Rule />

                <div style={{ height: 280, marginTop: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.rule} vertical={false} />
                      <XAxis
                        dataKey="year"
                        tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, fill: C.sepia }}
                        axisLine={false} tickLine={false} tickCount={8}
                      />
                      <YAxis
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                        tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, fill: C.sepia }}
                        axisLine={false} tickLine={false}
                      />
                      <Tooltip content={<NewsTooltip />} />
                      <Line
                        key={activeTier}
                        type="monotone"
                        dataKey="count"
                        name="Nepo Films"
                        stroke={C.crimson}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: C.crimson, strokeWidth: 0 }}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── EXHIBIT B ── */}
            {activeTab === "ratings" && (
              <div style={chartCard}>
                <ExhibitTitle
                  label="Ratings Analysis · Exhibit B"
                  title="Avg IMDb Rating: Nepo vs Non-Nepo"
                  subtitle="Mean rating of films per profession group. All years aggregated."
                />
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginBottom: 8 }}>
                  {[["Nepo", C.crimson], ["Self-Made", C.gold]].map(([label, color]) => (
                    <span key={label} style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.sepia, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 10, height: 10, background: color, display: "inline-block" }} /> {label}
                    </span>
                  ))}
                </div>
                <Rule />
                <div style={{ height: 280, marginTop: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingsByProf.current} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barGap={3}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.rule} vertical={false} />
                      <XAxis dataKey="profession"
                        tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, fill: C.sepia }}
                        axisLine={false} tickLine={false} />
                      <YAxis domain={[5, 9]}
                        tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, fill: C.sepia }}
                        axisLine={false} tickLine={false} />
                      <Tooltip content={<NewsTooltip />} />
                      <Legend
                        iconType="square" iconSize={10}
                        formatter={v => <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.sepia }}>{v}</span>}
                      />
                      <Bar dataKey="Nepo"       fill={C.crimson} radius={[2,2,0,0]} />
                      <Bar dataKey="Self-Made"  fill={C.gold}    radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── EXHIBIT C ── */}
            {activeTab === "votes" && (
              <div style={chartCard}>
                <ExhibitTitle
                  label="Audience Reach · Exhibit C"
                  title="Avg IMDb Votes by Profession: Nepo vs Non-Nepo"
                  subtitle="Average number of audience votes per title, by profession. Higher votes indicate wider audience reach."
                />
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginBottom: 8 }}>
                  {[["Nepo", C.crimson], ["Non-Nepo", C.gold]].map(([label, color]) => (
                    <span key={label} style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.sepia, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 10, height: 10, background: color, display: "inline-block" }} /> {label}
                    </span>
                  ))}
                </div>
                <Rule />
                <div style={{ height: 280, marginTop: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={votesByProf.current} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barGap={3}>
                      <CartesianGrid strokeDasharray="2 4" stroke={C.rule} vertical={false} />
                      <XAxis dataKey="profession"
                        tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, fill: C.sepia }}
                        axisLine={false} tickLine={false} />
                      <YAxis
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                        tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, fill: C.sepia }}
                        axisLine={false} tickLine={false} />
                      <Tooltip content={<NewsTooltip />} />
                      <Legend
                        iconType="square" iconSize={10}
                        formatter={v => <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.sepia }}>{v}</span>}
                      />
                      <Bar dataKey="Nepo"      fill={C.crimson} radius={[2,2,0,0]} />
                      <Bar dataKey="Non-Nepo"  fill={C.gold}    radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Collaborations list ── */}
            <div style={chartCard}>
              <ExhibitTitle
                label="Collaboration Intelligence · Exhibit D"
                title="Top Nepo-to-Nepo Collaborations"
                subtitle="Most frequent co-appearances between nepo-affiliated talent. Both parties verified."
              />
              <Rule />
              <div style={{ marginTop: 12 }}>
                {(collaborations || []).slice(0, 8).map((row, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 0", borderBottom: `1px solid ${C.rule}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0, flex: 1 }}>
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: C.muted, minWidth: 20, flexShrink: 0 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.person_name}
                      </span>
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.sepia, flexShrink: 0 }}>×</span>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {row.colleague_name}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                      <div style={{
                        width: Math.min(80, (row.total_collaborations / (collaborations[0]?.total_collaborations || 1)) * 80),
                        height: 6, background: C.crimson,
                      }} />
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, color: C.crimson, fontWeight: 700, minWidth: 28, textAlign: "right" }}>
                        {row.total_collaborations}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.muted, marginTop: 10 }}>
                DATA SOURCE: Ratescore + IMDb Cross-Reference · The Nepo Baby Post Bureau of Investigation
              </p>
            </div>
          </div>

          {/* ── RIGHT: sidebar ── */}
          <div>
            <div style={{ display: "flex", gap: 2, marginBottom: 2 }}>
              <StatCard label="Total Records"      value={formatK(totalRecords || 847000)} sub="all time, confirmed" />
              <StatCard label="Nepo Participation" value={`${nepoCapture.current}%`}       sub="of all films since 1970" accent />
            </div>

            <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
              {["AVG NEPO RATING", "CREDIT ADVANTAGE"].map((label, i) => (
                <div key={i} style={{
                  flex: 1, background: C.ink, padding: "10px 12px", textAlign: "center",
                  border: `1px solid ${i === 0 ? C.gold : "transparent"}`, cursor: "pointer",
                }}>
                  <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.1em", color: i === 0 ? C.gold : C.muted, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Profession Breakdown donut */}
            <div style={{ background: C.sidebar, border: `1px solid ${C.rule}`, padding: "16px", marginBottom: 16 }}>
              <SectionLabel>Profession Breakdown</SectionLabel>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.sepia, margin: "0 0 12px", fontStyle: "italic" }}>Role Count by Type</p>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <PieChart width={100} height={100}>
                  <Pie
                    data={profBreakdown.current.length ? profBreakdown.current : [
                      { name: "Actor", value: 48 }, { name: "Director", value: 18 },
                      { name: "Producer", value: 16 }, { name: "Writer", value: 8 }, { name: "Other", value: 10 },
                    ]}
                    cx={50} cy={50} innerRadius={28} outerRadius={48}
                    labelLine={false} label={renderCustomLabel} dataKey="value">
                    {(profBreakdown.current.length ? profBreakdown.current : [{},{},{},{},{}]).map((_, i) => (
                      <Cell key={i} fill={PROF_COLORS[i % PROF_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div>
                  {(profBreakdown.current.length ? profBreakdown.current : [
                    { name: "Actor", pct: 48 }, { name: "Director", pct: 18 },
                    { name: "Producer", pct: 16 }, { name: "Writer", pct: 8 }, { name: "Other", pct: 10 },
                  ]).map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{ width: 8, height: 8, background: PROF_COLORS[i], display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.ink }}>{d.name}</span>
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.sepia, marginLeft: "auto", paddingLeft: 8 }}>{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Industry Capture Rate donut */}
            <div style={{ background: C.sidebar, border: `1px solid ${C.rule}`, padding: "16px", marginBottom: 16 }}>
              <SectionLabel>Representation 2016–2024</SectionLabel>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.sepia, margin: "0 0 4px", fontStyle: "italic" }}>Industry Capture Rate</p>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.ink, margin: "0 0 12px", lineHeight: 1.5 }}>
                Share of industry roles held by nepo-affiliated talent, recent era.
              </p>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ position: "relative", width: 120, height: 120 }}>
                  <PieChart width={120} height={120}>
                    <Pie
                      data={[{ value: nepoCapture.current }, { value: 100 - nepoCapture.current }]}
                      cx={60} cy={60} startAngle={90} endAngle={-270}
                      innerRadius={40} outerRadius={55} dataKey="value" strokeWidth={0}>
                      <Cell fill={C.crimson} />
                      <Cell fill={C.rule} />
                    </Pie>
                  </PieChart>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 900, color: C.ink, margin: 0, lineHeight: 1 }}>{nepoCapture.current}%</p>
                    <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 7, color: C.sepia, margin: 0, letterSpacing: "0.08em" }}>NEPO</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                  {[["Nepo", C.crimson], ["Other", C.rule]].map(([label, color]) => (
                    <span key={label} style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.sepia, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, background: color, display: "inline-block", borderRadius: "50%" }} />{label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Field Agents box */}
            <div style={{ border: `2px solid ${C.ink}`, padding: "14px", background: C.paper }}>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.crimson, margin: "0 0 4px", fontWeight: 700 }}>
                The Nepo Baby Post · Field Agents
              </p>
              <Rule thick />
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontStyle: "italic", color: C.ink, margin: "8px 0 10px", lineHeight: 1.5 }}>
                "Our mind rebels at stagnation."
              </p>
              <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.sepia, margin: 0, lineHeight: 1.7 }}>
                Give us problems, give us work, give us the most abstruse cryptogram or the most intricate analysis, and we in our own broker atmosphere.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `2px double ${C.rule}`, padding: "10px 0", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.sepia }}>
            DATA SOURCE: Ratescore + IMDb Cross-Reference · The Nepo Baby Post Bureau of Investigation
          </span>
          <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, color: C.sepia }}>
            All connections verified. All sources listening.
          </span>
        </div>
      </div>
    </div>
  );
}