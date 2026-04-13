import nepo from '../assets/nepo.png';
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router';
import Button from '../components/Button';
import config from '../config.json';

function Home() {

  // search form states
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState([]);

  const handleCategoryClick = (newCategory) => {
    setCategory((prevCategory) =>
      prevCategory.includes(newCategory) ? prevCategory.filter((c) => c !== newCategory) : [...prevCategory, newCategory]
    )
  }

  // family dynasties data state
  const [familyDynasties, setFamilyDynasties] = useState([]);

  useEffect(() => {
    fetch(`https://${config.server_host}/homepage/family_dynasties`)
      .then(res => res.json())
      .then(data => setFamilyDynasties(data));
  }, []);

  // top collaborations data state
  const [topNepoBabies, setTopNepoBabies] = useState([]);
  useEffect(() => {
    fetch(`https://${config.server_host}/homepage/top_nepo_babies`)
      .then(res => res.json())
      .then(data => setTopNepoBabies(data));
  }, []);

  return (
    <div className="flex flex-row w-full h-full bg-panel overflow-x-hidden" style={{ scrollbarGutter: 'stable' }}>

      {/* left: 50% */}
      <div className="flex flex-col w-[50%] min-w-0 border-r border-black/50 overflow-x-hidden p-6">

        <div className="py-1 label-medium" style={{ color: 'var(--color-red)' }}>Exclusive Investigation · File No. 23</div>

        <div className="py-1 head-huge leading-none">
          THE STRINGS WERE
          <br />
          ALWAYS THERE
        </div>

        <div className="py-1 subheader-medium" style={{ color: 'var(--color-print)' }}>
          A deep dive into Hollywood's most entrenched dynasties — and the industry machinery that keeps them spinning.
        </div>

        <div className="py-1 label-medium" style={{ color: 'var(--color-red)' }}>
          By Staff Investigation · The Nepo Baby Post Bureau
        </div>

        <div className="mt-2 border-t border-black/50" />

        {/* content below title */}
        <div className="flex flex-row min-w-0">

          <div className="p-3 min-w-0">
            <div className="border-l-2 border-red-700 mt-3 mb-3 p-2 subheader-medium">
              "Every casting sheet tells a story. You just have to know whose last name to look for."
            </div>

            <div className="body-medium leading-7">
              <p>
                The evidence was hiding in plain sight, archived in credits and box office ledgers, pinned quietly between lines of fine copy. Our team of researchers spent six months mapping the connections — the parentage, the co-stars, the industry marriages, the shared agents — that chart the rise of the so-called "nepo baby" from industry rumor to documented phenomenon.
              </p>
              <br />
              <p>
                What we found was not a conspiracy, but something more pervasive: a self-reinforcing ecosystem where names open doors, relationships grease hinges, and legacy functions as an invisible credential that no amount of talent, or lack thereof, can fully override.
              </p>
            </div>
          </div>

          <div className="border-l border-[#b98b57] p-3 min-w-0">
            <div className="body-medium leading-7">
              <p>
                The data is unambiguous. Second-generation performers debut an average 4.2 years earlier than their first-generation counterparts. Their first roles are in larger productions. Their press coverage is more favorable at the outset. And their failures — and there are failures — are more frequently absorbed by the system, offering second chances unavailable to newcomers without famous surnames.
              </p>
              <br />
              <p>
                This is not a condemnation. It is a documentation. A record for the curious, the obsessive, and the geeky minority who want to decode legacy with the precision of a sleuth and the flair of a typographer.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <img src={nepo} alt="nepo" className="block w-full h-auto" />
        </div>


      </div>

      {/* right: 50%, 3 rows */}
      <div className="w-[50%] min-w-0 flex flex-col">

        {/* row 1: family dynasties */}
        <div className='border border-black/50 p-6'>
          <div className='label-medium' style={{ color: 'var(--color-red)' }}>
            FAMILY DYNASTY
          </div>
          <div className='head-large'>
            Hollywood's Most Powerful Bloodlines
          </div>
          <div className='subheader-medium mb-4'>
            Mapped. Don't just make it in Hollywood — they were it.
          </div>

          {familyDynasties.slice(0, 5).map((item) => (
            <div key={item.dynasty_name}>
              <div className='flex items-center body-medium w-full'>
                <div className='w-[420px]'>
                  THE {item.dynasty_name.toUpperCase()} ({item.member_count} members)
                </div>

                <div className='w-[140px]'>
                  MAX: {Number(item.max_nepo_score).toFixed(0)}
                </div>

                <div className='w-[200px]'>
                  TOTAL: {Number(item.total_nepo_score).toFixed(0)}
                </div>

                <div className='ml-auto'>
                  AVG:{Number(item.avg_nepo_score).toFixed(0)}
                </div>
              </div>

              <div className='w-full h-2 bg-[#D4C9B5] mb-4'>
                <div
                  className='h-2 bg-red'
                  style={{ width: `${(Number(item.avg_nepo_score).toFixed(0) / 3318) * 100}%` }}
                />
              </div>
            </div>
          ))}

        </div>

        {/* row 2: search bar */}
        <div className="flex flex-col border border-black/50 p-6">

          <div className="label-medium mb-2" style={{ color: 'var(--color-red)' }}>
            🔍 INVESTIGATE
          </div>

          <div className="flex flex-row gap-3 min-w-0 w-full mb-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search any names..."
              className="h-10 min-w-0 flex-1 border border-gray-400 px-4 bg-[#D4C9B5]"
            />
            <NavLink to={`/evidence_board?keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}`}>
              <Button className="always-active label-medium">
                GO
              </Button>
            </NavLink>
          </div>

          <div className="label-medium mb-2" style={{ color: 'var(--color-print)' }}>
            Category
          </div>

          <div className="flex flex-row">
            {[
              { label: 'Director', value: 'director' },
              { label: 'Actor', value: 'actor' },
              { label: 'Producer', value: 'producer' },
              { label: 'Writer', value: 'writer' },
              { label: 'Composer', value: 'composer' },
            ].map((item) => (
              <Button
                key={item.value}
                className={'mr-2 mb-2 h-6 px-4 ' + (category.includes(item.value) ? 'always-active' : '')}
                onClick={() => handleCategoryClick(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>

        </div>

        {/* row 3 */}
        <div className="grow p-6">
          <div className='label-medium mb-2' style={{ color: 'var(--color-red)' }}>
            NEPOBABY LEADERBOARD — TOP SUBJECTS
          </div>

          {topNepoBabies.slice(0, 10).map((item) => (
            <div key={item.person_id} className='mb-2 flex justify-between items-center'>
              <div className='body-medium'>
                {item.name}
              </div>
              <div className='flex gap-3'>
                <div className='label-medium' style={{ color: 'var(--color-print)' }}>
                  {item.top_categories?.[0].category || 'N/A'}
                </div>

                <div className='h-5 px-2 py-1 text-white flex items-center justify-center' style={{ backgroundColor: 'var(--color-red)' }}>
                  {Number(item.nepo_score).toFixed(0)}
                </div>
              </div>

            </div>
          ))}

          <NavLink to={`/the_score`}>
            <div className='label-medium' style={{ color: 'var(--color-red)' }}>
              VIEW FULL RANKINGS →
            </div>
          </NavLink>

        </div>
      </div>
    </div>

  )
}

export default Home
