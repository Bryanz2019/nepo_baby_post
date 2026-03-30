import { NavLink } from 'react-router';
import './Navbar.css';
import name from '../assets/name.png';


function Navbar() {

  return (
    <>
      <nav className="navbar bg-ink">
        <NavLink to="/" className='w-full flex flex-col h-13/16 justify-center items-center bg-paper'>
          <img style={{height: '80%'}} src={name} alt="Nepo Logo" />
          <div className='label-tiny text-muted relative -top-2'>
            EVERY CASTING SHEET TELLS A STORY - YOU JUST HAVE TO KNOW WHOSE LAST NAME TO LOOK FOR
          </div>
        </NavLink>
        <ul className="nav-menu w-full h-3/16">
          <li><NavLink to="/" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('home')}>FRONT PAGE</NavLink></li>
          <li><NavLink to="/compare" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('comparison')}>COMPARE</NavLink></li>
          <li><NavLink to="/nepo_pair" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('nepopair')}>NEPOPAIR</NavLink></li>

          <li><NavLink to="/industry" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('industry')}>INDUSTRY TREND</NavLink></li>
          <li><NavLink to="/evidence_board" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('analysis')}>EVIDENCE BOARD</NavLink></li>
          <li><NavLink to="/the_score" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('score')}>THE SCORE</NavLink></li>
          <li><NavLink to="/collaborations" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('collaborations')}>COLLABORATIONS</NavLink></li>
          <li><NavLink to="/demo" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('demo')}>DEMO: DO NOT DELETE</NavLink></li>
        </ul>
      </nav>
    </>
  );
}

export default Navbar;