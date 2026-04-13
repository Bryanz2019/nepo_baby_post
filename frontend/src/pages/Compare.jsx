import { useState, useEffect, useRef } from "react";
import config from '../config.json';
import { useSearchParams, useNavigate } from "react-router";
import CompareTable from "../components/CompareTable";
import Button from "../components/Button";

// ─── Search Modal ────────────────────────────────────────────────────────────
function SearchModal({ side, onConfirm, onClose }) {
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    if (inputVal.trim()) onConfirm(inputVal.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(26,22,13,0.7)" }}
      onClick={onClose}
    >
      <div
        className="bg-panel border-2 border-ink p-6 flex flex-col gap-4 min-w-[320px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="label-medium text-ink uppercase tracking-widest">
          {side === "a" ? "Change Left Person" : "Change Right Person"}
        </p>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          placeholder="Type full name..."
          className="body-medium bg-paper border border-subtle px-3 py-2 outline-none focus:border-ink w-full"
          style={{ color: "var(--color-ink)" }}
        />
        <div className="flex gap-2">
          <Button className="flex-1 always-active" onClick={handleConfirm}>
            CONFIRM
          </Button>
          <Button className="flex-1" onClick={onClose}>
            CANCEL
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Subject Panel ────────────────────────────────────────────────────────────
function SubjectPanel({ person, onChangeName }) {
  const navigate = useNavigate();

if (!person) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[600px]" style={{ background: "#EBE5D5" }}>
        <p className="body-medium text-center px-8" style={{ color: "var(--color-print)", fontStyle: "italic", maxWidth: 320 }}>
          No bloodline on file. Click Change to begin your investigation.
        </p>
        <button
          onClick={onChangeName}
          className="mt-4 label-tiny px-3 py-1.5"
          style={{
            background: "var(--color-red)",
            color: "var(--color-paper)",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-oswald)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          Change
        </button>
      </div>
    );
  }

  const profession = Array.isArray(person.category_breakdown)
    ? person.category_breakdown.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")
    : "—";

  const quickFactsData = [
    { label: "FULL NAME",    value: person.name ?? "—" },
    { label: "BORN",         value: person.birthdate ? person.birthdate.slice(0, 4) : "—" },
    { label: "PROFESSION",   value: profession },
    { label: "CAREER START", value: person.career_start_year ?? "—" },
    { label: "TOTAL FILMS",  value: person.high_rated_films ?? "—" },
    { label: "AVG RATING",   value: person.avg_imdb_rating ?? "—" },
    { label: "AWARDS",       value: person.personal_awards_count ?? 0 },
    { label: "NOMINATIONS",  value: person.personal_nominations_count ?? 0 },
  ];

  const tableColumns = [
    {
      key: "label",
      header: "QUICK FACTS",
      headerColor: "var(--color-red)",
      renderCell: (row) => (
        <span className="label-tiny" style={{ color: "var(--color-print)"}}>{row.label}</span>
      ),
    },
    {
      key: "value",
      header: "",
      renderCell: (row) => (
        <span
          className="body-medium"
          style={{
            color: "#1C0A00",
            display: "block",
            textAlign: "right",
            fontFamily: "var(--font-libre)",
          }}
        >
          {row.value}
        </span>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col" style={{ background: "#EBE5D5", minWidth: 0, zIndex: 0 }}>

      {/* Photo + Change overlay — fixed area height, top padded, image bottom-anchored */}
      <div
        style={{
          width: "100%",
          background: "#EBE5D5",
          paddingTop: "1.5rem",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          minHeight: 320,
        }}
      >
        <div style={{ width: "33%", aspectRatio: "8/9", position: "relative" }}>
          <img
            src={person.image_url ?? "https://placehold.co/400x450?text=No+Image"}
            alt={person.name}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Change button — bottom right overlay */}
          <button
            onClick={onChangeName}
            className="absolute bottom-0 right-0 label-tiny px-3 py-1.5 z-10"
            style={{
              background: "var(--color-red)",
              color: "var(--color-paper)",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-oswald)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            Change
          </button>
        </div>
      </div>

      {/* Identity block — fixed min-height so tables align across both panels */}
      <div
        className="flex flex-col items-center px-6 pt-5 pb-4 text-center"
        style={{ minHeight: 220 }}
      >
        <span className="subheader-medium" style={{ color: "var(--color-print)" }}>
          {profession}
        </span>
        <h2
          className="head-huge"
          style={{ color: "var(--color-ink)", 
                    lineHeight: 1, 
                    wordBreak: "break-word", 
          }}
        >
          {(person.name ?? "").toUpperCase()}
        </h2>

        {/* Nepo Score */}
        <div className="flex items-baseline gap-2 mt-2 justify-center">
          <span
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: 54,
              fontWeight: 800,
              color: "var(--color-red)",
              lineHeight: 1,
            }}
          >
            {person.nepo_score != null ? Math.round(person.nepo_score) : "—"}
          </span>
          <span className="label-tiny" style={{ color: "var(--color-red)" }}>
            NEPO SCORE™
          </span>
          </div>
          <span className="label-thin" style={{ color: "#5A4535" }}>
            SINCE {person.career_start_year ?? "—"}
          </span>

        {/* Famous films blurb */}
        {Array.isArray(person.famous_films) && person.famous_films.length > 0 && (
          <p
            className="body-medium mt-2"
            style={{ 
              color: "var(--color-print)", 
              fontStyle: "italic", 
              maxWidth: 420,
              height: "4.5rem",
              overflow: "hidden",
            }}
          >
            Known for {person.famous_films.slice(0, 3).join(", ")}.
          </p>
        )}
      </div>

      {/* Quick Facts Table */}
      <div className="px-12 pb-4 flex-1">
        <CompareTable data={quickFactsData} columns={tableColumns} />
      </div>

      {/* Open Full Dossier — navigates to /person/:person_id */}
      <div className="px-6 pb-6">
        <Button
          className="always-active w-full label-medium py-2"
          onClick={() => navigate(`/person/${person.person_id}`)}
        >
          OPEN FULL DOSSIER →
        </Button>
      </div>
    </div>
  );
}

// ─── VS Divider — with vertical border lines on both sides ───────────────────
function VSDivider() {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        width: 120,
        minWidth: 80,
        background: "#EBE5D5",
        flexShrink: 0,
        borderLeft:  "2px solid #C4A267",
        borderRight: "2px solid #C4A267",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-playfair)",
          fontSize: 72,
          fontWeight: 800,
          color: "var(--color-ink)",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        VS
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ person_name_a: null, person_name_b: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // "a" | "b" | null

  const leftName  = searchParams.get("person_name_a") ?? "";
  const rightName = searchParams.get("person_name_b") ?? "";

  // Fetch whenever URL params change
  useEffect(() => {
    if (!leftName || !rightName) return;
    setLoading(true);
    setError(null);
    fetch(`https://${config.server_host}/compare?person_name_a=${encodeURIComponent(leftName)}&person_name_b=${encodeURIComponent(rightName)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load comparison data.");
        setLoading(false);
      });
  }, [leftName, rightName]);

  const handleConfirm = (side, name) => {
    setModal(null);
    if (side === "a") {
      setSearchParams({ person_name_a: name, person_name_b: rightName });
    } else {
      setSearchParams({ person_name_a: leftName, person_name_b: name });
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col pt-0"
      style={{ background: "#EBE5D5", position: "relative", zIndex: 0 }}
    >
      {/* ── Page title bar with bottom border ── */}
      <div
        className="flex items-end justify-between px-6 pt-4 pb-2"
        style={{ borderBottom: "2px solid var(--color-ink)" }}
      >
        <div>
          <p className="label-thin" style={{ color: "var(--color-red)", letterSpacing: "0.1em" }}>
            DYNASTY INTELLIGENCE — CLASSIFIED COMPARISON
          </p>
          <h2 className="head-big" style={{ color: "var(--color-ink)", fontStyle: "normal" }}>
            BLOODLINE vs. BLOODLINE
          </h2>
        </div>
        <p
          className="subheader-medium"
          style={{ color: "var(--color-print)", textAlign: "right", maxWidth: 200 }}
        >
          Compare two subjects side-by-side. Whose inheritance runs deeper?
        </p>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="label-medium text-muted animate-pulse">LOADING CLASSIFIED FILES…</p>
        </div>
      )}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="label-medium" style={{ color: "var(--color-error)" }}>{error}</p>
        </div>
      )}

      {/* ── Main Comparison ── */}
      {!loading && (
        <div className="flex flex-1" style={{ minHeight: 600, alignItems: "stretch" }}>

          {/* Left Subject */}
          <SubjectPanel
            person={data.person_name_a}
            onChangeName={() => setModal("a")}
          />

          {/* VS Divider */}
          <VSDivider />

          {/* Right Subject */}
          <SubjectPanel
            person={data.person_name_b}
            onChangeName={() => setModal("b")}
          />
        </div>
      )}

      {/* ── Empty state when no params ── */}
      {!loading && !leftName && !rightName && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-20">
          <p className="head-medium text-muted">No subjects selected.</p>
          <p className="body-medium text-muted">
            Click <strong>Change</strong> on either side to load a subject.
          </p>
        </div>
      )}

      {/* ── Search Modal ── */}
      {modal && (
        <SearchModal
          side={modal}
          onConfirm={(name) => handleConfirm(modal, name)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

