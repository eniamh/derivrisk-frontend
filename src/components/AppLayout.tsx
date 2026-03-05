// src/layouts/AppLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from '../components/NavBar'; // adjust path if needed

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50"> {/* optional full-page styling */}
      <NavBar />
      
      {/* Main content area – pages will render here */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Optional: footer, etc. */}
      {/* <footer>...</footer> */}
    </div>
  );
};

export default AppLayout;