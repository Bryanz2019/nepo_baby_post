import { useOutletContext } from 'react-router'
import ProfileTable from '../components/ProfileTable'

function QuickFacts() {
  const data = useOutletContext()

  if (!data) {
    return <div className='p-6'>Loading...</div>
  }

  const profileData = [
    { key: 'FULL NAME', value: data.primary_name ? data.primary_name : 'N/A' },
    { key: 'BORN', value: data.birth_year ? data.birth_year : 'N/A' },
    { key: 'PROFESSION', value: data.professions ? data.professions : 'N/A' },
    { key: 'KNOWN FOR', value: data.top_titles && data.top_titles.length > 0 ? data.top_titles.slice(0, 3).map(t => t.primary_title).join(', ') : 'N/A' },
    { key: 'DEBUT AGE', value: data.career_start_year && data.birth_year ? data.career_start_year - data.birth_year : 'N/A' }
  ]

  return (
    <>
      <div className='flex flex-col w-full min-w-0'>
        <div className='px-6 pt-5 pb-1 label-tiny text-red'>
          CAREER METRICS -- RANKED: WHO'S RIDING THE WAVE AND WHO ACTUALLY EARNED IT?
        </div>

        <div className='flex flex-row justify-evenly pt-2 gap-4 px-6 w-full min-w-0'>
          <div className='py-3 bg-panel border flex-1 min-w-0 flex flex-col items-center justify-center text-center'>
            <div className='pb-1 label-medium text-red'>{data.total_titles}</div>
            <div className='body-medium text-print'>Total Films</div>
          </div>
          <div className='py-3 bg-panel border flex-1 min-w-0 flex flex-col items-center justify-center text-center'>
            <div className='pb-1 label-medium text-red'>{data.avg_rating}</div>
            <div className='body-medium text-print'>Avg. Rating</div>
          </div>
          <div className='py-3 bg-panel border flex-1 min-w-0 flex flex-col items-center justify-center text-center'>
            <div className='pb-1 label-medium text-red'>{data.total_votes.toLocaleString()}</div>
            <div className='body-medium text-print'>Total Votes</div>
          </div>
        </div>

        <div className="divider divider-neutral px-6"></div>

        <div className='pb-4 px-6'>
          <div className='label-tiny text-red'>QUICK FACTS</div>
          <div></div>
        </div>

        <div className='px-6'>
          <div className='w-full bg-panel border'>
            <ProfileTable className='w-full' data={profileData} />
          </div>
        </div>

        {data.nepo_score !== null && data.nepo_score > 0 && (
          <div className='mx-6 mt-4 p-3 border-3 border-red bg-red/8'>
            <div className='head-medium text-red'>
              <span className='text-yellow-600 m-2'>⚠</span>
              NEPO BABY CONFIRMED
            </div>
            <div className='subheader-medium text-print mx-6'>Nepo Score<sup>TM</sup>: &nbsp;&nbsp;{Math.round(data.nepo_score * 100) / 100}</div>
          </div>
        )}

      </div>
    </>
  )
}

export default QuickFacts