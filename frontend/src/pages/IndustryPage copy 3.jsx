import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

const C = {
  paper: "#f0ebe0",
  ink: "#1a1208",
  sepia: "#8b7355",
  crimson: "#7a1c1c",
  gold: "#c8a96e",
  rule: "#c4b89a",
};

const API = "http://localhost:8080";

const TIERS = [
  { key: "all", label: "ALL", range: "Every film" },
  { key: "minor", label: "MINOR", range: "< 1K votes" },
  { key: "popular_plus", label: "POPULAR+", range: "1K+ votes" },
];

function getTierKey(votes) {
  if (votes < 1000) return "minor";
  return "popular_plus";
}

const Rule = () => (
  <div style={{ borderTop: `1px solid ${C.rule}`, margin: "8px 0" }} />
);

const ExhibitTitle = ({ title, subtitle }) => (
  <div style={{ marginBottom: 10 }}>
    <p style={{
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: 18,
      fontWeight: 700,
      color: C.ink,
      margin: "0 0 4px"
    }}>
      {title}
    </p>
    <p style={{
      fontFamily: "'Courier Prime', monospace",
      fontSize: 10,
      color: C.sepia,
      margin: 0
    }}>
      {subtitle}
    </p>
  </div>
);

const NewsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.rule}`,
      padding: "8px 10px",
      fontFamily: "'Courier Prime', monospace",
      fontSize: 11
    }}>
      <p style={{ margin: "0 0 4px", color: C.ink, fontWeight: 700 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function IndustryPage() {
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState("all");

  const yearTierMovieCountMatrix = useRef({});
  const avgVotesByProf = useRef([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const metricsRes = await fetch(`${API}/analysis/nepo_industry_metrics`);
        const metrics = await metricsRes.json();

        const EXCLUDED = ["self", "archive_footage", "archive_sound"];
        const tierKeys = ["all", "minor", "popular_plus"];

        // Chart 1: number of movies by year, split by nepo/non-nepo, tier-filtered
        const matrix = {};

        (Array.isArray(metrics) ? metrics : [])
          .filter(r => r.year && r.avg_votes != null && !EXCLUDED.includes(r.profession))
          .forEach(r => {
            const yr = r.year;
            const tier = getTierKey(+r.avg_votes);
            const isNepo = r.nepo_status === "Nepo Baby";
            const field = isNepo ? "nepo" : "nonNepo";
            const movieCount = +r.role_count || 0;

            if (!matrix[yr]) {
              matrix[yr] = { year: yr };
              tierKeys.forEach(tk => {
                matrix[yr][tk] = { nepo: 0, nonNepo: 0 };
              });
            }

            matrix[yr][tier][field] += movieCount;
            matrix[yr].all[field] += movieCount;
          });

        yearTierMovieCountMatrix.current = matrix;

        // Chart 2: average votes by profession for g1/g2
        const votesMap = {};

        (Array.isArray(metrics) ? metrics : [])
          .filter(r => r.avg_votes != null && !EXCLUDED.includes(r.profession))
          .forEach(r => {
            const k = r.profession;
            if (!votesMap[k]) {
              votesMap[k] = {
                profession: k,
                nepoVotesSum: 0,
                nepoWeight: 0,
                nonNepoVotesSum: 0,
                nonNepoWeight: 0,
              };
            }

            const avgVotes = +r.avg_votes || 0;
            const weight = +r.role_count || 0;

            if (r.nepo_status === "Nepo Baby") {
              votesMap[k].nepoVotesSum += avgVotes * weight;
              votesMap[k].nepoWeight += weight;
            } else {
              votesMap[k].nonNepoVotesSum += avgVotes * weight;
              votesMap[k].nonNepoWeight += weight;
            }
          });

        avgVotesByProf.current = Object.values(votesMap)
          .map(d => ({
            profession: d.profession.charAt(0).toUpperCase() + d.profession.slice(1),
            "G1 Nepo": d.nepoWeight ? +(d.nepoVotesSum / d.nepoWeight).toFixed(1) : 0,
            "G2 Non-Nepo": d.nonNepoWeight ? +(d.nonNepoVotesSum / d.nonNepoWeight).toFixed(1) : 0,
            totalWeight: d.nepoWeight + d.nonNepoWeight
          }))
          .filter(d => d["G1 Nepo"] > 0 || d["G2 Non-Nepo"] > 0)
          .sort((a, b) => b.totalWeight - a.totalWeight)
          .slice(0, 10);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const lineChartData = Object.values(yearTierMovieCountMatrix.current)
    .sort((a, b) => a.year - b.year)
    .map(row => ({
      year: row.year,
      nepo: row[activeTier]?.nepo || 0,
      nonNepo: row[activeTier]?.nonNepo || 0,
    }));

  const activeTierDef = TIERS.find(t => t.key === activeTier);

  const pageStyle = {
    background: C.paper,
    minHeight: "100vh",
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: C.ink,
    padding: "24px",
  };

  const cardStyle = {
    background: "#fff",
    border: `1px solid ${C.rule}`,
    padding: "18px 20px",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: "center", paddingTop: 80 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ ...cardStyle, position: "sticky", top: 24 }}>
          <ExhibitTitle
            title="Methodology"
            subtitle="How the two charts are built"
          />
          <Rule />
          <div style={{ fontSize: 13, lineHeight: 1.7, color: C.ink }}>
            <p><strong>Chart 1.</strong> Counts movie appearances by year for Nepo vs Non-Nepo.</p>
            <p><strong>Tiers.</strong> Minor = under 1K average votes. Popular+ = 1K or more average votes.</p>
            <p><strong>Chart 2.</strong> Uses average votes by profession, shown separately for G1 Nepo and G2 Non-Nepo.</p>
            <p><strong>Exclusions.</strong> Self, archive footage, and archive sound are removed.</p>
          </div>

          <div style={{ marginTop: 18 }}>
            <ExhibitTitle
              title="Conclusion"
              subtitle="What to read from the charts"
            />
            <Rule />
            <div style={{ fontSize: 13, lineHeight: 1.7, color: C.ink }}>
              <p>The year trend shows where Nepo and Non-Nepo are concentrated by movie volume.</p>
              <p>The profession chart shows whether one group tends to appear in higher-vote roles on average.</p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div style={cardStyle}>
            <ExhibitTitle
              title="Chart 1: Movie Count by Year and Tier"
              subtitle="X = years, Y = number of movies, split by nepo vs non-nepo"
            />

            <div style={{ display: "flex", gap: 6, margin: "12px 0 8px", flexWrap: "wrap" }}>
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
                      padding: "6px 12px",
                      border: `1px solid ${isActive ? C.crimson : C.rule}`,
                      background: isActive ? C.crimson : "transparent",
                      color: isActive ? "#fff" : C.sepia,
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <p style={{
              fontFamily: "'Courier Prime', monospace",
              fontSize: 9,
              color: C.sepia,
              margin: "0 0 8px"
            }}>
              {activeTierDef?.range}
            </p>

            <Rule />

            <div style={{ height: 340, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.rule} vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, fill: C.sepia }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, fill: C.sepia }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<NewsTooltip />} />
                  <Legend
                    formatter={v => (
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.sepia }}>
                        {v === "nepo" ? "Nepo" : "Non-Nepo"}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="nepo"
                    name="Nepo"
                    stroke={C.crimson}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="nonNepo"
                    name="Non-Nepo"
                    stroke={C.gold}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardStyle}>
            <ExhibitTitle
              title="Chart 2: Average Votes by Profession"
              subtitle="G1 = nepo, G2 = non-nepo"
            />

            <Rule />

            <div style={{ height: 360, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgVotesByProf.current} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barGap={4}>
                  <CartesianGrid strokeDasharray="2 4" stroke={C.rule} vertical={false} />
                  <XAxis
                    dataKey="profession"
                    tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, fill: C.sepia }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}
                    tick={{ fontFamily: "'Courier Prime', monospace", fontSize: 9, fill: C.sepia }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<NewsTooltip />} />
                  <Legend
                    formatter={v => (
                      <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, color: C.sepia }}>
                        {v}
                      </span>
                    )}
                  />
                  <Bar dataKey="G1 Nepo" fill={C.crimson} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="G2 Non-Nepo" fill={C.gold} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}