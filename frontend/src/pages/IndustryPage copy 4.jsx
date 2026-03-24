import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import LeftPanel from "../components/LeftPanel";
import Button from "../components/Button";

const API = "http://localhost:8080";

const EXCLUDED_PROFESSIONS = [
  "self",
  "archive_footage",
  "archive_sound",
  "casting_director",
];

const TIERS = [
  { key: "all", label: "ALL", subtitle: "Every movie in scope" },
  { key: "minor", label: "MINOR", subtitle: "Average votes under 1K" },
  { key: "popular", label: "POPULAR", subtitle: "Average votes 1K to under 50K" },
  { key: "major_hit", label: "MAJOR HIT", subtitle: "Average votes 50K to under 200K" },
  { key: "blockbuster", label: "BLOCKBUSTER", subtitle: "Average votes 200K+" },
];

function getTierKey(avgVotes) {
  if (avgVotes < 1000) return "minor";
  if (avgVotes < 50000) return "popular";
  if (avgVotes < 100000) return "major_hit";
  return "blockbuster";
}

function formatYAxis(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return `${v}`;
}

function formatProfessionLabel(v) {
  return String(v || "")
    .split("_")
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-paper border border-ink px-3 py-2 shadow-sm">
      <div className="label-tiny text-ink mb-1">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="body-medium text-[14px]" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? formatYAxis(entry.value) : entry.value}
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="label-tiny text-red uppercase tracking-widest">{children}</div>;
}

