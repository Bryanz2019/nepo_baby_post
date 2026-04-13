import { useState, useEffect, useMemo } from "react";
import config from '../config.json'

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

const API = 'https://' + config.server_host;

const EXCLUDED_PROFESSIONS = [
  "self",
  "archive_footage",
  "archive_sound",
  "casting_director",
];

const METRIC_OPTIONS = [
  { key: "role_count", label: "Role Count" },
  { key: "movie_count", label: "Movie Count" },
  { key: "avg_credit_order", label: "Median Credit Order" },
  { key: "avg_rating", label: "Median Rating" },
  { key: "avg_votes", label: "Median Votes" },
];

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

function formatMetricValue(metricKey, value) {
  if (value == null) return "0";

  if (metricKey === "avg_rating" || metricKey === "avg_credit_order") {
    return Number(value).toFixed(2);
  }

  if (
    metricKey === "avg_votes" ||
    metricKey === "role_count" ||
    metricKey === "movie_count"
  ) {
    return formatYAxis(Number(value));
  }

  return value;
}

function CustomTooltip({ active, payload, label, metricKey }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-paper border border-ink px-3 py-2 shadow-sm">
      <div className="label-tiny text-ink mb-1">{label}</div>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="body-medium text-[14px]"
          style={{ color: entry.color }}
        >
          {entry.name}:{" "}
          {typeof entry.value === "number"
            ? formatMetricValue(metricKey, entry.value)
            : entry.value}
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
  const [metrics, setMetrics] = useState([]);
  const [participationData, setParticipationData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState("avg_votes");

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API}/analysis/nepo_industry_metrics`);
        const data = await res.json();
        setMetrics(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setMetrics([]);
      }
    };

    const fetchParticipationData = async () => {
      try {
        const res = await fetch(
          `${API}/analysis/nepo_participation_industry?start_year=1900&end_year=2026`
        );
        const data = await res.json();
        setParticipationData(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setParticipationData([]);
      }
    };

    Promise.all([fetchMetrics(), fetchParticipationData()]).finally(() => {
      setLoading(false);
    });
  }, []);

  const cleanRows = useMemo(() => {
    return metrics.filter(
      (r) =>
        r?.year != null &&
        !EXCLUDED_PROFESSIONS.includes(String(r.profession || "").toLowerCase())
    );
  }, [metrics]);

  // CHART 1: by every year
  const chart1Data = useMemo(() => {
    const matrix = {};

    participationData.forEach((r) => {
      const year = Number(r.release_year);
      const totalMovieCount = Number(r.total_movie_count) || 0;
      const nepoMovieCount = Number(r.movies_with_nepo_participation) || 0;

      if (!year) return;

      if (!matrix[year]) {
        matrix[year] = {
          group: String(year),
          order: year,
          nepo: 0,
          nonNepo: 0,
        };
      }

      matrix[year].nepo += nepoMovieCount;
      matrix[year].nonNepo += Math.max(totalMovieCount - nepoMovieCount, 0);
    });

    return Object.values(matrix).sort((a, b) => a.order - b.order);
  }, [participationData]);

  // CHART 2: total per profession for counts; median for averages
  const chart2Data = useMemo(() => {
    const map = {};

    cleanRows.forEach((r) => {
      const professionKey = String(r.profession || "").toLowerCase();
      const isNepo = String(r.nepo_status) === "Nepo Baby";

      if (!map[professionKey]) {
        map[professionKey] = {
          profession: formatProfessionLabel(professionKey),

          // summed metrics
          nepoRoleCount: 0,
          nonNepoRoleCount: 0,
          nepoMovieCount: 0,
          nonNepoMovieCount: 0,

          // distributions for median metrics
          nepoCreditOrders: [],
          nonNepoCreditOrders: [],
          nepoRatings: [],
          nonNepoRatings: [],
          nepoVotes: [],
          nonNepoVotes: [],

          // used for ordering bar groups
          totalWeight: 0,
        };
      }

      const roleCount = Number(r.role_count) || 0;
      const movieCount = Number(r.movie_count) || 0;
      const avgCreditOrder = Number(r.avg_credit_order) || 0;
      const avgRating = Number(r.avg_rating) || 0;
      const avgVotes = Number(r.avg_votes) || 0;

      if (isNepo) {
        map[professionKey].nepoRoleCount += roleCount;
        map[professionKey].nepoMovieCount += movieCount;

        if (avgCreditOrder > 0) map[professionKey].nepoCreditOrders.push(avgCreditOrder);
        if (avgRating > 0) map[professionKey].nepoRatings.push(avgRating);
        if (avgVotes > 0) map[professionKey].nepoVotes.push(avgVotes);
      } else {
        map[professionKey].nonNepoRoleCount += roleCount;
        map[professionKey].nonNepoMovieCount += movieCount;

        if (avgCreditOrder > 0) map[professionKey].nonNepoCreditOrders.push(avgCreditOrder);
        if (avgRating > 0) map[professionKey].nonNepoRatings.push(avgRating);
        if (avgVotes > 0) map[professionKey].nonNepoVotes.push(avgVotes);
      }

      map[professionKey].totalWeight += 1;
    });

    return Object.values(map)
      .map((d) => {
        let nepoValue = 0;
        let nonNepoValue = 0;

        if (selectedMetric === "role_count") {
          nepoValue = d.nepoRoleCount;
          nonNepoValue = d.nonNepoRoleCount;
        } else if (selectedMetric === "movie_count") {
          nepoValue = d.nepoMovieCount;
          nonNepoValue = d.nonNepoMovieCount;
        } else if (selectedMetric === "avg_credit_order") {
          nepoValue = +median(d.nepoCreditOrders).toFixed(2);
          nonNepoValue = +median(d.nonNepoCreditOrders).toFixed(2);
        } else if (selectedMetric === "avg_rating") {
          nepoValue = +median(d.nepoRatings).toFixed(2);
          nonNepoValue = +median(d.nonNepoRatings).toFixed(2);
        } else if (selectedMetric === "avg_votes") {
          nepoValue = +median(d.nepoVotes).toFixed(2);
          nonNepoValue = +median(d.nonNepoVotes).toFixed(2);
        }

        return {
          profession: d.profession,
          "G1 Nepo": nepoValue,
          "G2 Non-Nepo": nonNepoValue,
          totalWeight: d.totalWeight,
        };
      })
      .filter((d) => d["G1 Nepo"] > 0 || d["G2 Non-Nepo"] > 0)
      .sort((a, b) => b.totalWeight - a.totalWeight)
      .slice(0, 10);
  }, [cleanRows, selectedMetric]);

  const selectedMetricLabel =
    METRIC_OPTIONS.find((m) => m.key === selectedMetric)?.label || "Metric";

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
              <span className="text-red">Chart 1.</span> Tracks movies with nepo
              participation by year, compared against movies without nepo
              participation.
            </p>
            <p className="mb-3">
              A movie is counted in the nepo line if at least one nepo person
              appears in that movie. The comparison line shows the remaining
              movies without nepo participation.
            </p>
            <p className="mb-3">
              <span className="text-red">Chart 2.</span> Compares professions using
              a switchable metric across G1 Nepo and G2 Non-Nepo. Self, archive
              footage, archive sound, and casting director are excluded.
            </p>
            <p className="mb-3">
              For <span className="text-red">Role Count</span> and{" "}
              <span className="text-red">Movie Count</span>, values are summed
              across all years per profession. For the average-style metrics,
              the chart uses medians.
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
            Nepo participation by year and profession-level metric switcher
          </div>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="border-[2px] border-ink bg-paper px-5 py-5 max-w-[980px] w-full">
            <div className="flex flex-col gap-2 mb-4">
              <SectionLabel>Chart 1</SectionLabel>
              <div className="head-medium text-ink text-[22px]">
                Movies With Nepo Participation by Year
              </div>
              <div className="subheader-medium text-print">
                X = year · Y = movie count · G1 = movies with nepo participation · G2 = movies without nepo participation
              </div>
            </div>

            <div className="w-full h-[320px]">
              {loading ? (
                <div className="h-full flex items-center justify-center subheader-medium text-muted animate-pulse">
                  Loading chart…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chart1Data}
                    margin={{ top: 10, right: 12, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 4"
                      stroke="var(--color-subtle)"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="group"
                      tick={{ fill: "var(--color-print)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                      angle={-25}
                      textAnchor="end"
                      height={55}
                    />

                    <YAxis
                      tick={{ fill: "var(--color-print)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />

                    <Tooltip content={<CustomTooltip metricKey="movie_count" />} />

                    <Legend
                      wrapperStyle={{ fontSize: "12px" }}
                      formatter={(value) => (
                        <span className="label-tiny text-print">{value}</span>
                      )}
                    />

                    <Line
                      type="monotone"
                      dataKey="nepo"
                      name="G1 Nepo Participation"
                      stroke="var(--color-red)"
                      strokeWidth={3}
                      dot={false}
                    />

                    <Line
                      type="monotone"
                      dataKey="nonNepo"
                      name="G2 No Nepo Participation"
                      stroke="#1b3a5c"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="border-[2px] border-ink bg-paper px-5 py-5 max-w-[980px] w-full">
            <div className="flex flex-col gap-2 mb-4">
              <SectionLabel>Chart 2</SectionLabel>
              <div className="head-medium text-ink text-[22px]">
                Profession Comparison by {selectedMetricLabel}
              </div>
              <div className="subheader-medium text-print">
                Switch between profession-level metrics for G1 Nepo and G2 Non-Nepo
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {METRIC_OPTIONS.map((option) => {
                const active = selectedMetric === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedMetric(option.key)}
                    className={`px-3 py-2 border-[2px] text-[12px] uppercase tracking-wide transition-colors ${
                      active
                        ? "bg-red text-white border-red"
                        : "bg-paper text-ink border-ink hover:bg-panel"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="w-full h-[360px]">
              {loading ? (
                <div className="h-full flex items-center justify-center subheader-medium text-muted animate-pulse">
                  Loading chart…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chart2Data}
                    margin={{ top: 10, right: 12, left: 10, bottom: 40 }}
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="3 4"
                      stroke="var(--color-subtle)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="profession"
                      tick={{ fill: "var(--color-print)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      tickFormatter={(v) => formatMetricValue(selectedMetric, v)}
                      tick={{ fill: "var(--color-print)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip metricKey={selectedMetric} />} />
                    <Legend
                      wrapperStyle={{ fontSize: "12px" }}
                      formatter={(value) => (
                        <span className="label-tiny text-print">{value}</span>
                      )}
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