import { BrowserRouter, Routes, Route } from "react-router";
import Navbar from './components/Navbar';
import Home from './pages/Home';

function App() {

  return (
    <BrowserRouter>
      <div style={{display: 'flex', flexDirection: 'column'}}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path='/comparison' element={<Home />} />
          <Route path='/analysis' element={<Home />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App