export default function IndustryPage() {
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState("all");
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API}/analysis/nepo_industry_metrics`);
        const data = await res.json();
        setMetrics(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setMetrics([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const cleanRows = useMemo(() => {
    return metrics.filter(
      (r) =>
        r?.year != null &&
        r?.avg_votes != null &&
        !EXCLUDED_PROFESSIONS.includes(String(r.profession || "").toLowerCase())
    );
  }, [metrics]);

  const chart1Matrix = useMemo(() => {
    const matrix = {};

    cleanRows.forEach((r) => {
      const year = Number(r.year);
      const avgVotes = Number(r.avg_votes) || 0;
      const movieCount = Number(r.role_count) || 0;
      const tier = getTierKey(avgVotes);
      const bucket = String(r.nepo_status) === "Nepo Baby" ? "nepo" : "nonNepo";

      if (!matrix[year]) {
        matrix[year] = {
          year,
          all: { nepo: 0, nonNepo: 0 },
          minor: { nepo: 0, nonNepo: 0 },
          popular: { nepo: 0, nonNepo: 0 },
          major_hit: { nepo: 0, nonNepo: 0 },
          blockbuster: { nepo: 0, nonNepo: 0 },
        };
      }

      matrix[year][tier][bucket] += movieCount;
      matrix[year].all[bucket] += movieCount;
    });

    return Object.values(matrix)
      .sort((a, b) => a.year - b.year)
      .map((row) => ({
        year: row.year,
        nepo: row[activeTier]?.nepo || 0,
        nonNepo: row[activeTier]?.nonNepo || 0,
      }));
  }, [cleanRows, activeTier]);

  const chart2Data = useMemo(() => {
    const map = {};

    cleanRows.forEach((r) => {
      const profession = String(r.profession || "").toLowerCase();
      const avgVotes = Number(r.avg_votes) || 0;
      const weight = Number(r.role_count) || 0;
      const isNepo = String(r.nepo_status) === "Nepo Baby";

      if (!map[profession]) {
        map[profession] = {
          profession: formatProfessionLabel(profession),
          nepoWeightedVotes: 0,
          nepoWeight: 0,
          nonNepoWeightedVotes: 0,
          nonNepoWeight: 0,
        };
      }

      if (isNepo) {
        map[profession].nepoWeightedVotes += avgVotes * weight;
        map[profession].nepoWeight += weight;
      } else {
        map[profession].nonNepoWeightedVotes += avgVotes * weight;
        map[profession].nonNepoWeight += weight;
      }
    });

    return Object.values(map)
      .map((d) => ({
        profession: d.profession,
        "G1 Nepo": d.nepoWeight ? +(d.nepoWeightedVotes / d.nepoWeight).toFixed(1) : 0,
        "G2 Non-Nepo": d.nonNepoWeight ? +(d.nonNepoWeightedVotes / d.nonNepoWeight).toFixed(1) : 0,
        totalWeight: d.nepoWeight + d.nonNepoWeight,
      }))
      .filter((d) => d["G1 Nepo"] > 0 || d["G2 Non-Nepo"] > 0)
      .sort((a, b) => b.totalWeight - a.totalWeight);
  }, [cleanRows]);

  const activeTierMeta = TIERS.find((t) => t.key === activeTier);

  return (
    <div className="flex w-full h-full bg-panel">
      <LeftPanel>
        <div className="relative label-tiny text-red -mt-2">
          INDUSTRY TREND &nbsp;
          <span className="label-tiny text-print">/ &nbsp;DIACHRONIC RESEARCH</span>
          <span className="absolute right-0 label-tiny text-print">NO. 02</span>
        </div>

        <div className="divider -mb-2 -mt-4 -mx-4 p-0"></div>

        <div className="flex flex-col gap-3">
          <SectionLabel>Methodology</SectionLabel>
          <div className="head-big text-ink leading-tight">
            How these two exhibits were built
          </div>
          <div className="body-medium text-print text-[15px] leading-7">
            <p className="mb-3">
              <span className="text-red">Chart 1</span> tracks the number of movie
              appearances by year for two groups: G1 Nepo and G2 Non-Nepo.
            </p>
            <p className="mb-3">
              Movies are grouped into four tiers using the movie’s average vote count,
              not votes on the baby or person. The breakdown is Minor, Popular, Major
              Hit, and Blockbuster, with an All view across the full sample.
            </p>
            <p className="mb-3">
              <span className="text-red">Chart 2</span> compares professions using
              average votes by movie for G1 Nepo and G2 Non-Nepo. Self, archive
              footage, archive sound, and casting director are excluded.
            </p>
          </div>
        </div>

        <div className="divider -my-1 -mx-4 p-0"></div>

        <div className="flex flex-col gap-3">
          <SectionLabel>Conclusion</SectionLabel>
          <div className="head-medium text-ink text-[20px]">
            Read the volume and quality signal separately
          </div>
          <div className="body-medium text-print text-[15px] leading-7">
            <p className="mb-3">
              The line chart shows when each group appears more often across movie
              tiers.
            </p>
            <p className="mb-3">
              The bar chart shows which professions are associated with higher-vote
              movies on average for Nepo versus Non-Nepo groups.
            </p>
          </div>
        </div>
      </LeftPanel>

      <div className="flex-1 min-w-0 flex flex-col bg-panel overflow-y-auto">
        <div className="w-full px-6 pt-6 pb-4 bg-panel border-b-[3px] border-ink">
          <div className="mb-2">
            <SectionLabel>Exclusive Intelligence Bureau · Industry Analysis</SectionLabel>
          </div>
          <div className="head-big text-ink">Compare Career Patterns Across the Industry</div>
          <div className="subheader-medium text-print mt-1">
            Movie count by year and average-vote profile by profession
          </div>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="border-[2px] border-ink bg-paper px-5 py-5">
            <div className="flex flex-col gap-2 mb-4">
              <SectionLabel>Chart 1</SectionLabel>
              <div className="head-medium text-ink text-[22px]">
                Movie Count by Year and Movie Tier
              </div>
              <div className="subheader-medium text-print">
                X = year · Y = number of movies · G1 Nepo vs G2 Non-Nepo
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {TIERS.map((tier) => (
                <Button
                  key={tier.key}
                  className={`${activeTier === tier.key ? "always-active" : ""} px-3 py-1`}
                  onClick={() => setActiveTier(tier.key)}
                >
                  {tier.label}
                </Button>
              ))}
            </div>

            <div className="label-tiny text-print mb-4">{activeTierMeta?.subtitle}</div>

            <div className="w-full h-[360px]">
              {loading ? (
                <div className="h-full flex items-center justify-center subheader-medium text-muted animate-pulse">
                  Loading chart…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart1Matrix} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 4" stroke="var(--color-subtle)" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: "var(--color-print)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--color-print)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "12px" }}
                      formatter={(value) => (
                        <span className="label-tiny text-print">
                          {value === "nepo" ? "G1 Nepo" : "G2 Non-Nepo"}
                        </span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="nepo"
                      name="G1 Nepo"
                      stroke="var(--color-red)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="nonNepo"
                      name="G2 Non-Nepo"
                      stroke="var(--color-success)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="border-[2px] border-ink bg-paper px-5 py-5">
            <div className="flex flex-col gap-2 mb-4">
              <SectionLabel>Chart 2</SectionLabel>
              <div className="head-medium text-ink text-[22px]">
                Average Votes by Profession
              </div>
              <div className="subheader-medium text-print">
                Uses movie average votes, grouped into G1 Nepo and G2 Non-Nepo
              </div>
            </div>

            <div className="w-full h-[420px]">
              {loading ? (
                <div className="h-full flex items-center justify-center subheader-medium text-muted animate-pulse">
                  Loading chart…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart2Data} margin={{ top: 10, right: 24, left: 0, bottom: 8 }} barGap={6}>
                    <CartesianGrid strokeDasharray="3 4" stroke="var(--color-subtle)" vertical={false} />
                    <XAxis
                      dataKey="profession"
                      tick={{ fill: "var(--color-print)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      tick={{ fill: "var(--color-print)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "12px" }}
                      formatter={(value) => <span className="label-tiny text-print">{value}</span>}
                    />
                    <Bar dataKey="G1 Nepo" fill="var(--color-red)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="G2 Non-Nepo" fill="var(--color-success)" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}