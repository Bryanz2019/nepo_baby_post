import { useEffect, useState } from 'react';
import NepoTable from '../components/NepoTable';
import Button from '../components/Button';
import { useLocation, NavLink, useNavigate } from 'react-router';
import config from '../config.json';
import LeftPanel from '../components/LeftPanel';
import ProfileTable from '../components/ProfileTable';


function TheScore() {

  const [searchResults, setSearchResults] = useState([])
  const topThree = searchResults.slice(0, 3)

  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    fetch(`http://${config.server_host}:${config.server_port}/homepage/top_nepo_babies`)
      .then(res => res.json())
      .then(resJson => {
        setSearchResults(Array.isArray(resJson) ? resJson : [])
      })
      .catch(err => {
        console.error('Error fetching top nepo babies:', err)
        setSearchResults([]);
      })
  }, [])

  const tableData = searchResults.map((item, index) => ({
    ...item,
    rank: `#${index + 1}`
  }));

  const columns = [
    { key: 'rank', header: 'RANK' },
    {
      key: 'name', header: 'SUBJECT',
      renderCell: (row) => (
        <button className='text-left text-blue-600 underline' onClick={() => setSelectedPerson(row)}>
          {row.name}
        </button>
      )
    },
    {
      key: 'nepo_score',
      header: <>NEPO<sup>TM</sup></>,
      color: 'var(--color-red)',
      renderCell: (row) => Number(row.nepo_score).toFixed(0)
    },
    {
      key: 'top_categories',
      header: 'PROFESSION',
      renderCell: (row) => (
        <div className='flex flex-row flex-wrap gap-1'>
          {(row.top_categories || []).map((p, idx) => (
            <span
              key={idx}
              className='label-tiny px-2 py-0.5 bg-red text-paper'
            >
              {p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : 'N/A'}
            </span>
          ))}
        </div>
      )
    },
    {
      key: 'birth_year',
      header: 'Birth Year',
      renderCell: (row) => row.birth_year != null ? row.birth_year : 'N/A'
    },
    // {
    //   key: 'career_start_year',
    //   header: 'Career Start Year',
    //   renderCell: (row) => row.career_start_year != null ? row.career_start_year : 'N/A'
    // },
    { key: 'total_titles', header: 'FILMS' },
    { key: 'parent_count', header: 'PARENTS' },
    { key: 'grandparent_count', header: 'GRANDPARENTS' },
    { key: 'relative_count', header: 'RELATIVES' },
    {
      key: 'avg_rating',
      header: 'AVG ★',
      renderCell: (row) =>
        row.avg_rating != null ? Number(row.avg_rating).toFixed(1) : 'N/A'
    }
  ]

  const panelData = [
    { key: 'FULL NAME', value: selectedPerson?.name ? selectedPerson.name : 'N/A' },
    { key: 'BORN', value: selectedPerson?.birth_year ? selectedPerson.birth_year : 'N/A' },
    {
      key: 'PROFESSION', value:
        selectedPerson?.top_categories && selectedPerson.top_categories.length > 0
          ? selectedPerson.top_categories
            .map((p) =>
              p.category
                ? p.category.charAt(0).toUpperCase() + p.category.slice(1)
                : 'N/A'
            )
            .join(', ')
          : 'N/A'
    },
    { key: 'DEBUT AGE', value: selectedPerson?.career_start_year && selectedPerson?.birth_year ? selectedPerson.career_start_year - selectedPerson.birth_year : 'N/A' },
    { key: 'AVG RATING', value: (selectedPerson?.avg_rating != null) ? Number(selectedPerson.avg_rating).toFixed(1) : 'N/A' }
  ]

  return (
    <>
      <div className='flex w-full h-full bg-panel'>

        {/* left panel */}
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
                {selectedPerson.top_categories && selectedPerson.top_categories.length > 0 ? (
                  selectedPerson.top_categories.map((p, idx) => (
                    <span
                      key={idx}
                      className='border-0 w-fit h-fit px-2 pt-0.5 flex items-end bg-ink text-paper justify-center label-tiny mr-2'
                    >
                      {p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : 'N/A'}
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

          {/* row 1 title*/}
          <div className='border-b border-black p-6 mb-4'>
            <div className='label-medium text-red'>
              NEPOBABY LEADERBOARD
            </div>

            <div className='head-big'>
              Ranked: Who's Riding the Wave, and Who's Actually Earned It
            </div>

            <div className='label-medium text-print'>
              Not all Nepo babies are created equal.
            </div>
          </div>

          {/* row 2 card*/}
          <div className='border-b border-black p-6'>
            <div className='flex flex-row gap-4 w-full'>
              {topThree.map((person, idx) => (
                <div
                  key={person.person_id || idx}
                  className="card card-side bg-panel shadow-sm flex-1 min-w-0"
                >
                  <div className="flex items-center justify-center px-3">
                    <div className="head-big text-red">{idx + 1}</div>
                  </div>

                  <figure className="w-20 h-20 shrink-0">
                    <img
                      src={person.image_url}
                      alt={person.name}
                      className="w-full h-full object-cover"
                    />
                  </figure>

                  <div className="card-body justify-center p-3 min-w-0">
                    <div className="body-medium truncate">{person.name}</div>
                    <div className="label-tiny text-red"> {Number(person.nepo_score).toFixed(0)} Nepo Score</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* row 3 table*/}
          <div className='p-4'>
            <div className='flex-1'>
              <NepoTable data={tableData} columns={columns} />
            </div>
          </div>
        </div>


      </div>
    </>
  )

}

export default TheScore