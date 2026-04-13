import { useEffect, useState } from 'react';
import NepoTable from '../components/NepoTable';
import Button from '../components/Button';
import { useLocation, NavLink, useNavigate } from 'react-router';
import config from '../config.json';
import LeftPanel from '../components/LeftPanel';
import ProfileTable from '../components/ProfileTable';


function EvidenceBoard() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchResults, setSearchResults] = useState([])

  const params = new URLSearchParams(location.search)
  const initialKeyword = params.get('keyword') || '';
  const initialCategory = params.get('category') || '';

  const [keyword, setKeyword] = useState(initialKeyword);
  const [category, setCategory] = useState(initialCategory ? initialCategory.split(',') : []);

  const [selectedPerson, setSelectedPerson] = useState(null);


  const [nepoScore, setNepoScore] = useState(0);
  const [minBirthYear, setMinBirthYear] = useState(1900);


  const filteredResults = searchResults.filter((row) => {
    const rowNepoScore = row.nepo_score != null ? Number(row.nepo_score) : null;
    const rowBirthYear = row.birth_year != null ? Number(row.birth_year) : null;

    if (rowNepoScore == null || rowNepoScore < nepoScore) { return false }

    if (minBirthYear !== '' && (rowBirthYear == null || rowBirthYear < Number(minBirthYear))) { return false }

    return true
  })

  const handleCategoryClick = (newCategory) => {
    setCategory((prevCategory) =>
      prevCategory.includes(newCategory) ? prevCategory.filter((c) => c !== newCategory) : [...prevCategory, newCategory]
    )
  }


  const handleSurpriseMe = async () => {
    const response = await fetch(`https://${config.server_host}/homepage/surprise_me`);
    const data = await response.json();
    navigate(`/person/${data.person_id}`);
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      renderCell: (row) => (
        <button className='text-left text-blue-600 underline' onClick={() => setSelectedPerson(row)}>
          {row.name}
        </button>
      )
    },
    {
      key: 'birth_year',
      header: 'Birth Year',
      renderCell: (row) => row.birth_year != null ? row.birth_year : 'N/A'
    },
    {
      key: 'nepo_score',
      header: 'Nepo Score',
      color: 'var(--color-red)',
      renderCell: (row) => row.nepo_score != null ? Number(row.nepo_score).toFixed(2) : ''
    },
    {
      key: 'person_point',
      header: 'Person Point',
      renderCell: (row) => row.person_point != null ? Number(row.person_point).toFixed(2) : ''
    },
    {
      key: 'known_for_title',
      header: 'Known For',
      renderCell: (row) => row.known_for_title != null ? row.known_for_title : 'N/A'
    },
    {
      key: 'professions',
      header: 'Professions',
      renderCell: (row) => (
        <div className='flex flex-row flex-wrap gap-1'>
          {(row.professions || []).map(p => (
            <span
              key={p}
              className='label-tiny px-2 py-0.5 bg-red text-paper'
            >
              {p}
            </span>
          ))}
        </div>
      )
    },
    {
      key: 'career_start_year',
      header: 'Career Start Year',
      renderCell: (row) => row.career_start_year != null ? row.career_start_year : 'N/A'
    }
  ]

  const panelData = [
    { key: 'FULL NAME', value: selectedPerson?.name ? selectedPerson.name : 'N/A' },
    { key: 'BORN', value: selectedPerson?.birth_year ? selectedPerson.birth_year : 'N/A' },
    { key: 'PROFESSION', value: selectedPerson?.professions
      ? (Array.isArray(selectedPerson?.professions) ? selectedPerson.professions : selectedPerson.professions.split(','))
          .map(s =>
            s.trim()
              .replaceAll('_', ' ')
              .split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          ).join(', ') : 'N/A'},
    { key: 'DEBUT AGE', value: selectedPerson?.career_start_year && selectedPerson?.birth_year ? selectedPerson.career_start_year - selectedPerson.birth_year : 'N/A' }
  ]


  useEffect(() => {
    // if no keyword and category, clear results and return (handle the case when user directly navigates to this page without search)
    if (!initialKeyword && !initialCategory) {
      setSearchResults([])
      return
    }

    fetch(`https://${config.server_host}/search?keyword=${encodeURIComponent(initialKeyword)}&category=${encodeURIComponent(initialCategory)}`)
      .then(res => res.json())
      .then(resJson => setSearchResults(resJson))
  }, [initialKeyword, initialCategory])

  return (
    <>
      <div className='flex w-full h-full bg-panel'>

        {/* left panel with person details (only show when selectedPerson is not null) */}
        {selectedPerson &&
          <LeftPanel>
            <div className='relative label-tiny text-red -mt-2'>
              FRONT PAGE &nbsp;
              <span className='label-tiny text-print'>/ &nbsp;SUBJECT FILE</span>
              <span className='absolute right-0 label-tiny text-print'>NO. {selectedPerson.person_id}</span>
            </div>

            <div className="divider -mb-2 -mt-4 -mx-4 p-0"></div>

            <div className='w-56 h-56 border-2 border-red relative'>
              <img referrerPolicy="no-referrer" src={selectedPerson?.image_url} alt={selectedPerson?.name} className='h-full w-full object-cover' />
              {selectedPerson.nepo_score > 0 && (
                <div className='absolute top-0 right-0 bg-red text-paper label-tiny px-2 py-0.5'>
                  NEPO CONFIRMED
                </div>
              )}
            </div>

            <div className='flex flex-col'>
              <div className='head-huge text-ink text-[24px] mb-0.5'>{selectedPerson.name}</div>
              <div className='head-huge text-ink text-[38px]'>{Math.round(selectedPerson.nepo_score * 100) / 100}
                <span className='label-tiny text-red ml-1'>NEPO SCORE<sup>TM</sup></span>
              </div>
              <div className='label-tiny text-print'>SINCE {selectedPerson.career_start_year}</div>
              <div className='flex flex-row flex-wrap mt-0.5 gap-y-1'>
                {Array.isArray(selectedPerson.professions) && selectedPerson.professions.length > 0 ? (
                  selectedPerson.professions.map((prof, idx) => (
                    <span
                      key={idx}
                      className='border-0 w-fit h-fit px-2 pt-0.5 flex items-end bg-ink text-paper justify-center label-tiny mr-2'
                    >
                      {prof}
                    </span>
                  ))
                ) : (
                  <span className='border-0 w-fit h-fit px-2 pt-0.5 flex items-end bg-ink text-paper justify-center label-tiny mr-2'>
                    N/A
                  </span>
                )}
              </div>
            </div>


            <div className='w-full bg-panel mt-2'>
              <ProfileTable className='border-0 px-0!' title='KEY METRICS' data={panelData} />
            </div>

            <NavLink to={`/person/${selectedPerson.person_id}`}>
              <Button className="always-active w-full h-10 px-4 text-base">
                View Full Profile
              </Button>
            </NavLink>
          </LeftPanel>
        }

        {/* right main content */}
        <div className='flex-1 bg-paper'>

          {/* Search Bar */}
          <div className='w-full pl-6 py-3 bg-panel'>
            <div className="mb-2">
              <div className="label-tiny" style={{ color: 'var(--color-red)' }}>EXCLUSIVE INTELLIGENCE BUREAU · EVIDENCE BOARD</div>
            </div>

            <div className="head-big">
              INVESTIGATE
            </div>

            <div className='flex flex-row items-center gap-3 min-w-0 w-full pr-6'>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search any names..."
                className='h-10 w-full flex-1 min-w-0 border border-gray-400 px-4 bg-[#D4C9B5]'
              />
              <NavLink to={`/evidence_board?keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category.join(','))}`}>
                <Button className="always-active label-medium">
                  GO
                </Button>
              </NavLink>
            </div>

            {/* Category Filter for Search Function */}
            <div className='flex mb-3 mt-3'>
              <div className='label-medium mt-3' style={{ color: 'var(--color-print)' }}>Category</div>

              <div className='flex'>
                {[
                  { label: 'Director', value: 'director' },
                  { label: 'Actor', value: 'actor' },
                  { label: 'Producer', value: 'producer' },
                  { label: 'Writer', value: 'writer' },
                  { label: 'Composer', value: 'composer' },
                ].map((item) => (
                  <Button
                    key={item.value}
                    className={'m-2 h-6 px-4 ' + (category.includes(item.value) ? 'always-active' : '')}
                    onClick={() => handleCategoryClick(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className='w-full border border-[var(--color-print)]'></div>

          </div>

          {/*Slider Filter*/}
          <div className='w-full pl-6 py-3 bg-panel'>
            <div className="label-medium" style={{ color: 'var(--color-print)' }}>
              ADVANCED INTELLIGENCE FILTER
            </div>

            <div className='mt-3 flex flex-row items-end gap-6'>
              {/* Min Nepo Score Slider */}
              <div className="w-64">
                <div className="label-medium" style={{ color: 'var(--color-print)' }}>
                  Nepo Score
                </div>

                <input
                  type="range"
                  min="0"
                  max="5880"
                  step="1"
                  value={nepoScore}
                  onChange={(e) => setNepoScore(Number(e.target.value))}
                  className="w-full"
                />

                <div
                  className="flex w-full items-center justify-between label-medium"
                  style={{ color: 'var(--color-print)' }}
                >
                  <span>{nepoScore.toFixed(2)}</span>
                  <span>5880</span>
                </div>
              </div>

              {/* Min Birth Year Slider */}
              <div className='w-64'>
                <div>
                  <div className="label-medium" style={{ color: 'var(--color-print)' }}>
                    Birth Year
                  </div>

                  <input
                    type='range'
                    min='1900'
                    max='2026'
                    step='1'
                    value={minBirthYear}
                    onChange={(e) => setMinBirthYear(e.target.value)}
                    className='w-full'
                  />
                </div>


                <div
                  className="flex w-full items-center justify-between label-medium"
                  style={{ color: 'var(--color-print)' }}
                >
                  <span>{minBirthYear}</span>
                  <span>2026</span>
                </div>

              </div>

              <Button className="always-active label-medium" onClick={handleSurpriseMe}>
                Surprise Me
              </Button>

            </div>
          </div>

          <div className='flex-1 bg-panel px-4'>
            <NepoTable data={filteredResults} columns={columns} />
          </div>

        </div>
      </div>
    </>
  )

}

export default EvidenceBoard