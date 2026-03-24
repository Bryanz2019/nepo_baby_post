import { BrowserRouter, Routes, Route } from "react-router";
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Compare from './pages/Compare';
import EvidenceBoard from './pages/EvidenceBoard';
import NepoPair from './pages/NepoPair';
import Collaborations from './pages/Collaborations';
import Demo from './pages/Demo';
import IndustryPage from './pages/IndustryPage';

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col">
        <Navbar />
        <div className="w-screen">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path='/compare' element={<Compare />} />
            <Route path='/evidence_board' element={<EvidenceBoard />} />
            <Route path='/nepo_pair' element={<NepoPair />} />
            <Route path='/collaborations' element={<Collaborations />} />
            <Route path='/demo' element={<Demo />} />
            <Route path='/industry' element={<IndustryPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App