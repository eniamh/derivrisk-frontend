import { NavLink } from 'react-router-dom';

const NavBar = () => {
  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex gap-6">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `hover:underline ${isActive ? 'font-bold underline' : ''}`
          }
        >
          FX Forward Pricing & Risk
        </NavLink>
        <NavLink
          to="/rates-comparison"
          className={({ isActive }) =>
            `hover:underline ${isActive ? 'font-bold underline' : ''}`
          }
        >
          Short-Rate Model Comparison
        </NavLink>
      </div>
    </nav>
  );
};

export default NavBar;