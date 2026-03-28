import { BrowserRouter, Routes, Route } from "react-router";
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Compare from './pages/Compare';
import EvidenceBoard from './pages/EvidenceBoard';
import NepoPair from './pages/NepoPair';
import Collaborations from './pages/Collaborations';
import Demo from './pages/Demo';
import Person from "./pages/Person";
import QuickFacts from "./pages/QuickFacts";
import CareerDossier from "./pages/CareerDossier";
import FamilyTree from "./pages/FamilyTree";

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
            <Route path='/person/:id' element={<Person />} >
              <Route index element={<QuickFacts />} />
              <Route path='career_dossier' element={<CareerDossier />} />
              <Route path='family_tree' element={<FamilyTree />} />
            </Route>
            <Route path='*' element={<div className='text-center py-10 text-8xl text-red-400'>404 Not Found</div>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App