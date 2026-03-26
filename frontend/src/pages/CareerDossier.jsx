import { useOutletContext } from 'react-router'

function CareerDossier() {
  const data = useOutletContext()

  if (!data) {
    return <div className='p-6'>Loading...</div>
  }

  return (
    <>
      <div className='flex flex-col w-full min-w-0'>

        <div className='pt-5 px-6'>
          <div className='label-tiny text-red'>CAREER DOSSIER -- COMPLETE PRODUCTION RECORD</div>
          <div className='subheader-medium text-ink'>Not all Nepo babies are created equal.</div>
        </div>

        <div className='h-[40vh] overflow-y-auto'>
          {data.top_titles !== null && data.top_titles.map((title, idx) => (
            <div key={idx} className='mx-6 mt-4 p-3 border border-red bg-red/6'>
              <div className='label-medium text-ink pb-1 px-2'>{title.primary_title}
                <span className='ml-2 px-1.5 py-0.5 text-xs text-red bg-red/20 rounded'>{title.title_type}</span>
                <span className='ml-2 px-1.5 py-0.5 text-xs text-red bg-red/20 rounded'>{'🔥 ' + title.num_votes.toLocaleString()}</span>
                <span className='label-medium text-red px-2'>★ {title.average_rating}</span>
              </div>
              <div className='body-medium text-print pb-1 pl-2'>{title.start_year}
                <span className='ml-1.5 py-0.5'>·</span>
                <span className='ml-1.5 py-0.5'>{title.category}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="divider divider-neutral px-6"></div>

        <div className='px-6 label-tiny text-red'>PRODUCTION SUMMARY</div>

        <div className='flex flex-row justify-evenly p-2 gap-4 px-6 w-full min-w-0'>
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

      </div>
    </>
  )
}

export default CareerDossier