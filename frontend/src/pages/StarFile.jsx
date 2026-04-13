import { useOutletContext } from 'react-router'
import { useEffect, useState } from 'react'
import config from '../config.json'

function StarFile() {
  const data = useOutletContext()
  const [collaborators, setCollaborators] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!data?.person_id) return
    setLoading(true)
    fetch(`https://${config.server_host}/person/${data.person_id}/collaborators`)
      .then(res => res.json())
      .then(resJson => {
        setCollaborators(resJson)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching collaborators:', err)
        setCollaborators([])
        setLoading(false)
      })
  }, [data?.person_id])

  if (!data) return <div className='p-6'>Loading...</div>

  return (
    <div className='flex flex-col w-full min-w-0'>

      {/* Section header */}
      <div className='px-6 pt-5 pb-1 label-tiny text-red'>
        STAR FILE — INDUSTRY NETWORK CONNECTIONS
      </div>

      <div className='px-6 mt-3 mb-6'>

        <div className='label-tiny text-print mb-4'>PROFESSIONAL CONNECTIONS</div>

        {loading && (
          <div className='body-medium text-print p-4'>Loading connections...</div>
        )}

        {!loading && collaborators && collaborators.length === 0 && (
          <div className='body-medium text-print p-4 italic'>No recorded collaborations on file.</div>
        )}

        {!loading && collaborators && collaborators.length > 0 && (
          <div className='flex flex-row flex-wrap gap-8'>
            {collaborators.map((collab) => {
              const parts = collab.colleague_name.trim().split(' ')
              const last = parts.pop()
              const first = parts.join(' ')
              const isNepo = collab.nepo_score > 0
              const maxCollabs = collaborators ? Math.max(...collaborators.map(c => c.total_collaborations)) : 1

              return (
                <div
                  key={collab.colleague_id}
                  className='flex flex-col items-center gap-2 cursor-pointer group'
                  style={{ width: '180px' }}
                  onClick={() => window.location.href = `/person/${collab.colleague_id}`}
                >
                  {/* Portrait photo */}
                  <div
                    className='overflow-hidden relative'
                    style={{
                      width: '180px',
                      height: '200px',
                      border: `3px solid #8b2020`,
                    }}
                  >
                    <img
                      referrerPolicy="no-referrer"
                      src={collab.colleague_image_url}
                      alt={collab.colleague_name}
                      className='w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-150'
                      onError={e => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(collab.colleague_name)}&background=e8e0d0&color=1a160d&size=200`
                      }}
                    />
                    {isNepo && (
                      <div className='absolute top-0 right-0 bg-red text-paper label-tiny px-1 py-0.5' style={{ fontSize: '10px' }}>
                        NEPO CONFIRMED
                      </div>
                    )}
                  </div>

                  {/* Name + score */}
                  <div className='text-center' style={{ minHeight: '70px' }}>
                    {first && (
                      <div className='subheader-medium text-ink' style={{ fontSize: '15px' }}>
                        {first}
                      </div>
                    )}
                    <div className='label-tiny text-ink' style={{ fontSize: '17px', letterSpacing: '0.03em' }}>
                      {last.toUpperCase()}
                    </div>
                    {isNepo && (
                      <div className='label-tiny text-red mt-0.5' style={{ fontSize: '13px' }}>
                        {Math.round(collab.nepo_score)} NEPO SCORE<sup>TM</sup>
                      </div>
                    )}
                  </div>
                  {/* Collaboration times bar */}
                  <div className='mt-2 w-full'>
                  <div className='relative w-full h-1.5' style={{ backgroundColor: '#c8b89a' }}>
                    <div
                      className='absolute left-0 top-0 h-full'
                      style={{
                        width: `${(collab.total_collaborations / maxCollabs) * 100}%`,
                        backgroundColor: '#8b2020'
                      }}
                    />
                  </div>
                    <div className='flex justify-between mt-0.5'>
                      <span className='label-tiny text-print' style={{ fontSize: '10px' }}>0</span>
                      <span className='label-tiny text-ink' style={{ fontSize: '10px', fontWeight: 700 }}>{collab.total_collaborations}</span>
                      <span className='label-tiny text-print' style={{ fontSize: '10px' }}>{maxCollabs}</span>
                    </div>
                  </div>
                </div>               
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

export default StarFile
