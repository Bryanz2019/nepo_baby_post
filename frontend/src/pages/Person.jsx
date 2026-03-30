import { useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router'
import LeftPanel from '../components/LeftPanel'
import SubNavbar from '../components/SubNavbar';
import config from '../config.json';
import ProfileTable from '../components/ProfileTable';


function Person() {
    const { id } = useParams();
    const [data, setData] = useState(null);

    useEffect(() => {
        fetch(`http://${config.server_host}:${config.server_port}/person/${id}`)
            .then(res => res.json())
            .then(resJson => {
                const person = resJson[0];
                if (person) {
                    const formatted = person.professions?.split(',').map(
                      s => s.trim().replaceAll('_',' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    ).join(', ');
                    setData({ ...person, professions: formatted });
                }
            }).catch(err => {
                console.error('Error fetching person data:', err);
            });
      }, [id]);

    if (!data) {
        return <div className='p-6'>Loading...</div>
    }


    const panelData = [
      { key: 'FULL NAME', value: data.primary_name ? data.primary_name : 'N/A' },
      { key: 'BORN', value: data.birth_year ? data.birth_year : 'N/A' },
      { key: 'PROFESSION', value: data.professions ? data.professions : 'N/A' },
      { key: 'DEBUT AGE', value: data.career_start_year && data.birth_year ? data.career_start_year - data.birth_year : 'N/A' }
    ]

    return (
        // h-full fills the content area below the navbar; flex-row splits left/right
        <div className='flex flex-row w-full h-full bg-paper'>

            {/* Left panel — sticky, scrolls internally if content overflows */}
            <LeftPanel>
              <div className='relative label-tiny text-red -mt-2'>
                FRONT PAGE &nbsp;
                <span className='label-tiny text-print'>/ &nbsp;SUBJECT FILE</span>
                <span className='absolute right-0 label-tiny text-print'>NO. {data.person_id}</span>
              </div>

              <div className="divider -mb-2 -mt-4 -mx-4 p-0"></div>

              <div className='w-56 h-56 border-2 border-red relative'>
                <img referrerPolicy="no-referrer" src={data?.image_url} alt={data?.primary_name} className='h-full w-full object-cover' />
                {data.nepo_score > 0 && (
                  <div className='absolute top-0 right-0 bg-red text-paper label-tiny px-2 py-0.5'>
                    NEPO CONFIRMED
                  </div>
                )}
              </div>
              
              <div className='flex flex-col'>
                <div className='head-huge text-ink text-[24px] mb-0.5'>{data.primary_name}</div>
                <div className='head-huge text-ink text-[38px]'>{data.nepo_score? Math.round(data.nepo_score * 100) / 100 : 0}
                  <span className='label-tiny text-red ml-1'>NEPO SCORE<sup>TM</sup></span>
                </div>
                <div className='label-tiny text-print'>SINCE {data.career_start_year? data.career_start_year : 'N/A'}</div>
                <div className='flex flex-row flex-wrap mt-0.5 gap-y-1'>
                  {data.professions && data.professions.split(', ').map((prof, idx) => (
                    <div key={idx} className='border-0 w-fit h-fit px-2 pt-0.5 flex items-end bg-ink text-paper justify-center label-tiny mr-2'>
                      {prof.charAt(0).toUpperCase() + prof.slice(1)}
                    </div>
                  ))}
                </div>
              </div>

              <div className='w-full bg-panel mt-2'>
                <ProfileTable className='border-0 px-0!' title='KEY METRICS' data={panelData} />
              </div>
            </LeftPanel>

            {/* Right pane — scrolls independently, never overlaps navbar */}
            <div className='flex flex-col flex-1 min-w-0 overflow-y-auto h-full'>
                <SubNavbar />
                <Outlet context={data} />
            </div>
        </div>
    )
}

export default Person