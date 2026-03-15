import { useState, useEffect } from 'react';
import { NavLink } from 'react-router';
import './Navbar.css';
import surpriseGif from '../assets/catmeme.gif'; 
import name from '../assets/name.png';

const SurpriseModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h1 style={styles.text}>SURPRISE! You've visited all the tabs! Yes, they are all the same.</h1>
        <img src={surpriseGif} alt="Surprise!" style={styles.gif} />
        <button onClick={onClose} style={styles.button}>Close</button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
  },
  modal: {
    backgroundColor: 'white', 
    padding: '40px', borderRadius: '15px', maxWidth: '500px', width: '90%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px'
  },
  text: { fontSize: '16px', color: '#ff4500', marginBottom: '20px' },
  gif: { height: '50%', width: '50%', borderRadius: '10px' },
  button: { marginTop: '20px', padding: '10px 20px', fontSize: '18px', cursor: 'pointer' }
};


function Navbar() {
  const allTabs = ['home', 'about', 'contact'];
  const [visitedTabs, setVisitedTabs] = useState(new Set(['home']));
  const [showModal, setShowModal] = useState(false);
  const handleTabClick = (tabId) => {
    setVisitedTabs(prev => new Set(prev).add(tabId));
  };

  useEffect(() => {
    if (visitedTabs.size === allTabs.length) {
      setShowModal(true);
      setVisitedTabs(prev => new Set(prev).add('all'));
    }
  }, [visitedTabs]);

  return (
    <>
      <SurpriseModal isOpen={showModal} onClose={() => setShowModal(false)} />
      <nav className="navbar bg-ink">
        <NavLink to="/" className='w-full flex h-5/6 justify-center items-center bg-paper'>
          <img style={{height: '80%'}} src={name} alt="Nepo Logo" />
        </NavLink>
        <ul className="nav-menu w-full h-1/6">
          <li><NavLink to="/" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('home')}>Home</NavLink></li>
          <li><NavLink to="/comparison" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('comparison')}>Comparison</NavLink></li>
          <li><NavLink to="/analysis" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} onClick={() => handleTabClick('analysis')}>Analysis</NavLink></li>
        </ul>
      </nav>
    </>
  );
}

export default Navbar;
