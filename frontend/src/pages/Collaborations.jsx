import { useEffect, useState } from 'react'
import config from '../config.json'

function Collaborations() {
  const [pairs, setPairs] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`https://${config.server_host}/analysis/top_nepo_collaborations`)
      .then(res => res.json())
      .then(resJson => {
        setPairs(resJson)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching collaborations:', err)
        setPairs([])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className='p-6 body-medium text-print'>Loading...</div>
  if (!pairs || pairs.length === 0) return <div className='p-6 body-medium text-print'>No data on file.</div>

  const maxCollabs = Math.max(...pairs.map(p => p.total_collaborations))

  const PersonCard = ({ name, image }) => {
    // const PersonCard = ({ name, image, nepoScore }) => {
    const parts = name.trim().split(' ')
    const last = parts.pop()
    const first = parts.join(' ')
    // const isNepo = nepoScore > 0

    return (
      <div className='flex flex-col items-center gap-1' style={{ width: '140px' }}>
        {/* Portrait */}
        <div className='overflow-hidden relative' style={{ width: '140px', height: '155px', border: '3px solid #8b2020' }}>
          <img
            referrerPolicy="no-referrer"
            src={image}
            alt={name}
            className='w-full h-full object-cover'
            onError={e => {
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e8e0d0&color=1a160d&size=200`
            }}
          />
          {/* {isNepo && (
            <div className='absolute top-0 right-0 bg-red text-paper label-tiny px-1 py-0.5' style={{ fontSize: '10px' }}>
              NEPO CONFIRMED
            </div>
          )} */}
        </div>

        {/* Name + score */}
        <div className='text-center' style={{ minHeight: '52px' }}>
          {first && (
            <div className='subheader-medium text-ink' style={{ fontSize: '14px' }}>
              {first}
            </div>
          )}
          <div className='label-tiny text-ink' style={{ fontSize: '15px' }}>
            {last.toUpperCase()}
          </div>
          {/* {isNepo && (
            <div className='label-tiny text-red' style={{ fontSize: '11px' }}>
              {Math.round(nepoScore)} NEPO SCORE<sup>TM</sup>
            </div>
          )} */}
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col w-full min-w-0 bg-paper px-8 py-6'>

      {/* Page header */}
      <div className='mb-6'>
        <div className='label-tiny text-red' style={{ fontSize: '11px' }}>
          Classified Index · Repeated Co-Appearances Division
        </div>
        <div className='head-huge text-ink' style={{ fontSize: '36px', lineHeight: 1.1 }}>
          THE 25 PAIRS WHO COULD NOT STOP SHOWING UP TOGETHER
        </div>
        <div className='subheader-medium text-print mt-1' style={{ fontSize: '13px' }}>
          Ranked by total shared credits. Each connection is documented, cross-referenced, and pinned to the board. The red string does not lie.
        </div>
      </div>

      <div className='w-full border-t-2 border-ink mb-6'></div>

      {/* Grid of pairs */}
      <div className='grid gap-x-8 gap-y-10' style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {pairs.map((pair, idx) => {
          const pct = maxCollabs > 0 ? (pair.total_collaborations / maxCollabs) * 100 : 0

          return (
            <div key={idx} className='flex flex-col gap-1'>

              {/* Rank */}
              <div className='label-tiny text-ink text-center mb-1' style={{ fontSize: '13px' }}>
                #{idx + 1}
              </div>

              {/* Two portraits side by side */}
              <div className='flex flex-row gap-3 justify-center'>
                <PersonCard
                  name={pair.person_name}
                  image={pair.person_image_url}
                  nepoScore={pair.person_neposcore}
                />
                <PersonCard
                  name={pair.colleague_name}
                  image={pair.colleague_image_url}
                  nepoScore={pair.colleague_neposcore}
                />
              </div>

              {/* Collaboration bar */}
              <div className='mt-2'>
                <div className='relative w-full h-2' style={{ backgroundColor: '#c8b89a' }}>
                  <div
                    className='absolute left-0 top-0 h-full'
                    style={{ width: `${pct}%`, backgroundColor: '#8b2020' }}
                  />
                </div>

                <div className='relative w-full mt-0.5' style={{ height: '18px' }}>
                  <span className='absolute left-0 label-tiny text-print' style={{ fontSize: '11px' }}>0</span>
                  <span
                    className='absolute label-tiny text-ink'
                    style={{
                      fontSize: '11px',
                      left: `clamp(10%, ${pct}%, 85%)`,
                      transform: 'translateX(-50%)',
                      fontWeight: 700,
                    }}
                  >
                    {pair.total_collaborations}
                  </span>
                  <span className='absolute right-0 label-tiny text-print' style={{ fontSize: '11px' }}>{maxCollabs}</span>
                </div>
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Collaborations