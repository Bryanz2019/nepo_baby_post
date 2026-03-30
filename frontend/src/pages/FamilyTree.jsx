import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import config from '../config.json';

function FamilyTree() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  let navigate = useNavigate();

  useEffect(() => {
      fetch(`http://${config.server_host}:${config.server_port}/person/${id}/family`)
        .then(res => res.json())
        .then(resJson => {
          setData(resJson);
        }).catch(err => {
            console.error('Error fetching person data:', err);
        });
    }, [id]);

  if (!data) {
      return <div className='p-6'>Loading...</div>
  }
  console.log('Family tree data:', data);

  return (
    <>
      <div className='flex flex-col w-full min-w-0'>

        <div className='pt-5 px-6'>
          <div className='label-tiny text-red'>FAMILY TREE -- RANKED: WHO'S RIDING THE WAVE AND WHO'S ACTUALLY EARNED IT</div>
        </div>

        <div className='mt-4 mx-6 max-h-[65vh] overflow-y-auto bg-[#2C1A00] border-8 border-ink'>
          <div className='pt-2 px-6 label-tiny text-subtle'>
            BANANA DYNASTY - CLASSIFIED CONNECTIONS BOARD
          </div>
          <div className='flex flex-row flex-wrap py-4 px-6 gap-8 justify-start'>
            {data !== null && data.map((member, idx) => (
              <div key={idx} className='flex flex-col items-center gap-0.5 w-32 relative' onClick={() => {navigate(`/person/${member.related_person_id}`);}}>
                <div className='bg-red w-2 h-2 border-1 border-paper rounded-full absolute -top-1'></div>
                <img
                  src={member.related_person_image_url}
                  alt={member.related_person_name}
                  className='w-28 h-32 object-cover border-2 border-paper'
                />
                <div className='label-tiny text-subtle text-center'>{member.kinship}</div>
                <div className='label-tiny text-paper text-center'>{member.related_person_name}</div>
                <div className='label-tiny text-red  text-center'>NEPO {Math.round(member.related_person_nepo_score * 100) / 100}<sup>TM</sup></div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}

export default FamilyTree