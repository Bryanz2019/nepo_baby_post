import { useState } from 'react'
import nepo from '../assets/nepo.png'

function Home() {
  const [count, setCount] = useState(0)

  return (
    <>
      <img src={nepo} alt="Nepo logo" />
    </>
  )
}

export default Home