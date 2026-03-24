import { useState, useEffect, useMemo } from "react";
import {
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
  if (avgVotes < 200000) return "major_hit";
  return "blockbuster";
}

function getYearBucket(year) {
  if (year < 1900) return "Before 1900";
  if (year < 1925) return "1900–1925";
  if (year < 1950) return "1925–1950";
  if (year < 1975) return "1950–1975";
  if (year < 2000) return "1975–2000";
  return "2000–2026";
}

function getYearBucketOrder(bucket) {
  if (bucket === "Before 1900") return 0;
  if (bucket === "1900–1925") return 1;
  if (bucket === "1925–1950") return 2;
  if (bucket === "1950–1975") return 3;
  if (bucket === "1975–2000") return 4;
  return 5;
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

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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

  const chart1Data = useMemo(() => {
    const matrix = {};

    cleanRows.forEach((r) => {
      const year = Number(r.year);
      const avgVotes = Number(r.avg_votes) || 0;
      const movieCount = Number(r.role_count) || 0;
      const tier = getTierKey(avgVotes);
      const group = getYearBucket(year);
      const bucket = String(r.nepo_status) === "Nepo Baby" ? "nepo" : "nonNepo";

      if (!matrix[group]) {
        matrix[group] = {
          group,
          order: getYearBucketOrder(group),
          all: { nepo: 0, nonNepo: 0 },
          minor: { nepo: 0, nonNepo: 0 },
          popular: { nepo: 0, nonNepo: 0 },
          major_hit: { nepo: 0, nonNepo: 0 },
          blockbuster: { nepo: 0, nonNepo: 0 },
        };
      }

      matrix[group][tier][bucket] += movieCount;
      matrix[group].all[bucket] += movieCount;
    });

    return Object.values(matrix)
      .sort((a, b) => a.order - b.order)
      .map((row) => ({
        group: row.group,
        nepo: row[activeTier]?.nepo || 0,
        nonNepo: row[activeTier]?.nonNepo || 0,
      }));
  }, [cleanRows, activeTier]);

  const chart2Data = useMemo(() => {
    const map = {};

    cleanRows.forEach((r) => {
      const profession = String(r.profession || "").toLowerCase();
      const avgVotes = Number(r.avg_votes) || 0;
      const isNepo = String(r.nepo_status) === "Nepo Baby";

      if (!map[profession]) {
        map[profession] = {
          profession: formatProfessionLabel(profession),
          nepoVotes: [],
          nonNepoVotes: [],
        };
      }

      if (isNepo) {
        map[profession].nepoVotes.push(avgVotes);
      } else {
        map[profession].nonNepoVotes.push(avgVotes);
      }
    });

    return Object.values(map)
      .map((d) => ({
        profession: d.profession,
        "G1 Nepo": +median(d.nepoVotes).toFixed(1),
        "G2 Non-Nepo": +median(d.nonNepoVotes).toFixed(1),
        totalWeight: d.nepoVotes.length + d.nonNepoVotes.length,
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
          <div className="head-big text-ink leading-tight">
            How these two exhibits were built
          </div>
          <div className="body-medium text-print text-[15px] leading-7">
            <p className="mb-3">
              <SectionLabel>Chart 1</SectionLabel>
              Tracks the number of movie appearances by time period for two groups:
              G1 Nepo and G2 Non-Nepo.
            </p>
            <p className="mb-3">
              Movies are grouped into four tiers using the movie’s average vote count,
              not votes on the baby or person. The breakdown is Minor, Popular, Major
              Hit, and Blockbuster, with an All view across the full sample.
            </p>
            <p className="mb-3">
              <SectionLabel>Chart 2</SectionLabel>
              Compares professions using median votes by movie for G1 Nepo and G2
              Non-Nepo. Self, archive footage, archive sound, and casting director
              are excluded.
            </p>
          </div>
        </div>

        <div className="divider -my-1 -mx-4 p-0"></div>
      </LeftPanel>

      <div className="flex-1 min-w-0 flex flex-col bg-panel overflow-y-auto">
        <div className="w-full px-6 pt-6 pb-4 bg-panel border-b-[3px] border-ink">
          <div className="mb-2">
            <SectionLabel>Exclusive Intelligence Bureau · Industry Analysis</SectionLabel>
          </div>
          <div className="head-big text-ink">Compare Career Patterns Across the Industry</div>
          <div className="subheader-medium text-print mt-1">
            Movie count by grouped years and median-vote profile by profession
          </div>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="border-[2px] border-ink bg-paper px-5 py-5">
            <div className="flex flex-col gap-2 mb-4">
              <SectionLabel>Chart 1</SectionLabel>
              <div className="head-medium text-ink text-[22px]">
                Movie Count by Time Period and Movie Tier
              </div>
              <div className="subheader-medium text-print">
                X = grouped years · Y = number of movies · G1 Nepo vs G2 Non-Nepo
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
                  <BarChart data={chart1Data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }} barGap={8}>
                    <CartesianGrid strokeDasharray="3 4" stroke="var(--color-subtle)" vertical={false} />
                    <XAxis
                      dataKey="group"
                      tick={{ fill: "var(--color-print)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
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
                    <Bar dataKey="nepo" name="G1 Nepo" fill="var(--color-red)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="nonNepo" name="G2 Non-Nepo" fill="#1b3a5c" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="border-[2px] border-ink bg-paper px-5 py-5">
            <div className="flex flex-col gap-2 mb-4">
              <SectionLabel>Chart 2</SectionLabel>
              <div className="head-medium text-ink text-[22px]">
                Median Votes by Profession
              </div>
              <div className="subheader-medium text-print">
                Uses movie median votes, grouped into G1 Nepo and G2 Non-Nepo
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
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={70}
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
                    <Bar dataKey="G2 Non-Nepo" fill="#1b3a5c" radius={[0, 0, 0, 0]} />
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