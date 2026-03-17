const MOCK_DATA = [
  { tconst: 'tt2073009',  primary_title: "Kennedys Don't Cry",               start_year: 1975, genre: 'Documentary' },
  { tconst: 'tt5688424',  primary_title: 'The Family Whistle',                start_year: 2016, genre: 'Drama'       },
  { tconst: 'tt14535614', primary_title: 'The Kardashians: Reality Royalty',  start_year: 2020, genre: 'Reality'     },
  { tconst: 'tt37674658', primary_title: 'Stiller & Meara: Nothing Is Lost',  start_year: 2025, genre: 'Documentary' },
  { tconst: 'tt0772150',  primary_title: "Alexis Arquette: She's My Brother", start_year: 2007, genre: 'Documentary' },
  { tconst: 'tt7057306',  primary_title: 'That Summer',                       start_year: 2017, genre: 'Documentary' },
  { tconst: 'tt0239313',  primary_title: "Convention '92",                    start_year: 1992, genre: 'Documentary' },
  { tconst: 'tt1423630',  primary_title: 'Kirk Douglas: Before I Forget',     start_year: 2009, genre: 'Documentary' },
  { tconst: 'tt14586500', primary_title: 'Kylie Jenner: Billion Dollar Baby', start_year: 2020, genre: 'Documentary' },
  { tconst: 'tt1230447',  primary_title: 'Being W',                           start_year: 2008, genre: 'Documentary' },
  { tconst: 'tt11454066', primary_title: 'You Cannot Kill David Arquette',    start_year: 2020, genre: 'Documentary' },
];

export default function NepoTitlesTable({ data = MOCK_DATA }) {
  return (
    <div className='w-full overflow-x-auto' style={{ background: 'var(--color-panel)' }}>
      <table className='w-full border-collapse'>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-ink)' }}>
            {['MOVIE', 'YEAR', 'GENRE'].map(h => (
              <th key={h} className='label-medium text-left px-4 py-2.5 whitespace-nowrap'
                style={{ color: 'var(--color-muted)', background: 'var(--color-panel)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.tconst} style={{
              background: idx % 2 === 0 ? 'var(--color-panel)' : 'var(--color-paper)',
              borderBottom: '1px solid var(--color-subtle)',
            }}>
              <td className='px-4 py-2.5'>
                <span className='subheader-medium' style={{ color: 'var(--color-ink)' }}>{row.primary_title}</span>
              </td>
              <td className='px-4 py-2.5'>
                <span className='label-medium' style={{ color: 'var(--color-subtle)' }}>{row.start_year}</span>
              </td>
              <td className='px-4 py-2.5'>
                <span className='label-thin' style={{ color: 'var(--color-print)' }}>{row.genre}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}