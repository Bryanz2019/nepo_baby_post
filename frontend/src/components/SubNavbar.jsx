import { NavLink } from 'react-router';
import './Navbar.css';

function SubNavbar() {

  return (
    <>
      <nav className="bg-ink pt-2 pb-1">
        <ul className="pl-12 w-full flex flex-row justify-start items-center gap-[6%]">
          <li><NavLink to="." end className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`}>QUICK FACTS</NavLink></li>
          <li><NavLink to="career_dossier" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`} >CAREER DOSSIER</NavLink></li>
          <li><NavLink to="star_file" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`}>STAR FILE</NavLink></li>
          <li><NavLink to="family_tree" className={({ isActive }) => `px-4 py-1 label-medium [.active-link&]:bg-red [&.active-link]:text-paper text-subtle ${isActive ? 'active-link' : 'inactive-link'}`}>FAMILY TREE</NavLink></li>
        </ul>
      </nav>
    </>
  );
}

export default SubNavbar;
