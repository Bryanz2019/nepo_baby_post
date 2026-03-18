import catmeme from '../assets/catmeme.gif';
import Button from '../components/Button';
import NepoTable from '../components/NepoTable';
import LeftPanel from '../components/LeftPanel';

const MOCK_DATA = [
  { tconst: 'tt2073009',  primary_title: "Kennedys Don't Cry",               start_year: 1975, genre: 'Documentary', professions: ['Actor', 'Director'] },
  { tconst: 'tt5688424',  primary_title: 'The Family Whistle',                start_year: 2016, genre: 'Drama',        professions: ['Actor', 'Producer'] },
  { tconst: 'tt14535614', primary_title: 'The Kardashians: Reality Royalty',  start_year: 2020, genre: 'Reality',      professions: ['Actor'] },
  { tconst: 'tt37674658', primary_title: 'Stiller & Meara: Nothing Is Lost',  start_year: 2025, genre: 'Documentary', professions: ['Actor', 'Writer', 'Producer'] },
  { tconst: 'tt0772150',  primary_title: "Alexis Arquette: She's My Brother", start_year: 2007, genre: 'Documentary', professions: ['Actor'] },
  { tconst: 'tt7057306',  primary_title: 'That Summer',                       start_year: 2017, genre: 'Documentary', professions: ['Director', 'Producer'] },
  { tconst: 'tt0239313',  primary_title: "Convention '92",                    start_year: 1992, genre: 'Documentary', professions: ['Director'] },
  { tconst: 'tt1423630',  primary_title: 'Kirk Douglas: Before I Forget',     start_year: 2009, genre: 'Documentary', professions: ['Actor', 'Producer'] },
  { tconst: 'tt14586500', primary_title: 'Kylie Jenner: Billion Dollar Baby', start_year: 2020, genre: 'Documentary', professions: ['Actor', 'Director'] },
  { tconst: 'tt1230447',  primary_title: 'Being W',                           start_year: 2008, genre: 'Documentary', professions: ['Writer', 'Director'] },
  { tconst: 'tt11454066', primary_title: 'You Cannot Kill David Arquette',    start_year: 2020, genre: 'Documentary', professions: ['Actor'] },
];

const COLUMNS = [
  {
    key: 'primary_title',
    header: 'MOVIE',
    renderCell: (row) => row.primary_title,
  },
  {
    header: 'YEAR',
    color: 'var(--color-muted)',
    renderCell: (row) => row.start_year,
  },
  {
    header: 'GENRE',
    color: 'var(--color-muted)',
    renderCell: (row) => row.genre,
  },
  {
    header: 'PROFESSIONS',
    renderCell: (row) => (
      <div className='flex flex-row flex-wrap gap-1'>
        {row.professions.map(p => (
          <span
            key={p}
            className='label-tiny px-2 py-0.5 bg-red text-paper'
          >
            {p}
          </span>
        ))}
      </div>
    ),
  },
];

function Demo() {
  return (
    // h-full fills the content area below the navbar; flex-row splits left/right
    <div className='flex flex-row w-full h-full overflow-hidden'>

      {/* Left panel — sticky, scrolls internally if content overflows */}
      <LeftPanel />
      <LeftPanel />
      {/* Right pane — scrolls independently, never overlaps navbar */}
      <div className='flex flex-col flex-1 min-w-0 gap-4 p-6 overflow-y-auto h-full'>

        {/* Button demo */}
        <div className='flex flex-col items-center justify-center gap-4 w-full'>
          <img src={catmeme} alt="Nepo logo" />
          <div>Custom Button Demo</div>
          <div>'Just some examples, go crazy!'</div>
          <div className='flex flex-row items-center justify-center flex-wrap gap-2'>
            <Button className="m-2">Inactive until Clicked</Button>
            <Button className="always-active m-2">Always Active</Button>
            <Button className="always-active m-2 border-8">Always Active With Border</Button>
            <Button className="m-2 text-orange-500">Orange Text</Button>
            <Button className="border-0">No Border</Button>
            <Button className="border-0 w-12 h-4.5 flex items-end bg-yellow-700 text-panel">Director</Button>
            <Button className="border-0 always-active w-80">Always Active With Different Size</Button>
          </div>
        </div>

        {/* Table */}
        <NepoTable data={MOCK_DATA} columns={COLUMNS} />

      </div>
    </div>
  );
}

export default Demo;