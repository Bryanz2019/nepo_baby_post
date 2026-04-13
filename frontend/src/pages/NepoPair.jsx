import { useState, useEffect } from 'react';
import NepoTable from '../components/NepoTable';
import config from '../config.json'

const API_BASE = 'https://' + config.server_host;

const RELATION_COLORS = {
  PARENT:             'var(--color-red)',
  GRANDPARENT:        'var(--color-print)',
  GRAND_AUNT_UNCLE:   'var(--color-print)',
  GREAT_AUNT_UNCLE:   '#4a674199',
  SIBLING:            '#1b3a5c',
  STEPSIBLING:        '#1b3a5c99',
  AUNT_UNCLE:         '#4a6741',
  SPOUSE:             'var(--color-error)',
  CHILD:              'var(--color-muted)',
  NIECE_NEPHEW:       'var(--color-muted)',
  GRAND_NIECE_NEPHEW: '#b8a88898',
  GREAT_NIECE_NEPHEW: '#b8a88899',
  COUSIN_1ST:         '#6b4f8a',
  GRANDCHILD:         'var(--color-print)',
  ANCESTOR:           '#5A453599',
};

const RELATION_LABELS = {
  PARENT:             'PARENT',
  GRANDPARENT:        'GRANDPARENT',
  GRAND_AUNT_UNCLE:   'GRAND AUNT/UNCLE',
  GREAT_AUNT_UNCLE:   'GREAT AUNT/UNCLE',
  SIBLING:            'SIBLING',
  STEPSIBLING:        'STEPSIBLING',
  AUNT_UNCLE:         'AUNT/UNCLE',
  SPOUSE:             'SPOUSE',
  CHILD:              'CHILD',
  NIECE_NEPHEW:       'NIECE/NEPHEW',
  GRAND_NIECE_NEPHEW: 'GRAND NIECE/NEPHEW',
  GREAT_NIECE_NEPHEW: 'GREAT NIECE/NEPHEW',
  COUSIN_1ST:         'COUSIN',
  GRANDCHILD:         'GRANDCHILD',
  ANCESTOR:           'ANCESTOR',
};

function RelationBadge({ kinship }) {
  const bg    = RELATION_COLORS[kinship] ?? '#5A4535';
  const label = RELATION_LABELS[kinship] ?? (kinship ?? 'RELATIVE');
  return (
    <span className="label-tiny px-2 py-0.5 text-paper inline-block"
      style={{ backgroundColor: bg, letterSpacing: '0.08em' }}>
      {label}
    </span>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-baseline border-b border-subtle py-1.5">
      <span className="label-thin text-muted uppercase tracking-widest">{label}</span>
      <span className="body-medium text-ink font-bold">{value ?? '—'}</span>
    </div>
  );
}

const RELATIONS = [
  'ALL',
  'PARENT',
  'GRANDPARENT',
  'GRAND_AUNT_UNCLE',
  'GREAT_AUNT_UNCLE',
  'SIBLING',
  'STEPSIBLING',
  'AUNT_UNCLE',
  'NIECE_NEPHEW',
  'GRAND_NIECE_NEPHEW',
  'COUSIN_1ST',
  'GRANDCHILD',
  'CHILD',
  'SPOUSE',
];

export default function NepoPair() {
  const [data, setData]                     = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [filterRelation, setFilterRelation] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/movies/relative_collaboration_movies?page=1&page_size=100`)
      .then(r => r.json())
      .then(rows => setData(Array.isArray(rows) ? rows : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(row => {
    if (filterRelation === 'ALL') return true;
    return (row.relative_pairs ?? []).some(p => p.kinship === filterRelation)
        || row.most_frequent_kinship === filterRelation;
  });

  const columns = [
    {
      key: 'rank', header: 'RANK',
      renderCell: row => {
        const idx = filtered.indexOf(row);
        return <span className="label-medium text-muted">#{idx + 1}</span>;
      },
    },
    {
      key: 'primary_title', header: 'TITLE',
      renderCell: row => <span className="body-medium text-ink font-semibold">{row.primary_title}</span>,
    },
    {
      key: 'relative_pair_count', header: 'NEPO™ PAIRS',
      renderCell: row => <span className="label-medium text-red">{row.relative_pair_count}</span>,
    },
    {
      key: 'most_frequent_kinship', header: 'RELATION',
      renderCell: row => {
        const kinships = [...new Set((row.relative_pairs ?? []).map(p => p.kinship))];
        return (
          <div className="flex flex-wrap gap-1">
            {kinships.map(k => <RelationBadge key={k} kinship={k} />)}
          </div>
        );
      },
    },
    {
      key: 'start_year', header: 'START YEAR',
      renderCell: row => <span className="body-medium text-print">{row.start_year}</span>,
    },
    {
      key: 'movie_award_count', header: 'TOTAL AWARDS',
      renderCell: row => <span className="body-medium text-ink">{row.movie_award_count ?? 0}</span>,
    },
    {
      key: 'avg_rating', header: 'AVG ★',
      renderCell: row => (
        <span className="body-medium text-ink">
          {row.avg_rating ? `★ ${parseFloat(row.avg_rating).toFixed(1)}` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex overflow-hidden bg-paper" style={{ height: 'calc(100vh - 60px)' }}>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Sticky header */}
        <div className="flex-shrink-0 border-b-[3px] border-ink px-8 pt-8 pb-4 bg-paper">
          <p className="label-tiny text-muted uppercase tracking-widest mb-1">NEPO PAIR LEADERBOARD</p>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="head-big text-ink">
                Ranked: The Top 100 Movies that Families Share the Screen
              </h1>
              <p className="subheader-medium text-print mt-1">
                A data-driven investigation into Hollywood's most reliable hiring strategy
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-4">
            <span className="label-tiny text-muted uppercase tracking-widest mr-2">Relation:</span>
            {RELATIONS.map(rel => (
              <button
                key={rel}
                onClick={() => setFilterRelation(rel)}
                className={`btn label-tiny px-3 py-1 ${filterRelation === rel ? 'btn-toggled' : ''}`}
              >
                {RELATION_LABELS[rel] ?? rel}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable table */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <p className="subheader-medium text-muted animate-pulse">Consulting the family tree…</p>
            </div>
          )}
          {error && (
            <div className="border border-red p-4">
              <p className="body-medium text-red">Failed to load data: {error}</p>
            </div>
          )}
          {!loading && !error && (
            <>
              <NepoTable data={filtered} columns={columns} />
              {filtered.length === 0 && (
                <p className="subheader-medium text-muted text-center py-8">
                  No results for this filter.
                </p>
              )}
            </>
          )}
        </div>

      </main>
    </div>
  );
}